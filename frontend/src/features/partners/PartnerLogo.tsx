import Image from 'next/image';
import type { PublicPartner } from '@/types/contracts/publicPartners';
import { resolvePublicFileSource } from '@/lib/public-file';

interface PartnerLogoProps {
  partner: PublicPartner;
  className: string;
  sizes: string;
}

export function PartnerLogo({ partner, className, sizes }: PartnerLogoProps) {
  const source = resolvePublicFileSource(partner.logo_file);

  return (
    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden ${className}`}>
      {source ? (
        <Image alt="" className="object-contain" fill sizes={sizes} src={source} />
      ) : (
        <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-primarySoft/60 font-display text-xl font-semibold text-primary">
          {partner.name.trim().charAt(0).toLocaleUpperCase('vi')}
        </span>
      )}
    </span>
  );
}
