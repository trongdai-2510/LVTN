exports.up = async function up(knex) {
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_project_gallery_sort_order_non_negative'
      ) THEN
        ALTER TABLE project_gallery
        ADD CONSTRAINT chk_project_gallery_sort_order_non_negative
        CHECK (sort_order >= 0);
      END IF;
    END $$;
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_project_gallery_project_order
    ON project_gallery(project_id, sort_order, created_at)
    WHERE deleted_at IS NULL
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_project_gallery_project_order');
  await knex.raw('ALTER TABLE project_gallery DROP CONSTRAINT IF EXISTS chk_project_gallery_sort_order_non_negative');
};
