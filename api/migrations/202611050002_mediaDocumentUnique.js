/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  const duplicates = await knex.raw(`
    SELECT product_group_id, COALESCE(product_variant_id, '00000000-0000-0000-0000-000000000000'::uuid) AS variant_key, file_id, count(*)::int AS total
    FROM technical_document
    WHERE deleted_at IS NULL
    GROUP BY product_group_id, variant_key, file_id
    HAVING count(*) > 1
    LIMIT 1
  `);
  if (duplicates.rows.length > 0) {
    throw new Error('Resolve duplicate active technical-document file links before migrating.');
  }
  await knex.raw(`
    CREATE UNIQUE INDEX uq_technical_document_active_target_file
    ON technical_document (product_group_id, COALESCE(product_variant_id, '00000000-0000-0000-0000-000000000000'::uuid), file_id)
    WHERE deleted_at IS NULL
  `);
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS uq_technical_document_active_target_file');
};
