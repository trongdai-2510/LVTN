import Image from 'next/image';
import type { PublicPartner } from '@/types/contracts/publicPartners';
import { resolvePublicFileSource } from '@/lib/public-file';

function safeWebsite(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function PartnerDirectory({ partners }: { partners: PublicPartner[] }) {
  if (partners.length === 0) return null;

  return (
    <div className={`grid gap-x-8 ${partners.length > 1 ? 'sm:grid-cols-2' : ''}`} data-partner-directory="true">
      {partners.map((partner) => {
        const image = resolvePublicFileSource(partner.logo_file);
        const website = safeWebsite(partner.website_url);
        const content = (
          <article className="flex min-h-24 items-center gap-4 border-b border-borderBlue py-4 sm:gap-5">
            {image ? (
              <div className="relative h-14 w-24 shrink-0 sm:h-16 sm:w-28">
                <Image alt="" className="object-contain object-left" fill sizes="(min-width: 640px) 112px, 96px" src={image} />
              </div>
            ) : null}
            <h3 className="min-w-0 flex-1 font-display text-base font-semibold leading-snug text-secondary sm:text-lg">{partner.name}</h3>
            {website ? (
              <span aria-hidden="true" className="shrink-0 text-xl leading-none text-primary transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">↗</span>
            ) : null}
          </article>
        );
        return website ? (
          <a
            aria-label={`Mở website đối tác ${partner.name} trong tab mới`}
            className="group block rounded-sm transition-colors hover:bg-primarySoft/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            href={website}
            key={partner.id}
            rel="noopener noreferrer"
            target="_blank"
          >
            {content}
          </a>
        ) : (
          <div key={partner.id}>{content}</div>
        );
      })}
    </div>
  );
}
