export const NEWS_CATEGORY_TABLE = 'news_category';
export const NEWS_CATEGORY_DELETED_SCOPES = ['active', 'deleted', 'all'] as const;

export type NewsCategoryDeletedScope = (typeof NEWS_CATEGORY_DELETED_SCOPES)[number];

export interface NewsCategoryRecord {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface NewsCategoryMutationInput {
  name?: string;
  slug?: string;
  sort_order?: number;
}
