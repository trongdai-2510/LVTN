const TABLE = 'product_image';
const FILE_USAGE_TABLE = 'file_usage';
const UNIQUE_INDEX = 'uq_product_image_active_group_file';

exports.up = async function up(knex) {
  await knex.raw(`
    WITH ranked_images AS (
      SELECT
        id,
        file_id,
        row_number() OVER (
          PARTITION BY product_group_id, file_id
          ORDER BY sort_order ASC, created_at ASC, id ASC
        ) AS duplicate_rank
      FROM ${TABLE}
      WHERE deleted_at IS NULL
    ),
    duplicate_images AS (
      SELECT id, file_id
      FROM ranked_images
      WHERE duplicate_rank > 1
    ),
    archived_images AS (
      UPDATE ${TABLE} AS product_image_record
      SET
        deleted_at = NOW(),
        updated_at = NOW()
      FROM duplicate_images
      WHERE product_image_record.id = duplicate_images.id
      RETURNING product_image_record.id, product_image_record.file_id
    )
    UPDATE ${FILE_USAGE_TABLE} AS file_usage_record
    SET
      deleted_at = NOW(),
      updated_at = NOW()
    FROM archived_images
    WHERE file_usage_record.entity_type = 'product_image'
      AND file_usage_record.entity_id = archived_images.id
      AND file_usage_record.field_name = 'file_id'
      AND file_usage_record.deleted_at IS NULL
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS ${UNIQUE_INDEX}
    ON ${TABLE}(product_group_id, file_id)
    WHERE deleted_at IS NULL
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`DROP INDEX IF EXISTS ${UNIQUE_INDEX}`);
};
