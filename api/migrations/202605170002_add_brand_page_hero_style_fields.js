/**
 * Add constrained hero typography controls for brand detail pages.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('brand_page', (table) => {
    table.string('hero_title_size', 16).notNullable().defaultTo('large');
    table.string('hero_excerpt_size', 16).notNullable().defaultTo('large');
    table.string('hero_eyebrow_color', 16);
    table.string('hero_title_color', 16);
    table.string('hero_excerpt_color', 16);
  });

  await knex.raw(`
    ALTER TABLE brand_page
      ADD CONSTRAINT chk_brand_page_hero_title_size
      CHECK (hero_title_size IN ('medium', 'large', 'xlarge'))
  `);
  await knex.raw(`
    ALTER TABLE brand_page
      ADD CONSTRAINT chk_brand_page_hero_excerpt_size
      CHECK (hero_excerpt_size IN ('medium', 'large'))
  `);
  await knex.raw(`
    ALTER TABLE brand_page
      ADD CONSTRAINT chk_brand_page_hero_eyebrow_color
      CHECK (hero_eyebrow_color IS NULL OR hero_eyebrow_color ~ '^#[0-9A-Fa-f]{6}$')
  `);
  await knex.raw(`
    ALTER TABLE brand_page
      ADD CONSTRAINT chk_brand_page_hero_title_color
      CHECK (hero_title_color IS NULL OR hero_title_color ~ '^#[0-9A-Fa-f]{6}$')
  `);
  await knex.raw(`
    ALTER TABLE brand_page
      ADD CONSTRAINT chk_brand_page_hero_excerpt_color
      CHECK (hero_excerpt_color IS NULL OR hero_excerpt_color ~ '^#[0-9A-Fa-f]{6}$')
  `);
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.raw('ALTER TABLE brand_page DROP CONSTRAINT IF EXISTS chk_brand_page_hero_excerpt_color');
  await knex.raw('ALTER TABLE brand_page DROP CONSTRAINT IF EXISTS chk_brand_page_hero_title_color');
  await knex.raw('ALTER TABLE brand_page DROP CONSTRAINT IF EXISTS chk_brand_page_hero_eyebrow_color');
  await knex.raw('ALTER TABLE brand_page DROP CONSTRAINT IF EXISTS chk_brand_page_hero_excerpt_size');
  await knex.raw('ALTER TABLE brand_page DROP CONSTRAINT IF EXISTS chk_brand_page_hero_title_size');
  await knex.schema.alterTable('brand_page', (table) => {
    table.dropColumn('hero_excerpt_color');
    table.dropColumn('hero_title_color');
    table.dropColumn('hero_eyebrow_color');
    table.dropColumn('hero_excerpt_size');
    table.dropColumn('hero_title_size');
  });
};
