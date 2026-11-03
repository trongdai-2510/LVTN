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
    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden ${source ? 'bg-white' : 'bg-primarySoft/30'} ${className}`}>
      {source ? (
        <Image alt="" className="object-contain p-3" fill sizes={sizes} src={source} />
      ) : (
        <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full border border-borderBlue bg-white font-display text-2xl font-semibold text-primary">
          {partner.name.trim().charAt(0).toLocaleUpperCase('vi')}
        </span>
      )}
    </span>
  );
}
