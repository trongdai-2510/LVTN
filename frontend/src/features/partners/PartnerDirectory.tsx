import { Container } from '@/components/ui/Container';
import type { PublicPartner } from '@/types/contracts/publicPartners';
import { PartnerLogo } from './PartnerLogo';
import { partnerWebsite } from './partnerWebsite';

function DirectoryItem({ partner }: { partner: PublicPartner }) {
  const website = partnerWebsite(partner.website_url);
  const hasLogo = Boolean(partner.logo_file?.url?.trim());
  const content = (
    <article className="group flex h-full flex-col border-t border-borderBlue pt-5 sm:pt-6">
      <PartnerLogo className={`${hasLogo ? 'h-28 sm:h-32' : 'h-16 sm:h-20'} w-full max-w-48`} partner={partner} sizes="192px" />
      <div className="mt-4 flex min-w-0 items-start justify-between gap-4">
        <h3 className="min-w-0 font-display text-lg font-semibold leading-snug text-secondary transition-colors group-hover:text-primary sm:text-xl">{partner.name}</h3>
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
  const columns = partners.length === 1 ? 'max-w-[420px]' : partners.length === 2 ? 'max-w-[760px] sm:grid-cols-2' : 'max-w-[900px] sm:grid-cols-2 xl:grid-cols-3';

  return (
    <section aria-label="Đối tác của Song Thanh" className="scroll-mt-24 border-t border-borderBlue bg-[#f8faff] py-12 sm:py-16" id="danh-sach-doi-tac">
      <Container className="grid gap-8 lg:grid-cols-[minmax(0,0.48fr)_minmax(0,1fr)] lg:gap-14" size="narrow">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Danh bạ đối tác</p>
          <h2 className="mt-3 max-w-[14ch] font-display text-[clamp(2rem,3vw,2.75rem)] font-semibold leading-[1.14] tracking-[-0.035em] text-secondary">Đối tác của Song Thanh</h2>
          {partners.length > 1 ? <p className="mt-4 text-sm text-body">{partners.length} đối tác</p> : null}
        </div>
        <ul className={`grid w-full gap-x-7 gap-y-8 ${columns}`} data-partner-directory="true" data-partner-count={partners.length}>
          {partners.map((partner) => <li className="min-w-0" key={partner.id}><DirectoryItem partner={partner} /></li>)}
        </ul>
      </Container>
    </section>
  );
}
