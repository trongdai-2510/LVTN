import Image from 'next/image';
import Link from 'next/link';

import { Container } from '@/components/ui/Container';
import { resolvePublicFileSource } from '@/lib/public-file';
import type { PublicCertificate } from '@/types/contracts/publicCertificates';

function DocumentIcon() {
  return <svg aria-hidden="true" className="h-9 w-9 text-primary" fill="none" viewBox="0 0 40 40">
    <path d="M10 4.5h13l7 7v24H10a3 3 0 0 1-3-3v-25a3 3 0 0 1 3-3Z" stroke="currentColor" strokeWidth="1.6" />
    <path d="M23 4.5v8h7M13 20h14M13 25h14M13 30h9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
  </svg>;
}

function issuedYear(date: string | null): string | null {
  const year = date?.slice(0, 4);
  return year && /^\d{4}$/.test(year) ? year : null;
}

export function HomeCertificates({ certificates }: { certificates: PublicCertificate[] }) {
  if (certificates.length === 0) return null;

  const featured = certificates.slice(0, 3);
  const layout = featured.length === 1 ? 'max-w-[720px]' : featured.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3';

  return <section aria-labelledby="home-certificates-title" className="border-t border-borderBlue bg-white py-12 lg:py-16">
    <Container size="narrow">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <p className="type-eyebrow text-primary">Hồ sơ doanh nghiệp</p>
          <h2 className="type-section-title mt-2 text-secondary" id="home-certificates-title">Chứng nhận</h2>
        </div>
        {certificates.length > featured.length ? <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" href="/gioi-thieu#chung-nhan">Toàn bộ chứng nhận <span aria-hidden="true" className="ml-2">↗</span></Link> : null}
      </div>
      <ul className={`grid gap-x-6 gap-y-3 ${layout}`}>
        {featured.map((certificate) => {
          const image = resolvePublicFileSource(certificate.image_file);
          const file = resolvePublicFileSource(certificate.file);
          const year = issuedYear(certificate.issued_date);
          const body = <>
            <span className="relative flex h-24 w-[76px] shrink-0 items-center justify-center overflow-hidden border border-borderBlue bg-white">
              {image ? <Image alt="" className="object-contain p-1.5" fill sizes="76px" src={image} /> : <DocumentIcon />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-lg font-semibold leading-snug text-secondary">{certificate.title}</span>
              {year ? <span className="mt-2 block text-sm text-body">Cấp năm {year}</span> : null}
              {file ? <span className="mt-3 inline-flex items-center text-sm font-semibold text-primary">Mở chứng nhận <span aria-hidden="true" className="ml-2">↗</span></span> : null}
            </span>
          </>;
          return <li key={certificate.id}>
            {file ? <a aria-label={`Mở chứng nhận ${certificate.title}`} className="flex min-h-32 items-center gap-5 border-y border-borderBlue py-4 transition-colors hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" href={file} rel="noopener noreferrer" target="_blank">{body}</a> :
              <div className="flex min-h-32 items-center gap-5 border-y border-borderBlue py-4">{body}</div>}
          </li>;
        })}
      </ul>
    </Container>
  </section>;
}
