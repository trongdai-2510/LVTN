import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { isVisibilityOnlyUnpublish } from '../../src/common/workflow/public-content-review';
import { BrandPageService } from '../../src/modules/brand-page/brand-page.service';
import { ProductGroupService } from '../../src/modules/product-group/product-group.service';
import { ProductVariantService } from '../../src/modules/product-variant/product-variant.service';
import { ProjectService } from '../../src/modules/project/project.service';
import { SongThanhServiceService } from '../../src/modules/service/service.service';

const id = '00000000-0000-4000-8000-000000000001';

type Normalizer = { normalizeUpdateInput: (...args: unknown[]) => Promise<unknown> };
function normalize(target: unknown, ...args: unknown[]) {
  return (target as Normalizer).normalizeUpdateInput(...args);
}

test('only a single visibility change bypasses old editorial references', () => {
  assert.equal(isVisibilityOnlyUnpublish({ publish_status: 'unpublished' }), true);
  assert.equal(isVisibilityOnlyUnpublish({ publish_status: 'unpublished', title: undefined }), true);
  assert.equal(isVisibilityOnlyUnpublish({ publish_status: 'unpublished', title: 'Edited' }), false);
  assert.equal(isVisibilityOnlyUnpublish({ publish_status: 'published' }), false);
  assert.equal(isVisibilityOnlyUnpublish({ publish_status: 'unpublished', expected_updated_at: 'v1' },
    ['expected_updated_at']), true);
});

test('a visibility-only hide does not require old project, service, product or brand references to remain valid', async () => {
  const serviceRepo = {
    findById: async () => ({ review_status: 'approved', publish_status: 'published',
      image_file_id: id, content_html: null }),
    activeImageFilesExist: async () => true,
    activeFileExists: async () => false
  };
  const service = new SongThanhServiceService(serviceRepo as never, {} as never, {} as never);
  assert.deepEqual(await normalize(service, id, { publish_status: 'unpublished' }),
    { publish_status: 'unpublished' });

  const projectRepo = {
    findById: async () => ({ review_status: 'approved', publish_status: 'published',
      image_file_id: id, content_html: null }),
    activeImageFilesExist: async () => true,
    activeFileExists: async () => false
  };
  const project = new ProjectService(projectRepo as never, {} as never, {} as never);
  assert.deepEqual(await normalize(project, id, { publish_status: 'unpublished' }),
    { publish_status: 'unpublished' });

  const groupRepo = { findCategoryContext: async () => null };
  const group = new ProductGroupService(groupRepo as never);
  assert.deepEqual(await normalize(group, id, { publish_status: 'unpublished' }, {
    review_status: 'approved', publish_status: 'published', category_id: id
  }), { publish_status: 'unpublished' });

  const variantParent = {
    assertProductGroupUsableForBusiness: async () => { throw Error('old parent unavailable'); }
  };
  const variant = new ProductVariantService({} as never, variantParent as never);
  assert.deepEqual(await normalize(variant, id, { publish_status: 'unpublished' }, {
    review_status: 'approved', publish_status: 'published', product_group_id: id
  }), { publish_status: 'unpublished' });

  const brandPage = new BrandPageService({ findBrandById: async () => null } as never);
  assert.deepEqual(await normalize(brandPage, {
    brand_id: id, review_status: 'approved', publish_status: 'published'
  }, { publish_status: 'unpublished' }), {
    mutation: { publish_status: 'unpublished' },
    nested: { stats: undefined, sources: undefined, featured_product_group_ids: undefined }
  });
});
