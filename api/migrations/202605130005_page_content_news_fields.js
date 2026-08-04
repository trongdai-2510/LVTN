/**
 * Migration: page_content news fields
 * - Creates news_category table with seed data
 * - Adds news_category_id, published_at, is_featured to page_content
 */

exports.up = async function (knex) {
  // 1a. Create news_category table
  await knex.schema.createTable('news_category', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable();
    table.string('slug', 100).notNullable().unique();
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // Seed default categories
  await knex('news_category').insert([
    { name: 'Tin tức', slug: 'tin-tuc', sort_order: 1 },
    { name: 'Sự kiện', slug: 'su-kien', sort_order: 2 },
    { name: 'Thông báo', slug: 'thong-bao', sort_order: 3 },
    { name: 'Kỹ thuật', slug: 'ky-thuat', sort_order: 4 },
  ]);

  // 1b. Add columns to page_content (excerpt already exists — skip)
  await knex.schema.alterTable('page_content', (table) => {
    table.uuid('news_category_id').nullable().references('id').inTable('news_category').onDelete('SET NULL');
    table.timestamp('published_at', { useTz: true }).nullable();
    table.boolean('is_featured').notNullable().defaultTo(false);
  });

  // Indexes
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_page_content_news_category_id ON page_content (news_category_id)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_page_content_published_at ON page_content (published_at DESC) WHERE published_at IS NOT NULL');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_page_content_is_featured ON page_content (is_featured) WHERE is_featured = TRUE');
};

exports.down = async function (knex) {
  // Drop indexes
  await knex.schema.raw('DROP INDEX IF EXISTS idx_page_content_is_featured');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_page_content_published_at');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_page_content_news_category_id');

  // Drop columns from page_content
  await knex.schema.alterTable('page_content', (table) => {
    table.dropColumn('is_featured');
    table.dropColumn('published_at');
    table.dropColumn('news_category_id');
  });

  // Drop news_category table
  await knex.schema.dropTableIfExists('news_category');
};
