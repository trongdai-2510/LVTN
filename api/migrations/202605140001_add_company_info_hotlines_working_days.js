exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE company_info
      ADD COLUMN IF NOT EXISTS hotlines JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS working_days VARCHAR(100)
  `);

  await knex.raw(`
    UPDATE company_info
    SET hotlines = to_jsonb(ARRAY[hotline]::text[])
    WHERE hotline IS NOT NULL
      AND btrim(hotline) <> ''
      AND (
        hotlines IS NULL
        OR jsonb_typeof(hotlines) <> 'array'
        OR jsonb_array_length(hotlines) = 0
      )
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    ALTER TABLE company_info
      DROP COLUMN IF EXISTS working_days,
      DROP COLUMN IF EXISTS hotlines
  `);
};
