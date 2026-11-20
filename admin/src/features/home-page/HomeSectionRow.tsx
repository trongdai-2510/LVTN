'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, ExternalLink, Eye, EyeOff } from '@/components/icons';
import { cn } from '@/lib/cn';
import type { HomePageAdminResponse, HomeSection, HomeSectionType, ResolvedSummary } from './home-page.types';
import { SECTION_META } from './home-page.types';

const SECTION_GUIDE: Record<HomeSectionType, {
  source: string;
  links: Array<{ label: string; href: string }>;
}> = {
  hero: {
    source: 'Ảnh, chữ, nút và đường dẫn của từng banner được sửa trong mục Banner.',
    links: [{ label: 'Quản lý Banner', href: '/banners' }]
  },
  product_categories: {
    source: 'Tên và ảnh của danh mục được sửa trong Danh mục sản phẩm.',
    links: [{ label: 'Quản lý danh mục', href: '/product-categories' }]
  },
  company_overview: {
    source: 'Đoạn giới thiệu và ảnh lấy từ Trang nội dung; thông tin liên hệ lấy từ Cấu hình website.',
    links: [
      { label: 'Trang nội dung', href: '/page-contents' },
      { label: 'Cấu hình website', href: '/website-settings' }
    ]
  },
  featured_products: {
    source: 'Tên, ảnh, giá và thông số của từng sản phẩm được sửa trong Sản phẩm.',
    links: [{ label: 'Quản lý sản phẩm', href: '/product-groups' }]
  },
  services: {
    source: 'Tên, ảnh và mô tả dịch vụ được sửa trong Dịch vụ.',
    links: [{ label: 'Quản lý dịch vụ', href: '/services' }]
  },
  projects: {
    source: 'Tên, ảnh và mô tả dự án được sửa trong Dự án.',
    links: [{ label: 'Quản lý dự án', href: '/projects' }]
  },
  brands: {
    source: 'Thương hiệu được chọn ở đây; đối tác đang hiển thị được lấy từ mục Đối tác.',
    links: [{ label: 'Quản lý thương hiệu', href: '/brands' }, { label: 'Quản lý đối tác', href: '/partners' }]
  },
  trust_strip: {
    source: 'Số liệu tự động được tính từ các dịch vụ, dự án và thương hiệu đang hiển thị.',
    links: []
  },
  contact_cta: {
    source: 'Email và số điện thoại lấy từ Cấu hình website.',
    links: [{ label: 'Cấu hình website', href: '/website-settings' }]
  }
};

function manualSummary(count: number, limit: number, name: string): string {
  return `${count} ${name} đã chọn · tối đa ${limit} hiển thị`;
}

function sectionMode(section: HomeSection): 'auto' | 'manual' | null {
  const config = section.config as { mode?: unknown };
  return config.mode === 'auto' || config.mode === 'manual' ? config.mode : null;
}

function getSectionSettingSummary(section: HomeSection, companyPage?: ResolvedSummary | null): string {
  switch (section.section_type) {
    case 'hero': {
      const config = section.config as { mode: 'auto' | 'manual'; position: string; banner_ids: string[] };
      if (config.mode === 'manual') return `${config.banner_ids.length} banner chọn thủ công`;
      return config.position === 'hero' ? 'Tự động chọn Banner đầu trang' : `Tự động từ nhóm ${config.position}`;
    }
    case 'product_categories': {
      const config = section.config as { mode: 'auto' | 'manual'; item_limit: number; category_ids: string[] };
      return config.mode === 'manual' ? manualSummary(config.category_ids.length, config.item_limit, 'danh mục') : `Tự động · tối đa ${config.item_limit} danh mục`;
    }
    case 'company_overview': {
      const slug = (section.config as { page_content_slug: string }).page_content_slug || 'gioi-thieu';
      return `Lấy từ trang ${companyPage?.slug === slug ? companyPage.title : slug}`;
    }
    case 'featured_products': {
      const config = section.config as { mode: 'auto' | 'manual'; item_limit: number; product_group_ids: string[] };
      return config.mode === 'manual' ? manualSummary(config.product_group_ids.length, config.item_limit, 'sản phẩm') : `Tự động · tối đa ${config.item_limit} sản phẩm`;
    }
    case 'services': {
      const config = section.config as { mode: 'auto' | 'manual'; item_limit: number; service_ids: string[] };
      return config.mode === 'manual' ? manualSummary(config.service_ids.length, config.item_limit, 'dịch vụ') : `Tự động · tối đa ${config.item_limit} dịch vụ`;
    }
    case 'projects': {
      const config = section.config as { mode: 'auto' | 'manual'; item_limit: number; project_ids: string[] };
      return config.mode === 'manual' ? manualSummary(config.project_ids.length, config.item_limit, 'dự án') : `Tự động · tối đa ${config.item_limit} dự án`;
    }
    case 'brands': {
      const config = section.config as { mode: 'auto' | 'manual'; item_limit: number; brand_ids: string[] };
      return config.mode === 'manual' ? manualSummary(config.brand_ids.length, config.item_limit, 'thương hiệu') : `Tự động · tối đa ${config.item_limit} thương hiệu`;
    }
    case 'trust_strip':
      return (section.config as { mode: 'auto' | 'manual' }).mode === 'manual' ? 'Số liệu tự nhập' : 'Số liệu tự động';
    case 'contact_cta':
      return (section.config as { show_quote_form: boolean }).show_quote_form ? 'Có biểu mẫu báo giá' : 'Không hiện biểu mẫu';
  }
}

function hasMissingSource(section: HomeSection, availability: HomePageAdminResponse['availability'] | undefined): boolean {
  if (!section.enabled) return false;
  if (section.section_type === 'company_overview' || section.section_type === 'contact_cta' || section.section_type === 'trust_strip') return false;

  const config = section.config as { mode: 'auto' | 'manual'; banner_ids?: string[]; category_ids?: string[]; product_group_ids?: string[]; service_ids?: string[]; project_ids?: string[]; brand_ids?: string[] };
  if (config.mode === 'manual') {
    if (section.section_type === 'brands' && (availability?.active_partners_count ?? 0) > 0) return false;
    const ids = config.banner_ids ?? config.category_ids ?? config.product_group_ids ?? config.service_ids ?? config.project_ids ?? config.brand_ids ?? [];
    return ids.length === 0;
  }
  if (section.section_type === 'hero' && 'position' in config && config.position !== 'hero') return false;

  const counts: Partial<Record<HomeSectionType, number | undefined>> = {
    hero: availability?.hero_position_banner_count,
    product_categories: availability?.active_categories_count,
    featured_products: availability?.active_product_groups_count,
    services: availability?.active_services_count,
    projects: availability?.active_projects_count,
    brands: (availability?.active_brands_count ?? 0) + (availability?.active_partners_count ?? 0)
  };
  return counts[section.section_type] === 0;
}

export function HomeSectionRow({
  section,
  index,
  total,
  open,
  changed,
  savedEnabled,
  savedSection,
  siteBaseUrl,
  readOnly,
  onToggleOpen,
  onToggleVisibility,
  onMove,
  availability,
  companyPage,
  children
}: {
  section: HomeSection;
  index: number;
  total: number;
  open: boolean;
  changed: boolean;
  savedEnabled: boolean;
  savedSection: HomeSection | undefined;
  siteBaseUrl: string;
  readOnly: boolean;
  onToggleOpen: () => void;
  onToggleVisibility: () => void;
  onMove: (direction: 1 | -1) => void;
  availability: HomePageAdminResponse['availability'] | undefined;
  companyPage: ResolvedSummary | null;
  children: ReactNode;
}) {
  const meta = SECTION_META[section.section_type];
  const guide = SECTION_GUIDE[section.section_type];
  const missingSource = hasMissingSource(section, availability);
  const visibilityChanged = section.enabled !== savedEnabled;
  const currentMode = sectionMode(section);
  const savedMode = savedSection ? sectionMode(savedSection) : null;
  const sectionUrl = savedEnabled ? `${siteBaseUrl}/#home-${section.section_type}` : `${siteBaseUrl}/`;

  return (
    <li className={cn('scroll-mt-28', open ? 'bg-blue-50/20' : 'bg-panel')}>
      <div className="grid gap-3 px-4 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center sm:px-5">
        <span className="hidden text-sm font-semibold tabular-nums text-primary sm:block">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-[15px] font-semibold leading-6 text-text">
              <span className="mr-2 text-primary sm:hidden">{String(index + 1).padStart(2, '0')}</span>
              {meta.label}
            </h2>
            <span className={cn(
              'text-xs font-medium',
              visibilityChanged ? 'text-amber-800' : !section.enabled ? 'text-muted-foreground' : missingSource ? 'text-amber-800' : 'text-green-800'
            )}>
              {visibilityChanged
                ? section.enabled ? 'Sẽ hiện sau khi lưu' : 'Sẽ ẩn sau khi lưu'
                : !section.enabled ? 'Đang ẩn' : missingSource ? 'Thiếu nội dung' : 'Đang hiện'}
            </span>
            {changed && !visibilityChanged ? <span className="text-xs font-semibold text-amber-800">Chưa lưu</span> : null}
            {savedMode ? (
              <span className="rounded-sm border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
                {savedEnabled ? 'Website' : 'Đã lưu'}: {savedMode === 'auto' ? 'Tự động' : 'Thủ công'}
              </span>
            ) : null}
            {currentMode && savedMode && currentMode !== savedMode ? (
              <span className="rounded-sm border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                Sau khi lưu: {currentMode === 'auto' ? 'Tự động' : 'Thủ công'}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] leading-5 text-muted-foreground">
            <span>{getSectionSettingSummary(section, companyPage)}</span>
            <span aria-hidden className="text-slate-300">·</span>
            {guide.links.length > 0 ? (
              <span>
                Nội dung tại{' '}
                {guide.links.map((link, linkIndex) => (
                  <span key={link.href}>
                    {linkIndex > 0 ? ', ' : ''}
                    <Link href={link.href} className="font-medium text-primary underline-offset-2 hover:underline">
                      {link.label}
                    </Link>
                  </span>
                ))}
              </span>
            ) : <span>Nội dung chỉnh tại đây</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href={sectionUrl} target="_blank" rel="noreferrer" aria-label={savedEnabled ? 'Xem ' + meta.label + ' đã lưu trên website' : 'Xem trang chủ trên website'} className="inline-flex min-h-11 sm:min-h-10 items-center gap-1 text-sm font-medium text-primary hover:underline">
            {savedEnabled ? 'Xem' : 'Xem trang'} <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={open ? 'home-editor-' + section.section_type : undefined}
            onClick={onToggleOpen}
            className="inline-flex min-h-11 sm:min-h-10 items-center justify-center gap-1 rounded-sm border border-border bg-panel px-3 text-sm font-medium text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {open ? 'Thu gọn' : 'Cài đặt'}
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open ? (
        <div id={'home-editor-' + section.section_type} className="border-t border-border bg-panel px-4 py-5 sm:px-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-text">Cài đặt khu này</h3>
              <p className="mt-1 text-sm text-muted-foreground">{guide.source}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={readOnly}
                aria-pressed={section.enabled}
                onClick={onToggleVisibility}
                className="inline-flex min-h-11 sm:min-h-10 items-center gap-1.5 rounded-sm border border-border px-3 text-sm text-text hover:bg-muted disabled:opacity-50"
              >
                {section.enabled ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {section.enabled ? 'Ẩn khu' : 'Hiện khu'}
              </button>
              <div className="inline-flex items-center overflow-hidden rounded-sm border border-border" aria-label={'Thứ tự ' + meta.label}>
                <button
                  type="button"
                  disabled={readOnly || index === 0}
                  onClick={() => onMove(-1)}
                  aria-label={'Đưa ' + meta.label + ' lên trước'}
                  className="flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center text-text hover:bg-muted disabled:opacity-35"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={readOnly || index === total - 1}
                  onClick={() => onMove(1)}
                  aria-label={'Đưa ' + meta.label + ' xuống sau'}
                  className="flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center border-l border-border text-text hover:bg-muted disabled:opacity-35"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          {children}
        </div>
      ) : null}
    </li>
  );
}
