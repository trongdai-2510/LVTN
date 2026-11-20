import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { AppError } from '../../src/common/errors/app-error';
import { normalizeSafeNavigationTarget } from '../../src/common/navigation/safeNavigationTarget';
import {
  hasRenderableExtraBlockContent,
  normalizeExtraBlocks,
  requiresManagedBodyForPublication
} from '../../src/modules/page-content/page-content.guardrails';
import { PageContentService } from '../../src/modules/page-content/page-content.service';

const BLOCK_ID_1 = '11111111-1111-4111-8111-111111111111';
const BLOCK_ID_2 = '22222222-2222-4222-8222-222222222222';
const IMAGE_ID_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const IMAGE_ID_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

test('status-only unpublish succeeds even when old content references are no longer usable', async () => {
  const id = '33333333-3333-4333-8333-333333333333';
  const current = {
    id,
    content_type: 'page',
    slug: 'qa-page',
    review_status: 'approved',
    publish_status: 'published',
    content_html: '<p>Old content</p>',
    featured_image_file_id: IMAGE_ID_1,
    deleted_at: null,
    updated_at: '2026-10-05T07:00:00.000Z'
  };
  let stored = { ...current };
  let patch: Record<string, unknown> = {};
  const repository = {
    findById: async () => stored,
    activeImageFilesExist: async () => { throw new Error('Publication references must not be checked when hiding.'); },
    update: async (_id: string, mutation: Record<string, unknown>) => {
      patch = mutation;
      stored = { ...stored, ...mutation };
      return { status: 'updated' };
    }
  };
  const users = { requireLogicUserId: async () => id };
  const service = new PageContentService(repository as never, users as never);
  const result = await service.updatePageContent(id, {
    publish_status: 'unpublished',
    expected_updated_at: current.updated_at
  }, null);

  assert.equal(result.page_content.publish_status, 'unpublished');
  assert.deepEqual(patch, { publish_status: 'unpublished' });
});

function assertValidationError(action: () => unknown): void {
  assert.throws(
    action,
    (error) =>
      error instanceof AppError &&
      error.statusCode === 400 &&
      error.code === 'VALIDATION_ERROR'
  );
}

test('safe navigation targets allow site paths, anchors, and credential-free HTTP(S)', () => {
  for (const target of [
    '/san-pham/danh-sach?q=den-led',
    '#thong-so',
    'https://example.com/catalogue?q=led',
    'http://example.com/'
  ]) {
    assert.equal(normalizeSafeNavigationTarget(`  ${target}  `), target);
  }
});

test('safe navigation targets reject executable, ambiguous, credentialed, and oversized URLs', () => {
  for (const target of [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '//evil.example/path',
    '/safe\\evil',
    '#',
    'https://user:password@example.com/',
    'mailto:test@example.com',
    `/${'a'.repeat(2048)}`,
    '/safe\nunsafe'
  ]) {
    assert.equal(normalizeSafeNavigationTarget(target), null, target);
  }
});

test('extra blocks reject unsafe stored links before they reach the public website', () => {
  for (const target of [
    'javascript:alert(1)',
    'data:text/html,unsafe',
    '//evil.example',
    'https://user:password@example.com/'
  ]) {
    assertValidationError(() =>
      normalizeExtraBlocks({
        blocks: [
          {
            id: BLOCK_ID_1,
            type: 'bullet_list',
            items: [{ text: 'Mục kiểm thử', link: { target } }]
          }
        ]
      })
    );
  }
});

test('extra blocks retain valid links and normalize optional labels', () => {
  const normalized = normalizeExtraBlocks({
    blocks: [
      {
        id: BLOCK_ID_1,
        type: 'card_grid',
        columns: '3',
        items: [
          {
            title: 'Sản phẩm',
            description: '  Mô tả  ',
            link: { label: '  Xem thêm  ', target: '  /san-pham  ' }
          }
        ]
      }
    ]
  });

  assert.deepEqual(normalized, {
    blocks: [
      {
        id: BLOCK_ID_1,
        type: 'card_grid',
        title: null,
        columns: 3,
        items: [
          {
            title: 'Sản phẩm',
            description: 'Mô tả',
            link: { label: 'Xem thêm', target: '/san-pham' }
          }
        ]
      }
    ]
  });
});

test('page layout retains a unique ordered visibility map beside content blocks', () => {
  const normalized = normalizeExtraBlocks({
    blocks: [],
    layout: {
      sections: [
        { id: 'projects-hero', visible: true },
        { id: 'projects-list', visible: true },
        { id: 'projects-story', visible: false }
      ]
    }
  });

  assert.deepEqual(normalized, {
    blocks: [],
    layout: {
      sections: [
        { id: 'projects-hero', visible: true },
        { id: 'projects-list', visible: true },
        { id: 'projects-story', visible: false }
      ]
    }
  });
});

test('page layout rejects duplicate, unsafe, empty, and fully hidden section maps', () => {
  for (const layout of [
    { sections: [] },
    {
      sections: [
        { id: 'projects-list', visible: true },
        { id: 'projects-list', visible: false }
      ]
    },
    { sections: [{ id: '../projects-list', visible: true }] },
    { sections: [{ id: 'projects-list', visible: 'yes' }] },
    {
      sections: [
        { id: 'projects-hero', visible: false },
        { id: 'projects-list', visible: false }
      ]
    }
  ]) {
    assertValidationError(() => normalizeExtraBlocks({ blocks: [], layout }));
  }
});

test('image-card slot keys are unique so public template selection is deterministic', () => {
  assertValidationError(() =>
    normalizeExtraBlocks({
      blocks: [
        {
          id: BLOCK_ID_1,
          type: 'image_card',
          image_file_id: IMAGE_ID_1,
          slot_key: 'eligible'
        },
        {
          id: BLOCK_ID_2,
          type: 'image_card',
          image_file_id: IMAGE_ID_2,
          slot_key: 'eligible'
        }
      ]
    })
  );
});

test('publish readiness treats empty list/grid shells as non-renderable content', () => {
  const emptyBullet = normalizeExtraBlocks({
    blocks: [{ id: BLOCK_ID_1, type: 'bullet_list', title: 'Chỉ có tiêu đề', items: [] }]
  });
  const emptyGrid = normalizeExtraBlocks({
    blocks: [{ id: BLOCK_ID_1, type: 'card_grid', title: 'Chỉ có tiêu đề', items: [] }]
  });
  const populatedBullet = normalizeExtraBlocks({
    blocks: [{ id: BLOCK_ID_1, type: 'bullet_list', items: [{ text: 'Có nội dung' }] }]
  });
  const imageCard = normalizeExtraBlocks({
    blocks: [{ id: BLOCK_ID_1, type: 'image_card', image_file_id: IMAGE_ID_1 }]
  });

  assert.equal(hasRenderableExtraBlockContent(emptyBullet), false);
  assert.equal(hasRenderableExtraBlockContent(emptyGrid), false);
  assert.equal(hasRenderableExtraBlockContent(populatedBullet), true);
  assert.equal(hasRenderableExtraBlockContent(imageCard), true);
});

test('only the structured product catalog page may omit its editorial body', () => {
  assert.equal(requiresManagedBodyForPublication('page', 'san-pham'), false);
  assert.equal(requiresManagedBodyForPublication('page', 'gioi-thieu'), true);
  assert.equal(requiresManagedBodyForPublication('news', 'san-pham'), true);
});

test('extra-block nested text fields enforce their exact accepted boundaries', () => {
  const accepted = normalizeExtraBlocks({
    blocks: [
      {
        id: BLOCK_ID_1,
        type: 'bullet_list',
        items: [{ text: 'a'.repeat(1000), link: { label: 'b'.repeat(120), target: '/ok' } }]
      },
      {
        id: BLOCK_ID_2,
        type: 'card_grid',
        items: [{ title: 'c'.repeat(255), description: 'd'.repeat(1000) }]
      }
    ]
  });
  assert.equal(accepted?.blocks.length, 2);

  for (const blocks of [
    [{ id: BLOCK_ID_1, type: 'bullet_list', items: [{ text: 'a'.repeat(1001) }] }],
    [{ id: BLOCK_ID_1, type: 'bullet_list', items: [{ text: 'ok', link: { label: 'b'.repeat(121), target: '/ok' } }] }],
    [{ id: BLOCK_ID_1, type: 'card_grid', items: [{ title: 'c'.repeat(256) }] }],
    [{ id: BLOCK_ID_1, type: 'card_grid', items: [{ title: 'ok', description: 'd'.repeat(1001) }] }]
  ]) {
    assertValidationError(() => normalizeExtraBlocks({ blocks }));
  }
});
