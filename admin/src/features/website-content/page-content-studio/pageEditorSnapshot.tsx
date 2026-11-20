'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { apiClient } from '@/lib/api-client';
import { getTemplateBlocks, type PageTemplateBlock, type PageContentTemplate } from './pageContentTemplates';
import { type PageSnapshotState } from './pageEditorShared';
import { extractCompanyInfo, extractPublicItems, extractPublicTotal, getText } from './pageEditorHelpers';

export function usePublicPageSnapshot(enabled: boolean): PageSnapshotState {
  const [state, setState] = useState<PageSnapshotState>({
    loading: false,
    error: '',
    companyInfo: null,
    banners: [],
    productBanners: [],
    capabilityBanners: [],
    serviceBanners: [],
    projectBanners: [],
    brandBanners: [],
    contactBanners: [],
    newsBanners: [],
    brands: [],
    productCategories: [],
    productGroups: [],
    services: [],
    projects: [],
    brandCount: 0,
    productCategoryCount: 0,
    productGroupCount: 0,
    serviceCount: 0,
    projectCount: 0
  });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    async function load() {
      setState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const [
          shell,
          banners,
          productBanners,
          capabilityBanners,
          serviceBanners,
          projectBanners,
          brandBanners,
          contactBanners,
          newsBanners,
          brands,
          productCategories,
          productGroups,
          services,
          projects
        ] = await Promise.all([
          apiClient.get<unknown>('/public/site-shell'),
          apiClient.get<unknown>('/public/banners?position=gioi-thieu'),
          apiClient.get<unknown>('/public/banners?position=san-pham'),
          apiClient.get<unknown>('/public/banners?position=ho-so-nang-luc'),
          apiClient.get<unknown>('/public/banners?position=dich-vu'),
          apiClient.get<unknown>('/public/banners?position=du-an'),
          apiClient.get<unknown>('/public/banners?position=doi-tac-thuong-hieu'),
          apiClient.get<unknown>('/public/banners?position=lien-he'),
          apiClient.get<unknown>('/public/banners?position=tin-tuc'),
          apiClient.get<unknown>('/public/brands?page=1&page_size=40'),
          apiClient.get<unknown>('/public/product-categories'),
          apiClient.get<unknown>('/public/product-groups?page=1&page_size=40'),
          apiClient.get<unknown>('/public/services?page=1&page_size=40'),
          apiClient.get<unknown>('/public/projects?page=1&page_size=40')
        ]);
        if (!active) return;
        setState({
          loading: false,
          error: '',
          companyInfo: extractCompanyInfo(shell),
          banners: extractPublicItems(banners),
          productBanners: extractPublicItems(productBanners),
          capabilityBanners: extractPublicItems(capabilityBanners),
          serviceBanners: extractPublicItems(serviceBanners),
          projectBanners: extractPublicItems(projectBanners),
          brandBanners: extractPublicItems(brandBanners),
          contactBanners: extractPublicItems(contactBanners),
          newsBanners: extractPublicItems(newsBanners),
          brands: extractPublicItems(brands),
          productCategories: extractPublicItems(productCategories),
          productGroups: extractPublicItems(productGroups),
          services: extractPublicItems(services),
          projects: extractPublicItems(projects),
          brandCount: extractPublicTotal(brands),
          productCategoryCount: extractPublicTotal(productCategories),
          productGroupCount: extractPublicTotal(productGroups),
          serviceCount: extractPublicTotal(services),
          projectCount: extractPublicTotal(projects)
        });
      } catch {
        if (!active) return;
        setState((current) => ({
          ...current,
          loading: false,
          error: 'Không thể lấy dữ liệu đang hiển thị trên website. Hãy thử mở lại mục này.'
        }));
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [enabled]);

  return state;
}

export function buildLivePageLines(template: PageContentTemplate, snapshot: PageSnapshotState) {
  const company = snapshot.companyInfo;
  const hotline = getText(company?.hotline);
  const email = getText(company?.email);
  const address = getText(company?.address);
  const hasMap = Boolean(getText(company?.map_embed_code));

  if (template.mode === 'about') {
    return [
      { label: 'Hero banner', value: snapshot.banners.length ? `${snapshot.banners.length} banner` : 'Chưa có' },
      { label: 'Thông tin công ty', value: hotline || email || address ? 'Đã có' : 'Chưa đủ' },
      { label: 'Thương hiệu', value: `${snapshot.brandCount} đang hiển thị` }
    ];
  }
  if (template.mode === 'products') {
    return [
      { label: 'Banner trang sản phẩm', value: snapshot.productBanners.length ? `${snapshot.productBanners.length} banner` : 'Chưa có' },
      { label: 'Danh mục đang hiển thị', value: `${snapshot.productCategoryCount} mục` },
      { label: 'Nhóm sản phẩm đang hiển thị', value: `${snapshot.productGroupCount} mục` }
    ];
  }
  if (template.mode === 'capability_profile') {
    return [
      { label: 'Banner hồ sơ năng lực', value: snapshot.capabilityBanners.length ? `${snapshot.capabilityBanners.length} banner` : 'Chưa có' }
    ];
  }
  if (template.mode === 'services') {
    return [
      { label: 'Banner trang dịch vụ', value: snapshot.serviceBanners.length ? `${snapshot.serviceBanners.length} banner` : 'Chưa có' },
      { label: 'Dịch vụ đang hiển thị', value: `${snapshot.serviceCount} mục` },
      { label: 'Hotline CTA', value: hotline || 'Chưa có' }
    ];
  }
  if (template.mode === 'projects') {
    return [
      { label: 'Banner trang dự án', value: snapshot.projectBanners.length ? `${snapshot.projectBanners.length} banner` : 'Chưa có' },
      { label: 'Dự án đang hiển thị', value: `${snapshot.projectCount} mục` }
    ];
  }
  if (template.mode === 'brands') {
    return [
      { label: 'Banner trang thương hiệu', value: snapshot.brandBanners.length ? `${snapshot.brandBanners.length} banner` : 'Chưa có' },
      { label: 'Thương hiệu đang hiển thị', value: `${snapshot.brandCount} mục` }
    ];
  }
  if (template.mode === 'news_index') {
    return [
      { label: 'Banner trang tin tức', value: snapshot.newsBanners.length ? `${snapshot.newsBanners.length} banner` : 'Chưa có' },
      { label: 'Danh sách bài viết', value: 'Lấy từ bài tin tức đã xuất bản' }
    ];
  }
  if (template.mode === 'contact') {
    return [
      { label: 'Banner trang liên hệ', value: snapshot.contactBanners.length ? `${snapshot.contactBanners.length} banner` : 'Chưa có' },
      { label: 'Hotline', value: hotline || 'Chưa có' },
      { label: 'Email', value: email || 'Chưa có' },
      { label: 'Địa chỉ', value: address || 'Chưa có' },
      { label: 'Bản đồ', value: hasMap ? 'Đã có' : 'Chưa có' }
    ];
  }
  return [{ label: 'Nguồn nội dung', value: 'Bản ghi này' }];
}

export function ContactOperationsCard() {
  return (
    <Card className="overflow-hidden">
      <div className="admin-card-header">
        <h2 className="text-sm font-semibold text-text">Nguồn dữ liệu liên hệ</h2>
      </div>
      <div className="grid gap-2 p-4 sm:grid-cols-2">
        <Link
          href="/website-settings"
          className="rounded-sm border border-border bg-panel px-3 py-3 text-sm font-semibold text-text hover:border-primary/50 hover:bg-muted"
        >
          Sửa hotline, email, địa chỉ
        </Link>
        <Link
          href="/contacts"
          className="rounded-sm border border-border bg-panel px-3 py-3 text-sm font-semibold text-text hover:border-primary/50 hover:bg-muted"
        >
          Xem yêu cầu khách gửi
        </Link>
      </div>
    </Card>
  );
}

export function ArticlePlanCard() {
  return (
    <Card className="overflow-hidden">
      <div className="admin-card-header">
        <h2 className="text-sm font-semibold text-text">Bố cục bài viết</h2>
      </div>
      <div className="grid gap-2 p-4 text-sm">
        {['Mở bài rõ nhu cầu', 'Nội dung kỹ thuật chính', 'Link đến danh mục hoặc sản phẩm'].map((item) => (
          <div key={item} className="rounded-sm border border-border bg-muted px-3 py-2 font-medium text-slate-700">
            {item}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function TemplateBlocksCard({ template }: { template: PageContentTemplate }) {
  const templateBlocks = getTemplateBlocks(template).filter((block) => block.owner === 'template');
  if (templateBlocks.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <details>
        <summary className="admin-card-header flex cursor-pointer list-none items-center justify-between gap-3 hover:bg-muted/80">
          <span className="text-sm font-semibold text-text">Thành phần cố định</span>
          <span className="text-xs font-medium text-muted-foreground">{templateBlocks.length} nhóm</span>
        </summary>
        <div className="divide-y divide-border border-t border-border">
          {templateBlocks.map((block) => (
            <TemplateBlockPanel key={block.id} block={block} />
          ))}
        </div>
      </details>
    </Card>
  );
}

function TemplateBlockPanel({ block }: { block: PageTemplateBlock }) {
  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-text">{block.title}</h3>
          {block.description ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{block.description}</p>
          ) : null}
        </div>
        <Badge tone="info">{block.ownerLabel}</Badge>
      </div>
      {block.items?.length ? (
        <div className="mt-4 grid gap-2">
          {block.items.map((item, index) => (
            <div key={`${block.id}-${item.title}`} className="rounded-sm border border-border bg-muted px-3 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-panel text-xs font-bold text-primary">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <p className="text-sm font-semibold text-text">{item.title}</p>
              </div>
              {item.description ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
