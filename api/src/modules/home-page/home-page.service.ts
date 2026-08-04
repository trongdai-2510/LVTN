import { HttpStatus, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { KnexService } from '../../db/knex.service';
import { UpdateHomePageDto } from './home-page.dto';
import {
  assertHomeSectionType,
  normalizeEnabled,
  normalizeSectionConfig,
  normalizeSortOrder,
  normalizeSubtitle,
  normalizeTitleOverride,
  validationError
} from './home-page.guardrails';
import { HomePageRepository } from './home-page.repository';
import {
  DEFAULT_HOME_SECTION_CONFIGS,
  DEFAULT_HOME_SECTION_ORDER,
  HOME_SECTION_TYPES,
  type HomeSectionConfig,
  type HomeSectionMutationInput,
  type HomeSectionRecord,
  type HomeSectionType
} from './home-page.types';

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text.length > 0 ? text : null;
}

export interface ResolvedSummary {
  id: string;
  title: string;
  slug?: string | null;
  image_file_id?: string | null;
  archived?: boolean;
}

export interface AvailabilityCounts {
  hero_position_banner_count: number;
  active_categories_count: number;
  active_product_groups_count: number;
  active_services_count: number;
  active_projects_count: number;
  active_brands_count: number;
}

export interface ResolvedPicks {
  banners: ResolvedSummary[];
  product_categories: ResolvedSummary[];
  product_groups: ResolvedSummary[];
  services: ResolvedSummary[];
  projects: ResolvedSummary[];
  brands: ResolvedSummary[];
  page_content_company_overview: ResolvedSummary | null;
}

interface HomeSeoRecord {
  id: string;
  home_seo_title: string | null;
  home_seo_description: string | null;
}

@Injectable()
export class HomePageService {
  constructor(
    private readonly homePageRepository: HomePageRepository,
    private readonly knexService: KnexService
  ) {}

  async getAdminLayout() {
    const sections = await this.ensureFullLayout();
    const [resolved, availability] = await Promise.all([
      this.resolvePicks(sections),
      this.getAvailabilityCounts(sections)
    ]);
    return {
      sections: this.serializeSections(sections),
      seo: await this.getHomeSeo(),
      resolved_picks: resolved,
      availability
    };
  }

  async getPublicLayout() {
    const sections = await this.ensureFullLayout();
    return {
      seo: await this.getHomeSeo(),
      sections: this.serializeSections(sections)
        .filter((section) => section.enabled)
        .sort((a, b) => a.sort_order - b.sort_order)
    };
  }

  async updateLayout(input: UpdateHomePageDto) {
    if (!Array.isArray(input.sections)) {
      throw validationError('sections must be an array.', { field: 'sections' });
    }
    if (input.sections.length !== HOME_SECTION_TYPES.length) {
      throw validationError(
        `sections must contain exactly ${HOME_SECTION_TYPES.length} entries (one per section_type).`,
        { field: 'sections' }
      );
    }

    const seenTypes = new Set<HomeSectionType>();
    const seenSortOrders = new Set<number>();
    const mutations: HomeSectionMutationInput[] = [];

    for (const raw of input.sections) {
      const sectionType = assertHomeSectionType(raw.section_type);
      if (seenTypes.has(sectionType)) {
        throw validationError(`Duplicate section_type: ${sectionType}.`, { field: 'section_type' });
      }
      seenTypes.add(sectionType);

      const sortOrder = normalizeSortOrder(raw.sort_order);
      if (seenSortOrders.has(sortOrder)) {
        throw validationError(`Duplicate sort_order: ${sortOrder}.`, { field: 'sort_order' });
      }
      seenSortOrders.add(sortOrder);

      mutations.push({
        section_type: sectionType,
        enabled: normalizeEnabled(raw.enabled),
        sort_order: sortOrder,
        title_override: normalizeTitleOverride(raw.title_override),
        subtitle: normalizeSubtitle(raw.subtitle),
        config: normalizeSectionConfig(sectionType, raw.config ?? {})
      });
    }

    for (const type of HOME_SECTION_TYPES) {
      if (!seenTypes.has(type)) {
        throw validationError(`Missing section_type: ${type}.`, { field: 'section_type' });
      }
    }

    await this.assertReferencedRecordsExist(mutations);
    await this.homePageRepository.replaceAll(mutations);
    if (input.seo) await this.updateHomeSeo(input.seo);
    return this.getAdminLayout();
  }

  private async getHomeSeo() {
    const row = await this.knexService.db<HomeSeoRecord>('company_info')
      .whereNull('deleted_at')
      .orderBy('created_at', 'asc')
      .first('id', 'home_seo_title', 'home_seo_description');
    return {
      title: row?.home_seo_title ?? null,
      description: row?.home_seo_description ?? null
    };
  }

  private async updateHomeSeo(input: { title?: string | null; description?: string | null }) {
    const row = await this.knexService.db<HomeSeoRecord>('company_info')
      .whereNull('deleted_at')
      .orderBy('created_at', 'asc')
      .first('id');
    if (!row) {
      throw validationError('Company information must be configured before homepage SEO can be saved.', {
        field: 'seo'
      });
    }
    await this.knexService.db('company_info').where({ id: row.id }).update({
      home_seo_title: input.title?.trim() || null,
      home_seo_description: input.description?.trim() || null
    });
  }

  private async ensureFullLayout(): Promise<HomeSectionRecord[]> {
    const existing = await this.homePageRepository.listAll();
    const existingByType = new Map(existing.map((row) => [row.section_type, row]));
    const missing: HomeSectionMutationInput[] = [];

    DEFAULT_HOME_SECTION_ORDER.forEach((type, index) => {
      if (existingByType.has(type)) return;
      missing.push({
        section_type: type,
        enabled: true,
        sort_order: index,
        title_override: null,
        subtitle: null,
        config: DEFAULT_HOME_SECTION_CONFIGS[type]
      });
    });

    if (missing.length === 0) return existing;

    const merged = [...existing, ...missing.map((row) => this.asRecord(row))];
    await this.homePageRepository.replaceAll([
      ...existing.map((row) => this.recordToMutation(row)),
      ...missing
    ]);
    return merged.sort((a, b) => a.sort_order - b.sort_order);
  }

  private serializeSections(rows: HomeSectionRecord[]) {
    return rows
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((row) => ({
        id: row.id,
        section_type: row.section_type,
        enabled: row.enabled,
        sort_order: row.sort_order,
        title_override: row.title_override,
        subtitle: row.subtitle,
        config: row.config,
        updated_at: row.updated_at
      }));
  }

  private recordToMutation(row: HomeSectionRecord): HomeSectionMutationInput {
    return {
      section_type: row.section_type,
      enabled: row.enabled,
      sort_order: row.sort_order,
      title_override: row.title_override,
      subtitle: row.subtitle,
      config: row.config
    };
  }

  private asRecord(row: HomeSectionMutationInput): HomeSectionRecord {
    const now = new Date();
    return {
      id: '',
      section_type: row.section_type,
      enabled: row.enabled,
      sort_order: row.sort_order,
      title_override: row.title_override,
      subtitle: row.subtitle,
      config: row.config,
      created_by: null,
      updated_by: null,
      created_at: now,
      updated_at: now
    };
  }

  private collectPickedIds(rows: HomeSectionRecord[]) {
    const result = {
      banner_ids: new Set<string>(),
      category_ids: new Set<string>(),
      product_group_ids: new Set<string>(),
      service_ids: new Set<string>(),
      project_ids: new Set<string>(),
      brand_ids: new Set<string>(),
      company_overview_slug: 'gioi-thieu'
    };

    for (const row of rows) {
      const config = row.config as HomeSectionConfig;
      switch (row.section_type) {
        case 'hero':
          (config as { banner_ids: string[] }).banner_ids?.forEach((id) => result.banner_ids.add(id));
          break;
        case 'product_categories':
          (config as { category_ids: string[] }).category_ids?.forEach((id) => result.category_ids.add(id));
          break;
        case 'featured_products':
          (config as { product_group_ids: string[] }).product_group_ids?.forEach((id) => result.product_group_ids.add(id));
          break;
        case 'services':
          (config as { service_ids: string[] }).service_ids?.forEach((id) => result.service_ids.add(id));
          break;
        case 'projects':
          (config as { project_ids: string[] }).project_ids?.forEach((id) => result.project_ids.add(id));
          break;
        case 'brands': {
          const brandsConfig = config as { brand_ids?: string[] };
          brandsConfig.brand_ids?.forEach((id) => result.brand_ids.add(id));
          break;
        }
        case 'company_overview':
          result.company_overview_slug = (config as { page_content_slug: string }).page_content_slug || 'gioi-thieu';
          break;
        default:
          break;
      }
    }

    return result;
  }

  private async resolvePicks(rows: HomeSectionRecord[]): Promise<ResolvedPicks> {
    const ids = this.collectPickedIds(rows);

    const [banners, categories, productGroups, services, projects, brands, companyOverviewPage] = await Promise.all([
      this.lookupBanners([...ids.banner_ids]),
      this.lookupProductCategories([...ids.category_ids]),
      this.lookupProductGroups([...ids.product_group_ids]),
      this.lookupServices([...ids.service_ids]),
      this.lookupProjects([...ids.project_ids]),
      this.lookupBrands([...ids.brand_ids]),
      this.lookupPageContentBySlug(ids.company_overview_slug)
    ]);

    return {
      banners,
      product_categories: categories,
      product_groups: productGroups,
      services,
      projects,
      brands,
      page_content_company_overview: companyOverviewPage
    };
  }

  private async getAvailabilityCounts(rows: HomeSectionRecord[]): Promise<AvailabilityCounts> {
    const heroPosition = this.getHeroAutoPosition(rows);
    const db = this.knexService.db;

    const [heroCount, categoriesCount, productGroupsCount, servicesCount, projectsCount, brandsCount] = await Promise.all([
      db('banner').whereNull('deleted_at').where({ status: 'active', position: heroPosition }).count<{ count: string }>('* as count').first(),
      db('product_category').whereNull('deleted_at').where({ status: 'active' }).whereNull('parent_id').count<{ count: string }>('* as count').first(),
      db('product_group').whereNull('deleted_at').where({ status: 'active', publish_status: 'published' }).count<{ count: string }>('* as count').first(),
      db('service').whereNull('deleted_at').where({ publish_status: 'published' }).count<{ count: string }>('* as count').first(),
      db('project').whereNull('deleted_at').where({ publish_status: 'published' }).count<{ count: string }>('* as count').first(),
      db('brand').whereNull('deleted_at').where({ status: 'active' }).count<{ count: string }>('* as count').first()
    ]);

    return {
      hero_position_banner_count: Number(heroCount?.count ?? 0),
      active_categories_count: Number(categoriesCount?.count ?? 0),
      active_product_groups_count: Number(productGroupsCount?.count ?? 0),
      active_services_count: Number(servicesCount?.count ?? 0),
      active_projects_count: Number(projectsCount?.count ?? 0),
      active_brands_count: Number(brandsCount?.count ?? 0)
    };
  }

  private getHeroAutoPosition(rows: HomeSectionRecord[]): string {
    const hero = rows.find((row) => row.section_type === 'hero');
    const config = hero?.config as { position?: string } | undefined;
    return config?.position?.trim() || 'hero';
  }

  private async lookupBanners(ids: string[]): Promise<ResolvedSummary[]> {
    if (ids.length === 0) return [];
    const rows = await this.knexService.db('banner').select('id', 'title', 'image_file_id', 'deleted_at').whereIn('id', ids);
    return this.indexById(ids, rows, (row) => ({
      id: String(row.id),
      title: String(row.title ?? ''),
      image_file_id: nullableString(row.image_file_id),
      archived: Boolean(row.deleted_at)
    }));
  }

  private async lookupProductCategories(ids: string[]): Promise<ResolvedSummary[]> {
    if (ids.length === 0) return [];
    const rows = await this.knexService.db('product_category').select('id', 'name', 'slug', 'icon_file_id', 'deleted_at', 'status').whereIn('id', ids);
    return this.indexById(ids, rows, (row) => ({
      id: String(row.id),
      title: String(row.name ?? ''),
      slug: nullableString(row.slug),
      image_file_id: nullableString(row.icon_file_id),
      archived: Boolean(row.deleted_at) || row.status === 'inactive'
    }));
  }

  private async lookupProductGroups(ids: string[]): Promise<ResolvedSummary[]> {
    if (ids.length === 0) return [];
    const rows = await this.knexService.db('product_group')
      .select('id', 'name', 'slug', 'thumbnail_file_id', 'deleted_at', 'status', 'publish_status')
      .whereIn('id', ids);
    return this.indexById(ids, rows, (row) => ({
      id: String(row.id),
      title: String(row.name ?? ''),
      slug: nullableString(row.slug),
      image_file_id: nullableString(row.thumbnail_file_id),
      archived: Boolean(row.deleted_at) || row.status === 'inactive' || row.publish_status !== 'published'
    }));
  }

  private async lookupServices(ids: string[]): Promise<ResolvedSummary[]> {
    if (ids.length === 0) return [];
    const rows = await this.knexService.db('service')
      .select('id', 'title', 'slug', 'image_file_id', 'deleted_at', 'publish_status')
      .whereIn('id', ids);
    return this.indexById(ids, rows, (row) => ({
      id: String(row.id),
      title: String(row.title ?? ''),
      slug: nullableString(row.slug),
      image_file_id: nullableString(row.image_file_id),
      archived: Boolean(row.deleted_at) || row.publish_status !== 'published'
    }));
  }

  private async lookupProjects(ids: string[]): Promise<ResolvedSummary[]> {
    if (ids.length === 0) return [];
    const rows = await this.knexService.db('project')
      .select('id', 'title', 'slug', 'image_file_id', 'deleted_at', 'publish_status')
      .whereIn('id', ids);
    return this.indexById(ids, rows, (row) => ({
      id: String(row.id),
      title: String(row.title ?? ''),
      slug: nullableString(row.slug),
      image_file_id: nullableString(row.image_file_id),
      archived: Boolean(row.deleted_at) || row.publish_status !== 'published'
    }));
  }

  private async lookupBrands(ids: string[]): Promise<ResolvedSummary[]> {
    if (ids.length === 0) return [];
    const rows = await this.knexService.db('brand').select('id', 'name', 'slug', 'logo_file_id', 'deleted_at', 'status').whereIn('id', ids);
    return this.indexById(ids, rows, (row) => ({
      id: String(row.id),
      title: String(row.name ?? ''),
      slug: nullableString(row.slug),
      image_file_id: nullableString(row.logo_file_id),
      archived: Boolean(row.deleted_at) || row.status === 'inactive'
    }));
  }

  private async lookupPageContentBySlug(slug: string): Promise<ResolvedSummary | null> {
    const row = await this.knexService.db('page_content')
      .select('id', 'title', 'slug', 'featured_image_file_id', 'deleted_at', 'publish_status')
      .where({ slug })
      .first();
    if (!row) return null;
    return {
      id: String(row.id),
      title: String(row.title ?? ''),
      slug: nullableString(row.slug),
      image_file_id: nullableString(row.featured_image_file_id),
      archived: Boolean(row.deleted_at) || row.publish_status !== 'published'
    };
  }

  private indexById(orderedIds: string[], rows: Array<Record<string, unknown>>, mapper: (row: Record<string, unknown>) => ResolvedSummary): ResolvedSummary[] {
    const map = new Map<string, ResolvedSummary>();
    for (const row of rows) {
      const summary = mapper(row);
      map.set(summary.id, summary);
    }
    const result: ResolvedSummary[] = [];
    for (const id of orderedIds) {
      const summary = map.get(id);
      if (summary) result.push(summary);
      else result.push({ id, title: '', archived: true });
    }
    return result;
  }

  private async assertReferencedRecordsExist(mutations: HomeSectionMutationInput[]) {
    const ids = {
      banner_ids: new Set<string>(),
      category_ids: new Set<string>(),
      product_group_ids: new Set<string>(),
      service_ids: new Set<string>(),
      project_ids: new Set<string>(),
      brand_ids: new Set<string>()
    };

    for (const mutation of mutations) {
      const config = mutation.config as HomeSectionConfig;
      switch (mutation.section_type) {
        case 'hero':
          if ((config as { mode?: string }).mode === 'manual') {
            (config as { banner_ids: string[] }).banner_ids.forEach((id) => ids.banner_ids.add(id));
          }
          break;
        case 'product_categories':
          if ((config as { mode?: string }).mode === 'manual') {
            (config as { category_ids: string[] }).category_ids.forEach((id) => ids.category_ids.add(id));
          }
          break;
        case 'featured_products':
          if ((config as { mode?: string }).mode === 'manual') {
            (config as { product_group_ids: string[] }).product_group_ids.forEach((id) => ids.product_group_ids.add(id));
          }
          break;
        case 'services':
          if ((config as { mode?: string }).mode === 'manual') {
            (config as { service_ids: string[] }).service_ids.forEach((id) => ids.service_ids.add(id));
          }
          break;
        case 'projects':
          if ((config as { mode?: string }).mode === 'manual') {
            (config as { project_ids: string[] }).project_ids.forEach((id) => ids.project_ids.add(id));
          }
          break;
        case 'brands':
          if ((config as { mode?: string }).mode === 'manual') {
            (config as { brand_ids?: string[] }).brand_ids?.forEach((id) => ids.brand_ids.add(id));
          }
          break;
        default:
          break;
      }
    }

    const db = this.knexService.db;
    const checks: Array<Promise<void>> = [];
    if (ids.banner_ids.size > 0) {
      checks.push(this.assertIds(db, 'banner', [...ids.banner_ids]));
    }
    if (ids.category_ids.size > 0) {
      checks.push(this.assertIds(db, 'product_category', [...ids.category_ids]));
    }
    if (ids.product_group_ids.size > 0) {
      checks.push(this.assertIds(db, 'product_group', [...ids.product_group_ids]));
    }
    if (ids.service_ids.size > 0) {
      checks.push(this.assertIds(db, 'service', [...ids.service_ids]));
    }
    if (ids.project_ids.size > 0) {
      checks.push(this.assertIds(db, 'project', [...ids.project_ids]));
    }
    if (ids.brand_ids.size > 0) {
      checks.push(this.assertIds(db, 'brand', [...ids.brand_ids]));
    }
    await Promise.all(checks);
  }

  private async assertIds(db: Knex, table: string, ids: string[]) {
    const rows = await db(table).select('id').whereIn('id', ids);
    const found = new Set(rows.map((row: { id: string }) => String(row.id)));
    for (const id of ids) {
      if (!found.has(id)) {
        throw new AppError({
          code: ErrorCodes.NOT_FOUND,
          message: `Referenced ${table} record not found: ${id}.`,
          statusCode: HttpStatus.NOT_FOUND
        });
      }
    }
  }
}
