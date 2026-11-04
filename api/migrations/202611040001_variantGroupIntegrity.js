/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  const result = await knex.raw(`
    SELECT
      (SELECT count(*)::int FROM product_image AS image
        JOIN product_variant AS variant ON variant.id = image.product_variant_id
        WHERE image.product_group_id <> variant.product_group_id) AS images,
      (SELECT count(*)::int FROM product_highlight_spec AS highlight
        JOIN product_variant AS variant ON variant.id = highlight.product_variant_id
        WHERE highlight.product_group_id <> variant.product_group_id) AS highlights
  `);
  const { images, highlights } = result.rows[0];
  if (images !== 0 || highlights !== 0) {
    throw new Error(
      `Repair variant/group links before migrating: ${images} images, ${highlights} highlights.`
    );
  }

  await knex.raw(`
    ALTER TABLE product_variant
    ADD CONSTRAINT uq_product_variant_id_group UNIQUE (id, product_group_id)
  `);
  await knex.raw(`
    ALTER TABLE product_image
    ADD CONSTRAINT fk_product_image_variant_group
    FOREIGN KEY (product_variant_id, product_group_id)
    REFERENCES product_variant (id, product_group_id)
    DEFERRABLE INITIALLY DEFERRED
  `);
  await knex.raw(`
    ALTER TABLE product_highlight_spec
    ADD CONSTRAINT fk_product_highlight_spec_variant_group
    FOREIGN KEY (product_variant_id, product_group_id)
    REFERENCES product_variant (id, product_group_id)
    DEFERRABLE INITIALLY DEFERRED
  `);
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.raw(`
    ALTER TABLE product_highlight_spec
    DROP CONSTRAINT fk_product_highlight_spec_variant_group
  `);
  await knex.raw(`
    ALTER TABLE product_image
    DROP CONSTRAINT fk_product_image_variant_group
  `);
  await knex.raw(`
    ALTER TABLE product_variant
    DROP CONSTRAINT uq_product_variant_id_group
  `);
};
