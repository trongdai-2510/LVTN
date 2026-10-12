import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { PublicService } from '../../src/modules/public/public.service';
import type { PublicRepository } from '../../src/modules/public/public.repository';
import type { PublicProductFileRepository } from '../../src/modules/public/public-product-file.repository';
import type { DashboardService } from '../../src/modules/dashboard/dashboard.service';
import type { RedirectRepository } from '../../src/modules/redirect/redirect.repository';

test('public site shell hides only menu links to unpublished system pages', async () => {
  const repository = {
    activeCompanyInfo: async () => null,
    activeFileMap: async () => new Map(),
    publishedSystemPageSlugs: async () => ['san-pham'],
    activeMenuByPosition: async (position: string) =>
      position === 'header' ? { id: 'header', name: 'Đầu trang', position } : null,
    activeMenuItems: async () => [
      { id: 'about', parent_id: null, title: 'Giới thiệu', link_type: 'internal', link_target: '/gioi-thieu', sort_order: 1 },
      { id: 'product', parent_id: null, title: 'Sản phẩm', link_type: 'internal', link_target: '/san-pham', sort_order: 2 },
      { id: 'listing', parent_id: null, title: 'Danh sách', link_type: 'internal', link_target: '/san-pham/danh-sach', sort_order: 3 }
    ]
  } as unknown as PublicRepository;
  const service = new PublicService(
    repository,
    {} as PublicProductFileRepository,
    {} as DashboardService,
    {} as RedirectRepository
  );

  const shell = await service.getSiteShell();
  assert.deepEqual(shell.header_menu?.items.map((item) => item.title), ['Sản phẩm', 'Danh sách']);
});
