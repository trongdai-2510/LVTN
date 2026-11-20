const QUOTE_REQUEST_TABLE = 'quote_request';
const QUOTE_ITEM_TABLE = 'quote_item';

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.alterTable(QUOTE_REQUEST_TABLE, (table) => {
    table.string('project_name', 255).nullable();
    table.text('project_context').nullable();
    table.jsonb('project_requirements').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
  });

  await knex.schema.alterTable(QUOTE_ITEM_TABLE, (table) => {
    table.string('quantity_raw', 64).nullable();
    table.string('quantity_unit', 32).nullable();
    table.string('quantity_state', 24).nullable();
  });

  await knex(QUOTE_ITEM_TABLE).update({
    quantity_raw: knex.raw('CASE WHEN quantity IS NULL THEN NULL ELSE quantity::text END'),
    quantity_state: knex.raw("CASE WHEN quantity IS NULL THEN 'unspecified' ELSE 'confirmed' END")
  });

  await knex.schema.alterTable(QUOTE_ITEM_TABLE, (table) => {
    table.string('quantity_state', 24).notNullable().defaultTo('unspecified').alter();
  });

  await knex.raw(`
    ALTER TABLE ${QUOTE_REQUEST_TABLE}
      ADD CONSTRAINT quote_request_project_name_not_blank
        CHECK (project_name IS NULL OR btrim(project_name) <> ''),
      ADD CONSTRAINT quote_request_project_context_not_blank
        CHECK (project_context IS NULL OR btrim(project_context) <> ''),
      ADD CONSTRAINT quote_request_project_requirements_array
        CHECK (jsonb_typeof(project_requirements) = 'array')
  `);

  await knex.raw(`
    ALTER TABLE ${QUOTE_ITEM_TABLE}
      ADD CONSTRAINT quote_item_quantity_state_check
        CHECK (quantity_state IN ('confirmed', 'unspecified')),
      ADD CONSTRAINT quote_item_quantity_raw_not_blank
        CHECK (quantity_raw IS NULL OR btrim(quantity_raw) <> ''),
      ADD CONSTRAINT quote_item_quantity_unit_not_blank
        CHECK (quantity_unit IS NULL OR btrim(quantity_unit) <> ''),
      ADD CONSTRAINT quote_item_quantity_interpretation_check
        CHECK (
          (quantity_state = 'confirmed' AND quantity IS NOT NULL AND quantity_raw IS NOT NULL)
          OR
          (quantity_state = 'unspecified' AND quantity IS NULL)
        )
  `);
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.raw(`
    ALTER TABLE ${QUOTE_ITEM_TABLE}
      DROP CONSTRAINT IF EXISTS quote_item_quantity_interpretation_check,
      DROP CONSTRAINT IF EXISTS quote_item_quantity_unit_not_blank,
      DROP CONSTRAINT IF EXISTS quote_item_quantity_raw_not_blank,
      DROP CONSTRAINT IF EXISTS quote_item_quantity_state_check
  `);
  await knex.raw(`
    ALTER TABLE ${QUOTE_REQUEST_TABLE}
      DROP CONSTRAINT IF EXISTS quote_request_project_requirements_array,
      DROP CONSTRAINT IF EXISTS quote_request_project_context_not_blank,
      DROP CONSTRAINT IF EXISTS quote_request_project_name_not_blank
  `);

  await knex.schema.alterTable(QUOTE_ITEM_TABLE, (table) => {
    table.dropColumns('quantity_raw', 'quantity_unit', 'quantity_state');
  });
  await knex.schema.alterTable(QUOTE_REQUEST_TABLE, (table) => {
    table.dropColumns('project_name', 'project_context', 'project_requirements');
  });
};
