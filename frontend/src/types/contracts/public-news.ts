export interface PublicNewsCategoryItem {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
}

export interface PublicNewsCategoryListResponse {
  items: PublicNewsCategoryItem[];
}

export interface PublicNewsListItem {
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

export interface PublicNewsListResponse {
  items: PublicNewsListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  category_slug: string | null;
}
