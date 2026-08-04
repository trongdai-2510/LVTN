import 'reflect-metadata';

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { sanitizeRichTextHtml, sanitizeSvgMarkup } from '../../src/common/sanitize/html-sanitizer';
import { slugifyText, resolveAvailableSlug } from '../../src/common/text/slugify-text';
import {
  localDateToUtcBoundary,
  normalizeOptionalLocalDate
} from '../../src/common/validation/date-filter';
import { createValidationPipe } from '../../src/common/validation/validation';
import { ApiErrorFilter } from '../../src/common/errors/error.filter';
import { PageContentListQueryDto } from '../../src/modules/page-content/page-content.dto';
import {
  normalizeRedirectType,
  normalizeRequiredPath
} from '../../src/modules/redirect/redirect.guardrails';
import { slugify as slugifyImportValue } from '../../src/modules/import-workspace/import-workspace.guardrails';
import { normalizeWorkbookHeader } from '../../src/modules/import-workspace/import-column-mapping';

test('Vietnamese slug normalization preserves đ/Đ as d', () => {
  assert.equal(slugifyText('Điện Áp Hạ Thế'), 'dien-ap-ha-the');
  assert.equal(slugifyText('đèn LED Ốp Trần'), 'den-led-op-tran');
  assert.equal(slugifyImportValue('Động cơ điện'), 'dong-co-dien');
});

test('slug normalization is deterministic at punctuation and empty boundaries', () => {
  assert.equal(slugifyText('  A---B / C  '), 'a-b-c');
  assert.equal(slugifyText('🎯'), 'item');
  assert.equal(slugifyText('e\u0302\u0323'), slugifyText('ệ'));
});

test('available slug increments from 2 without skipping the first free value', async () => {
  const occupied = new Set(['den-led', 'den-led-2', 'den-led-3']);
  assert.equal(
    await resolveAvailableSlug('Đèn LED', async (candidate) => occupied.has(candidate)),
    'den-led-4'
  );
});

test('workbook header normalization is accent-insensitive including đ', () => {
  assert.equal(normalizeWorkbookHeader('Mã Điện Áp'), 'ma dien ap');
  assert.equal(normalizeWorkbookHeader('  ĐƯỜNG_KÍNH  '), 'duong kinh');
});

test('rich text sanitizer removes executable markup and unsafe URLs', () => {
  const sanitized = sanitizeRichTextHtml(
    '<p onclick="alert(1)">OK<script>alert(2)</script>' +
      '<a href="javascript:alert(3)" target="_blank">bad</a>' +
      '<img src="data:text/html;base64,PHNjcmlwdD4=" onerror="alert(4)"></p>'
  );

  assert.ok(sanitized?.includes('<p>OK'));
  assert.ok(!sanitized?.includes('<script'));
  assert.ok(!sanitized?.includes('onclick'));
  assert.ok(!sanitized?.includes('javascript:'));
  assert.ok(!sanitized?.includes('data:text/html'));
  assert.ok(!sanitized?.includes('onerror'));
  assert.ok(sanitized?.includes('rel="noopener noreferrer nofollow"'));
});

test('SVG sanitizer strips script, event handlers, foreignObject and unsafe href', () => {
  const sanitized = sanitizeSvgMarkup(
    '<svg viewBox="0 0 10 10" onload="alert(1)">' +
      '<script>alert(2)</script><foreignObject><p>bad</p></foreignObject>' +
      '<use href="javascript:alert(3)"/><path d="M0 0h1v1z"/></svg>'
  );

  assert.ok(sanitized.includes('<svg'));
  assert.ok(sanitized.includes('<path'));
  assert.ok(!sanitized.includes('onload'));
  assert.ok(!sanitized.includes('<script'));
  assert.ok(!sanitized.includes('foreignObject'));
  assert.ok(!sanitized.includes('javascript:'));
});

test('local date validation accepts leap days and rejects impossible dates', () => {
  assert.equal(normalizeOptionalLocalDate('updated_on', '2024-02-29'), '2024-02-29');
  assert.equal(normalizeOptionalLocalDate('updated_on', ''), null);
  assert.throws(() => normalizeOptionalLocalDate('updated_on', '2023-02-29'));
  assert.throws(() => normalizeOptionalLocalDate('updated_on', '2024-2-29'));
  assert.throws(() => normalizeOptionalLocalDate('updated_on', 20240229));
});

test('local CRM date boundaries include the complete Asia/Saigon day', () => {
  const normalized = normalizeOptionalLocalDate('created_on', '2026-07-30');
  assert.equal(
    localDateToUtcBoundary(normalized, 'start')?.toISOString(),
    '2026-07-29T17:00:00.000Z'
  );
  assert.equal(
    localDateToUtcBoundary(normalized, 'end')?.toISOString(),
    '2026-07-30T16:59:59.999Z'
  );
});

test('query DTO enforces exact positive integer pagination boundaries', async () => {
  const pipe = createValidationPipe();
  const metadata = {
    type: 'query' as const,
    metatype: PageContentListQueryDto,
    data: undefined
  };

  const accepted = await pipe.transform(
    { page: '1', page_size: '100', injected: 'discard-me' },
    metadata
  );
  assert.equal(accepted.page, 1);
  assert.equal(accepted.page_size, 100);
  assert.equal('injected' in accepted, false);

  for (const input of [
    { page: '0' },
    { page: '-1' },
    { page: '1.5' },
    { page: '1abc' },
    { page_size: '0' },
    { page_size: '101' },
    { page_size: '1.5' }
  ]) {
    await assert.rejects(() => pipe.transform(input, metadata));
  }
});

test('redirect type accepts only exact 301/302 values', () => {
  assert.equal(normalizeRedirectType(301), 301);
  assert.equal(normalizeRedirectType('302'), 302);
  for (const value of ['301abc', '301.5', 300, 303, '', null]) {
    assert.throws(() => normalizeRedirectType(value));
  }
});

test('redirect paths stay internal and reject ambiguous/path-traversal forms', () => {
  assert.equal(normalizeRequiredPath('from_path', '/san-pham/cu'), '/san-pham/cu');
  assert.equal(
    normalizeRequiredPath('to_path', '/san-pham/moi?ref=legacy'),
    '/san-pham/moi?ref=legacy'
  );

  for (const value of [
    '//evil.example',
    '/\\evil.example',
    '/a/../admin',
    '/a/%2e%2e/admin',
    '/a%2fb',
    '/line\r\nbreak'
  ]) {
    assert.throws(() => normalizeRequiredPath('to_path', value));
  }
  assert.throws(() => normalizeRequiredPath('from_path', '/old?query=1'));
  assert.throws(() => normalizeRequiredPath('from_path', '/old#fragment'));
});

test('database boundary and uniqueness errors become safe 4xx responses', () => {
  const filter = new ApiErrorFilter('production');
  for (const scenario of [
    {
      error: { code: '22001', column: 'name' },
      status: 400,
      code: 'VALIDATION_ERROR'
    },
    {
      error: { code: '23505', constraint: 'uq_example_slug' },
      status: 409,
      code: 'DATA_CONFLICT'
    },
    {
      error: { code: '23503', constraint: 'fk_example_parent' },
      status: 409,
      code: 'DATA_REFERENCE_CONFLICT'
    },
    {
      error: { code: '23514', constraint: 'chk_example_status' },
      status: 400,
      code: 'VALIDATION_ERROR'
    }
  ]) {
    let actualStatus = 0;
    let actualBody: Record<string, any> | null = null;
    const response = {
      status(value: number) {
        actualStatus = value;
        return this;
      },
      json(value: Record<string, any>) {
        actualBody = value;
        return this;
      }
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({ method: 'POST', originalUrl: '/test' })
      })
    };

    filter.catch(scenario.error, host as never);
    const capturedBody = actualBody as {
      error?: { code?: string };
    } | null;
    assert.equal(actualStatus, scenario.status);
    assert.equal(capturedBody?.error?.code, scenario.code);
    assert.ok(!JSON.stringify(actualBody).includes('stack'));
  }
});
