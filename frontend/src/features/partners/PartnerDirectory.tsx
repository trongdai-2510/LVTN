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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5" data-partner-directory="true">
      {partners.map((partner) => {
        const image = resolvePublicFileSource(partner.logo_file);
        const website = safeWebsite(partner.website_url);
        const card = (
          <article className="flex min-h-36 flex-col items-center justify-center gap-4 rounded-md border border-borderBlue bg-white px-5 py-6 text-center transition-colors hover:border-primary/40">
            {image ? (
              <div className="relative h-16 w-full">
                <Image alt="" className="object-contain" fill sizes="(min-width: 1024px) 220px, (min-width: 640px) 40vw, 80vw" src={image} />
              </div>
            ) : null}
            <h3 className="font-display text-lg font-semibold text-secondary">{partner.name}</h3>
          </article>
        );
        return website ? (
          <a aria-label={`Mở website đối tác ${partner.name}`} href={website} key={partner.id} rel="noopener noreferrer" target="_blank">{card}</a>
        ) : <div key={partner.id}>{card}</div>;
      })}
    </div>
  );
}
