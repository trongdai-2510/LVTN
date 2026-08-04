exports.up = async function up(knex) {
  const hasTitleSize = await knex.schema.hasColumn('banner', 'title_size');
  const hasTitleColor = await knex.schema.hasColumn('banner', 'title_color');
  const hasDescriptionColor = await knex.schema.hasColumn('banner', 'description_color');

  await knex.schema.table('banner', (table) => {
    if (!hasTitleSize) {
      table.string('title_size', 10).notNullable().defaultTo('large');
    }
    if (!hasTitleColor) {
      table.string('title_color', 7).notNullable().defaultTo('#ffffff');
    }
    if (!hasDescriptionColor) {
      table.string('description_color', 7).notNullable().defaultTo('#ffffff');
    }
  });

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_banner_title_size'
      ) THEN
        ALTER TABLE banner
        ADD CONSTRAINT chk_banner_title_size
        CHECK (title_size IN ('small', 'medium', 'large'));
      END IF;
    END $$;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_banner_title_color_hex'
      ) THEN
        ALTER TABLE banner
        ADD CONSTRAINT chk_banner_title_color_hex
        CHECK (title_color ~* '^#[0-9a-f]{6}$');
      END IF;
    END $$;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_banner_description_color_hex'
      ) THEN
        ALTER TABLE banner
        ADD CONSTRAINT chk_banner_description_color_hex
        CHECK (description_color ~* '^#[0-9a-f]{6}$');
      END IF;
    END $$;
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`ALTER TABLE banner DROP CONSTRAINT IF EXISTS chk_banner_description_color_hex`);
  await knex.raw(`ALTER TABLE banner DROP CONSTRAINT IF EXISTS chk_banner_title_color_hex`);
  await knex.raw(`ALTER TABLE banner DROP CONSTRAINT IF EXISTS chk_banner_title_size`);

  const hasTitleSize = await knex.schema.hasColumn('banner', 'title_size');
  const hasTitleColor = await knex.schema.hasColumn('banner', 'title_color');
  const hasDescriptionColor = await knex.schema.hasColumn('banner', 'description_color');

  await knex.schema.table('banner', (table) => {
    if (hasDescriptionColor) {
      table.dropColumn('description_color');
    }
    if (hasTitleColor) {
      table.dropColumn('title_color');
    }
    if (hasTitleSize) {
      table.dropColumn('title_size');
    }
  });
};
