exports.up = async function up(knex) {
  await knex.schema.createTable('admin_user', (table) => {
    table.uuid('id').primary();
    table.text('email').notNullable();
    table.text('password_hash').notNullable();
    table.text('display_name').notNullable();
    table.text('status').notNullable().defaultTo('active');
    table.timestamp('last_login_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.unique(['email'], { indexName: 'uq_admin_user_email' });
  });

  await knex.schema.createTable('admin_role', (table) => {
    table.uuid('id').primary();
    table.text('code').notNullable();
    table.text('name').notNullable();
    table.text('description').nullable();
    table.text('status').notNullable().defaultTo('active');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.unique(['code'], { indexName: 'uq_admin_role_code' });
  });

  await knex.schema.createTable('admin_permission', (table) => {
    table.uuid('id').primary();
    table.text('code').notNullable();
    table.text('description').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['code'], { indexName: 'uq_admin_permission_code' });
  });

  await knex.schema.createTable('admin_user_role', (table) => {
    table.uuid('admin_user_id').notNullable();
    table.uuid('admin_role_id').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.primary(['admin_user_id', 'admin_role_id']);
    table
      .foreign('admin_user_id')
      .references('id')
      .inTable('admin_user')
      .onDelete('CASCADE');
    table
      .foreign('admin_role_id')
      .references('id')
      .inTable('admin_role')
      .onDelete('CASCADE');
  });

  await knex.schema.createTable('admin_role_permission', (table) => {
    table.uuid('admin_role_id').notNullable();
    table.uuid('admin_permission_id').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.primary(['admin_role_id', 'admin_permission_id']);
    table
      .foreign('admin_role_id')
      .references('id')
      .inTable('admin_role')
      .onDelete('CASCADE');
    table
      .foreign('admin_permission_id')
      .references('id')
      .inTable('admin_permission')
      .onDelete('CASCADE');
  });

  await knex.schema.createTable('admin_refresh_session', (table) => {
    table.uuid('id').primary();
    table.uuid('admin_user_id').notNullable();
    table.text('token_hash').notNullable();
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('revoked_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table
      .foreign('admin_user_id')
      .references('id')
      .inTable('admin_user')
      .onDelete('CASCADE');
  });

  await knex.raw(
    "ALTER TABLE admin_user ADD CONSTRAINT chk_admin_user_status CHECK (status IN ('active', 'inactive', 'locked'))"
  );
  await knex.raw(
    "ALTER TABLE admin_role ADD CONSTRAINT chk_admin_role_status CHECK (status IN ('active', 'inactive'))"
  );

  await knex.schema.alterTable('admin_refresh_session', (table) => {
    table.index(['admin_user_id'], 'idx_admin_refresh_session_user');
    table.index(['expires_at'], 'idx_admin_refresh_session_expires_at');
    table.index(['revoked_at'], 'idx_admin_refresh_session_revoked_at');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('admin_refresh_session');
  await knex.schema.dropTableIfExists('admin_role_permission');
  await knex.schema.dropTableIfExists('admin_user_role');
  await knex.schema.dropTableIfExists('admin_permission');
  await knex.schema.dropTableIfExists('admin_role');
  await knex.schema.dropTableIfExists('admin_user');
};
