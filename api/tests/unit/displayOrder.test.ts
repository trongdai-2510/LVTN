import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { PartnerService } from '../../src/modules/partner/partnerService';
import type { PartnerRepository } from '../../src/modules/partner/partnerRepository';
import { CertificateService } from '../../src/modules/certificate/certificateService';
import type { CertificateRepository } from '../../src/modules/certificate/certificateRepository';

const partnerId = '11111111-1111-4111-8111-111111111111';

test('partner create reports a duplicate display order as a conflict', async () => {
  const repository = {
    create: async () => { throw { code: '23505', constraint: 'uq_partner_sort_order_active' }; }
  } as unknown as PartnerRepository;
  const service = new PartnerService(repository);
  await assert.rejects(service.createPartner({ name: 'Partner', sort_order: 1 }), (error: Error & { statusCode?: number }) => {
    assert.equal(error.statusCode, 409);
    assert.match(error.message, /Thứ tự hiển thị/);
    return true;
  });
});

test('restoring a partner cannot reuse an occupied display order', async () => {
  const repository = {
    find: async () => ({ id: partnerId, logo_file_id: null, sort_order: 0, deleted_at: new Date() }),
    list: async () => [],
    restore: async () => { throw { code: '23505', constraint: 'uq_partner_sort_order_active' }; }
  } as unknown as PartnerRepository;
  const service = new PartnerService(repository);
  await assert.rejects(service.restorePartner(partnerId), (error: Error & { statusCode?: number }) => {
    assert.equal(error.statusCode, 409);
    return true;
  });
});

test('partner restore moves to a free order when its former position is occupied', async () => {
  let restoredOrder: number | null = null;
  const repository = {
    find: async () => ({ id: partnerId, logo_file_id: null, sort_order: 2, deleted_at: new Date() }),
    list: async () => [
      { sort_order: 0, deleted_at: null },
      { sort_order: 2, deleted_at: null }
    ],
    restore: async (_id: string, order: number) => { restoredOrder = order; }
  } as unknown as PartnerRepository;
  await new PartnerService(repository).restorePartner(partnerId);
  assert.equal(restoredOrder, 1);
});

test('certificate create reports a duplicate display order as a conflict', async () => {
  const repository = {
    create: async () => { throw { code: '23505', constraint: 'uq_certificate_sort_order_active' }; }
  } as unknown as CertificateRepository;
  const service = new CertificateService(repository);
  await assert.rejects(service.create({ title: 'Certificate', sort_order: 1 }), (error: Error & { statusCode?: number }) => {
    assert.equal(error.statusCode, 409);
    assert.match(error.message, /Thứ tự hiển thị/);
    return true;
  });
});

test('certificate restore moves to a free order when its former position is occupied', async () => {
  let restoredOrder: number | null = null;
  const repository = {
    find: async () => ({ id: partnerId, file_id: null, image_file_id: null, sort_order: 2, deleted_at: new Date() }),
    list: async () => [
      { sort_order: 0, deleted_at: null },
      { sort_order: 2, deleted_at: null }
    ],
    restore: async (_id: string, order: number) => { restoredOrder = order; }
  } as unknown as CertificateRepository;
  await new CertificateService(repository).restore(partnerId);
  assert.equal(restoredOrder, 1);
});
