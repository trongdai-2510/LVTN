export const SERVICE_TABLE = 'service';
export const SERVICE_PRODUCT_GROUP_TABLE = 'service_product_group';
export const PRODUCT_GROUP_TABLE = 'product_group';
export const FILE_METADATA_TABLE = 'file_metadata';
export const FILE_USAGE_TABLE = 'file_usage';

export const SERVICE_FILE_USAGE_ENTITY_TYPE = 'service';
export const SERVICE_IMAGE_FIELD_NAME = 'image_file_id';
export const SERVICE_OG_IMAGE_FIELD_NAME = 'seo_og_image_file_id';
export const SERVICE_CONTENT_HTML_FIELD_NAME = 'content_html';

export const SERVICE_ALLOWED_REVIEW_STATUSES = ['draft', 'pending_review', 'approved', 'rejected'] as const;
export const SERVICE_ALLOWED_PUBLISH_STATUSES = ['unpublished', 'published', 'archived'] as const;
export const SERVICE_DELETED_SCOPES = ['active', 'deleted', 'all'] as const;
export const SERVICE_ALLOWED_ICON_KEYS = [
  'consultation',
  'design',
  'maintenance',
  'training',
  'audit',
  'supply',
  'integration',
  'commissioning',
  'troubleshooting',
  'custom'
] as const;

export type ServiceReviewStatus = (typeof SERVICE_ALLOWED_REVIEW_STATUSES)[number];
export type ServicePublishStatus = (typeof SERVICE_ALLOWED_PUBLISH_STATUSES)[number];
export type ServiceDeletedScope = (typeof SERVICE_DELETED_SCOPES)[number];
export type ServiceIconKey = (typeof SERVICE_ALLOWED_ICON_KEYS)[number];

export interface ServiceRecord {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  content_html: string | null;
  when_to_contact: string | null;
  deliverables: string[];
  typical_duration: string | null;
  sort_order: number;
  icon_key: ServiceIconKey | null;
  image_file_id: string | null;
  review_status: ServiceReviewStatus;
  publish_status: ServicePublishStatus;
  seo_title: string | null;
  seo_description: string | null;
  seo_og_image_file_id: string | null;
  created_by: number | null;
  updated_by: number | null;
  approved_by: number | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface ServiceListItem {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  image_file_id: string | null;
  sort_order: number;
  icon_key: ServiceIconKey | null;
  review_status: ServiceReviewStatus;
  publish_status: ServicePublishStatus;
  updated_at: Date;
  deleted_at: Date | null;
  related_product_group_count: number;
}

export interface ServiceProductGroupAssociation {
  service_id: string;
  product_group_id: string;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface ServiceRelatedProductGroup {
  association: ServiceProductGroupAssociation;
  product_group: {
    id: string;
    name: string;
    slug: string;
    category_id: string;
    brand_id: string | null;
    thumbnail_file_id: string | null;
    status: string;
    review_status: string;
    publish_status: string;
    deleted_at: Date | null;
  };
}

export interface ServiceMutationInput {
  title?: string;
  slug?: string;
  subtitle?: string | null;
  description?: string | null;
  content_html?: string | null;
  when_to_contact?: string | null;
  deliverables?: string[] | null;
  typical_duration?: string | null;
  sort_order?: number;
  icon_key?: ServiceIconKey | null;
  image_file_id?: string | null;
  review_status?: ServiceReviewStatus;
  publish_status?: ServicePublishStatus;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_og_image_file_id?: string | null;
}
