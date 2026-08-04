exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE product_image
    ADD COLUMN IF NOT EXISTS product_variant_id UUID
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_product_image_variant'
      ) THEN
        ALTER TABLE product_image
        ADD CONSTRAINT fk_product_image_variant
        FOREIGN KEY (product_variant_id)
        REFERENCES product_variant(id)
        ON DELETE RESTRICT;
      END IF;
    END $$;
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_product_image_group_variant_order
    ON product_image(product_group_id, product_variant_id, sort_order, created_at)
    WHERE deleted_at IS NULL
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_product_image_variant
    ON product_image(product_variant_id)
    WHERE product_variant_id IS NOT NULL AND deleted_at IS NULL
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_product_image_variant');
  await knex.raw('DROP INDEX IF EXISTS idx_product_image_group_variant_order');
  await knex.raw('ALTER TABLE product_image DROP CONSTRAINT IF EXISTS fk_product_image_variant');
  await knex.raw('ALTER TABLE product_image DROP COLUMN IF EXISTS product_variant_id');
};
