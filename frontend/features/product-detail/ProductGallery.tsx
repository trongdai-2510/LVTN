'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import { resolvePublicFileSource } from '@/lib/public-file';
import type { PublicProductImage } from '@/types/contracts/public-product-groups';

type ProductGalleryProps = {
  images: PublicProductImage[];
  fallbackLabel: string;
};

function ThumbnailFallback() {
  return (
    <div className="relative flex h-full w-full items-center justify-center rounded-sm border border-white/80 bg-white/80">
      <div className="grid h-12 w-12 grid-cols-2 gap-1.5">
        <span className="rounded-[6px] bg-primary/15" />
        <span className="rounded-[6px] bg-primary/10" />
        <span className="rounded-[6px] bg-primary/10" />
        <span className="rounded-[6px] bg-primary/15" />
      </div>
    </div>
  );
}

export function ProductGallery({ images, fallbackLabel }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [images]);

  const selectedImage = useMemo(() => images[selectedIndex] ?? null, [images, selectedIndex]);
  const selectedImageSource = resolvePublicFileSource(selectedImage?.file);
  // Chỉ hiện dải thumbnail khi có từ 2 ảnh trở lên — tránh ô viền to gần trống.
  const thumbnailImages = useMemo(() => (images.length > 1 ? images.slice(0, 4) : []), [images]);
  const thumbnailGridClass =
    thumbnailImages.length >= 4
      ? 'grid-cols-4'
      : thumbnailImages.length === 3
        ? 'grid-cols-3'
        : 'grid-cols-2';

  return (
    <div className="space-y-6">
      <div className="rounded-sm border border-borderSoft/20 bg-white p-3 shadow-soft sm:p-4">
        <div className="relative flex h-[320px] items-center justify-center overflow-hidden rounded-sm bg-panel sm:h-[400px] lg:h-[440px]">
          {selectedImageSource ? (
            <Image
              alt={selectedImage?.alt_text || fallbackLabel}
              className="h-full w-full object-contain p-1.5 sm:p-2"
              width={720}
              height={720}
              priority
              sizes="(max-width: 1024px) 100vw, 46vw"
              src={selectedImageSource}
            />
          ) : (
            <>
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(239,244,255,0.72),rgba(255,255,255,0)),radial-gradient(circle_at_20%_18%,rgba(0,96,230,0.12),transparent_34%),radial-gradient(circle_at_88%_74%,rgba(211,228,254,0.82),transparent_32%)]" />
              <div className="absolute inset-0 opacity-45">
                <span className="absolute left-[10%] top-[22%] h-px w-[58%] bg-primary/10" />
                <span className="absolute bottom-[24%] right-[10%] h-px w-[48%] bg-primary/10" />
                <span className="absolute left-[30%] top-0 h-full w-px bg-primary/10" />
                <span className="absolute right-[22%] top-0 h-full w-px bg-primary/10" />
              </div>
              <div className="relative flex h-[262px] w-[262px] items-center justify-center rounded-sm border border-white/80 bg-white/80 px-8 text-center">
                <span className="type-caption inline-flex rounded-xs bg-white px-3 py-1 font-bold text-primary">
                  Hình ảnh đang cập nhật
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {thumbnailImages.length > 0 ? (
        <div className={`grid ${thumbnailGridClass} gap-3`}>
          {thumbnailImages.map((image, index) => {
            const thumbnailSource = resolvePublicFileSource(image?.file);
            const isSelected = index === selectedIndex;

            return (
              <button
                className={[
                  'relative flex h-[88px] overflow-hidden rounded-sm border bg-white p-2 transition sm:h-[100px] lg:h-[108px]',
                  isSelected
                    ? 'border-primary ring-1 ring-primary/30'
                    : 'border-borderSoft/60 hover:border-primary/40'
                ].join(' ')}
                key={image?.id ?? `thumb-${index}`}
                onClick={() => setSelectedIndex(index)}
                type="button"
              >
                <div className="absolute inset-2 rounded-sm bg-panel" />
                {thumbnailSource ? (
                  <Image
                    alt={image?.alt_text || fallbackLabel}
                    className="relative h-full w-full rounded-sm object-contain p-3"
                    width={160}
                    height={160}
                    sizes="160px"
                    src={thumbnailSource}
                  />
                ) : (
                  <ThumbnailFallback />
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
