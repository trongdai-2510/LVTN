import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { PublicRepository } from '../../src/modules/public/public.repository';
import type { KnexService } from '../../src/db/knex.service';

test('a public request can link to an archived customer without restoring the profile', async () => {
  const archivedId = '11111111-1111-4111-8111-111111111111';
  let updates = 0;
  const archived = {
    id: archivedId,
    full_name: 'Nguyen Van A',
    phone: null,
    email: 'customer@example.test',
    company_name: 'Company',
    deleted_at: new Date('2026-01-01T00:00:00.000Z')
  };
  const transaction = Object.assign(
    (_table: string) => ({
      select() { return this; },
      whereRaw() { return this; },
      andWhere() { return this; },
      orderByRaw() { return this; },
      orderBy() { return this; },
      forUpdate() { return this; },
      first: async () => archived,
      where() { return this; },
      update: async () => { updates += 1; }
    }),
    { raw: async () => undefined }
  );
  const repository = new PublicRepository({} as KnexService) as unknown as {
    resolveCustomerProfileId: (trx: typeof transaction, input: {
      full_name: string; phone: string; email: string; company_name: string;
    }) => Promise<string>;
  };

  const resolvedId = await repository.resolveCustomerProfileId(transaction, {
    full_name: archived.full_name,
    phone: '0901234567',
    email: archived.email,
    company_name: archived.company_name
  });

  assert.equal(resolvedId, archivedId);
  assert.equal(updates, 0);
  assert.ok(archived.deleted_at);
});
