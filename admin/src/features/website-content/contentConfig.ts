import { endpoints } from '@/lib/api-endpoints';
import { PERMISSIONS } from '@/lib/permissions';

export type ContentKind = 'page-content' | 'banner' | 'redirect';

export type ContentConfig = {
  title: string;
  subtitle: string;
  endpoint: string;
  detailPath: string;
  read: string;
  create: string;
  update: string;
  archive: string;
  restore: string;
};

export const CONTENT_CONFIGS: Record<ContentKind, ContentConfig> = {
  'page-content': {
    title: 'Trang nội dung',
    subtitle: 'Bài viết, trang giới thiệu, dịch vụ — toàn bộ nội dung tĩnh của website.',
    endpoint: endpoints.songThanh.pageContents,
    detailPath: '/page-contents',
    read: PERMISSIONS.pageContentRead,
    create: PERMISSIONS.pageContentCreate,
    update: PERMISSIONS.pageContentUpdate,
    archive: PERMISSIONS.pageContentArchive,
    restore: PERMISSIONS.pageContentRestore
  },
  banner: {
    title: 'Banner',
    subtitle: 'Ảnh quảng cáo và banner trên website — tiêu đề, hình ảnh, liên kết, lịch đăng.',
    endpoint: endpoints.songThanh.banners,
    detailPath: '/banners',
    read: PERMISSIONS.bannerRead,
    create: PERMISSIONS.bannerCreate,
    update: PERMISSIONS.bannerUpdate,
    archive: PERMISSIONS.bannerArchive,
    restore: PERMISSIONS.bannerRestore
  },
  redirect: {
    title: 'Chuyển hướng URL',
    subtitle: 'Khi đường dẫn cũ thay đổi, tạo chuyển hướng để khách truy cập không gặp lỗi.',
    endpoint: endpoints.songThanh.redirects,
    detailPath: '/redirects',
    read: PERMISSIONS.redirectRead,
    create: PERMISSIONS.redirectCreate,
    update: PERMISSIONS.redirectUpdate,
    archive: PERMISSIONS.redirectArchive,
    restore: PERMISSIONS.redirectRestore
  }
};
