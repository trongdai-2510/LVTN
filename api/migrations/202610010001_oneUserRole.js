exports.up = async function up(knex) {
  const duplicate = await knex('admin_user_role')
    .select('admin_user_id')
    .count('* as role_count')
    .groupBy('admin_user_id')
    .havingRaw('count(*) > 1')
    .first();

  if (duplicate) {
    throw new Error(
      'Cannot require one role per account: some accounts still have multiple roles. Resolve them manually before migrating.'
    );
  }

  await knex.schema.alterTable('admin_user_role', (table) => {
    table.unique(['admin_user_id'], { indexName: 'uq_admin_user_role_single_role' });
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('admin_user_role', (table) => {
    table.dropUnique(['admin_user_id'], 'uq_admin_user_role_single_role');
  });
};
