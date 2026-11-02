import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { ProductGroupService } from '../../src/modules/product-group/product-group.service';
import type { ProductGroupMutationInput } from '../../src/modules/product-group/product-group.types';

const groupId = '00000000-0000-4000-8000-000000000001';
const imageId = '00000000-0000-4000-8000-000000000002';
const publishable: ProductGroupMutationInput = {
  name: 'Cáp điện',
  category_id: groupId,
  status: 'active',
  review_status: 'approved',
  publish_status: 'published',
  thumbnail_file_id: imageId,
  short_description: null,
  detailed_description: null
};

function checker(hasSpecs: boolean) {
  const service = new ProductGroupService({
    hasTechnicalSpecifications: async () => hasSpecs
  } as never);
  return (service as unknown as {
    assertPublishReadiness: (input: ProductGroupMutationInput, id: string) => Promise<void>;
  }).assertPublishReadiness.bind(service);
}

test('approved product with an image and technical spec can publish without descriptions', async () => {
  await assert.doesNotReject(checker(true)(publishable, groupId));
});

test('publishing is blocked when no shared or variant technical spec exists', async () => {
  await assert.rejects(checker(false)(publishable, groupId), {
    code: 'PRODUCT_GROUP_PUBLISH_REQUIRES_SPEC'
  });
});

test('publishing still requires a primary image and approval', async () => {
  await assert.rejects(checker(true)({ ...publishable, thumbnail_file_id: null }, groupId), {
    code: 'PRODUCT_GROUP_PUBLISH_REQUIRES_THUMBNAIL'
  });
  await assert.rejects(checker(true)({ ...publishable, review_status: 'draft' }, groupId), {
    code: 'PRODUCT_GROUP_PUBLISH_REQUIRES_APPROVED_REVIEW'
  });
});
