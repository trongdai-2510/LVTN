import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { CurrentUser } from '../../src/common/auth/auth.types';
import { BrandPageRepository } from '../../src/modules/brand-page/brand-page.repository';
import { BrandPageService } from '../../src/modules/brand-page/brand-page.service';
import { ProductGroupRepository } from '../../src/modules/product-group/product-group.repository';
import { ProductGroupService } from '../../src/modules/product-group/product-group.service';
import { ProductVariantRepository } from '../../src/modules/product-variant/product-variant.repository';
import { ProductVariantService } from '../../src/modules/product-variant/product-variant.service';
import { ProjectRepository } from '../../src/modules/project/project.repository';
import { ProjectService } from '../../src/modules/project/project.service';
import { ServiceRepository } from '../../src/modules/service/service.repository';
import { SongThanhServiceService } from '../../src/modules/service/service.service';

const id = '11111111-1111-4111-8111-111111111111';
const categoryId = '22222222-2222-4222-8222-222222222222';
const fileId = '33333333-3333-4333-8333-333333333333';
const editor: CurrentUser = {
  id: 'editor', email: 'editor@example.test', display_name: 'Editor',
  status: 'active', roles: ['product_admin'], permissions: ['product_group.update', 'product_variant.update']
};
const superAdmin: CurrentUser = { ...editor, id: 'super', roles: ['super_admin'] };

test('product group editor save leaves public approval and enters pending review', async () => {
  const saved: Record<string, unknown>[] = [];
  const current = {
    id, name: 'Old', slug: 'old', category_id: categoryId, brand_id: null,
    short_description: 'Description', detailed_description: null,
    thumbnail_file_id: fileId, seo_title: null, seo_description: null,
    seo_og_image_file_id: null, review_status: 'approved', publish_status: 'published',
    status: 'active', sort_order: 0, deleted_at: null
  };
  const repository = {
    findById: async () => current,
    findCategoryContext: async () => ({
      category_status: 'active', category_deleted_at: null, level_1_id: categoryId,
      level_1_status: 'active', level_1_deleted_at: null, level_1_parent_id: null
    }),
    activeFileExists: async () => true,
    update: async (_id: string, mutation: Record<string, unknown>) => {
      saved.push(mutation);
      return { status: 'updated' };
    },
    findAdminById: async () => current,
    publicPriceSummary: async () => ({}),
    dependencyCounts: async () => ({})
  };
  const service = new ProductGroupService(repository as unknown as ProductGroupRepository);

  await service.updateProductGroup(id, { name: 'New' }, editor);
  assert.equal(saved[0].review_status, 'pending_review');
  assert.equal(saved[0].publish_status, 'unpublished');

  await service.updateProductGroup(id, { name: 'New' }, superAdmin);
  assert.equal(saved[1].review_status, undefined);
  assert.equal(saved[1].publish_status, undefined);
});

test('variant editor save enters review while a Super Admin edit remains public', async () => {
  const saved: Record<string, unknown>[] = [];
  const current = {
    id, product_group_id: id, external_code: null, sku: 'SKU-1', model_code: null,
    variant_name: 'Old', detailed_description: null,
    public_price_mode: 'contact_for_quote', public_price_amount: null,
    review_status: 'approved', publish_status: 'published', status: 'active',
    sort_order: 0, deleted_at: null
  };
  const repository = {
    findById: async () => current,
    activeImageFileExists: async () => true,
    update: async (_id: string, mutation: Record<string, unknown>) => {
      saved.push(mutation);
      return { status: 'updated' };
    },
    findAdminById: async () => current,
    dependencyCounts: async () => ({})
  };
  const groupService = {
    assertProductGroupUsableForBusiness: async () => undefined
  };
  const service = new ProductVariantService(
    repository as unknown as ProductVariantRepository,
    groupService as unknown as ProductGroupService
  );

  await service.updateProductVariant(id, { variant_name: 'New' }, editor);
  assert.equal(saved[0].review_status, 'pending_review');
  assert.equal(saved[0].publish_status, 'unpublished');

  await service.updateProductVariant(id, { variant_name: 'New' }, superAdmin);
  assert.equal(saved[1].review_status, undefined);
  assert.equal(saved[1].publish_status, undefined);

  await service.updateProductVariant(id, { image_file_id: fileId }, editor);
  assert.equal(saved[2].review_status, 'pending_review');
  assert.equal(saved[2].publish_status, 'unpublished');
});

test('brand page editor save enters review while a Super Admin edit remains public', async () => {
  const saved: Record<string, unknown>[] = [];
  const current = {
    id, brand_id: id, title: 'Old', review_status: 'approved',
    publish_status: 'published', deleted_at: null
  };
  const repository = {
    findPageById: async () => current,
    findBrandById: async () => ({ id, deleted_at: null }),
    update: async (_id: string, mutation: Record<string, unknown>) => { saved.push(mutation); },
    findDetailById: async () => ({
      brand_page: current, stats: [], sources: [], featured_product_groups: []
    })
  };
  const service = new BrandPageService(repository as unknown as BrandPageRepository);

  await service.updateBrandPage(id, { brand_id: id, title: 'New' }, editor);
  assert.equal(saved[0].review_status, 'pending_review');
  assert.equal(saved[0].publish_status, 'unpublished');

  await service.updateBrandPage(id, { brand_id: id, title: 'New' }, superAdmin);
  assert.equal(saved[1].review_status, undefined);
  assert.equal(saved[1].publish_status, undefined);

  await service.updateBrandPage(id, {
    brand_id: id,
    title: 'Old',
    stats: [{ value: '10', label: 'Years' }]
  }, editor);
  assert.equal(saved[2].review_status, 'pending_review');
  assert.equal(saved[2].publish_status, 'unpublished');
});

test('public product highlights and variant attributes carry the actor review policy into child writes', async () => {
  const highlightPolicies: boolean[] = [];
  const attributePolicies: boolean[] = [];
  const groupRecord = { id, deleted_at: null, review_status: 'approved', publish_status: 'published' };
  const groupRepository = {
    findById: async () => groupRecord,
    createHighlightSpec: async (_mutation: unknown, reopen: boolean) => {
      highlightPolicies.push(reopen);
      return { id, product_variant_id: null };
    },
    listHighlightSpecs: async () => []
  };
  const groupService = new ProductGroupService(groupRepository as unknown as ProductGroupRepository);
  const highlight = { source_type: 'manual' as const, display_label: 'Power', display_value: '9W', sort_order: 0 };
  await groupService.createProductHighlightSpec(id, highlight, editor);
  await groupService.createProductHighlightSpec(id, highlight, superAdmin);
  assert.deepEqual(highlightPolicies, [true, false]);

  const variantRepository = {
    findById: async () => ({ id, product_group_id: id, deleted_at: null }),
    createAttribute: async (_id: string, _input: unknown, reopen: boolean) => {
      attributePolicies.push(reopen);
      return { id };
    },
    listAttributes: async () => []
  };
  const usableGroup = { assertProductGroupUsableForBusiness: async () => undefined };
  const variantService = new ProductVariantService(
    variantRepository as unknown as ProductVariantRepository,
    usableGroup as unknown as ProductGroupService
  );
  const attribute = { attribute_name: 'Power', attribute_value: '9W' };
  await variantService.createVariantAttribute(id, attribute, editor);
  await variantService.createVariantAttribute(id, attribute, superAdmin);
  assert.deepEqual(attributePolicies, [true, false]);
});

test('project gallery and service product links apply the same review policy as their parent pages', async () => {
  const galleryPolicies: boolean[] = [];
  const linkPolicies: boolean[] = [];
  const project = { id, review_status: 'approved', publish_status: 'published', deleted_at: null };
  const serviceRecord = { ...project };
  const gallery = { id: fileId, project_id: id, deleted_at: null, alt_text: 'Old', sort_order: 0 };
  const projectRepository = {
    findById: async () => project,
    findGalleryItem: async () => gallery,
    updateGalleryItem: async (_projectId: string, _galleryId: string, _input: unknown, reopen: boolean) => {
      galleryPolicies.push(reopen);
      return true;
    },
    listGallery: async () => [gallery]
  };
  const projectService = new ProjectService(
    projectRepository as unknown as ProjectRepository,
    {} as ProductGroupService,
    {} as never
  );
  await projectService.updateGalleryImage(id, fileId, { alt_text: 'New' }, editor);
  await projectService.updateGalleryImage(id, fileId, { alt_text: 'New' }, superAdmin);
  assert.deepEqual(galleryPolicies, [true, false]);

  const serviceRepository = {
    findById: async () => serviceRecord,
    detachProductGroup: async (_serviceId: string, _groupId: string, reopen: boolean) => {
      linkPolicies.push(reopen);
      return true;
    },
    relatedProductGroups: async () => []
  };
  const serviceService = new SongThanhServiceService(
    serviceRepository as unknown as ServiceRepository,
    {} as ProductGroupService,
    {} as never
  );
  await serviceService.detachProductGroup(id, categoryId, editor);
  await serviceService.detachProductGroup(id, categoryId, superAdmin);
  assert.deepEqual(linkPolicies, [true, false]);
});
