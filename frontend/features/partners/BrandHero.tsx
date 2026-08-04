import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/ui/Container";
import { resolvePublicFileSource } from "@/lib/public-file";
import type { PublicBannerListItem } from "@/types/contracts/public-banners";
import type { PublicBrandListItem } from "@/types/contracts/public-brands";

type BrandHeroProps = {
  title: string;
  excerpt: string | null;
  banner: PublicBannerListItem | null;
  brands: PublicBrandListItem[];
};

type BrandMarkProps = {
  brand: PublicBrandListItem;
};

const HERO_BRAND_PRIORITY = [
  "schneider",
  "panasonic",
  "ls",
  "ls-electric",
  "shihlin",
  "cadivi",
  "daphaco",
  "duhal",
];

const FALLBACK_EXCERPT =
  "Song Thanh chọn lọc thương hiệu thiết bị điện công nghiệp phù hợp cho công trình, nhà xưởng và doanh nghiệp.";

const FALLBACK_LABELS = [
  "Thiết bị điện",
  "Chiếu sáng",
  "Tủ bảng điện",
  "Cáp điện",
  "Tự động hóa",
  "Vật tư công trình",
];

function getBrandHref(brand: PublicBrandListItem) {
  return `/doi-tac-thuong-hieu/${brand.slug}`;
}

function getInitials(value: string) {
  return (
    value
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || value.slice(0, 1).toUpperCase()
  );
}

function normalizeBrandKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getHeroBrands(brands: PublicBrandListItem[]) {
  const selected = new Map<string, PublicBrandListItem>();

  for (const key of HERO_BRAND_PRIORITY) {
    const match = brands.find((brand) => {
      const slugKey = normalizeBrandKey(brand.slug);
      const nameKey = normalizeBrandKey(brand.name);
      return slugKey === key || nameKey === key || nameKey.includes(key);
    });

    if (match) selected.set(match.id, match);
  }

  for (const brand of brands) {
    if (selected.size >= 6) break;
    selected.set(brand.id, brand);
  }

  return Array.from(selected.values()).slice(0, 6);
}

function BrandMark({ brand }: BrandMarkProps) {
  const logoSource = resolvePublicFileSource(brand.logo_file);
  const className =
    "group flex min-h-16 min-w-0 items-center gap-3 rounded-[6px] border border-[oklch(0.91_0.015_248)] bg-[oklch(0.995_0.006_248)] px-3 py-2 transition duration-200 hover:border-primary/40 hover:bg-primary/5";
  const content = (
    <>
      <span className="relative grid h-11 w-16 shrink-0 place-items-center rounded-[5px] bg-white p-1.5 ring-1 ring-primary/15">
        {logoSource ? (
          <Image
            alt={brand.name}
            className="object-contain"
            fill
            loading="lazy"
            sizes="64px"
            src={logoSource}
          />
        ) : (
          <span className="text-xs font-black text-primary">{getInitials(brand.name)}</span>
        )}
      </span>
      <span className="min-w-0 truncate text-sm font-black uppercase tracking-[0.06em] text-slate-900 transition group-hover:text-primary">
        {brand.name}
      </span>
    </>
  );

  if (brand.has_detail_page) {
    return (
      <Link href={getBrandHref(brand)} className={className}>
        {content}
      </Link>
    );
  }

  if (brand.website_url) {
    return (
      <a href={brand.website_url} className={className} rel="noreferrer" target="_blank">
        {content}
      </a>
    );
  }

  return <span className={className}>{content}</span>;
}

function FallbackMark({ label }: { label: string }) {
  return (
    <span className="flex min-h-14 min-w-0 items-center gap-3 rounded-[6px] border border-dashed border-[oklch(0.9_0.014_248)] bg-[oklch(0.988_0.008_248)] px-3 py-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-[5px] bg-primary/7 text-xs font-black text-primary">
        {getInitials(label)}
      </span>
      <span className="min-w-0 truncate text-sm font-bold text-slate-700">{label}</span>
    </span>
  );
}

function BrandStage({ brands }: { brands: PublicBrandListItem[] }) {
  const featuredBrands = getHeroBrands(brands);
  const hasBrands = featuredBrands.length > 0;

  return (
    <div className="relative max-w-full overflow-hidden py-4 lg:overflow-visible lg:pl-8 lg:pr-8">
      <div
        aria-hidden="true"
        className="absolute right-4 top-6 hidden h-[78%] w-[78%] rounded-[8px] bg-primary/8 lg:block"
      />
      <div
        aria-hidden="true"
        className="absolute left-2 bottom-8 hidden h-16 w-40 rounded-[8px] bg-[#ffd966]/60 lg:block"
      />

      <div className="relative overflow-hidden rounded-[8px] border border-[oklch(0.9_0.018_248)] bg-[oklch(0.992_0.007_248)] p-5 shadow-[0_24px_60px_rgba(15,35,75,0.13)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[oklch(0.9_0.016_248)] pb-5">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-primary">Thư viện thương hiệu</p>
            <p className="mt-2 max-w-sm text-2xl font-black leading-tight text-slate-950">
              Nhìn nhanh các nhãn hàng Song Thanh đang phân phối.
            </p>
          </div>
          <span className="rounded-[6px] bg-[#fff2bd] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-900">
            {brands.length > 0 ? `${brands.length} thương hiệu` : "Đang cập nhật"}
          </span>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {(hasBrands ? featuredBrands : []).map((brand) => (
            <BrandMark key={brand.id} brand={brand} />
          ))}
          {!hasBrands
            ? FALLBACK_LABELS.map((label) => <FallbackMark key={label} label={label} />)
            : null}
        </div>

        <div className="mt-5 grid gap-2 border-t border-[oklch(0.9_0.016_248)] pt-4 text-sm font-semibold text-slate-600 sm:flex sm:flex-wrap sm:gap-x-5">
          <span>Hồ sơ thương hiệu</span>
          <span>Sản phẩm theo thương hiệu</span>
          <span>Tài liệu công khai</span>
        </div>
      </div>
    </div>
  );
}

function BannerVisual({ banner }: { banner: PublicBannerListItem }) {
  const imageSource = resolvePublicFileSource(banner.image_file);

  if (!imageSource) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-[8px] border border-[oklch(0.94_0.012_248)] bg-[oklch(0.995_0.006_248)] shadow-[0_28px_80px_rgba(15,35,75,0.16)] lg:mr-20">
      <Image
        src={imageSource}
        alt={banner.title || "Thương hiệu Song Thanh"}
        width={760}
        height={520}
        priority
        className="aspect-[4/3] w-full object-cover"
      />
    </div>
  );
}

export function BrandHero({ title, excerpt, banner, brands }: BrandHeroProps) {
  const heroTitle = title.trim() || "Thương hiệu đồng hành";
  const heroExcerpt = excerpt?.trim() || FALLBACK_EXCERPT;
  const bannerImageSource = resolvePublicFileSource(banner?.image_file ?? null);

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(115deg,#f7fbff_0%,#eef7ff_48%,#fbfdff_100%)]">
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-24 bg-[oklch(0.995_0.006_248)] opacity-80" />
      <div aria-hidden="true" className="absolute left-0 top-0 h-1.5 w-full bg-[linear-gradient(90deg,#0059c6_0%,#0059c6_42%,#ffd966_42%,#ffd966_58%,#42a5e8_58%,#42a5e8_100%)]" />

      <Container className="relative py-14 sm:py-16 lg:py-20">
        <nav className="mb-9 flex items-center gap-3 text-sm font-semibold text-slate-600 sm:text-base">
          <Link href="/" className="transition hover:text-primary">
            Trang chủ
          </Link>
          <span className="text-primary">/</span>
          <span className="text-slate-950">Thương hiệu</span>
        </nav>

        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.86fr)_minmax(420px,0.76fr)]">
          <div>
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-primary">
              Thương hiệu sản phẩm
            </p>
            <h1 className="max-w-3xl break-words text-[40px] font-black leading-[1.02] text-slate-950 sm:text-7xl sm:leading-[0.95] lg:text-[5.8rem]">
              {heroTitle}
            </h1>
            <p className="mt-7 max-w-3xl text-lg font-medium leading-7 text-slate-700 sm:text-2xl sm:leading-9">
              {heroExcerpt}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/san-pham"
                className="inline-flex min-h-14 items-center rounded-[6px] bg-primary px-7 text-base font-bold text-[oklch(0.99_0.006_248)] shadow-[0_18px_38px_rgba(0,89,198,0.22)] transition hover:bg-primary/90"
              >
                Xem sản phẩm
              </Link>
              <Link
                href="/lien-he"
                className="inline-flex min-h-14 items-center rounded-[6px] border border-primary/35 bg-[oklch(0.995_0.006_248)] px-7 text-base font-bold text-primary transition hover:border-primary hover:bg-primary/5"
              >
                Liên hệ tư vấn
              </Link>
            </div>
          </div>

          {banner && bannerImageSource ? <BannerVisual banner={banner} /> : <BrandStage brands={brands} />}
        </div>
      </Container>
    </section>
  );
}
