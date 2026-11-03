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
    <article className="group flex min-h-20 items-center gap-4 border-t border-borderBlue py-3">
      <PartnerLogo className="h-14 w-24 bg-white sm:h-16 sm:w-28" partner={partner} sizes="112px" />
      <h3 className="min-w-0 flex-1 font-display text-base font-semibold leading-snug text-secondary transition-colors duration-200 group-hover:text-primary">
        {partner.name}
      </h3>
      {website ? <span aria-hidden="true" className="shrink-0 text-lg text-primary">↗</span> : null}
    </article>
  );

  return website ? (
    <a aria-label={`Mở website đối tác ${partner.name} trong tab mới`} className={`block ${focusRing}`} href={website} rel="noopener noreferrer" target="_blank">{content}</a>
  ) : <div>{content}</div>;
}

export function HomePartnerShowcase({ partners, className = '' }: { partners: PublicPartner[]; className?: string }) {
  if (partners.length === 0) return null;
  const visible = partners.slice(0, 2);

  return (
    <section aria-label="Đối tác của Song Thanh" className={`min-w-0 bg-subtle px-5 py-5 sm:px-6 sm:py-6 lg:px-7 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Cùng Song Thanh</p>
          <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-secondary sm:text-3xl">Đối tác</h2>
        </div>
        <Link className={`inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-semibold text-primary transition-colors duration-200 hover:text-primaryStrong hover:underline ${focusRing}`} href={directoryHref}>
          Xem tất cả <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <ul className="mt-5" data-partner-home-count={visible.length}>
        {visible.map((partner) => <li key={partner.id}><HomePartnerItem partner={partner} /></li>)}
      </ul>
      {partners.length > visible.length ? <p className="mt-2 text-xs text-body">Và {partners.length - visible.length} đối tác khác</p> : null}
    </section>
  );
}

function AboutPartnerItem({ partner, index, featured }: { partner: PublicPartner; index: number; featured: boolean }) {
  const website = partnerWebsite(partner.website_url);
  const content = featured ? (
    <article className="group grid min-h-36 grid-cols-[minmax(0,1fr)_9rem] items-center gap-6 border-y border-borderBlue py-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
      <div>
        <span aria-hidden="true" className="font-display text-xs font-semibold tabular-nums text-primary">01</span>
        <h3 className="mt-3 font-display text-xl font-semibold leading-snug text-secondary transition-colors duration-200 group-hover:text-primary sm:text-2xl">{partner.name}</h3>
        {website ? <span aria-hidden="true" className="mt-2 inline-block text-sm font-semibold text-primary">Mở website ↗</span> : null}
      </div>
      <PartnerLogo className="h-24 w-full sm:h-28" partner={partner} sizes="192px" />
    </article>
  ) : (
    <article className="group flex min-h-24 items-center gap-4 border-b border-borderBlue py-4 sm:gap-6">
      <span aria-hidden="true" className="w-7 shrink-0 self-start pt-2 font-display text-xs font-semibold tabular-nums text-primary">{String(index + 1).padStart(2, '0')}</span>
      <PartnerLogo className="h-16 w-24 sm:h-20 sm:w-28" partner={partner} sizes="112px" />
      <h3 className="min-w-0 flex-1 font-display text-base font-semibold leading-snug text-secondary transition-colors duration-200 group-hover:text-primary sm:text-lg">{partner.name}</h3>
      {website ? <span aria-hidden="true" className="shrink-0 text-lg text-primary">↗</span> : null}
    </article>
  );

  return website ? (
    <a aria-label={`Mở website đối tác ${partner.name} trong tab mới`} className={`block ${focusRing}`} href={website} rel="noopener noreferrer" target="_blank">{content}</a>
  ) : <div>{content}</div>;
}

export function AboutPartnerShowcase({ partners }: { partners: PublicPartner[] }) {
  if (partners.length === 0) return null;
  const visible = partners.slice(0, 4);

  return (
    <section aria-label="Đối tác của Song Thanh" className="border-t border-borderBlue bg-white py-10 sm:py-14">
      <Container className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-14" size="narrow">
        <div className="flex flex-wrap items-end justify-between gap-3 lg:block">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Mạng lưới hợp tác</p>
            <h2 className="mt-2 font-display text-[clamp(1.75rem,2.5vw,2.4rem)] font-semibold leading-tight text-secondary">Đối tác</h2>
          </div>
          <Link className={`inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline lg:mt-4 ${focusRing}`} href={directoryHref}>
            Xem tất cả <span aria-hidden="true">→</span>
          </Link>
        </div>
        <ol className={`grid ${visible.length > 1 ? 'border-t border-borderBlue' : ''} ${visible.length > 2 ? 'xl:grid-cols-2 xl:gap-x-7' : ''}`} data-partner-about-count={visible.length}>
          {visible.map((partner, index) => <li className="min-w-0" key={partner.id}><AboutPartnerItem featured={visible.length === 1} index={index} partner={partner} /></li>)}
        </ol>
      </Container>
    </section>
  );
}
