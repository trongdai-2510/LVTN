'use client';

import { ReactNode } from 'react';
import { type BusinessReferenceData as ReferenceData } from './businessListFilters';
import type { BusinessKind } from './businessTypes';
import { Card } from '@/components/ui/Card';
import { endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { formatValue } from '@/lib/formatters';
import { type RecordMap } from './businessPageShared';
import { EMPTY_REFERENCE_DATA, fetchListReferences, fetchReferenceList } from './businessPageData';

export async function fetchDetailReferences(kind: BusinessKind): Promise<ReferenceData> {
  switch (kind) {
    case 'category':
    case 'brand': {
      const categories = await fetchReferenceList(endpoints.songThanh.productCategories);
      return { categories, brands: [], productGroups: [], productVariants: [] };
    }
    case 'productGroup':
    case 'technicalDocument':
      return fetchListReferences(kind);
    case 'productVariant':
      return EMPTY_REFERENCE_DATA;
  }
}

export function BusinessDetailSkeleton({ withRail }: { withRail: boolean }) {
  return (
    <Card className="min-h-[560px] p-5">
      <div
        className={cn(
          'grid gap-5',
          withRail ? 'lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px]' : 'grid-cols-1'
        )}
      >
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, sectionIndex) => (
            <div key={sectionIndex} className="rounded-sm border border-border bg-panel p-4">
              <div className="h-4 w-36 rounded bg-border/60" />
              <div className="mt-2 h-3 w-64 rounded bg-border/50" />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {Array.from({ length: 4 }).map((__, fieldIndex) => (
                  <div key={fieldIndex} className="space-y-2">
                    <div className="h-3 w-24 rounded bg-border/50" />
                    <div className="h-10 w-full rounded bg-border/50" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {withRail ? (
          <div className="space-y-4">
            <div className="h-40 rounded bg-border/50" />
            <div className="h-48 rounded bg-border/50" />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function SectionCard({
  id,
  title,
  description,
  children
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="rounded-sm border border-border bg-panel p-4">
      <div className="mb-4 border-b border-border pb-3">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function DetailsCard({
  id,
  title,
  description,
  children,
  defaultOpen = false,
  dataAttrs
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  dataAttrs?: Record<string, string>;
}) {
  return (
    <details
      id={id}
      className="rounded-sm border border-border bg-panel"
      open={defaultOpen}
      {...dataAttrs}
    >
      <summary className="cursor-pointer list-none px-4 py-4">
        <div className="border-b border-border pb-3">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

export function CompactInfoCard({
  title,
  items,
  monoLabels = []
}: {
  title: string;
  items: Array<[string, unknown]>;
  monoLabels?: string[];
}) {
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-text">{title}</h2>
      <div className="mt-3 space-y-3 text-sm">
        {items.map(([label, value]) => (
          <div key={label}>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            <div
              className={cn(
                'mt-0.5 break-all text-slate-700',
                monoLabels.includes(label) ? 'font-mono text-[12px]' : ''
              )}
            >
              {formatValue(value)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function DependencyCard({ counts }: { counts: RecordMap }) {
  if (Object.keys(counts).length === 0) {
    return null;
  }

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-text">Liên quan dữ liệu</h2>
      <div className="mt-3 space-y-2">
        {Object.entries(counts).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{formatValue(key)}</span>
            <span className="font-medium text-text">{formatValue(value)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function formsEqual(left: Record<string, string>, right: Record<string, string>) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if ((left[key] ?? '') !== (right[key] ?? '')) {
      return false;
    }
  }
  return true;
}

export function hasAnyValue(form: Record<string, string>, keys: string[]) {
  return keys.some((key) => Boolean(form[key]?.trim()));
}
