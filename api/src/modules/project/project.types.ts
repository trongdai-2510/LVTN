export const PROJECT_TABLE = 'project';
export const PROJECT_PRODUCT_GROUP_TABLE = 'project_product_group';
export const PROJECT_GALLERY_TABLE = 'project_gallery';
export const PRODUCT_GROUP_TABLE = 'product_group';
export const FILE_METADATA_TABLE = 'file_metadata';
export const FILE_USAGE_TABLE = 'file_usage';

export const PROJECT_FILE_USAGE_ENTITY_TYPE = 'project';
export const PROJECT_IMAGE_FIELD_NAME = 'image_file_id';
export const PROJECT_OG_IMAGE_FIELD_NAME = 'seo_og_image_file_id';
export const PROJECT_CONTENT_HTML_FIELD_NAME = 'content_html';
export const PROJECT_GALLERY_FILE_USAGE_ENTITY_TYPE = 'project_gallery';
export const PROJECT_GALLERY_FILE_FIELD_NAME = 'file_id';

export const PROJECT_ALLOWED_REVIEW_STATUSES = ['draft', 'pending_review', 'approved', 'rejected'] as const;
export const PROJECT_ALLOWED_PUBLISH_STATUSES = ['unpublished', 'published', 'archived'] as const;
export const PROJECT_DELETED_SCOPES = ['active', 'deleted', 'all'] as const;
export const PROJECT_MIN_YEAR = 1900;
export const PROJECT_MAX_YEAR = 2100;

export type ProjectReviewStatus = (typeof PROJECT_ALLOWED_REVIEW_STATUSES)[number];
export type ProjectPublishStatus = (typeof PROJECT_ALLOWED_PUBLISH_STATUSES)[number];
export type ProjectDeletedScope = (typeof PROJECT_DELETED_SCOPES)[number];

export interface ProjectRecord {
  id: string;
  title: string;
  slug: string;
  location: string | null;
  project_year: number | null;
  client_name: string | null;
  description: string | null;
  content_html: string | null;
  image_file_id: string | null;
  review_status: ProjectReviewStatus;
  publish_status: ProjectPublishStatus;
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

export interface ProjectListItem {
  id: string;
  title: string;
  slug: string;
  location: string | null;
  project_year: number | null;
  client_name: string | null;
  description: string | null;
  image_file_id: string | null;
  review_status: ProjectReviewStatus;
  publish_status: ProjectPublishStatus;
  updated_at: Date;
  deleted_at: Date | null;
  related_product_group_count: number;
}

export interface ProjectProductGroupAssociation {
  project_id: string;
  product_group_id: string;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface ProjectGalleryFileSummary {
  id: string;
  original_filename: string;
  mime_type: string;
}

export interface ProjectGalleryRecord {
  id: string;
  project_id: string;
  file_id: string;
  alt_text: string | null;
  sort_order: number;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  file?: ProjectGalleryFileSummary | null;
}

export interface ProjectGalleryMutationInput {
  file_id?: string;
  alt_text?: string | null;
  sort_order?: number;
}

export interface ProjectGalleryReorderInput {
  id: string;
  sort_order: number;
}

export interface ProjectRelatedProductGroup {
  association: ProjectProductGroupAssociation;
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

export interface ProjectMutationInput {
  title?: string;
  slug?: string;
  location?: string | null;
  project_year?: number | null;
  client_name?: string | null;
  description?: string | null;
  content_html?: string | null;
  image_file_id?: string | null;
  review_status?: ProjectReviewStatus;
  publish_status?: ProjectPublishStatus;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_og_image_file_id?: string | null;
}
