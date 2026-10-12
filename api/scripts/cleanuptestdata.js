const knex = require('knex');

const databaseConfig = require('../knexfile').development;

const LOCAL_DATABASE_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const AUDIT_MARKER =
  '(^|[^a-z0-9])qa([ -]|$)|codex|catalog-editor-|contact-viewer-|customer-quote-|sales-contact-|workspace-[0-9]{10,}|legacy-[0-9]{10,}|project-[0-9]{10,}';
const TEST_EMAIL_PATTERN =
  '^(customer-quote|sales-contact|contact-viewer|workspace|legacy|project)-[0-9]{10,}-[a-z0-9]+@example\\.com$';

function unique(values) {
  return [...new Set(values.flat().filter(Boolean).map(String))];
}

function assertSafeDatabase() {
  if (process.env.QA_CLEANUP_CONFIRMED !== '1') {
    throw new Error('QA cleanup requires QA_CLEANUP_CONFIRMED=1.');
  }

  const host = String(databaseConfig.connection.host || '').toLowerCase();
  if (!LOCAL_DATABASE_HOSTS.has(host)) {
    throw new Error(`Refusing to clean a non-local database host: ${host || 'missing'}.`);
  }
}

async function collectTargets(transaction) {
  const targets = {};

  targets.pages = await transaction('page_content')
    .pluck('id')
    .where(function pageMarkers() {
      this.whereILike('slug', 'qa-%').orWhereILike('slug', 'codex-news-test-%');
    });
  targets.categories = await transaction('news_category')
    .pluck('id')
    .whereILike('slug', 'qa-category-%');
  targets.banners = await transaction('banner').pluck('id').whereILike('title', 'QA %');
  targets.contacts = await transaction('contact_request')
    .pluck('id')
    .where(function contactMarkers() {
      this.whereILike('full_name', 'QA %')
        .orWhereILike('email', 'qa-%@example.com')
        .orWhereRaw('email ~* ?', [TEST_EMAIL_PATTERN]);
    });
  targets.quotes = await transaction('quote_request')
    .pluck('id')
    .where(function quoteMarkers() {
      this.whereILike('full_name', 'QA %')
        .orWhereILike('email', 'qa-%@example.com')
        .orWhereRaw('email ~* ?', [TEST_EMAIL_PATTERN]);
    });
  targets.customers = await transaction('customer_profile')
    .pluck('id')
    .where(function customerMarkers() {
      this.whereILike('full_name', 'QA %')
        .orWhereILike('email', 'qa-%@example.com')
        .orWhereRaw('email ~* ?', [TEST_EMAIL_PATTERN]);
    });
  targets.groups = await transaction('product_group')
    .pluck('id')
    .whereILike('name', 'Sản phẩm QA catalog-editor-%');
  targets.variants = await transaction('product_variant')
    .pluck('id')
    .whereIn('product_group_id', targets.groups);

  targets.highlights = unique([
    await transaction('product_highlight_spec')
      .pluck('id')
      .whereRaw('display_label ~* ?', ['^QA ']),
    await transaction('product_highlight_spec')
      .pluck('id')
      .where(function productMarkers() {
        this.whereIn('product_group_id', targets.groups).orWhereIn(
          'product_variant_id',
          targets.variants
        );
      })
  ]);
  targets.documents = unique([
    await transaction('technical_document')
      .pluck('id')
      .whereRaw('document_name ~* ?', ['^QA(_| )']),
    await transaction('technical_document')
      .pluck('id')
      .where(function productMarkers() {
        this.whereIn('product_group_id', targets.groups).orWhereIn(
          'product_variant_id',
          targets.variants
        );
      })
  ]);
  targets.images = await transaction('product_image')
    .pluck('id')
    .where(function productMarkers() {
      this.whereIn('product_group_id', targets.groups).orWhereIn(
        'product_variant_id',
        targets.variants
      );
    });
  targets.quoteItems = unique([
    await transaction('quote_item').pluck('id').whereIn('quote_request_id', targets.quotes),
    await transaction('quote_item')
      .pluck('id')
      .where(function productMarkers() {
        this.whereIn('product_group_id', targets.groups).orWhereIn(
          'product_variant_id',
          targets.variants
        );
      })
  ]);
  targets.contactNotes = await transaction('contact_internal_note')
    .pluck('id')
    .whereIn('contact_id', targets.contacts);
  targets.quoteNotes = await transaction('quote_internal_note')
    .pluck('id')
    .whereIn('quote_id', targets.quotes);

  targets.batches = await transaction('import_batch')
    .pluck('id')
    .where(function batchMarkers() {
      this.whereILike('batch_name', 'QA %').orWhereILike(
        'batch_name',
        'Lô QA import-manager-%'
      );
    });
  targets.profiles = await transaction('import_mapping_profile')
    .pluck('id')
    .whereILike('profile_name', 'QA %');
  for (const table of [
    'data_conflict',
    'import_error_log',
    'import_mapping',
    'pending_product_group',
    'pending_variant',
    'raw_data'
  ]) {
    targets[table] = await transaction(table)
      .pluck('id')
      .whereIn('import_batch_id', targets.batches);
  }

  targets.users = await transaction('admin_user')
    .pluck('id')
    .where(function userMarkers() {
      this.whereILike('display_name', 'QA %')
        .orWhereILike('email', 'qa.%@songthanh.local')
        .orWhereILike('email', 'contact-viewer-%@example.com');
    });
  targets.roles = await transaction('admin_role')
    .pluck('id')
    .where(function roleMarkers() {
      this.whereILike('name', '%contact-viewer-%').orWhereILike(
        'description',
        '%Tài khoản QA%'
      ).orWhereRaw('code ~ ?', ['^vai_tro_qa_(guard_)?[0-9]{10,}']);
    });
  targets.files = await transaction('file_metadata')
    .pluck('id')
    .whereILike('original_filename', 'qa-%');

  return targets;
}

async function cleanTestData() {
  assertSafeDatabase();
  const database = knex(databaseConfig);

  try {
    return await database.transaction(async (transaction) => {
      const targets = await collectTargets(transaction);
      const allIds = unique(Object.values(targets));
      const targetEntityIds = unique(
        Object.entries(targets)
          .filter(([key]) => key !== 'files')
          .map(([, ids]) => ids)
      );
      const deleted = {};

      async function remove(table, query) {
        const count = await query.del();
        deleted[table] = (deleted[table] || 0) + count;
      }

      await remove(
        'audit_log',
        transaction('audit_log').where(function auditMarkers() {
          this.whereIn('entity_id', allIds)
            .orWhereIn('actor_id', targets.users)
            .orWhereRaw(
              "lower(coalesce(old_value::text, '') || ' ' || coalesce(new_value::text, '')) ~ ?",
              [AUDIT_MARKER]
            );
        })
      );
      await remove(
        'file_usage',
        transaction('file_usage').where(function fileMarkers() {
          this.whereIn('entity_id', targetEntityIds);
        })
      );

      await remove('contact_request', transaction('contact_request').whereIn('id', targets.contacts));
      await remove('quote_request', transaction('quote_request').whereIn('id', targets.quotes));
      await remove('customer_profile', transaction('customer_profile').whereIn('id', targets.customers));
      await remove('page_content', transaction('page_content').whereIn('id', targets.pages));
      await remove('banner', transaction('banner').whereIn('id', targets.banners));
      await remove(
        'product_highlight_spec',
        transaction('product_highlight_spec').whereIn('id', targets.highlights)
      );
      await remove(
        'technical_document',
        transaction('technical_document').whereIn('id', targets.documents)
      );
      await remove('product_image', transaction('product_image').whereIn('id', targets.images));
      await remove('quote_item', transaction('quote_item').whereIn('id', targets.quoteItems));
      await remove('product_variant', transaction('product_variant').whereIn('id', targets.variants));
      await remove('product_group', transaction('product_group').whereIn('id', targets.groups));
      await remove('news_category', transaction('news_category').whereIn('id', targets.categories));
      await remove('import_batch', transaction('import_batch').whereIn('id', targets.batches));
      await remove(
        'import_mapping_profile',
        transaction('import_mapping_profile').whereIn('id', targets.profiles)
      );
      await remove('admin_user', transaction('admin_user').whereIn('id', targets.users));
      await remove('admin_role', transaction('admin_role').whereIn('id', targets.roles));
      const remainingReferencedFileIds = new Set();
      const foreignKeyResult = await transaction.raw(`
        SELECT tc.table_schema, tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_schema = tc.constraint_schema
         AND kcu.constraint_name = tc.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_schema = tc.constraint_schema
         AND ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_schema = 'public'
          AND ccu.table_name = 'file_metadata'
          AND ccu.column_name = 'id'
      `);
      const foreignKeys = Array.isArray(foreignKeyResult.rows) ? foreignKeyResult.rows : [];
      for (const foreignKey of foreignKeys) {
        const referencedIds = await transaction
          .withSchema(String(foreignKey.table_schema))
          .from(String(foreignKey.table_name))
          .whereIn(String(foreignKey.column_name), targets.files)
          .whereNotNull(String(foreignKey.column_name))
          .pluck(String(foreignKey.column_name));
        referencedIds.forEach((id) => remainingReferencedFileIds.add(String(id)));
      }
      const unreferencedFileIds = targets.files.filter(
        (id) => !remainingReferencedFileIds.has(String(id))
      );
      await remove(
        'file_metadata',
        transaction('file_metadata').whereIn('id', unreferencedFileIds)
      );

      return deleted;
    });
  } finally {
    await database.destroy();
  }
}

cleanTestData()
  .then((deleted) => {
    const total = Object.values(deleted).reduce((sum, count) => sum + count, 0);
    console.log(`QA cleanup completed: ${total} database rows removed.`);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
