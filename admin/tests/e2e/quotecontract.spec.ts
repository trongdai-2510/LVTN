import { expect, test, type APIRequestContext } from '@playwright/test';

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000'
).replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local';
const ADMIN_PASSWORD = process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!';
const createdRecords: Array<{ id: string; email: string }> = [];
let loginSequence = 210;

type RecordMap = Record<string, unknown>;

test.afterEach(async ({ request }) => {
  if (createdRecords.length === 0) return;
  const session = await login(request);
  for (const record of createdRecords.splice(0)) {
    await cleanupQuoteAndCustomer(request, session, record);
  }
});

test('quote API keeps legacy clients and stores explicit project interpretation', async ({ request }) => {
  const product = await firstPublishedProduct(request);
  const productGroupId = String(product.id);
  const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const legacyEmail = `legacy-${runId}@example.com`;

  const legacyResponse = await request.post(`${API_BASE_URL}/public/quote-requests`, {
    data: {
      full_name: `Khách legacy ${runId}`,
      phone: '0901234567',
      email: legacyEmail,
      items: [{
        product_group_id: productGroupId,
        quantity: 2,
        public_price_amount_at_request: 999999
      }]
    }
  });
  expect(legacyResponse.status()).toBe(201);
  const legacy = unwrap(await legacyResponse.json());
  createdRecords.push({ id: String(recordOf(legacy.quote_request).id), email: legacyEmail });
  const legacyItem = recordOf(arrayOf(legacy.items)[0]);
  expect(legacyItem.quantity).toBe(2);
  expect(legacyItem.quantity_raw).toBe('2');
  expect(legacyItem.quantity_state).toBe('confirmed');
  expect(legacyItem.public_price_amount_at_request).toBeNull();

  const projectEmail = `project-${runId}@example.com`;
  const projectResponse = await request.post(`${API_BASE_URL}/public/quote-requests`, {
    data: {
      full_name: `Khách dự án ${runId}`,
      phone: '0901234567',
      email: projectEmail,
      project_name: 'Nhà máy mở rộng',
      project_context: 'Cần tư vấn trước khi chốt khối lượng.',
      project_requirements: [
        { label: 'Điện áp', value: '0,6/1 kV' },
        { label: 'Tiến độ', value: 'Quý 4' }
      ],
      items: [
        {
          product_group_id: productGroupId,
          quantity_raw: '1/2',
          quantity_unit: 'sản phẩm',
          quantity_state: 'unspecified'
        }
      ]
    }
  });
  expect(projectResponse.status()).toBe(201);
  const project = unwrap(await projectResponse.json());
  createdRecords.push({ id: String(recordOf(project.quote_request).id), email: projectEmail });
  const projectRequest = recordOf(project.quote_request);
  const projectItem = recordOf(arrayOf(project.items)[0]);
  expect(projectRequest.project_name).toBe('Nhà máy mở rộng');
  expect(projectRequest.project_requirements).toEqual([
    { label: 'Điện áp', value: '0,6/1 kV' },
    { label: 'Tiến độ', value: 'Quý 4' }
  ]);
  expect(projectItem.quantity).toBeNull();
  expect(projectItem.quantity_raw).toBe('1/2');
  expect(projectItem.quantity_unit).toBe('sản phẩm');
  expect(projectItem.quantity_state).toBe('unspecified');
  expect(projectItem.public_price_amount_at_request).toBeNull();

  const session = await login(request);
  const detailResponse = await request.get(
    `${API_BASE_URL}/song-thanh/quotes/${String(projectRequest.id)}`,
    { headers: { Authorization: `Bearer ${session.access_token}` } }
  );
  expect(detailResponse.ok()).toBe(true);
  const savedItem = recordOf(arrayOf(unwrap(await detailResponse.json()).items)[0]);
  expect(savedItem.public_price_amount_at_request).toBeNull();

  const mismatchResponse = await request.post(`${API_BASE_URL}/public/quote-requests`, {
    data: {
      full_name: `Khách dữ liệu gài ${runId}`,
      phone: '0901234567',
      email: `invalid-${runId}@example.com`,
      items: [
        {
          product_group_id: productGroupId,
          quantity: 1,
          quantity_raw: '1/2',
          quantity_state: 'confirmed'
        }
      ]
    }
  });
  expect(mismatchResponse.status()).toBe(400);
  const mismatch = unwrap(await mismatchResponse.json());
  expect(JSON.stringify(mismatch)).toContain('items.0.quantity_raw');
});

async function firstPublishedProduct(request: APIRequestContext): Promise<RecordMap> {
  const response = await request.get(`${API_BASE_URL}/public/product-groups?page=1&page_size=1`);
  expect(response.ok()).toBe(true);
  const body = unwrap(await response.json());
  const item = arrayOf(body.items)[0];
  if (!item) throw new Error('QA database needs at least one published product.');
  return recordOf(item);
}

function unwrap(value: unknown): RecordMap {
  const record = recordOf(value);
  return recordOf(record.data ?? record);
}

function recordOf(value: unknown): RecordMap {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordMap)
    : {};
}

function arrayOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function login(request: APIRequestContext): Promise<{ access_token: string }> {
  loginSequence += 1;
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    headers: { 'X-Forwarded-For': `192.0.2.${loginSequence}` },
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  expect(response.ok()).toBe(true);
  return unwrap(await response.json()) as { access_token: string };
}

async function cleanupQuoteAndCustomer(
  request: APIRequestContext,
  session: { access_token: string },
  record: { id: string; email: string }
) {
  const headers = { Authorization: `Bearer ${session.access_token}` };
  await request.post(`${API_BASE_URL}/song-thanh/quotes/${record.id}/archive`, { headers });
  await request.delete(`${API_BASE_URL}/song-thanh/quotes/${record.id}/permanent`, { headers });
  const response = await request.get(
    `${API_BASE_URL}/song-thanh/customers?q=${encodeURIComponent(record.email)}&deleted_scope=all&page=1&page_size=100`,
    { headers }
  );
  if (!response.ok()) return;
  for (const customer of arrayOf(unwrap(await response.json()).items).map(recordOf)) {
    if (String(customer.email || '').toLowerCase() !== record.email.toLowerCase()) continue;
    const id = String(customer.id || '');
    if (!id) continue;
    if (!customer.deleted_at) {
      await request.post(`${API_BASE_URL}/song-thanh/customers/${id}/archive`, { headers });
    }
    await request.delete(`${API_BASE_URL}/song-thanh/customers/${id}/permanent`, { headers });
  }
}
