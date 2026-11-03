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
    <span className="group flex min-w-0 items-center gap-3">
      <PartnerLogo className="h-11 w-[76px] bg-white" partner={partner} sizes="76px" />
      <span className="min-w-0 break-words font-display text-sm font-semibold leading-snug text-secondary transition-colors group-hover:text-primary sm:text-base">
        {partner.name}
      </span>
      {website ? <span aria-hidden="true" className="shrink-0 text-primary">↗</span> : null}
    </span>
  );

  return website ? (
    <a aria-label={`Mở website đối tác ${partner.name} trong tab mới`} className={`block ${focusRing}`} href={website} rel="noopener noreferrer" target="_blank">{content}</a>
  ) : <div>{content}</div>;
}

export function HomePartnerShowcase({ partners, className = '' }: { partners: PublicPartner[]; className?: string }) {
  if (partners.length === 0) return null;
  const visible = partners.slice(0, 2);

  return (
    <section aria-label="Đối tác của Song Thanh" className={`min-w-0 border-t border-borderBlue pt-5 lg:py-1 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1">
        <h2 className="font-display text-base font-semibold text-secondary sm:text-lg">Đối tác</h2>
        <Link className={`inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primaryStrong hover:underline ${focusRing}`} href={directoryHref}>
          Xem tất cả <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <ul className="mt-2 grid gap-x-6 gap-y-4 sm:grid-cols-2" data-partner-home-count={visible.length}>
        {visible.map((partner) => <li className="min-w-0" key={partner.id}><HomePartnerItem partner={partner} /></li>)}
      </ul>
      {partners.length > visible.length ? <p className="mt-2 text-xs text-body">Và {partners.length - visible.length} đối tác khác</p> : null}
    </section>
  );
}

function AboutPartnerItem({ partner, featured }: { partner: PublicPartner; featured: boolean }) {
  const website = partnerWebsite(partner.website_url);
  const content = featured ? (
    <article className="group grid min-h-36 grid-cols-[104px_minmax(0,1fr)] items-center gap-5 bg-subtle p-5 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-8 sm:p-7">
      <PartnerLogo className="h-24 w-[104px] sm:h-32 sm:w-[200px]" imageClassName="p-2" partner={partner} sizes="200px" />
      <div className="min-w-0">
        <h3 className="break-words font-display text-xl font-semibold leading-tight text-secondary transition-colors group-hover:text-primary sm:text-3xl">{partner.name}</h3>
        {website ? <span aria-hidden="true" className="mt-3 inline-block text-sm font-semibold text-primary">Truy cập website ↗</span> : null}
      </div>
    </article>
  ) : (
    <article className="group flex h-full min-h-[112px] items-center gap-5 border-b border-borderBlue py-5 sm:gap-6">
      <PartnerLogo className="h-20 w-28 bg-white sm:h-24 sm:w-32" partner={partner} sizes="128px" />
      <div className="min-w-0 flex-1">
        <h3 className="break-words font-display text-lg font-semibold leading-snug text-secondary transition-colors group-hover:text-primary sm:text-xl">{partner.name}</h3>
        {website ? <span aria-hidden="true" className="mt-1 inline-block text-sm font-semibold text-primary">Truy cập website ↗</span> : null}
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
    <section aria-label="Đối tác của Song Thanh" className="border-t border-borderBlue bg-white py-12 sm:py-16">
      <Container className={featured ? 'grid gap-6 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:items-center lg:gap-14' : ''} size="narrow">
        <div className={`flex flex-wrap items-end justify-between gap-x-8 gap-y-3 ${featured ? 'lg:block' : 'border-b border-borderBlue pb-5'}`}>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Mạng lưới hợp tác</p>
            <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-secondary sm:text-4xl">Đối tác đồng hành</h2>
          </div>
          <Link className={`inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline ${featured ? 'lg:mt-4' : ''} ${focusRing}`} href={directoryHref}>
            Xem danh sách <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <ol className={featured ? 'min-w-0' : 'mt-3 grid gap-x-10 sm:grid-cols-2'} data-partner-about-count={visible.length}>
          {visible.map((partner) => <li className="min-w-0" key={partner.id}><AboutPartnerItem featured={featured} partner={partner} /></li>)}
        </ol>
        {partners.length > visible.length ? <Link className={`mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline ${focusRing}`} href={directoryHref}>Xem thêm {partners.length - visible.length} đối tác ↗</Link> : null}
      </Container>
    </section>
  );
}
