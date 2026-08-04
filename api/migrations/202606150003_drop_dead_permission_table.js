/**
 * Xóa bảng `permission` chết: 0 dòng, 0 FK trỏ tới, 0 code sử dụng.
 * Hệ phân quyền thật dùng admin_permission / admin_role / admin_user.
 * Bảng này là tàn dư của một model auth bị bỏ (trong v2.sql) → dọn để DDL khớp thực tế.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.raw('DROP TABLE IF EXISTS permission');
};

/**
 * Tái tạo lại cấu trúc cũ (không có dữ liệu — bảng vốn rỗng).
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS permission (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code varchar(128) NOT NULL,
      name varchar(255) NOT NULL,
      description text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      CONSTRAINT permission_code_key UNIQUE (code)
    )
  `);
};
