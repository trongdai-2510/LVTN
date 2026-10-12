import { expect, test } from '@playwright/test';

import {
  evaluateProductReadiness,
  getProductReadinessContext
} from '../../src/features/product-domain/productReadiness';
import {
  buildBusinessPayload,
  businessFormFromRecord,
  createBusinessForm,
  validateBusinessForm
} from '../../src/features/product-domain/businessForm';
import {
  buildDisplayStatusPayload,
  optimisticVersionPayload
} from '../../src/features/product-domain/businessStatus';
import {
  buildBusinessListHref,
  defaultBusinessListFilters,
  parseBusinessListFilters,
  parsePageSize,
  parsePositivePage,
  sanitizeReturnTo
} from '../../src/features/product-domain/businessListFilters';

const readyGroup = {
  id: 'product-group-1',
  name: 'Cáp điện lực',
  slug: 'cap-dien-luc',
  category_id: 'category-2',
  category_level_1_id: 'category-1',
  category_level_2_id: 'category-2',
  category_level_1_name: 'Dây dẫn',
  category_level_2_name: 'Cáp điện',
  brand_id: 'brand-1',
  brand_name: 'CADIVI',
  short_description: 'Cáp điện lực dùng cho công trình dân dụng và công nghiệp.',
  detailed_description: '<p>Thông tin kỹ thuật đầy đủ.</p>',
  thumbnail_file_id: 'file-1',
  seo_title: 'Cáp điện lực CADIVI',
  seo_description: 'Tra cứu cáp điện lực CADIVI theo thông số kỹ thuật.',
  status: 'active',
  review_status: 'approved',
  publish_status: 'published',
  deleted_at: null,
  public_price_summary: {
    display_mode: 'contact_for_quote',
    public_variant_count: 2
  }
};

const readyDependencies = {
  active_variants: 2,
  active_documents: 1,
  active_images: 3,
  active_service_relations: 1,
  active_project_relations: 1,
  active_quote_items: 2
};

test('a complete published product is ready and exposes every affected destination', () => {
  const readiness = evaluateProductReadiness(readyGroup, readyDependencies);
  const context = getProductReadinessContext(readyGroup, readyDependencies);

  expect(readiness.lane).toBe('published');
  expect(readiness.blockingIssues).toEqual([]);
  expect(readiness.warningIssues).toEqual([]);
  expect(readiness.dataIssues).toEqual([]);
  expect(readiness.publicationIssues).toEqual([]);
  expect(readiness.workflowIssues).toEqual([]);
  expect(readiness.qualityIssues).toEqual([]);
  expect(readiness.catalogIssues).toEqual([]);
  expect(readiness.isPublic).toBe(true);
  expect(context.destinations.map((item) => item.code)).toEqual([
    'product_detail',
    'product_search',
    'category_listing',
    'service_relations',
    'project_relations',
    'quote_history'
  ]);
});

test('required identity and classification fields use the same hard boundaries as the backend', () => {
  const readiness = evaluateProductReadiness(
    {
      ...readyGroup,
      name: ' ',
      slug: 'Cáp Điện',
      category_id: '',
      category_level_1_id: null,
      category_level_2_id: null,
      thumbnail_file_id: null,
      short_description: null,
      publish_status: 'unpublished'
    },
    readyDependencies
  );

  expect(readiness.blockingIssues.map((issue) => issue.code)).toEqual([
    'product_name_missing',
    'product_slug_invalid',
    'product_category_missing',
    'product_thumbnail_missing',
    'product_short_description_missing'
  ]);
  expect(readiness.dataIssues.map((issue) => issue.code)).toEqual([
    'product_name_missing',
    'product_slug_invalid',
    'product_category_missing'
  ]);
  expect(readiness.publicationIssues.map((issue) => issue.code)).toEqual([
    'product_thumbnail_missing',
    'product_short_description_missing'
  ]);
  expect(readiness.canPublish).toBe(false);
});

test('text limits accept the exact backend maximum and reject the first value beyond it', () => {
  const exactBoundary = evaluateProductReadiness(
    {
      ...readyGroup,
      name: 'n'.repeat(255),
      slug: 's'.repeat(255),
      seo_title: 't'.repeat(255),
      seo_description: 'd'.repeat(512)
    },
    readyDependencies
  );
  expect(exactBoundary.blockingIssues).toEqual([]);

  const beyondBoundary = evaluateProductReadiness(
    {
      ...readyGroup,
      name: 'n'.repeat(256),
      slug: 's'.repeat(256),
      seo_title: 't'.repeat(256),
      seo_description: 'd'.repeat(513)
    },
    readyDependencies
  );
  expect(beyondBoundary.blockingIssues.map((issue) => issue.code)).toEqual([
    'product_name_too_long',
    'product_slug_invalid',
    'product_seo_title_too_long',
    'product_seo_description_too_long'
  ]);
});

test('workflow states gate publishing without being mislabeled as broken product data', () => {
  const readiness = evaluateProductReadiness(
    {
      ...readyGroup,
      status: 'inactive',
      review_status: 'draft'
    },
    readyDependencies
  );

  expect(readiness.lane).toBe('inactive');
  expect(readiness.blockingIssues.map((issue) => issue.code)).toEqual([
    'product_publish_requires_active',
    'product_publish_requires_approval'
  ]);
  expect(readiness.dataIssues).toEqual([]);
  expect(readiness.publicationIssues).toEqual([]);
  expect(readiness.workflowIssues.map((issue) => issue.code)).toEqual([
    'product_publish_requires_active',
    'product_publish_requires_approval'
  ]);
  expect(readiness.catalogIssues).toEqual([]);
  expect(readiness.isPublic).toBe(false);
});

test('archive and soft delete remain recoverable but never public', () => {
  for (const group of [
    { ...readyGroup, publish_status: 'archived' },
    { ...readyGroup, deleted_at: '2026-08-10T00:00:00.000Z' }
  ]) {
    const readiness = evaluateProductReadiness(group, readyDependencies);
    expect(readiness.lane).toBe('archived');
    expect(readiness.isPublic).toBe(false);
    expect(readiness.blockingIssues.some((issue) => issue.code === 'product_archived')).toBe(true);
    expect(readiness.workflowIssues.some((issue) => issue.code === 'product_archived')).toBe(true);
    expect(readiness.catalogIssues).toEqual([]);
  }
});

test('missing variants, gallery, documents and SEO are explicit quality warnings rather than invented publish blockers', () => {
  const readiness = evaluateProductReadiness(
    {
      ...readyGroup,
      publish_status: 'unpublished',
      seo_title: null,
      seo_description: null,
      public_price_summary: {
        display_mode: 'contact_for_quote',
        public_variant_count: 0
      }
    },
    {
      ...readyDependencies,
      active_variants: 0,
      active_documents: 0,
      active_images: 0
    }
  );

  expect(readiness.blockingIssues).toEqual([]);
  expect(readiness.warningIssues.map((issue) => issue.code)).toEqual([
    'product_variant_missing',
    'product_gallery_missing',
    'product_document_missing',
    'product_seo_title_missing',
    'product_seo_description_missing'
  ]);
  expect(readiness.qualityIssues).toEqual(readiness.warningIssues);
  expect(readiness.catalogIssues).toEqual([]);
  expect(readiness.canPublish).toBe(true);
});

test('existing variants with none public are distinguished from a product with no variants', () => {
  const readiness = evaluateProductReadiness(
    {
      ...readyGroup,
      publish_status: 'unpublished',
      public_price_summary: {
        display_mode: 'contact_for_quote',
        public_variant_count: 0
      }
    },
    readyDependencies
  );

  expect(readiness.warningIssues.map((issue) => issue.code)).toContain(
    'product_variant_not_public'
  );
  expect(readiness.warningIssues.map((issue) => issue.code)).not.toContain(
    'product_variant_missing'
  );
});

test('a list projection never invents a zero public-variant count when that field was not loaded', () => {
  const readiness = evaluateProductReadiness(
    {
      ...readyGroup,
      publish_status: 'unpublished',
      public_price_summary: undefined
    },
    readyDependencies
  );

  expect(readiness.qualityIssues.map((issue) => issue.code)).not.toContain(
    'product_variant_not_public'
  );
});

test('a currently public legacy record stays in the public lane when it only lacks a republish requirement', () => {
  const readiness = evaluateProductReadiness(
    {
      ...readyGroup,
      short_description: null
    },
    readyDependencies
  );

  expect(readiness.isPublic).toBe(true);
  expect(readiness.lane).toBe('published');
  expect(readiness.dataIssues).toEqual([]);
  expect(readiness.publicationIssues.map((issue) => issue.code)).toEqual([
    'product_short_description_missing'
  ]);
  expect(readiness.catalogIssues).toEqual(readiness.publicationIssues);
});

test('optional quality suggestions do not inflate the required-work count shown in the catalogue', () => {
  const readiness = evaluateProductReadiness(
    {
      ...readyGroup,
      seo_title: null,
      seo_description: null
    },
    {
      ...readyDependencies,
      active_documents: 0
    }
  );

  expect(readiness.qualityIssues.map((issue) => issue.code)).toEqual([
    'product_document_missing',
    'product_seo_title_missing',
    'product_seo_description_missing'
  ]);
  expect(readiness.catalogIssues).toEqual([]);
});

test('evaluation is deterministic and does not mutate the API records', () => {
  const group = structuredClone(readyGroup);
  const dependencies = structuredClone(readyDependencies);
  const originalGroup = structuredClone(group);
  const originalDependencies = structuredClone(dependencies);

  expect(evaluateProductReadiness(group, dependencies)).toEqual(
    evaluateProductReadiness(group, dependencies)
  );
  expect(group).toEqual(originalGroup);
  expect(dependencies).toEqual(originalDependencies);
});

test('business form helpers keep API conversion and validation in one boundary', () => {
  const emptyForm = createBusinessForm('productGroup');
  expect(validateBusinessForm('productGroup', emptyForm).map((issue) => issue.field)).toEqual([
    'name',
    'category_level_1_id',
    'category_id'
  ]);

  const form = businessFormFromRecord('productGroup', readyGroup);
  expect(validateBusinessForm('productGroup', form)).toEqual([]);
  expect(buildBusinessPayload('productGroup', form)).toMatchObject({
    name: readyGroup.name,
    slug: readyGroup.slug,
    category_id: readyGroup.category_level_2_id,
    brand_id: readyGroup.brand_id,
    publish_status: 'published'
  });
  const editorPayload = buildBusinessPayload('productGroup', form, false);
  expect(editorPayload).not.toHaveProperty('review_status');
  expect(editorPayload).not.toHaveProperty('publish_status');
});

test('variant price validation and status payloads retain their existing rules', () => {
  const form = {
    ...createBusinessForm('productVariant'),
    product_group_id: readyGroup.id,
    variant_name: 'DN15',
    public_price_mode: 'public_price',
    public_price_amount: '0'
  };

  expect(validateBusinessForm('productVariant', form)).toEqual([
    {
      field: 'public_price_amount',
      message: 'Giá công khai phải là số nguyên từ 1 đến 2.147.483.647 đồng.'
    }
  ]);
  for (const invalidAmount of ['1.5', '2147483648', 'NaN']) {
    expect(validateBusinessForm('productVariant', {
      ...form,
      public_price_amount: invalidAmount
    })).toEqual([{
      field: 'public_price_amount',
      message: 'Giá công khai phải là số nguyên từ 1 đến 2.147.483.647 đồng.'
    }]);
  }
  expect(validateBusinessForm('productVariant', {
    ...form,
    public_price_amount: '2147483647'
  })).toEqual([]);
  expect(buildDisplayStatusPayload('submit-review')).toEqual({
    review_status: 'pending_review',
    publish_status: 'unpublished'
  });
  expect(optimisticVersionPayload('productVariant', { updated_at: '2026-09-15' })).toEqual({
    expected_updated_at: '2026-09-15'
  });
});

test('product list navigation preserves supported pagination and rejects invalid URL state', () => {
  expect(parsePositivePage('2')).toBe(2);
  expect(parsePositivePage('0')).toBe(1);
  expect(parsePositivePage('1.5')).toBe(1);
  expect(parsePageSize('20')).toBe(20);
  expect(parsePageSize('100')).toBe(100);
  expect(parsePageSize('21')).toBe(20);

  const invalidScope = parseBusinessListFilters(
    new URLSearchParams('deleted_scope=unexpected'),
    'productGroup'
  );
  expect(invalidScope.deleted_scope).toBe('active');

  const href = buildBusinessListHref(
    'productGroup',
    '/admin/product-groups',
    '',
    defaultBusinessListFilters(),
    3,
    100,
    { categories: [], brands: [], productGroups: [], productVariants: [] }
  );
  expect(href).toBe('/admin/product-groups?deleted_scope=active&page=3&page_size=100');
});

test('product return navigation accepts only safe site-relative paths', () => {
  expect(sanitizeReturnTo(' /admin/product-groups?page=2 ')).toBe(
    '/admin/product-groups?page=2'
  );
  expect(sanitizeReturnTo('//example.com/steal-session')).toBeNull();
  expect(sanitizeReturnTo('/\\example.com/steal-session')).toBeNull();
  expect(sanitizeReturnTo('https://example.com')).toBeNull();
});
