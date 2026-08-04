/**
 * Stock images cho các trang static (FAQ, chính sách, etc.).
 * Dùng Unsplash CDN — đã config remotePatterns trong next.config.ts.
 *
 * Khi muốn đổi ảnh: thay URL ở đây, không cần đụng component.
 * Khi muốn host local: tải về public/images/static-pages/ rồi đổi path.
 */

export interface StaticPageImage {
  src: string;
  alt: string;
  /** Photographer credit để hiển thị optional */
  credit?: string;
}

export const STATIC_PAGE_IMAGES = {
  faqHero: {
    src: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=900&auto=format&fit=crop&q=70',
    alt: 'Đội ngũ hỗ trợ khách hàng Song Thanh',
    credit: 'Unsplash'
  },
  warrantyHero: {
    src: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=900&auto=format&fit=crop&q=70',
    alt: 'Kỹ thuật viên kiểm tra thiết bị điện công nghiệp',
    credit: 'Unsplash'
  },
  warrantyEligible: {
    src: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=900&auto=format&fit=crop&q=70',
    alt: 'Thiết bị mới còn nguyên seal và phụ kiện',
    credit: 'Unsplash'
  },
  warrantyIneligible: {
    src: 'https://images.unsplash.com/photo-1572177812156-58036aae439c?w=900&auto=format&fit=crop&q=70',
    alt: 'Thiết bị bị hư hỏng do sử dụng sai cách',
    credit: 'Unsplash'
  },
  shippingHero: {
    src: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1600&auto=format&fit=crop&q=70',
    alt: 'Nhân viên Song Thanh kiểm tra và đóng gói thiết bị trước khi bàn giao',
    credit: 'Unsplash'
  }
} as const satisfies Record<string, StaticPageImage>;

export type StaticPageImageKey = keyof typeof STATIC_PAGE_IMAGES;
