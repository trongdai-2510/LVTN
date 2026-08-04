/**
 * Harden news_category as a first-class CMS taxonomy:
 * - add deleted_at for archive/restore instead of hard delete
 * - add guardrail constraints and active listing index
 * - ensure updated_at trigger exists for update/archive/restore flows
 */
exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE news_category
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_news_category_name_not_blank') THEN
        ALTER TABLE news_category
          ADD CONSTRAINT chk_news_category_name_not_blank
          CHECK (btrim(name) <> '');
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_news_category_slug_format') THEN
        ALTER TABLE news_category
          ADD CONSTRAINT chk_news_category_slug_format
          CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_news_category_sort_order_non_negative') THEN
        ALTER TABLE news_category
          ADD CONSTRAINT chk_news_category_sort_order_non_negative
          CHECK (sort_order >= 0);
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_news_category_updated_at') THEN
        CREATE TRIGGER trg_news_category_updated_at
        BEFORE UPDATE ON news_category
        FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();
      END IF;
    END $$;
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_news_category_active_sort
      ON news_category (sort_order, name)
      WHERE deleted_at IS NULL
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_news_category_active_sort');
  await knex.raw('DROP TRIGGER IF EXISTS trg_news_category_updated_at ON news_category');
  await knex.raw('ALTER TABLE news_category DROP CONSTRAINT IF EXISTS chk_news_category_sort_order_non_negative');
  await knex.raw('ALTER TABLE news_category DROP CONSTRAINT IF EXISTS chk_news_category_slug_format');
  await knex.raw('ALTER TABLE news_category DROP CONSTRAINT IF EXISTS chk_news_category_name_not_blank');
  await knex.raw('ALTER TABLE news_category DROP COLUMN IF EXISTS deleted_at');
};
