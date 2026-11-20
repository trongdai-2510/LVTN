'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Newspaper } from '@/components/icons';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Field } from '@/components/form/Field';
import { ExtraBlocksCard } from './ExtraBlocksCard';
import { PageLayoutPanel } from './PageLayoutPanel';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { getTemplateBlocks, type PageContentTemplate } from './pageContentTemplates';
import {
  type EditorLayoutProps,
  BasicContentCard,
  BodyEditorCard,
  MediaCard,
  SeoCard,
  SourceMapCard
} from './PageEditorCards';
import {
  TemplateBlocksCard,
  ContactOperationsCard,
  ArticlePlanCard,
  usePublicPageSnapshot,
  buildLivePageLines
} from './pageEditorSnapshot';
import { type RecordMap, EDITOR_TARGET_EVENT, revealEditorTarget } from './pageEditorShared';
import { toDateTimeLocalValue } from './pageEditorHelpers';

export function SystemPageLayout(props: EditorLayoutProps) {
  if (props.template.mode === 'contact') {
    return <ContactPageLayout {...props} />;
  }
  if (props.template.mode === 'brands') {
    return <BrandsPageLayout {...props} />;
  }
  if (
    props.template.mode === 'products' ||
    props.template.mode === 'capability_profile' ||
    props.template.mode === 'news_index'
  ) {
    return <AdminManagedLandingPageLayout {...props} />;
  }
  if (props.template.mode === 'services' || props.template.mode === 'projects') {
    return <ModuleIntroPageLayout {...props} />;
  }
  if (props.template.mode === 'about') {
    return <AboutPageLayout {...props} />;
  }
  return <GenericPageLayout {...props} />;
}

function AboutPageLayout(props: EditorLayoutProps) {
  return (
    <PageStudioWorkspace props={props} aside={<TemplateBlocksCard template={props.template} />}>
      <div className="space-y-4">
        <BasicContentCard {...props} />
        <BodyEditorCard {...props} minHeight={240} />
        <MediaCard {...props} />
        <ExtraBlocksCard
          value={props.form.extra_blocks ?? ''}
          onChange={(next) => props.onFieldChange('extra_blocks', next)}
          readOnly={props.readOnly}
          error={props.fieldErrors.extra_blocks}
        />
        <SeoCard {...props} />
      </div>
    </PageStudioWorkspace>
  );
}

function AdminManagedLandingPageLayout(props: EditorLayoutProps) {
  return (
    <PageStudioWorkspace props={props} aside={<TemplateBlocksCard template={props.template} />}>
      <div className="space-y-4">
        <BasicContentCard {...props} />
        <BodyEditorCard {...props} minHeight={260} />
        <MediaCard {...props} />
        <ExtraBlocksCard
          value={props.form.extra_blocks ?? ''}
          onChange={(next) => props.onFieldChange('extra_blocks', next)}
          readOnly={props.readOnly}
          error={props.fieldErrors.extra_blocks}
        />
        <SeoCard {...props} />
      </div>
    </PageStudioWorkspace>
  );
}

function ModuleIntroPageLayout(props: EditorLayoutProps) {
  return (
    <PageStudioWorkspace props={props} aside={<TemplateBlocksCard template={props.template} />}>
      <div className="space-y-4">
        <BasicContentCard {...props} />
        <BodyEditorCard {...props} minHeight={200} />
        <MediaCard {...props} />
        <ExtraBlocksCard
          value={props.form.extra_blocks ?? ''}
          onChange={(next) => props.onFieldChange('extra_blocks', next)}
          readOnly={props.readOnly}
          error={props.fieldErrors.extra_blocks}
        />
        <SeoCard {...props} />
      </div>
    </PageStudioWorkspace>
  );
}

function BrandsPageLayout(props: EditorLayoutProps) {
  return (
    <PageStudioWorkspace props={props} aside={<TemplateBlocksCard template={props.template} />}>
      <div className="space-y-4">
        <BasicContentCard {...props} />
        <BodyEditorCard {...props} minHeight={220} />
        <MediaCard {...props} />
        <ExtraBlocksCard
          value={props.form.extra_blocks ?? ''}
          onChange={(next) => props.onFieldChange('extra_blocks', next)}
          readOnly={props.readOnly}
          error={props.fieldErrors.extra_blocks}
        />
        <SeoCard {...props} />
      </div>
    </PageStudioWorkspace>
  );
}

function ContactPageLayout(props: EditorLayoutProps) {
  return (
    <PageStudioWorkspace props={props}>
      <div className="space-y-4">
        <BasicContentCard {...props} />
        <BodyEditorCard {...props} minHeight={220} />
        <MediaCard {...props} />
        <ContactOperationsCard />
        <SeoCard {...props} />
      </div>
    </PageStudioWorkspace>
  );
}

function GenericPageLayout(props: EditorLayoutProps) {
  return (
    <PageStudioWorkspace props={props}>
      <div className="space-y-4">
        <BasicContentCard {...props} />
        <BodyEditorCard {...props} minHeight={300} />
        <MediaCard {...props} />
        <SeoCard {...props} />
      </div>
    </PageStudioWorkspace>
  );
}

export function NewsEditorLayout(props: EditorLayoutProps) {
  return (
    <PageStudioWorkspace props={props} aside={<ArticlePlanCard />}>
      <div className="space-y-4">
        <BasicContentCard {...props} />
        <NewsMetaCard {...props} />
        <BodyEditorCard {...props} minHeight={460} />
        <MediaCard {...props} />
        <SeoCard {...props} />
      </div>
    </PageStudioWorkspace>
  );
}

type NewsCategoryOption = {
  id: string;
  name: string;
  slug: string;
};

function NewsMetaCard({ form, readOnly, onFieldChange }: EditorLayoutProps) {
  const [categories, setCategories] = useState<NewsCategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const result = await apiClient.get<unknown>(endpoints.songThanh.newsCategories);
        if (!active) return;
        const items = Array.isArray((result as RecordMap)?.items)
          ? ((result as RecordMap).items as RecordMap[])
          : [];
        setCategories(
          items
            .map((item) => ({
              id: String(item.id ?? ''),
              name: String(item.name ?? ''),
              slug: String(item.slug ?? '')
            }))
            .filter((item) => item.id && item.name)
        );
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Không tải được chuyên mục tin tức.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card className="overflow-hidden" data-editor-section="true" id="page-section-news-meta">
      <div className="admin-card-header">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-text">Thông tin tin tức</h2>
        </div>
      </div>
      <div className="admin-card-body admin-form-stack">
        {error ? (
          <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {error}
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Chuyên mục" htmlFor="page-content-news-category">
            <Select
              id="page-content-news-category"
              value={form.news_category_id ?? ''}
              disabled={readOnly || loading}
              onChange={(event) => onFieldChange('news_category_id', event.target.value)}
            >
              <option value="">{loading ? 'Đang tải chuyên mục' : 'Không chọn chuyên mục'}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ngày đăng" htmlFor="page-content-published-at">
            <Input
              id="page-content-published-at"
              type="datetime-local"
              value={toDateTimeLocalValue(form.published_at)}
              readOnly={readOnly}
              onChange={(event) => onFieldChange('published_at', event.target.value)}
            />
          </Field>
          <Field label="Bài nổi bật">
            <Select
              value={(form.is_featured ?? '') === 'true' ? 'true' : 'false'}
              disabled={readOnly}
              onChange={(event) => onFieldChange('is_featured', event.target.value)}
            >
              <option value="false">Không nổi bật</option>
              <option value="true">Hiện đầu danh sách</option>
            </Select>
          </Field>
        </div>
      </div>
    </Card>
  );
}

function PageStudioWorkspace({
  props,
  aside,
  children
}: {
  props: EditorLayoutProps;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="mx-auto w-full max-w-[1180px] space-y-4"
      data-page-studio-workspace="single-column"
    >
      <RelatedModulesBar template={props.template} />
      <div className="page-studio-fields min-w-0">
        <div className="space-y-4">
          <PageLayoutPanel
            onChange={(next) => props.onFieldChange('extra_blocks', next)}
            readOnly={props.readOnly}
            template={props.template}
            value={props.form.extra_blocks ?? ''}
          />
          {children}
        </div>
      </div>
      <div className="space-y-4" data-page-supporting-information="true">
        <Card className="divide-y divide-border overflow-hidden">
          <SourceMapCard template={props.template} />
          <LivePageDataCard template={props.template} />
        </Card>
        {aside}
      </div>
    </div>
  );
}

export function EditorSectionNav({ template }: { template: PageContentTemplate }) {
  const supportsPageLayout = getTemplateBlocks(template).length > 0;
  const supportsExtraBlocks = [
    'about',
    'products',
    'capability_profile',
    'news_index',
    'services',
    'projects',
    'brands'
  ].includes(template.mode);
  const links = [
    ...(supportsPageLayout
      ? [{ href: '#page-section-layout', label: 'Bố cục hiển thị' }]
      : []),
    { href: '#page-section-basic', label: 'Thông tin trang' },
    { href: '#page-section-body', label: template.bodyLabel },
    { href: '#page-section-media', label: template.imageLabel },
    ...(supportsExtraBlocks
      ? [{ href: '#page-section-blocks', label: 'Khối nội dung phụ' }]
      : []),
    { href: '#page-section-seo', label: 'SEO & chia sẻ' }
  ];
  const [activeHref, setActiveHref] = useState(links[0]?.href ?? '#page-section-basic');
  const linkKey = links.map((link) => link.href).join('|');

  useEffect(() => {
    const linkTargets = links
      .map((link) => document.querySelector<HTMLElement>(link.href))
      .filter((item): item is HTMLElement => Boolean(item));
    const setFromTarget = (target: string) => {
      const direct = links.find((link) => link.href === target);
      if (direct) {
        setActiveHref(direct.href);
        return;
      }
      const element = document.querySelector<HTMLElement>(target);
      const section = element?.closest<HTMLElement>('[data-editor-section]');
      if (section?.id) setActiveHref(`#${section.id}`);
    };
    const onTarget = (event: Event) => {
      const target = (event as CustomEvent<{ target?: string }>).detail?.target;
      if (target) setFromTarget(target);
    };
    window.addEventListener(EDITOR_TARGET_EVENT, onTarget);
    let frame = 0;
    const updateFromScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const activationLine = Math.min(360, window.innerHeight * 0.45);
        const passed = linkTargets.filter(
          (target) => target.getBoundingClientRect().top <= activationLine
        );
        const current =
          passed.at(-1) ??
          linkTargets.find((target) => target.getBoundingClientRect().bottom > activationLine) ??
          linkTargets[0];
        if (current?.id) setActiveHref(`#${current.id}`);
      });
    };
    updateFromScroll();
    window.addEventListener('scroll', updateFromScroll, { passive: true });
    window.addEventListener('resize', updateFromScroll);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(EDITOR_TARGET_EVENT, onTarget);
      window.removeEventListener('scroll', updateFromScroll);
      window.removeEventListener('resize', updateFromScroll);
    };
  }, [linkKey]);

  return (
    <nav
      aria-label="Mục lục biên tập trang"
      className="sticky top-[calc(var(--topbar-height)+8px)] z-20 mt-2 rounded-xl border border-border bg-panel px-2 shadow-[0_4px_14px_rgb(16_35_55_/_0.04)] lg:static lg:mt-0"
      data-page-editor-sections="true"
    >
      <div className="flex gap-1 overflow-x-auto">
        {links.map((link) => (
          <a
            aria-current={activeHref === link.href ? 'location' : undefined}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
              activeHref === link.href
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-600 hover:border-slate-200 hover:text-primary'
            )}
            href={link.href}
            key={link.href}
            onClick={(event) => {
              event.preventDefault();
              setActiveHref(link.href);
              revealEditorTarget(link.href);
            }}
          >
            <span>{link.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}

function RelatedModulesBar({ template }: { template: PageContentTemplate }) {
  const relatedModules = template.relatedModules;

  if (relatedModules.length === 0) return null;

  return (
    <nav
      aria-label="Dữ liệu liên quan"
      className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-panel px-4 py-3"
    >
      <span className="mr-1 text-sm font-semibold text-text">Chỉnh dữ liệu liên quan:</span>
      {relatedModules.map((module) => (
        <Link
          key={`${module.href}-${module.label}`}
          href={module.href}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-sm border border-border bg-surface px-3 text-sm font-semibold text-primary transition hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          {module.label}
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      ))}
    </nav>
  );
}

function LivePageDataCard({ template }: { template: PageContentTemplate }) {
  const [open, setOpen] = useState(false);
  const snapshot = usePublicPageSnapshot(open);
  const lines = buildLivePageLines(template, snapshot);

  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        className="admin-card-header flex w-full items-center justify-between text-left hover:bg-muted/80"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-semibold text-text">Đang hiện ngoài website</span>
        <span className="text-xs text-muted-foreground">{open ? 'Thu gọn' : 'Kiểm tra'}</span>
      </button>
      {open ? (
      <div className="space-y-2 border-t border-border p-4">
        {snapshot.loading ? (
          <div className="text-sm text-muted-foreground">Đang lấy dữ liệu đang hiển thị...</div>
        ) : snapshot.error ? (
          <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Không tải được dữ liệu đang hiển thị trên website.
          </div>
        ) : (
          lines.map((line) => (
            <div key={line.label} className="flex items-start justify-between gap-3 rounded-sm border border-border bg-muted px-3 py-2">
              <span className="text-sm text-muted-foreground">{line.label}</span>
              <span className="text-right text-sm font-semibold text-text">{line.value}</span>
            </div>
          ))
        )}
      </div>
      ) : null}
    </section>
  );
}
