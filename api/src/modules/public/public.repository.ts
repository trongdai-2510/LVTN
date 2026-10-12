import { Injectable } from "@nestjs/common";
import type { Knex } from "knex";
import {
  createPaginationMeta,
  type PaginationMeta,
} from "../../common/pagination/pagination";
import { publicSearchPatterns } from "../../common/text/searchnormalization";
import { KnexService } from "../../db/knex.service";
import { BRAND_TABLE } from "../brand/brand.types";
import {
  BRAND_PAGE_FEATURED_PRODUCT_GROUP_TABLE,
  BRAND_PAGE_SOURCE_TABLE,
  BRAND_PAGE_STAT_TABLE,
  BRAND_PAGE_TABLE,
} from "../brand-page/brand-page.types";
import { BANNER_TABLE } from "../banner/banner.types";
import { CONTACT_REQUEST_TABLE } from "../contact/contact.types";
import { CUSTOMER_PROFILE_TABLE } from "../customer/customer.types";
import { FILE_METADATA_TABLE } from "../website-settings/website-settings.types";
import { MENU_ITEM_TABLE, MENU_TABLE } from "../menu/menu.types";
import {
  PAGE_CONTENT_EXTRA_BLOCK_FIELD_PREFIX,
  PAGE_CONTENT_TABLE,
} from "../page-content/page-content.types";
import { PRODUCT_CATEGORY_TABLE } from "../product-category/product-category.types";
import {
  PRODUCT_GROUP_TABLE,
  PRODUCT_IMAGE_TABLE,
} from "../product-group/product-group.types";
import { lockProductGroupReferenceRows } from "../product-group/productGroupTransactionGuard";
import {
  PRODUCT_VARIANT_TABLE,
  VARIANT_ATTRIBUTE_TABLE,
} from "../product-variant/product-variant.types";
import {
  PROJECT_PRODUCT_GROUP_TABLE,
  PROJECT_TABLE,
} from "../project/project.types";
import { QUOTE_ITEM_TABLE, QUOTE_REQUEST_TABLE } from "../quote/quote.types";
import {
  SERVICE_PRODUCT_GROUP_TABLE,
  SERVICE_TABLE,
} from "../service/service.types";
import { TECHNICAL_DOCUMENT_TABLE } from "../technical-document/technical-document.types";
import {
  COMPANY_INFO_TABLE,
  COMPANY_SOCIAL_LINK_TABLE,
} from "../website-settings/website-settings.types";
import { toPublicFileSummary, type PublicFileRecord } from "./public-file";
import { buildPublicPriceSummaryMap, type PublicPriceRow } from './publicPrice';
import { publicPriceAmountAtRequest } from './publicQuotePrice';
import type { PublicFileSummary, PublicHighlightSpec, PublicProductPriceSummary } from "./public.types";
const PROJECT_GALLERY_TABLE = "project_gallery";
const FILE_USAGE_TABLE = "file_usage";
const PRODUCT_SPEC_TABLE = "product_spec";
const PRODUCT_HIGHLIGHT_SPEC_TABLE = "product_highlight_spec";
const SPEC_GROUP_TABLE = "spec_group";
const VARIANT_SPEC_GROUP_TABLE = "variant_spec_group";
const VARIANT_SPEC_TABLE = "variant_spec";
interface CompanyInfoRow {
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
}
interface SocialLinkRow {
  id: string;
  platform: string;
  label: string;
  url: string;
  sort_order: number;
  status: "active" | "inactive";
}
interface MenuRow {
  id: string;
  name: string;
  position:
    "header" | "footer_quick" | "footer_support" | "footer_legal" | "mobile";
}
interface MenuItemRow {
  id: string;
  menu_id: string;
  parent_id: string | null;
  title: string;
  link_type: "internal" | "external" | "anchor" | "group";
  link_target: string | null;
  sort_order: number;
  open_in_new_tab: boolean;
  icon_name: string | null;
  description: string | null;
}
interface PublicCategoryRow {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  description: string | null;
  icon_file_id: string | null;
  sort_order: number;
  status: "active";
}
interface PublicProductGroupListRow {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  category_name: string | null;
  category_level_1_id: string | null;
  category_level_1_name: string | null;
  category_level_2_id: string | null;
  category_level_2_name: string | null;
  brand_id: string | null;
  brand_slug: string | null;
  brand_name: string | null;
  short_description: string | null;
  detailed_description: string | null;
  thumbnail_file_id: string | null;
  review_status: "approved";
  publish_status: "published";
  status: "active";
  sort_order: number;
}
interface PublicProductGroupDetailRow {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  category_name: string | null;
  brand_id: string | null;
  brand_name: string | null;
  brand_slug: string | null;
  brand_logo_file_id: string | null;
  short_description: string | null;
  detailed_description: string | null;
  thumbnail_file_id: string | null;
  review_status: "approved";
  publish_status: "published";
  status: "active";
  sort_order: number;
}
interface PublicRelatedProductGroupRow {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  category_name: string | null;
  brand_id: string | null;
  brand_name: string | null;
  short_description: string | null;
  detailed_description: string | null;
  thumbnail_file_id: string | null;
}
interface PublicServiceRow {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  content_html?: string | null;
  when_to_contact: string | null;
  deliverables: unknown;
  typical_duration: string | null;
  sort_order: number;
  icon_key: string | null;
  image_file_id: string | null;
  seo_title: string | null;
  seo_description: string | null;
}
interface PublicProjectRow {
  id: string;
  title: string;
  slug: string;
  location: string | null;
  project_year: number | null;
  client_name: string | null;
  description: string | null;
  content_html?: string | null;
  image_file_id: string | null;
  seo_title: string | null;
  seo_description: string | null;
}
interface PublicProjectGalleryRow {
  id: string;
  project_id: string;
  file_id: string;
  alt_text: string | null;
  sort_order: number;
  file: PublicFileSummary;
}
interface PublicPageContentRow {
  id: string;
  title: string;
  slug: string;
  content_type: "page" | "news";
  excerpt: string | null;
  content_html: string | null;
  featured_image_file_id: string | null;
  seo_title: string | null;
  seo_description: string | null;
  news_category_id: string | null;
  published_at: Date | string | null;
  is_featured: boolean;
  extra_blocks: unknown;
  created_at: Date | string;
  updated_at: Date | string;
}
interface PublicNewsCategoryRow {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
}
interface PublicBrandListRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website_url: string | null;
  logo_file_id: string | null;
  sort_order: number;
  has_detail_page: boolean;
}
interface PublicBrandDetailRow {
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  brand_description: string | null;
  brand_website_url: string | null;
  brand_logo_file_id: string | null;
  page_id: string;
  title: string;
  excerpt: string | null;
  overview_title: string | null;
  overview_body: string | null;
  support_title: string | null;
  support_intro: string | null;
  support_items: Array<{ title: string; description: string }> | null;
  support_image_file_id: string | null;
  hero_banner_id: string | null;
  hero_title_size: "medium" | "large" | "xlarge";
  hero_excerpt_size: "medium" | "large";
  hero_eyebrow_color: string | null;
  hero_title_color: string | null;
  hero_excerpt_color: string | null;
  accent_color: string | null;
  layout_archetype: "auto" | "international" | "domestic" | "minimal";
  cta_title: string | null;
  cta_description: string | null;
  cta_button_label: string | null;
  cta_button_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_og_image_file_id: string | null;
}
interface PublicBrandStatRow {
  id: string;
  value: string;
  label: string;
  note: string | null;
  sort_order: number;
}
interface PublicBrandSourceRow {
  id: string;
  title: string;
  source_type: "website" | "catalogue" | "certificate" | "other";
  url: string | null;
  file_id: string | null;
  description: string | null;
  sort_order: number;
}
interface PublicBrandDerivedCategoryRow {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  product_count: string | number;
}
interface PublicBrandLookupRow {
  id: string;
  slug: string;
  name: string;
}
interface PublicProductGroupBrandFacetRow {
  id: string;
  slug: string;
  label: string;
  count: string | number;
}
type PublicProductGroupStatusKey = "contact" | "has_price";
interface PublicBannerRow {
  id: string;
  position: string;
  title: string;
  description: string | null;
  display_mode: "image_only" | "content_overlay";
  content_position:
    | "top-left"
    | "top-center"
    | "top-right"
    | "mid-left"
    | "mid-center"
    | "mid-right"
    | "bot-left"
    | "bot-center"
    | "bot-right";
  title_size: "small" | "medium" | "large";
  title_color: string | null;
  description_color: string | null;
  image_file_id: string;
  image_mobile_file_id: string | null;
  link_type: "internal" | "external" | "anchor" | "none";
  link_target: string | null;
  cta_buttons: unknown;
  sort_order: number;
}
interface PublicProductImageRow {
  id: string;
  product_group_id: string;
  product_variant_id: string | null;
  file_id: string;
  alt_text: string | null;
  sort_order: number;
  file: PublicFileSummary;
}
interface PublicVariantRow {
  id: string;
  product_group_id: string;
  model_code: string | null;
  variant_name: string;
  detailed_description: string | null;
  public_price_mode: "public_price" | "contact_for_quote";
  public_price_amount: number | null;
  sort_order: number;
}
interface SharedSpecGroupRow {
  id: string;
  product_group_id: string;
  group_name: string;
  sort_order: number;
}
interface SharedSpecItemRow {
  id: string;
  spec_group_id: string;
  spec_name: string;
  spec_value: string;
  sort_order: number;
}
interface VariantSpecGroupRow {
  id: string;
  product_variant_id: string;
  group_name: string;
  sort_order: number;
}
interface VariantSpecItemRow {
  id: string;
  variant_spec_group_id: string;
  spec_name: string;
  spec_value: string;
  sort_order: number;
}
interface VariantAttributeRow {
  id: string;
  product_variant_id: string;
  attribute_name: string;
  attribute_value: string;
  display_order: number;
}
interface PublicHighlightSpecRow {
  id: string;
  product_group_id: string;
  product_variant_id: string | null;
  display_label: string;
  display_value: string;
  sort_order: number;
}
interface PublicTechnicalDocumentRow {
  id: string;
  product_group_id: string;
  product_variant_id: string | null;
  document_name: string;
  document_type: "datasheet" | "manual" | "catalogue" | "certificate" | "other";
  file_id: string;
  version: string | null;
  is_public: true;
  sort_order: number;
  file: PublicFileSummary;
}
interface PublicGroupSuggestionRow {
  id: string;
  name: string;
  slug: string;
  thumbnail_file_id: string | null;
}
interface PublicVariantSuggestionRow {
  model_code: string | null;
  variant_name: string;
  group_name: string;
  group_slug: string;
  thumbnail_file_id: string | null;
}
interface PublicSuggestionCategoryRow {
  id: string;
  name: string;
  slug: string;
  parent_name: string | null;
  parent_slug: string | null;
  icon_file_id: string | null;
}

interface PublicSuggestionBrandRow {
  id: string;
  name: string;
  slug: string;
  has_detail_page: boolean;
  logo_file_id: string | null;
}

interface PublicSuggestionServiceRow {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  thumbnail_file_id: string | null;
}

interface PublicSuggestionProjectRow {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  thumbnail_file_id: string | null;
}

interface PublicSuggestionNewsRow {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  thumbnail_file_id: string | null;
}

interface PublicSuggestionPageRow {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  thumbnail_file_id: string | null;
}
interface PublicProductSpecFacetRow {
  product_group_id: string;
  spec_name: string;
  spec_value: string;
}
interface PublicProductSpecFilterMatcher {
  spec_name: string;
  spec_value: string;
}
interface PublicProductSpecFilterSelection {
  group_key: string;
  option_key: string;
  matchers: PublicProductSpecFilterMatcher[];
}
interface CreatedContactRow {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  company_name: string | null;
  message: string;
  source_page: string | null;
  status: string;
  created_at: Date | string;
}
interface CreatedQuoteRow {
  id: string;
  full_name: string;
  company_name: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  message: string | null;
  project_name: string | null;
  project_context: string | null;
  project_requirements: Array<{ label: string; value: string }>;
  status: string;
  created_at: Date | string;
}
interface CreatedQuoteItemRow {
  id: string;
  quote_request_id: string;
  product_group_id: string;
  product_variant_id: string | null;
  quantity: number | null;
  quantity_raw: string | null;
  quantity_unit: string | null;
  quantity_state: 'confirmed' | 'unspecified';
  public_price_amount_at_request: number | null;
  notes: string | null;
}
interface CustomerProfileMatchRow {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  company_name: string | null;
  deleted_at: Date | string | null;
}
@Injectable()
export class PublicRepository {
  constructor(private readonly knexService: KnexService) {}
  async activeCompanyInfo(): Promise<CompanyInfoRow | null> {
    const row = await this.knexService
      .db<CompanyInfoRow>(COMPANY_INFO_TABLE)
      .whereNull("deleted_at")
      .orderBy("created_at", "asc")
      .first(
        "id",
        "display_name",
        "legal_name",
        "hotline",
        "hotlines",
        "email",
        "address",
        "map_embed_code",
        "working_hours_from",
        "working_hours_to",
        "working_days",
        "logo_file_id",
        "favicon_file_id",
      );
    return row ?? null;
  }
  async activeSocialLinks(companyInfoId: string): Promise<SocialLinkRow[]> {
    return this.knexService
      .db<SocialLinkRow>(COMPANY_SOCIAL_LINK_TABLE)
      .where({ company_info_id: companyInfoId, status: "active" })
      .whereNull("deleted_at")
      .select("id", "platform", "label", "url", "sort_order", "status")
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "asc");
  }
  async activeMenuByPosition(
    position:
      "header" | "footer_quick" | "footer_support" | "footer_legal" | "mobile",
  ): Promise<MenuRow | null> {
    const row = await this.knexService
      .db<MenuRow>(MENU_TABLE)
      .where({ position, status: "active" })
      .whereNull("deleted_at")
      .orderBy("created_at", "asc")
      .first("id", "name", "position");
    return row ?? null;
  }
  async activeMenuItems(menuId: string): Promise<MenuItemRow[]> {
    return this.knexService
      .db<MenuItemRow>(MENU_ITEM_TABLE)
      .where({ menu_id: menuId, status: "active" })
      .whereNull("deleted_at")
      .select(
        "id",
        "menu_id",
        "parent_id",
        "title",
        "link_type",
        "link_target",
        "sort_order",
        "open_in_new_tab",
        "icon_name",
        "description",
      )
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "asc");
  }
  async publishedSystemPageSlugs(slugs: readonly string[]): Promise<string[]> {
    if (slugs.length === 0) return [];
    const rows = await this.knexService
      .db<{ slug: string }>(PAGE_CONTENT_TABLE)
      .whereIn('slug', [...slugs])
      .where({ review_status: 'approved', publish_status: 'published' })
      .whereNull('deleted_at')
      .select('slug');
    return rows.map((row) => row.slug);
  }
  async activeFileMap(
    fileIds: Array<string | null | undefined>,
  ): Promise<Map<string, PublicFileSummary>> {
    const normalizedIds = Array.from(
      new Set(
        fileIds.filter(
          (fileId): fileId is string =>
            typeof fileId === "string" && fileId !== "",
        ),
      ),
    );
    if (normalizedIds.length === 0) return new Map();
    const rows = await this.knexService
      .db<PublicFileRecord>(FILE_METADATA_TABLE)
      .whereIn("id", normalizedIds)
      .whereNull("deleted_at")
      .select(
        "id",
        "original_filename",
        "mime_type",
        "storage_location",
        "stored_path",
      );
    return new Map(rows.map((row) => [row.id, toPublicFileSummary(row)]));
  }
  async listPublicCategories(filters: {
    q: string | null;
    parent_id: string | null;
  }): Promise<PublicCategoryRow[]> {
    const categoryAlias = "category_record";
    const parentAlias = "parent_record";
    const query = this.knexService
      .db({ [categoryAlias]: PRODUCT_CATEGORY_TABLE })
      .leftJoin(
        { [parentAlias]: PRODUCT_CATEGORY_TABLE },
        `${parentAlias}.id`,
        `${categoryAlias}.parent_id`,
      )
      .whereNull(`${categoryAlias}.deleted_at`)
      .where(`${categoryAlias}.status`, "active")
      .andWhere((builder) => {
        builder
          .whereNull(`${categoryAlias}.parent_id`)
          .orWhere((parentBuilder) => {
            parentBuilder
              .whereNotNull(`${categoryAlias}.parent_id`)
              .whereNotNull(`${parentAlias}.id`)
              .whereNull(`${parentAlias}.deleted_at`)
              .where(`${parentAlias}.status`, "active");
          });
      });
    if (filters.parent_id) {
      query.where(`${categoryAlias}.parent_id`, filters.parent_id);
    }
    if (filters.q) {
      const { textPattern, slugPattern } = publicSearchPatterns(filters.q);
      query.andWhere((builder) => {
        builder
          .whereRaw("?? ILIKE ?", [`${categoryAlias}.name`, textPattern])
          .orWhereRaw("?? ILIKE ?", [`${categoryAlias}.slug`, slugPattern]);
      });
    }
    const rows = await query
      .select(
        `${categoryAlias}.id`,
        `${categoryAlias}.name`,
        `${categoryAlias}.slug`,
        `${categoryAlias}.parent_id`,
        `${categoryAlias}.description`,
        `${categoryAlias}.icon_file_id`,
        `${categoryAlias}.sort_order`,
        `${categoryAlias}.status`,
      )
      .orderBy(`${categoryAlias}.sort_order`, "asc")
      .orderBy(`${categoryAlias}.name`, "asc");
    return rows as PublicCategoryRow[];
  }
  async publicCategoryExists(categoryId: string): Promise<boolean> {
    const categoryAlias = "category_record";
    const parentAlias = "parent_record";
    const row = await this.knexService
      .db({ [categoryAlias]: PRODUCT_CATEGORY_TABLE })
      .leftJoin(
        { [parentAlias]: PRODUCT_CATEGORY_TABLE },
        `${parentAlias}.id`,
        `${categoryAlias}.parent_id`,
      )
      .where(`${categoryAlias}.id`, categoryId)
      .whereNull(`${categoryAlias}.deleted_at`)
      .where(`${categoryAlias}.status`, "active")
      .andWhere((builder) => {
        builder
          .whereNull(`${categoryAlias}.parent_id`)
          .orWhere((parentBuilder) => {
            parentBuilder
              .whereNotNull(`${categoryAlias}.parent_id`)
              .whereNotNull(`${parentAlias}.id`)
              .whereNull(`${parentAlias}.deleted_at`)
              .where(`${parentAlias}.status`, "active");
          });
      })
      .first(`${categoryAlias}.id`);
    return Boolean(row);
  }
  async publicBrandExists(brandId: string): Promise<boolean> {
    const row = await this.knexService
      .db(BRAND_TABLE)
      .where({ id: brandId, status: "active" })
      .whereNull("deleted_at")
      .first("id");
    return Boolean(row);
  }
  async listPublicBrandsBySlugs(
    slugs: string[],
  ): Promise<PublicBrandLookupRow[]> {
    if (slugs.length === 0) {
      return [];
    }
    return (await this.knexService
      .db<PublicBrandLookupRow>(BRAND_TABLE)
      .whereIn("slug", slugs)
      .where({ status: "active" })
      .whereNull("deleted_at")
      .select("id", "slug", "name")) as PublicBrandLookupRow[];
  }
  private createPublicProductGroupScopeQuery(params: {
    q: string | null;
    category_filter_ids: string[] | null;
    brand_ids: string[] | null;
    status_filters: PublicProductGroupStatusKey[];
  }): Knex.QueryBuilder {
    const groupAlias = "group_record";
    const categoryAlias = "category_record";
    const parentAlias = "parent_record";
    const brandAlias = "brand_record";
    const query = this.knexService
      .db({ [groupAlias]: PRODUCT_GROUP_TABLE })
      .leftJoin(
        { [categoryAlias]: PRODUCT_CATEGORY_TABLE },
        `${categoryAlias}.id`,
        `${groupAlias}.category_id`,
      )
      .leftJoin(
        { [parentAlias]: PRODUCT_CATEGORY_TABLE },
        `${parentAlias}.id`,
        `${categoryAlias}.parent_id`,
      )
      .leftJoin(
        { [brandAlias]: BRAND_TABLE },
        `${brandAlias}.id`,
        `${groupAlias}.brand_id`,
      )
      .whereNull(`${groupAlias}.deleted_at`)
      .where(`${groupAlias}.status`, "active")
      .where(`${groupAlias}.review_status`, "approved")
      .where(`${groupAlias}.publish_status`, "published")
      .whereNull(`${categoryAlias}.deleted_at`)
      .where(`${categoryAlias}.status`, "active")
      .andWhere((builder) => {
        builder
          .whereNull(`${categoryAlias}.parent_id`)
          .orWhere((parentBuilder) => {
            parentBuilder
              .whereNotNull(`${categoryAlias}.parent_id`)
              .whereNotNull(`${parentAlias}.id`)
              .whereNull(`${parentAlias}.deleted_at`)
              .where(`${parentAlias}.status`, "active");
          });
      })
      .andWhere((builder) => {
        builder.whereNull(`${groupAlias}.brand_id`).orWhere((brandBuilder) => {
          brandBuilder
            .whereNotNull(`${brandAlias}.id`)
            .whereNull(`${brandAlias}.deleted_at`)
            .where(`${brandAlias}.status`, "active");
        });
      });
    if (params.category_filter_ids && params.category_filter_ids.length > 0) {
      query.whereIn(`${groupAlias}.category_id`, params.category_filter_ids);
    }
    if (params.brand_ids && params.brand_ids.length > 0) {
      query.whereIn(`${groupAlias}.brand_id`, params.brand_ids);
    }
    if (params.status_filters.length > 0) {
      query.andWhere((builder) => {
        for (const statusFilter of params.status_filters) {
          builder.orWhere((statusBuilder) => {
            if (statusFilter === "has_price") {
              statusBuilder.whereExists(
                this.buildPublicPricedVariantExistsQuery(groupAlias),
              );
              return;
            }
            statusBuilder.whereNotExists(
              this.buildPublicPricedVariantExistsQuery(groupAlias),
            );
          });
        }
      });
    }
    if (params.q) {
      const { textPattern, slugPattern } = publicSearchPatterns(params.q);
      query.andWhere((builder) => {
        builder
          .whereRaw("?? ILIKE ?", [`${groupAlias}.name`, textPattern])
          .orWhereRaw("?? ILIKE ?", [`${groupAlias}.slug`, slugPattern]);
      });
    }
    return query;
  }
  async listPublicServices(params: {
    q: string | null;
    page: number;
    page_size: number;
  }): Promise<{ items: PublicServiceRow[]; pagination: PaginationMeta }> {
    const alias = "service_record";
    const baseQuery = this.knexService
      .db({ [alias]: SERVICE_TABLE })
      .whereNull(`${alias}.deleted_at`)
      .where(`${alias}.review_status`, "approved")
      .where(`${alias}.publish_status`, "published");
    if (params.q) {
      const { textPattern, slugPattern } = publicSearchPatterns(params.q);
      baseQuery.andWhere((builder) => {
        builder
          .whereRaw("?? ILIKE ?", [`${alias}.title`, textPattern])
          .orWhereRaw("?? ILIKE ?", [`${alias}.slug`, slugPattern]);
      });
    }
    const total = await this.countDistinct(baseQuery, `${alias}.id`);
    const rows = (await baseQuery
      .clone()
      .select(
        `${alias}.id`,
        `${alias}.title`,
        `${alias}.slug`,
        `${alias}.subtitle`,
        `${alias}.description`,
        `${alias}.when_to_contact`,
        `${alias}.deliverables`,
        `${alias}.typical_duration`,
        `${alias}.sort_order`,
        `${alias}.icon_key`,
        `${alias}.image_file_id`,
        `${alias}.seo_title`,
        `${alias}.seo_description`,
      )
      .orderBy(`${alias}.sort_order`, "asc")
      .orderBy(`${alias}.updated_at`, "desc")
      .offset((params.page - 1) * params.page_size)
      .limit(params.page_size)) as PublicServiceRow[];
    return {
      items: rows,
      pagination: createPaginationMeta({
        page: params.page,
        pageSize: params.page_size,
        total,
      }),
    };
  }
  async findPublicServiceBySlug(
    slug: string,
  ): Promise<PublicServiceRow | null> {
    const row = await this.knexService
      .db<PublicServiceRow>(SERVICE_TABLE)
      .where({ slug, review_status: "approved", publish_status: "published" })
      .whereNull("deleted_at")
      .first(
        "id",
        "title",
        "slug",
        "subtitle",
        "description",
        "content_html",
        "when_to_contact",
        "deliverables",
        "typical_duration",
        "sort_order",
        "icon_key",
        "image_file_id",
        "seo_title",
        "seo_description",
      );
    return row ?? null;
  }
  async listPublicProjects(params: {
    q: string | null;
    page: number;
    page_size: number;
  }): Promise<{ items: PublicProjectRow[]; pagination: PaginationMeta }> {
    const alias = "project_record";
    const baseQuery = this.knexService
      .db({ [alias]: PROJECT_TABLE })
      .whereNull(`${alias}.deleted_at`)
      .where(`${alias}.review_status`, "approved")
      .where(`${alias}.publish_status`, "published");
    if (params.q) {
      const { textPattern, slugPattern } = publicSearchPatterns(params.q);
      baseQuery.andWhere((builder) => {
        builder
          .whereRaw("?? ILIKE ?", [`${alias}.title`, textPattern])
          .orWhereRaw("?? ILIKE ?", [`${alias}.slug`, slugPattern])
          .orWhereRaw("?? ILIKE ?", [`${alias}.location`, textPattern])
          .orWhereRaw("?? ILIKE ?", [`${alias}.client_name`, textPattern]);
      });
    }
    const total = await this.countDistinct(baseQuery, `${alias}.id`);
    const rows = (await baseQuery
      .clone()
      .select(
        `${alias}.id`,
        `${alias}.title`,
        `${alias}.slug`,
        `${alias}.location`,
        `${alias}.project_year`,
        `${alias}.client_name`,
        `${alias}.description`,
        `${alias}.image_file_id`,
        `${alias}.seo_title`,
        `${alias}.seo_description`,
      )
      .orderBy(`${alias}.project_year`, "desc")
      .orderBy(`${alias}.updated_at`, "desc")
      .offset((params.page - 1) * params.page_size)
      .limit(params.page_size)) as PublicProjectRow[];
    return {
      items: rows,
      pagination: createPaginationMeta({
        page: params.page,
        pageSize: params.page_size,
        total,
      }),
    };
  }
  async findPublicProjectBySlug(
    slug: string,
  ): Promise<PublicProjectRow | null> {
    const row = await this.knexService
      .db<PublicProjectRow>(PROJECT_TABLE)
      .where({ slug, review_status: "approved", publish_status: "published" })
      .whereNull("deleted_at")
      .first(
        "id",
        "title",
        "slug",
        "location",
        "project_year",
        "client_name",
        "description",
        "content_html",
        "image_file_id",
        "seo_title",
        "seo_description",
      );
    return row ?? null;
  }
  async listPublicBrands(params: {
    q: string | null;
    page: number;
    page_size: number;
  }): Promise<{ items: PublicBrandListRow[]; pagination: PaginationMeta }> {
    const alias = "brand_record";
    const baseQuery = this.knexService
      .db({ [alias]: BRAND_TABLE })
      .whereNull(`${alias}.deleted_at`)
      .where(`${alias}.status`, "active");
    if (params.q) {
      const { textPattern, slugPattern } = publicSearchPatterns(params.q);
      baseQuery.andWhere((builder) => {
        builder
          .whereRaw("?? ILIKE ?", [`${alias}.name`, textPattern])
          .orWhereRaw("?? ILIKE ?", [`${alias}.slug`, slugPattern]);
      });
    }
    const total = await this.countDistinct(baseQuery, `${alias}.id`);
    const rows = (await baseQuery
      .clone()
      .select(
        `${alias}.id`,
        `${alias}.name`,
        `${alias}.slug`,
        `${alias}.description`,
        `${alias}.website_url`,
        `${alias}.logo_file_id`,
        `${alias}.sort_order`,
        this.knexService.db.raw(
          `EXISTS (            SELECT 1 FROM ${BRAND_PAGE_TABLE} brand_page_public            WHERE brand_page_public.brand_id = ${alias}.id              AND brand_page_public.review_status = 'approved'              AND brand_page_public.publish_status = 'published'              AND brand_page_public.deleted_at IS NULL          ) as has_detail_page`,
        ),
      )
      .orderBy(`${alias}.sort_order`, "asc")
      .orderBy(`${alias}.name`, "asc")
      .offset((params.page - 1) * params.page_size)
      .limit(params.page_size)) as PublicBrandListRow[];
    return {
      items: rows,
      pagination: createPaginationMeta({
        page: params.page,
        pageSize: params.page_size,
        total,
      }),
    };
  }
  async findPublicBrandDetailBySlug(
    slug: string,
  ): Promise<PublicBrandDetailRow | null> {
    const brandAlias = "brand_record";
    const pageAlias = "brand_page_record";
    const row = await this.knexService
      .db({ [brandAlias]: BRAND_TABLE })
      .join(
        { [pageAlias]: BRAND_PAGE_TABLE },
        `${pageAlias}.brand_id`,
        `${brandAlias}.id`,
      )
      .where(`${brandAlias}.slug`, slug)
      .where(`${brandAlias}.status`, "active")
      .whereNull(`${brandAlias}.deleted_at`)
      .where(`${pageAlias}.review_status`, "approved")
      .where(`${pageAlias}.publish_status`, "published")
      .whereNull(`${pageAlias}.deleted_at`)
      .first(
        `${brandAlias}.id as brand_id`,
        `${brandAlias}.name as brand_name`,
        `${brandAlias}.slug as brand_slug`,
        `${brandAlias}.description as brand_description`,
        `${brandAlias}.website_url as brand_website_url`,
        `${brandAlias}.logo_file_id as brand_logo_file_id`,
        `${pageAlias}.id as page_id`,
        `${pageAlias}.title`,
        `${pageAlias}.excerpt`,
        `${pageAlias}.overview_title`,
        `${pageAlias}.overview_body`,
        `${pageAlias}.support_title`,
        `${pageAlias}.support_intro`,
        `${pageAlias}.support_items`,
        `${pageAlias}.support_image_file_id`,
        `${pageAlias}.hero_banner_id`,
        `${pageAlias}.hero_title_size`,
        `${pageAlias}.hero_excerpt_size`,
        `${pageAlias}.hero_eyebrow_color`,
        `${pageAlias}.hero_title_color`,
        `${pageAlias}.hero_excerpt_color`,
        `${pageAlias}.accent_color`,
        `${pageAlias}.layout_archetype`,
        `${pageAlias}.cta_title`,
        `${pageAlias}.cta_description`,
        `${pageAlias}.cta_button_label`,
        `${pageAlias}.cta_button_url`,
        `${pageAlias}.seo_title`,
        `${pageAlias}.seo_description`,
        `${pageAlias}.seo_og_image_file_id`,
      );
    return (row as PublicBrandDetailRow | undefined) ?? null;
  }
  async publicBrandHeroBanner(
    bannerId: string | null,
  ): Promise<PublicBannerRow | null> {
    if (!bannerId) return null;
    const row = await this.knexService
      .db<PublicBannerRow>(BANNER_TABLE)
      .where({ id: bannerId, status: "active" })
      .whereNull("deleted_at")
      .first(
        "id",
        "position",
        "title",
        "description",
        "display_mode",
        "content_position",
        "title_size",
        "title_color",
        "description_color",
        "image_file_id",
        "image_mobile_file_id",
        "link_type",
        "link_target",
        "cta_buttons",
        "sort_order",
      );
    return row ?? null;
  }
  async listPublicBrandStats(pageId: string): Promise<PublicBrandStatRow[]> {
    return this.knexService
      .db<PublicBrandStatRow>(BRAND_PAGE_STAT_TABLE)
      .where({ brand_page_id: pageId, status: "active", is_verified: true })
      .whereNull("deleted_at")
      .andWhere((builder) => {
        builder
          .whereNotNull("source_file_id")
          .orWhereRaw("coalesce(btrim(source_url), '') <> ''");
      })
      .select("id", "value", "label", "note", "sort_order")
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "asc");
  }
  async listPublicBrandSources(
    pageId: string,
  ): Promise<PublicBrandSourceRow[]> {
    return this.knexService
      .db<PublicBrandSourceRow>(BRAND_PAGE_SOURCE_TABLE)
      .where({ brand_page_id: pageId, status: "active" })
      .whereNull("deleted_at")
      .select(
        "id",
        "title",
        "source_type",
        "url",
        "file_id",
        "description",
        "sort_order",
      )
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "asc");
  }
  async listPublicBrandDerivedCategories(
    brandId: string,
  ): Promise<PublicBrandDerivedCategoryRow[]> {
    const groupAlias = "group_record";
    const categoryAlias = "category_record";
    return this.knexService
      .db({ [groupAlias]: PRODUCT_GROUP_TABLE })
      .join(
        { [categoryAlias]: PRODUCT_CATEGORY_TABLE },
        `${categoryAlias}.id`,
        `${groupAlias}.category_id`,
      )
      .where(`${groupAlias}.brand_id`, brandId)
      .where(`${groupAlias}.status`, "active")
      .where(`${groupAlias}.review_status`, "approved")
      .where(`${groupAlias}.publish_status`, "published")
      .whereNull(`${groupAlias}.deleted_at`)
      .where(`${categoryAlias}.status`, "active")
      .whereNull(`${categoryAlias}.deleted_at`)
      .select(
        `${categoryAlias}.id`,
        `${categoryAlias}.name`,
        `${categoryAlias}.slug`,
        `${categoryAlias}.parent_id`,
      )
      .count<{ product_count: string | number }[]>({
        product_count: `${groupAlias}.id`,
      })
      .groupBy(
        `${categoryAlias}.id`,
        `${categoryAlias}.name`,
        `${categoryAlias}.slug`,
        `${categoryAlias}.parent_id`,
      )
      .orderBy(`${categoryAlias}.sort_order`, "asc")
      .orderBy(`${categoryAlias}.name`, "asc") as Promise<
      PublicBrandDerivedCategoryRow[]
    >;
  }
  async listPublicBrandPinnedProducts(
    pageId: string,
    brandId: string,
  ): Promise<PublicProductGroupListRow[]> {
    const featuredAlias = "featured_record";
    const groupAlias = "group_record";
    const categoryAlias = "category_record";
    const parentAlias = "parent_record";
    const brandAlias = "brand_record";
    const rows = await this.knexService
      .db({ [featuredAlias]: BRAND_PAGE_FEATURED_PRODUCT_GROUP_TABLE })
      .join(
        { [groupAlias]: PRODUCT_GROUP_TABLE },
        `${groupAlias}.id`,
        `${featuredAlias}.product_group_id`,
      )
      .leftJoin(
        { [categoryAlias]: PRODUCT_CATEGORY_TABLE },
        `${categoryAlias}.id`,
        `${groupAlias}.category_id`,
      )
      .leftJoin(
        { [parentAlias]: PRODUCT_CATEGORY_TABLE },
        `${parentAlias}.id`,
        `${categoryAlias}.parent_id`,
      )
      .leftJoin(
        { [brandAlias]: BRAND_TABLE },
        `${brandAlias}.id`,
        `${groupAlias}.brand_id`,
      )
      .where(`${featuredAlias}.brand_page_id`, pageId)
      .whereNull(`${featuredAlias}.deleted_at`)
      .where(`${groupAlias}.brand_id`, brandId)
      .where(`${groupAlias}.status`, "active")
      .where(`${groupAlias}.review_status`, "approved")
      .where(`${groupAlias}.publish_status`, "published")
      .whereNull(`${groupAlias}.deleted_at`)
      .where(`${brandAlias}.status`, "active")
      .whereNull(`${brandAlias}.deleted_at`)
      .select(
        `${groupAlias}.id`,
        `${groupAlias}.name`,
        `${groupAlias}.slug`,
        `${groupAlias}.category_id`,
        `${categoryAlias}.name as category_name`,
        `${parentAlias}.id as category_level_1_id`,
        `${parentAlias}.name as category_level_1_name`,
        `${categoryAlias}.id as category_level_2_id`,
        `${categoryAlias}.name as category_level_2_name`,
        `${groupAlias}.brand_id`,
        `${brandAlias}.slug as brand_slug`,
        `${brandAlias}.name as brand_name`,
        `${groupAlias}.short_description`,
        `${groupAlias}.detailed_description`,
        `${groupAlias}.thumbnail_file_id`,
        `${groupAlias}.review_status`,
        `${groupAlias}.publish_status`,
        `${groupAlias}.status`,
        `${groupAlias}.sort_order`,
      )
      .orderBy(`${featuredAlias}.sort_order`, "asc")
      .limit(12);
    return (rows as PublicProductGroupListRow[]).map((row) =>
      this.normalizeCategoryPath(row),
    );
  }
  async findPublicPageContentBySlug(
    slug: string,
  ): Promise<
    (PublicPageContentRow & { category: PublicNewsCategoryRow | null }) | null
  > {
    const alias = "pc";
    const catAlias = "nc";
    const row = await this.knexService
      .db({ [alias]: PAGE_CONTENT_TABLE })
      .leftJoin({ [catAlias]: "news_category" }, function () {
        this.on(`${alias}.news_category_id`, `${catAlias}.id`).andOnNull(
          `${catAlias}.deleted_at`,
        );
      })
      .where({
        [`${alias}.slug`]: slug,
        [`${alias}.review_status`]: "approved",
        [`${alias}.publish_status`]: "published",
      })
      .whereNull(`${alias}.deleted_at`)
      .select(
        `${alias}.id`,
        `${alias}.title`,
        `${alias}.slug`,
        `${alias}.content_type`,
        `${alias}.excerpt`,
        `${alias}.content_html`,
        `${alias}.featured_image_file_id`,
        `${alias}.seo_title`,
        `${alias}.seo_description`,
        `${alias}.news_category_id`,
        `${alias}.published_at`,
        `${alias}.is_featured`,
        `${alias}.extra_blocks`,
        `${alias}.created_at`,
        `${alias}.updated_at`,
        this.knexService.db.raw(
          `          CASE WHEN ${catAlias}.id IS NOT NULL THEN json_build_object(            'id', ${catAlias}.id,            'name', ${catAlias}.name,            'slug', ${catAlias}.slug,            'sort_order', ${catAlias}.sort_order          ) ELSE NULL END as category        `,
        ),
      )
      .first();
    return (
      (row as
        | (PublicPageContentRow & { category: PublicNewsCategoryRow | null })
        | undefined) ?? null
    );
  }
  async listPublicNews(params: {
    page: number;
    limit: number;
    category_slug: string | null;
    q: string | null;
  }): Promise<{
    items: (PublicPageContentRow & {
      category: PublicNewsCategoryRow | null;
    })[];
    total: number;
  }> {
    const alias = "pc";
    const catAlias = "nc";
    const baseQuery = this.knexService
      .db({ [alias]: PAGE_CONTENT_TABLE })
      .leftJoin({ [catAlias]: "news_category" }, function () {
        this.on(`${alias}.news_category_id`, `${catAlias}.id`).andOnNull(
          `${catAlias}.deleted_at`,
        );
      })
      .whereNull(`${alias}.deleted_at`)
      .where(`${alias}.content_type`, "news")
      .where(`${alias}.review_status`, "approved")
      .where(`${alias}.publish_status`, "published");
    if (params.category_slug) {
      baseQuery.where(`${catAlias}.slug`, params.category_slug);
    }
    if (params.q) {
      const { textPattern, slugPattern } = publicSearchPatterns(params.q);
      baseQuery.andWhere((builder) => {
        builder
          .whereRaw(`${alias}.title ILIKE ?`, [textPattern])
          .orWhereRaw(`${alias}.excerpt ILIKE ?`, [textPattern])
          .orWhereRaw(`${alias}.slug ILIKE ?`, [slugPattern]);
      });
    }
    const total = await this.countDistinct(baseQuery, `${alias}.id`);
    const rows = await baseQuery
      .clone()
      .select(
        `${alias}.id`,
        `${alias}.title`,
        `${alias}.slug`,
        `${alias}.content_type`,
        `${alias}.excerpt`,
        `${alias}.content_html`,
        `${alias}.featured_image_file_id`,
        `${alias}.seo_title`,
        `${alias}.seo_description`,
        `${alias}.news_category_id`,
        `${alias}.published_at`,
        `${alias}.is_featured`,
        `${alias}.created_at`,
        `${alias}.updated_at`,
        this.knexService.db.raw(
          `          CASE WHEN ${catAlias}.id IS NOT NULL THEN json_build_object(            'id', ${catAlias}.id,            'name', ${catAlias}.name,            'slug', ${catAlias}.slug,            'sort_order', ${catAlias}.sort_order          ) ELSE NULL END as category        `,
        ),
      )
      .orderByRaw(`${alias}.is_featured DESC NULLS LAST`)
      .orderByRaw(`COALESCE(${alias}.published_at, ${alias}.created_at) DESC`)
      .offset((params.page - 1) * params.limit)
      .limit(params.limit);
    return {
      items: rows as (PublicPageContentRow & {
        category: PublicNewsCategoryRow | null;
      })[],
      total,
    };
  }
  async listPublicNewsCategories(): Promise<PublicNewsCategoryRow[]> {
    return this.knexService
      .db<PublicNewsCategoryRow>("news_category")
      .whereNull("deleted_at")
      .select("id", "name", "slug", "sort_order")
      .orderBy("sort_order", "asc")
      .orderBy("name", "asc");
  }
  async listRelatedNews(params: {
    category_slug: string | null;
    exclude_slug: string | null;
    limit: number;
  }): Promise<
    (PublicPageContentRow & { category: PublicNewsCategoryRow | null })[]
  > {
    const alias = "pc";
    const catAlias = "nc";
    const query = this.knexService
      .db({ [alias]: PAGE_CONTENT_TABLE })
      .leftJoin({ [catAlias]: "news_category" }, function () {
        this.on(`${alias}.news_category_id`, `${catAlias}.id`).andOnNull(
          `${catAlias}.deleted_at`,
        );
      })
      .whereNull(`${alias}.deleted_at`)
      .where(`${alias}.content_type`, "news")
      .where(`${alias}.review_status`, "approved")
      .where(`${alias}.publish_status`, "published");
    if (params.category_slug) {
      query.where(`${catAlias}.slug`, params.category_slug);
    }
    if (params.exclude_slug) {
      query.whereNot(`${alias}.slug`, params.exclude_slug);
    }
    const rows = await query
      .select(
        `${alias}.id`,
        `${alias}.title`,
        `${alias}.slug`,
        `${alias}.content_type`,
        `${alias}.excerpt`,
        `${alias}.featured_image_file_id`,
        `${alias}.published_at`,
        `${alias}.is_featured`,
        `${alias}.created_at`,
        `${alias}.updated_at`,
        this.knexService.db.raw(
          `          CASE WHEN ${catAlias}.id IS NOT NULL THEN json_build_object(            'id', ${catAlias}.id,            'name', ${catAlias}.name,            'slug', ${catAlias}.slug,            'sort_order', ${catAlias}.sort_order          ) ELSE NULL END as category        `,
        ),
      )
      .orderByRaw(`COALESCE(${alias}.published_at, ${alias}.created_at) DESC`)
      .limit(params.limit);
    return rows as (PublicPageContentRow & {
      category: PublicNewsCategoryRow | null;
    })[];
  }
  async listPublicBanners(filters: {
    position: string | null;
    ids?: string[] | null;
  }): Promise<PublicBannerRow[]> {
    const alias = "banner_record";
    const query = this.knexService
      .db({ [alias]: BANNER_TABLE })
      .whereNull(`${alias}.deleted_at`)
      .where(`${alias}.status`, "active");
    if (filters.position) {
      query.where(`${alias}.position`, filters.position);
    }
    if (filters.ids && filters.ids.length > 0) {
      query.whereIn(`${alias}.id`, filters.ids);
    }
    const rows = (await query
      .select(
        `${alias}.id`,
        `${alias}.position`,
        `${alias}.title`,
        `${alias}.description`,
        `${alias}.display_mode`,
        `${alias}.content_position`,
        `${alias}.title_size`,
        `${alias}.title_color`,
        `${alias}.description_color`,
        `${alias}.image_file_id`,
        `${alias}.image_mobile_file_id`,
        `${alias}.link_type`,
        `${alias}.link_target`,
        `${alias}.cta_buttons`,
        `${alias}.sort_order`,
      )
      .orderBy(`${alias}.position`, "asc")
      .orderBy(`${alias}.sort_order`, "asc")
      .orderBy(`${alias}.updated_at`, "desc")) as PublicBannerRow[];
    return rows;
  }
  async listPublicProductGroups(params: {
    q: string | null;
    category_id: string | null;
    brand_ids: string[] | null;
    status_filters: PublicProductGroupStatusKey[];
    spec_filters: PublicProductSpecFilterSelection[];
    sort: "newest" | "popular" | "name_asc" | "name_desc" | null;
    page: number;
    page_size: number;
  }): Promise<{
    items: PublicProductGroupListRow[];
    pagination: PaginationMeta;
  }> {
    const groupAlias = "group_record";
    const categoryAlias = "category_record";
    const parentAlias = "parent_record";
    const brandAlias = "brand_record";
    const categoryFilterIds = params.category_id
      ? await this.listPublicCategoryFilterIds(params.category_id)
      : null;
    const baseQuery = this.createPublicProductGroupScopeQuery({
      q: params.q,
      category_filter_ids: categoryFilterIds,
      brand_ids: params.brand_ids,
      status_filters: params.status_filters,
    });
    if (params.spec_filters.length > 0) {
      this.applyPublicProductSpecFilters(
        baseQuery,
        groupAlias,
        params.spec_filters,
      );
    }
    const total = await this.countDistinct(baseQuery, `${groupAlias}.id`);
    const rows = await baseQuery
      .clone()
      .select(
        `${groupAlias}.id`,
        `${groupAlias}.name`,
        `${groupAlias}.slug`,
        `${groupAlias}.category_id`,
        `${categoryAlias}.name as category_name`,
        `${parentAlias}.id as category_level_1_id`,
        `${parentAlias}.name as category_level_1_name`,
        `${categoryAlias}.id as category_level_2_id`,
        `${categoryAlias}.name as category_level_2_name`,
        `${groupAlias}.brand_id`,
        `${brandAlias}.slug as brand_slug`,
        `${brandAlias}.name as brand_name`,
        `${groupAlias}.short_description`,
        `${groupAlias}.detailed_description`,
        `${groupAlias}.thumbnail_file_id`,
        `${groupAlias}.review_status`,
        `${groupAlias}.publish_status`,
        `${groupAlias}.status`,
        `${groupAlias}.sort_order`,
      )
      .modify((queryBuilder: Knex.QueryBuilder) => {
        if (params.sort === "popular") {
          queryBuilder
            .orderByRaw(`coalesce(${groupAlias}.view_count, 0) desc`)
            .orderBy(`${groupAlias}.created_at`, "desc")
            .orderBy(`${groupAlias}.updated_at`, "desc")
            .orderBy(`${groupAlias}.sort_order`, "asc")
            .orderBy(`${groupAlias}.id`, "asc");
          return;
        }
        if (params.sort === "newest") {
          queryBuilder
            .orderBy(`${groupAlias}.created_at`, "desc")
            .orderBy(`${groupAlias}.updated_at`, "desc")
            .orderBy(`${groupAlias}.sort_order`, "asc")
            .orderBy(`${groupAlias}.id`, "asc");
          return;
        }
        if (params.sort === "name_asc") {
          queryBuilder
            .orderByRaw(`${groupAlias}.name COLLATE "C" asc`)
            .orderBy(`${groupAlias}.sort_order`, "asc")
            .orderBy(`${groupAlias}.id`, "asc");
          return;
        }
        if (params.sort === "name_desc") {
          queryBuilder
            .orderByRaw(`${groupAlias}.name COLLATE "C" desc`)
            .orderBy(`${groupAlias}.sort_order`, "asc")
            .orderBy(`${groupAlias}.id`, "asc");
          return;
        }
        queryBuilder
          .orderBy(`${groupAlias}.sort_order`, "asc")
          .orderBy(`${groupAlias}.updated_at`, "desc")
          .orderBy(`${groupAlias}.id`, "asc");
      })
      .offset((params.page - 1) * params.page_size)
      .limit(params.page_size);
    return {
      items: (rows as PublicProductGroupListRow[]).map((row) =>
        this.normalizeCategoryPath(row),
      ),
      pagination: createPaginationMeta({
        page: params.page,
        pageSize: params.page_size,
        total,
      }),
    };
  }
  async listPublicProductGroupSpecFacetRows(params: {
    q: string | null;
    category_id: string | null;
    brand_ids: string[] | null;
    status_filters: PublicProductGroupStatusKey[];
    spec_filters: PublicProductSpecFilterSelection[];
  }): Promise<PublicProductSpecFacetRow[]> {
    const categoryFilterIds = params.category_id
      ? await this.listPublicCategoryFilterIds(params.category_id)
      : null;
    const baseQuery = this.createPublicProductGroupScopeQuery({
      q: params.q,
      category_filter_ids: categoryFilterIds,
      brand_ids: params.brand_ids,
      status_filters: params.status_filters,
    });
    if (params.spec_filters.length > 0) {
      this.applyPublicProductSpecFilters(
        baseQuery,
        "group_record",
        params.spec_filters,
      );
    }
    const scopedGroupIdsQuery = baseQuery
      .clone()
      .clearSelect()
      .clearOrder()
      .select("group_record.id");
    const [sharedSpecRows, variantSpecRows, variantAttributeRows] =
      await Promise.all([
        this.knexService
          .db({ spec_group_record: SPEC_GROUP_TABLE })
          .innerJoin(
            { product_spec_record: PRODUCT_SPEC_TABLE },
            "product_spec_record.spec_group_id",
            "spec_group_record.id",
          )
          .whereIn(
            "spec_group_record.product_group_id",
            scopedGroupIdsQuery.clone(),
          )
          .whereNull("spec_group_record.deleted_at")
          .whereNull("product_spec_record.deleted_at")
          .distinct(
            "spec_group_record.product_group_id as product_group_id",
            "product_spec_record.spec_name as spec_name",
            "product_spec_record.spec_value as spec_value",
          ),
        this.knexService
          .db({ variant_spec_group_record: VARIANT_SPEC_GROUP_TABLE })
          .innerJoin(
            { variant_record: PRODUCT_VARIANT_TABLE },
            "variant_record.id",
            "variant_spec_group_record.product_variant_id",
          )
          .innerJoin(
            { variant_spec_record: VARIANT_SPEC_TABLE },
            "variant_spec_record.variant_spec_group_id",
            "variant_spec_group_record.id",
          )
          .whereIn(
            "variant_record.product_group_id",
            scopedGroupIdsQuery.clone(),
          )
          .whereNull("variant_spec_group_record.deleted_at")
          .whereNull("variant_spec_record.deleted_at")
          .whereNull("variant_record.deleted_at")
          .where({
            "variant_record.status": "active",
            "variant_record.review_status": "approved",
            "variant_record.publish_status": "published",
          })
          .distinct(
            "variant_record.product_group_id as product_group_id",
            "variant_spec_record.spec_name as spec_name",
            "variant_spec_record.spec_value as spec_value",
          ),
        this.knexService
          .db({ variant_attribute_record: VARIANT_ATTRIBUTE_TABLE })
          .innerJoin(
            { variant_record: PRODUCT_VARIANT_TABLE },
            "variant_record.id",
            "variant_attribute_record.product_variant_id",
          )
          .whereIn(
            "variant_record.product_group_id",
            scopedGroupIdsQuery.clone(),
          )
          .whereNull("variant_attribute_record.deleted_at")
          .whereNull("variant_record.deleted_at")
          .where({
            "variant_record.status": "active",
            "variant_record.review_status": "approved",
            "variant_record.publish_status": "published",
          })
          .distinct(
            "variant_record.product_group_id as product_group_id",
            "variant_attribute_record.attribute_name as spec_name",
            "variant_attribute_record.attribute_value as spec_value",
          ),
      ]);
    return [
      ...(sharedSpecRows as PublicProductSpecFacetRow[]),
      ...(variantSpecRows as PublicProductSpecFacetRow[]),
      ...(variantAttributeRows as PublicProductSpecFacetRow[]),
    ];
  }
  async listPublicProductSpecRowsForGroups(
    productGroupIds: string[],
  ): Promise<PublicProductSpecFacetRow[]> {
    const ids = [...new Set(productGroupIds)].filter(Boolean);
    if (ids.length === 0) {
      return [];
    }

    const [sharedSpecRows, variantSpecRows, variantAttributeRows] =
      await Promise.all([
        this.knexService
          .db({ spec_group_record: SPEC_GROUP_TABLE })
          .innerJoin(
            { product_spec_record: PRODUCT_SPEC_TABLE },
            "product_spec_record.spec_group_id",
            "spec_group_record.id",
          )
          .whereIn("spec_group_record.product_group_id", ids)
          .whereNull("spec_group_record.deleted_at")
          .whereNull("product_spec_record.deleted_at")
          .distinct(
            "spec_group_record.product_group_id as product_group_id",
            "product_spec_record.spec_name as spec_name",
            "product_spec_record.spec_value as spec_value",
          ),
        this.knexService
          .db({ variant_spec_group_record: VARIANT_SPEC_GROUP_TABLE })
          .innerJoin(
            { variant_record: PRODUCT_VARIANT_TABLE },
            "variant_record.id",
            "variant_spec_group_record.product_variant_id",
          )
          .innerJoin(
            { variant_spec_record: VARIANT_SPEC_TABLE },
            "variant_spec_record.variant_spec_group_id",
            "variant_spec_group_record.id",
          )
          .whereIn("variant_record.product_group_id", ids)
          .whereNull("variant_spec_group_record.deleted_at")
          .whereNull("variant_spec_record.deleted_at")
          .whereNull("variant_record.deleted_at")
          .where({
            "variant_record.status": "active",
            "variant_record.review_status": "approved",
            "variant_record.publish_status": "published",
          })
          .distinct(
            "variant_record.product_group_id as product_group_id",
            "variant_spec_record.spec_name as spec_name",
            "variant_spec_record.spec_value as spec_value",
          ),
        this.knexService
          .db({ variant_attribute_record: VARIANT_ATTRIBUTE_TABLE })
          .innerJoin(
            { variant_record: PRODUCT_VARIANT_TABLE },
            "variant_record.id",
            "variant_attribute_record.product_variant_id",
          )
          .whereIn("variant_record.product_group_id", ids)
          .whereNull("variant_attribute_record.deleted_at")
          .whereNull("variant_record.deleted_at")
          .where({
            "variant_record.status": "active",
            "variant_record.review_status": "approved",
            "variant_record.publish_status": "published",
          })
          .distinct(
            "variant_record.product_group_id as product_group_id",
            "variant_attribute_record.attribute_name as spec_name",
            "variant_attribute_record.attribute_value as spec_value",
          ),
      ]);

    return [
      ...(sharedSpecRows as PublicProductSpecFacetRow[]),
      ...(variantSpecRows as PublicProductSpecFacetRow[]),
      ...(variantAttributeRows as PublicProductSpecFacetRow[]),
    ];
  }
  async listPublicProductGroupBrandFacetRows(params: {
    q: string | null;
    category_id: string | null;
    brand_ids: string[] | null;
    status_filters: PublicProductGroupStatusKey[];
    spec_filters: PublicProductSpecFilterSelection[];
  }): Promise<PublicProductGroupBrandFacetRow[]> {
    const categoryFilterIds = params.category_id
      ? await this.listPublicCategoryFilterIds(params.category_id)
      : null;
    const baseQuery = this.createPublicProductGroupScopeQuery({
      q: params.q,
      category_filter_ids: categoryFilterIds,
      brand_ids: params.brand_ids,
      status_filters: params.status_filters,
    });
    if (params.spec_filters.length > 0) {
      this.applyPublicProductSpecFilters(
        baseQuery,
        "group_record",
        params.spec_filters,
      );
    }
    const scopedGroupIdsQuery = baseQuery
      .clone()
      .clearSelect()
      .clearOrder()
      .select("group_record.id");
    const rows = (await this.knexService
      .db({ group_record: PRODUCT_GROUP_TABLE })
      .innerJoin(
        { brand_record: BRAND_TABLE },
        "brand_record.id",
        "group_record.brand_id",
      )
      .whereIn("group_record.id", scopedGroupIdsQuery)
      .whereNull("group_record.deleted_at")
      .whereNull("brand_record.deleted_at")
      .where("brand_record.status", "active")
      .groupBy("brand_record.id", "brand_record.slug", "brand_record.name")
      .select(
        "brand_record.id",
        "brand_record.slug",
        "brand_record.name as label",
      )
      .countDistinct({ total: "group_record.id" })) as Array<{
      id: string;
      slug: string;
      label: string;
      total: string | number;
    }>;
    return rows
      .map((row) => ({
        id: row.id,
        slug: row.slug,
        label: row.label,
        count: Number(row.total ?? 0),
      }))
      .sort((left, right) =>
        left.label.localeCompare(right.label, "vi", { sensitivity: "base" }),
      );
  }
  async listPublicProductGroupChildCategoryFacetRows(params: {
    q: string | null;
    category_id: string | null;
    brand_ids: string[] | null;
    status_filters: PublicProductGroupStatusKey[];
    spec_filters: PublicProductSpecFilterSelection[];
  }): Promise<Array<{ category_id: string; count: number }>> {
    const categoryFilterIds = params.category_id
      ? await this.listPublicCategoryFilterIds(params.category_id)
      : null;
    const baseQuery = this.createPublicProductGroupScopeQuery({
      q: params.q,
      category_filter_ids: categoryFilterIds,
      brand_ids: params.brand_ids,
      status_filters: params.status_filters,
    });
    if (params.spec_filters.length > 0) {
      this.applyPublicProductSpecFilters(
        baseQuery,
        "group_record",
        params.spec_filters,
      );
    }
    const rows = (await baseQuery
      .clone()
      .clearSelect()
      .clearOrder()
      .select("group_record.category_id as category_id")
      .groupBy("group_record.category_id")
      .countDistinct({ total: "group_record.id" })) as Array<{
      category_id: string;
      total: string | number;
    }>;
    return rows.map((row) => ({
      category_id: row.category_id,
      count: Number(row.total ?? 0),
    }));
  }
  async listPublicProductGroupStatusFacetRows(params: {
    q: string | null;
    category_id: string | null;
    brand_ids: string[] | null;
    status_filters: PublicProductGroupStatusKey[];
    spec_filters: PublicProductSpecFilterSelection[];
  }): Promise<
    Array<{ key: PublicProductGroupStatusKey; label: string; count: number }>
  > {
    const categoryFilterIds = params.category_id
      ? await this.listPublicCategoryFilterIds(params.category_id)
      : null;
    const baseQuery = this.createPublicProductGroupScopeQuery({
      q: params.q,
      category_filter_ids: categoryFilterIds,
      brand_ids: params.brand_ids,
      status_filters: params.status_filters,
    });
    if (params.spec_filters.length > 0) {
      this.applyPublicProductSpecFilters(
        baseQuery,
        "group_record",
        params.spec_filters,
      );
    }
    const scopedGroupIdsQuery = baseQuery
      .clone()
      .clearSelect()
      .clearOrder()
      .select("group_record.id");
    const contactCount = await this.countDistinct(
      this.knexService
        .db({ group_record: PRODUCT_GROUP_TABLE })
        .whereIn("group_record.id", scopedGroupIdsQuery.clone())
        .whereNull("group_record.deleted_at")
        .whereNotExists(
          this.buildPublicPricedVariantExistsQuery("group_record"),
        ),
      "group_record.id",
    );
    const hasPriceCount = await this.countDistinct(
      this.knexService
        .db({ group_record: PRODUCT_GROUP_TABLE })
        .whereIn("group_record.id", scopedGroupIdsQuery.clone())
        .whereNull("group_record.deleted_at")
        .whereExists(this.buildPublicPricedVariantExistsQuery("group_record")),
      "group_record.id",
    );
    return [
      { key: "contact", label: "Liên hệ báo giá", count: contactCount },
      { key: "has_price", label: "Có giá công khai", count: hasPriceCount },
    ];
  }
  async incrementPublicProductGroupViewCount(
    productGroupId: string,
  ): Promise<number> {
    const rows = (await this.knexService
      .db(PRODUCT_GROUP_TABLE)
      .where({ id: productGroupId })
      .whereNull("deleted_at")
      .where("status", "active")
      .where("review_status", "approved")
      .where("publish_status", "published")
      .update({
        view_count: this.knexService.db.raw("coalesce(view_count, 0) + 1"),
      })
      .returning("view_count")) as Array<{ view_count: number | string }>;
    return Number(rows[0]?.view_count ?? 0);
  }
  async listPublicSearchSuggestions(params: {
    q: string;
    group_limit: number;
    variant_limit: number;
    secondary_limit: number;
  }): Promise<{
    groups: PublicGroupSuggestionRow[];
    variants: PublicVariantSuggestionRow[];
    categories: PublicSuggestionCategoryRow[];
    brands: PublicSuggestionBrandRow[];
    services: PublicSuggestionServiceRow[];
    projects: PublicSuggestionProjectRow[];
    news: PublicSuggestionNewsRow[];
    pages: PublicSuggestionPageRow[];
  }> {
    const groupAlias = "group_record";
    const categoryAlias = "category_record";
    const parentAlias = "parent_record";
    const brandAlias = "brand_record";
    const variantAlias = "variant_record";
    const {
      textPattern: searchPattern,
      textPrefixPattern: prefixPattern,
      slugQuery,
      slugPattern: slugSearchPattern,
      slugPrefixPattern,
    } = publicSearchPatterns(params.q);
    const groups = (await this.knexService
      .db({ [groupAlias]: PRODUCT_GROUP_TABLE })
      .leftJoin(
        { [categoryAlias]: PRODUCT_CATEGORY_TABLE },
        `${categoryAlias}.id`,
        `${groupAlias}.category_id`,
      )
      .leftJoin(
        { [parentAlias]: PRODUCT_CATEGORY_TABLE },
        `${parentAlias}.id`,
        `${categoryAlias}.parent_id`,
      )
      .leftJoin(
        { [brandAlias]: BRAND_TABLE },
        `${brandAlias}.id`,
        `${groupAlias}.brand_id`,
      )
      .whereNull(`${groupAlias}.deleted_at`)
      .where(`${groupAlias}.status`, "active")
      .where(`${groupAlias}.review_status`, "approved")
      .where(`${groupAlias}.publish_status`, "published")
      .whereNull(`${categoryAlias}.deleted_at`)
      .where(`${categoryAlias}.status`, "active")
      .andWhere((builder) => {
        builder
          .whereNull(`${categoryAlias}.parent_id`)
          .orWhere((parentBuilder) => {
            parentBuilder
              .whereNotNull(`${categoryAlias}.parent_id`)
              .whereNotNull(`${parentAlias}.id`)
              .whereNull(`${parentAlias}.deleted_at`)
              .where(`${parentAlias}.status`, "active");
          });
      })
      .andWhere((builder) => {
        builder.whereNull(`${groupAlias}.brand_id`).orWhere((brandBuilder) => {
          brandBuilder
            .whereNotNull(`${brandAlias}.id`)
            .whereNull(`${brandAlias}.deleted_at`)
            .where(`${brandAlias}.status`, "active");
        });
      })
      .andWhere((builder) => {
        builder
          .whereRaw("?? ILIKE ?", [`${groupAlias}.name`, searchPattern])
          .orWhereRaw("?? ILIKE ?", [`${groupAlias}.slug`, slugSearchPattern]);
      })
      .select(
        `${groupAlias}.id`,
        `${groupAlias}.name`,
        `${groupAlias}.slug`,
        `${groupAlias}.thumbnail_file_id`,
      )
      .orderByRaw(
        `case
          when lower(${groupAlias}.name) = lower(?) then 0
          when lower(${groupAlias}.slug) = lower(?) then 1
          when lower(${groupAlias}.name) like lower(?) then 2
          when lower(${groupAlias}.slug) like lower(?) then 3
          else 4
        end`,
        [params.q, slugQuery, prefixPattern, slugPrefixPattern],
      )
      .orderBy(`${groupAlias}.sort_order`, "asc")
      .orderBy(`${groupAlias}.updated_at`, "desc")
      .limit(params.group_limit)) as PublicGroupSuggestionRow[];
    const variants = (await this.knexService
      .db({ [variantAlias]: PRODUCT_VARIANT_TABLE })
      .innerJoin(
        { [groupAlias]: PRODUCT_GROUP_TABLE },
        `${groupAlias}.id`,
        `${variantAlias}.product_group_id`,
      )
      .leftJoin(
        { [categoryAlias]: PRODUCT_CATEGORY_TABLE },
        `${categoryAlias}.id`,
        `${groupAlias}.category_id`,
      )
      .leftJoin(
        { [parentAlias]: PRODUCT_CATEGORY_TABLE },
        `${parentAlias}.id`,
        `${categoryAlias}.parent_id`,
      )
      .leftJoin(
        { [brandAlias]: BRAND_TABLE },
        `${brandAlias}.id`,
        `${groupAlias}.brand_id`,
      )
      .whereNull(`${variantAlias}.deleted_at`)
      .where(`${variantAlias}.status`, "active")
      .where(`${variantAlias}.review_status`, "approved")
      .where(`${variantAlias}.publish_status`, "published")
      .whereNull(`${groupAlias}.deleted_at`)
      .where(`${groupAlias}.status`, "active")
      .where(`${groupAlias}.review_status`, "approved")
      .where(`${groupAlias}.publish_status`, "published")
      .whereNull(`${categoryAlias}.deleted_at`)
      .where(`${categoryAlias}.status`, "active")
      .andWhere((builder) => {
        builder
          .whereNull(`${categoryAlias}.parent_id`)
          .orWhere((parentBuilder) => {
            parentBuilder
              .whereNotNull(`${categoryAlias}.parent_id`)
              .whereNotNull(`${parentAlias}.id`)
              .whereNull(`${parentAlias}.deleted_at`)
              .where(`${parentAlias}.status`, "active");
          });
      })
      .andWhere((builder) => {
        builder.whereNull(`${groupAlias}.brand_id`).orWhere((brandBuilder) => {
          brandBuilder
            .whereNotNull(`${brandAlias}.id`)
            .whereNull(`${brandAlias}.deleted_at`)
            .where(`${brandAlias}.status`, "active");
        });
      })
      .andWhere((builder) => {
        builder
          .whereRaw("?? ILIKE ?", [
            `${variantAlias}.variant_name`,
            searchPattern,
          ])
          .orWhereRaw("?? ILIKE ?", [
            `${variantAlias}.model_code`,
            searchPattern,
          ])
          .orWhereRaw("?? ILIKE ?", [`${variantAlias}.sku`, searchPattern])
          .orWhereRaw("?? ILIKE ?", [`${groupAlias}.name`, searchPattern])
          .orWhereRaw("?? ILIKE ?", [`${groupAlias}.slug`, slugSearchPattern]);
      })
      .select(
        `${variantAlias}.model_code`,
        `${variantAlias}.variant_name`,
        `${groupAlias}.name as group_name`,
        `${groupAlias}.slug as group_slug`,
        `${groupAlias}.thumbnail_file_id`,
      )
      .orderByRaw(
        `case
          when lower(coalesce(${variantAlias}.model_code, '')) = lower(?) then 0
          when lower(coalesce(${variantAlias}.sku, '')) = lower(?) then 1
          when lower(coalesce(${variantAlias}.model_code, '')) like lower(?) then 2
          when lower(coalesce(${variantAlias}.sku, '')) like lower(?) then 3
          when lower(${variantAlias}.variant_name) like lower(?) then 4
          when lower(${groupAlias}.name) like lower(?) then 5
          else 6
        end`,
        [
          params.q,
          params.q,
          prefixPattern,
          prefixPattern,
          prefixPattern,
          prefixPattern,
        ],
      )
      .orderBy(`${variantAlias}.sort_order`, "asc")
      .orderBy(`${variantAlias}.created_at`, "asc")
      .limit(params.variant_limit)) as PublicVariantSuggestionRow[];
    const catAlias = "catAlias";
    const categories =
      params.secondary_limit > 0
        ? ((await this.knexService
            .db({ [catAlias]: PRODUCT_CATEGORY_TABLE })
            .leftJoin(
              { [parentAlias]: PRODUCT_CATEGORY_TABLE },
              `${parentAlias}.id`,
              `${catAlias}.parent_id`,
            )
            .whereNull(`${catAlias}.deleted_at`)
            .where(`${catAlias}.status`, "active")
            .andWhere(function () {
              this.whereRaw("LOWER(??) LIKE ?", [
                `${catAlias}.name`,
                `%${params.q}%`,
              ]).orWhereRaw("LOWER(??) LIKE ?", [
                `${catAlias}.slug`,
                slugSearchPattern,
              ]);
            })
            .select(
              `${catAlias}.id`,
              `${catAlias}.name`,
              `${catAlias}.slug`,
              this.knexService.db.raw(
                "COALESCE(??.name, NULL) as parent_name",
                [`${parentAlias}`],
              ),
              this.knexService.db.raw(
                "COALESCE(??.slug, NULL) as parent_slug",
                [`${parentAlias}`],
              ),
              `${catAlias}.icon_file_id`,
            )
            .orderBy(`${catAlias}.name`, "asc")
            .limit(params.secondary_limit)) as PublicSuggestionCategoryRow[])
        : [];
    const brandSecondaryAlias = "brand_secondary";
    const brands =
      params.secondary_limit > 0
        ? ((await this.knexService
            .db({ [brandSecondaryAlias]: BRAND_TABLE })
            .whereNull(`${brandSecondaryAlias}.deleted_at`)
            .where(`${brandSecondaryAlias}.status`, "active")
            .andWhere(function () {
              this.whereRaw("LOWER(??) LIKE ?", [
                `${brandSecondaryAlias}.name`,
                `%${params.q}%`,
              ]).orWhereRaw("LOWER(??) LIKE ?", [
                `${brandSecondaryAlias}.slug`,
                slugSearchPattern,
              ]);
            })
            .select(
              `${brandSecondaryAlias}.id`,
              `${brandSecondaryAlias}.name`,
              `${brandSecondaryAlias}.slug`,
              this.knexService.db.raw(
                `EXISTS (
            SELECT 1 FROM ${BRAND_PAGE_TABLE} brand_page_public
            WHERE brand_page_public.brand_id = ${brandSecondaryAlias}.id
              AND brand_page_public.review_status = 'approved'
              AND brand_page_public.publish_status = 'published'
              AND brand_page_public.deleted_at IS NULL
          ) as has_detail_page`,
              ),
              `${brandSecondaryAlias}.logo_file_id`,
            )
            .orderBy(`${brandSecondaryAlias}.name`, "asc")
            .limit(params.secondary_limit)) as PublicSuggestionBrandRow[])
        : [];
    const serviceAlias = "service_record_sec";
    const services =
      params.secondary_limit > 0
        ? ((await this.knexService
            .db({ [serviceAlias]: SERVICE_TABLE })
            .whereNull(`${serviceAlias}.deleted_at`)
            .where(`${serviceAlias}.review_status`, "approved")
            .where(`${serviceAlias}.publish_status`, "published")
            .andWhere(function () {
              this.whereRaw("LOWER(??) LIKE ?", [
                `${serviceAlias}.title`,
                `%${params.q}%`,
              ]).orWhereRaw("LOWER(??) LIKE ?", [
                `${serviceAlias}.slug`,
                slugSearchPattern,
              ]);
            })
            .select(
              `${serviceAlias}.id`,
              `${serviceAlias}.title`,
              `${serviceAlias}.subtitle`,
              `${serviceAlias}.slug`,
              `${serviceAlias}.image_file_id as thumbnail_file_id`,
            )
            .orderBy(`${serviceAlias}.title`, "asc")
            .limit(params.secondary_limit)) as PublicSuggestionServiceRow[])
        : [];
    const projectAlias = "project_record_sec";
    const projects =
      params.secondary_limit > 0
        ? ((await this.knexService
            .db({ [projectAlias]: PROJECT_TABLE })
            .whereNull(`${projectAlias}.deleted_at`)
            .where(`${projectAlias}.review_status`, "approved")
            .where(`${projectAlias}.publish_status`, "published")
            .andWhere(function () {
              this.whereRaw("LOWER(??) LIKE ?", [
                `${projectAlias}.title`,
                `%${params.q}%`,
              ]).orWhereRaw("LOWER(??) LIKE ?", [
                `${projectAlias}.slug`,
                slugSearchPattern,
              ]);
            })
            .select(
              `${projectAlias}.id`,
              `${projectAlias}.title`,
              `${projectAlias}.location as subtitle`,
              `${projectAlias}.slug`,
              `${projectAlias}.image_file_id as thumbnail_file_id`,
            )
            .orderBy(`${projectAlias}.title`, "asc")
            .limit(params.secondary_limit)) as PublicSuggestionProjectRow[])
        : [];
    const newsAlias = "news_record_sec";
    const news =
      params.secondary_limit > 0
        ? ((await this.knexService
            .db({ [newsAlias]: PAGE_CONTENT_TABLE })
            .whereNull(`${newsAlias}.deleted_at`)
            .where(`${newsAlias}.content_type`, "news")
            .where(`${newsAlias}.review_status`, "approved")
            .where(`${newsAlias}.publish_status`, "published")
            .andWhere(function () {
              this.whereRaw("LOWER(??) LIKE ?", [
                `${newsAlias}.title`,
                `%${params.q}%`,
              ]).orWhereRaw("LOWER(??) LIKE ?", [
                `${newsAlias}.slug`,
                slugSearchPattern,
              ]);
            })
            .select(
              `${newsAlias}.id`,
              `${newsAlias}.title`,
              `${newsAlias}.excerpt as subtitle`,
              `${newsAlias}.slug`,
              `${newsAlias}.featured_image_file_id as thumbnail_file_id`,
            )
            .orderBy(`${newsAlias}.title`, "asc")
            .limit(params.secondary_limit)) as PublicSuggestionNewsRow[])
        : [];
    const pageAlias = "page_record_sec";
    const pages =
      params.secondary_limit > 0
        ? ((await this.knexService
            .db({ [pageAlias]: PAGE_CONTENT_TABLE })
            .whereNull(`${pageAlias}.deleted_at`)
            .where(`${pageAlias}.content_type`, "page")
            .where(`${pageAlias}.review_status`, "approved")
            .where(`${pageAlias}.publish_status`, "published")
            .andWhere(function () {
              this.whereRaw("LOWER(??) LIKE ?", [
                `${pageAlias}.title`,
                `%${params.q}%`,
              ]).orWhereRaw("LOWER(??) LIKE ?", [
                `${pageAlias}.slug`,
                slugSearchPattern,
              ]);
            })
            .select(
              `${pageAlias}.id`,
              `${pageAlias}.title`,
              `${pageAlias}.excerpt as subtitle`,
              `${pageAlias}.slug`,
              `${pageAlias}.featured_image_file_id as thumbnail_file_id`,
            )
            .orderBy(`${pageAlias}.title`, "asc")
            .limit(params.secondary_limit)) as PublicSuggestionPageRow[])
        : [];
    return {
      groups,
      variants,
      categories,
      brands,
      services,
      projects,
      news,
      pages,
    };
  }
  async publicVariantCountMap(
    productGroupIds: string[],
  ): Promise<Map<string, number>> {
    return this.countMapWithFilters(
      PRODUCT_VARIANT_TABLE,
      "product_group_id",
      productGroupIds,
      (query) => {
        query.whereNull("deleted_at").where({
          status: "active",
          review_status: "approved",
          publish_status: "published",
        });
      },
    );
  }
  async publicModelCodeSummaryMap(
    productGroupIds: string[],
  ): Promise<Map<string, { count: number; codes: Array<{ id: string; code: string }> }>> {
    if (productGroupIds.length === 0) return new Map();

    const db = this.knexService.db;
    const rankedCodes = db(PRODUCT_VARIANT_TABLE)
      .whereIn("product_group_id", productGroupIds)
      .whereNull("deleted_at")
      .where({
        status: "active",
        review_status: "approved",
        publish_status: "published",
      })
      .whereNotNull("model_code")
      .whereRaw("btrim(model_code) <> ''")
      .select("id", "product_group_id", "model_code")
      .select(db.raw("row_number() over (partition by product_group_id order by sort_order asc, created_at asc, id asc) as code_rank"))
      .select(db.raw("count(*) over (partition by product_group_id) as code_count"))
      .as("ranked_codes");
    const rows = await db(rankedCodes)
      .where("code_rank", "<=", 1)
      .select<
        Array<{
          id: string;
          product_group_id: string;
          model_code: string;
          code_count: string | number;
        }>
      >("id", "product_group_id", "model_code", "code_count");

    return new Map(
      rows.map((row) => [
        row.product_group_id,
        {
          count: Number(row.code_count),
          codes: [{ id: row.id, code: row.model_code.trim() }],
        },
      ]),
    );
  }
  async publicPriceSummaryMap(
    productGroupIds: string[],
  ): Promise<Map<string, PublicProductPriceSummary>> {
    if (productGroupIds.length === 0) return new Map();

    const rows = await this.knexService.db(PRODUCT_VARIANT_TABLE)
      .whereIn('product_group_id', productGroupIds)
      .whereNull('deleted_at')
      .where({ status: 'active', review_status: 'approved', publish_status: 'published' })
      .select<PublicPriceRow[]>(
        'product_group_id', 'public_price_mode', 'public_price_amount'
      );
    return buildPublicPriceSummaryMap(productGroupIds, rows);
  }
  async publicDocumentCountMap(
    productGroupIds: string[],
  ): Promise<Map<string, number>> {
    if (productGroupIds.length === 0) return new Map();
    const documentAlias = "technical_document_record";
    const variantAlias = "variant_record";
    const fileAlias = "file_record";
    const rows = (await this.knexService
      .db({ [documentAlias]: TECHNICAL_DOCUMENT_TABLE })
      .leftJoin(
        { [variantAlias]: PRODUCT_VARIANT_TABLE },
        `${variantAlias}.id`,
        `${documentAlias}.product_variant_id`,
      )
      .innerJoin(
        { [fileAlias]: FILE_METADATA_TABLE },
        `${fileAlias}.id`,
        `${documentAlias}.file_id`,
      )
      .whereIn(`${documentAlias}.product_group_id`, productGroupIds)
      .whereNull(`${documentAlias}.deleted_at`)
      .where(`${documentAlias}.status`, "active")
      .where(`${documentAlias}.is_public`, true)
      .whereNull(`${fileAlias}.deleted_at`)
      .andWhere((builder) => {
        builder
          .whereNull(`${documentAlias}.product_variant_id`)
          .orWhere((variantBuilder) => {
            variantBuilder
              .whereNotNull(`${variantAlias}.id`)
              .whereRaw("?? = ??", [
                `${variantAlias}.product_group_id`,
                `${documentAlias}.product_group_id`,
              ])
              .whereNull(`${variantAlias}.deleted_at`)
              .where(`${variantAlias}.status`, "active")
              .where(`${variantAlias}.review_status`, "approved")
              .where(`${variantAlias}.publish_status`, "published");
          });
      })
      .groupBy(`${documentAlias}.product_group_id`)
      .select(`${documentAlias}.product_group_id`)
      .countDistinct({ total: `${documentAlias}.id` })) as Array<{
      product_group_id: string;
      total: string | number;
    }>;
    return new Map(
      rows.map((row) => [row.product_group_id, Number(row.total ?? 0)]),
    );
  }
  async publicGroupHighlightSpecMap(
    productGroupIds: string[],
  ): Promise<Map<string, PublicHighlightSpec[]>> {
    if (productGroupIds.length === 0) return new Map();
    const rows = (await this.knexService
      .db(PRODUCT_HIGHLIGHT_SPEC_TABLE)
      .whereIn("product_group_id", productGroupIds)
      .whereNull("product_variant_id")
      .whereNull("deleted_at")
      .select(
        "id",
        "product_group_id",
        "product_variant_id",
        "display_label",
        "display_value",
        "sort_order",
      )
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "asc")) as Array<{
      id: string;
      product_group_id: string;
      product_variant_id: string | null;
      display_label: string;
      display_value: string;
      sort_order: number;
    }>;
    const map = new Map<string, PublicHighlightSpec[]>();
    for (const row of rows) {
      const key = row.product_group_id;
      const specs = map.get(key) ?? [];
      specs.push({
        id: row.id,
        product_group_id: row.product_group_id,
        product_variant_id: row.product_variant_id ?? null,
        display_label: row.display_label,
        display_value: row.display_value,
        sort_order: Number(row.sort_order ?? 0),
      });
      map.set(key, specs);
    }
    return map;
  }
  async findPublicProductGroupBySlug(
    slug: string,
  ): Promise<PublicProductGroupDetailRow | null> {
    const groupAlias = "group_record";
    const categoryAlias = "category_record";
    const parentAlias = "parent_record";
    const brandAlias = "brand_record";
    const row = await this.knexService
      .db({ [groupAlias]: PRODUCT_GROUP_TABLE })
      .leftJoin(
        { [categoryAlias]: PRODUCT_CATEGORY_TABLE },
        `${categoryAlias}.id`,
        `${groupAlias}.category_id`,
      )
      .leftJoin(
        { [parentAlias]: PRODUCT_CATEGORY_TABLE },
        `${parentAlias}.id`,
        `${categoryAlias}.parent_id`,
      )
      .leftJoin(
        { [brandAlias]: BRAND_TABLE },
        `${brandAlias}.id`,
        `${groupAlias}.brand_id`,
      )
      .where(`${groupAlias}.slug`, slug)
      .whereNull(`${groupAlias}.deleted_at`)
      .where(`${groupAlias}.status`, "active")
      .where(`${groupAlias}.review_status`, "approved")
      .where(`${groupAlias}.publish_status`, "published")
      .whereNull(`${categoryAlias}.deleted_at`)
      .where(`${categoryAlias}.status`, "active")
      .andWhere((builder) => {
        builder
          .whereNull(`${categoryAlias}.parent_id`)
          .orWhere((parentBuilder) => {
            parentBuilder
              .whereNotNull(`${categoryAlias}.parent_id`)
              .whereNotNull(`${parentAlias}.id`)
              .whereNull(`${parentAlias}.deleted_at`)
              .where(`${parentAlias}.status`, "active");
          });
      })
      .andWhere((builder) => {
        builder.whereNull(`${groupAlias}.brand_id`).orWhere((brandBuilder) => {
          brandBuilder
            .whereNotNull(`${brandAlias}.id`)
            .whereNull(`${brandAlias}.deleted_at`)
            .where(`${brandAlias}.status`, "active");
        });
      })
      .first(
        `${groupAlias}.id`,
        `${groupAlias}.name`,
        `${groupAlias}.slug`,
        `${groupAlias}.category_id`,
        `${categoryAlias}.name as category_name`,
        `${groupAlias}.brand_id`,
        `${brandAlias}.name as brand_name`,
        `${brandAlias}.slug as brand_slug`,
        `${brandAlias}.logo_file_id as brand_logo_file_id`,
        `${groupAlias}.short_description`,
        `${groupAlias}.detailed_description`,
        `${groupAlias}.thumbnail_file_id`,
        `${groupAlias}.review_status`,
        `${groupAlias}.publish_status`,
        `${groupAlias}.status`,
        `${groupAlias}.sort_order`,
      );
    return (row as PublicProductGroupDetailRow | undefined) ?? null;
  }
  async listPublicServiceRelatedProductGroups(
    serviceId: string,
  ): Promise<PublicRelatedProductGroupRow[]> {
    const relationAlias = "service_product_group_record";
    return this.listPublicRelatedProductGroups({
      relationTable: SERVICE_PRODUCT_GROUP_TABLE,
      relationAlias,
      relationColumn: "service_id",
      relationValue: serviceId,
    });
  }
  async listPublicProjectRelatedProductGroups(
    projectId: string,
  ): Promise<PublicRelatedProductGroupRow[]> {
    const relationAlias = "project_product_group_record";
    return this.listPublicRelatedProductGroups({
      relationTable: PROJECT_PRODUCT_GROUP_TABLE,
      relationAlias,
      relationColumn: "project_id",
      relationValue: projectId,
    });
  }
  async listPublicProjectGallery(
    projectId: string,
  ): Promise<PublicProjectGalleryRow[]> {
    const galleryAlias = "project_gallery_record";
    const projectAlias = "project_record";
    const fileAlias = "file_record";
    const rows = (await this.knexService
      .db({ [galleryAlias]: PROJECT_GALLERY_TABLE })
      .innerJoin(
        { [projectAlias]: PROJECT_TABLE },
        `${projectAlias}.id`,
        `${galleryAlias}.project_id`,
      )
      .innerJoin(
        { [fileAlias]: FILE_METADATA_TABLE },
        `${fileAlias}.id`,
        `${galleryAlias}.file_id`,
      )
      .where(`${galleryAlias}.project_id`, projectId)
      .whereNull(`${galleryAlias}.deleted_at`)
      .whereNull(`${projectAlias}.deleted_at`)
      .where(`${projectAlias}.review_status`, "approved")
      .where(`${projectAlias}.publish_status`, "published")
      .whereNull(`${fileAlias}.deleted_at`)
      .select(
        `${galleryAlias}.id`,
        `${galleryAlias}.project_id`,
        `${galleryAlias}.file_id`,
        `${galleryAlias}.alt_text`,
        `${galleryAlias}.sort_order`,
        `${fileAlias}.id as file_summary_id`,
        `${fileAlias}.original_filename as file_summary_original_filename`,
        `${fileAlias}.mime_type as file_summary_mime_type`,
        `${fileAlias}.storage_location as file_summary_storage_location`,
        `${fileAlias}.stored_path as file_summary_stored_path`,
      )
      .orderBy(`${galleryAlias}.sort_order`, "asc")
      .orderBy(`${galleryAlias}.created_at`, "asc")) as Array<
      Record<string, unknown>
    >;
    return rows.map((row) => ({
      id: row.id as string,
      project_id: row.project_id as string,
      file_id: row.file_id as string,
      alt_text: row.alt_text as string | null,
      sort_order: row.sort_order as number,
      file: toPublicFileSummary({
        id: row.file_summary_id as string,
        original_filename: row.file_summary_original_filename as string,
        mime_type: row.file_summary_mime_type as string,
        storage_location: row.file_summary_storage_location as string,
        stored_path: row.file_summary_stored_path as string,
      }),
    }));
  }
  async listPublicProductImages(
    productGroupId: string,
  ): Promise<PublicProductImageRow[]> {
    const imageAlias = "image_record";
    const fileAlias = "file_record";
    const variantAlias = "variant_record";
    const rows = (await this.knexService
      .db({ [imageAlias]: PRODUCT_IMAGE_TABLE })
      .innerJoin(
        { [fileAlias]: FILE_METADATA_TABLE },
        `${fileAlias}.id`,
        `${imageAlias}.file_id`,
      )
      .leftJoin(
        { [variantAlias]: PRODUCT_VARIANT_TABLE },
        `${variantAlias}.id`,
        `${imageAlias}.product_variant_id`,
      )
      .where(`${imageAlias}.product_group_id`, productGroupId)
      .whereNull(`${imageAlias}.deleted_at`)
      .whereNull(`${fileAlias}.deleted_at`)
      .andWhere((builder) => {
        builder
          .whereNull(`${imageAlias}.product_variant_id`)
          .orWhere((variantBuilder) => {
            variantBuilder
              .whereNotNull(`${variantAlias}.id`)
              .whereRaw("?? = ??", [
                `${variantAlias}.product_group_id`,
                `${imageAlias}.product_group_id`,
              ])
              .whereNull(`${variantAlias}.deleted_at`)
              .where(`${variantAlias}.status`, "active")
              .where(`${variantAlias}.review_status`, "approved")
              .where(`${variantAlias}.publish_status`, "published");
          });
      })
      .select(
        `${imageAlias}.id`,
        `${imageAlias}.product_group_id`,
        `${imageAlias}.product_variant_id`,
        `${imageAlias}.file_id`,
        `${imageAlias}.alt_text`,
        `${imageAlias}.sort_order`,
        `${fileAlias}.id as file_summary_id`,
        `${fileAlias}.original_filename as file_summary_original_filename`,
        `${fileAlias}.mime_type as file_summary_mime_type`,
        `${fileAlias}.storage_location as file_summary_storage_location`,
        `${fileAlias}.stored_path as file_summary_stored_path`,
      )
      .orderBy(`${imageAlias}.sort_order`, "asc")
      .orderBy(`${imageAlias}.created_at`, "asc")) as Array<
      Record<string, unknown>
    >;
    return rows.map((row) => ({
      id: row.id as string,
      product_group_id: row.product_group_id as string,
      product_variant_id: (row.product_variant_id as string | null) ?? null,
      file_id: row.file_id as string,
      alt_text: (row.alt_text as string | null) ?? null,
      sort_order: Number(row.sort_order ?? 0),
      file: toPublicFileSummary({
        id: row.file_summary_id as string,
        original_filename: row.file_summary_original_filename as string,
        mime_type: row.file_summary_mime_type as string,
        storage_location: row.file_summary_storage_location as string,
        stored_path: row.file_summary_stored_path as string,
      }),
    }));
  }
  async listPublicVariants(
    productGroupId: string,
  ): Promise<PublicVariantRow[]> {
    return this.knexService
      .db<PublicVariantRow>(PRODUCT_VARIANT_TABLE)
      .where({
        product_group_id: productGroupId,
        status: "active",
        review_status: "approved",
        publish_status: "published",
      })
      .whereNull("deleted_at")
      .select(
        "id",
        "product_group_id",
        "model_code",
        "variant_name",
        "detailed_description",
        "public_price_mode",
        "public_price_amount",
        "sort_order",
      )
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "asc");
  }
  async listSharedSpecGroups(
    productGroupId: string,
  ): Promise<SharedSpecGroupRow[]> {
    return this.knexService
      .db<SharedSpecGroupRow>("spec_group")
      .where({ product_group_id: productGroupId })
      .whereNull("deleted_at")
      .select("id", "product_group_id", "group_name", "sort_order")
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "asc");
  }
  async listSharedSpecItems(
    specGroupIds: string[],
  ): Promise<SharedSpecItemRow[]> {
    if (specGroupIds.length === 0) return [];
    return this.knexService
      .db<SharedSpecItemRow>("product_spec")
      .whereIn("spec_group_id", specGroupIds)
      .whereNull("deleted_at")
      .select("id", "spec_group_id", "spec_name", "spec_value", "sort_order")
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "asc");
  }
  async listVariantSpecGroups(
    variantIds: string[],
  ): Promise<VariantSpecGroupRow[]> {
    if (variantIds.length === 0) return [];
    return this.knexService
      .db<VariantSpecGroupRow>("variant_spec_group")
      .whereIn("product_variant_id", variantIds)
      .whereNull("deleted_at")
      .select("id", "product_variant_id", "group_name", "sort_order")
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "asc");
  }
  async listVariantSpecItems(
    specGroupIds: string[],
  ): Promise<VariantSpecItemRow[]> {
    if (specGroupIds.length === 0) return [];
    return this.knexService
      .db<VariantSpecItemRow>("variant_spec")
      .whereIn("variant_spec_group_id", specGroupIds)
      .whereNull("deleted_at")
      .select(
        "id",
        "variant_spec_group_id",
        "spec_name",
        "spec_value",
        "sort_order",
      )
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "asc");
  }
  async listVariantAttributes(
    variantIds: string[],
  ): Promise<VariantAttributeRow[]> {
    if (variantIds.length === 0) return [];
    return this.knexService
      .db<VariantAttributeRow>("variant_attribute")
      .whereIn("product_variant_id", variantIds)
      .whereNull("deleted_at")
      .select(
        "id",
        "product_variant_id",
        "attribute_name",
        "attribute_value",
        "display_order",
      )
      .orderBy("display_order", "asc")
      .orderBy("created_at", "asc");
  }
  async listPublicProductHighlightSpecs(
    productGroupId: string,
    publicVariantIds: string[],
  ): Promise<PublicHighlightSpecRow[]> {
    const rows = await this.knexService
      .db<PublicHighlightSpecRow>(PRODUCT_HIGHLIGHT_SPEC_TABLE)
      .where({ product_group_id: productGroupId })
      .whereNull("deleted_at")
      .andWhere((builder) => {
        builder.whereNull("product_variant_id");
        if (publicVariantIds.length > 0) {
          builder.orWhereIn("product_variant_id", publicVariantIds);
        }
      })
      .select(
        "id",
        "product_group_id",
        "product_variant_id",
        "display_label",
        "display_value",
        "sort_order",
      )
      .orderByRaw("CASE WHEN product_variant_id IS NULL THEN 0 ELSE 1 END ASC")
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "asc");
    return rows.map((row) => ({
      ...row,
      product_variant_id: row.product_variant_id ?? null,
      sort_order: Number(row.sort_order ?? 0),
    }));
  }
  async listPublicTechnicalDocuments(
    productGroupId: string,
  ): Promise<PublicTechnicalDocumentRow[]> {
    const documentAlias = "document_record";
    const fileAlias = "file_record";
    const variantAlias = "variant_record";
    const rows = (await this.knexService
      .db({ [documentAlias]: TECHNICAL_DOCUMENT_TABLE })
      .innerJoin(
        { [fileAlias]: FILE_METADATA_TABLE },
        `${fileAlias}.id`,
        `${documentAlias}.file_id`,
      )
      .leftJoin(
        { [variantAlias]: PRODUCT_VARIANT_TABLE },
        `${variantAlias}.id`,
        `${documentAlias}.product_variant_id`,
      )
      .where(`${documentAlias}.product_group_id`, productGroupId)
      .whereNull(`${documentAlias}.deleted_at`)
      .where(`${documentAlias}.status`, "active")
      .where(`${documentAlias}.is_public`, true)
      .whereNull(`${fileAlias}.deleted_at`)
      .andWhere((builder) => {
        builder
          .whereNull(`${documentAlias}.product_variant_id`)
          .orWhere((variantBuilder) => {
            variantBuilder
              .whereNotNull(`${variantAlias}.id`)
              .whereRaw("?? = ??", [
                `${variantAlias}.product_group_id`,
                `${documentAlias}.product_group_id`,
              ])
              .whereNull(`${variantAlias}.deleted_at`)
              .where(`${variantAlias}.status`, "active")
              .where(`${variantAlias}.review_status`, "approved")
              .where(`${variantAlias}.publish_status`, "published");
          });
      })
      .select(
        `${documentAlias}.id`,
        `${documentAlias}.product_group_id`,
        `${documentAlias}.product_variant_id`,
        `${documentAlias}.document_name`,
        `${documentAlias}.document_type`,
        `${documentAlias}.file_id`,
        `${documentAlias}.version`,
        `${documentAlias}.is_public`,
        `${documentAlias}.sort_order`,
        `${fileAlias}.id as file_summary_id`,
        `${fileAlias}.original_filename as file_summary_original_filename`,
        `${fileAlias}.mime_type as file_summary_mime_type`,
        `${fileAlias}.storage_location as file_summary_storage_location`,
        `${fileAlias}.stored_path as file_summary_stored_path`,
      )
      .orderBy(`${documentAlias}.sort_order`, "asc")
      .orderBy(`${documentAlias}.created_at`, "asc")) as Array<
      Record<string, unknown>
    >;
    return rows.map((row) => ({
      id: row.id as string,
      product_group_id: row.product_group_id as string,
      product_variant_id: (row.product_variant_id as string | null) ?? null,
      document_name:
        row.document_name as PublicTechnicalDocumentRow["document_name"],
      document_type:
        row.document_type as PublicTechnicalDocumentRow["document_type"],
      file_id: row.file_id as string,
      version: (row.version as string | null) ?? null,
      is_public: true,
      sort_order: Number(row.sort_order ?? 0),
      file: toPublicFileSummary({
        id: row.file_summary_id as string,
        original_filename: row.file_summary_original_filename as string,
        mime_type: row.file_summary_mime_type as string,
        storage_location: row.file_summary_storage_location as string,
        stored_path: row.file_summary_stored_path as string,
      }),
    }));
  }
  async publicProductGroupIds(
    productGroupIds: string[],
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<Set<string>> {
    if (productGroupIds.length === 0) {
      return new Set();
    }

    const groupAlias = "group_record";
    const categoryAlias = "category_record";
    const parentAlias = "parent_record";
    const brandAlias = "brand_record";
    const rows = (await db({ [groupAlias]: PRODUCT_GROUP_TABLE })
      .leftJoin(
        { [categoryAlias]: PRODUCT_CATEGORY_TABLE },
        `${categoryAlias}.id`,
        `${groupAlias}.category_id`,
      )
      .leftJoin(
        { [parentAlias]: PRODUCT_CATEGORY_TABLE },
        `${parentAlias}.id`,
        `${categoryAlias}.parent_id`,
      )
      .leftJoin(
        { [brandAlias]: BRAND_TABLE },
        `${brandAlias}.id`,
        `${groupAlias}.brand_id`,
      )
      .whereIn(`${groupAlias}.id`, productGroupIds)
      .whereNull(`${groupAlias}.deleted_at`)
      .where(`${groupAlias}.status`, "active")
      .where(`${groupAlias}.review_status`, "approved")
      .where(`${groupAlias}.publish_status`, "published")
      .whereNull(`${categoryAlias}.deleted_at`)
      .where(`${categoryAlias}.status`, "active")
      .andWhere((builder) => {
        builder
          .whereNull(`${categoryAlias}.parent_id`)
          .orWhere((parentBuilder) => {
            parentBuilder
              .whereNotNull(`${categoryAlias}.parent_id`)
              .whereNotNull(`${parentAlias}.id`)
              .whereNull(`${parentAlias}.deleted_at`)
              .where(`${parentAlias}.status`, "active");
          });
      })
      .andWhere((builder) => {
        builder.whereNull(`${groupAlias}.brand_id`).orWhere((brandBuilder) => {
          brandBuilder
            .whereNotNull(`${brandAlias}.id`)
            .whereNull(`${brandAlias}.deleted_at`)
            .where(`${brandAlias}.status`, "active");
        });
      })
      .select(`${groupAlias}.id as id`)) as Array<{ id: string }>;
    return new Set(rows.map((row) => row.id));
  }
  async publicVariantKeys(
    references: Array<{ product_group_id: string; product_variant_id: string }>,
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<Set<string>> {
    if (references.length === 0) {
      return new Set();
    }

    const rows = (await db(PRODUCT_VARIANT_TABLE)
      .whereIn(
        "id",
        Array.from(new Set(references.map((item) => item.product_variant_id))),
      )
      .where({
        status: "active",
        review_status: "approved",
        publish_status: "published",
      })
      .whereNull("deleted_at")
      .select("id", "product_group_id")) as Array<{
      id: string;
      product_group_id: string;
    }>;
    return new Set(
      rows.map((row) => `${row.product_group_id}:${row.id}`),
    );
  }
  async findPublicFileById(
    fileId: string,
  ): Promise<PublicFileRecord | null> {
    const file = await this.knexService
      .db<PublicFileRecord>(FILE_METADATA_TABLE)
      .where({ id: fileId })
      .whereIn("storage_location", ["local", "r2"])
      .whereNull("deleted_at")
      .first(
        "id",
        "original_filename",
        "mime_type",
        "storage_location",
        "stored_path",
      );
    if (!file) {
      return null;
    }
    const isPublic = await this.hasPublicFileAccess(fileId);
    return isPublic ? file : null;
  }
  async createPublicContactRequest(input: {
    full_name: string;
    phone: string;
    email: string | null;
    company_name: string | null;
    message: string;
    source_page: string | null;
    ip_address: string | null;
    user_agent: string | null;
  }): Promise<CreatedContactRow> {
    return this.knexService.db.transaction(async (trx) => {
      const customerId = await this.resolveCustomerProfileId(trx, {
        full_name: input.full_name,
        phone: input.phone,
        email: input.email,
        company_name: input.company_name,
      });
      const [row] = (await trx(CONTACT_REQUEST_TABLE)
        .insert({
          customer_id: customerId,
          full_name: input.full_name,
          phone: input.phone,
          email: input.email,
          company_name: input.company_name,
          message: input.message,
          source_page: input.source_page,
          status: "new",
          assigned_to: null,
          ip_address: input.ip_address,
          user_agent: input.user_agent,
        })
        .returning([
          "id",
          "full_name",
          "phone",
          "email",
          "company_name",
          "message",
          "source_page",
          "status",
          "created_at",
        ])) as CreatedContactRow[];
      return row;
    });
  }
  async createPublicQuoteRequest(input: {
    full_name: string;
    company_name: string | null;
    phone: string;
    email: string | null;
    address: string | null;
    message: string | null;
    project_name: string | null;
    project_context: string | null;
    project_requirements: Array<{ label: string; value: string }>;
    ip_address: string | null;
    user_agent: string | null;
    items: Array<{
      product_group_id: string;
      product_variant_id: string | null;
      quantity: number | null;
      quantity_raw: string | null;
      quantity_unit: string | null;
      quantity_state: 'confirmed' | 'unspecified';
      notes: string | null;
    }>;
  }): Promise<{
    status: "created";
    quote_request: CreatedQuoteRow;
    items: CreatedQuoteItemRow[];
  } | {
    status: "invalid_product_group";
    product_group_id: string;
  } | {
    status: "invalid_product_variant";
    product_group_id: string;
    product_variant_id: string;
  }> {
    return this.knexService.db.transaction(async (trx) => {
      const productGroupIds = Array.from(
        new Set(input.items.map((item) => item.product_group_id))
      ).sort();
      const productVariantIds = Array.from(
        new Set(
          input.items
            .map((item) => item.product_variant_id)
            .filter((id): id is string => Boolean(id))
        )
      ).sort();

      // Keep lock order aligned with variant writes (variant -> group) to
      // prevent deadlocks while making the final visibility check atomic.
      const lockedVariants = productVariantIds.length > 0
        ? (await trx(PRODUCT_VARIANT_TABLE)
          .whereIn("id", productVariantIds)
          .orderBy("id", "asc")
          .forUpdate()
          .select("id", "public_price_mode", "public_price_amount")) as Array<{
            id: string;
            public_price_mode: string;
            public_price_amount: number | null;
          }>
        : [];
      const lockedVariantMap = new Map(lockedVariants.map((variant) => [variant.id, variant]));
      const lockedProductGroups = productGroupIds.length > 0
        ? await trx(PRODUCT_GROUP_TABLE)
          .whereIn("id", productGroupIds)
          .orderBy("id", "asc")
          .forUpdate()
          .select<Array<{ id: string; category_id: string; brand_id: string | null }>>(
            "id",
            "category_id",
            "brand_id"
          )
        : [];
      if (lockedProductGroups.length > 0) {
        await lockProductGroupReferenceRows(trx, lockedProductGroups);
      }

      const variantReferences = input.items.flatMap((item) =>
        item.product_variant_id
          ? [{
              product_group_id: item.product_group_id,
              product_variant_id: item.product_variant_id
            }]
          : []
      );
      const [publicProductGroupIds, publicVariantKeys] = await Promise.all([
        this.publicProductGroupIds(productGroupIds, trx),
        this.publicVariantKeys(variantReferences, trx)
      ]);
      for (const item of input.items) {
        if (!publicProductGroupIds.has(item.product_group_id)) {
          return {
            status: "invalid_product_group" as const,
            product_group_id: item.product_group_id
          };
        }
        if (
          item.product_variant_id &&
          !publicVariantKeys.has(
            `${item.product_group_id}:${item.product_variant_id}`
          )
        ) {
          return {
            status: "invalid_product_variant" as const,
            product_group_id: item.product_group_id,
            product_variant_id: item.product_variant_id
          };
        }
      }

      const customerId = await this.resolveCustomerProfileId(trx, {
        full_name: input.full_name,
        phone: input.phone,
        email: input.email,
        company_name: input.company_name,
      });
      const [quoteRequest] = (await trx(QUOTE_REQUEST_TABLE)
        .insert({
          customer_id: customerId,
          full_name: input.full_name,
          company_name: input.company_name,
          phone: input.phone,
          email: input.email,
          address: input.address,
          message: input.message,
          project_name: input.project_name,
          project_context: input.project_context,
          project_requirements: JSON.stringify(input.project_requirements),
          status: "new",
          assigned_to: null,
          ip_address: input.ip_address,
          user_agent: input.user_agent,
        })
        .returning([
          "id",
          "full_name",
          "company_name",
          "phone",
          "email",
          "address",
          "message",
          "project_name",
          "project_context",
          "project_requirements",
          "status",
          "created_at",
        ])) as CreatedQuoteRow[];
      let createdItems: CreatedQuoteItemRow[] = [];
      if (input.items.length > 0) {
        createdItems = (await trx(QUOTE_ITEM_TABLE)
          .insert(
            input.items.map((item) => ({
              quote_request_id: quoteRequest.id,
              product_group_id: item.product_group_id,
              product_variant_id: item.product_variant_id,
              quantity: item.quantity,
              quantity_raw: item.quantity_raw,
              quantity_unit: item.quantity_unit,
              quantity_state: item.quantity_state,
              public_price_amount_at_request: publicPriceAmountAtRequest(
                item.product_variant_id ? lockedVariantMap.get(item.product_variant_id) : null
              ),
              notes: item.notes,
            })),
          )
          .returning([
            "id",
            "quote_request_id",
            "product_group_id",
            "product_variant_id",
            "quantity",
            "quantity_raw",
            "quantity_unit",
            "quantity_state",
            "public_price_amount_at_request",
            "notes",
          ])) as CreatedQuoteItemRow[];
      }
      return { status: "created" as const, quote_request: quoteRequest, items: createdItems };
    });
  }
  private buildPublicPricedVariantExistsQuery(
    groupAlias: string,
  ): Knex.QueryBuilder {
    return this.knexService
      .db({ variant_record: PRODUCT_VARIANT_TABLE })
      .select("variant_record.id")
      .whereRaw("?? = ??", [
        "variant_record.product_group_id",
        `${groupAlias}.id`,
      ])
      .whereNull("variant_record.deleted_at")
      .whereNotNull('variant_record.public_price_amount')
      .where('variant_record.public_price_amount', '>', 0)
      .where({
        "variant_record.status": "active",
        "variant_record.review_status": "approved",
        "variant_record.publish_status": "published",
        "variant_record.public_price_mode": "public_price",
      });
  }
  private normalizeCategoryPath(
    row: PublicProductGroupListRow,
  ): PublicProductGroupListRow {
    if (row.category_level_1_id) return row;
    return {
      ...row,
      category_level_1_id: row.category_id,
      category_level_1_name: row.category_name,
      category_level_2_id: null,
      category_level_2_name: null,
    };
  }
  private async hasPublicFileAccess(fileId: string): Promise<boolean> {
    const accessChecks = await Promise.all([
      this.isCompanyInfoFilePublic(fileId),
      this.isCategoryIconFilePublic(fileId),
      this.isBrandLogoFilePublic(fileId),
      this.isServiceFilePublic(fileId),
      this.isProjectFilePublic(fileId),
      this.isPageContentFilePublic(fileId),
      this.isBrandPageFilePublic(fileId),
      this.isBannerFilePublic(fileId),
      this.isProductGroupFilePublic(fileId),
      this.isProductImageFilePublic(fileId),
      this.isTechnicalDocumentFilePublic(fileId),
      this.isRichContentFilePublic(fileId, "service", SERVICE_TABLE),
      this.isRichContentFilePublic(fileId, "project", PROJECT_TABLE),
      this.isRichContentFilePublic(fileId, "page_content", PAGE_CONTENT_TABLE),
    ]);
    return accessChecks.some(Boolean);
  }
  private async isCompanyInfoFilePublic(fileId: string): Promise<boolean> {
    const row = await this.knexService
      .db(COMPANY_INFO_TABLE)
      .whereNull("deleted_at")
      .andWhere((builder) => {
        builder
          .where("logo_file_id", fileId)
          .orWhere("favicon_file_id", fileId);
      })
      .first("id");
    return Boolean(row);
  }
  private async isCategoryIconFilePublic(fileId: string): Promise<boolean> {
    const categoryAlias = "category_record";
    const parentAlias = "parent_record";
    const row = await this.knexService
      .db({ [categoryAlias]: PRODUCT_CATEGORY_TABLE })
      .leftJoin(
        { [parentAlias]: PRODUCT_CATEGORY_TABLE },
        `${parentAlias}.id`,
        `${categoryAlias}.parent_id`,
      )
      .where(`${categoryAlias}.icon_file_id`, fileId)
      .whereNull(`${categoryAlias}.deleted_at`)
      .where(`${categoryAlias}.status`, "active")
      .andWhere((builder) => {
        builder
          .whereNull(`${categoryAlias}.parent_id`)
          .orWhere((parentBuilder) => {
            parentBuilder
              .whereNotNull(`${categoryAlias}.parent_id`)
              .whereNotNull(`${parentAlias}.id`)
              .whereNull(`${parentAlias}.deleted_at`)
              .where(`${parentAlias}.status`, "active");
          });
      })
      .first(`${categoryAlias}.id`);
    return Boolean(row);
  }
  private async isBrandLogoFilePublic(fileId: string): Promise<boolean> {
    const brandAlias = "brand_record";
    const row = await this.knexService
      .db({ [brandAlias]: BRAND_TABLE })
      .where(`${brandAlias}.logo_file_id`, fileId)
      .whereNull(`${brandAlias}.deleted_at`)
      .where(`${brandAlias}.status`, "active")
      .first(`${brandAlias}.id`);
    return Boolean(row);
  }
  private async isServiceFilePublic(fileId: string): Promise<boolean> {
    const serviceAlias = "service_record";
    const row = await this.knexService
      .db({ [serviceAlias]: SERVICE_TABLE })
      .whereNull(`${serviceAlias}.deleted_at`)
      .where(`${serviceAlias}.review_status`, "approved")
      .where(`${serviceAlias}.publish_status`, "published")
      .andWhere((builder) => {
        builder
          .where(`${serviceAlias}.image_file_id`, fileId)
          .orWhere(`${serviceAlias}.seo_og_image_file_id`, fileId);
      })
      .first(`${serviceAlias}.id`);
    return Boolean(row);
  }
  private async isProjectFilePublic(fileId: string): Promise<boolean> {
    const projectAlias = "project_record";
    const row = await this.knexService
      .db({ [projectAlias]: PROJECT_TABLE })
      .whereNull(`${projectAlias}.deleted_at`)
      .where(`${projectAlias}.review_status`, "approved")
      .where(`${projectAlias}.publish_status`, "published")
      .andWhere((builder) => {
        builder
          .where(`${projectAlias}.image_file_id`, fileId)
          .orWhere(`${projectAlias}.seo_og_image_file_id`, fileId);
      })
      .first(`${projectAlias}.id`);
    return Boolean(row);
  }
  private async isPageContentFilePublic(fileId: string): Promise<boolean> {
    const contentAlias = "page_content_record";
    const row = await this.knexService
      .db({ [contentAlias]: PAGE_CONTENT_TABLE })
      .whereNull(`${contentAlias}.deleted_at`)
      .where(`${contentAlias}.review_status`, "approved")
      .where(`${contentAlias}.publish_status`, "published")
      .andWhere((builder) => {
        builder
          .where(`${contentAlias}.featured_image_file_id`, fileId)
          .orWhere(`${contentAlias}.seo_og_image_file_id`, fileId);
      })
      .first(`${contentAlias}.id`);
    return Boolean(row);
  }
  private async isRichContentFilePublic(
    fileId: string,
    entityType: "service" | "project" | "page_content",
    entityTable: string,
  ): Promise<boolean> {
    const usageAlias = "usage_record";
    const ownerAlias = "owner_record";
    const row = await this.knexService
      .db({ [usageAlias]: FILE_USAGE_TABLE })
      .innerJoin(
        { [ownerAlias]: entityTable },
        `${ownerAlias}.id`,
        `${usageAlias}.entity_id`,
      )
      .where(`${usageAlias}.file_id`, fileId)
      .where(`${usageAlias}.entity_type`, entityType)
      .andWhere((builder) => {
        builder.where(`${usageAlias}.field_name`, "content_html");
        if (entityType === "page_content") {
          builder.orWhere(
            `${usageAlias}.field_name`,
            "like",
            `${PAGE_CONTENT_EXTRA_BLOCK_FIELD_PREFIX}%`,
          );
        }
      })
      .whereNull(`${usageAlias}.deleted_at`)
      .whereNull(`${ownerAlias}.deleted_at`)
      .where(`${ownerAlias}.review_status`, "approved")
      .where(`${ownerAlias}.publish_status`, "published")
      .first(`${usageAlias}.id`);
    return Boolean(row);
  }
  private async isBrandPageFilePublic(fileId: string): Promise<boolean> {
    const pageAlias = "brand_page_record";
    const brandAlias = "brand_record";
    const statAlias = "brand_page_stat_record";
    const sourceAlias = "brand_page_source_record";
    const pageRow = await this.knexService
      .db({ [pageAlias]: BRAND_PAGE_TABLE })
      .join(
        { [brandAlias]: BRAND_TABLE },
        `${brandAlias}.id`,
        `${pageAlias}.brand_id`,
      )
      .whereNull(`${pageAlias}.deleted_at`)
      .where(`${pageAlias}.review_status`, "approved")
      .where(`${pageAlias}.publish_status`, "published")
      .whereNull(`${brandAlias}.deleted_at`)
      .where(`${brandAlias}.status`, "active")
      .andWhere((builder) => {
        builder
          .where(`${pageAlias}.support_image_file_id`, fileId)
          .orWhere(`${pageAlias}.seo_og_image_file_id`, fileId);
      })
      .first(`${pageAlias}.id`);
    if (pageRow) return true;
    const statRow = await this.knexService
      .db({ [statAlias]: BRAND_PAGE_STAT_TABLE })
      .join(
        { [pageAlias]: BRAND_PAGE_TABLE },
        `${pageAlias}.id`,
        `${statAlias}.brand_page_id`,
      )
      .join(
        { [brandAlias]: BRAND_TABLE },
        `${brandAlias}.id`,
        `${pageAlias}.brand_id`,
      )
      .where(`${statAlias}.source_file_id`, fileId)
      .where(`${statAlias}.status`, "active")
      .where(`${statAlias}.is_verified`, true)
      .whereNull(`${statAlias}.deleted_at`)
      .whereNull(`${pageAlias}.deleted_at`)
      .where(`${pageAlias}.review_status`, "approved")
      .where(`${pageAlias}.publish_status`, "published")
      .whereNull(`${brandAlias}.deleted_at`)
      .where(`${brandAlias}.status`, "active")
      .first(`${statAlias}.id`);
    if (statRow) return true;
    const sourceRow = await this.knexService
      .db({ [sourceAlias]: BRAND_PAGE_SOURCE_TABLE })
      .join(
        { [pageAlias]: BRAND_PAGE_TABLE },
        `${pageAlias}.id`,
        `${sourceAlias}.brand_page_id`,
      )
      .join(
        { [brandAlias]: BRAND_TABLE },
        `${brandAlias}.id`,
        `${pageAlias}.brand_id`,
      )
      .where(`${sourceAlias}.file_id`, fileId)
      .where(`${sourceAlias}.status`, "active")
      .whereNull(`${sourceAlias}.deleted_at`)
      .whereNull(`${pageAlias}.deleted_at`)
      .where(`${pageAlias}.review_status`, "approved")
      .where(`${pageAlias}.publish_status`, "published")
      .whereNull(`${brandAlias}.deleted_at`)
      .where(`${brandAlias}.status`, "active")
      .first(`${sourceAlias}.id`);
    return Boolean(sourceRow);
  }
  private async isBannerFilePublic(fileId: string): Promise<boolean> {
    const bannerAlias = "banner_record";
    const row = await this.knexService
      .db({ [bannerAlias]: BANNER_TABLE })
      .whereNull(`${bannerAlias}.deleted_at`)
      .where(`${bannerAlias}.status`, "active")
      .where(`${bannerAlias}.image_file_id`, fileId)
      .first(`${bannerAlias}.id`);
    return Boolean(row);
  }
  private async isProductGroupFilePublic(fileId: string): Promise<boolean> {
    const groupAlias = "group_record";
    const categoryAlias = "category_record";
    const parentAlias = "parent_record";
    const brandAlias = "brand_record";
    const row = await this.knexService
      .db({ [groupAlias]: PRODUCT_GROUP_TABLE })
      .leftJoin(
        { [categoryAlias]: PRODUCT_CATEGORY_TABLE },
        `${categoryAlias}.id`,
        `${groupAlias}.category_id`,
      )
      .leftJoin(
        { [parentAlias]: PRODUCT_CATEGORY_TABLE },
        `${parentAlias}.id`,
        `${categoryAlias}.parent_id`,
      )
      .leftJoin(
        { [brandAlias]: BRAND_TABLE },
        `${brandAlias}.id`,
        `${groupAlias}.brand_id`,
      )
      .andWhere((builder) => {
        builder
          .where(`${groupAlias}.thumbnail_file_id`, fileId)
          .orWhere(`${groupAlias}.seo_og_image_file_id`, fileId);
      })
      .whereNull(`${groupAlias}.deleted_at`)
      .where(`${groupAlias}.status`, "active")
      .where(`${groupAlias}.review_status`, "approved")
      .where(`${groupAlias}.publish_status`, "published")
      .whereNull(`${categoryAlias}.deleted_at`)
      .where(`${categoryAlias}.status`, "active")
      .andWhere((builder) => {
        builder
          .whereNull(`${categoryAlias}.parent_id`)
          .orWhere((parentBuilder) => {
            parentBuilder
              .whereNotNull(`${categoryAlias}.parent_id`)
              .whereNotNull(`${parentAlias}.id`)
              .whereNull(`${parentAlias}.deleted_at`)
              .where(`${parentAlias}.status`, "active");
          });
      })
      .andWhere((builder) => {
        builder.whereNull(`${groupAlias}.brand_id`).orWhere((brandBuilder) => {
          brandBuilder
            .whereNotNull(`${brandAlias}.id`)
            .whereNull(`${brandAlias}.deleted_at`)
            .where(`${brandAlias}.status`, "active");
        });
      })
      .first(`${groupAlias}.id`);
    return Boolean(row);
  }
  private async isProductImageFilePublic(fileId: string): Promise<boolean> {
    const imageAlias = "image_record";
    const groupAlias = "group_record";
    const variantAlias = "variant_record";
    const categoryAlias = "category_record";
    const parentAlias = "parent_record";
    const brandAlias = "brand_record";
    const row = await this.knexService
      .db({ [imageAlias]: PRODUCT_IMAGE_TABLE })
      .innerJoin(
        { [groupAlias]: PRODUCT_GROUP_TABLE },
        `${groupAlias}.id`,
        `${imageAlias}.product_group_id`,
      )
      .leftJoin(
        { [variantAlias]: PRODUCT_VARIANT_TABLE },
        `${variantAlias}.id`,
        `${imageAlias}.product_variant_id`,
      )
      .leftJoin(
        { [categoryAlias]: PRODUCT_CATEGORY_TABLE },
        `${categoryAlias}.id`,
        `${groupAlias}.category_id`,
      )
      .leftJoin(
        { [parentAlias]: PRODUCT_CATEGORY_TABLE },
        `${parentAlias}.id`,
        `${categoryAlias}.parent_id`,
      )
      .leftJoin(
        { [brandAlias]: BRAND_TABLE },
        `${brandAlias}.id`,
        `${groupAlias}.brand_id`,
      )
      .where(`${imageAlias}.file_id`, fileId)
      .whereNull(`${imageAlias}.deleted_at`)
      .whereNull(`${groupAlias}.deleted_at`)
      .where(`${groupAlias}.status`, "active")
      .where(`${groupAlias}.review_status`, "approved")
      .where(`${groupAlias}.publish_status`, "published")
      .andWhere((builder) => {
        builder
          .whereNull(`${imageAlias}.product_variant_id`)
          .orWhere((variantBuilder) => {
            variantBuilder
              .whereNotNull(`${variantAlias}.id`)
              .whereRaw("?? = ??", [
                `${variantAlias}.product_group_id`,
                `${imageAlias}.product_group_id`,
              ])
              .whereNull(`${variantAlias}.deleted_at`)
              .where(`${variantAlias}.status`, "active")
              .where(`${variantAlias}.review_status`, "approved")
              .where(`${variantAlias}.publish_status`, "published");
          });
      })
      .whereNull(`${categoryAlias}.deleted_at`)
      .where(`${categoryAlias}.status`, "active")
      .andWhere((builder) => {
        builder
          .whereNull(`${categoryAlias}.parent_id`)
          .orWhere((parentBuilder) => {
            parentBuilder
              .whereNotNull(`${categoryAlias}.parent_id`)
              .whereNotNull(`${parentAlias}.id`)
              .whereNull(`${parentAlias}.deleted_at`)
              .where(`${parentAlias}.status`, "active");
          });
      })
      .andWhere((builder) => {
        builder.whereNull(`${groupAlias}.brand_id`).orWhere((brandBuilder) => {
          brandBuilder
            .whereNotNull(`${brandAlias}.id`)
            .whereNull(`${brandAlias}.deleted_at`)
            .where(`${brandAlias}.status`, "active");
        });
      })
      .first(`${imageAlias}.id`);
    return Boolean(row);
  }
  private async isTechnicalDocumentFilePublic(
    fileId: string,
  ): Promise<boolean> {
    const documentAlias = "document_record";
    const variantAlias = "variant_record";
    const groupAlias = "group_record";
    const categoryAlias = "category_record";
    const parentAlias = "parent_record";
    const brandAlias = "brand_record";
    const row = await this.knexService
      .db({ [documentAlias]: TECHNICAL_DOCUMENT_TABLE })
      .innerJoin(
        { [groupAlias]: PRODUCT_GROUP_TABLE },
        `${groupAlias}.id`,
        `${documentAlias}.product_group_id`,
      )
      .leftJoin(
        { [variantAlias]: PRODUCT_VARIANT_TABLE },
        `${variantAlias}.id`,
        `${documentAlias}.product_variant_id`,
      )
      .leftJoin(
        { [categoryAlias]: PRODUCT_CATEGORY_TABLE },
        `${categoryAlias}.id`,
        `${groupAlias}.category_id`,
      )
      .leftJoin(
        { [parentAlias]: PRODUCT_CATEGORY_TABLE },
        `${parentAlias}.id`,
        `${categoryAlias}.parent_id`,
      )
      .leftJoin(
        { [brandAlias]: BRAND_TABLE },
        `${brandAlias}.id`,
        `${groupAlias}.brand_id`,
      )
      .where(`${documentAlias}.file_id`, fileId)
      .whereNull(`${documentAlias}.deleted_at`)
      .where(`${documentAlias}.status`, "active")
      .where(`${documentAlias}.is_public`, true)
      .whereNull(`${groupAlias}.deleted_at`)
      .where(`${groupAlias}.status`, "active")
      .where(`${groupAlias}.review_status`, "approved")
      .where(`${groupAlias}.publish_status`, "published")
      .whereNull(`${categoryAlias}.deleted_at`)
      .where(`${categoryAlias}.status`, "active")
      .andWhere((builder) => {
        builder
          .whereNull(`${categoryAlias}.parent_id`)
          .orWhere((parentBuilder) => {
            parentBuilder
              .whereNotNull(`${categoryAlias}.parent_id`)
              .whereNotNull(`${parentAlias}.id`)
              .whereNull(`${parentAlias}.deleted_at`)
              .where(`${parentAlias}.status`, "active");
          });
      })
      .andWhere((builder) => {
        builder.whereNull(`${groupAlias}.brand_id`).orWhere((brandBuilder) => {
          brandBuilder
            .whereNotNull(`${brandAlias}.id`)
            .whereNull(`${brandAlias}.deleted_at`)
            .where(`${brandAlias}.status`, "active");
        });
      })
      .andWhere((builder) => {
        builder
          .whereNull(`${documentAlias}.product_variant_id`)
          .orWhere((variantBuilder) => {
            variantBuilder
              .whereNotNull(`${variantAlias}.id`)
              .whereRaw("?? = ??", [
                `${variantAlias}.product_group_id`,
                `${documentAlias}.product_group_id`,
              ])
              .whereNull(`${variantAlias}.deleted_at`)
              .where(`${variantAlias}.status`, "active")
              .where(`${variantAlias}.review_status`, "approved")
              .where(`${variantAlias}.publish_status`, "published");
          });
      })
      .first(`${documentAlias}.id`);
    return Boolean(row);
  }
  private async listPublicRelatedProductGroups(params: {
    relationTable: string;
    relationAlias: string;
    relationColumn: string;
    relationValue: string;
  }): Promise<PublicRelatedProductGroupRow[]> {
    const groupAlias = "group_record";
    const categoryAlias = "category_record";
    const parentAlias = "parent_record";
    const brandAlias = "brand_record";
    const rows = (await this.knexService
      .db({ [params.relationAlias]: params.relationTable })
      .innerJoin(
        { [groupAlias]: PRODUCT_GROUP_TABLE },
        `${groupAlias}.id`,
        `${params.relationAlias}.product_group_id`,
      )
      .leftJoin(
        { [categoryAlias]: PRODUCT_CATEGORY_TABLE },
        `${categoryAlias}.id`,
        `${groupAlias}.category_id`,
      )
      .leftJoin(
        { [parentAlias]: PRODUCT_CATEGORY_TABLE },
        `${parentAlias}.id`,
        `${categoryAlias}.parent_id`,
      )
      .leftJoin(
        { [brandAlias]: BRAND_TABLE },
        `${brandAlias}.id`,
        `${groupAlias}.brand_id`,
      )
      .where(
        `${params.relationAlias}.${params.relationColumn}`,
        params.relationValue,
      )
      .whereNull(`${params.relationAlias}.deleted_at`)
      .whereNull(`${groupAlias}.deleted_at`)
      .where(`${groupAlias}.status`, "active")
      .where(`${groupAlias}.review_status`, "approved")
      .where(`${groupAlias}.publish_status`, "published")
      .whereNull(`${categoryAlias}.deleted_at`)
      .where(`${categoryAlias}.status`, "active")
      .andWhere((builder) => {
        builder
          .whereNull(`${categoryAlias}.parent_id`)
          .orWhere((parentBuilder) => {
            parentBuilder
              .whereNotNull(`${categoryAlias}.parent_id`)
              .whereNotNull(`${parentAlias}.id`)
              .whereNull(`${parentAlias}.deleted_at`)
              .where(`${parentAlias}.status`, "active");
          });
      })
      .andWhere((builder) => {
        builder.whereNull(`${groupAlias}.brand_id`).orWhere((brandBuilder) => {
          brandBuilder
            .whereNotNull(`${brandAlias}.id`)
            .whereNull(`${brandAlias}.deleted_at`)
            .where(`${brandAlias}.status`, "active");
        });
      })
      .select(
        `${groupAlias}.id`,
        `${groupAlias}.name`,
        `${groupAlias}.slug`,
        `${groupAlias}.category_id`,
        `${categoryAlias}.name as category_name`,
        `${groupAlias}.brand_id`,
        `${brandAlias}.name as brand_name`,
        `${groupAlias}.short_description`,
        `${groupAlias}.detailed_description`,
        `${groupAlias}.thumbnail_file_id`,
      )
      .orderBy(`${groupAlias}.sort_order`, "asc")
      .orderBy(`${groupAlias}.name`, "asc")) as PublicRelatedProductGroupRow[];
    return rows;
  }
  private applyPublicProductSpecFilters(
    query: Knex.QueryBuilder,
    groupAlias: string,
    selections: PublicProductSpecFilterSelection[],
  ): void {
    if (selections.length === 0) {
      return;
    }
    const flattenedMatchersByGroupKey = new Map<
      string,
      PublicProductSpecFilterMatcher[]
    >();
    for (const selection of selections) {
      const currentMatchers =
        flattenedMatchersByGroupKey.get(selection.group_key) ?? [];
      const seenMatcherKeys = new Set(
        currentMatchers.map(
          (matcher) => `${matcher.spec_name}::${matcher.spec_value}`,
        ),
      );
      for (const matcher of selection.matchers) {
        const matcherKey = `${matcher.spec_name}::${matcher.spec_value}`;
        if (seenMatcherKeys.has(matcherKey)) {
          continue;
        }
        seenMatcherKeys.add(matcherKey);
        currentMatchers.push(matcher);
      }
      flattenedMatchersByGroupKey.set(selection.group_key, currentMatchers);
    }
    for (const matchers of flattenedMatchersByGroupKey.values()) {
      if (matchers.length === 0) {
        continue;
      }
      query.andWhere((builder) => {
        builder
          .whereExists(this.buildSharedSpecMatchQuery(groupAlias, matchers))
          .orWhereExists(this.buildVariantSpecMatchQuery(groupAlias, matchers))
          .orWhereExists(
            this.buildVariantAttributeMatchQuery(groupAlias, matchers),
          );
      });
    }
  }
  private buildSharedSpecMatchQuery(
    groupAlias: string,
    matchers: PublicProductSpecFilterMatcher[],
  ): Knex.QueryBuilder {
    return this.knexService
      .db({ spec_group_record: SPEC_GROUP_TABLE })
      .innerJoin(
        { product_spec_record: PRODUCT_SPEC_TABLE },
        "product_spec_record.spec_group_id",
        "spec_group_record.id",
      )
      .select(this.knexService.db.raw("1"))
      .whereRaw("?? = ??", [
        "spec_group_record.product_group_id",
        `${groupAlias}.id`,
      ])
      .whereNull("spec_group_record.deleted_at")
      .whereNull("product_spec_record.deleted_at")
      .andWhere((builder) => {
        for (const matcher of matchers) {
          builder.orWhere((matcherBuilder) => {
            matcherBuilder
              .where("product_spec_record.spec_name", matcher.spec_name)
              .where("product_spec_record.spec_value", matcher.spec_value);
          });
        }
      });
  }
  private buildVariantSpecMatchQuery(
    groupAlias: string,
    matchers: PublicProductSpecFilterMatcher[],
  ): Knex.QueryBuilder {
    return this.knexService
      .db({ variant_spec_group_record: VARIANT_SPEC_GROUP_TABLE })
      .innerJoin(
        { variant_record: PRODUCT_VARIANT_TABLE },
        "variant_record.id",
        "variant_spec_group_record.product_variant_id",
      )
      .innerJoin(
        { variant_spec_record: VARIANT_SPEC_TABLE },
        "variant_spec_record.variant_spec_group_id",
        "variant_spec_group_record.id",
      )
      .select(this.knexService.db.raw("1"))
      .whereRaw("?? = ??", [
        "variant_record.product_group_id",
        `${groupAlias}.id`,
      ])
      .whereNull("variant_spec_group_record.deleted_at")
      .whereNull("variant_spec_record.deleted_at")
      .whereNull("variant_record.deleted_at")
      .where({
        "variant_record.status": "active",
        "variant_record.review_status": "approved",
        "variant_record.publish_status": "published",
      })
      .andWhere((builder) => {
        for (const matcher of matchers) {
          builder.orWhere((matcherBuilder) => {
            matcherBuilder
              .where("variant_spec_record.spec_name", matcher.spec_name)
              .where("variant_spec_record.spec_value", matcher.spec_value);
          });
        }
      });
  }
  private buildVariantAttributeMatchQuery(
    groupAlias: string,
    matchers: PublicProductSpecFilterMatcher[],
  ): Knex.QueryBuilder {
    return this.knexService
      .db({ variant_attribute_record: VARIANT_ATTRIBUTE_TABLE })
      .innerJoin(
        { variant_record: PRODUCT_VARIANT_TABLE },
        "variant_record.id",
        "variant_attribute_record.product_variant_id",
      )
      .select(this.knexService.db.raw("1"))
      .whereRaw("?? = ??", [
        "variant_record.product_group_id",
        `${groupAlias}.id`,
      ])
      .whereNull("variant_attribute_record.deleted_at")
      .whereNull("variant_record.deleted_at")
      .where({
        "variant_record.status": "active",
        "variant_record.review_status": "approved",
        "variant_record.publish_status": "published",
      })
      .andWhere((builder) => {
        for (const matcher of matchers) {
          builder.orWhere((matcherBuilder) => {
            matcherBuilder
              .where(
                "variant_attribute_record.attribute_name",
                matcher.spec_name,
              )
              .where(
                "variant_attribute_record.attribute_value",
                matcher.spec_value,
              );
          });
        }
      });
  }
  private async listPublicCategoryFilterIds(
    categoryId: string,
  ): Promise<string[]> {
    const requestedCategoryIds = Array.from(
      new Set(
        categoryId
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
    if (requestedCategoryIds.length === 0) {
      return [];
    }
    const categoryAlias = "category_record";
    const parentAlias = "parent_record";
    const categoryRows = (await this.knexService
      .db({ [categoryAlias]: PRODUCT_CATEGORY_TABLE })
      .leftJoin(
        { [parentAlias]: PRODUCT_CATEGORY_TABLE },
        `${parentAlias}.id`,
        `${categoryAlias}.parent_id`,
      )
      .whereIn(`${categoryAlias}.id`, requestedCategoryIds)
      .whereNull(`${categoryAlias}.deleted_at`)
      .where(`${categoryAlias}.status`, "active")
      .andWhere((builder) => {
        builder
          .whereNull(`${categoryAlias}.parent_id`)
          .orWhere((parentBuilder) => {
            parentBuilder
              .whereNotNull(`${categoryAlias}.parent_id`)
              .whereNotNull(`${parentAlias}.id`)
              .whereNull(`${parentAlias}.deleted_at`)
              .where(`${parentAlias}.status`, "active");
          });
      })
      .select(`${categoryAlias}.id`, `${categoryAlias}.parent_id`)) as Array<{
      id: string;
      parent_id: string | null;
    }>;
    if (categoryRows.length === 0) {
      return [];
    }
    const categoryRowsById = new Map(categoryRows.map((row) => [row.id, row]));
    const rootCategoryIds = categoryRows
      .filter((row) => !row.parent_id)
      .map((row) => row.id);
    const childRows = rootCategoryIds.length
      ? ((await this.knexService
          .db(PRODUCT_CATEGORY_TABLE)
          .whereIn("parent_id", rootCategoryIds)
          .where({ status: "active" })
          .whereNull("deleted_at")
          .select("id", "parent_id")) as Array<{
          id: string;
          parent_id: string | null;
        }>)
      : [];
    const childIdsByParentId = new Map<string, string[]>();
    for (const childRow of childRows) {
      if (!childRow.parent_id) {
        continue;
      }
      const existingIds = childIdsByParentId.get(childRow.parent_id) ?? [];
      existingIds.push(childRow.id);
      childIdsByParentId.set(childRow.parent_id, existingIds);
    }
    const expandedCategoryIds: string[] = [];
    const seenCategoryIds = new Set<string>();
    for (const requestedCategoryId of requestedCategoryIds) {
      const categoryRow = categoryRowsById.get(requestedCategoryId);
      if (!categoryRow) {
        continue;
      }
      if (!seenCategoryIds.has(categoryRow.id)) {
        seenCategoryIds.add(categoryRow.id);
        expandedCategoryIds.push(categoryRow.id);
      }
      if (categoryRow.parent_id) {
        continue;
      }
      for (const childCategoryId of childIdsByParentId.get(categoryRow.id) ??
        []) {
        if (seenCategoryIds.has(childCategoryId)) {
          continue;
        }
        seenCategoryIds.add(childCategoryId);
        expandedCategoryIds.push(childCategoryId);
      }
    }
    return expandedCategoryIds;
  }
  private async countDistinct(
    query: Knex.QueryBuilder,
    column: string,
  ): Promise<number> {
    const row = (await query
      .clone()
      .countDistinct({ total: column })
      .first()) as { total?: string | number } | undefined;
    return Number(row?.total ?? 0);
  }
  private async countMapWithFilters(
    tableName: string,
    columnName: string,
    ids: string[],
    applyFilters: (query: Knex.QueryBuilder) => void,
  ): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const query = this.knexService
      .db(tableName)
      .select(columnName)
      .whereIn(columnName, ids);
    applyFilters(query);
    const rows = (await query
      .groupBy(columnName)
      .count({ total: columnName })) as Array<
      Record<string, string | number | null>
    >;
    return new Map(
      rows.map((row) => [String(row[columnName]), Number(row.total ?? 0)]),
    );
  }
  private async resolveCustomerProfileId(
    trx: Knex.Transaction,
    input: {
      full_name: string;
      phone: string | null;
      email: string | null;
      company_name: string | null;
    },
  ): Promise<string> {
    const normalizedName = this.normalizeCustomerName(input.full_name);
    const normalizedPhone = this.normalizePhone(input.phone);
    const normalizedEmail = this.normalizeEmail(input.email);
    const identityLockKey = [
      "customer-profile",
      normalizedName,
      normalizedPhone ? `phone:${normalizedPhone}` : `email:${normalizedEmail ?? "none"}`,
    ].join(":");
    await trx.raw("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", [
      identityLockKey,
    ]);
    const existing = await trx<CustomerProfileMatchRow>(CUSTOMER_PROFILE_TABLE)
      .select("id", "full_name", "phone", "email", "company_name", "deleted_at")
      .whereRaw(
        "lower(regexp_replace(btrim(full_name), '[[:space:]]+', ' ', 'g')) = ?",
        [normalizedName],
      )
      .andWhere((builder) => {
        if (normalizedPhone && normalizedEmail) {
          builder
            .whereRaw(
              "regexp_replace(coalesce(phone, ''), '[^0-9+]+', '', 'g') = ?",
              [normalizedPhone],
            )
            .orWhereRaw("lower(btrim(coalesce(email, ''))) = ?", [
              normalizedEmail,
            ]);
        } else if (normalizedPhone) {
          builder.whereRaw(
            "regexp_replace(coalesce(phone, ''), '[^0-9+]+', '', 'g') = ?",
            [normalizedPhone],
          );
        } else if (normalizedEmail) {
          builder.whereRaw("lower(btrim(coalesce(email, ''))) = ?", [
            normalizedEmail,
          ]);
        }
      })
      .orderByRaw("CASE WHEN deleted_at IS NULL THEN 0 ELSE 1 END ASC")
      .orderBy("created_at", "asc")
      .forUpdate()
      .first();
    if (!existing) {
      const [created] = await trx(CUSTOMER_PROFILE_TABLE)
        .insert({
          full_name: input.full_name,
          phone: input.phone?.trim() || null,
          email: normalizedEmail,
          company_name: input.company_name?.trim() || null,
        })
        .returning(["id"]);
      return created.id as string;
    }
    const patch: Record<string, unknown> = {};
    if (existing.deleted_at) {
      patch.deleted_at = null;
    }
    if (
      (!existing.phone || existing.phone.trim() === "") &&
      input.phone?.trim()
    ) {
      patch.phone = input.phone.trim();
    }
    if ((!existing.email || existing.email.trim() === "") && normalizedEmail) {
      patch.email = normalizedEmail;
    }
    if (
      (!existing.company_name || existing.company_name.trim() === "") &&
      input.company_name?.trim()
    ) {
      patch.company_name = input.company_name.trim();
    }
    if (Object.keys(patch).length > 0) {
      await trx(CUSTOMER_PROFILE_TABLE)
        .where({ id: existing.id })
        .update(patch);
    }
    return existing.id;
  }
  private normalizePhone(value: string | null): string | null {
    if (!value) {
      return null;
    }
    const normalized = value.replace(/[^0-9+]+/g, "").trim();
    return normalized === "" ? null : normalized;
  }
  private normalizeCustomerName(value: string): string {
    return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi-VN");
  }
  private normalizeEmail(value: string | null): string | null {
    if (!value) {
      return null;
    }
    const normalized = value.trim().toLowerCase();
    return normalized === "" ? null : normalized;
  }
}
