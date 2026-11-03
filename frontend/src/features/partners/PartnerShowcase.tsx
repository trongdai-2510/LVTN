import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import type { PublicPartner } from '@/types/contracts/publicPartners';
import { PartnerLogo } from './PartnerLogo';
import { partnerWebsite } from './partnerWebsite';

const directoryHref = '/doi-tac-thuong-hieu#danh-sach-doi-tac';

function HomePartnerItem({ partner, featured }: { partner: PublicPartner; featured: boolean }) {
  const website = partnerWebsite(partner.website_url);
  const content = (
    <article className={`group flex h-full flex-col items-start ${featured ? 'sm:flex-row sm:items-center sm:bg-white' : ''}`}>
      <div className={`flex w-full items-center justify-center bg-white px-5 transition-shadow duration-300 group-hover:shadow-[0_12px_32px_-20px_rgba(0,74,180,0.5)] ${featured ? 'h-28 sm:h-36 sm:w-56 sm:shrink-0' : 'h-24 sm:h-28'}`}>
        <PartnerLogo className="h-16 w-full max-w-[11rem] sm:h-20" partner={partner} sizes="176px" />
      </div>
      <h3 className={`line-clamp-2 font-display font-semibold leading-snug text-secondary transition-colors group-hover:text-primary ${featured ? 'mt-3 text-lg sm:ml-7 sm:mt-0 sm:text-2xl' : 'mt-3 text-base sm:text-lg'}`}>
        {partner.name}
        {website ? <span aria-hidden="true" className="ml-2 inline-block text-primary">↗</span> : null}
      </h3>
    </article>
  );

  return website ? (
    <a aria-label={`Mở website đối tác ${partner.name} trong tab mới`} className="block h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" href={website} rel="noopener noreferrer" target="_blank">{content}</a>
  ) : <div className="h-full">{content}</div>;
}

export function HomePartnerShowcase({ partners, className = '' }: { partners: PublicPartner[]; className?: string }) {
  if (partners.length === 0) return null;
  const visible = partners.slice(0, 3);
  const itemColumns = visible.length === 1 ? 'max-w-[560px]' : visible.length === 2 ? 'max-w-[600px] grid-cols-2' : 'max-w-[850px] grid-cols-2 sm:grid-cols-3';

  return (
    <section aria-label="Đối tác của Song Thanh" className={`bg-[#f2f6fd] py-10 sm:py-12 ${className}`}>
      <Container className="grid gap-8 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:items-center lg:gap-14" size="narrow">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Kết nối cùng Song Thanh</p>
          <h2 className="mt-3 max-w-[14ch] font-display text-[clamp(1.75rem,2.5vw,2.35rem)] font-semibold leading-[1.16] tracking-[-0.025em] text-secondary">Đối tác của Song Thanh</h2>
          <Link className="mt-5 inline-flex min-h-11 items-center gap-2 border-b border-primary/35 text-sm font-semibold text-primary transition-colors hover:border-primary hover:text-primaryStrong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" href={directoryHref}>
            Xem tất cả đối tác <span aria-hidden="true">→</span>
          </Link>
        </div>
        <ul className={`grid w-full gap-4 sm:gap-5 ${itemColumns}`} data-partner-home-count={visible.length}>
          {visible.map((partner) => <li className="min-w-0" key={partner.id}><HomePartnerItem featured={visible.length === 1} partner={partner} /></li>)}
        </ul>
      </Container>
    </section>
  );
}

function AboutPartnerItem({ partner, index }: { partner: PublicPartner; index: number }) {
  const website = partnerWebsite(partner.website_url);
  const content = (
    <article className="group grid min-h-24 grid-cols-[1.5rem_5rem_minmax(0,1fr)_1rem] items-center gap-3 border-t border-borderBlue py-3 sm:grid-cols-[2rem_5rem_minmax(0,1fr)_1rem] sm:gap-4">
      <span aria-hidden="true" className="self-start pt-2 font-display text-xs font-semibold tabular-nums text-primary">{String(index + 1).padStart(2, '0')}</span>
      <PartnerLogo className="h-16 w-20" partner={partner} sizes="80px" />
      <h3 className="min-w-0 font-display text-base font-semibold leading-snug text-secondary transition-colors group-hover:text-primary sm:text-lg">{partner.name}</h3>
      {website ? <span aria-hidden="true" className="text-primary">↗</span> : null}
    </article>
  );

  return website ? (
    <a aria-label={`Mở website đối tác ${partner.name} trong tab mới`} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href={website} rel="noopener noreferrer" target="_blank">{content}</a>
  ) : <div>{content}</div>;
}

export function AboutPartnerShowcase({ partners }: { partners: PublicPartner[] }) {
  if (partners.length === 0) return null;
  const visible = partners.slice(0, 4);

  return (
    <section aria-label="Đối tác của Song Thanh" className="border-t border-borderBlue bg-white py-11 sm:py-14">
      <Container className="grid gap-7 lg:grid-cols-[minmax(0,0.55fr)_minmax(0,1fr)] lg:gap-14" size="narrow">
        <div className="flex flex-wrap items-end justify-between gap-4 lg:block">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Cùng Song Thanh</p>
            <h2 className="mt-3 font-display text-[clamp(1.75rem,2.7vw,2.5rem)] font-semibold leading-tight tracking-[-0.025em] text-secondary">Đối tác</h2>
          </div>
          <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:text-primaryStrong hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:mt-5" href={directoryHref}>
            Xem danh bạ <span aria-hidden="true">→</span>
          </Link>
        </div>
        <ol className={`grid gap-x-8 ${visible.length === 1 ? 'max-w-[540px]' : ''} ${visible.length >= 3 ? 'md:grid-cols-2' : ''}`} data-partner-about-count={visible.length}>
          {visible.map((partner, index) => <li className="min-w-0" key={partner.id}><AboutPartnerItem index={index} partner={partner} /></li>)}
        </ol>
      </Container>
    </section>
  );
}
