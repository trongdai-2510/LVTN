exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS home_section (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      section_type VARCHAR(48) NOT NULL UNIQUE,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order SMALLINT NOT NULL,
      title_override VARCHAR(255),
      subtitle VARCHAR(512),
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by INTEGER,
      updated_by INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_home_section_type CHECK (section_type IN (
        'hero',
        'product_categories',
        'company_overview',
        'featured_products',
        'services',
        'projects',
        'brands',
        'trust_strip',
        'contact_cta'
      ))
    )
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_home_section_updated_at') THEN
        CREATE TRIGGER trg_home_section_updated_at
        BEFORE UPDATE ON home_section
        FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();
      END IF;
    END $$;
  `);

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_home_section_sort ON home_section(sort_order)');

  const defaults = [
    { section_type: 'hero',               sort_order: 0, config: { mode: 'auto', position: 'hero', banner_ids: [] } },
    { section_type: 'product_categories', sort_order: 1, config: { mode: 'auto', item_limit: 8, category_ids: [] } },
    { section_type: 'company_overview',   sort_order: 2, config: { page_content_slug: 'gioi-thieu', cta_label: 'Xem thêm về công ty', cta_href: '/gioi-thieu' } },
    { section_type: 'featured_products',  sort_order: 3, config: { mode: 'auto', sort: 'popular', item_limit: 8, product_group_ids: [] } },
    { section_type: 'services',           sort_order: 4, config: { mode: 'auto', item_limit: 4, service_ids: [] } },
    { section_type: 'projects',           sort_order: 5, config: { mode: 'auto', item_limit: 12, project_ids: [], autoscroll_ms: 5000 } },
    { section_type: 'brands',             sort_order: 6, config: { mode: 'auto', item_limit: 40, autoscroll_ms: 5000 } },
    { section_type: 'trust_strip',        sort_order: 7, config: { mode: 'auto', signals: [] } },
    { section_type: 'contact_cta',        sort_order: 8, config: { heading_override: null, show_quote_form: true } }
  ];

  for (const row of defaults) {
    await knex.raw(
      `INSERT INTO home_section (section_type, enabled, sort_order, config)
       VALUES (?, TRUE, ?, ?::jsonb)
       ON CONFLICT (section_type) DO NOTHING`,
      [row.section_type, row.sort_order, JSON.stringify(row.config)]
    );
  }
};

exports.down = async function down(knex) {
  await knex.raw('DROP TRIGGER IF EXISTS trg_home_section_updated_at ON home_section');
  await knex.raw('DROP INDEX IF EXISTS idx_home_section_sort');
  await knex.schema.dropTableIfExists('home_section');
};
