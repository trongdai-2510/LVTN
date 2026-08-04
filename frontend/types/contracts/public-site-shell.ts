export interface PublicFileSummary {
  id: string;
  original_filename: string;
  mime_type: string;
  url: string;
}

export interface PublicMenuItemNode {
  id: string;
  parent_id: string | null;
  title: string;
  link_type: 'internal' | 'external' | 'anchor' | 'group';
  link_target: string | null;
  sort_order: number;
  open_in_new_tab?: boolean;
  icon_name?: string | null;
  description?: string | null;
  children: PublicMenuItemNode[];
}

export interface PublicMenu {
  id: string;
  name: string;
  position: 'header' | 'footer_quick' | 'footer_support' | 'footer_legal' | 'mobile';
  items: PublicMenuItemNode[];
}

export interface PublicCompanyInfo {
  id: string;
  display_name: string;
  legal_name: string;
  hotline: string;
  hotlines: string[] | null;
  email: string;
  address: string;
  map_embed_code: string | null;
  working_hours_from: string | null;
  working_hours_to: string | null;
  working_days: string | null;
  logo_file_id: string | null;
  favicon_file_id: string | null;
  logo_file: PublicFileSummary | null;
  favicon_file: PublicFileSummary | null;
}

export interface PublicSocialLink {
  id: string;
  platform: string;
  label: string;
  url: string;
  sort_order: number;
  status: 'active' | 'inactive';
}

export interface PublicSiteShellResponse {
  company_info: PublicCompanyInfo | null;
  social_links: PublicSocialLink[];
  header_menu: PublicMenu | null;
  footer_quick_menu: PublicMenu | null;
  footer_support_menu: PublicMenu | null;
  footer_legal_menu: PublicMenu | null;
}
