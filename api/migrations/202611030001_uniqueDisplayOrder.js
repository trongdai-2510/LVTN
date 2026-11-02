/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  for (const table of ['partner', 'certificate']) {
    const title = table === 'partner' ? 'name' : 'title';
    const rows = await knex(table).whereNull('deleted_at')
      .select('id', 'sort_order').orderBy('sort_order').orderBy(title).orderBy('id');
    const used = new Set(rows.map((row) => Number(row.sort_order)));
    const seen = new Set();
    for (const row of rows) {
      const previous = Number(row.sort_order);
      if (!seen.has(previous)) {
        seen.add(previous);
        continue;
      }
      // Keep existing distinct positions. Only move later records sharing a
      // position, preferring the next available number after that position.
      const start = previous >= 0 && previous < 32767 ? previous + 1 : 0;
      let next = null;
      for (let offset = 0; offset <= 32767; offset += 1) {
        const candidate = (start + offset) % 32768;
        if (!used.has(candidate)) {
          next = candidate;
          break;
        }
      }
      if (next === null) {
        throw new Error(`No free display order remains in ${table}`);
      }
      await knex(table).where({ id: row.id }).update({ sort_order: next });
      used.add(next);
      seen.add(next);
    }
    await knex.raw(`CREATE UNIQUE INDEX uq_${table}_sort_order_active ON ${table} (sort_order) WHERE deleted_at IS NULL`);
  }
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  for (const table of ['partner', 'certificate']) {
    await knex.raw(`DROP INDEX IF EXISTS uq_${table}_sort_order_active`);
  }
};
