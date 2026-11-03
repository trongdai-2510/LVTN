import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import type { PublicPartner } from '@/types/contracts/publicPartners';
import { PartnerLogo } from './PartnerLogo';
import { partnerWebsite } from './partnerWebsite';

const directoryHref = '/doi-tac-thuong-hieu#danh-sach-doi-tac';

function HomePartnerItem({ partner }: { partner: PublicPartner }) {
  const website = partnerWebsite(partner.website_url);
  const content = (
    <article className="flex min-h-28 items-center gap-4 rounded-md border border-borderBlue bg-white px-4 py-4 shadow-soft transition-colors duration-200 group-hover:border-primary/50 sm:gap-5 sm:px-5">
      <PartnerLogo className="h-20 w-28 rounded-sm border border-borderBlue sm:w-32" partner={partner} sizes="128px" />
      <h3 className="min-w-0 flex-1 font-display text-base font-semibold leading-snug text-secondary sm:text-lg">{partner.name}</h3>
      {website ? <span aria-hidden="true" className="shrink-0 text-xl text-primary">↗</span> : null}
    </article>
  );

  return website ? (
    <a className="group block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" href={website} rel="noopener noreferrer" target="_blank" aria-label={`Mở website đối tác ${partner.name} trong tab mới`}>{content}</a>
  ) : <div className="group">{content}</div>;
}

export function HomePartnerShowcase({ partners, className = '' }: { partners: PublicPartner[]; className?: string }) {
  if (partners.length === 0) return null;
  const visible = partners.slice(0, 3);
  const width = visible.length === 1 ? 'max-w-[760px]' : visible.length === 2 ? 'max-w-[960px]' : 'max-w-[1120px]';

  return (
    <section aria-label="Đối tác của Song Thanh" className={`bg-panel py-10 sm:py-12 ${className}`}>
      <Container size="narrow">
        <div className={`mx-auto ${width}`}>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <h2 className="type-section-title text-secondary">Đối tác của Song Thanh</h2>
            <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href={directoryHref}>
              Xem danh sách đối tác <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className={`grid gap-3 ${visible.length === 2 ? 'sm:grid-cols-2' : ''} ${visible.length === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : ''}`} data-partner-home-count={visible.length}>
            {visible.map((partner) => <HomePartnerItem key={partner.id} partner={partner} />)}
          </div>
        </div>
      </Container>
    </section>
  );
}

function AboutPartnerItem({ partner }: { partner: PublicPartner }) {
  const website = partnerWebsite(partner.website_url);
  return (
    <article className="flex min-h-28 items-center gap-5 border-t border-white/25 py-5">
      <PartnerLogo className="h-20 w-32 rounded-sm" partner={partner} sizes="128px" />
      <div className="min-w-0">
        <h3 className="font-display text-lg font-semibold leading-snug text-white">{partner.name}</h3>
        {website ? (
          <a className="mt-2 inline-flex min-h-8 items-center gap-1 text-sm font-medium text-blue-200 underline-offset-4 hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" href={website} rel="noopener noreferrer" target="_blank" aria-label={`Mở website đối tác ${partner.name} trong tab mới`}>
            Website đối tác <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function AboutPartnerShowcase({ partners }: { partners: PublicPartner[] }) {
  if (partners.length === 0) return null;
  const visible = partners.slice(0, 4);
  const twoColumns = visible.length === 2 || visible.length === 4;

  return (
    <section aria-label="Đối tác của Song Thanh" className="bg-secondary py-10 text-white sm:py-12">
      <Container size="narrow">
        <div className={twoColumns ? '' : 'mx-auto max-w-[820px]'}>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <h2 className="type-section-title text-white">Đối tác của Song Thanh</h2>
            {partners.length > visible.length ? (
              <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-200 underline-offset-4 hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" href={directoryHref}>
                Xem tất cả <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </div>
          <div className={`grid gap-x-8 ${twoColumns ? 'md:grid-cols-2' : ''}`} data-partner-about-count={visible.length}>
            {visible.map((partner) => <AboutPartnerItem key={partner.id} partner={partner} />)}
          </div>
        </div>
      </Container>
    </section>
  );
}
