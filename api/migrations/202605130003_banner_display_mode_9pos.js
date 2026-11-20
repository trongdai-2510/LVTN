exports.up = async function up(knex) {
  // 1. Add display_mode column
  await knex.schema.table('banner', (table) => {
    table.string('display_mode', 20).notNullable().defaultTo('content_overlay');
  });

  // 2. Add CHECK constraint for display_mode
  await knex.raw(`
    ALTER TABLE banner
    ADD CONSTRAINT chk_banner_display_mode
    CHECK (display_mode IN ('image_only', 'content_overlay'))
  `);

  // 3. Drop old 3-value content_position constraint BEFORE updating data
  await knex.raw(`ALTER TABLE banner DROP CONSTRAINT IF EXISTS chk_banner_content_position`);

  // 4. Migrate existing data: map old 3 values -> new 9 values (bottom row)
  await knex.raw(`
    UPDATE banner
    SET content_position = CASE
      WHEN content_position = 'left'   THEN 'bot-left'
      WHEN content_position = 'center' THEN 'bot-center'
      WHEN content_position = 'right'  THEN 'bot-right'
      ELSE 'bot-left'
    END
  `);

  // 5. Add new 9-value CHECK constraint
  await knex.raw(`
    ALTER TABLE banner
    ADD CONSTRAINT chk_banner_content_position
    CHECK (content_position IN (
      'top-left', 'top-center', 'top-right',
      'mid-left', 'mid-center', 'mid-right',
      'bot-left', 'bot-center', 'bot-right'
    ))
  `);

  // 6. Change default for content_position to 'bot-left'
  await knex.raw(`ALTER TABLE banner ALTER COLUMN content_position SET DEFAULT 'bot-left'`);
};

exports.down = async function down(knex) {
  // 1. Drop new constraint
  await knex.raw(`ALTER TABLE banner DROP CONSTRAINT IF EXISTS chk_banner_content_position`);

  // 2. Revert data: map 9 values back to 3
  await knex.raw(`
    UPDATE banner
    SET content_position = CASE
      WHEN content_position IN ('top-left',  'mid-left',  'bot-left')   THEN 'left'
      WHEN content_position IN ('top-center','mid-center','bot-center') THEN 'center'
      WHEN content_position IN ('top-right', 'mid-right', 'bot-right')  THEN 'right'
      ELSE 'left'
    END
  `);

  // 3. Restore old 3-value constraint
  await knex.raw(`
    ALTER TABLE banner
    ADD CONSTRAINT chk_banner_content_position
    CHECK (content_position IN ('left', 'center', 'right'))
  `);

  // 4. Restore old default
  await knex.raw(`ALTER TABLE banner ALTER COLUMN content_position SET DEFAULT 'left'`);

  // 5. Drop display_mode
  await knex.raw(`ALTER TABLE banner DROP CONSTRAINT IF EXISTS chk_banner_display_mode`);
  await knex.schema.table('banner', (table) => {
    table.dropColumn('display_mode');
  });
};
