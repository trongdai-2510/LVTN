import { Container } from '@/components/ui/Container';
import type { PublicPartner } from '@/types/contracts/publicPartners';
import { PartnerLogo } from './PartnerLogo';
import { partnerWebsite } from './partnerWebsite';

function PartnerRow({ partner }: { partner: PublicPartner }) {
  const website = partnerWebsite(partner.website_url);
  const content = (
    <article className="flex min-h-28 items-center gap-5 border-b border-borderBlue py-4 sm:gap-7 sm:py-5">
      <PartnerLogo className="h-20 w-32 sm:h-24 sm:w-40" partner={partner} sizes="160px" />
      <h3 className="min-w-0 flex-1 font-display text-lg font-semibold leading-snug text-secondary transition-colors group-hover:text-primary sm:text-xl">{partner.name}</h3>
      {website ? <span aria-hidden="true" className="shrink-0 text-xl text-primary">↗</span> : null}
    </article>
  );

  return website ? (
    <a aria-label={`Mở website đối tác ${partner.name} trong tab mới`} className="group block rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href={website} rel="noopener noreferrer" target="_blank">{content}</a>
  ) : <div>{content}</div>;
}

export function PartnerDirectory({ partners }: { partners: PublicPartner[] }) {
  if (partners.length === 0) return null;
  const single = partners.length === 1;
  const width = single ? 'max-w-[720px]' : 'max-w-[1160px]';

  return (
    <section aria-label="Đối tác của Song Thanh" className="scroll-mt-24 border-t border-borderBlue bg-white py-10 sm:py-14" id="danh-sach-doi-tac">
      <Container size="wide">
        <div className={`mx-auto ${width}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-borderBlue pb-5">
            <h2 className="type-section-title text-secondary">Đối tác của Song Thanh</h2>
            {single ? null : <p className="text-sm text-body">{partners.length} đối tác</p>}
          </div>
          <ul className="flex flex-wrap justify-center gap-x-10" data-partner-directory="true" data-partner-count={partners.length}>
            {partners.map((partner) => <li className={single ? 'w-full' : 'w-full md:w-[calc(50%-20px)]'} key={partner.id}>
              <PartnerRow partner={partner} />
            </li>)}
          </ul>
        </div>
      </Container>
    </section>
  );
}
