/**
 * Split single 'footer' menu position into separate sub-positions:
 *   - footer_quick   (Liên kết nhanh)
 *   - footer_support (Hỗ trợ khách hàng) — admin will create as needed
 *   - footer_legal   (Pháp lý) — admin will create as needed
 *
 * Existing rows with position='footer' are renamed to 'footer_quick' so the
 * current behavior (these items showing under the Liên kết nhanh column) is
 * preserved. Admin can create new menus for the other footer positions.
 */
exports.up = async function up(knex) {
  await knex.raw(`ALTER TABLE menu DROP CONSTRAINT IF EXISTS chk_menu_position`);
  await knex.raw(`UPDATE menu SET position = 'footer_quick' WHERE position = 'footer'`);
  await knex.raw(`
    ALTER TABLE menu
      ADD CONSTRAINT chk_menu_position
      CHECK (position IN ('header', 'footer_quick', 'footer_support', 'footer_legal', 'mobile'))
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`ALTER TABLE menu DROP CONSTRAINT IF EXISTS chk_menu_position`);
  await knex.raw(`UPDATE menu SET position = 'footer' WHERE position = 'footer_quick'`);
  await knex.raw(`DELETE FROM menu WHERE position IN ('footer_support', 'footer_legal')`);
  await knex.raw(`
    ALTER TABLE menu
      ADD CONSTRAINT chk_menu_position
      CHECK (position IN ('header', 'footer', 'mobile'))
  `);
};
