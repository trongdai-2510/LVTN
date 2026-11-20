import Image from 'next/image';
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
  const layout = certificates.length === 1 ? 'max-w-[780px]' : 'lg:grid-cols-2';
  return <section aria-labelledby="certificates-title" className="scroll-mt-24 border-t border-borderBlue bg-white py-14 lg:py-20" id="chung-nhan">
    <Container size="narrow">
      <div className="mb-9 max-w-[660px]">
        <p className="type-eyebrow text-primary">Tài liệu doanh nghiệp</p>
        <h2 className="type-section-title mt-2 text-secondary" id="certificates-title">Chứng nhận của Song Thanh</h2>
      </div>
      <ul className={`grid gap-4 lg:gap-6 ${layout}`}>
        {certificates.map((certificate) => {
          const image = resolvePublicFileSource(certificate.image_file);
          const file = resolvePublicFileSource(certificate.file);
          const issued = dateLabel(certificate.issued_date);
          const expires = dateLabel(certificate.expires_date);
          return <li key={certificate.id}>
            <article className="flex h-full min-h-44 gap-5 border border-borderBlue bg-panel p-4 sm:gap-6 sm:p-5">
              <div className="relative flex aspect-[3/4] w-24 shrink-0 items-center justify-center overflow-hidden border border-borderBlue bg-white sm:w-28">
                {image ? <Image alt="" className="object-contain p-2" fill sizes="112px" src={image} /> : <DocumentIcon />}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <h3 className="font-display text-lg font-semibold leading-snug text-secondary sm:text-xl">{certificate.title}</h3>
                {issued || expires ? <dl className="mt-3 space-y-1 text-sm leading-relaxed text-body">
                  {issued ? <div className="flex flex-wrap gap-x-2"><dt>Ngày cấp</dt><dd className="font-medium text-secondary">{issued}</dd></div> : null}
                  {expires ? <div className="flex flex-wrap gap-x-2"><dt>Hiệu lực đến</dt><dd className="font-medium text-secondary">{expires}</dd></div> : null}
                </dl> : null}
                {file ? <a aria-label={`Mở chứng nhận ${certificate.title}`} className="mt-4 inline-flex min-h-11 w-fit items-center text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" href={file} rel="noopener noreferrer" target="_blank">Xem tài liệu <span aria-hidden="true" className="ml-2">↗</span></a> : null}
              </div>
            </article>
          </li>;
        })}
      </ul>
    </Container>
  </section>;
}

function DocumentIcon() {
  return <svg aria-hidden="true" className="h-14 w-14 text-primary" fill="none" viewBox="0 0 56 56">
    <path d="M15 6h18l9 9v34H15a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="1.8" />
    <path d="M33 6v10h9M19 27h17M19 33h17M19 39h12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </svg>;
}
