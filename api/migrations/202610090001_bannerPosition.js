exports.up = async function up(knex) {
  await knex.raw('ALTER TABLE banner ALTER COLUMN position TYPE VARCHAR(512)');
};

exports.down = async function down(knex) {
  const row = await knex('banner').whereRaw('length(position) > 32').first('id');
  if (row) {
    throw new Error('Cannot shrink banner.position while page paths longer than 32 characters exist.');
  }
  await knex.raw('ALTER TABLE banner ALTER COLUMN position TYPE VARCHAR(32)');
};
