const CUSTOMER_PROFILE_TABLE = 'customer_profile';
const CONTACT_REQUEST_TABLE = 'contact_request';
const QUOTE_REQUEST_TABLE = 'quote_request';

function buildCustomerDedupeExpression(tableAlias, fallbackPrefix) {
  return `
    CASE
      WHEN NULLIF(regexp_replace(coalesce(${tableAlias}.phone, ''), '[^0-9+]+', '', 'g'), '') IS NOT NULL
        THEN 'phone:' || regexp_replace(coalesce(${tableAlias}.phone, ''), '[^0-9+]+', '', 'g')
      WHEN NULLIF(lower(btrim(coalesce(${tableAlias}.email, ''))), '') IS NOT NULL
        THEN 'email:' || lower(btrim(${tableAlias}.email))
      ELSE '${fallbackPrefix}:' || ${tableAlias}.id::text
    END
  `;
}

exports.up = async function up(knex) {
  await knex.schema.createTable(CUSTOMER_PROFILE_TABLE, (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('full_name', 128).notNullable();
    table.string('phone', 32).nullable();
    table.string('email', 128).nullable();
    table.string('company_name', 255).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.index(['phone'], 'idx_customer_profile_phone');
    table.index(['email'], 'idx_customer_profile_email');
    table.index(['deleted_at'], 'idx_customer_profile_deleted_at');
  });

  await knex.raw(
    "ALTER TABLE customer_profile ADD CONSTRAINT chk_customer_profile_name_not_blank CHECK (btrim(full_name) <> '')"
  );
  await knex.raw(
    "ALTER TABLE customer_profile ADD CONSTRAINT chk_customer_profile_email_format CHECK (email IS NULL OR email ~* '^[A-Z0-9._%+\\-]+@[A-Z0-9.\\-]+\\.[A-Z]{2,}$')"
  );
  await knex.raw(
    'CREATE TRIGGER trg_customer_profile_updated_at BEFORE UPDATE ON customer_profile FOR EACH ROW EXECUTE FUNCTION st_set_updated_at()'
  );

  await knex.schema.alterTable(CONTACT_REQUEST_TABLE, (table) => {
    table.uuid('customer_id').nullable();
    table
      .foreign('customer_id', 'fk_contact_request_customer')
      .references('id')
      .inTable(CUSTOMER_PROFILE_TABLE)
      .onDelete('SET NULL');
    table.index(['customer_id'], 'idx_contact_request_customer_id');
  });

  await knex.schema.alterTable(QUOTE_REQUEST_TABLE, (table) => {
    table.uuid('customer_id').nullable();
    table
      .foreign('customer_id', 'fk_quote_request_customer')
      .references('id')
      .inTable(CUSTOMER_PROFILE_TABLE)
      .onDelete('SET NULL');
    table.index(['customer_id'], 'idx_quote_request_customer_id');
  });

  const contactDedupeExpression = buildCustomerDedupeExpression('contact_source', 'contact');
  const quoteDedupeExpression = buildCustomerDedupeExpression('quote_source', 'quote');
  const contactUpdateDedupeExpression = buildCustomerDedupeExpression('target', 'contact');
  const quoteUpdateDedupeExpression = buildCustomerDedupeExpression('target', 'quote');

  await knex.raw(`
    CREATE TEMP TABLE tmp_customer_profile_backfill AS
    WITH interaction_source AS (
      SELECT
        'contact'::text AS source_kind,
        contact_source.id AS source_id,
        contact_source.full_name,
        contact_source.phone,
        contact_source.email,
        contact_source.company_name,
        contact_source.created_at,
        contact_source.updated_at,
        contact_source.deleted_at,
        ${contactDedupeExpression} AS dedupe_key,
        (
          CASE WHEN NULLIF(btrim(coalesce(contact_source.phone, '')), '') IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN NULLIF(lower(btrim(coalesce(contact_source.email, ''))), '') IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN NULLIF(btrim(coalesce(contact_source.company_name, '')), '') IS NOT NULL THEN 1 ELSE 0 END
        ) AS completeness_score
      FROM ${CONTACT_REQUEST_TABLE} AS contact_source

      UNION ALL

      SELECT
        'quote'::text AS source_kind,
        quote_source.id AS source_id,
        quote_source.full_name,
        quote_source.phone,
        quote_source.email,
        quote_source.company_name,
        quote_source.created_at,
        quote_source.updated_at,
        quote_source.deleted_at,
        ${quoteDedupeExpression} AS dedupe_key,
        (
          CASE WHEN NULLIF(btrim(coalesce(quote_source.phone, '')), '') IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN NULLIF(lower(btrim(coalesce(quote_source.email, ''))), '') IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN NULLIF(btrim(coalesce(quote_source.company_name, '')), '') IS NOT NULL THEN 1 ELSE 0 END
        ) AS completeness_score
      FROM ${QUOTE_REQUEST_TABLE} AS quote_source
    ),
    aggregated AS (
      SELECT
        dedupe_key,
        MIN(created_at) AS created_at,
        MAX(updated_at) AS updated_at,
        CASE
          WHEN BOOL_AND(deleted_at IS NOT NULL) THEN MAX(deleted_at)
          ELSE NULL
        END AS deleted_at
      FROM interaction_source
      GROUP BY dedupe_key
    ),
    chosen AS (
      SELECT DISTINCT ON (dedupe_key)
        dedupe_key,
        full_name,
        NULLIF(btrim(phone), '') AS phone,
        NULLIF(lower(btrim(email)), '') AS email,
        NULLIF(btrim(company_name), '') AS company_name
      FROM interaction_source
      ORDER BY dedupe_key, completeness_score DESC, created_at ASC, source_id ASC
    )
    SELECT
      gen_random_uuid() AS id,
      aggregated.dedupe_key,
      chosen.full_name,
      chosen.phone,
      chosen.email,
      chosen.company_name,
      aggregated.created_at,
      aggregated.updated_at,
      aggregated.deleted_at
    FROM aggregated
    INNER JOIN chosen ON chosen.dedupe_key = aggregated.dedupe_key;
  `);

  await knex.raw(`
    INSERT INTO ${CUSTOMER_PROFILE_TABLE} (
      id,
      full_name,
      phone,
      email,
      company_name,
      created_at,
      updated_at,
      deleted_at
    )
    SELECT
      id,
      full_name,
      phone,
      email,
      company_name,
      created_at,
      updated_at,
      deleted_at
    FROM tmp_customer_profile_backfill;
  `);

  await knex.raw(`
    UPDATE ${CONTACT_REQUEST_TABLE} AS target
    SET customer_id = backfill.id
    FROM tmp_customer_profile_backfill AS backfill
    WHERE backfill.dedupe_key = ${contactUpdateDedupeExpression};
  `);

  await knex.raw(`
    UPDATE ${QUOTE_REQUEST_TABLE} AS target
    SET customer_id = backfill.id
    FROM tmp_customer_profile_backfill AS backfill
    WHERE backfill.dedupe_key = ${quoteUpdateDedupeExpression};
  `);

  await knex.raw('DROP TABLE IF EXISTS tmp_customer_profile_backfill;');
};

exports.down = async function down(knex) {
  await knex.schema.alterTable(CONTACT_REQUEST_TABLE, (table) => {
    table.dropForeign(['customer_id'], 'fk_contact_request_customer');
    table.dropIndex(['customer_id'], 'idx_contact_request_customer_id');
    table.dropColumn('customer_id');
  });

  await knex.schema.alterTable(QUOTE_REQUEST_TABLE, (table) => {
    table.dropForeign(['customer_id'], 'fk_quote_request_customer');
    table.dropIndex(['customer_id'], 'idx_quote_request_customer_id');
    table.dropColumn('customer_id');
  });

  await knex.raw('DROP TRIGGER IF EXISTS trg_customer_profile_updated_at ON customer_profile');
  await knex.schema.dropTableIfExists(CUSTOMER_PROFILE_TABLE);
};
