import Image from 'next/image';
import Link from 'next/link';

import { Container } from '@/components/ui/Container';

const notFoundImageSrc = '/assets/illustrations/song-thanh-404-electrical.png';

export default function NotFound() {
  return (
    <div className="bg-[oklch(0.995_0.004_248)]">
      <section className="py-8 lg:py-10">
        <Container className="flex min-h-[calc(100vh-180px)] flex-col items-center justify-start gap-5 pt-10 lg:justify-center lg:pt-0" size="wide">
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold text-secondary sm:text-3xl">
              Trang này hiện không khả dụng
            </h1>
            <p className="mt-2 text-sm text-body sm:text-base">
              Nội dung có thể đang tạm ẩn hoặc đường dẫn đã thay đổi.
            </p>
          </div>

          <div className="relative aspect-[3/2] w-full max-w-[720px] overflow-hidden rounded-sm bg-[oklch(0.985_0.032_85)] shadow-[0_24px_70px_oklch(0.45_0.08_75/0.18)]">
            <Image
              alt="Minh họa kỹ thuật điện cho trang 404 Song Thanh"
              className="object-contain"
              fill
              priority
              sizes="(min-width: 1024px) 720px, 100vw"
              src={notFoundImageSrc}
            />
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            <Link className="type-button-lg inline-flex h-14 items-center rounded-xs bg-primary px-7 text-white shadow-action" href="/">
              Quay lại Trang chủ
            </Link>
            <Link className="type-button-lg inline-flex h-14 items-center rounded-xs bg-accent px-7 text-primary" href="/lien-he">
              Liên hệ hỗ trợ
            </Link>
          </div>
        </Container>
      </section>
    </div>
  );
}
