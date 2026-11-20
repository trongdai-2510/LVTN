import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { CurrentUser } from '../../src/common/auth/auth.types';
import { AuditLogService } from '../../src/modules/audit-log/audit-log.service';
import type { AuditLogRepository } from '../../src/modules/audit-log/audit-log.repository';
import type { AuditLogDetail } from '../../src/modules/audit-log/audit-log.types';

const id = '11111111-1111-4111-8111-111111111111';

function user(role: string, permissions: string[]): CurrentUser {
  return {
    id,
    email: 'admin@example.test',
    display_name: 'Admin',
    status: 'active',
    roles: [role],
    permissions
  };
}

function auditLog(entityType: string, oldValue: unknown, newValue: unknown): AuditLogDetail {
  return {
    id,
    entity_type: entityType,
    entity_id: id,
    actor_id: id,
    action: 'update',
    old_value: oldValue,
    new_value: newValue,
    changed_fields: ['email'],
    ip_address: '127.0.0.1',
    user_agent: 'test',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    actor_name: 'Editor',
    actor_email: 'editor@example.test'
  };
}

function serviceFor(record: AuditLogDetail): AuditLogService {
  const repository = {
    findById: async (requestedId: string) => {
      assert.equal(requestedId, id);
      return record;
    }
  } as unknown as AuditLogRepository;
  return new AuditLogService(repository);
}

test('audit_log.read keeps event metadata but hides contact fields without contact.read', async () => {
  const record = auditLog('contact_request', { email: 'customer@example.test' }, { email: 'new@example.test' });
  const result = await serviceFor(record).getAuditLogDetail(id, user('product_admin', ['audit_log.read']));
  assert.equal(result.audit_log.entity_type, 'contact_request');
  assert.equal(result.audit_log.action, 'update');
  assert.equal(result.audit_log.details_redacted, true);
  assert.equal(result.audit_log.old_value, null);
  assert.equal(result.audit_log.new_value, null);
  assert.equal(result.audit_log.changed_fields, null);
});

test('matching domain read permission reveals contact and quote changes', async () => {
  for (const [entityType, permission] of [
    ['contact_request', 'contact.read'],
    ['quote_request', 'quote.read']
  ]) {
    const record = auditLog(entityType, { email: 'customer@example.test' }, { email: 'new@example.test' });
    const result = await serviceFor(record).getAuditLogDetail(id, user('sales_admin', ['audit_log.read', permission]));
    assert.equal(result.audit_log.details_redacted, false);
    assert.deepEqual(result.audit_log.new_value, { email: 'new@example.test' });
  }
});

test('import workbook audit details need import.read in addition to file.read', async () => {
  const record = auditLog('file_metadata', { purpose: 'import_file', original_filename: 'source.xlsx' }, null);
  const fileReader = await serviceFor(record).getAuditLogDetail(id, user('viewer', ['audit_log.read', 'file.read']));
  assert.equal(fileReader.audit_log.details_redacted, true);
  const importReader = await serviceFor(record).getAuditLogDetail(id, user('product_admin', ['audit_log.read', 'file.read', 'import.read']));
  assert.equal(importReader.audit_log.details_redacted, false);
});

test('brand-page audit details follow page_content.read', async () => {
  const record = auditLog('brand_page', { title: 'Old title' }, { title: 'New title' });
  const brandReader = await serviceFor(record).getAuditLogDetail(id, user('product_admin', ['audit_log.read', 'brand.read']));
  assert.equal(brandReader.audit_log.details_redacted, true);
  const contentReader = await serviceFor(record).getAuditLogDetail(id, user('content_admin', ['audit_log.read', 'page_content.read']));
  assert.equal(contentReader.audit_log.details_redacted, false);
});

test('unknown entity payloads fail closed except for Super Admin', async () => {
  const record = auditLog('future_entity', { value: 'private' }, { value: 'new private' });
  const ordinary = await serviceFor(record).getAuditLogDetail(id, user('content_admin', ['audit_log.read']));
  assert.equal(ordinary.audit_log.details_redacted, true);
  const superAdmin = await serviceFor(record).getAuditLogDetail(id, user('super_admin', []));
  assert.equal(superAdmin.audit_log.details_redacted, false);
  assert.deepEqual(superAdmin.audit_log.new_value, { value: 'new private' });
});
