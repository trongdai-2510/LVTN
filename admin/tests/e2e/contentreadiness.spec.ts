import { expect, test } from '@playwright/test';

import {
  evaluateContentReadiness,
  getContentReadinessContext,
  type ContentReadinessInput
} from '../../src/features/website-content/page-content-studio/contentReadiness';
import {
  appendContentFilters,
  contentListFiltersFromSearchParams,
  hasContentFilters,
  parseContentListPage
} from '../../src/features/website-content/contentFilters';

const validApprovedPage: ContentReadinessInput = {
  id: 'page-1',
  title: 'Giới thiệu Song Thanh',
  slug: 'gioi-thieu',
  content_type: 'page',
  content_html: '<p>Nội dung có ý nghĩa.</p>',
  excerpt: 'Mô tả ngắn',
  seo_description: 'Mô tả SEO',
  review_status: 'approved',
  publish_status: 'unpublished',
  deleted_at: null
};

test('content readiness mirrors the backend publish guardrails', () => {
  const readiness = evaluateContentReadiness(validApprovedPage);

  expect(readiness.lifecycleLane).toBe('approved');
  expect(readiness.canPublish).toBe(true);
  expect(readiness.blockingIssues).toHaveLength(0);
  expect(readiness.destinations).toEqual([
    { href: '/gioi-thieu', label: 'Trang trên website', state: 'hidden' }
  ]);
});

test('content readiness exposes blank, invalid and maximum-length boundaries', () => {
  const readiness = evaluateContentReadiness({
    ...validApprovedPage,
    title: ' '.repeat(2),
    slug: `${'a'.repeat(256)}-Sai`,
    content_type: 'unknown',
    content_html: '<p>&nbsp;</p>',
    extra_blocks: { blocks: [] },
    seo_title: 's'.repeat(256),
    seo_description: 'd'.repeat(513)
  });

  expect(readiness.canPublish).toBe(false);
  expect(readiness.blockingIssues.map((issue) => issue.code)).toEqual(
    expect.arrayContaining([
      'content.title.required',
      'content.slug.too_long',
      'content.slug.invalid',
      'content.type.invalid',
      'content.body.required'
    ])
  );
  expect(readiness.warningIssues.map((issue) => issue.code)).toEqual(
    expect.arrayContaining(['content.seo_title.too_long', 'content.seo_description.too_long'])
  );
});

test('content readiness explains every issue without developer terminology', () => {
  const readiness = evaluateContentReadiness({
    ...validApprovedPage,
    title: '',
    slug: '',
    content_html: '',
    seo_description: ''
  });
  const visibleCopy = readiness.issues
    .flatMap((issue) => [issue.title, issue.detail, issue.action.label])
    .join(' ');

  expect(visibleCopy).not.toMatch(/backend|api|guardrail|slug|public/i);
});

test('every editable issue points to a real editor section or control', () => {
  const readiness = evaluateContentReadiness(
    {
      ...validApprovedPage,
      title: '',
      slug: '',
      content_html: '',
      excerpt: '',
      featured_image_file_id: null,
      seo_description: '',
      review_status: 'draft'
    },
    {
      expectExcerpt: true,
      expectFeaturedImage: true,
      expectSeoDescription: true
    }
  );

  expect(Object.fromEntries(readiness.issues.map((item) => [item.code, item.action.target]))).toMatchObject({
    'content.title.required': '#page-content-title',
    'content.slug.required': '#page-content-slug',
    'content.body.required': '#page-section-body',
    'content.excerpt.missing': '#page-content-excerpt',
    'content.featured_image.missing': '#page-section-media',
    'content.seo_description.missing': '#page-content-seo-description',
    'lifecycle.approval.required': '#page-content-lifecycle'
  });
});

test('content list filters parse hostile URL values into safe defaults', () => {
  const filters = contentListFiltersFromSearchParams(
    new URLSearchParams('status=active&deleted_scope=unexpected&position=home')
  );

  expect(filters.deleted_scope).toBe('active');
  expect(filters.status).toBe('active');
  expect(filters.position).toBe('home');
  expect(parseContentListPage('0')).toBe(1);
  expect(parseContentListPage('not-a-number')).toBe(1);
  expect(parseContentListPage('8')).toBe(8);
});

test('content list requests only include filters supported by the selected domain', () => {
  const filters = contentListFiltersFromSearchParams(
    new URLSearchParams(
      'status=active&review_status=approved&publish_status=published&content_type=news&position=home&redirect_type=301&deleted_scope=all'
    )
  );
  const pageParams = new URLSearchParams();
  appendContentFilters(pageParams, 'page-content', filters);

  expect(pageParams.toString()).toBe(
    'deleted_scope=all&content_type=news&review_status=approved&publish_status=published'
  );
  expect(hasContentFilters('page-content', filters)).toBe(true);

  const bannerParams = new URLSearchParams();
  appendContentFilters(bannerParams, 'banner', filters);
  expect(bannerParams.toString()).toBe('deleted_scope=all&status=active&position=home');
});

test('content readiness reports contradictory lifecycle state instead of hiding it', () => {
  const readiness = evaluateContentReadiness({
    ...validApprovedPage,
    review_status: 'draft',
    publish_status: 'published'
  });

  expect(readiness.lifecycleLane).toBe('published');
  expect(readiness.canPublish).toBe(false);
  expect(readiness.blockingIssues.map((issue) => issue.code)).toContain(
    'lifecycle.published_without_approval'
  );
  expect(readiness.destinations[0]?.state).toBe('hidden');
  expect(readiness.issues.find((issue) => issue.code === 'lifecycle.published_without_approval')?.title)
    .toContain('chưa được duyệt');
});

test('content readiness gives archived records precedence and flags impossible public state', () => {
  const readiness = evaluateContentReadiness({
    ...validApprovedPage,
    publish_status: 'published',
    deleted_at: '2026-08-10T00:00:00.000Z'
  });

  expect(readiness.lifecycleLane).toBe('archived');
  expect(readiness.canPublish).toBe(false);
  expect(readiness.blockingIssues.map((issue) => issue.code)).toContain(
    'lifecycle.archived_but_published'
  );
  expect(readiness.destinations[0]?.state).toBe('archived');
});

test('content readiness treats renderable structured blocks as a meaningful body', () => {
  const readiness = evaluateContentReadiness({
    ...validApprovedPage,
    content_html: '',
    extra_blocks: {
      blocks: [
        {
          id: 'block-1',
          type: 'bullet_list',
          items: [{ text: 'Thông tin kỹ thuật' }]
        }
      ]
    }
  });

  expect(readiness.canPublish).toBe(true);
  expect(readiness.blockingIssues.map((issue) => issue.code)).not.toContain(
    'content.body.required'
  );
});

test('product catalog page may publish without editorial copy because catalog data supplies the page', () => {
  const readiness = evaluateContentReadiness(
    {
      ...validApprovedPage,
      slug: 'san-pham',
      content_html: '',
      excerpt: '',
      extra_blocks: { blocks: [] }
    },
    getContentReadinessContext('products')
  );

  expect(readiness.canPublish).toBe(true);
  expect(readiness.blockingIssues.map((issue) => issue.code)).not.toContain('content.body.required');
});

test('news readiness keeps quality gaps visible without inventing publish blockers', () => {
  const readiness = evaluateContentReadiness(
    {
      ...validApprovedPage,
      slug: 'tin-ky-thuat',
      content_type: 'news',
      excerpt: '',
      seo_description: '',
      featured_image_file_id: null,
      news_category_id: null,
      published_at: null
    },
    {
      expectExcerpt: true,
      expectFeaturedImage: true,
      expectSeoDescription: true,
      expectNewsCategory: true,
      expectPublishedAt: true
    }
  );

  expect(readiness.canPublish).toBe(true);
  expect(readiness.destinations[0]?.href).toBe('/tin-tuc/tin-ky-thuat');
  expect(readiness.warningIssues.map((issue) => issue.code)).toEqual(
    expect.arrayContaining([
      'content.excerpt.missing',
      'content.featured_image.missing',
      'content.seo_description.missing',
      'news.category.missing',
      'news.published_at.missing'
    ])
  );
});

test('unfinished template copy is an actionable warning, not an invented publish blocker', () => {
  const readiness = evaluateContentReadiness({
    ...validApprovedPage,
    slug: 'du-an',
    content_html: '<p>Nội dung đang cập nhật. Nội dung intro sẽ hoàn thiện sau.</p>'
  });

  expect(readiness.canPublish).toBe(true);
  expect(readiness.warningIssues).toEqual(expect.arrayContaining([
    expect.objectContaining({
      code: 'content.body.placeholder',
      title: 'Nội dung còn là bản mẫu',
      action: expect.objectContaining({ target: '#page-section-body' })
    })
  ]));
  expect(readiness.warningIssues.find((issue) => issue.code === 'content.body.placeholder')?.detail)
    .toContain('không hiển thị');
});

test('content readiness is deterministic and does not mutate its input', () => {
  const input = {
    ...validApprovedPage,
    extra_blocks: JSON.stringify({ blocks: [] })
  };
  const before = JSON.stringify(input);

  expect(evaluateContentReadiness(input)).toEqual(evaluateContentReadiness(input));
  expect(JSON.stringify(input)).toBe(before);
});
