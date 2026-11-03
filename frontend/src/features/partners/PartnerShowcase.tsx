import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import type { PublicPartner } from '@/types/contracts/publicPartners';
import { PartnerLogo } from './PartnerLogo';
import { partnerWebsite } from './partnerWebsite';

const directoryHref = '/doi-tac-thuong-hieu#danh-sach-doi-tac';

function HomePartnerItem({ partner }: { partner: PublicPartner }) {
  const website = partnerWebsite(partner.website_url);
  const content = (
    <article className="flex min-h-14 items-center gap-3">
      <PartnerLogo className="h-12 w-24" partner={partner} sizes="96px" />
      <h3 className="max-w-[20ch] font-display text-[15px] font-semibold leading-snug text-secondary transition-colors group-hover:text-primary">
        {partner.name}
      </h3>
      {website ? <span aria-hidden="true" className="text-sm text-primary">↗</span> : null}
    </article>
  );

  return website ? (
    <a aria-label={`Mở website đối tác ${partner.name} trong tab mới`} className="group rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" href={website} rel="noopener noreferrer" target="_blank">{content}</a>
  ) : <div>{content}</div>;
}

export function HomePartnerShowcase({ partners, className = '' }: { partners: PublicPartner[]; className?: string }) {
  if (partners.length === 0) return null;
  const visible = partners.slice(0, 3);

  return (
    <section aria-label="Đối tác của Song Thanh" className={`bg-white py-5 sm:py-6 ${className}`}>
      <Container className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8" size="wide">
        <h2 className="shrink-0 font-display text-lg font-semibold text-secondary">Đối tác</h2>
        <span aria-hidden="true" className="hidden h-12 w-px shrink-0 bg-borderBlue md:block" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-8 gap-y-4" data-partner-home-count={visible.length}>
          {visible.map((partner) => <HomePartnerItem key={partner.id} partner={partner} />)}
        </div>
        <Link className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:self-auto" href={directoryHref}>
          Xem tất cả đối tác <span aria-hidden="true">→</span>
        </Link>
      </Container>
    </section>
  );
}

function AboutPartnerItem({ partner }: { partner: PublicPartner }) {
  const website = partnerWebsite(partner.website_url);
  const content = (
    <article className="flex min-h-20 items-center gap-4 border-b border-borderBlue py-3">
      <PartnerLogo className="h-16 w-28" partner={partner} sizes="112px" />
      <h3 className="min-w-0 flex-1 font-display text-base font-semibold leading-snug text-secondary transition-colors group-hover:text-primary">{partner.name}</h3>
      {website ? <span aria-hidden="true" className="shrink-0 text-lg text-primary">↗</span> : null}
    </article>
  );

  return website ? (
    <a aria-label={`Mở website đối tác ${partner.name} trong tab mới`} className="group block rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href={website} rel="noopener noreferrer" target="_blank">{content}</a>
  ) : <div>{content}</div>;
}

export function AboutPartnerShowcase({ partners }: { partners: PublicPartner[] }) {
  if (partners.length === 0) return null;
  const visible = partners.slice(0, 4);
  const columns = visible.length === 2 || visible.length === 4 ? 'md:grid-cols-2' : '';

  return (
    <section aria-label="Đối tác của Song Thanh" className="border-t border-borderBlue bg-white py-9 sm:py-11">
      <Container size="narrow">
        <div className="mx-auto grid max-w-[1120px] gap-5 lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-10">
          <div className="flex flex-wrap items-center justify-between gap-3 lg:block">
            <h2 className="font-display text-2xl font-semibold text-secondary sm:text-3xl">Đối tác</h2>
            <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-primary lg:mt-3" href={directoryHref}>
              Xem danh bạ <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className={`grid gap-x-6 ${columns}`} data-partner-about-count={visible.length}>
            {visible.map((partner) => <AboutPartnerItem key={partner.id} partner={partner} />)}
          </div>
        </div>
      </Container>
    </section>
  );
}
