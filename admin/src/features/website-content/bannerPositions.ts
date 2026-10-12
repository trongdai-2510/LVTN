export const BANNER_POSITION_OPTIONS = [
  { value: '/', label: 'Trang chủ' },
  { value: '/san-pham', label: 'Trang Sản phẩm' },
  { value: '/san-pham/danh-sach', label: 'Danh sách sản phẩm' },
  { value: '/gioi-thieu', label: 'Trang Giới thiệu' },
  { value: '/ho-so-nang-luc', label: 'Trang Hồ sơ năng lực' },
  { value: '/dich-vu', label: 'Trang Dịch vụ' },
  { value: '/du-an', label: 'Trang Dự án' },
  { value: '/tin-tuc', label: 'Trang Tin tức' },
  { value: '/doi-tac-thuong-hieu', label: 'Danh sách thương hiệu và đối tác' },
  { value: '/lien-he', label: 'Trang Liên hệ' },
  { value: '/chinh-sach-van-chuyen', label: 'Trang Chính sách vận chuyển' }
] as const;

export const BANNER_LEGACY_PAGE_PATHS: Record<string, string> = {
  hero: '/',
  'san-pham': '/san-pham',
  'san-pham-danh-sach': '/san-pham/danh-sach',
  'gioi-thieu': '/gioi-thieu',
  'ho-so-nang-luc': '/ho-so-nang-luc',
  'dich-vu': '/dich-vu',
  'du-an': '/du-an',
  'tin-tuc': '/tin-tuc',
  'doi-tac-thuong-hieu': '/doi-tac-thuong-hieu',
  'lien-he': '/lien-he',
  'chinh-sach-van-chuyen': '/chinh-sach-van-chuyen'
};

export function bannerPositionLabel(position: string) {
  if (position === 'brand-hero') return 'Trang thương hiệu (cách gán cũ)';
  const path = BANNER_LEGACY_PAGE_PATHS[position] ?? position;
  return BANNER_POSITION_OPTIONS.find((item) => item.value === path)?.label ?? path;
}
