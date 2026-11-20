import Link from 'next/link';

import { Container } from '@/components/ui/Container';
import { getPublicEmail, getPublicHotlines } from '@/features/site-shell/site-shell.public';
import { formatWorkingHours } from '@/lib/format/text';
import type { PublicCompanyInfo } from '@/types/contracts/public-site-shell';

type ContactHeroProps = {
  title: string;
  excerpt: string;
  companyInfo: PublicCompanyInfo | null;
};

const CONTACT_DETAIL_CLASS = 'min-w-0 border-t border-white/30 py-5 first:border-t-0 md:border-l md:border-t-0 md:px-6 md:first:border-l-0 md:first:pl-0';

export function ContactHero({ title, excerpt, companyInfo }: ContactHeroProps) {
  const hotline = getPublicHotlines(companyInfo)[0];
  const email = getPublicEmail(companyInfo);
  const workingHours = formatWorkingHours(
    companyInfo?.working_hours_from ?? null,
    companyInfo?.working_hours_to ?? null,
    companyInfo?.working_days ?? null
  );
  const detailCount = [hotline, email, workingHours].filter(Boolean).length;
  const detailColumns = detailCount === 3 ? 'md:grid-cols-3' : detailCount === 2 ? 'md:grid-cols-2' : '';

  return (
    <section className="border-b border-borderBlue bg-white">
      <Container className="pb-12 pt-7 sm:pb-16 sm:pt-9 lg:pb-20" size="narrow">
        <nav aria-label="Đường dẫn" className="flex items-center gap-3 text-sm text-body">
          <Link className="min-h-11 content-center transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/">Trang chủ</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="font-semibold text-secondary">Liên hệ</span>
        </nav>

        <div className="mt-10 grid gap-8 lg:mt-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end lg:gap-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Liên hệ Song Thanh</p>
            <h1 className="mt-5 max-w-[13ch] font-display text-[clamp(3.25rem,5.3vw,5.25rem)] font-semibold leading-[1.04] tracking-[-0.045em] text-secondary">{title}</h1>
          </div>
          <div className="lg:pb-2">
            <p className="max-w-[48ch] text-lg leading-[1.7] text-body sm:text-xl">{excerpt}</p>
            <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3">
              <Link className="inline-flex min-h-12 items-center justify-center rounded-sm bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-primaryStrong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" href="#gui-yeu-cau">Gửi yêu cầu <span aria-hidden="true" className="ml-3">→</span></Link>
              <Link className="inline-flex min-h-12 items-center border-b border-primary/40 text-sm font-semibold text-primary transition-colors hover:border-primary hover:text-primaryStrong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" href="#thong-tin-lien-he">Thông tin liên hệ</Link>
            </div>
          </div>
        </div>

        {detailCount > 0 ? (
          <div aria-label="Kênh liên hệ trực tiếp" className={'mt-11 grid bg-primary px-6 text-white sm:mt-12 sm:px-8 ' + detailColumns}>
            {hotline ? (
              <div className={CONTACT_DETAIL_CLASS}>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/80">Hotline</p>
                <a className="mt-2 inline-flex min-h-11 max-w-full items-center break-words font-display text-xl font-semibold text-white underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-2xl" href={'tel:' + hotline.replace(/[^\d+]/g, '')}>{hotline}</a>
              </div>
            ) : null}
            {email ? (
              <div className={CONTACT_DETAIL_CLASS}>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/80">Email</p>
                <a className="mt-2 inline-flex min-h-11 max-w-full items-center break-all text-base font-medium text-white underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" href={'mailto:' + email}>{email}</a>
              </div>
            ) : null}
            {workingHours ? (
              <div className={CONTACT_DETAIL_CLASS}>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/80">Giờ làm việc</p>
                <p className="mt-2 flex min-h-11 items-center text-sm font-medium leading-relaxed text-white sm:text-base">{workingHours}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Container>
    </section>
  );
}
