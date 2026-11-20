/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.createTable('media_intake_batch', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('batch_name', 255).nullable();
    table.uuid('import_batch_id').nullable().references('id').inTable('import_batch').onDelete('RESTRICT');
    table.integer('created_by').nullable();
    table.string('status', 24).notNullable().defaultTo('open');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.check("status IN ('open', 'partially_applied', 'applied', 'archived')", [], 'chk_media_intake_batch_status');
    table.index(['status', 'created_at'], 'idx_media_intake_batch_status_created');
  });

  await knex.schema.createTable('media_intake_item', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('batch_id').notNullable().references('id').inTable('media_intake_batch').onDelete('RESTRICT');
    table.uuid('file_id').notNullable().references('id').inTable('file_metadata').onDelete('RESTRICT');
    table.text('source_path').notNullable();
    table.string('content_sha256', 64).nullable();
    table.string('status', 24).notNullable().defaultTo('pending');
    table.jsonb('candidates').notNullable().defaultTo('[]');
    table.jsonb('decision').nullable();
    table.jsonb('applied_result').nullable();
    table.integer('confirmed_by').nullable();
    table.timestamp('analyzed_at', { useTz: true }).nullable();
    table.timestamp('confirmed_at', { useTz: true }).nullable();
    table.timestamp('applied_at', { useTz: true }).nullable();
    table.text('error_message').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.check("status IN ('pending', 'suggested', 'unmatched', 'confirmed', 'applied', 'skipped', 'failed')", [], 'chk_media_intake_item_status');
    table.check("btrim(source_path) <> ''", [], 'chk_media_intake_item_source_path');
    table.check("content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$'", [], 'chk_media_intake_item_sha256');
    table.unique(['batch_id', 'file_id'], { indexName: 'uq_media_intake_item_batch_file' });
    table.index(['batch_id', 'status'], 'idx_media_intake_item_batch_status');
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('media_intake_item');
  await knex.schema.dropTableIfExists('media_intake_batch');
};
