import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import knex from 'knex';
import type { KnexService } from '../../src/db/knex.service';
import { FileRepository } from '../../src/modules/file/file.repository';
import { AuditLogRepository } from '../../src/modules/audit-log/audit-log.repository';

const db = knex({ client: 'pg' });
const knexService = { db } as KnexService;

test('file usage search casts UUID identifiers before case-insensitive matching', () => {
  const repository = new FileRepository(knexService) as unknown as {
    applyUsageRecordFilters: (query: ReturnType<typeof db>, filters: {
      q: string; usage_group: null; entity_type: null;
    }) => ReturnType<typeof db>;
  };
  const sql = repository.applyUsageRecordFilters(db('usage_records'), {
    q: 'abc', usage_group: null, entity_type: null
  }).toSQL().sql;
  assert.match(sql, /"entity_id"::text ILIKE \?/);
});

test('audit search casts UUID identifiers before case-insensitive matching', () => {
  const repository = new AuditLogRepository(knexService) as unknown as {
    applyListFilters: (query: ReturnType<typeof db>, alias: string, filters: {
      q: string; actor_id: null; action: null; entity_type: null; entity_id: null;
      created_from: null; created_to: null;
    }) => ReturnType<typeof db>;
  };
  const sql = repository.applyListFilters(db('audit_log_record'), 'audit_log_record', {
    q: 'abc', actor_id: null, action: null, entity_type: null, entity_id: null,
    created_from: null, created_to: null
  }).toSQL().sql;
  assert.match(sql, /"audit_log_record"\."entity_id"::text ILIKE \?/);
});
