export const COMPANY_INFO_TABLE = 'company_info';
export const COMPANY_SOCIAL_LINK_TABLE = 'company_social_link';
export const FILE_METADATA_TABLE = 'file_metadata';
export const FILE_USAGE_TABLE = 'file_usage';

export const COMPANY_INFO_FILE_USAGE_ENTITY_TYPE = 'company_info';
export const COMPANY_INFO_LOGO_FIELD_NAME = 'logo_file_id';
export const COMPANY_INFO_FAVICON_FIELD_NAME = 'favicon_file_id';

export const WEBSITE_SETTINGS_SOCIAL_LINK_STATUSES = ['active', 'inactive'] as const;
export const WEBSITE_SETTINGS_DELETED_SCOPES = ['active', 'deleted', 'all'] as const;

export type WebsiteSettingsSocialLinkStatus = (typeof WEBSITE_SETTINGS_SOCIAL_LINK_STATUSES)[number];
export type WebsiteSettingsDeletedScope = (typeof WEBSITE_SETTINGS_DELETED_SCOPES)[number];

export interface CompanyInfoRecord {
  id: string;
  display_name: string;
  legal_name: string;
  hotline: string;
  hotlines: string[];
  email: string;
  address: string;
  map_embed_code: string | null;
  working_hours_from: string | null;
  working_hours_to: string | null;
  working_days: string | null;
  logo_file_id: string | null;
  favicon_file_id: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CompanySocialLinkRecord {
  id: string;
  company_info_id: string;
  platform: string;
  label: string;
  url: string;
  sort_order: number;
  status: WebsiteSettingsSocialLinkStatus;
  created_by: number | null;
  updated_by: number | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CompanyInfoMutationInput {
  display_name?: string;
  legal_name?: string;
  hotline?: string;
  hotlines?: string[];
  email?: string;
  address?: string;
  map_embed_code?: string | null;
  working_hours_from?: string | null;
  working_hours_to?: string | null;
  working_days?: string | null;
  logo_file_id?: string | null;
  favicon_file_id?: string | null;
}

export interface SocialLinkMutationInput {
  platform?: string;
  label?: string;
  url?: string;
  sort_order?: number;
  status?: WebsiteSettingsSocialLinkStatus;
}
