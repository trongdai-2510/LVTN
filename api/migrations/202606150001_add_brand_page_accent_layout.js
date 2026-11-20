/**
 * Brand detail redesign: cho mỗi thương hiệu một accent màu thật + chọn bố cục.
 *
 * - accent_color: màu nhận diện chính (hex). Null = frontend tự suy ra (auto tone).
 * - layout_archetype: kiểu bố cục trang chi tiết.
 *     'auto'          → hệ thống tự chọn theo dữ liệu (quốc tế vs nội địa)
 *     'international'  → corporate, ảnh lớn, đề cao chứng nhận/độ tin cậy
 *     'domestic'      → product-led, đẩy mạnh nhóm hàng & sản phẩm
 *     'minimal'       → tối giản, ít khối, tập trung nội dung
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('brand_page', (table) => {
    table.string('accent_color', 16);
    table.string('layout_archetype', 24).notNullable().defaultTo('auto');
  });

  await knex.raw(`
    ALTER TABLE brand_page
      ADD CONSTRAINT chk_brand_page_accent_color
      CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9A-Fa-f]{6}$')
  `);
  await knex.raw(`
    ALTER TABLE brand_page
      ADD CONSTRAINT chk_brand_page_layout_archetype
      CHECK (layout_archetype IN ('auto', 'international', 'domestic', 'minimal'))
  `);
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.raw('ALTER TABLE brand_page DROP CONSTRAINT IF EXISTS chk_brand_page_layout_archetype');
  await knex.raw('ALTER TABLE brand_page DROP CONSTRAINT IF EXISTS chk_brand_page_accent_color');
  await knex.schema.alterTable('brand_page', (table) => {
    table.dropColumn('layout_archetype');
    table.dropColumn('accent_color');
  });
};
