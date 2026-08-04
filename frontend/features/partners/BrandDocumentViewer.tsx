'use client';

import { useEffect, useId, useRef, useState } from 'react';

export type BrandViewerDocument = {
  id: string;
  title: string;
  href: string;
  typeLabel: string;
  description?: string | null;
};

type ViewerTone = {
  accent: string;
  accentStrong: string;
  accentSoft: string;
  border: string;
  surface: string;
};

function PdfIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M7.25 3.75h6.25l3.25 3.25v13.25H7.25V3.75Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="M13.5 3.75V7h3.25M9.75 12.25h4.5M9.75 15.25h4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function ArrowTopRightIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M8 7h9v9M17 7 7 17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function DownloadIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M12 4.75v9m0 0 3.5-3.5M12 13.75l-3.5-3.5M5.75 18.75h12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function buildPdfPreviewUrl(href: string) {
  const separator = href.includes('#') ? '&' : '#';
  return `${href}${separator}toolbar=0&navpanes=0&view=FitH`;
}

/**
 * Tai lieu thuong hieu: danh sach chon + khung xem nhanh PDF trong trang.
 * PDF van co nut mo tab moi va tai ve de khach co duong thoat ro rang.
 */
export function BrandDocumentViewer({
  documents,
  brandName,
  tone
}: {
  documents: BrandViewerDocument[];
  brandName: string;
  tone: ViewerTone;
}) {
  const [activeId, setActiveId] = useState(documents[0]?.id ?? '');
  const viewerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!documents.some((doc) => doc.id === activeId)) {
      setActiveId(documents[0]?.id ?? '');
    }
  }, [documents, activeId]);

  if (documents.length === 0) return null;

  const active = documents.find((doc) => doc.id === activeId) ?? documents[0];
  const previewUrl = buildPdfPreviewUrl(active.href);

  function selectDocument(id: string) {
    setActiveId(id);
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      window.requestAnimationFrame(() => {
        viewerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  return (
    <div className="mt-8">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="type-eyebrow" style={{ color: tone.accentStrong }}>Tài liệu thương hiệu</p>
          <h3 className="type-card-title-lg mt-2 text-secondary">Catalogue và bảng giá {brandName}</h3>
        </div>
        <p className="type-body-sm text-body">
          {documents.length} tài liệu
        </p>
      </div>

      <div
        className="grid gap-0 overflow-hidden rounded-md border bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)] lg:grid-cols-[minmax(280px,390px)_minmax(0,1fr)]"
        style={{ borderColor: tone.border }}
      >
        <aside className="border-b bg-white lg:border-b-0 lg:border-r" style={{ borderColor: tone.border }}>
          <div className="flex items-center justify-between gap-4 border-b px-5 py-4" style={{ borderColor: tone.border, backgroundColor: tone.surface }}>
            <div>
              <p className="type-caption font-semibold" style={{ color: tone.accentStrong }}>Bộ tài liệu</p>
              <p className="type-body-sm font-bold text-secondary">{brandName}</p>
            </div>
            <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-xs px-2 type-caption font-bold" style={{ backgroundColor: tone.accentSoft, color: tone.accentStrong }}>
              {documents.length}
            </span>
          </div>

          <ul className="grid max-h-[520px] gap-2 overflow-y-auto p-3 sm:grid-cols-2 lg:grid-cols-1" role="list">
            {documents.map((doc, index) => {
              const isActive = doc.id === active.id;
              return (
                <li key={doc.id}>
                  <button
                    aria-controls={panelId}
                    aria-pressed={isActive}
                    className="group flex w-full items-start gap-3 rounded-sm border px-3.5 py-3 text-left transition duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                    onClick={() => selectDocument(doc.id)}
                    style={{
                      borderColor: isActive ? tone.accentStrong : tone.border,
                      backgroundColor: isActive ? tone.surface : '#ffffff',
                      boxShadow: isActive ? `inset 0 0 0 1px ${tone.accentStrong}` : 'none'
                    }}
                    type="button"
                  >
                    <span
                      className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xs"
                      style={{ backgroundColor: isActive ? tone.accentStrong : tone.accentSoft, color: isActive ? '#ffffff' : tone.accentStrong }}
                    >
                      <PdfIcon />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="type-caption font-semibold" style={{ color: tone.accentStrong }}>
                        {doc.typeLabel}
                      </span>
                      <span className="mt-0.5 block type-body-sm font-bold text-secondary [text-wrap:balance]">
                        {doc.title}
                      </span>
                      {doc.description ? (
                        <span className="mt-1 line-clamp-2 block type-caption text-body">{doc.description}</span>
                      ) : null}
                    </span>
                    <span
                      aria-hidden
                      className="mt-1 shrink-0 type-caption font-bold [font-variant-numeric:tabular-nums]"
                      style={{ color: isActive ? tone.accentStrong : '#94a3b8' }}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="min-w-0" id={panelId} ref={viewerRef}>
          <div className="flex flex-col gap-4 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5" style={{ borderColor: tone.border, backgroundColor: tone.surface }}>
            <div className="flex min-w-0 items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xs" style={{ backgroundColor: tone.accentSoft, color: tone.accentStrong }}>
                <PdfIcon />
              </span>
              <div className="min-w-0">
                <p className="truncate type-body-sm font-bold text-secondary" title={active.title}>{active.title}</p>
                <p className="type-caption text-body">Xem nhanh PDF, cuộn trong khung bên dưới.</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <a
                className="type-caption inline-flex min-h-9 items-center gap-1.5 rounded-xs px-3 font-semibold text-white transition hover:opacity-90 motion-reduce:transition-none"
                href={active.href}
                rel="noreferrer"
                style={{ backgroundColor: tone.accentStrong }}
                target="_blank"
              >
                Mở PDF
                <ArrowTopRightIcon />
              </a>
              <a
                className="type-caption inline-flex min-h-9 items-center gap-1.5 rounded-xs border bg-white px-3 font-semibold transition hover:bg-subtle motion-reduce:transition-none"
                download
                href={active.href}
                style={{ borderColor: tone.border, color: tone.accentStrong }}
              >
                Tải về
                <DownloadIcon />
              </a>
            </div>
          </div>

          <div className="bg-[linear-gradient(180deg,#f8fafc_0%,#eef4ff_100%)] p-3 sm:p-5">
            <iframe
              className="block h-[62vh] max-h-[780px] min-h-[460px] w-full rounded-sm border bg-[#f4f6fb] shadow-[0_16px_38px_rgba(15,23,42,0.14)]"
              key={active.id}
              loading="lazy"
              src={previewUrl}
              style={{ borderColor: tone.border }}
              title={`Xem tài liệu: ${active.title}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
