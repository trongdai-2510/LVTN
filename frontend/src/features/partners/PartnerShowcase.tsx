import { Container } from '@/components/ui/Container';
import type { PublicPartner } from '@/types/contracts/publicPartners';
import { PartnerDirectory } from './PartnerDirectory';

interface PartnerShowcaseProps {
  partners: PublicPartner[];
  className?: string;
  id?: string;
}

export function PartnerShowcase({ partners, className = '', id }: PartnerShowcaseProps) {
  if (partners.length === 0) return null;

  return (
    <section aria-label="Đối tác của Song Thanh" className={`scroll-mt-24 py-9 sm:py-11 ${className}`} id={id}>
      <Container
        className={`grid gap-5 lg:items-center lg:gap-12 ${partners.length === 1
          ? 'lg:grid-cols-[minmax(0,360px)_minmax(0,480px)] lg:justify-center'
          : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]'}`}
        size="default"
      >
        <h2 className="type-section-title max-w-[18ch] text-secondary">Đối tác của Song Thanh</h2>
        <PartnerDirectory partners={partners} />
      </Container>
    </section>
  );
}
