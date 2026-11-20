'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  ExternalLink,
  PanelsTopLeft,
  RotateCcw
} from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

import type { PageContentTemplate, PageTemplateBlock } from './pageContentTemplates';
import { getTemplateBlocks } from './pageContentTemplates';
import {
  findTemplateBlock,
  resolvePageLayout,
  serializePageLayout,
  type PageLayoutSection
} from './pageLayout';

type PageLayoutPanelProps = {
  template: PageContentTemplate;
  value: string;
  onChange: (next: string) => void;
  readOnly: boolean;
};

const PAGE_IDENTITIES: Partial<
  Record<PageContentTemplate['mode'], { label: string }>
> = {
  about: { label: 'Hồ sơ doanh nghiệp' },
  products: { label: 'Catalog kỹ thuật' },
  capability_profile: { label: 'Tài liệu năng lực' },
  services: { label: 'Nhu cầu đến giải pháp' },
  projects: { label: 'Bằng chứng công trình' },
  brands: { label: 'Danh bạ kỹ thuật' },
  news_index: { label: 'Tòa soạn kỹ thuật' },
  contact: { label: 'Bàn tiếp nhận' }
};

export function PageLayoutPanel({ template, value, onChange, readOnly }: PageLayoutPanelProps) {
  const sections = resolvePageLayout(template, value);
  const [recentlyMovedId, setRecentlyMovedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (!recentlyMovedId && !announcement) return;
    const timeout = window.setTimeout(() => {
      setRecentlyMovedId(null);
      setAnnouncement('');
    }, 2400);
    return () => window.clearTimeout(timeout);
  }, [announcement, recentlyMovedId]);

  if (sections.length === 0) return null;

  const identity = PAGE_IDENTITIES[template.mode];
  const visibleCount = sections.filter((section) => section.visible).length;

  function commit(next: PageLayoutSection[]) {
    onChange(serializePageLayout(value, next));
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    const movedSection = sections[index];
    const movedBlock = findTemplateBlock(template, movedSection.id);
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
    setRecentlyMovedId(movedSection.id);
    setAnnouncement(
      `Đã chuyển ${movedBlock?.title ?? 'khu vực'} ${delta < 0 ? 'lên' : 'xuống'} vị trí ${target + 1}`
    );
  }

  function toggle(sectionId: string) {
    const target = sections.find((section) => section.id === sectionId);
    const block = findTemplateBlock(template, sectionId);
    if (!target || block?.required || (target.visible && visibleCount === 1)) return;
    commit(
      sections.map((section) =>
        section.id === sectionId ? { ...section, visible: !section.visible } : section
      )
    );
  }

  function reset() {
    commit(getTemplateBlocks(template).map((block) => ({ id: block.id, visible: true })));
    setRecentlyMovedId(null);
    setAnnouncement('Đã khôi phục thứ tự và trạng thái hiển thị mặc định');
  }

  return (
    <Card
      className="scroll-mt-56 overflow-hidden"
      data-editor-section="true"
      id="page-section-layout"
    >
      <header className="flex flex-col gap-3 border-b border-border bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PanelsTopLeft className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-text">Bố cục hiển thị</h2>
            <Badge tone="info">{identity?.label ?? template.shortLabel}</Badge>
          </div>
          <p aria-live="polite" className="mt-1 min-h-5 text-sm font-medium text-slate-700" role="status">
            {announcement || `${visibleCount}/${sections.length} khu vực đang hiển thị`}
          </p>
        </div>
        <Button
          className="self-start"
          disabled={readOnly}
          onClick={reset}
          size="sm"
          type="button"
          variant="secondary"
        >
          <RotateCcw className="h-4 w-4" />
          Khôi phục mặc định
        </Button>
      </header>

      <ol className="divide-y divide-border" aria-label={`Thứ tự bố cục ${template.shortLabel}`}>
        {sections.map((section, index) => {
          const block = findTemplateBlock(template, section.id);
          if (!block) return null;
          const cannotHide = section.visible && visibleCount === 1;
          const visibilityLocked = Boolean(block.required);
          return (
            <li
              className={cn(
                'grid gap-3 px-5 py-4 transition-[background-color,box-shadow] duration-300 md:grid-cols-[40px_minmax(0,1fr)_auto] md:items-center',
                section.visible ? 'bg-panel' : 'bg-muted/45',
                recentlyMovedId === section.id
                  ? 'relative z-[1] bg-blue-50 shadow-[inset_4px_0_0_var(--primary),inset_0_0_0_1px_rgb(20_95_159_/_0.22)]'
                  : ''
              )}
              data-page-layout-section={section.id}
              data-recently-moved={recentlyMovedId === section.id ? 'true' : undefined}
              key={section.id}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-slate-100 font-mono text-xs font-semibold text-slate-600">
                {String(index + 1).padStart(2, '0')}
              </span>

              <div className="min-w-0 py-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('text-sm font-semibold', section.visible ? 'text-text' : 'text-muted-foreground')}>
                    {block.title}
                  </span>
                  <OwnerBadge block={block} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className={section.visible ? 'text-success' : 'text-muted-foreground'}>
                    {block.required ? 'Luôn hiển thị' : section.visible ? 'Đang hiển thị' : 'Đang ẩn'}
                  </span>
                {block.href ? (
                  <Link
                    className="inline-flex min-h-11 items-center gap-1 rounded-sm px-1 font-semibold text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    href={block.href}
                  >
                    Sửa dữ liệu
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
                <Button
                  aria-label={`Đưa ${block.title} lên trên`}
                  className="px-2.5"
                  disabled={readOnly || index === 0}
                  onClick={() => move(index, -1)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <ArrowUp className="h-4 w-4" />
                  Lên
                </Button>
                <Button
                  aria-label={`Đưa ${block.title} xuống dưới`}
                  className="px-2.5"
                  disabled={readOnly || index === sections.length - 1}
                  onClick={() => move(index, 1)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <ArrowDown className="h-4 w-4" />
                  Xuống
                </Button>
                <Button
                  aria-pressed={section.visible}
                  className="min-w-[104px]"
                  disabled={readOnly || cannotHide || visibilityLocked}
                  onClick={() => toggle(section.id)}
                  size="sm"
                  title={
                    visibilityLocked
                      ? 'Khu vực nền trang được giữ để bảo đảm nhận diện, tiêu đề và khả năng truy cập.'
                      : cannotHide
                        ? 'Trang phải giữ ít nhất một khu vực hiển thị.'
                        : undefined
                  }
                  type="button"
                  variant={section.visible ? 'secondary' : 'ghost'}
                >
                  {section.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  {section.visible ? 'Đang hiện' : 'Đang ẩn'}
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function OwnerBadge({ block }: { block: PageTemplateBlock }) {
  const tone =
    block.owner === 'this_page'
      ? 'active'
      : block.owner === 'module'
        ? 'info'
        : block.owner === 'settings'
          ? 'warning'
          : 'default';
  return <Badge tone={tone}>{block.ownerLabel}</Badge>;
}
