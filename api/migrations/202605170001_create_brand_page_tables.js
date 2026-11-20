exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS brand_page (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      brand_id UUID NOT NULL UNIQUE,
      title VARCHAR(255) NOT NULL,
      excerpt TEXT,
      overview_title VARCHAR(255),
      overview_body TEXT,
      support_title VARCHAR(255),
      support_intro TEXT,
      support_items JSONB,
      support_image_file_id UUID,
      hero_banner_id UUID,
      cta_title VARCHAR(255),
      cta_description TEXT,
      cta_button_label VARCHAR(120),
      cta_button_url TEXT,
      review_status VARCHAR(24) NOT NULL DEFAULT 'draft',
      publish_status VARCHAR(16) NOT NULL DEFAULT 'unpublished',
      seo_title VARCHAR(255),
      seo_description VARCHAR(512),
      seo_og_image_file_id UUID,
      created_by INTEGER,
      updated_by INTEGER,
      approved_by INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      CONSTRAINT chk_brand_page_title_not_blank CHECK (btrim(title) <> ''),
      CONSTRAINT chk_brand_page_review_status CHECK (review_status IN ('draft', 'pending_review', 'approved', 'rejected')),
      CONSTRAINT chk_brand_page_publish_status CHECK (publish_status IN ('unpublished', 'published', 'archived')),
      CONSTRAINT fk_brand_page_brand FOREIGN KEY (brand_id) REFERENCES brand(id) ON DELETE RESTRICT,
      CONSTRAINT fk_brand_page_support_image FOREIGN KEY (support_image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT,
      CONSTRAINT fk_brand_page_hero_banner FOREIGN KEY (hero_banner_id) REFERENCES banner(id) ON DELETE SET NULL,
      CONSTRAINT fk_brand_page_og_image FOREIGN KEY (seo_og_image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT
    )
  `);
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_brand_page_updated_at') THEN
        CREATE TRIGGER trg_brand_page_updated_at
        BEFORE UPDATE ON brand_page
        FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_brand_page_soft_delete_workflow') THEN
        CREATE TRIGGER trg_brand_page_soft_delete_workflow
        BEFORE UPDATE ON brand_page
        FOR EACH ROW EXECUTE FUNCTION st_sync_public_workflow_on_soft_delete();
      END IF;
    END $$;
  `);

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS brand_page_stat (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      brand_page_id UUID NOT NULL,
      value VARCHAR(80) NOT NULL,
      label VARCHAR(160) NOT NULL,
      note TEXT,
      source_url TEXT,
      source_file_id UUID,
      is_verified BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order SMALLINT NOT NULL DEFAULT 0,
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      created_by INTEGER,
      updated_by INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      CONSTRAINT chk_brand_page_stat_status CHECK (status IN ('active', 'inactive')),
      CONSTRAINT chk_brand_page_stat_value_not_blank CHECK (btrim(value) <> ''),
      CONSTRAINT chk_brand_page_stat_label_not_blank CHECK (btrim(label) <> ''),
      CONSTRAINT fk_brand_page_stat_page FOREIGN KEY (brand_page_id) REFERENCES brand_page(id) ON DELETE CASCADE,
      CONSTRAINT fk_brand_page_stat_source_file FOREIGN KEY (source_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT
    )
  `);
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_brand_page_stat_updated_at') THEN
        CREATE TRIGGER trg_brand_page_stat_updated_at
        BEFORE UPDATE ON brand_page_stat
        FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_brand_page_stat_soft_delete') THEN
        CREATE TRIGGER trg_brand_page_stat_soft_delete
        BEFORE UPDATE ON brand_page_stat
        FOR EACH ROW EXECUTE FUNCTION st_sync_status_on_soft_delete();
      END IF;
    END $$;
  `);

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS brand_page_source (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      brand_page_id UUID NOT NULL,
      title VARCHAR(255) NOT NULL,
      source_type VARCHAR(32) NOT NULL DEFAULT 'other',
      url TEXT,
      file_id UUID,
      description TEXT,
      sort_order SMALLINT NOT NULL DEFAULT 0,
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      created_by INTEGER,
      updated_by INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      CONSTRAINT chk_brand_page_source_status CHECK (status IN ('active', 'inactive')),
      CONSTRAINT chk_brand_page_source_type CHECK (source_type IN ('website', 'catalogue', 'certificate', 'other')),
      CONSTRAINT chk_brand_page_source_title_not_blank CHECK (btrim(title) <> ''),
      CONSTRAINT chk_brand_page_source_has_ref CHECK (
        (url IS NOT NULL AND btrim(url) <> '') OR file_id IS NOT NULL
      ),
      CONSTRAINT fk_brand_page_source_page FOREIGN KEY (brand_page_id) REFERENCES brand_page(id) ON DELETE CASCADE,
      CONSTRAINT fk_brand_page_source_file FOREIGN KEY (file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT
    )
  `);
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_brand_page_source_updated_at') THEN
        CREATE TRIGGER trg_brand_page_source_updated_at
        BEFORE UPDATE ON brand_page_source
        FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_brand_page_source_soft_delete') THEN
        CREATE TRIGGER trg_brand_page_source_soft_delete
        BEFORE UPDATE ON brand_page_source
        FOR EACH ROW EXECUTE FUNCTION st_sync_status_on_soft_delete();
      END IF;
    END $$;
  `);

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS brand_page_featured_product_group (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      brand_page_id UUID NOT NULL,
      product_group_id UUID NOT NULL,
      sort_order SMALLINT NOT NULL DEFAULT 0,
      created_by INTEGER,
      updated_by INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      CONSTRAINT uq_brand_page_featured_group UNIQUE (brand_page_id, product_group_id),
      CONSTRAINT fk_brand_page_featured_page FOREIGN KEY (brand_page_id) REFERENCES brand_page(id) ON DELETE CASCADE,
      CONSTRAINT fk_brand_page_featured_group FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE RESTRICT
    )
  `);
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_brand_page_featured_updated_at') THEN
        CREATE TRIGGER trg_brand_page_featured_updated_at
        BEFORE UPDATE ON brand_page_featured_product_group
        FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();
      END IF;
    END $$;
  `);

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_brand_page_brand ON brand_page(brand_id) WHERE deleted_at IS NULL');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_brand_page_public ON brand_page(brand_id, review_status, publish_status) WHERE deleted_at IS NULL');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_brand_page_stat_page ON brand_page_stat(brand_page_id, status) WHERE deleted_at IS NULL');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_brand_page_source_page ON brand_page_source(brand_page_id, status) WHERE deleted_at IS NULL');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_brand_page_featured_page ON brand_page_featured_product_group(brand_page_id) WHERE deleted_at IS NULL');
};

exports.down = async function down(knex) {
  await knex.raw('DROP TRIGGER IF EXISTS trg_brand_page_featured_updated_at ON brand_page_featured_product_group');
  await knex.raw('DROP TRIGGER IF EXISTS trg_brand_page_source_soft_delete ON brand_page_source');
  await knex.raw('DROP TRIGGER IF EXISTS trg_brand_page_source_updated_at ON brand_page_source');
  await knex.raw('DROP TRIGGER IF EXISTS trg_brand_page_stat_soft_delete ON brand_page_stat');
  await knex.raw('DROP TRIGGER IF EXISTS trg_brand_page_stat_updated_at ON brand_page_stat');
  await knex.raw('DROP TRIGGER IF EXISTS trg_brand_page_soft_delete_workflow ON brand_page');
  await knex.raw('DROP TRIGGER IF EXISTS trg_brand_page_updated_at ON brand_page');
  await knex.raw('DROP INDEX IF EXISTS idx_brand_page_featured_page');
  await knex.raw('DROP INDEX IF EXISTS idx_brand_page_source_page');
  await knex.raw('DROP INDEX IF EXISTS idx_brand_page_stat_page');
  await knex.raw('DROP INDEX IF EXISTS idx_brand_page_public');
  await knex.raw('DROP INDEX IF EXISTS idx_brand_page_brand');
  await knex.schema.dropTableIfExists('brand_page_featured_product_group');
  await knex.schema.dropTableIfExists('brand_page_source');
  await knex.schema.dropTableIfExists('brand_page_stat');
  await knex.schema.dropTableIfExists('brand_page');
};
