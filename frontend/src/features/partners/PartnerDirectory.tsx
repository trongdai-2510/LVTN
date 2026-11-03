import type { PublicPartner } from '@/types/contracts/publicPartners';
import { Container } from '@/components/ui/Container';
import { PartnerLogo } from './PartnerLogo';
import { partnerWebsite } from './partnerWebsite';

function PartnerCard({ partner, featured }: { partner: PublicPartner; featured: boolean }) {
  const website = partnerWebsite(partner.website_url);
  const content = featured ? (
    <article className="grid overflow-hidden rounded-md border border-borderBlue bg-white transition-colors duration-200 group-hover:border-primary/50 sm:grid-cols-[192px_minmax(0,1fr)]">
      <PartnerLogo className="h-40 w-full border-b border-borderBlue sm:border-b-0 sm:border-r" partner={partner} sizes="192px" />
      <div className="flex min-w-0 flex-col justify-center p-5 sm:p-6">
        <h3 className="font-display text-2xl font-semibold leading-snug text-secondary">{partner.name}</h3>
        {website ? <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">Mở website đối tác <span aria-hidden="true">↗</span></span> : null}
      </div>
    </article>
  ) : (
    <article className="flex h-full overflow-hidden rounded-md border border-borderBlue bg-white transition-colors duration-200 group-hover:border-primary/50 sm:flex-col">
      <PartnerLogo className="h-28 w-28 border-r border-borderBlue sm:h-36 sm:w-full sm:border-b sm:border-r-0" partner={partner} sizes="(min-width: 640px) 360px, 112px" />
      <div className="flex min-h-28 min-w-0 flex-1 flex-col justify-center gap-2 p-4 sm:justify-between sm:gap-3 sm:p-5">
        <h3 className="font-display text-lg font-semibold leading-snug text-secondary">{partner.name}</h3>
        {website ? <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">Mở website <span aria-hidden="true">↗</span></span> : null}
      </div>
    </article>
  );

  return website ? (
    <a className="group block h-full rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" href={website} rel="noopener noreferrer" target="_blank" aria-label={`Mở website đối tác ${partner.name} trong tab mới`}>
      {content}
    </a>
  ) : <div className="group h-full">{content}</div>;
}

export function PartnerDirectory({ partners }: { partners: PublicPartner[] }) {
  if (partners.length === 0) return null;
  const width = partners.length === 1 ? 'max-w-[640px]' : partners.length === 2 ? 'max-w-[960px]' : 'max-w-[1280px]';
  const itemWidth = partners.length === 1
    ? 'w-full'
    : partners.length === 2
      ? 'w-full sm:w-[calc(50%-8px)]'
      : 'w-full max-w-[400px] sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)]';

  return (
    <section aria-label="Đối tác của Song Thanh" className="scroll-mt-24 border-t border-borderBlue bg-panel py-10 sm:py-14" id="danh-sach-doi-tac">
      <Container size="wide">
        <div className={`mx-auto ${width}`}>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <h2 className="type-section-title text-secondary">Đối tác của Song Thanh</h2>
            {partners.length > 1 ? <p className="text-sm text-body">{partners.length} đối tác</p> : null}
          </div>
          <ul className="flex flex-wrap justify-center gap-4" data-partner-directory="true" data-partner-count={partners.length}>
            {partners.map((partner) => (
              <li className={itemWidth} key={partner.id}>
                <PartnerCard featured={partners.length === 1} partner={partner} />
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
