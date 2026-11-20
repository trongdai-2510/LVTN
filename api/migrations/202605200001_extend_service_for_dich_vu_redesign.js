/**
 * Extend the `service` table with structured fields used by the /dich-vu page:
 *   - subtitle:          short tagline shown beneath the title on the listing
 *   - when_to_contact:   editorial "when to choose this service" copy
 *   - deliverables:      JSONB array of bullet points "what the customer gets"
 *   - typical_duration:  free-text duration label (e.g. "1–3 ngày làm việc")
 *   - sort_order:        manual ordering on the public listing (lower = earlier)
 *   - icon_key:          enum-like key the FE maps to a Lucide icon
 *
 * Sorting on the public listing is changed to use sort_order ASC so that
 * editorial typos no longer reshuffle the page.
 */
exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE service
      ADD COLUMN IF NOT EXISTS subtitle           VARCHAR(220),
      ADD COLUMN IF NOT EXISTS when_to_contact    TEXT,
      ADD COLUMN IF NOT EXISTS deliverables       JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS typical_duration   VARCHAR(120),
      ADD COLUMN IF NOT EXISTS sort_order         INTEGER NOT NULL DEFAULT 1000,
      ADD COLUMN IF NOT EXISTS icon_key           VARCHAR(40)
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_service_sort_order
      ON service (sort_order, updated_at DESC)
      WHERE deleted_at IS NULL
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`DROP INDEX IF EXISTS idx_service_sort_order`);
  await knex.raw(`
    ALTER TABLE service
      DROP COLUMN IF EXISTS icon_key,
      DROP COLUMN IF EXISTS sort_order,
      DROP COLUMN IF EXISTS typical_duration,
      DROP COLUMN IF EXISTS deliverables,
      DROP COLUMN IF EXISTS when_to_contact,
      DROP COLUMN IF EXISTS subtitle
  `);
};
