exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS product_highlight_spec (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_group_id UUID NOT NULL,
      product_variant_id UUID,
      source_type VARCHAR(32) NOT NULL DEFAULT 'manual',
      source_id UUID,
      display_label VARCHAR(128) NOT NULL,
      display_value TEXT NOT NULL,
      sort_order SMALLINT NOT NULL DEFAULT 0,
      created_by INTEGER,
      updated_by INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      CONSTRAINT chk_product_highlight_spec_source_type CHECK (source_type IN ('product_spec', 'variant_spec', 'variant_attribute', 'manual')),
      CONSTRAINT chk_product_highlight_spec_source_trace CHECK (
        (source_type = 'manual' AND source_id IS NULL)
        OR (source_type <> 'manual' AND source_id IS NOT NULL)
      ),
      CONSTRAINT chk_product_highlight_spec_label_not_blank CHECK (btrim(display_label) <> ''),
      CONSTRAINT chk_product_highlight_spec_value_not_blank CHECK (btrim(display_value) <> ''),
      CONSTRAINT fk_product_highlight_spec_group FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE CASCADE,
      CONSTRAINT fk_product_highlight_spec_variant FOREIGN KEY (product_variant_id) REFERENCES product_variant(id) ON DELETE CASCADE
    )
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_product_highlight_spec_updated_at') THEN
        CREATE TRIGGER trg_product_highlight_spec_updated_at
        BEFORE UPDATE ON product_highlight_spec
        FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();
      END IF;
    END $$;
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_product_highlight_spec_group_default
    ON product_highlight_spec(product_group_id, sort_order, created_at)
    WHERE product_variant_id IS NULL AND deleted_at IS NULL
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_product_highlight_spec_variant
    ON product_highlight_spec(product_variant_id, sort_order, created_at)
    WHERE product_variant_id IS NOT NULL AND deleted_at IS NULL
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_product_highlight_spec_active_source
    ON product_highlight_spec(
      product_group_id,
      COALESCE(product_variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
      source_type,
      source_id
    )
    WHERE deleted_at IS NULL AND source_id IS NOT NULL
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS uq_product_highlight_spec_active_source');
  await knex.raw('DROP INDEX IF EXISTS idx_product_highlight_spec_variant');
  await knex.raw('DROP INDEX IF EXISTS idx_product_highlight_spec_group_default');
  await knex.raw('DROP TRIGGER IF EXISTS trg_product_highlight_spec_updated_at ON product_highlight_spec');
  await knex.raw('DROP TABLE IF EXISTS product_highlight_spec');
};
