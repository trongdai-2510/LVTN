import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const requireFromApi = createRequire(path.join(ROOT, 'api', 'package.json'));
const { Client: PostgresClient } = requireFromApi('pg');
const API_BASE_URL = (
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000'
).replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local';
const ADMIN_PASSWORD = process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!';
const QA_CLIENT_IP = '192.0.2.70';
const RUN_ID = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const REPORT_PATH = path.join(
  ROOT,
  'tmp',
  'qa-artifacts',
  'crm-domain-invariants-qa-last-run.md'
);
const MAX_LOGIC_USER_ID = 2_147_483_647;
const POSTGRES_INTEGER_MAX = 2_147_483_647;

const results = [];
const context = {
  accessToken: '',
  currentUserId: '',
  logicUserId: null,
  logicUserLabel: '',
  productGroupId: '',
  productVariantId: '',
  contactIds: [],
  quoteIds: [],
  customerIds: [],
  primaryContactId: '',
  primaryCustomerId: '',
  alternateCustomerId: '',
  quoteId: ''
};

assertSafeTarget();

await runCase('CRM-ENV', 'The API and isolated QA database are safe to mutate', async () => {
  const health = await request('/health');
  assert(health.status === 200, `health returned ${health.status}`);
  return { database: process.env.DATABASE_NAME, target: API_BASE_URL };
});

await runCase('CRM-AUTH', 'Super-admin can authenticate for CRM invariant tests', async () => {
  const login = await request('/auth/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  assert(login.ok, responseError(login));
  const session = unwrap(login.body);
  context.accessToken = String(session?.access_token || '');
  context.currentUserId = String(session?.user?.id || '');
  assert(context.accessToken && context.currentUserId, 'login session is incomplete');
  return { user_id: context.currentUserId };
});

await runCase('CRM-QUERY-AND-CUSTOMER-BOUNDS', 'CRM list and customer fields enforce database-safe boundaries', async () => {
  const oversizedQuery = encodeURIComponent('q'.repeat(256));
  const listBounds = await Promise.all([
    adminRequest(`/song-thanh/contacts?q=${oversizedQuery}`),
    adminRequest(`/song-thanh/quotes?q=${oversizedQuery}`),
    adminRequest(`/song-thanh/customers?q=${oversizedQuery}`),
    adminRequest(`/song-thanh/contacts?page=${POSTGRES_INTEGER_MAX + 1}`),
    adminRequest(`/song-thanh/quotes?page=${POSTGRES_INTEGER_MAX + 1}`),
    adminRequest(`/song-thanh/customers?page=${POSTGRES_INTEGER_MAX + 1}`)
  ]);
  listBounds.forEach((response, index) => {
    assert(response.status === 400, `list boundary ${index + 1} returned ${response.status}`);
  });

  const exactEmail = `${'a'.repeat(64)}@${'b'.repeat(55)}.example`;
  assert(exactEmail.length === 128, 'exact-boundary email fixture is not 128 characters');
  const exact = await adminRequest('/song-thanh/customers', {
    method: 'POST',
    body: {
      full_name: 'N'.repeat(128),
      phone: '0'.repeat(32),
      email: exactEmail,
      company_name: 'C'.repeat(255)
    }
  });
  assert(exact.status === 201, responseError(exact));
  const exactCustomerId = String(unwrap(exact.body)?.customer?.id || '');
  assert(exactCustomerId, 'exact-boundary customer id is missing');
  context.customerIds.push(exactCustomerId);

  const base = {
    full_name: `CRM boundary ${RUN_ID}`,
    phone: '0900000000',
    email: `crm.boundary.${RUN_ID}@example.com`,
    company_name: 'CRM QA'
  };
  const oversizedFields = await Promise.all([
    adminRequest('/song-thanh/customers', {
      method: 'POST',
      body: { ...base, full_name: 'N'.repeat(129) }
    }),
    adminRequest('/song-thanh/customers', {
      method: 'POST',
      body: { ...base, phone: '0'.repeat(33) }
    }),
    adminRequest('/song-thanh/customers', {
      method: 'POST',
      body: { ...base, email: `${'e'.repeat(129)}@example.com` }
    }),
    adminRequest('/song-thanh/customers', {
      method: 'POST',
      body: { ...base, company_name: 'C'.repeat(256) }
    })
  ]);
  oversizedFields.forEach((response, index) => {
    assert(response.status === 400, `customer field boundary ${index + 1} returned ${response.status}`);
  });

  return {
    list_rejections: listBounds.map((response) => response.status),
    exact_customer_id: exactCustomerId,
    field_rejections: oversizedFields.map((response) => response.status)
  };
});

await runCase('CRM-LOGIC-USER-BRIDGE', 'Active UUID admin users expose stable INTEGER assignee ids', async () => {
  const response = await adminRequest('/song-thanh/contacts?page=1&page_size=1');
  assert(response.ok, responseError(response));
  const data = unwrap(response.body);
  const options = Array.isArray(data?.assignee_options) ? data.assignee_options : [];
  const current = options.find(
    (option) => String(option.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );
  assert(current, 'authenticated administrator is missing from assignee_options');
  assert(
    Number.isSafeInteger(current.id) && current.id > 0 && current.id <= MAX_LOGIC_USER_ID,
    `invalid logic-user id ${current.id}`
  );
  assert(String(current.label || '').trim(), 'assignee label is blank');
  assert(
    new Set(options.map((option) => option.id)).size === options.length,
    'assignee ids are not unique'
  );
  context.logicUserId = current.id;
  context.logicUserLabel = current.label;
  return { option_count: options.length, current };
});

await runCase('CRM-PRODUCT-FIXTURE', 'A public product and variant are available for quote requests', async () => {
  const list = await request('/public/product-groups?page=1&page_size=20');
  assert(list.ok, responseError(list));
  for (const group of extractItems(unwrap(list.body))) {
    if (!group?.slug) continue;
    const detail = await request(
      `/public/product-groups/${encodeURIComponent(group.slug)}`
    );
    if (!detail.ok) continue;
    const record = unwrap(detail.body);
    const variant = Array.isArray(record?.variants)
      ? record.variants.find((item) => item?.id)
      : null;
    if (group.id && variant?.id) {
      context.productGroupId = String(group.id);
      context.productVariantId = String(variant.id);
      return {
        product_group_id: context.productGroupId,
        product_variant_id: context.productVariantId
      };
    }
  }
  throw new Error('no public product group with an active variant is available');
});

await runCase('CRM-PUBLIC-CONTACT-FIXTURES', 'Public contact submissions create traceable customer profiles', async () => {
  const sharedName = `CRM Identity ${RUN_ID}`;
  const sharedPhone = `09${RUN_ID.slice(-8)}`;
  const sharedEmail = `crm.identity.${RUN_ID}@example.com`;
  const payloads = [
    {
      full_name: sharedName,
      phone: sharedPhone,
      email: sharedEmail,
      company_name: 'CRM QA',
      message: 'Liên hệ CRM thứ nhất',
      source_page: '/qa/crm/one'
    },
    {
      full_name: `  ${sharedName}  `,
      phone: sharedPhone,
      email: sharedEmail.toUpperCase(),
      company_name: 'CRM QA',
      message: 'Liên hệ CRM trùng danh tính',
      source_page: '/qa/crm/two'
    },
    {
      full_name: `CRM Different Name ${RUN_ID}`,
      phone: sharedPhone,
      email: sharedEmail,
      company_name: 'CRM QA',
      message: 'Cùng liên lạc nhưng khác tên',
      source_page: '/qa/crm/three'
    }
  ];

  for (const payload of payloads) {
    const response = await request('/public/contact-requests', {
      method: 'POST',
      body: payload
    });
    assert(response.status === 201, responseError(response));
    const id = String(unwrap(response.body)?.contact_request?.id || '');
    assert(id, 'created contact id is missing');
    context.contactIds.push(id);
  }
  context.primaryContactId = context.contactIds[0];
  return { contact_ids: context.contactIds };
});

await runCase('CRM-CUSTOMER-IDENTITY-BOUNDARY', 'Same name plus contact value reuses a profile; a different name does not', async () => {
  const details = [];
  for (const id of context.contactIds) {
    const response = await adminRequest(`/song-thanh/contacts/${id}`);
    assert(response.ok, responseError(response));
    details.push(unwrap(response.body)?.contact);
  }
  const customerIds = details.map((contact) => String(contact?.customer_id || ''));
  assert(customerIds.every(Boolean), 'one contact has no customer_id');
  assert(customerIds[0] === customerIds[1], 'normalized matching identity was not reused');
  assert(customerIds[0] !== customerIds[2], 'different submitted name was merged incorrectly');
  context.primaryCustomerId = customerIds[0];
  context.alternateCustomerId = customerIds[2];
  context.customerIds.push(...new Set(customerIds));
  return { customer_ids: customerIds };
});

await runCase('CRM-PUBLIC-CUSTOMER-CONCURRENCY', 'Concurrent identical public submissions create one customer profile', async () => {
  const sharedName = `CRM Concurrent ${RUN_ID}`;
  const sharedPhone = `08${RUN_ID.slice(-8)}`;
  const sharedEmail = `crm.concurrent.${RUN_ID}@example.com`;
  const responses = await Promise.all(
    Array.from({ length: 4 }, (_, index) =>
      request('/public/contact-requests', {
        method: 'POST',
        headers: { 'X-Forwarded-For': '192.0.2.71' },
        body: {
          full_name: index % 2 === 0 ? sharedName : `  ${sharedName}  `,
          phone: sharedPhone,
          email: index % 2 === 0 ? sharedEmail : sharedEmail.toUpperCase(),
          company_name: 'CRM concurrent QA',
          message: `Concurrent identity request ${index + 1}`,
          source_page: `/qa/crm/concurrent/${index + 1}`
        }
      })
    )
  );
  responses.forEach((response, index) => {
    assert(response.status === 201, `concurrent submission ${index + 1}: ${responseError(response)}`);
  });
  const ids = responses.map((response) =>
    String(unwrap(response.body)?.contact_request?.id || '')
  );
  assert(ids.every(Boolean), 'a concurrent contact id is missing');
  context.contactIds.push(...ids);

  const details = await Promise.all(
    ids.map((id) => adminRequest(`/song-thanh/contacts/${id}`))
  );
  details.forEach((response) => assert(response.ok, responseError(response)));
  const customerIds = details.map((response) =>
    String(unwrap(response.body)?.contact?.customer_id || '')
  );
  assert(customerIds.every(Boolean), 'a concurrent contact has no customer_id');
  assert(
    new Set(customerIds).size === 1,
    `concurrent submissions created ${new Set(customerIds).size} customer profiles`
  );
  context.customerIds.push(customerIds[0]);
  return { contact_ids: ids, customer_id: customerIds[0] };
});

await runCase('CRM-PUBLIC-QUOTE-FIXTURE', 'A quote reuses the matching customer across source kinds', async () => {
  const response = await request('/public/quote-requests', {
    method: 'POST',
    body: {
      full_name: `CRM Identity ${RUN_ID}`,
      phone: `09${RUN_ID.slice(-8)}`,
      email: `crm.identity.${RUN_ID}@example.com`,
      company_name: 'CRM QA',
      address: 'Địa chỉ QA',
      message: 'Yêu cầu báo giá CRM',
      items: [
        {
          product_group_id: context.productGroupId,
          product_variant_id: context.productVariantId,
          quantity: 1,
          notes: 'CRM invariant fixture'
        }
      ]
    }
  });
  assert(response.status === 201, responseError(response));
  context.quoteId = String(unwrap(response.body)?.quote_request?.id || '');
  assert(context.quoteId, 'created quote id is missing');
  context.quoteIds.push(context.quoteId);

  const detail = await adminRequest(`/song-thanh/quotes/${context.quoteId}`);
  assert(detail.ok, responseError(detail));
  const quote = unwrap(detail.body)?.quote;
  assert(
    quote?.customer_id === context.primaryCustomerId,
    'matching contact and quote identities did not share a customer profile'
  );
  return {
    quote_id: context.quoteId,
    customer_id: quote.customer_id,
    item_count: unwrap(detail.body)?.items?.length ?? 0
  };
});

await runCase('CRM-CONTACT-ASSIGNEE', 'Contact assignment persists the integer id and readable label', async () => {
  const response = await adminRequest(
    `/song-thanh/contacts/${context.primaryContactId}/assignee`,
    { method: 'PUT', body: { assigned_to: context.logicUserId } }
  );
  assert(response.ok, responseError(response));
  const contact = unwrap(response.body)?.contact;
  assert(contact?.assigned_to === context.logicUserId, 'assigned_to was not retained');
  assert(
    contact?.assigned_to_label === context.logicUserLabel,
    'assigned_to_label does not identify the selected user'
  );

  const filtered = await adminRequest(
    `/song-thanh/contacts?assigned_to=${context.logicUserId}&page=1&page_size=100`
  );
  assert(filtered.ok, responseError(filtered));
  assert(
    extractItems(unwrap(filtered.body)).some(
      (item) => item.id === context.primaryContactId
    ),
    'assigned_to filter did not return the assigned contact'
  );
  return {
    assigned_to: contact.assigned_to,
    assigned_to_label: contact.assigned_to_label
  };
});

await runCase('CRM-CONTACT-ASSIGNEE-BOUNDS', 'Unknown and overflowing contact assignee ids are rejected without mutation', async () => {
  const unknown = await unusedAssigneeId();
  const missing = await adminRequest(
    `/song-thanh/contacts/${context.primaryContactId}/assignee`,
    { method: 'PUT', body: { assigned_to: unknown } }
  );
  assertError(missing, 404, 'NOT_FOUND');

  const overflow = await adminRequest(
    `/song-thanh/contacts/${context.primaryContactId}/assignee`,
    { method: 'PUT', body: { assigned_to: MAX_LOGIC_USER_ID + 1 } }
  );
  assert(overflow.status === 400, `overflow assignee returned ${overflow.status}`);

  const detail = await adminRequest(
    `/song-thanh/contacts/${context.primaryContactId}`
  );
  assert(detail.ok, responseError(detail));
  assert(
    unwrap(detail.body)?.contact?.assigned_to === context.logicUserId,
    'failed assignment mutated the stored assignee'
  );
  return {
    unknown: errorEvidence(missing),
    overflow: errorEvidence(overflow)
  };
});

await runCase('CRM-CONTACT-NOTE-ACTOR', 'Contact notes capture the current admin id and label', async () => {
  const blank = await adminRequest(
    `/song-thanh/contacts/${context.primaryContactId}/internal-notes`,
    { method: 'POST', body: { note_text: '   ' } }
  );
  assert(blank.status === 400, `blank note returned ${blank.status}`);
  const oversized = await adminRequest(
    `/song-thanh/contacts/${context.primaryContactId}/internal-notes`,
    { method: 'POST', body: { note_text: 'N'.repeat(10_001) } }
  );
  assert(oversized.status === 400, `oversized contact note returned ${oversized.status}`);

  const noteText = `CRM contact note ${RUN_ID}`;
  const response = await adminRequest(
    `/song-thanh/contacts/${context.primaryContactId}/internal-notes`,
    { method: 'POST', body: { note_text: noteText } }
  );
  assert(response.ok, responseError(response));
  const note = (unwrap(response.body)?.internal_notes || []).find(
    (item) => item.note_text === noteText
  );
  assert(note, 'created contact note is missing');
  assert(note.added_by === context.logicUserId, 'contact note actor id is missing');
  assert(
    note.added_by_label === context.logicUserLabel,
    'contact note actor label is missing'
  );
  return {
    note_id: note.id,
    added_by: note.added_by,
    added_by_label: note.added_by_label
  };
});

await runCase('CRM-CONTACT-ARCHIVE-NOTE-RACE', 'A note queued behind archive cannot be inserted after archival', async () => {
  const database = createDatabaseClient();
  await database.connect();
  let transactionOpen = false;
  const noteText = `CRM blocked race note ${RUN_ID}`;
  try {
    await database.query('BEGIN');
    transactionOpen = true;
    await database.query(
      'SELECT id FROM contact_request WHERE id = $1 FOR UPDATE',
      [context.primaryContactId]
    );

    let settled = false;
    const pendingNote = adminRequest(
      `/song-thanh/contacts/${context.primaryContactId}/internal-notes`,
      { method: 'POST', body: { note_text: noteText } }
    ).finally(() => {
      settled = true;
    });
    await delay(350);
    const waitedForLock = !settled;

    await database.query(
      'UPDATE contact_request SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [context.primaryContactId]
    );
    await database.query('COMMIT');
    transactionOpen = false;

    const response = await pendingNote;
    const detail = await adminRequest(
      `/song-thanh/contacts/${context.primaryContactId}`
    );
    assert(detail.ok, responseError(detail));
    const noteWasInserted = (unwrap(detail.body)?.internal_notes || []).some(
      (note) => note.note_text === noteText
    );
    const restored = await adminRequest(
      `/song-thanh/contacts/${context.primaryContactId}/restore`,
      { method: 'POST', body: {} }
    );
    assert(restored.ok, responseError(restored));

    assert(waitedForLock, 'contact note did not wait for the held row lock');
    assertError(response, 409, 'CONTACT_CONFLICT');
    assert(!noteWasInserted, 'contact note was inserted after archive won the race');
    return { waited_for_lock: waitedForLock, response: errorEvidence(response) };
  } finally {
    if (transactionOpen) await database.query('ROLLBACK').catch(() => undefined);
    await database.end();
  }
});

await runCase('CRM-CONTACT-DATE-BOUNDARIES', 'Contact date filters validate calendar days and include the full local day', async () => {
  const detail = await adminRequest(
    `/song-thanh/contacts/${context.primaryContactId}`
  );
  assert(detail.ok, responseError(detail));
  const createdAt = unwrap(detail.body)?.contact?.created_at;
  const localDate = localDateInSaigon(createdAt);
  const sameDay = await adminRequest(
    `/song-thanh/contacts?created_from=${localDate}&created_to=${localDate}&page=1&page_size=100`
  );
  assert(sameDay.ok, responseError(sameDay));
  assert(
    extractItems(unwrap(sameDay.body)).some(
      (item) => item.id === context.primaryContactId
    ),
    'same-day range excluded the contact'
  );
  assert(
    unwrap(sameDay.body)?.filters?.created_from === localDate &&
      unwrap(sameDay.body)?.filters?.created_to === localDate,
    'date filters did not echo normalized local dates'
  );

  const impossible = await adminRequest(
    '/song-thanh/contacts?created_from=2026-02-30'
  );
  assert(impossible.status === 400, `impossible date returned ${impossible.status}`);
  const reversed = await adminRequest(
    '/song-thanh/contacts?created_from=2026-07-31&created_to=2026-07-30'
  );
  assert(reversed.status === 400, `reversed date range returned ${reversed.status}`);
  return {
    local_date: localDate,
    impossible_status: impossible.status,
    reversed_status: reversed.status
  };
});

await runCase('CRM-CONTACT-LIFECYCLE', 'Archived contacts reject mutations and restore exactly once', async () => {
  const activeDelete = await adminRequest(
    `/song-thanh/contacts/${context.primaryContactId}/permanent`,
    { method: 'DELETE' }
  );
  assert(activeDelete.status === 409, `active permanent delete returned ${activeDelete.status}`);

  const archived = await adminRequest(
    `/song-thanh/contacts/${context.primaryContactId}/archive`,
    { method: 'POST', body: {} }
  );
  assert(archived.ok, responseError(archived));
  const mutate = await adminRequest(
    `/song-thanh/contacts/${context.primaryContactId}/status`,
    { method: 'PUT', body: { status: 'in_progress' } }
  );
  assert(mutate.status === 409, `archived mutation returned ${mutate.status}`);
  const duplicateArchive = await adminRequest(
    `/song-thanh/contacts/${context.primaryContactId}/archive`,
    { method: 'POST', body: {} }
  );
  assert(duplicateArchive.status === 409, `duplicate archive returned ${duplicateArchive.status}`);

  const restored = await adminRequest(
    `/song-thanh/contacts/${context.primaryContactId}/restore`,
    { method: 'POST', body: {} }
  );
  assert(restored.ok, responseError(restored));
  const duplicateRestore = await adminRequest(
    `/song-thanh/contacts/${context.primaryContactId}/restore`,
    { method: 'POST', body: {} }
  );
  assert(duplicateRestore.status === 409, `duplicate restore returned ${duplicateRestore.status}`);
  return {
    active_delete: activeDelete.status,
    archived_mutation: mutate.status,
    duplicate_archive: duplicateArchive.status,
    duplicate_restore: duplicateRestore.status
  };
});

await runCase('CRM-QUOTE-ASSIGNEE-NOTE', 'Quote assignment and notes retain the standalone admin identity', async () => {
  const assigned = await adminRequest(
    `/song-thanh/quotes/${context.quoteId}/assignee`,
    { method: 'PUT', body: { assigned_to: context.logicUserId } }
  );
  assert(assigned.ok, responseError(assigned));
  const assignedQuote = unwrap(assigned.body)?.quote;
  assert(assignedQuote?.assigned_to === context.logicUserId, 'quote assignee id is missing');
  assert(
    assignedQuote?.assigned_to_label === context.logicUserLabel,
    'quote assignee label is missing'
  );

  const oversized = await adminRequest(
    `/song-thanh/quotes/${context.quoteId}/internal-notes`,
    { method: 'POST', body: { note_text: 'N'.repeat(10_001) } }
  );
  assert(oversized.status === 400, `oversized quote note returned ${oversized.status}`);

  const noteText = `CRM quote note ${RUN_ID}`;
  const noted = await adminRequest(
    `/song-thanh/quotes/${context.quoteId}/internal-notes`,
    { method: 'POST', body: { note_text: noteText } }
  );
  assert(noted.ok, responseError(noted));
  const note = (unwrap(noted.body)?.internal_notes || []).find(
    (item) => item.note_text === noteText
  );
  assert(note?.added_by === context.logicUserId, 'quote note actor id is missing');
  assert(
    note?.added_by_label === context.logicUserLabel,
    'quote note actor label is missing'
  );
  return {
    assigned_to: assignedQuote.assigned_to,
    note_id: note.id,
    note_added_by: note.added_by
  };
});

await runCase('CRM-QUOTE-ARCHIVE-STATUS-RACE', 'A status update queued behind archive cannot mutate an archived quote', async () => {
  const before = await adminRequest(`/song-thanh/quotes/${context.quoteId}`);
  assert(before.ok, responseError(before));
  const originalStatus = unwrap(before.body)?.quote?.status;
  const database = createDatabaseClient();
  await database.connect();
  let transactionOpen = false;
  try {
    await database.query('BEGIN');
    transactionOpen = true;
    await database.query(
      'SELECT id FROM quote_request WHERE id = $1 FOR UPDATE',
      [context.quoteId]
    );

    let settled = false;
    const pendingStatus = adminRequest(
      `/song-thanh/quotes/${context.quoteId}/status`,
      { method: 'PUT', body: { status: 'in_progress' } }
    ).finally(() => {
      settled = true;
    });
    await delay(350);
    const waitedForLock = !settled;

    await database.query(
      'UPDATE quote_request SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [context.quoteId]
    );
    await database.query('COMMIT');
    transactionOpen = false;

    const response = await pendingStatus;
    const detail = await adminRequest(`/song-thanh/quotes/${context.quoteId}`);
    assert(detail.ok, responseError(detail));
    const storedStatus = unwrap(detail.body)?.quote?.status;
    const restored = await adminRequest(
      `/song-thanh/quotes/${context.quoteId}/restore`,
      { method: 'POST', body: {} }
    );
    assert(restored.ok, responseError(restored));

    assert(waitedForLock, 'quote status update did not wait for the held row lock');
    assertError(response, 409, 'QUOTE_CONFLICT');
    assert(storedStatus === originalStatus, 'quote status changed after archive won the race');
    return {
      waited_for_lock: waitedForLock,
      response: errorEvidence(response),
      stored_status: storedStatus
    };
  } finally {
    if (transactionOpen) await database.query('ROLLBACK').catch(() => undefined);
    await database.end();
  }
});

await runCase('CRM-QUOTE-ASSIGNEE-BOUNDS', 'Unknown, fractional, and overflowing quote assignee ids are rejected', async () => {
  const unknown = await unusedAssigneeId();
  const missing = await adminRequest(
    `/song-thanh/quotes/${context.quoteId}/assignee`,
    { method: 'PUT', body: { assigned_to: unknown } }
  );
  assertError(missing, 404, 'NOT_FOUND');

  const fractional = await adminRequest(
    `/song-thanh/quotes/${context.quoteId}/assignee`,
    { method: 'PUT', body: { assigned_to: 1.5 } }
  );
  assert(fractional.status === 400, `fractional assignee returned ${fractional.status}`);
  const overflow = await adminRequest(
    `/song-thanh/quotes/${context.quoteId}/assignee`,
    { method: 'PUT', body: { assigned_to: MAX_LOGIC_USER_ID + 1 } }
  );
  assert(overflow.status === 400, `overflow assignee returned ${overflow.status}`);
  return {
    unknown: errorEvidence(missing),
    fractional_status: fractional.status,
    overflow_status: overflow.status
  };
});

await runCase('CRM-QUOTE-STATUS-FILTER', 'Quote status updates and combined assignee/product filters agree', async () => {
  const invalid = await adminRequest(
    `/song-thanh/quotes/${context.quoteId}/status`,
    { method: 'PUT', body: { status: 'paid' } }
  );
  assert(invalid.status === 400, `unsupported quote status returned ${invalid.status}`);
  const updated = await adminRequest(
    `/song-thanh/quotes/${context.quoteId}/status`,
    { method: 'PUT', body: { status: 'in_progress' } }
  );
  assert(updated.ok, responseError(updated));

  const params = new URLSearchParams({
    assigned_to: String(context.logicUserId),
    product_group_id: context.productGroupId,
    product_variant_id: context.productVariantId,
    status: 'in_progress',
    page: '1',
    page_size: '100'
  });
  const filtered = await adminRequest(`/song-thanh/quotes?${params.toString()}`);
  assert(filtered.ok, responseError(filtered));
  assert(
    extractItems(unwrap(filtered.body)).some((item) => item.id === context.quoteId),
    'combined quote filters excluded the matching quote'
  );
  return { invalid_status: invalid.status, stored_status: 'in_progress' };
});

await runCase('CRM-CUSTOMER-DELETE-SOURCE-RACE', 'Permanent deletion rechecks sources committed while waiting for the customer lock', async () => {
  const created = await adminRequest('/song-thanh/customers', {
    method: 'POST',
    body: {
      full_name: `CRM delete race ${RUN_ID}`,
      phone: `07${RUN_ID.slice(-8)}`,
      email: `crm.delete.race.${RUN_ID}@example.com`,
      company_name: 'CRM race QA'
    }
  });
  assert(created.status === 201, responseError(created));
  const customerId = String(unwrap(created.body)?.customer?.id || '');
  assert(customerId, 'delete-race customer id is missing');
  context.customerIds.push(customerId);
  const archived = await adminRequest(`/song-thanh/customers/${customerId}/archive`, {
    method: 'POST',
    body: {}
  });
  assert(archived.ok, responseError(archived));

  const database = createDatabaseClient();
  await database.connect();
  let transactionOpen = false;
  try {
    await database.query('BEGIN');
    transactionOpen = true;
    await database.query(
      'SELECT id FROM customer_profile WHERE id = $1 FOR UPDATE',
      [customerId]
    );

    let settled = false;
    const pendingDelete = adminRequest(
      `/song-thanh/customers/${customerId}/permanent`,
      { method: 'DELETE' }
    ).finally(() => {
      settled = true;
    });
    await delay(350);
    const waitedForLock = !settled;

    const inserted = await database.query(
      `INSERT INTO contact_request
        (full_name, phone, email, company_name, message, source_page, customer_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        `CRM delete race ${RUN_ID}`,
        `07${RUN_ID.slice(-8)}`,
        `crm.delete.race.${RUN_ID}@example.com`,
        'CRM race QA',
        'Source committed while permanent delete is waiting',
        '/qa/crm/customer-delete-race',
        customerId
      ]
    );
    const contactId = String(inserted.rows[0]?.id || '');
    assert(contactId, 'delete-race contact id is missing');
    context.contactIds.push(contactId);
    await database.query('COMMIT');
    transactionOpen = false;

    const response = await pendingDelete;
    const contactDetail = await adminRequest(`/song-thanh/contacts/${contactId}`);
    assert(contactDetail.ok, responseError(contactDetail));
    const linkedCustomerId = String(
      unwrap(contactDetail.body)?.contact?.customer_id || ''
    );

    assert(waitedForLock, 'permanent delete did not wait for the held customer lock');
    assertError(response, 409, 'CUSTOMER_PERMANENT_DELETE_BLOCKED');
    assert(
      Number(errorDetails(response)?.contacts || 0) === 1,
      'delete guard did not count the source committed during the race'
    );
    assert(linkedCustomerId === customerId, 'the racing contact lost its customer link');
    return {
      waited_for_lock: waitedForLock,
      response: errorEvidence(response),
      contact_id: contactId
    };
  } finally {
    if (transactionOpen) await database.query('ROLLBACK').catch(() => undefined);
    await database.end();
  }
});

await runCase('CRM-CUSTOMER-DELETE-GUARD', 'Customer permanent deletion is blocked while active source records exist', async () => {
  const activeDelete = await adminRequest(
    `/song-thanh/customers/${context.primaryCustomerId}/permanent`,
    { method: 'DELETE' }
  );
  assert(activeDelete.status === 409, `active customer delete returned ${activeDelete.status}`);
  const archived = await adminRequest(
    `/song-thanh/customers/${context.primaryCustomerId}/archive`,
    { method: 'POST', body: {} }
  );
  assert(archived.ok, responseError(archived));
  const blocked = await adminRequest(
    `/song-thanh/customers/${context.primaryCustomerId}/permanent`,
    { method: 'DELETE' }
  );
  assertError(blocked, 409, 'CUSTOMER_PERMANENT_DELETE_BLOCKED');
  const details = errorDetails(blocked);
  assert(
    Number(details?.contacts || 0) > 0 && Number(details?.quotes || 0) > 0,
    'customer delete guard did not report both active source kinds'
  );
  const restored = await adminRequest(
    `/song-thanh/customers/${context.primaryCustomerId}/restore`,
    { method: 'POST', body: {} }
  );
  assert(restored.ok, responseError(restored));
  return errorEvidence(blocked);
});

await runCase('CRM-CLEANUP', 'CRM fixtures and generated customer profiles are fully removed', async () => {
  const removed = { contacts: [], quotes: [], customers: [] };
  for (const id of context.contactIds) {
    if (await archiveAndDelete('contacts', id)) removed.contacts.push(id);
  }
  for (const id of context.quoteIds) {
    if (await archiveAndDelete('quotes', id)) removed.quotes.push(id);
  }
  for (const id of [...new Set(context.customerIds)]) {
    if (await archiveAndDelete('customers', id)) removed.customers.push(id);
  }
  assert(
    removed.contacts.length === context.contactIds.length,
    'not every contact fixture was removed'
  );
  assert(
    removed.quotes.length === context.quoteIds.length,
    'not every quote fixture was removed'
  );
  assert(
    removed.customers.length === new Set(context.customerIds).size,
    'not every customer fixture was removed'
  );
  return removed;
});

finish();

async function unusedAssigneeId() {
  const response = await adminRequest('/song-thanh/contacts?page=1&page_size=1');
  assert(response.ok, responseError(response));
  const used = new Set(
    (unwrap(response.body)?.assignee_options || []).map((option) => Number(option.id))
  );
  let candidate = MAX_LOGIC_USER_ID;
  while (used.has(candidate) && candidate > 0) candidate -= 1;
  assert(candidate > 0, 'no unused assignee id is available');
  return candidate;
}

async function archiveAndDelete(domain, id) {
  const detail = await adminRequest(`/song-thanh/${domain}/${id}`);
  if (detail.status === 404) return true;
  assert(detail.ok, responseError(detail));
  const entityKey =
    domain === 'contacts' ? 'contact' : domain === 'quotes' ? 'quote' : 'customer';
  if (!unwrap(detail.body)?.[entityKey]?.deleted_at) {
    const archived = await adminRequest(`/song-thanh/${domain}/${id}/archive`, {
      method: 'POST',
      body: {}
    });
    assert(archived.ok, responseError(archived));
  }
  const deleted = await adminRequest(`/song-thanh/${domain}/${id}/permanent`, {
    method: 'DELETE'
  });
  assert(deleted.ok, responseError(deleted));
  return true;
}

function createDatabaseClient() {
  return new PostgresClient({
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: Number(process.env.DATABASE_PORT || 5432),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres'
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function runCase(id, title, action) {
  const started = Date.now();
  try {
    const evidence = await withTimeout(
      Promise.resolve().then(action),
      Number(process.env.CRM_QA_CASE_TIMEOUT_MS || 25000),
      `${id} timed out`
    );
    results.push({
      id,
      title,
      status: 'PASS',
      duration_ms: Date.now() - started,
      evidence
    });
  } catch (error) {
    results.push({
      id,
      title,
      status: 'FAIL',
      duration_ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function request(pathname, options = {}) {
  const headers = {
    Accept: 'application/json',
    'X-Forwarded-For': QA_CLIENT_IP,
    ...(options.headers || {})
  };
  if (typeof options.body !== 'undefined') headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API_BASE_URL}${pathname}`, {
    method: options.method || 'GET',
    headers,
    body:
      typeof options.body === 'undefined'
        ? undefined
        : JSON.stringify(options.body)
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: response.ok, status: response.status, body };
}

function adminRequest(pathname, options = {}) {
  return request(pathname, {
    ...options,
    headers: {
      Authorization: `Bearer ${context.accessToken}`,
      ...(options.headers || {})
    }
  });
}

function unwrap(body) {
  return body && typeof body === 'object' && 'data' in body ? body.data : body;
}

function extractItems(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function errorObject(response) {
  return response?.body?.error ?? unwrap(response?.body)?.error ?? null;
}

function errorCode(response) {
  return errorObject(response)?.code ?? null;
}

function errorDetails(response) {
  return errorObject(response)?.details ?? null;
}

function errorEvidence(response) {
  return {
    status: response.status,
    code: errorCode(response),
    details: errorDetails(response)
  };
}

function assertError(response, expectedStatus, expectedCode) {
  assert(
    response.status === expectedStatus,
    `expected ${expectedStatus}/${expectedCode}, received ${response.status}/${errorCode(response)}: ${responseError(response)}`
  );
  assert(
    errorCode(response) === expectedCode,
    `expected error ${expectedCode}, received ${errorCode(response)}`
  );
}

function responseError(response) {
  const error = errorObject(response);
  return `${response.status}: ${error?.code || 'REQUEST_FAILED'} - ${
    error?.message || JSON.stringify(response.body)
  }`;
}

function localDateInSaigon(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertSafeTarget() {
  const hostname = new URL(API_BASE_URL).hostname;
  assert(
    ['localhost', '127.0.0.1', '::1'].includes(hostname),
    `refusing non-local API target ${API_BASE_URL}`
  );
  const databaseName = String(process.env.DATABASE_NAME || '');
  assert(
    /^[A-Za-z0-9_]+_qa_[0-9]{14}$/.test(databaseName),
    `refusing mutation because DATABASE_NAME is not an isolated timestamped QA database: ${databaseName || '(unset)'}`
  );
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function finish() {
  mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  const lines = [
    '# CRM-domain invariant QA last run',
    '',
    `Run id: \`${RUN_ID}\``,
    `Date: \`${new Date().toISOString()}\``,
    `Target: \`${API_BASE_URL}\``,
    `Database: \`${process.env.DATABASE_NAME}\``,
    '',
    '| Case | Result | Duration | Evidence |',
    '| --- | --- | ---: | --- |'
  ];
  for (const result of results) {
    lines.push(
      `| ${result.id} — ${escapeTable(result.title)} | ${result.status} | ${result.duration_ms}ms | ${escapeTable(
        result.status === 'PASS' ? compact(result.evidence) : result.error
      )} |`
    );
  }
  const failed = results.filter((result) => result.status === 'FAIL');
  lines.push(
    '',
    `Result: **${results.length - failed.length}/${results.length} passed; ${failed.length} failed.**`,
    '',
    'Data impact: fixtures are created only in an isolated timestamped QA database. CRM-CLEANUP permanently removes the test contacts, quote, notes, quote items, and generated customer profiles before downstream suites.',
    '',
    'Generated by `node scripts/qa/crm-domain-invariants-smoke.mjs`.'
  );
  writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');

  console.log(`\nCRM-domain invariant QA run ${RUN_ID}`);
  for (const result of results) {
    console.log(
      `${result.status} ${result.id} ${result.title} (${result.duration_ms} ms)${
        result.error ? ` - ${result.error}` : ''
      }`
    );
  }
  console.log(`Report: ${REPORT_PATH}`);
  console.log(
    `Summary: ${results.length - failed.length}/${results.length} passed, ${failed.length} failed`
  );
  if (failed.length > 0) process.exitCode = 1;
}

function compact(value) {
  if (!value) return '';
  const text = JSON.stringify(value);
  return text.length > 360 ? `${text.slice(0, 357)}...` : text;
}

function escapeTable(value) {
  return String(value || '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}
