'use client';

import { FileImage } from '@/components/icons';
import { useEffect, useState } from 'react';

import { apiClient } from '@/lib/api-client';
import { byId, endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';

export type AdminPreviewFile = {
  id: string;
  original_filename: string;
  mime_type: string;
};

const previewUrlCache = new Map<string, string | null>();
const previewRequestCache = new Map<string, Promise<string | null>>();

async function loadPreviewUrl(fileId: string): Promise<string | null> {
  const cached = previewUrlCache.get(fileId);
  if (cached !== undefined) {
    return cached;
  }

  const pending = previewRequestCache.get(fileId);
  if (pending) {
    return pending;
  }

  const request = (async () => {
    try {
      const blob = await apiClient.getBlob(
        `${byId(endpoints.songThanh.files, fileId)}/preview`
      );
      const objectUrl = URL.createObjectURL(blob);
      previewUrlCache.set(fileId, objectUrl);
      return objectUrl;
    } catch {
      previewUrlCache.set(fileId, null);
      return null;
    } finally {
      previewRequestCache.delete(fileId);
    }
  })();

  previewRequestCache.set(fileId, request);
  return request;
}

export function AdminFileThumbnail({
  file,
  alt,
  className,
  enabled = true,
  emptyLabel = 'Chưa có preview'
}: {
  file: AdminPreviewFile | null;
  alt: string;
  className?: string;
  enabled?: boolean;
  emptyLabel?: string;
}) {
  const previewableFile =
    file && file.mime_type.startsWith('image/') ? file : null;
  const [src, setSrc] = useState<string | null>(() =>
    previewableFile ? (previewUrlCache.get(previewableFile.id) ?? null) : null
  );
  const [loading, setLoading] = useState(
    Boolean(
      previewableFile &&
        enabled &&
        previewUrlCache.get(previewableFile.id) === undefined
    )
  );
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [enabled, previewableFile?.id]);

  useEffect(() => {
    let active = true;

    if (!enabled || !previewableFile) {
      setSrc(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const cached = previewUrlCache.get(previewableFile.id);
    if (cached !== undefined) {
      setSrc(cached);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    void loadPreviewUrl(previewableFile.id).then((nextSrc) => {
      if (!active) {
        return;
      }

      setSrc(nextSrc);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [enabled, previewableFile]);

  return (
    <div
      className={cn(
        'relative flex h-24 w-24 shrink-0 overflow-hidden rounded-md border border-border bg-muted',
        className
      )}
    >
      {src && !imageFailed ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : loading ? (
        <div className="h-full w-full animate-pulse bg-slate-200/70" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-2 text-center text-[11px] font-medium leading-tight text-muted-foreground">
          <FileImage className="h-5 w-5" />
          <span>{emptyLabel}</span>
        </div>
      )}
    </div>
  );
}
