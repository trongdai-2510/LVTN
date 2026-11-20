/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.alterTable('tag', (table) => {
    table.string('icon_key', 24).nullable();
    table.string('tone_key', 16).nullable();
  });
  await knex.raw(
    "ALTER TABLE tag ADD CONSTRAINT chk_tag_icon_key CHECK (icon_key IS NULL OR icon_key IN ('none', 'flame', 'star', 'sparkles', 'shield', 'leaf', 'zap'))"
  );
  await knex.raw(
    "ALTER TABLE tag ADD CONSTRAINT chk_tag_tone_key CHECK (tone_key IS NULL OR tone_key IN ('blue', 'amber', 'green', 'rose', 'slate'))"
  );
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.raw('ALTER TABLE tag DROP CONSTRAINT IF EXISTS chk_tag_tone_key');
  await knex.raw('ALTER TABLE tag DROP CONSTRAINT IF EXISTS chk_tag_icon_key');
  await knex.schema.alterTable('tag', (table) => {
    table.dropColumn('tone_key');
    table.dropColumn('icon_key');
  });
};
