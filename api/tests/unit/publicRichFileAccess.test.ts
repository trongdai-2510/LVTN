import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { Knex } from 'knex';

import type { KnexService } from '../../src/db/knex.service';
import { PAGE_CONTENT_EXTRA_BLOCK_FIELD_PREFIX } from '../../src/modules/page-content/page-content.types';
import { PublicRepository } from '../../src/modules/public/public.repository';

const createKnex: typeof import('knex').default = require('knex');

async function publicRichFileQuery(entityType: 'page_content' | 'service' | 'project') {
  const sqlKnex = createKnex({ client: 'pg' });
  const capture: { query: Knex.Sql | null } = { query: null };
  const fakeDb = ((table: string | Record<string, string>) => {
    const builder = sqlKnex(table);
    builder.first = (async () => {
      capture.query = builder.toSQL();
      return null;
    }) as typeof builder.first;
    return builder;
  }) as Knex;
  const repository = new PublicRepository({ db: fakeDb } as KnexService);

  await (repository as unknown as {
    isRichContentFilePublic: (fileId: string, entity: typeof entityType, table: string) => Promise<boolean>;
  }).isRichContentFilePublic('test-file-id', entityType, entityType);

  assert.ok(capture.query);
  return capture.query;
}

test('published page image-card files are included in public rich-content access', async () => {
  const query = await publicRichFileQuery('page_content');

  assert.ok(query.bindings.includes('content_html'));
  assert.ok(query.bindings.includes(`${PAGE_CONTENT_EXTRA_BLOCK_FIELD_PREFIX}%`));
  assert.match(query.sql, /review_status/);
  assert.match(query.sql, /publish_status/);
});

test('service and project rich-content access stays limited to HTML attachments', async () => {
  for (const entityType of ['service', 'project'] as const) {
    const query = await publicRichFileQuery(entityType);
    assert.ok(query.bindings.includes('content_html'));
    assert.ok(!query.bindings.includes(`${PAGE_CONTENT_EXTRA_BLOCK_FIELD_PREFIX}%`));
  }
});
