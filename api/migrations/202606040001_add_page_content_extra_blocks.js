/**
 * Migration: add extra_blocks JSONB column to page_content
 *
 * Lưu danh sách các "khối phụ" (bullet_list, card_grid, ...) admin có thể
 * tự thêm/sửa/xóa/sắp xếp cho từng trang hệ thống mà không cần dev đụng code.
 *
 * Shape (validate ở app layer, không enforce DB):
 * {
 *   "blocks": [
 *     { "id": "abc123", "type": "bullet_list", "title": "...", "items": [...] },
 *     { "id": "def456", "type": "card_grid", "title": "...", "columns": 2, "items": [...] }
 *   ]
 * }
 */

exports.up = async function (knex) {
  await knex.schema.alterTable('page_content', (table) => {
    table.jsonb('extra_blocks').notNullable().defaultTo(knex.raw("'{}'::jsonb"));
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('page_content', (table) => {
    table.dropColumn('extra_blocks');
  });
};
