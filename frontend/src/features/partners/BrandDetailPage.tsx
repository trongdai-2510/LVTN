import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

import { Container } from '@/components/ui/Container';
import { getPublicSafeUrl } from '@/features/site-shell/site-shell.public';
import { BrandDocumentViewer, type BrandViewerDocument } from './BrandDocumentViewer';
import { mergeBrandProducts, selectBrandProducts } from './brandProductSelection';
import { buildProductListingHref } from '@/features/product-categories/product-category-routing';
import { resolvePublicFileSource } from '@/lib/public-file';
import { getSafeBannerLocalTarget } from '@/lib/bannerTarget';
import type { PublicBrandDetailResponse } from '@/types/contracts/public-brands';
import type { PublicProductGroupListItem } from '@/types/contracts/public-product-groups';
import type { PublicFileSummary } from '@/types/contracts/public-site-shell';

type BrandDetailPageProps = {
  brandDetail: PublicBrandDetailResponse;
  brandProducts?: PublicProductGroupListItem[];
};

type PinnedProduct = PublicProductGroupListItem;
type BrandSource = PublicBrandDetailResponse['sources'][number];
type BrandDocument = {
  id: string;
  title: string;
  href: string;
  label: string;
  sourceType: BrandSource['source_type'];
  description?: string | null;
  previewSrc?: string;
  sourceId?: string;
};
type LayoutArchetype = 'international' | 'domestic' | 'minimal';

type BrandTone = {
  accent: string;
  accentStrong: string;
  accentSoft: string;
  border: string;
  surface: string;
  wash: string;
  shadow: string;
};

/* ------------------------------------------------------------------ *
 * Accent → palette: mỗi thương hiệu một màu thật (không còn hash 6 màu)
 * ------------------------------------------------------------------ */

type Rgb = { r: number; g: number; b: number };

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseHex(hex: string | null | undefined): Rgb | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex?.trim() ?? '');
  if (!match) return null;
  const int = Number.parseInt(match[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((value) => clampChannel(value).toString(16).padStart(2, '0')).join('')}`;
}

function rgba(hex: string, alpha: number): string {
  const base = parseHex(hex);
  if (!base) return hex;
  return `rgba(${base.r}, ${base.g}, ${base.b}, ${alpha})`;
}

function buildAccentTone(accentHex: string): BrandTone {
  const accent = toHex(parseHex(accentHex) as Rgb);
  const accentStrong = '#004ab4';
  return {
    accent,
    accentStrong,
    accentSoft: '#eaf2ff',
    border: '#cddbf2',
    surface: '#f8f9ff',
    wash: 'linear-gradient(135deg, #f8fbff 0%, #eaf2ff 100%)',
    shadow: rgba(accentStrong, 0.12)
  };
}

function resolveBrandTone(
  page: PublicBrandDetailResponse['brand_page']
): BrandTone {
  if (parseHex(page.accent_color)) {
    return buildAccentTone(page.accent_color as string);
  }
  return buildAccentTone('#004ab4');
}

/* ------------------------------------------------------------------ *
 * Archetype: bố cục theo bản chất thương hiệu
 * ------------------------------------------------------------------ */

function resolveArchetype(brandDetail: PublicBrandDetailResponse): LayoutArchetype {
  const explicit = brandDetail.brand_page.layout_archetype;
  if (explicit === 'international' || explicit === 'domestic' || explicit === 'minimal') {
    return explicit;
  }

  const productSignals =
    brandDetail.pinned_products.length + brandDetail.derived_categories.length;
  const trustSignals = brandDetail.sources.length + brandDetail.verified_stats.length;
  const hasHeroImage = Boolean(resolvePublicImageSource(brandDetail.hero_banner?.image_file));

  // Quốc tế: nhiều tín hiệu uy tín (chứng nhận/nguồn/số liệu) + có hero ảnh + website hãng.
  if (trustSignals >= 3 && (hasHeroImage || brandDetail.brand.website_url)) {
    return 'international';
  }
  // Nội địa: đẩy mạnh sản phẩm và bộ lọc theo nhóm.
  if (productSignals >= 4) {
    return 'domestic';
  }
  return 'minimal';
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function hasText(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

function normalizeSupportText(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd')
    .replace(/\s+/g, ' ');
}

const DEFAULT_SUPPORT_STEP_TITLES = ['gui yeu cau', 'nhan tu van', 'nhan bao gia'];

function shouldHideDefaultSupportCopy(
  items: PublicBrandDetailResponse['brand_page']['support_items'],
  hasSupportImage: boolean
) {
  if (hasSupportImage || items.length !== DEFAULT_SUPPORT_STEP_TITLES.length) return false;

  return items.every((item, index) => normalizeSupportText(item.title) === DEFAULT_SUPPORT_STEP_TITLES[index]);
}

function resolvePublicImageSource(file: PublicFileSummary | null | undefined) {
  if (!file?.mime_type?.startsWith('image/')) return null;
  return resolvePublicFileSource(file);
}

function safeHeroColor(value: string | null | undefined, fallback: string) {
  const color = parseHex(value);
  if (!color) return fallback;
  const channels = [color.r, color.g, color.b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return 1.05 / (luminance + 0.05) >= 4.5 ? toHex(color) : fallback;
}

function splitBrandTitle(title: string): { main: string; tagline: string | null } {
  // Tách "BRAND | tagline" (hoặc – —) → dấu "|" ở font lớn nhìn như chữ "I", thô.
  const parts = title.split(/\s*[|｜–—]\s*/).map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return { main: title.trim(), tagline: null };
  return { main: parts[0], tagline: parts.slice(1).join(' · ') };
}

function getInitials(value: string) {
  const words = value.split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((word) => word[0]).join('').toUpperCase() || value.slice(0, 1).toUpperCase();
}

function heroTitleClass(size: PublicBrandDetailResponse['brand_page']['hero_title_size']) {
  if (size === 'medium') {
    return 'text-[30px] leading-[36px] sm:text-[50px] sm:leading-[56px] lg:text-[58px] lg:leading-[64px]';
  }
  if (size === 'xlarge') {
    return 'text-[34px] leading-[40px] sm:text-[66px] sm:leading-[70px] lg:text-[84px] lg:leading-[88px]';
  }
  return 'text-[32px] leading-[38px] sm:text-[58px] sm:leading-[64px] lg:text-[72px] lg:leading-[78px]';
}

function heroExcerptClass(size: PublicBrandDetailResponse['brand_page']['hero_excerpt_size']) {
  return size === 'medium'
    ? 'mt-5 max-w-2xl text-[15px] leading-6 sm:text-[16px] sm:leading-7'
    : 'mt-5 max-w-2xl text-[16px] leading-7 sm:text-[20px] sm:leading-9';
}

function sourceTypeLabel(type: BrandSource['source_type']) {
  if (type === 'website') return 'Website hãng';
  if (type === 'catalogue') return 'Catalogue';
  if (type === 'certificate') return 'Chứng nhận';
  return 'Nguồn tham khảo';
}

function sourceActionLabel(source: BrandSource) {
  return source.source_type === 'catalogue' ? 'Mở catalogue' : 'Mở tài liệu';
}

function sourceHref(source: BrandSource) {
  return resolvePublicFileSource(source.file);
}

function internalBrandActionHref(value: string | null | undefined) {
  const href = value?.trim();
  if (href && /^\/(?!\/)[^\\\x00-\x1f]*$/.test(href)) return href;
  if (href && /^#[a-zA-Z][\w-]*$/.test(href)) return href;
  return '/lien-he';
}

function isPdfFile(file: PublicFileSummary | null | undefined) {
  if (!file) return false;
  return file.mime_type === 'application/pdf' || file.original_filename.toLowerCase().endsWith('.pdf');
}

function sourceDocument(source: BrandSource): BrandDocument | null {
  if (!isPdfFile(source.file)) return null;
  const href = resolvePublicFileSource(source.file);
  if (!href) return null;
  return {
    id: `source-${source.id}`,
    sourceId: source.id,
    title: source.title,
    href,
    label: 'PDF',
    sourceType: source.source_type,
    description: source.description
  };
}

function buildBrandDocuments(brandDetail: PublicBrandDetailResponse) {
  // Tài liệu thương hiệu = các nguồn (sources) có đính kèm file PDF, do admin upload.
  return brandDetail.sources
    .map((source) => sourceDocument(source))
    .filter((document): document is BrandDocument => Boolean(document));
}

function countLabel(value: number, singular: string, plural = singular) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function productCategoryPath(product: PinnedProduct): string | null {
  const parts = [product.category_level_1_name, product.category_level_2_name]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (parts.length === 0) {
    return product.category_name?.trim() || null;
  }
  return parts.join(' · ');
}

function productLead(product: PinnedProduct): string | null {
  const detailed = product.detailed_description?.trim();
  const short = product.short_description?.trim();
  return short || detailed || null;
}

/* ------------------------------------------------------------------ *
 * Shared atoms
 * ------------------------------------------------------------------ */

function BrandLogoMark({
  brand,
  tone,
  className = 'h-16 w-16',
  imageClassName = 'p-3'
}: {
  brand: PublicBrandDetailResponse['brand'];
  tone: BrandTone;
  className?: string;
  imageClassName?: string;
}) {
  const logoSource = resolvePublicImageSource(brand.logo_file);

  return (
    <span
      className={`${className} relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-sm border bg-white shadow-soft`}
      style={{ borderColor: tone.border }}
    >
      {logoSource ? (
        <span className={`relative block h-full w-full ${imageClassName}`}>
          <Image alt={`${brand.name} logo`} className="object-contain" fill sizes="180px" src={logoSource} />
        </span>
      ) : (
        <span className="font-display text-[22px] font-extrabold" style={{ color: tone.accentStrong }}>
          {getInitials(brand.name)}
        </span>
      )}
    </span>
  );
}

function Breadcrumb({ brand }: { brand: PublicBrandDetailResponse['brand'] }) {
  return (
    <nav className="type-body-sm flex flex-wrap items-center gap-2 text-body">
      <Link className="transition hover:text-primary" href="/">Trang chủ</Link>
      <span aria-hidden>/</span>
      <Link className="transition hover:text-primary" href="/doi-tac-thuong-hieu">Thương hiệu</Link>
      <span aria-hidden>/</span>
      <span className="font-semibold text-secondary">{brand.name}</span>
    </nav>
  );
}

function StatStrip({ brandDetail, tone }: BrandDetailPageProps & { tone: BrandTone }) {
  const stats = brandDetail.verified_stats.slice(0, 4);
  if (stats.length === 0) return null;

  return (
    <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div className="rounded-sm border bg-white px-3 py-3 sm:px-4 sm:py-4" key={stat.id} style={{ borderColor: tone.border }}>
          <dd className="font-display text-[26px] font-extrabold leading-none text-secondary [font-variant-numeric:tabular-nums]">
            {stat.value}
          </dd>
          <dt className="type-caption mt-2 font-semibold text-body">{stat.label}</dt>
          {hasText(stat.note) ? <p className="type-caption mt-1 text-body">{stat.note}</p> : null}
        </div>
      ))}
    </dl>
  );
}

function SourceIcon({ type, tone }: { type: BrandSource['source_type']; tone: BrandTone }) {
  return (
    <span
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xs"
      style={{ backgroundColor: tone.accentSoft, color: tone.accentStrong }}
    >
      <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
        {type === 'website' ? (
          <>
            <path d="M4.75 12a7.25 7.25 0 1 0 14.5 0a7.25 7.25 0 0 0-14.5 0Z" stroke="currentColor" strokeWidth="1.7" />
            <path d="M5.25 12h13.5M12 4.75c1.6 1.75 2.4 4.17 2.4 7.25s-.8 5.5-2.4 7.25c-1.6-1.75-2.4-4.17-2.4-7.25s.8-5.5 2.4-7.25Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
          </>
        ) : type === 'certificate' ? (
          <path d="M8 4.75h8a1.5 1.5 0 0 1 1.5 1.5v11.5a1.5 1.5 0 0 1-1.5 1.5H8a1.5 1.5 0 0 1-1.5-1.5V6.25A1.5 1.5 0 0 1 8 4.75Zm2.25 4h3.5M10.25 12h3.5M10.25 15.25h2.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
        ) : (
          <path d="M7.25 4.75h9.5v14.5h-9.5V4.75Zm3 3.5h3.5M10.25 12h3.5M10.25 15.25h2.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
        )}
      </svg>
    </span>
  );
}

function SourceCard({
  source,
  tone,
  showDescription = true
}: {
  source: BrandSource;
  tone: BrandTone;
  showDescription?: boolean;
}) {
  const href = sourceHref(source);
  return (
    <article className="group rounded-sm border bg-white px-5 py-5 transition duration-200 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0" style={{ borderColor: tone.border, boxShadow: `0 1px 0 ${tone.border}` }}>
      <div className="flex items-start justify-between gap-4">
        <SourceIcon type={source.source_type} tone={tone} />
        <span className="type-caption font-semibold text-body">{sourceTypeLabel(source.source_type)}</span>
      </div>
      <h3 className="type-card-title mt-4 text-secondary">{source.title}</h3>
      {showDescription && hasText(source.description) ? <p className="type-body-sm mt-2 text-body">{source.description}</p> : null}
      {href ? (
        <a className="type-button mt-4 inline-flex min-h-8 items-center transition motion-reduce:transition-none" href={href} rel="noreferrer" style={{ color: tone.accentStrong }} target="_blank">
          {sourceActionLabel(source)}
          <span aria-hidden className="ml-1">↗</span>
        </a>
      ) : null}
    </article>
  );
}

function WideSourceCard({
  source,
  tone,
  showDescription = true
}: {
  source: BrandSource;
  tone: BrandTone;
  showDescription?: boolean;
}) {
  const href = sourceHref(source);
  return (
    <article className="flex flex-col gap-5 rounded-md border bg-white p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-7" style={{ borderColor: tone.border, boxShadow: `0 1px 0 ${tone.border}` }}>
      <SourceIcon type={source.source_type} tone={tone} />
      <div className="min-w-0 flex-1">
        <span className="type-caption font-semibold text-body">{sourceTypeLabel(source.source_type)}</span>
        <h3 className="type-card-title mt-1 text-secondary">{source.title}</h3>
        {showDescription && hasText(source.description) ? <p className="type-body-sm mt-2 max-w-[68ch] text-body">{source.description}</p> : null}
      </div>
      {href ? (
        <a className="type-button inline-flex min-h-11 shrink-0 items-center rounded-xs px-5 text-white transition hover:opacity-90 motion-reduce:transition-none" href={href} rel="noreferrer" target="_blank" style={{ backgroundColor: tone.accentStrong }}>
          {sourceActionLabel(source)}<span aria-hidden className="ml-1">↗</span>
        </a>
      ) : null}
    </article>
  );
}

// Tài liệu thương hiệu (catalogue/bảng giá PDF) nay hiển thị qua <BrandDocumentViewer/>
// (thẻ chọn + khung xem PDF nhúng), dữ liệu lấy từ brand sources do admin upload.

function ProductSpecChips({ product, tone }: { product: PinnedProduct; tone: BrandTone }) {
  const specs = (product.highlight_specs ?? []).slice(0, 3);
  if (specs.length === 0) return null;
  return (
    <dl className="mt-4 flex flex-wrap gap-2">
      {specs.map((spec) => (
        <div className="rounded-xs border bg-white px-2.5 py-1.5 type-caption" key={spec.id} style={{ borderColor: tone.border }}>
          <dt className="inline text-body">{spec.display_label}: </dt>
          <dd className="inline font-semibold" style={{ color: tone.accentStrong }}>{spec.display_value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ProductMedia({
  product,
  tone,
  priority = false,
  variant = 'card'
}: {
  product: PinnedProduct;
  tone: BrandTone;
  priority?: boolean;
  variant?: 'card' | 'featured';
}) {
  const imageSource = resolvePublicImageSource(product.thumbnail_file);
  const mediaClassName =
    variant === 'featured'
      ? 'relative flex min-h-[260px] items-center justify-center overflow-hidden rounded-sm transition duration-300 ease-out motion-reduce:transition-none sm:min-h-[300px] lg:h-full lg:min-h-[300px] lg:max-h-[340px]'
      : 'relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-sm transition duration-300 ease-out motion-reduce:transition-none';
  const imageClassName =
    variant === 'featured'
      ? 'object-contain object-center p-5 transition duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none sm:p-6'
      : 'object-contain p-3 scale-[1.12] transition duration-500 ease-out group-hover:scale-[1.16] motion-reduce:transition-none';

  if (!imageSource) {
    return (
      <div className={mediaClassName} style={{ background: tone.wash }}>
        <BrandLogoMark brand={{ name: product.name } as PublicBrandDetailResponse['brand']} tone={tone} className="h-16 w-16" imageClassName="p-2" />
      </div>
    );
  }
  return (
    <div className={mediaClassName} style={{ backgroundColor: tone.surface }}>
      <Image
        alt={product.name}
        className={imageClassName}
        fill
        priority={priority}
        sizes={variant === 'featured' ? '(max-width: 1024px) 100vw, 40vw' : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'}
        src={imageSource}
      />
    </div>
  );
}

function FeaturedProductCard({ product, brand, tone }: { product: PinnedProduct; brand: PublicBrandDetailResponse['brand']; tone: BrandTone }) {
  const lead = productLead(product);
  const path = productCategoryPath(product) || brand.name;
  return (
    <article className="group grid overflow-hidden rounded-md border bg-white transition duration-300 ease-out hover:-translate-y-0.5 lg:grid-cols-[minmax(280px,0.72fr)_minmax(0,1fr)] motion-reduce:transition-none motion-reduce:hover:translate-y-0" style={{ borderColor: tone.border, boxShadow: `0 18px 44px ${tone.shadow}` }}>
      <Link className="block min-w-0 bg-[#f8fafc] p-4 sm:p-5 lg:p-6" href={`/san-pham/${encodeURIComponent(product.slug)}`}>
        <ProductMedia product={product} tone={tone} priority variant="featured" />
      </Link>
      <div className="flex min-w-0 flex-col justify-center px-5 py-6 sm:px-7 lg:px-8 lg:py-8">
        <p className="type-eyebrow" style={{ color: tone.accentStrong }}>{path}</p>
        <Link href={`/san-pham/${encodeURIComponent(product.slug)}`}>
          <h3 className="type-card-title-lg mt-3 text-secondary transition group-hover:text-primary">{product.name}</h3>
        </Link>
        {lead ? <p className="mt-4 max-w-[64ch] line-clamp-3 type-body-sm text-body">{lead}</p> : null}
        <ProductSpecChips product={product} tone={tone} />
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {product.variant_count > 1 || product.document_count > 0 ? (
            <div className="flex flex-wrap gap-2 type-body-sm text-body">
              {product.variant_count > 1 ? <span>{countLabel(product.variant_count, 'phiên bản')}</span> : null}
              {product.document_count > 0 ? <span>{countLabel(product.document_count, 'tài liệu')}</span> : null}
            </div>
          ) : null}
          <Link className="type-button inline-flex min-h-11 shrink-0 items-center justify-center rounded-xs px-5 text-white transition hover:opacity-90 motion-reduce:transition-none" href={`/san-pham/${encodeURIComponent(product.slug)}`} style={{ backgroundColor: tone.accentStrong }}>
            Xem chi tiết
            <span aria-hidden className="ml-1 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none">→</span>
          </Link>
        </div>
      </div>
    </article>
  );
}

function CompactProductCard({ product, brand, tone }: { product: PinnedProduct; brand: PublicBrandDetailResponse['brand']; tone: BrandTone }) {
  const path = productCategoryPath(product) || brand.name;
  return (
    <article className="group flex h-full flex-col rounded-sm border bg-white p-3 transition duration-300 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-4" style={{ borderColor: tone.border }}>
      <Link className="block" href={`/san-pham/${encodeURIComponent(product.slug)}`}>
        <ProductMedia product={product} tone={tone} />
      </Link>
      <div className="flex flex-1 flex-col pt-3 sm:pt-5">
        <p className="type-caption line-clamp-1 font-semibold" style={{ color: tone.accentStrong }}>{path}</p>
        <Link href={`/san-pham/${encodeURIComponent(product.slug)}`}>
          <h4 className="type-card-title mt-1.5 line-clamp-2 text-secondary transition group-hover:text-primary sm:mt-2">{product.name}</h4>
        </Link>
        <div className="hidden sm:block">
          <ProductSpecChips product={product} tone={tone} />
        </div>
        <Link className="type-button mt-auto inline-flex min-h-10 items-center pt-3 sm:pt-5" href={`/san-pham/${encodeURIComponent(product.slug)}`} style={{ color: tone.accentStrong }}>
          Xem chi tiết
          <span aria-hidden className="ml-1 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none">→</span>
        </Link>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ *
 * Hero (theo archetype)
 * ------------------------------------------------------------------ */

function HeroCategoryChips({ brandDetail }: BrandDetailPageProps) {
  const { brand } = brandDetail;
  const categories = [...brandDetail.derived_categories]
    .sort((left, right) => right.product_count - left.product_count)
    .slice(0, 6);
  if (categories.length === 0) return null;

  return (
    <div className="mt-8">
      <p className="type-caption font-semibold text-body">Lọc thêm theo nhóm</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {categories.map((category) => (
          <Link
            className="inline-flex items-center gap-1.5 rounded-xs border border-borderBlue bg-white px-3 py-1.5 type-body-sm text-secondary transition hover:bg-primarySoft motion-reduce:transition-none"
            href={buildProductListingHref({ brands: brand.slug, categorySlugs: [category.slug] })}
            key={category.id}
          >
            {category.name}
            <span className="text-body [font-variant-numeric:tabular-nums]">{category.product_count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function BrandHeroProductPreview({
  brandName,
  products,
  tone
}: {
  brandName: string;
  products: PinnedProduct[];
  tone: BrandTone;
}) {
  if (products.length === 0) return null;

  return (
    <aside className="hidden rounded-[10px] border bg-white p-5 lg:block lg:p-7" data-brand-hero-preview="true" style={{ borderColor: tone.border }}>
      <p className="type-eyebrow text-primary">Xem nhanh sản phẩm</p>
      <h2 className="mt-2 font-display text-[22px] font-extrabold leading-7 text-secondary">
        Thiết bị {brandName} đang công khai
      </h2>
      <div className="mt-5 divide-y divide-borderBlue border-y border-borderBlue">
        {products.map((product) => {
          const imageSource = resolvePublicImageSource(product.thumbnail_file);
          return (
            <Link className="group grid min-h-[94px] grid-cols-[68px_minmax(0,1fr)_auto] items-center gap-3 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href={`/san-pham/${product.slug}`} key={product.id}>
              <span className="relative block aspect-square overflow-hidden rounded-sm bg-primarySoft/50">
                {imageSource ? <Image alt="" className="object-contain p-1.5" fill sizes="68px" src={imageSource} /> : null}
              </span>
              <span className="min-w-0 font-display text-[14px] font-bold leading-5 text-secondary transition-colors group-hover:text-primaryStrong">
                {product.name}
              </span>
              <span aria-hidden="true" className="text-primary">→</span>
            </Link>
          );
        })}
      </div>
      <Link className="mt-4 inline-flex min-h-11 items-center gap-2 text-[14px] font-bold text-primaryStrong hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="#san-pham">
        Xem toàn bộ nhóm sản phẩm <span aria-hidden="true">↓</span>
      </Link>
    </aside>
  );
}

type BrandBannerButton = NonNullable<NonNullable<PublicBrandDetailResponse['hero_banner']>['cta_buttons']>[number];

function getBrandBannerHref(value: string | null | undefined) {
  const href = value?.trim() ?? '';
  const localTarget = getSafeBannerLocalTarget(href);
  if (localTarget) return localTarget;
  return getPublicSafeUrl(href);
}

function BrandBannerLink({ children, className, href, label, style }: { children: ReactNode; className: string; href: string; label: string; style?: CSSProperties }) {
  if (/^https?:\/\//.test(href)) {
    return <a aria-label={label} className={className} href={href} rel="noopener noreferrer" style={style} target="_blank">{children}</a>;
  }
  return <Link aria-label={label} className={className} href={href} style={style}>{children}</Link>;
}

function BrandBannerAction({ action }: { action: BrandBannerButton }) {
  const href = getBrandBannerHref(action.url);
  if (!href) return null;
  const isOutline = action.style === 'outline';
  const isGhost = action.style === 'ghost';
  const color = action.color || '#004ab4';
  return (
    <BrandBannerLink
      className="type-button-lg inline-flex min-h-12 items-center justify-center rounded-md border-2 px-6 font-semibold transition hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      href={href}
      label={action.text.trim()}
      style={{ color: isOutline || isGhost ? color : action.text_color || '#ffffff', backgroundColor: isOutline || isGhost ? 'transparent' : color, borderColor: isOutline ? color : 'transparent' }}
    >
      {action.text.trim()}
    </BrandBannerLink>
  );
}

function BrandHero({ brandDetail, brandProducts = [], tone, archetype }: BrandDetailPageProps & { tone: BrandTone; archetype: LayoutArchetype }) {
  const { brand, brand_page: page, hero_banner: heroBanner } = brandDetail;
  const heroImageSource = resolvePublicImageSource(heroBanner?.image_file);
  const mobileHeroImageSource = resolvePublicImageSource(heroBanner?.image_mobile_file) ?? heroImageSource;
  const eyebrowColor = safeHeroColor(page.hero_eyebrow_color, '#004ab4');
  const titleColor = safeHeroColor(page.hero_title_color, '#0b1c30');
  const excerptColor = safeHeroColor(page.hero_excerpt_color, '#334155');
  const hasProducts = brandDetail.derived_categories.length > 0 || brandDetail.pinned_products.length > 0 || brandProducts.length > 0;
  const showPrimaryAction = hasProducts || !hasText(page.cta_button_label);
  const primaryHref = hasProducts ? buildProductListingHref({ brands: brand.slug }) : '/lien-he';
  const primaryLabel = hasProducts ? 'Xem sản phẩm của hãng' : 'Liên hệ tư vấn';
  const summary = page.excerpt?.trim() || brand.description?.trim() || heroBanner?.description?.trim() || null;
  const bannerActions = (heroBanner?.cta_buttons ?? []).filter((button) => button.text.trim() && getBrandBannerHref(button.url));
  const bannerImageHref = heroBanner?.link_type !== 'none' ? getBrandBannerHref(heroBanner?.link_target) : null;

  // Banner full-bleed (image_only) — giữ nguyên hành vi admin đã chốt.
  if (heroImageSource && heroBanner?.display_mode === 'image_only') {
    return (
      <>
        <section className="border-b bg-white" style={{ borderColor: tone.border }}>
          <Container className="py-4" size="wide"><Breadcrumb brand={brand} /></Container>
        </section>
        <section className="bg-white">
          <h1 className="sr-only">{page.title}</h1>
          {bannerImageHref && bannerActions.length === 0 ? (
            <BrandBannerLink className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" href={bannerImageHref} label={`Mở banner ${heroBanner.title?.trim() || page.title}`}>
              <picture>
                {mobileHeroImageSource ? <source media="(max-width: 767px)" srcSet={mobileHeroImageSource} /> : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={heroBanner.title?.trim() || page.title} className="block h-auto w-full" decoding="async" src={heroImageSource} />
              </picture>
            </BrandBannerLink>
          ) : (
            <picture>
              {mobileHeroImageSource ? <source media="(max-width: 767px)" srcSet={mobileHeroImageSource} /> : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={heroBanner.title?.trim() || page.title} className="block h-auto w-full" decoding="async" src={heroImageSource} />
            </picture>
          )}
          {bannerActions.length > 0 ? (
            <Container className="flex flex-wrap gap-3 py-4" size="wide">
              {bannerActions.map((action, index) => <BrandBannerAction action={action} key={`${action.url}:${index}`} />)}
            </Container>
          ) : null}
        </section>
      </>
    );
  }

  const supportImageSource = resolvePublicImageSource(page.support_image_file);
  const hasHeroVisual = Boolean(heroImageSource || supportImageSource);
  // Chỉ hiện card visual khi có ảnh thật; không có ảnh → hồ sơ chữ gọn một cột.
  const showVisual = archetype !== 'minimal' && hasHeroVisual;
  const previewProducts = showVisual || page.layout_archetype === 'minimal'
    ? []
    : mergeBrandProducts(brandDetail.pinned_products, brandProducts).slice(0, 3);
  const showPreview = previewProducts.length > 0;

  return (
    <section className="relative isolate overflow-hidden border-b border-borderBlue bg-subtle/55 text-secondary">
      <Container className="relative py-6 sm:py-8 lg:py-8" size="wide">
        <Breadcrumb brand={brand} />
        <div className={`grid gap-10 py-6 sm:py-8 ${showVisual || showPreview ? 'lg:grid-cols-[minmax(0,0.96fr)_minmax(360px,0.7fr)] lg:items-center lg:py-12' : 'lg:py-8'}`}>
          <div>
            <div className="brand-rise flex flex-wrap items-center gap-4">
              <BrandLogoMark brand={brand} tone={tone} />
              <div>
                <p className="type-eyebrow flex items-center gap-2" style={{ color: eyebrowColor }}>
                  <span aria-hidden className="inline-block h-px w-7" style={{ backgroundColor: eyebrowColor }} />
                  Thương hiệu
                </p>
                <p className="mt-1 type-body-sm text-body">Sản phẩm {brand.name} tại Song Thanh</p>
              </div>
            </div>

            <h1 className={`brand-rise ${heroTitleClass(page.hero_title_size)} mt-6 max-w-4xl font-display font-extrabold tracking-[-0.02em] [text-wrap:balance]`} style={{ color: titleColor, animationDelay: '80ms' }}>
              {(() => {
                const { main, tagline } = splitBrandTitle(page.title);
                return tagline ? (
                  <>
                    <span className="block">{main}</span>
                    <span className="mt-2 block font-semibold opacity-85" style={{ fontSize: '0.52em', lineHeight: 1.2 }}>{tagline}</span>
                  </>
                ) : main;
              })()}
            </h1>
            {summary ? <p className={`brand-rise ${heroExcerptClass(page.hero_excerpt_size)}`} style={{ color: excerptColor, animationDelay: '140ms' }}>{summary}</p> : null}

            <div className="brand-rise mt-6 flex flex-wrap gap-3" style={{ animationDelay: '200ms' }}>
              {bannerActions.length > 0 ? bannerActions.map((action, index) => <BrandBannerAction action={action} key={`${action.url}:${index}`} />) : null}
              {bannerActions.length === 0 && bannerImageHref ? <BrandBannerLink className="type-button-lg inline-flex min-h-12 items-center rounded-xs bg-primary px-6 text-white transition hover:bg-primaryStrong" href={bannerImageHref} label="Xem nội dung banner">Khám phá thêm</BrandBannerLink> : null}
              {bannerActions.length === 0 && showPrimaryAction ? <Link className="type-button-lg inline-flex min-h-12 items-center rounded-xs bg-primary px-6 text-white transition duration-200 ease-out hover:bg-primaryStrong motion-reduce:transition-none" href={primaryHref}>
                {primaryLabel}
              </Link> : null}
            </div>

            <div className="brand-rise" style={{ animationDelay: '260ms' }}>
              <StatStrip brandDetail={brandDetail} tone={tone} />
              {!showVisual ? <HeroCategoryChips brandDetail={brandDetail} /> : null}
            </div>
          </div>

          {showVisual ? <HeroVisual brandDetail={brandDetail} brandProducts={brandProducts} tone={tone} archetype={archetype} /> : null}
          {showPreview ? <BrandHeroProductPreview brandName={brand.name} products={previewProducts} tone={tone} /> : null}
        </div>
      </Container>
    </section>
  );
}

function HeroVisual({ brandDetail, brandProducts = [], tone, archetype }: BrandDetailPageProps & { tone: BrandTone; archetype: LayoutArchetype }) {
  const { brand, brand_page: page, hero_banner: heroBanner } = brandDetail;
  const heroImageSource = resolvePublicImageSource(heroBanner?.image_file);
  const supportImageSource = resolvePublicImageSource(page.support_image_file);
  const visualSource = heroImageSource || supportImageSource;
  const visualAlt = heroBanner?.title?.trim() || page.support_title?.trim() || `${brand.name} tại Song Thanh`;
  const visualHref = heroImageSource && heroBanner?.link_type !== 'none' && !(heroBanner?.cta_buttons?.length)
    ? getBrandBannerHref(heroBanner?.link_target)
    : null;
  const firstCategory = [...brandDetail.derived_categories].sort((left, right) => right.product_count - left.product_count)[0];
  const heroProducts = mergeBrandProducts(brandDetail.pinned_products, brandProducts);
  const firstProduct = heroProducts[0];
  // Quốc tế: ảnh lớn hơn (đề cao hình ảnh hãng); nội địa: tỉ lệ gọn để nhường sản phẩm.
  const aspect = archetype === 'international' ? 'aspect-[5/4]' : 'aspect-[4/3]';

  return (
    <div className="brand-rise relative lg:pl-6" style={{ animationDelay: '200ms' }}>
      <div aria-hidden className="absolute -right-4 top-6 hidden h-[78%] w-[70%] rounded-md lg:block" style={{ backgroundColor: tone.accentSoft }} />
      <div className="relative overflow-hidden rounded-md border bg-white p-3 shadow-soft" style={{ borderColor: tone.border }}>
        {visualSource ? (
          visualHref ? (
            <BrandBannerLink className={`relative block ${aspect} overflow-hidden rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary`} href={visualHref} label={`Mở banner ${visualAlt}`} style={{ backgroundColor: tone.surface }}>
              <Image alt={visualAlt} className="object-cover" fill priority={Boolean(heroImageSource)} sizes="(max-width: 1024px) 100vw, 42vw" src={visualSource} />
            </BrandBannerLink>
          ) : (
            <div className={`relative ${aspect} overflow-hidden rounded-sm`} style={{ backgroundColor: tone.surface }}>
              <Image alt={visualAlt} className="object-cover" fill priority={Boolean(heroImageSource)} sizes="(max-width: 1024px) 100vw, 42vw" src={visualSource} />
            </div>
          )
        ) : (
          <div className={`flex ${aspect} flex-col items-center justify-center rounded-sm px-8 text-center`} style={{ background: tone.wash }}>
            <BrandLogoMark brand={brand} tone={tone} className="h-28 w-28" imageClassName="p-5" />
            <p className="mt-6 type-card-title-lg text-secondary">{brand.name}</p>
            <p className="mt-2 type-body-sm text-body">Song Thanh đang cập nhật hình ảnh và thông tin cho thương hiệu này.</p>
          </div>
        )}
        {heroProducts.length > 0 || firstCategory ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {heroProducts.length > 0 ? (
              <div className="rounded-xs px-3 py-3" style={{ backgroundColor: tone.accentSoft }}>
                <p className="type-card-title text-secondary [font-variant-numeric:tabular-nums]">{heroProducts.length}</p>
                <p className="type-caption mt-1 font-semibold text-body">sản phẩm hiển thị</p>
              </div>
            ) : null}
            {firstProduct || firstCategory ? (
              <div className="rounded-xs px-3 py-3" style={{ backgroundColor: tone.accentSoft }}>
                <p className="type-card-title line-clamp-2 text-secondary">{firstProduct?.name || firstCategory?.name}</p>
                <p className="type-caption mt-1 font-semibold text-body">{firstProduct ? 'sản phẩm nổi bật' : 'nhóm lọc nhanh'}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Section nav (sticky)
 * ------------------------------------------------------------------ */

function BrandSectionNav({ anchors, brandName, tone }: { anchors: Array<{ href: string; label: string }>; brandName: string; tone: BrandTone }) {
  if (anchors.length === 0) return null;
  return (
    <section className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/88" style={{ borderColor: tone.border }}>
      <Container className="flex items-center gap-2 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" size="wide">
        <span className="type-caption shrink-0 font-semibold text-body">{brandName}</span>
        <span className="h-4 w-px shrink-0" style={{ backgroundColor: tone.border }} />
        {anchors.map((anchor) => (
          <a className="type-button shrink-0 rounded-xs px-3 py-2 transition hover:bg-primarySoft motion-reduce:transition-none" href={anchor.href} key={anchor.href} style={{ color: tone.accentStrong }}>
            {anchor.label}
          </a>
        ))}
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Sections
 * ------------------------------------------------------------------ */

function CategoryFilterLink({ category, brandSlug, tone }: { category: PublicBrandDetailResponse['derived_categories'][number]; brandSlug: string; tone: BrandTone }) {
  return (
    <Link
      className="inline-flex min-h-10 items-center gap-2 rounded-xs border bg-white px-3 type-caption font-semibold text-secondary transition hover:-translate-y-0.5 hover:text-primary motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      href={buildProductListingHref({ brands: brandSlug, categorySlugs: [category.slug] })}
      style={{ borderColor: tone.border }}
    >
      <span>{category.name}</span>
      <span className="rounded-[999px] px-2 py-0.5 [font-variant-numeric:tabular-nums]" style={{ backgroundColor: tone.accentSoft, color: tone.accentStrong }}>{category.product_count}</span>
    </Link>
  );
}

function ProductSelectionSection({ brandDetail, brandProducts = [], tone }: BrandDetailPageProps & { tone: BrandTone }) {
  const { brand } = brandDetail;
  const categories = [...brandDetail.derived_categories].sort((left, right) => right.product_count - left.product_count).slice(0, 8);
  const { featuredProduct, otherProducts } = selectBrandProducts(brandDetail.pinned_products, brandProducts);
  if (categories.length === 0 && !featuredProduct && otherProducts.length === 0) return null;

  return (
    <section className="bg-white py-12 lg:py-16" id="san-pham">
      <Container size="wide">
        <div className="flex flex-col gap-4 border-b pb-7 sm:flex-row sm:items-end sm:justify-between" style={{ borderColor: tone.border }}>
          <div>
            <p className="type-eyebrow" style={{ color: tone.accentStrong }}>Sản phẩm</p>
            <h2 className="type-section-title mt-3 text-secondary [text-wrap:balance]">Sản phẩm {brand.name} tại Song Thanh</h2>
            <p className="type-body mt-3 max-w-[56ch] text-body">Khám phá thiết bị {brand.name} đang có tại Song Thanh.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link className="type-button inline-flex min-h-11 items-center rounded-xs px-5 text-white transition hover:opacity-90 motion-reduce:transition-none" href={buildProductListingHref({ brands: brand.slug })} style={{ backgroundColor: tone.accentStrong }}>Xem tất cả</Link>
          </div>
        </div>

        {categories.length > 0 ? (
          <div className="mt-7 border-b pb-7" style={{ borderColor: tone.border }}>
            <h3 className="font-display text-[18px] font-bold text-secondary">Tìm theo nhóm thiết bị</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {categories.map((category) => (
                <CategoryFilterLink key={category.id} category={category} brandSlug={brand.slug} tone={tone} />
              ))}
            </div>
          </div>
        ) : null}

        {featuredProduct || otherProducts.length > 0 ? (
          <>
            {featuredProduct ? (
              <div className="mt-8">
                <h3 className="mb-4 font-display text-[18px] font-bold text-secondary">Sản phẩm nổi bật</h3>
                <FeaturedProductCard brand={brand} product={featuredProduct} tone={tone} />
              </div>
            ) : null}
            {otherProducts.length > 0 ? (
              <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                {otherProducts.map((product) => (
                  <CompactProductCard brand={brand} key={product.id} product={product} tone={tone} />
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-8 rounded-sm border border-dashed bg-white px-5 py-7" style={{ borderColor: tone.border }}>
            <p className="type-card-title text-secondary">Danh sách sản phẩm {brand.name} đang được cập nhật</p>
            <p className="type-body-sm mt-2 max-w-[62ch] text-body">
              Có thể tra cứu theo thương hiệu để xem sản phẩm công khai mới nhất hoặc gửi yêu cầu để Song Thanh hỗ trợ đúng model cần tìm.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link className="type-button inline-flex min-h-10 items-center rounded-xs px-4 text-white transition hover:opacity-90 motion-reduce:transition-none" href={buildProductListingHref({ brands: brand.slug })} style={{ backgroundColor: tone.accentStrong }}>
                Tra cứu sản phẩm
              </Link>
              <Link className="type-button inline-flex min-h-10 items-center rounded-xs border px-4 text-secondary transition hover:bg-primarySoft motion-reduce:transition-none" href="/lien-he" style={{ borderColor: tone.border }}>
                Gửi yêu cầu
              </Link>
            </div>
          </div>
        )}

      </Container>
    </section>
  );
}

function StorySection({ brandDetail, tone }: BrandDetailPageProps & { tone: BrandTone }) {
  const { brand, brand_page: page } = brandDetail;
  const supportImageSource = resolvePublicImageSource(page.support_image_file);
  const rawItems = page.support_items.filter((item) => hasText(item.title) || hasText(item.description));
  const hideDefaultSupportCopy = shouldHideDefaultSupportCopy(rawItems, Boolean(supportImageSource));
  const items = hideDefaultSupportCopy ? [] : rawItems;
  const supportIntro = hideDefaultSupportCopy ? null : page.support_intro;
  const supportTitle = hideDefaultSupportCopy ? null : page.support_title;
  const hasStory = hasText(page.overview_body);
  const hasSupport = hasText(supportIntro) || items.length > 0 || Boolean(supportImageSource);
  if (!hasStory && !hasSupport) return null;

  return (
    <section className="py-14 lg:py-20" id="ho-so" style={{ background: tone.wash }}>
      <Container size="wide">
        {hasStory ? (
          <div className="mx-auto max-w-3xl text-center">
            <p className="type-eyebrow" style={{ color: tone.accentStrong }}>Hồ sơ thương hiệu</p>
            <h2 className="type-section-title mt-4 text-secondary [text-wrap:balance]">{page.overview_title?.trim() || `Giới thiệu ${brand.name}`}</h2>
            <p className="mt-6 whitespace-pre-line text-left text-[17px] leading-8 text-body [text-wrap:pretty] sm:text-center">{page.overview_body}</p>
          </div>
        ) : null}

        {supportImageSource ? (
          <div className={`relative mx-auto aspect-[21/9] w-full max-w-5xl overflow-hidden rounded-md border bg-white shadow-soft ${hasStory ? 'mt-12' : ''}`} style={{ borderColor: tone.border }}>
            <Image alt={supportTitle?.trim() || `${brand.name} tại Song Thanh`} className="object-cover" fill loading="lazy" sizes="(max-width: 1024px) 100vw, 1024px" src={supportImageSource} />
          </div>
        ) : null}

        {hasText(supportIntro) || items.length > 0 ? (
          <div className={hasStory || supportImageSource ? 'mt-12 lg:mt-16' : ''}>
            <div className="mx-auto max-w-2xl text-center">
              <p className="type-eyebrow" style={{ color: tone.accentStrong }}>Song Thanh hỗ trợ</p>
              <h2 className="type-section-title mt-3 text-secondary [text-wrap:balance]">{supportTitle?.trim() || `Cần tư vấn sản phẩm ${brand.name}?`}</h2>
              {hasText(supportIntro) ? <p className="type-body mt-4 text-body">{supportIntro}</p> : null}
            </div>
            {items.length > 0 ? (
              <ol className="mt-9 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
                {items.map((item, index) => (
                  <li className="rounded-sm border bg-white p-4 sm:p-6" style={{ borderColor: tone.border, boxShadow: `0 1px 0 ${tone.border}` }} key={`${item.title}-${index}`}>
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xs font-display text-[15px] font-bold [font-variant-numeric:tabular-nums]" style={{ backgroundColor: tone.accentSoft, color: tone.accentStrong }}>{String(index + 1).padStart(2, '0')}</span>
                    {hasText(item.title) ? <h3 className="type-card-title mt-4 text-secondary">{item.title}</h3> : null}
                    {hasText(item.description) ? <p className="type-body-sm mt-2 text-body">{item.description}</p> : null}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : null}
      </Container>
    </section>
  );
}

function ResourcesSection({ brandDetail, tone }: BrandDetailPageProps & { tone: BrandTone }) {
  const { brand, sources, verified_stats: stats } = brandDetail;
  const documents = buildBrandDocuments(brandDetail);
  const documentSourceIds = new Set(documents.map((document) => document.sourceId).filter((id): id is string => Boolean(id)));
  const sortedSources = [...sources].sort((left, right) => {
    const leftHasFile = left.file ? 0 : 1;
    const rightHasFile = right.file ? 0 : 1;
    return leftHasFile - rightHasFile || left.sort_order - right.sort_order;
  });
  // URL nguồn vẫn ở admin để truy xuất, chỉ tệp đã tải lên mới thành liên kết công khai.
  const referenceSources = sortedSources.filter((source) => Boolean(sourceHref(source)) && !documentSourceIds.has(source.id));
  if (documents.length === 0 && referenceSources.length === 0 && stats.length === 0) return null;

  return (
    <section className="bg-white py-14 lg:py-20" id="xac-minh">
      <Container size="wide">
        <p className="type-eyebrow" style={{ color: tone.accentStrong }}>Thông tin thương hiệu</p>
        <h2 className="type-section-title mt-3 text-secondary">Về {brand.name}</h2>

        {stats.length > 0 ? (
          <dl className="mt-8 grid gap-4 sm:grid-cols-2">
            {stats.map((stat) => (
              <div className="rounded-sm border bg-white p-5" key={stat.id} style={{ borderColor: tone.border, boxShadow: `0 1px 0 ${tone.border}` }}>
                <dd className="font-display text-[26px] font-extrabold text-secondary [font-variant-numeric:tabular-nums]">{stat.value}</dd>
                <dt className="type-caption mt-2 font-semibold text-body">{stat.label}</dt>
                {hasText(stat.note) ? <p className="type-body-sm mt-2 text-body">{stat.note}</p> : null}
              </div>
            ))}
          </dl>
        ) : null}

        {documents.length > 0 ? (
          <BrandDocumentViewer
            brandName={brand.name}
            documents={documents.map<BrandViewerDocument>((document) => ({
              id: document.id,
              title: document.title,
              href: document.href,
              typeLabel: sourceTypeLabel(document.sourceType),
              description: document.description
            }))}
            tone={{
              accent: tone.accent,
              accentStrong: tone.accentStrong,
              accentSoft: tone.accentSoft,
              border: tone.border,
              surface: tone.surface
            }}
          />
        ) : null}

        {referenceSources.length > 0 ? (
          <div className={documents.length > 0 || stats.length > 0 ? 'mt-10' : 'mt-8'}>
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="type-eyebrow" style={{ color: tone.accentStrong }}>Tài liệu tại Song Thanh</p>
                <h3 className="type-card-title-lg mt-2 text-secondary">Tài liệu bổ sung</h3>
              </div>
              <p className="type-body-sm text-body">{countLabel(referenceSources.length, 'tài liệu')}</p>
            </div>
            {referenceSources.length === 1 ? (
              <WideSourceCard showDescription={documents.length === 0} source={referenceSources[0]} tone={tone} />
            ) : (
              <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${referenceSources.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
                {referenceSources.map((source) => (
                  <SourceCard key={source.id} showDescription={documents.length === 0} source={source} tone={tone} />
                ))}
              </div>
            )}
          </div>
        ) : null}
      </Container>
    </section>
  );
}

function CtaSection({ brandDetail, tone }: BrandDetailPageProps & { tone: BrandTone }) {
  const { brand, brand_page: page } = brandDetail;
  const hasCta = hasText(page.cta_title) || hasText(page.cta_description) || hasText(page.cta_button_label);
  if (!hasCta) return null;

  return (
    <section className="bg-white py-14 lg:py-20" id="tu-van">
      <Container size="wide">
        <div className="relative overflow-hidden rounded-md border bg-primarySoft/55 px-7 py-10 text-secondary sm:px-10 lg:px-14 lg:py-14" style={{ borderColor: tone.border }}>
          <div className="relative max-w-2xl">
            <p className="type-eyebrow text-primary">{brand.name}</p>
            {hasText(page.cta_title) ? <h2 className="type-section-title mt-3 text-secondary [text-wrap:balance]">{page.cta_title}</h2> : null}
            {hasText(page.cta_description) ? <p className="type-body mt-4 text-body">{page.cta_description}</p> : null}
            <div className="mt-8 flex flex-wrap gap-3">
              {hasText(page.cta_button_label) ? (
                <Link className="type-button-lg inline-flex min-h-12 items-center justify-center rounded-xs bg-primary px-6 text-white transition duration-200 ease-out hover:bg-primaryStrong motion-reduce:transition-none" href={internalBrandActionHref(page.cta_button_url)}>
                  {page.cta_button_label}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Page — sắp xếp section theo archetype
 * ------------------------------------------------------------------ */

export function BrandDetailPage({ brandDetail, brandProducts = [] }: BrandDetailPageProps) {
  const tone = resolveBrandTone(brandDetail.brand_page);
  const archetype = resolveArchetype(brandDetail);
  const documents = buildBrandDocuments(brandDetail);

  const hasProducts = brandDetail.derived_categories.length > 0 || brandDetail.pinned_products.length > 0 || brandProducts.length > 0;
  const hasStory =
    hasText(brandDetail.brand_page.overview_body) ||
    hasText(brandDetail.brand_page.support_intro) ||
    brandDetail.brand_page.support_items.length > 0 ||
    Boolean(resolvePublicImageSource(brandDetail.brand_page.support_image_file));
  const hasResources = brandDetail.verified_stats.length > 0 || brandDetail.sources.some((source) => Boolean(sourceHref(source)));
  const hasCta =
    hasText(brandDetail.brand_page.cta_title) ||
    hasText(brandDetail.brand_page.cta_description) ||
    hasText(brandDetail.brand_page.cta_button_label);

  const products = hasProducts ? <ProductSelectionSection brandDetail={brandDetail} brandProducts={brandProducts} tone={tone} /> : null;
  const story = hasStory ? <StorySection brandDetail={brandDetail} tone={tone} /> : null;
  const resources = hasResources ? <ResourcesSection brandDetail={brandDetail} tone={tone} /> : null;
  const cta = hasCta ? <CtaSection brandDetail={brandDetail} tone={tone} /> : null;

  // Thứ tự section khác nhau theo archetype → mỗi brand có nhịp đọc riêng.
  const ordered =
    archetype === 'international'
      ? [story, resources, products, cta]
      : archetype === 'minimal'
        ? [story, products, resources, cta]
        : [products, story, resources, cta];

  const anchors = [
    hasProducts ? { href: '#san-pham', label: 'Sản phẩm' } : null,
    hasStory ? { href: '#ho-so', label: 'Hồ sơ' } : null,
    hasResources ? { href: '#xac-minh', label: documents.length > 0 ? 'Tài liệu' : 'Xác minh' } : null,
    hasCta ? { href: '#tu-van', label: 'Tư vấn' } : null
  ].filter(Boolean) as Array<{ href: string; label: string }>;

  return (
    <div className="bg-white">
      <BrandHero brandDetail={brandDetail} brandProducts={brandProducts} tone={tone} archetype={archetype} />
      <BrandSectionNav anchors={anchors} brandName={brandDetail.brand.name} tone={tone} />
      {ordered.map((section, index) => (section ? <div key={index}>{section}</div> : null))}
    </div>
  );
}
