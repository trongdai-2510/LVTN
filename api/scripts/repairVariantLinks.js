const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbConfig = require('../knexfile').development.connection;
const apply = process.argv.includes('--apply');
const suspiciousHighlightId = 'adb61f38-0741-4e0d-a7b4-4ce08d1f1180';

function normalized(value) {
  return String(value ?? '').trim().toLocaleLowerCase();
}

function key(...parts) {
  return parts.join(':');
}

async function repair() {
  const db = new Client(dbConfig);
  await db.connect();
  try {
    await db.query('BEGIN');
    await db.query("SET LOCAL lock_timeout = '10s'");
    await db.query(`
      LOCK TABLE product_variant, product_image, product_highlight_spec,
        variant_attribute, file_usage IN SHARE ROW EXCLUSIVE MODE
    `);

    const images = (await db.query(`
      SELECT image.*, variant.product_group_id AS target_group_id
      FROM product_image AS image
      JOIN product_variant AS variant ON variant.id = image.product_variant_id
      WHERE image.deleted_at IS NULL
        AND image.product_group_id <> variant.product_group_id
      ORDER BY image.id
    `)).rows;
    const highlights = (await db.query(`
      SELECT highlight.*, variant.product_group_id AS target_group_id
      FROM product_highlight_spec AS highlight
      JOIN product_variant AS variant ON variant.id = highlight.product_variant_id
      WHERE highlight.deleted_at IS NULL
        AND highlight.product_group_id <> variant.product_group_id
      ORDER BY highlight.id
    `)).rows;

    if (images.length === 0 && highlights.length === 0) {
      console.log('No active group/variant mismatches.');
      await db.query('ROLLBACK');
      return;
    }

    const imagePairs = new Set();
    for (const image of images) {
      const pair = key(image.target_group_id, image.file_id);
      if (imagePairs.has(pair)) {
        throw new Error(`Multiple images would use the same target group/file: ${pair}`);
      }
      imagePairs.add(pair);
    }

    const duplicateImages = (await db.query(`
      SELECT bad.id AS bad_id, existing.id AS existing_id,
        existing.product_variant_id AS existing_variant_id
      FROM product_image AS bad
      JOIN product_variant AS variant ON variant.id = bad.product_variant_id
      JOIN product_image AS existing
        ON existing.product_group_id = variant.product_group_id
       AND existing.file_id = bad.file_id
       AND existing.deleted_at IS NULL
      WHERE bad.deleted_at IS NULL
        AND bad.product_group_id <> variant.product_group_id
    `)).rows;
    const imageById = new Map(images.map((image) => [image.id, image]));
    for (const duplicate of duplicateImages) {
      if (duplicate.existing_variant_id !== imageById.get(duplicate.bad_id)?.product_variant_id) {
        throw new Error(`Target image belongs to a different variant: ${duplicate.bad_id}`);
      }
    }

    const variantIds = [...new Set(highlights.map((row) => row.product_variant_id))];
    const attributes = variantIds.length === 0 ? [] : (await db.query(`
      SELECT id, product_variant_id, attribute_name, attribute_value
      FROM variant_attribute
      WHERE product_variant_id = ANY($1::uuid[]) AND deleted_at IS NULL
    `, [variantIds])).rows;
    const attributesByVariant = new Map();
    for (const attribute of attributes) {
      const rows = attributesByVariant.get(attribute.product_variant_id) ?? [];
      rows.push(attribute);
      attributesByVariant.set(attribute.product_variant_id, rows);
    }

    const mappedHighlights = [];
    const archivedHighlights = [];
    for (const highlight of highlights) {
      if (highlight.source_type !== 'variant_attribute') {
        throw new Error(`Unexpected highlight source type: ${highlight.id}`);
      }
      const ownAttributes = attributesByVariant.get(highlight.product_variant_id) ?? [];
      const sameValue = ownAttributes.filter((attribute) =>
        normalized(attribute.attribute_value) === normalized(highlight.display_value)
      );
      const exact = sameValue.filter((attribute) =>
        normalized(attribute.attribute_name) === normalized(highlight.display_label)
      );
      const matches = exact.length > 0 ? exact : sameValue;
      if (matches.length === 1) {
        mappedHighlights.push({ ...highlight, new_source_id: matches[0].id });
      } else if (matches.length === 0 && highlight.id === suspiciousHighlightId) {
        archivedHighlights.push(highlight);
      } else {
        throw new Error(`Cannot uniquely identify the attribute for highlight: ${highlight.id}`);
      }
    }

    const targetGroups = [...new Set(mappedHighlights.map((row) => row.target_group_id))];
    const targetHighlights = targetGroups.length === 0 ? [] : (await db.query(`
      SELECT product_group_id, product_variant_id, source_id, display_label, display_value
      FROM product_highlight_spec
      WHERE product_group_id = ANY($1::uuid[]) AND deleted_at IS NULL
    `, [targetGroups])).rows;
    const existingSourceKeys = new Set(targetHighlights.map((row) =>
      key(row.product_group_id, row.product_variant_id, row.source_id)
    ));
    const existingValueKeys = new Set(targetHighlights.map((row) =>
      key(row.product_group_id, row.product_variant_id,
        normalized(row.display_label), normalized(row.display_value))
    ));
    for (const row of mappedHighlights) {
      const sourceKey = key(row.target_group_id, row.product_variant_id, row.new_source_id);
      const valueKey = key(row.target_group_id, row.product_variant_id,
        normalized(row.display_label), normalized(row.display_value));
      if (existingSourceKeys.has(sourceKey) || existingValueKeys.has(valueKey)) {
        throw new Error(`Highlight already exists in the target group: ${row.id}`);
      }
      existingSourceKeys.add(sourceKey);
      existingValueKeys.add(valueKey);
    }

    const duplicateIds = duplicateImages.map((row) => row.bad_id);
    const fileUsages = duplicateIds.length === 0 ? [] : (await db.query(`
      SELECT * FROM file_usage
      WHERE entity_type = 'product_image'
        AND field_name = 'file_id'
        AND entity_id = ANY($1::uuid[])
      ORDER BY id
    `, [duplicateIds])).rows;

    const summary = {
      image_mismatches: images.length,
      images_to_move: images.length - duplicateIds.length,
      duplicate_images_to_archive: duplicateIds.length,
      highlight_mismatches: highlights.length,
      highlights_to_move_and_relink: mappedHighlights.length,
      highlights_to_archive: archivedHighlights.length
    };
    console.log(JSON.stringify(summary));
    if (!apply) {
      console.log('Dry run only. Pass --apply to save a backup and repair the rows.');
      await db.query('ROLLBACK');
      return;
    }

    const backupDir = path.join(__dirname, '..', '..', 'backup');
    mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const backupPath = path.join(backupDir, `variantLinkBackup${stamp}.json`);
    writeFileSync(backupPath, JSON.stringify({ summary, images, highlights, fileUsages }, null, 2), {
      flag: 'wx'
    });
    console.log(`Backup: ${backupPath}`);

    if (duplicateIds.length > 0) {
      const archived = await db.query(`
        UPDATE product_image SET deleted_at = now()
        WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL
      `, [duplicateIds]);
      if (archived.rowCount !== duplicateIds.length) throw new Error('Image archive count changed.');
      await db.query(`
        UPDATE file_usage SET deleted_at = now()
        WHERE entity_type = 'product_image' AND field_name = 'file_id'
          AND entity_id = ANY($1::uuid[]) AND deleted_at IS NULL
      `, [duplicateIds]);
    }

    const movedImages = await db.query(`
      UPDATE product_image AS image
      SET product_group_id = variant.product_group_id
      FROM product_variant AS variant
      WHERE image.product_variant_id = variant.id
        AND image.deleted_at IS NULL
        AND image.product_group_id <> variant.product_group_id
    `);
    if (movedImages.rowCount !== summary.images_to_move) {
      throw new Error('Image move count changed.');
    }

    for (const row of mappedHighlights) {
      const moved = await db.query(`
        UPDATE product_highlight_spec
        SET product_group_id = $2, source_id = $3
        WHERE id = $1 AND deleted_at IS NULL AND product_group_id = $4
      `, [row.id, row.target_group_id, row.new_source_id, row.product_group_id]);
      if (moved.rowCount !== 1) throw new Error(`Highlight changed during repair: ${row.id}`);
    }
    for (const row of archivedHighlights) {
      const archived = await db.query(`
        UPDATE product_highlight_spec SET deleted_at = now()
        WHERE id = $1 AND deleted_at IS NULL
      `, [row.id]);
      if (archived.rowCount !== 1) throw new Error(`Highlight changed during archive: ${row.id}`);
    }

    const remaining = (await db.query(`
      SELECT
        (SELECT count(*)::int FROM product_image AS image JOIN product_variant AS variant
          ON variant.id = image.product_variant_id WHERE image.deleted_at IS NULL
          AND image.product_group_id <> variant.product_group_id) AS images,
        (SELECT count(*)::int FROM product_highlight_spec AS highlight
          JOIN product_variant AS variant ON variant.id = highlight.product_variant_id
          WHERE highlight.deleted_at IS NULL
          AND highlight.product_group_id <> variant.product_group_id) AS highlights
    `)).rows[0];
    if (remaining.images !== 0 || remaining.highlights !== 0) {
      throw new Error(`Mismatches remain: ${JSON.stringify(remaining)}`);
    }
    await db.query('COMMIT');
    console.log(`Committed repair: ${JSON.stringify(summary)}`);
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}

repair().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
