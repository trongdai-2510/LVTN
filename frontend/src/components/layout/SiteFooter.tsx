import Link from 'next/link';

import { Container } from '@/components/ui/Container';
import { SocialBrandIcon } from '@/components/ui/SocialBrandIcons';
import { filterVisibleMenuItems, resolvePublicMenuHref, resolvePublicMenuLinkTarget } from '@/features/site-shell/site-shell.mapper';
import { getDirectFooterLinks, getFooterGroups, getFooterLinks } from '@/features/site-shell/footerGroups';
import {
  getPublicCompanyLegalName,
  getPublicCompanyName,
  getPublicAddress,
  getPublicEmail,
  getPublicHotlines,
  getPublicLogoSource,
  getPublicSocialLinks
} from '@/features/site-shell/site-shell.public';
import { formatWorkingHours } from '@/lib/format/text';
import type { PublicMenuItemNode, PublicSiteShellResponse } from '@/types/contracts/public-site-shell';

import { SiteBrandLogo } from './SiteBrandLogo';

type SiteFooterProps = {
  shell: PublicSiteShellResponse;
  variant?: 'default' | 'simple' | 'dark';
  unavailable?: boolean;
};

type PublicFooterSocialLink = ReturnType<typeof getPublicSocialLinks>[number];

function FooterSocialLink({
  isDark,
  item
}: {
  isDark: boolean;
  item: PublicFooterSocialLink;
}) {
  const linkLabel = item.platform_label;
  const accessibleLabel = item.label || linkLabel;

  return (
    <a
      aria-label={accessibleLabel}
      className={[
        'inline-flex h-11 w-11 items-center justify-center gap-2.5 rounded-lg px-0 text-sm font-semibold transition hover:text-primary sm:w-auto sm:justify-start sm:px-3.5',
        isDark ? 'text-blue-100 hover:bg-slate-800' : 'text-primary hover:bg-blue-50'
      ].join(' ')}
      href={item.url}
      rel="noreferrer"
      target="_blank"
      title={accessibleLabel}
    >
      <SocialBrandIcon className="h-7 w-7" platform={item.platform} />
      <span className="hidden truncate sm:inline">{linkLabel}</span>
    </a>
  );
}

function getMenuItems(menu: PublicSiteShellResponse['footer_quick_menu']): PublicMenuItemNode[] {
  return filterVisibleMenuItems(menu?.items ?? []);
}

export function SiteFooter({ shell, variant = 'default', unavailable = false }: SiteFooterProps) {
  if (unavailable) {
    return (
      <footer className="border-t border-borderSoft bg-footer py-8 text-secondary">
        <Container size="narrow">
          <p role="status">Thông tin liên hệ tạm thời chưa tải được. Vui lòng thử lại sau.</p>
        </Container>
      </footer>
    );
  }

  const companyInfo = shell.company_info;
  const isDark = variant === 'dark';
  const isSimple = variant === 'simple';
  const quickLinksFromMenu = getMenuItems(shell.footer_quick_menu);
  const quickLinks = getDirectFooterLinks(shell.footer_quick_menu);
  const supportLinksFromMenu = getMenuItems(shell.footer_support_menu);
  const supportLinks = getDirectFooterLinks(shell.footer_support_menu);
  const footerGroups = [...getFooterGroups(quickLinksFromMenu), ...getFooterGroups(supportLinksFromMenu)];
  const legalLinks = getFooterLinks(getMenuItems(shell.footer_legal_menu));
  const workingHours = companyInfo
    ? formatWorkingHours(
        companyInfo.working_hours_from,
        companyInfo.working_hours_to,
        companyInfo.working_days
      )
    : null;
  const companyName = getPublicCompanyName(companyInfo);
  const companyLegalName = getPublicCompanyLegalName(companyInfo);
  const logoSource = getPublicLogoSource(companyInfo);
  const publicEmail = getPublicEmail(companyInfo) || 'Đang cập nhật';
  const publicAddress = getPublicAddress(companyInfo) || 'Đang cập nhật';
  const hotlines = getPublicHotlines(companyInfo);
  const emailHref = publicEmail !== 'Đang cập nhật' ? `mailto:${publicEmail}` : null;
  const publicWorkingHours = workingHours || 'Đang cập nhật';
  const publicSocialLinks = getPublicSocialLinks(shell.social_links);
  const currentYear = new Date().getFullYear();

  const footerClassName = isDark
    ? 'bg-slate-950 text-white'
    : 'bg-footer text-secondary';
  const mutedTextClassName = isDark ? 'text-slate-300' : 'text-body';
  const headingClassName = isDark ? 'text-white' : 'text-secondary';
  const dividerClassName = isDark ? 'border-slate-800' : 'border-slate-300';

  return (
    <footer
      className={[footerClassName, isSimple ? 'py-8 lg:py-10' : 'py-10 lg:py-12'].join(' ')}
      data-nosnippet
    >
      <Container className="space-y-8 lg:space-y-10" size="narrow">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-[268px_1fr_1.05fr_1.2fr] lg:gap-10">
          <div className="col-span-2 space-y-3 self-start sm:col-span-1 lg:col-span-1">
            <SiteBrandLogo
              ariaLabel={`${companyLegalName} - Trang chủ`}
              className="flex h-20 w-full max-w-[280px] items-center"
              companyName={companyName}
              imageClassName="block h-full w-auto max-w-full object-contain object-left"
              logoSource={logoSource}
            />
            <div className={['type-footer-body grid gap-0', isDark ? 'text-blue-100' : 'text-primary'].join(' ')}>
              <p className="font-medium">{companyLegalName}</p>
            </div>
            {publicSocialLinks.length > 0 ? (
              <div aria-label="Kênh liên hệ" className="flex flex-wrap gap-2">
                {publicSocialLinks.map((item) => (
                  <FooterSocialLink isDark={isDark} item={item} key={item.id} />
                ))}
              </div>
            ) : null}
          </div>

          {quickLinks.length > 0 ? <div>
            <h3 className={['type-footer-heading uppercase', headingClassName].join(' ')}>
              Liên kết nhanh
            </h3>
            <div className={['type-footer-body mt-4 grid gap-0', mutedTextClassName].join(' ')}>
              {quickLinks.map((item) => (
                <Link
                  className="inline-flex min-h-11 items-center transition hover:text-primary"
                  href={resolvePublicMenuHref(item)}
                  {...resolvePublicMenuLinkTarget(item)}
                  key={item.id}
                >
                  {item.title}
                </Link>
              ))}
            </div>
          </div> : null}

          {supportLinks.length > 0 ? <div>
            <h3 className={['type-footer-heading uppercase', headingClassName].join(' ')}>
              Hỗ trợ khách hàng
            </h3>
            <div className={['type-footer-body mt-4 grid gap-0', mutedTextClassName].join(' ')}>
              {supportLinks.length > 0 ? (
                supportLinks.map((item) => (
                  <Link
                    className="inline-flex min-h-11 items-center transition hover:text-primary"
                    href={resolvePublicMenuHref(item)}
                    {...resolvePublicMenuLinkTarget(item)}
                    key={item.id}
                  >
                    {item.title}
                  </Link>
                ))
              ) : null}
            </div>
          </div> : null}

          <div className="col-span-2 sm:col-span-1 lg:col-span-1">
            <h3 className={['type-footer-heading uppercase', headingClassName].join(' ')}>
              Văn phòng
            </h3>
            <div className={['type-footer-body mt-4 space-y-3', mutedTextClassName].join(' ')}>
              <p>
                <span
                  className={[
                    'type-caption block font-bold uppercase',
                    isDark ? 'text-blue-100' : 'text-primary'
                  ].join(' ')}
                >
                  Địa chỉ
                </span>
                {publicAddress}
              </p>
              <div>
                <span
                  className={[
                    'type-caption block font-bold uppercase',
                    isDark ? 'text-blue-100' : 'text-primary'
                  ].join(' ')}
                >
                  Hotline
                </span>
                {hotlines.length > 0 ? (
                  <div className="grid gap-0">
                    {hotlines.map((hotline) => (
                      <a
                        className="inline-flex min-h-11 w-fit items-center transition hover:text-primary hover:underline"
                        href={`tel:${hotline.replace(/[^+\d]/g, '')}`}
                        key={hotline}
                      >
                        {hotline}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p>Đang cập nhật</p>
                )}
              </div>
              <p>
                <span
                  className={[
                    'type-caption block font-bold uppercase',
                    isDark ? 'text-blue-100' : 'text-primary'
                  ].join(' ')}
                >
                  Email
                </span>
                {emailHref ? (
                  <a className="inline-flex min-h-11 items-center break-all transition hover:text-primary hover:underline" href={emailHref}>
                    {publicEmail}
                  </a>
                ) : publicEmail}
              </p>
              <p>
                <span
                  className={[
                    'type-caption block font-bold uppercase',
                    isDark ? 'text-blue-100' : 'text-primary'
                  ].join(' ')}
                >
                  Giờ làm việc
                </span>
                {publicWorkingHours}
              </p>
            </div>
          </div>
          {footerGroups.length > 0 ? (
            <div className={['col-span-2 grid grid-cols-1 gap-6 border-t pt-6 sm:col-span-2 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-[repeat(auto-fit,minmax(180px,1fr))] lg:gap-10', dividerClassName].join(' ')}>
              {footerGroups.map((group) => (
                <div key={group.id}>
                  <h3 className={['type-footer-heading uppercase', headingClassName].join(' ')}>{group.title}</h3>
                  <div className={['type-footer-body mt-4 grid gap-0', mutedTextClassName].join(' ')}>
                    {group.items.map((item) => (
                      <Link
                        className="inline-flex min-h-11 items-center transition hover:text-primary"
                        href={resolvePublicMenuHref(item)}
                        {...resolvePublicMenuLinkTarget(item)}
                        key={item.id}
                      >
                        {item.title}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div
          className={[
            'type-footer-small flex flex-col gap-3 border-t pt-6 md:flex-row md:items-center md:justify-between',
            dividerClassName,
            isDark ? 'text-slate-400' : 'text-body'
          ].join(' ')}
        >
          <p>© {currentYear} {companyLegalName}. Bảo lưu mọi quyền.</p>
          {legalLinks.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              {legalLinks.map((item) => (
                <Link className="inline-flex min-h-11 items-center transition hover:text-primary" href={resolvePublicMenuHref(item)} {...resolvePublicMenuLinkTarget(item)} key={item.id}>
                  {item.title}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </Container>
    </footer>
  );
}
