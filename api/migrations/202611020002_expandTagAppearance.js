/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.raw('ALTER TABLE tag DROP CONSTRAINT IF EXISTS chk_tag_icon_key');
  await knex.raw('ALTER TABLE tag DROP CONSTRAINT IF EXISTS chk_tag_tone_key');
  await knex.raw(
    "ALTER TABLE tag ADD CONSTRAINT chk_tag_icon_key CHECK (icon_key IS NULL OR icon_key IN ('none', 'flame', 'star', 'sparkles', 'shield', 'leaf', 'zap', 'award', 'gift', 'heart', 'plug'))"
  );
  await knex.raw(
    "ALTER TABLE tag ADD CONSTRAINT chk_tag_tone_key CHECK (tone_key IS NULL OR tone_key IN ('blue', 'amber', 'green', 'rose', 'slate', 'violet', 'cyan', 'orange', 'teal'))"
  );
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.raw('ALTER TABLE tag DROP CONSTRAINT IF EXISTS chk_tag_icon_key');
  await knex.raw('ALTER TABLE tag DROP CONSTRAINT IF EXISTS chk_tag_tone_key');
  await knex('tag').whereIn('icon_key', ['award', 'gift', 'heart', 'plug']).update({ icon_key: 'none' });
  await knex('tag').whereIn('tone_key', ['violet', 'cyan', 'orange', 'teal']).update({ tone_key: 'blue' });
  await knex.raw(
    "ALTER TABLE tag ADD CONSTRAINT chk_tag_icon_key CHECK (icon_key IS NULL OR icon_key IN ('none', 'flame', 'star', 'sparkles', 'shield', 'leaf', 'zap'))"
  );
  await knex.raw(
    "ALTER TABLE tag ADD CONSTRAINT chk_tag_tone_key CHECK (tone_key IS NULL OR tone_key IN ('blue', 'amber', 'green', 'rose', 'slate'))"
  );
};
