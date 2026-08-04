'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { apiClient } from '@/lib/api-client';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function FileImage({
  fileId,
  alt = '',
  className,
  fallback,
}: {
  fileId: string | null | undefined;
  alt?: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!fileId) {
      setFailed(true);
      return;
    }

    let active = true;
    const id = fileId;
    setSrc(null);
    setFailed(false);

    async function load() {
      try {
        const blob = await apiClient.getBlob(
          `/song-thanh/files/${encodeURIComponent(id)}/preview`
        );
        if (!active) return;
        const url = await blobToDataUrl(blob);
        if (active) setSrc(url);
      } catch {
        if (active) setFailed(true);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [fileId]);

  if (src) {
    return <img src={src} alt={alt} className={className} />;
  }

  if (failed || !fileId) {
    return fallback ? <>{fallback}</> : null;
  }

  return <div className={`animate-pulse bg-muted${className ? ` ${className}` : ''}`} />;
}
