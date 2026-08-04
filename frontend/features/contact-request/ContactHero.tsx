import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/ui/Container";

type ContactHeroProps = {
  title: string;
  excerpt: string;
  imageSource?: string | null;
};

const CONTACT_STEPS = [
  {
    label: "Mô tả nhu cầu",
    detail: "Tư vấn, báo giá hoặc thông tin kỹ thuật",
  },
  {
    label: "Chọn kênh phản hồi",
    detail: "Form liên hệ, hotline hoặc email",
  },
  {
    label: "Đội ngũ tiếp nhận",
    detail: "Phân loại và phản hồi đúng bộ phận",
  },
];

function ContactPreview() {
  return (
    <div className="relative max-w-full overflow-hidden py-4 lg:overflow-visible lg:pl-8 lg:pr-10">
      <div
        aria-hidden="true"
        className="absolute left-0 top-8 hidden h-28 w-40 rounded-[8px] bg-[#ffd966]/70 shadow-[0_18px_42px_rgba(255,217,102,0.22)] sm:block"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-4 right-2 hidden h-[76%] w-[74%] rounded-[8px] bg-primary/12 sm:block"
      />
      <div
        aria-hidden="true"
        className="absolute right-8 top-4 hidden h-16 w-40 rounded-[8px] bg-[#42a5e8]/18 sm:block"
      />

      <div className="relative overflow-hidden rounded-[8px] border border-[oklch(0.9_0.018_248)] bg-[oklch(0.992_0.007_248)] shadow-[0_24px_60px_rgba(15,35,75,0.13)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[oklch(0.9_0.016_248)] px-5 py-5 sm:px-6">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-primary">Phiếu tiếp nhận</p>
            <p className="mt-2 max-w-sm text-2xl font-black leading-tight text-slate-950">
              Gửi một lần, đội ngũ chuyển đúng kênh.
            </p>
          </div>
          <span className="rounded-[6px] bg-[#fff2bd] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-900">
            Song Thanh
          </span>
        </div>

        <div className="px-5 py-2 sm:px-6">
          {CONTACT_STEPS.map((step, index) => (
            <div
              className="grid grid-cols-[44px_minmax(0,1fr)] gap-4 border-b border-[oklch(0.91_0.014_248)] py-4 last:border-b-0"
              key={step.label}
            >
              <span className="grid size-11 place-items-center rounded-[6px] bg-primary/8 text-sm font-black text-primary ring-1 ring-primary/15">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="text-base font-black text-slate-950">{step.label}</p>
                <p className="mt-1 text-sm font-medium leading-6 text-slate-600">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeroImage({ imageSource, title }: { imageSource: string; title: string }) {
  return (
    <div className="relative overflow-hidden rounded-[8px] border border-[oklch(0.94_0.012_248)] bg-[oklch(0.995_0.006_248)] shadow-[0_28px_80px_rgba(15,35,75,0.16)] lg:mr-24">
      <Image
        src={imageSource}
        alt={title}
        width={760}
        height={520}
        priority
        className="aspect-[4/3] w-full object-cover"
      />
    </div>
  );
}

export function ContactHero({ title, excerpt, imageSource }: ContactHeroProps) {
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(115deg,#fffdf8_0%,#f6fbff_52%,#fbfdff_100%)]">
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-24 bg-[oklch(0.995_0.006_248)] opacity-80" />
      <div aria-hidden="true" className="absolute left-0 top-0 h-1.5 w-full bg-[linear-gradient(90deg,#ffd966_0%,#ffd966_28%,#42a5e8_28%,#42a5e8_52%,#0059c6_52%,#0059c6_100%)]" />

      <Container className="relative py-14 sm:py-16 lg:py-20">
        <nav className="mb-9 flex items-center gap-3 text-sm font-semibold text-slate-600 sm:text-base">
          <Link href="/" className="transition hover:text-primary">
            Trang chủ
          </Link>
          <span className="text-primary">/</span>
          <span className="text-slate-950">Liên hệ</span>
        </nav>

        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(420px,0.74fr)]">
          <div>
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-primary">
              Trao đổi nhu cầu trực tiếp
            </p>
            <h1 className="max-w-3xl break-words text-[40px] font-black leading-[1] text-slate-950 sm:text-7xl sm:leading-[0.95] lg:text-[5.8rem]">
              {title}
            </h1>
            <p className="mt-7 max-w-3xl text-xl font-medium leading-8 text-slate-700 sm:text-2xl sm:leading-9">
              {excerpt}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="#gui-yeu-cau"
                className="inline-flex min-h-14 items-center rounded-[6px] bg-primary px-7 text-base font-bold text-[oklch(0.99_0.006_248)] shadow-[0_18px_38px_rgba(0,89,198,0.22)] transition hover:bg-primary/90"
              >
                Gửi yêu cầu
              </Link>
              <Link
                href="#gui-yeu-cau"
                className="inline-flex min-h-14 items-center rounded-[6px] border border-primary/35 bg-[oklch(0.995_0.006_248)] px-7 text-base font-bold text-primary transition hover:border-primary hover:bg-primary/5"
              >
                Thông tin liên hệ
              </Link>
            </div>
          </div>

          {imageSource ? <HeroImage imageSource={imageSource} title={title} /> : <ContactPreview />}
        </div>
      </Container>
    </section>
  );
}
