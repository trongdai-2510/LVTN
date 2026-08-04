/**
 * Chuyển UNIQUE tuyệt đối → partial unique index WHERE deleted_at IS NULL
 * cho các bảng có soft-delete. Lý do: sau khi soft-delete (ẩn/lưu trữ), slug/sku/code
 * vẫn bị giữ chỗ → không tạo lại được bản ghi mới cùng giá trị. Partial index chỉ ràng
 * buộc duy nhất trên các bản ghi ĐANG hoạt động (deleted_at IS NULL).
 *
 * Bỏ qua: file_metadata.stored_path (path UUID không tái dùng), permission (bảng chết).
 *
 * @param {import('knex').Knex} knex
 */
const CONVERSIONS = [
  ['brand', 'brand_slug_key', '(slug)', 'uq_brand_slug_active'],
  ['brand_page', 'brand_page_brand_id_key', '(brand_id)', 'uq_brand_page_brand_active'],
  ['brand_page_featured_product_group', 'uq_brand_page_featured_group', '(brand_page_id, product_group_id)', 'uq_bpfpg_active'],
  ['news_category', 'news_category_slug_unique', '(slug)', 'uq_news_category_slug_active'],
  ['page_content', 'page_content_slug_key', '(slug)', 'uq_page_content_slug_active'],
  ['product_category', 'product_category_slug_key', '(slug)', 'uq_product_category_slug_active'],
  ['product_group', 'product_group_slug_key', '(slug)', 'uq_product_group_slug_active'],
  ['product_variant', 'product_variant_sku_key', '(sku)', 'uq_product_variant_sku_active'],
  ['product_variant', 'uq_product_variant_model_code', '(model_code)', 'uq_product_variant_model_code_active'],
  ['product_variant', 'uq_product_variant_external_code', '(external_code)', 'uq_product_variant_external_code_active'],
  ['project', 'project_slug_key', '(slug)', 'uq_project_slug_active'],
  ['redirect_rule', 'redirect_rule_from_path_key', '(from_path)', 'uq_redirect_rule_from_path_active'],
  ['service', 'service_slug_key', '(slug)', 'uq_service_slug_active'],
  ['spec_group', 'uq_spec_group_name_per_product_group', '(product_group_id, group_name)', 'uq_spec_group_name_active'],
  ['tag', 'tag_slug_key', '(slug)', 'uq_tag_slug_active'],
  ['variant_spec_group', 'uq_variant_spec_group_name_per_variant', '(product_variant_id, group_name)', 'uq_variant_spec_group_name_active'],
  ['menu', 'menu_position_key', '("position")', 'uq_menu_position_active'],
  ['admin_user', 'uq_admin_user_email', '(email)', 'uq_admin_user_email_active'],
  ['admin_role', 'uq_admin_role_code', '(code)', 'uq_admin_role_code_active']
];

exports.up = async function up(knex) {
  for (const [table, constraint, cols, indexName] of CONVERSIONS) {
    await knex.raw(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${constraint}`);
    await knex.raw(`CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON ${table} ${cols} WHERE deleted_at IS NULL`);
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  for (const [table, constraint, cols, indexName] of CONVERSIONS) {
    await knex.raw(`DROP INDEX IF EXISTS ${indexName}`);
    await knex.raw(`ALTER TABLE ${table} ADD CONSTRAINT ${constraint} UNIQUE ${cols}`);
  }
};
