import { Container } from '@/components/ui/Container';
import type { PublicPartner } from '@/types/contracts/publicPartners';
import { PartnerLogo } from './PartnerLogo';
import { partnerWebsite } from './partnerWebsite';

function PartnerTile({ partner }: { partner: PublicPartner }) {
  const website = partnerWebsite(partner.website_url);
  const content = (
    <article className="group flex h-full min-h-48 flex-col border border-borderBlue bg-white p-5 transition-[border-color,box-shadow] duration-200 group-hover:border-primary/40 group-hover:shadow-[0_12px_28px_-20px_rgba(0,74,180,0.4)] sm:p-6">
      <PartnerLogo className="h-20 w-full max-w-44 sm:h-24" partner={partner} sizes="176px" />
      <div className="mt-auto flex min-w-0 items-end justify-between gap-3 pt-5">
        <h3 className="min-w-0 font-display text-base font-semibold leading-snug text-secondary transition-colors duration-200 group-hover:text-primary sm:text-lg">{partner.name}</h3>
        {website ? <span aria-hidden="true" className="shrink-0 text-lg text-primary">↗</span> : null}
      </div>
    </article>
  );

  return website ? (
    <a aria-label={`Mở website đối tác ${partner.name} trong tab mới`} className="block h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" href={website} rel="noopener noreferrer" target="_blank">{content}</a>
  ) : <div className="h-full">{content}</div>;
}

export function PartnerDirectory({ partners }: { partners: PublicPartner[] }) {
  if (partners.length === 0) return null;
  const width = partners.length === 1 ? 'max-w-[400px]' : partners.length === 2 ? 'max-w-[820px]' : '';
  const columns = partners.length === 1 ? '' : partners.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

  return (
    <section aria-label="Đối tác của Song Thanh" className="scroll-mt-24 border-t border-borderBlue bg-white py-10 sm:py-14" id="danh-sach-doi-tac">
      <Container size="wide">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Danh bạ</p>
            <h2 className="mt-2 font-display text-[clamp(1.9rem,2.6vw,2.5rem)] font-semibold leading-tight text-secondary">Đối tác của Song Thanh</h2>
          </div>
          {partners.length > 1 ? <p className="text-sm text-body">{partners.length} đối tác</p> : null}
        </div>
        <ul className={`grid gap-4 sm:gap-5 ${width} ${columns}`} data-partner-directory="true" data-partner-count={partners.length}>
          {partners.map((partner) => <li className="min-w-0" key={partner.id}><PartnerTile partner={partner} /></li>)}
        </ul>
      </Container>
    </section>
  );
}
