import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';

import '@/styles/globals.css';
import '@/styles/partners.css';

import { PublicShell } from '@/components/layout/PublicShell';
import { getPublicSiteShell } from '@/lib/api/public-site-shell';
import {
  getPublicAddress,
  getPublicCompanyName,
  getPublicEmail,
  getPublicHotlines,
  getPublicLogoSource,
  getPublicSocialLinks
} from '@/features/site-shell/site-shell.public';
import { serializeJsonLd } from '@/lib/seo/json-ld';
import type { PublicSiteShellResponse } from '@/types/contracts/public-site-shell';

// Company settings drive the shared header/footer and must reflect admin saves
// on the next page load instead of being frozen in a previously rendered shell.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-be-vietnam-pro',
  weight: ['400', '500', '600', '700']
});

export async function generateMetadata(): Promise<Metadata> {
  const shell = await getPublicSiteShell().catch(() => ({ company_info: null }));
  const companyName = getPublicCompanyName(shell.company_info);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://songthanhelectric.com.vn').replace(/\/$/, '');
  // Keep one stable crawlable URL. The route itself resolves the latest
  // favicon selected in Website Settings and refreshes its short cache.
  const faviconUrl = '/favicon';
  const defaultTitle = `${companyName} — Thiết bị điện & chiếu sáng`;
  const description = `${companyName} — sản phẩm thiết bị điện, chiếu sáng và phụ kiện từ nhiều thương hiệu. Tra cứu thông tin sản phẩm và nhận báo giá nhanh.`;

  return {
    // Không dùng title.template để tránh lặp đuôi với title đầy đủ của trang con.
    title: defaultTitle,
    description,
    metadataBase: new URL(siteUrl),
    icons: {
      icon: [{ url: faviconUrl, type: 'image/png', sizes: '96x96' }],
      shortcut: faviconUrl,
      apple: [{ url: faviconUrl, type: 'image/png', sizes: '96x96' }]
    },
    openGraph: {
      type: 'website',
      locale: 'vi_VN',
      siteName: companyName,
      title: defaultTitle,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: defaultTitle,
      description,
    },
  };
}

const publicApiOrigin = (() => {
  // Only browser-reachable origins belong in HTML. API_BASE_URL may be a
  // private server-only address and must never be disclosed.
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  try {
    return base ? new URL(base).origin : null;
  } catch {
    return null;
  }
})();

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  let shell: PublicSiteShellResponse;
  let shellUnavailable = false;
  try {
    shell = await getPublicSiteShell();
  } catch {
    shellUnavailable = true;
    shell = {
      company_info: null,
      social_links: [],
      header_menu: null,
      footer_quick_menu: null,
      footer_support_menu: null,
      footer_legal_menu: null
    };
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://songthanhelectric.com.vn').replace(/\/$/, '');
  const sameAs = Array.from(new Set(getPublicSocialLinks(shell.social_links).map((link) => link.url)));
  const logoSource = getPublicLogoSource(shell.company_info);
  const logoUrl = logoSource ? new URL(logoSource, siteUrl).toString() : null;
  const companyName = getPublicCompanyName(shell.company_info);
  const hotlines = getPublicHotlines(shell.company_info);
  const email = getPublicEmail(shell.company_info);
  const address = getPublicAddress(shell.company_info);
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: companyName,
    url: siteUrl,
    ...(logoUrl ? { logo: { '@type': 'ImageObject', url: logoUrl } } : {}),
    ...(hotlines.length > 0 ? { telephone: hotlines } : {}),
    ...(email ? { email } : {}),
    ...(address ? { address } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {})
  };

  return (
    <html className={beVietnamPro.variable} lang="vi">
      <head>
        {publicApiOrigin ? (
          <>
            <link href={publicApiOrigin} rel="preconnect" crossOrigin="anonymous" />
            <link href={publicApiOrigin} rel="dns-prefetch" />
          </>
        ) : null}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationJsonLd) }}
        />
      </head>
      <body>
        <PublicShell shell={shell} shellUnavailable={shellUnavailable}>{children}</PublicShell>
      </body>
    </html>
  );
}
