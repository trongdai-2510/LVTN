/**
 * Sửa regression từ 202606150002: admin_role.code và admin_user.email được seed/upsert
 * bằng `INSERT ... ON CONFLICT (code/email)`. Partial unique index (WHERE deleted_at IS NULL)
 * KHÔNG khớp arbiter của ON CONFLICT đơn giản → Postgres 42P10, app vỡ lúc boot.
 *
 * Hai bảng auth/config này không cần reuse-after-soft-delete → trả về UNIQUE tuyệt đối.
 * Các bảng nội dung (brand/product/service/...) vẫn giữ partial unique index.
 *
 * @param {import('knex').Knex} knex
 */
const AUTH = [
  ['admin_user', 'uq_admin_user_email_active', 'uq_admin_user_email', '(email)'],
  ['admin_role', 'uq_admin_role_code_active', 'uq_admin_role_code', '(code)']
];

exports.up = async function up(knex) {
  for (const [table, indexName, constraint, cols] of AUTH) {
    await knex.raw(`DROP INDEX IF EXISTS ${indexName}`);
    await knex.raw(`ALTER TABLE ${table} ADD CONSTRAINT ${constraint} UNIQUE ${cols}`);
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  for (const [table, indexName, constraint, cols] of AUTH) {
    await knex.raw(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${constraint}`);
    await knex.raw(`CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON ${table} ${cols} WHERE deleted_at IS NULL`);
  }
};
