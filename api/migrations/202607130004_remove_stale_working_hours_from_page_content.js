const PAGE_CONTENT_TABLE = 'page_content';

const REPLACEMENTS = [
  {
    slug: 'cau-hoi-thuong-gap',
    from: 'trực hotline T2-T7, 08:00-17:30',
    to: 'trực hotline trong giờ làm việc'
  },
  {
    slug: 'chinh-sach-bao-hanh',
    from: 'trong giờ làm việc (T2-T7, 08:00-17:30)',
    to: 'trong giờ làm việc'
  }
];

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  for (const replacement of REPLACEMENTS) {
    await knex(PAGE_CONTENT_TABLE)
      .where({ slug: replacement.slug })
      .whereNull('deleted_at')
      .where('content_html', 'like', `%${replacement.from}%`)
      .update({
        content_html: knex.raw('replace(content_html, ?, ?)', [replacement.from, replacement.to]),
        updated_at: knex.fn.now()
      });
  }
};

/**
 * This data cleanup intentionally has no automatic down migration. Restoring a
 * stale company schedule would make page content conflict with website settings.
 */
exports.down = async function down() {};
