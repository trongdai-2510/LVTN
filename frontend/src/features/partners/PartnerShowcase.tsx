import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import type { PublicPartner } from '@/types/contracts/publicPartners';
import { PartnerLogo } from './PartnerLogo';
import { partnerWebsite } from './partnerWebsite';

const directoryHref = '/doi-tac-thuong-hieu#danh-sach-doi-tac';
const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';

function HomePartnerItem({ partner }: { partner: PublicPartner }) {
  const website = partnerWebsite(partner.website_url);
  const content = (
    <span className={`group flex h-full min-h-32 w-full flex-col items-center justify-center gap-2 rounded-sm border border-borderBlue bg-white p-3 sm:w-52 ${website ? 'transition-colors hover:border-primary' : ''}`}>
      <PartnerLogo className="h-[72px] w-full bg-white" imageClassName="p-1" partner={partner} sizes="208px" />
      <span className={`min-w-0 break-words text-center font-display text-[15px] font-semibold leading-snug text-secondary ${website ? 'transition-colors group-hover:text-primary' : ''}`}>
        {partner.name}
      </span>
    </span>
  );

  return website ? (
    <a aria-label={`Mở website đối tác ${partner.name} trong tab mới`} className={`block ${focusRing}`} href={website} rel="noopener noreferrer" target="_blank">{content}</a>
  ) : <div>{content}</div>;
}

export function HomePartnerShowcase({ partners, className = '' }: { partners: PublicPartner[]; className?: string }) {
  if (partners.length === 0) return null;
  const visible = partners.slice(0, 3);

  return (
    <section aria-label="Đối tác của Song Thanh" className={`min-w-0 ${className}`}>
      <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center sm:gap-8">
        <Link aria-label="Mở trang đối tác" className={`group inline-flex min-h-12 w-fit items-center gap-2 font-display text-2xl font-semibold text-secondary transition-colors hover:text-primary ${focusRing}`} href={directoryHref}>
          <h2>Đối tác</h2>
          <span aria-hidden="true" className="text-base text-primary transition-transform group-hover:translate-x-0.5">↗</span>
        </Link>
        <ul className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-3" data-partner-home-count={visible.length}>
          {visible.map((partner) => <li className={`min-w-0 ${visible.length === 1 ? 'w-48' : 'w-[calc((100%-1.25rem)/2)]'} sm:w-auto`} key={partner.id}><HomePartnerItem partner={partner} /></li>)}
          {partners.length > visible.length ? <li className="w-[calc((100%-1.25rem)/2)] sm:w-auto"><Link aria-label={`Xem thêm ${partners.length - visible.length} đối tác`} className={`flex min-h-32 w-full items-center justify-center rounded-sm border border-borderBlue font-display text-2xl font-semibold text-primary transition-colors hover:border-primary hover:bg-subtle sm:w-52 ${focusRing}`} href={directoryHref}>+{partners.length - visible.length}</Link></li> : null}
        </ul>
      </div>
    </section>
  );
}

function AboutPartnerItem({ partner, featured }: { partner: PublicPartner; featured: boolean }) {
  const website = partnerWebsite(partner.website_url);
  const content = (
    <article className="group flex h-full min-h-28 items-center gap-5 border-b border-borderBlue py-4 sm:gap-7">
      <PartnerLogo className={featured ? 'h-20 w-32 sm:h-24 sm:w-40' : 'h-16 w-24 sm:h-20 sm:w-32'} imageClassName="p-1" partner={partner} sizes={featured ? '160px' : '128px'} />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
        <h3 className={`break-words font-display font-semibold leading-snug text-secondary transition-colors group-hover:text-primary ${featured ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'}`}>{partner.name}</h3>
        {website ? <span aria-hidden="true" className="shrink-0 text-lg text-primary">↗</span> : null}
      </div>
    </article>
  );

  return website ? (
    <a aria-label={`Mở website đối tác ${partner.name} trong tab mới`} className={`block h-full ${focusRing}`} href={website} rel="noopener noreferrer" target="_blank">{content}</a>
  ) : <div className="h-full">{content}</div>;
}

export function AboutPartnerShowcase({ partners }: { partners: PublicPartner[] }) {
  if (partners.length === 0) return null;
  const visible = partners.slice(0, 4);
  const featured = visible.length === 1;

  return (
    <section aria-label="Đối tác của Song Thanh" className="border-t border-borderBlue bg-white py-8 sm:py-10">
      <Container size="narrow">
        <Link aria-label="Mở trang đối tác" className={`group inline-flex min-h-11 items-center gap-3 font-display text-2xl font-semibold text-secondary transition-colors hover:text-primary sm:text-3xl ${focusRing}`} href={directoryHref}>
          <h2>Đối tác</h2>
          <span aria-hidden="true" className="text-lg text-primary transition-transform group-hover:translate-x-0.5">↗</span>
        </Link>
        <ol className={featured ? 'mt-2 max-w-[620px]' : 'mt-2 grid gap-x-10 sm:grid-cols-2'} data-partner-about-count={visible.length}>
          {visible.map((partner) => <li className="min-w-0" key={partner.id}><AboutPartnerItem featured={featured} partner={partner} /></li>)}
        </ol>
      </Container>
    </section>
  );
}
