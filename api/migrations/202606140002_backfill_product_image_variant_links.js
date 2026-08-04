const PRODUCT_IMAGE_TABLE = 'product_image';
const PRODUCT_VARIANT_TABLE = 'product_variant';
const FILE_METADATA_TABLE = 'file_metadata';

exports.up = async function up(knex) {
  await knex.raw(`
    WITH image_variant_candidates AS (
      SELECT
        product_image_record.id AS product_image_id,
        product_variant_record.id AS product_variant_id,
        row_number() OVER (
          PARTITION BY product_image_record.id
          ORDER BY
            length(regexp_replace(lower(product_variant_record.model_code), '[^a-z0-9]+', '', 'g')) DESC,
            product_variant_record.sort_order ASC,
            product_variant_record.created_at ASC
        ) AS match_rank,
        count(*) OVER (PARTITION BY product_image_record.id) AS match_count
      FROM ${PRODUCT_IMAGE_TABLE} AS product_image_record
      INNER JOIN ${FILE_METADATA_TABLE} AS file_record
        ON file_record.id = product_image_record.file_id
      INNER JOIN ${PRODUCT_VARIANT_TABLE} AS product_variant_record
        ON product_variant_record.product_group_id = product_image_record.product_group_id
      WHERE product_image_record.deleted_at IS NULL
        AND product_image_record.product_variant_id IS NULL
        AND file_record.deleted_at IS NULL
        AND product_variant_record.deleted_at IS NULL
        AND product_variant_record.model_code IS NOT NULL
        AND btrim(product_variant_record.model_code) <> ''
        AND regexp_replace(lower(file_record.original_filename), '[^a-z0-9]+', '', 'g')
          LIKE regexp_replace(lower(product_variant_record.model_code), '[^a-z0-9]+', '', 'g') || '%'
    ),
    safe_matches AS (
      SELECT product_image_id, product_variant_id
      FROM image_variant_candidates
      WHERE match_rank = 1
        AND match_count = 1
    )
    UPDATE ${PRODUCT_IMAGE_TABLE} AS product_image_record
    SET
      product_variant_id = safe_matches.product_variant_id,
      updated_at = NOW()
    FROM safe_matches
    WHERE product_image_record.id = safe_matches.product_image_id
  `);
};

exports.down = async function down() {
  // No-op: this backfill only fills missing variant links for unambiguous image/model-code matches.
};
