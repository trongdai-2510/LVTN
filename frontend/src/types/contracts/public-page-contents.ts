import type { PublicFileSummary } from './public-site-shell';

interface PublicNewsCategoryItem {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
}

export interface PublicRelatedNewsListItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  content_type: 'news';
  is_featured: boolean;
  category: PublicNewsCategoryItem | null;
}

export interface PublicRelatedNewsListResponse {
  items: PublicRelatedNewsListItem[];
}

export interface PublicPageContentDetailResponse {
  page_content: {
    id: string;
    title: string;
    slug: string;
    content_type: 'page' | 'news';
    excerpt: string | null;
    content_html: string | null;
    featured_image_file_id: string | null;
    featured_image: PublicFileSummary | null;
    seo_title: string | null;
    seo_description: string | null;
    published_at: string | null;
    extra_blocks: PublicExtraBlocksPayload;
    created_at: string;
    updated_at: string;
    category: PublicNewsCategoryItem | null;
  };
}

/**
 * Khối phụ admin tự cấu hình trong /page-contents — render giữa body và CTA cuối.
 * Backend đã normalize, frontend chỉ cần render. Nếu trống → component bỏ qua.
 */
export interface PublicExtraBlocksPayload {
  blocks: PublicExtraBlockItem[];
  layout: PublicPageContentLayout | null;
}

interface PublicPageContentLayout {
  sections: Array<{ id: string; visible: boolean }>;
}

type PublicExtraBlockItem =
  | PublicBulletListBlock
  | PublicCardGridBlock
  | PublicImageCardBlock;

export interface PublicBulletListBlock {
  id: string;
  type: 'bullet_list';
  title: string | null;
  items: Array<{
    text: string;
    link: { label: string | null; target: string } | null;
  }>;
}

export interface PublicCardGridBlock {
  id: string;
  type: 'card_grid';
  title: string | null;
  columns: 2 | 3 | 4;
  items: Array<{
    title: string;
    description: string | null;
    link: { label: string | null; target: string } | null;
  }>;
}

export interface PublicImageCardBlock {
  id: string;
  type: 'image_card';
  title: string | null;
  description: string | null;
  tone: 'positive' | 'negative' | 'neutral';
  slot_key: string | null;
  image_file_id: string;
  image_file: PublicFileSummary;
  link: { label: string | null; target: string } | null;
}
