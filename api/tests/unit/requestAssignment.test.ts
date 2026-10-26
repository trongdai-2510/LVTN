import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { KnexService } from '../../src/db/knex.service';
import type { LogicUserReferenceRepository } from '../../src/common/users/logic-user-reference.repository';
import { ContactRepository } from '../../src/modules/contact/contact.repository';
import { QuoteRepository } from '../../src/modules/quote/quote.repository';

test('contact and quote assignment reject an active user without processing rights', async () => {
  for (const kind of ['contact', 'quote'] as const) {
    let wrote = false;
    let eligible = false;
    const trx = ((table: string) => {
      const query = {
        select: () => query,
        where: () => query,
        whereNull: () => query,
        forUpdate: () => query,
        first: async () => table === 'admin_user'
          ? { id: 'active-user' }
          : { id: 'request-id', deleted_at: null },
        update: async () => { wrote = true; }
      };
      return query;
    }) as never;
    const knex = {
      db: { transaction: async (run: (transaction: typeof trx) => Promise<unknown>) => run(trx) }
    } as unknown as KnexService;
    const logicUsers = {
      canProcessRequests: async (id: number, read: string, process: string, transaction: unknown) => {
        assert.equal(id, 42);
        assert.equal(read, `${kind}.read`);
        assert.equal(process, `${kind}.update_status`);
        assert.equal(transaction, trx);
        return eligible;
      }
    } as unknown as LogicUserReferenceRepository;
    const repository = kind === 'contact'
      ? new ContactRepository(knex, logicUsers)
      : new QuoteRepository(knex, logicUsers);

    assert.equal(await repository.updateAssignee('request-id', 42), 'assignee_not_eligible');
    assert.equal(wrote, false);
    eligible = true;
    assert.equal(await repository.updateAssignee('request-id', 42), 'updated');
    assert.equal(wrote, true);
  }
});
