'use client';

import { useState, useEffect } from 'react';

export function NewsDetailClient({ title }: { url?: string; title: string }) {
  const [currentUrl, setCurrentUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCurrentUrl(window.location.href);
  }, []);

  function shareOnFacebook() {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`,
      '_blank',
      'noopener,noreferrer,width=600,height=400'
    );
  }

  function shareOnZalo() {
    window.open(
      `https://zalo.me/share/url?url=${encodeURIComponent(currentUrl)}&title=${encodeURIComponent(title)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: do nothing
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-borderSoft pt-6">
      <span className="type-body-sm font-semibold text-body">Chia sẻ:</span>

      <button
        className="flex min-h-11 items-center gap-2 rounded-xs border border-borderBlue bg-primarySoft/45 px-4 text-sm font-semibold text-primaryStrong transition hover:border-primary hover:bg-primarySoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        onClick={shareOnFacebook}
        type="button"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M22 12a10 10 0 1 0-11.563 9.87v-6.98H7.898V12h2.539V9.797c0-2.506 1.493-3.89 3.777-3.89 1.094 0 2.239.195 2.239.195v2.46h-1.261c-1.243 0-1.63.773-1.63 1.563V12h2.773l-.443 2.89h-2.33V21.87A10 10 0 0 0 22 12Z" />
        </svg>
        Facebook
      </button>

      <button
        className="flex min-h-11 items-center gap-2 rounded-xs border border-borderBlue bg-primarySoft/45 px-4 text-sm font-semibold text-primaryStrong transition hover:border-primary hover:bg-primarySoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        onClick={shareOnZalo}
        type="button"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 48 48">
          <path d="M24 4C12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20S35.05 4 24 4Zm-4.5 28.5H16v-12h3.5v12Zm-1.75-13.75a2 2 0 1 1 0-4 2 2 0 0 1 0 4ZM34 32.5h-3.25l-4-6v6H23.5v-12H26l4.25 6.5v-6.5H34v12Z" />
        </svg>
        Zalo
      </button>

      <button
        className={[
          'flex min-h-11 items-center gap-2 rounded-xs px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          copied
            ? 'border border-emerald-300 bg-emerald-50 text-emerald-900'
            : 'border border-borderBlue bg-white text-primaryStrong hover:border-primary hover:bg-primarySoft'
        ].join(' ')}
        onClick={copyLink}
        type="button"
      >
        {copied ? (
          <>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" />
            </svg>
            Đã sao chép
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Sao chép link
          </>
        )}
      </button>
    </div>
  );
}

