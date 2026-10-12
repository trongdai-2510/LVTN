'use client';

import Image from 'next/image';
import { useState } from 'react';

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

function getImageId(image: PublicProductImage | null | undefined) {
  return image?.file_id || image?.file?.id || image?.id || '';
}

export function ProductGallery({ images, fallbackLabel }: ProductGalleryProps) {
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());
  const [loadedImageSource, setLoadedImageSource] = useState<string | null>(null);
  const resolvedSelectedIndex = Math.max(
    images.findIndex((image) => getImageId(image) === selectedImageId),
    0
  );
  const selectedImage = images[resolvedSelectedIndex] ?? null;
  const resolvedSelectedImageId = getImageId(selectedImage);
  const selectedImageSource = failedImageIds.has(resolvedSelectedImageId)
    ? null
    : resolvePublicFileSource(selectedImage?.file);
  const selectedImageAlt = selectedImage?.alt_text || fallbackLabel;
  const selectedImageReady = Boolean(selectedImageSource && loadedImageSource === selectedImageSource);
  const thumbnailImages = images.length > 1 ? images : [];

  function markImageFailed(image: PublicProductImage | null) {
    const imageId = getImageId(image);
    if (!imageId) return;
    setFailedImageIds((current) => new Set(current).add(imageId));
  }

  return (
    <div className="min-w-0 max-w-full space-y-3 sm:space-y-4">
      <div className="border border-borderSoft/60 bg-white p-3 sm:p-4">
        <div aria-busy={Boolean(selectedImageSource && !selectedImageReady)} className="relative flex h-[228px] items-center justify-center overflow-hidden bg-panel sm:h-[340px] lg:h-[400px]" data-product-gallery-current="true">
          {selectedImageSource ? (
            <>
              {loadedImageSource && !selectedImageReady ? (
                <Image
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-contain p-1.5 sm:p-2"
                  width={720}
                  height={720}
                  loading="eager"
                  sizes="(max-width: 1024px) 100vw, 46vw"
                  src={loadedImageSource}
                />
              ) : null}
              <Image
                alt={selectedImageAlt}
                className={`h-full w-full object-contain p-1.5 sm:p-2 ${selectedImageReady ? '' : 'opacity-0'}`}
                data-product-gallery-image="true"
                width={720}
                height={720}
                loading="eager"
                onLoad={() => setLoadedImageSource(selectedImageSource)}
                onError={() => markImageFailed(selectedImage)}
                sizes="(max-width: 1024px) 100vw, 46vw"
                src={selectedImageSource}
              />
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(239,244,255,0.72),rgba(255,255,255,0)),radial-gradient(circle_at_20%_18%,rgba(0,96,230,0.12),transparent_34%),radial-gradient(circle_at_88%_74%,rgba(211,228,254,0.82),transparent_32%)]" />
              <div className="absolute inset-0 opacity-45">
                <span className="absolute left-[10%] top-[22%] h-px w-[58%] bg-primary/10" />
                <span className="absolute bottom-[24%] right-[10%] h-px w-[48%] bg-primary/10" />
                <span className="absolute left-[30%] top-0 h-full w-px bg-primary/10" />
                <span className="absolute right-[22%] top-0 h-full w-px bg-primary/10" />
              </div>
              <div className="relative flex h-[262px] w-[262px] items-center justify-center rounded-sm border border-white/80 bg-white/80 px-8 text-center" data-product-gallery-fallback="true">
                <span className="type-caption inline-flex rounded-xs bg-white px-3 py-1 font-bold text-primary">
                  Hình ảnh đang cập nhật
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {thumbnailImages.length > 0 ? (
        <div aria-label="Ảnh sản phẩm" className="flex w-full max-w-full snap-x gap-3 overflow-x-auto pb-2" role="group">
          {thumbnailImages.map((image, index) => {
            const imageId = getImageId(image);
            const thumbnailSource = failedImageIds.has(imageId)
              ? null
              : resolvePublicFileSource(image.file);
            const isSelected = index === resolvedSelectedIndex;

            return (
              <button
                aria-label={`Xem ảnh ${index + 1} của ${thumbnailImages.length}: ${image.alt_text || fallbackLabel}`}
                aria-pressed={isSelected}
                className={[
                  'relative flex h-16 w-16 shrink-0 snap-start overflow-hidden rounded-xs border bg-white p-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:h-[88px] sm:w-[88px]',
                  isSelected
                    ? 'border-primary ring-1 ring-primary/30'
                    : 'border-borderSoft/60 hover:border-primary/40'
                ].join(' ')}
                key={image?.id ?? `thumb-${index}`}
                onClick={() => setSelectedImageId(imageId)}
                type="button"
              >
                <div className="absolute inset-2 rounded-sm bg-panel" />
                {thumbnailSource ? (
                  <Image
                    alt=""
                    className="relative h-full w-full rounded-sm object-contain p-3"
                    width={160}
                    height={160}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    onError={() => markImageFailed(image)}
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
