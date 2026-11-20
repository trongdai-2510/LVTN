import Image from 'next/image';
import type { PublicPartner } from '@/types/contracts/publicPartners';
import { resolvePublicFileSource } from '@/lib/public-file';

interface PartnerLogoProps {
  partner: PublicPartner;
  className: string;
  sizes: string;
  imageClassName?: string;
}

export function PartnerLogo({ partner, className, sizes, imageClassName = '' }: PartnerLogoProps) {
  const source = resolvePublicFileSource(partner.logo_file);

  return (
    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden ${className}`}>
      {source ? (
        <Image alt="" className={`object-contain ${imageClassName}`} fill sizes={sizes} src={source} />
      ) : (
        <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-sm border border-primary/15 bg-primarySoft font-display text-2xl font-semibold text-primary">
          {partner.name.trim().charAt(0).toLocaleUpperCase('vi')}
        </span>
      )}
    </span>
  );
}
