import Image from 'next/image';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { resolvePublicFileSource } from '@/lib/public-file';
import type { PublicCertificate } from '@/types/contracts/publicCertificates';

function dateLabel(value: string | null): string | null {
  const date = value?.slice(0, 10);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

export function CertificateDirectory({ certificates }: { certificates: PublicCertificate[] }) {
  if (certificates.length === 0) return null;
  return <section aria-label="Chứng nhận của Song Thanh" className="border-t border-borderBlue bg-white py-12 lg:py-16" id="chung-nhan">
    <Container size="wide">
      <div className="mb-8"><p className="type-eyebrow text-primary">Hồ sơ công ty</p><h2 className="type-section-title mt-2 text-secondary">Chứng nhận của Song Thanh</h2></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {certificates.map((certificate) => {
          const image = resolvePublicFileSource(certificate.image_file);
          const file = resolvePublicFileSource(certificate.file);
          return <article className="overflow-hidden rounded-md border border-borderBlue bg-panel" key={certificate.id}>
            {image ? <div className="relative aspect-[4/3] bg-white"><Image alt="" className="object-contain p-4" fill sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw" src={image} /></div> : null}
            <div className="space-y-2 p-5"><h3 className="font-display text-lg font-semibold text-secondary">{certificate.title}</h3>
              {dateLabel(certificate.issued_date) ? <p className="text-sm text-body">Ngày cấp: {dateLabel(certificate.issued_date)}</p> : null}
              {dateLabel(certificate.expires_date) ? <p className="text-sm text-body">Có hiệu lực đến: {dateLabel(certificate.expires_date)}</p> : null}
              {file ? <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline" href={file} rel="noopener noreferrer" target="_blank">Xem chứng nhận</Link> : null}
            </div>
          </article>;
        })}
      </div>
    </Container>
  </section>;
}
