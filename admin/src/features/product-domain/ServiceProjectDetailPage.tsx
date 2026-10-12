'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, Image as ImageIcon, Plus, Save, Trash2 } from '@/components/icons';
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Package,
  Search
} from '@/components/icons';

import { RichTextEditor } from '@/components/RichTextEditor';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { Field } from '@/components/form/Field';
import { FileReferencePicker, RelationActionPicker } from '@/components/form/ReferencePickers';
import { UnsavedChangesGuard } from '@/components/form/UnsavedChangesGuard';
import { AdminFileThumbnail } from '@/features/website-content/AdminFileThumbnail';
import { ProjectGalleryCard } from './ProjectGalleryCard';
import { apiClient } from '@/lib/api-client';
import { byId, endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { formatDate, formatValue } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { authStore } from '@/features/auth/auth.store';
import type { AuthState } from '@/features/auth/auth.types';

type DomainKind = 'service' | 'project';
type Visibility = 'draft' | 'published' | 'hidden';

const isNew = (id: string) => id === 'new';

const PUBLIC_SITE_BASE_URL =
  process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000';

const SERVICE_ICON_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Không chọn' },
  { value: 'consultation', label: 'Tư vấn' },
  { value: 'design', label: 'Thiết kế' },
  { value: 'maintenance', label: 'Bảo trì' },
  { value: 'training', label: 'Đào tạo' },
  { value: 'audit', label: 'Khảo sát / Audit' },
  { value: 'supply', label: 'Cung cấp vật tư' },
  { value: 'integration', label: 'Tích hợp hệ thống' },
  { value: 'commissioning', label: 'Chạy thử / Commissioning' },
  { value: 'troubleshooting', label: 'Khắc phục sự cố' },
  { value: 'custom', label: 'Khác' }
];

type Form = {
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  content_html: string;
  when_to_contact: string;
  deliverables: string[];
  typical_duration: string;
  sort_order: string;
  icon_key: string;
  image_file_id: string;
  review_status: string;
  publish_status: string;
  seo_title: string;
  seo_description: string;
  seo_og_image_file_id: string;
  client_name: string;
  location: string;
  project_year: string;
};

type RecordMeta = {
  created_at: string;
  updated_at: string;
};

type ServiceQualityCheck = {
  label: string;
  ok: boolean;
};

const kindConfig = {
  service: {
    label: 'Dịch vụ',
    singular: 'dịch vụ',
    endpoint: endpoints.songThanh.services,
    listPath: '/services',
    publicPrefix: '/dich-vu/',
    createPerm: PERMISSIONS.serviceCreate,
    updatePerm: PERMISSIONS.serviceUpdate
  },
  project: {
    label: 'Dự án',
    singular: 'dự án',
    endpoint: endpoints.songThanh.projects,
    listPath: '/projects',
    publicPrefix: '/du-an/',
    createPerm: PERMISSIONS.projectCreate,
    updatePerm: PERMISSIONS.projectUpdate
  }
} as const;

function emptyForm(): Form {
  return {
    title: '',
    slug: '',
    subtitle: '',
    description: '',
    content_html: '',
    when_to_contact: '',
    deliverables: [],
    typical_duration: '',
    sort_order: '1000',
    icon_key: '',
    image_file_id: '',
    review_status: 'draft',
    publish_status: 'unpublished',
    seo_title: '',
    seo_description: '',
    seo_og_image_file_id: '',
    client_name: '',
    location: '',
    project_year: ''
  };
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function extractDomainRecord(kind: DomainKind, data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }

  const record = data as Record<string, unknown>;
  const direct = record[kind];
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    return direct as Record<string, unknown>;
  }

  for (const key of ['item', 'record', 'data']) {
    const value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  return record;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function visibilityFromForm(form: Form): Visibility {
  if (form.review_status === 'approved' && form.publish_status === 'published') {
    return 'published';
  }

  if (form.review_status === 'draft') {
    return 'draft';
  }

  return 'hidden';
}

function applyVisibility(form: Form, visibility: Visibility): Form {
  if (visibility === 'published') {
    return { ...form, review_status: 'approved', publish_status: 'published' };
  }

  if (visibility === 'hidden') {
    return { ...form, review_status: 'approved', publish_status: 'unpublished' };
  }

  return { ...form, review_status: 'draft', publish_status: 'unpublished' };
}

function deliverablesFromRecord(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter((item) => item.length > 0);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item ?? '').trim()).filter((item) => item.length > 0);
    } catch {
      // ignore
    }
  }
  return [];
}

function formFromRecord(record: Record<string, unknown>): Form {
  const sortOrderRaw = record.sort_order;
  const sortOrderStr =
    typeof sortOrderRaw === 'number'
      ? String(sortOrderRaw)
      : typeof sortOrderRaw === 'string' && sortOrderRaw.trim()
        ? sortOrderRaw.trim()
        : '1000';
  return {
    title: textValue(record.title),
    slug: textValue(record.slug),
    subtitle: textValue(record.subtitle),
    description: textValue(record.description),
    content_html: textValue(record.content_html),
    when_to_contact: textValue(record.when_to_contact),
    deliverables: deliverablesFromRecord(record.deliverables),
    typical_duration: textValue(record.typical_duration),
    sort_order: sortOrderStr,
    icon_key: textValue(record.icon_key),
    image_file_id: textValue(record.image_file_id),
    review_status: textValue(record.review_status) || 'draft',
    publish_status: textValue(record.publish_status) || 'unpublished',
    seo_title: textValue(record.seo_title),
    seo_description: textValue(record.seo_description),
    seo_og_image_file_id: textValue(record.seo_og_image_file_id),
    client_name: textValue(record.client_name),
    location: textValue(record.location),
    project_year: textValue(record.project_year)
  };
}

function metaFromRecord(record: Record<string, unknown>): RecordMeta {
  return {
    created_at: textValue(record.created_at),
    updated_at: textValue(record.updated_at)
  };
}

function buildPayload(kind: DomainKind, form: Form, canPrivilegedWorkflow = true) {
  const payload: Record<string, unknown> = {
    title: form.title.trim(),
    slug: form.slug.trim(),
    description: form.description.trim() || null,
    content_html: form.content_html || null,
    image_file_id: form.image_file_id || null,
    ...(canPrivilegedWorkflow ? {
      review_status: form.review_status,
      publish_status: form.publish_status
    } : {}),
    seo_title: form.seo_title.trim() || null,
    seo_description: form.seo_description.trim() || null,
    seo_og_image_file_id: form.seo_og_image_file_id || null
  };

  if ((kind as string) === 'service') {
    const sortOrderNumber = Number(form.sort_order);
    payload.subtitle = form.subtitle.trim() || null;
    payload.when_to_contact = form.when_to_contact.trim() || null;
    payload.deliverables = form.deliverables.map((item) => item.trim()).filter((item) => item.length > 0);
    payload.typical_duration = form.typical_duration.trim() || null;
    payload.sort_order = Number.isFinite(sortOrderNumber) ? Math.max(0, Math.trunc(sortOrderNumber)) : 1000;
    payload.icon_key = form.icon_key || null;
    return payload;
  }

  if (kind === 'project') {
    return {
      ...payload,
      client_name: form.client_name.trim() || null,
      location: form.location.trim() || null,
      project_year: form.project_year.trim() ? Number(form.project_year) : null
    };
  }

  return payload;
}

function validateProjectYear(value: string): string {
  const normalized = value.trim();
  if (!normalized) return '';

  const year = Number(normalized);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return 'Năm không hợp lệ (1900–2100)';
  }

  return '';
}

function stripHtmlText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function servicePublicQualityChecks(form: Form, activeRelatedProducts: number): ServiceQualityCheck[] {
  const descriptionLength = form.description.trim().length;
  const contentLength = stripHtmlText(form.content_html).length;
  const deliverableCount = form.deliverables.filter((item) => item.trim().length > 0).length;

  return [
    { label: 'Có tagline ngắn cho phần đầu trang', ok: form.subtitle.trim().length > 0 },
    { label: 'Mô tả ngắn đủ rõ cho khách mới', ok: descriptionLength >= 80 },
    { label: 'Có tình huống khách nên liên hệ', ok: form.when_to_contact.trim().length > 0 },
    { label: 'Có ít nhất 3 kết quả khách nhận được', ok: deliverableCount >= 3 },
    { label: 'Có thời gian phản hồi tham khảo', ok: form.typical_duration.trim().length > 0 },
    { label: 'Có ảnh đại diện riêng cho dịch vụ', ok: form.image_file_id.trim().length > 0 },
    { label: 'Có sản phẩm liên quan để khách tham khảo', ok: activeRelatedProducts > 0 },
    { label: 'Có nội dung chi tiết để đọc tiếp', ok: contentLength >= 120 }
  ];
}

export function ServiceProjectDetailPage({ kind, id }: { kind: DomainKind; id: string }) {
  const router = useRouter();
  const cfg = kindConfig[kind];
  const [authState, setAuthState] = useState<AuthState>(() => authStore.getState());
  const [form, setForm] = useState<Form>(emptyForm());
  const [initialForm, setInitialForm] = useState<Form>(emptyForm());
  const [detailRecord, setDetailRecord] = useState<Record<string, unknown> | null>(null);
  const [recordMeta, setRecordMeta] = useState<RecordMeta | null>(null);
  const [loading, setLoading] = useState(!isNew(id));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [slugAutoGen, setSlugAutoGen] = useState(isNew(id));
  const [seoOpen, setSeoOpen] = useState(false);
  const [yearError, setYearError] = useState('');

  const canCreate = authState.permissions.includes(cfg.createPerm);
  const canUpdate = authState.permissions.includes(cfg.updatePerm);
  const canUpdateServiceProducts = authState.permissions.includes(PERMISSIONS.serviceProductGroupUpdate);
  const canUpdateProjectProducts = authState.permissions.includes(PERMISSIONS.projectProductGroupUpdate);
  const canUpdateRelatedProducts = kind === 'service' ? canUpdateServiceProducts : canUpdateProjectProducts;
  const canReadProjectGallery = authState.permissions.includes(PERMISSIONS.projectGalleryRead);
  const canCreateProjectGallery = authState.permissions.includes(PERMISSIONS.projectGalleryCreate);
  const canUpdateProjectGallery = authState.permissions.includes(PERMISSIONS.projectGalleryUpdate);
  const canArchiveProjectGallery = authState.permissions.includes(PERMISSIONS.projectGalleryArchive);
  const canRestoreProjectGallery = authState.permissions.includes(PERMISSIONS.projectGalleryRestore);
  const canSave = isNew(id) ? canCreate : canUpdate;
  const canPrivilegedWorkflow = authState.roles.includes('super_admin');
  const dirty = (Object.keys(form) as (keyof Form)[]).some(
    (key) => JSON.stringify(form[key]) !== JSON.stringify(initialForm[key])
  );
  const visibility = visibilityFromForm(form);
  const pageTitle = isNew(id)
    ? `Tạo ${cfg.singular} mới`
    : formatValue(form.title || `Chỉnh sửa ${cfg.singular}`);
  const serviceRelatedGroups = kind === 'service' ? relatedProductGroupsFromDetail(detailRecord) : [];
  const serviceActiveRelatedCount = kind === 'service' ? activeRelatedCount(serviceRelatedGroups) : 0;
  const serviceQualityChecks =
    kind === 'service' ? servicePublicQualityChecks(form, serviceActiveRelatedCount) : [];
  const previewFile = useMemo(
    () =>
      form.image_file_id
        ? {
            id: form.image_file_id,
            original_filename: form.title || 'Ảnh đại diện',
            mime_type: 'image/'
          }
        : null,
    [form.image_file_id, form.title]
  );

  useEffect(() => {
    setAuthState(authStore.hydrate());
    return authStore.subscribe(setAuthState);
  }, []);

  useEffect(() => {
    if (isNew(id)) return;

    let active = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const result = await apiClient.get<unknown>(byId(cfg.endpoint, id));
        if (!active) return;

        const record = extractDomainRecord(kind, result);
        const next = formFromRecord(record);
        setDetailRecord(asRecord(result));
        setForm(next);
        setInitialForm(next);
        setRecordMeta(metaFromRecord(record));
        setSlugAutoGen(false);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : `Không tải được ${cfg.singular}.`);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [cfg.endpoint, cfg.singular, id, kind]);

  function updateField<K extends keyof Form>(key: K, value: Form[K]) {
    setSaveMessage('');
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'title' && slugAutoGen) {
        next.slug = toSlug(String(value));
      }
      return next;
    });
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;

    const nextYearError = kind === 'project' ? validateProjectYear(form.project_year) : '';
    setYearError(nextYearError);
    if (nextYearError) return;

    if (!form.title.trim()) {
      setSaveError('Vui lòng nhập tiêu đề.');
      return;
    }

    setSaving(true);
    setSaveError('');
    setSaveMessage('');

    try {
      const payload = buildPayload(kind, form, canPrivilegedWorkflow);
      const result = isNew(id)
        ? await apiClient.post<unknown>(cfg.endpoint, payload)
        : await apiClient.put<unknown>(byId(cfg.endpoint, id), payload);
      const record = extractDomainRecord(kind, result);
      const next = formFromRecord(record);
      setDetailRecord(asRecord(result));

      if (isNew(id)) {
        const newId = textValue(record.id);
        router.push(newId ? `${cfg.listPath}/${newId}` : cfg.listPath);
        return;
      }

      setForm(next);
      setInitialForm(next);
      setRecordMeta(metaFromRecord(record));
      setSaveMessage(!canPrivilegedWorkflow && next.review_status === 'pending_review'
        ? 'Đã lưu. Nội dung đang chờ Super Admin duyệt và tạm ẩn khỏi website.'
        : 'Đã lưu thay đổi.');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Không lưu được.');
    } finally {
      setSaving(false);
    }
  }

  async function reloadRelatedProducts() {
    if (isNew(id)) return;
    try {
      const result = await apiClient.get<unknown>(byId(cfg.endpoint, id));
      const record = extractDomainRecord(kind, result);
      const next = formFromRecord(record);
      setDetailRecord(asRecord(result));
      setRecordMeta(metaFromRecord(record));
      setForm((current) => ({ ...current, review_status: next.review_status, publish_status: next.publish_status }));
      setInitialForm((current) => ({ ...current, review_status: next.review_status, publish_status: next.publish_status }));
    } catch {
      setSaveError('Thay đổi đã lưu nhưng chưa tải lại được trạng thái hiển thị. Hãy tải lại trang trước khi chỉnh sửa tiếp.');
    }
  }

  if (loading) return <DetailSkeleton />;
  if (error) return <ErrorState message={error} />;

  if (kind === 'service') {
    return (
      <section className="admin-page">
        <UnsavedChangesGuard when={dirty} />
        <form
          onSubmit={handleSave}
          className="space-y-5"
          data-domain-editor="true"
          data-domain-kind="service"
          data-domain-editor-layout="single-column"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="mb-1 text-xs text-muted-foreground">
                Tổng quan / {cfg.label} / {isNew(id) ? 'Tạo mới' : pageTitle}
              </p>
              <h1 className="text-xl font-semibold text-text">{pageTitle}</h1>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <LinkButton href={cfg.listPath} variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
                Quay lại
              </LinkButton>
            </div>
          </div>

          <DomainEditorCommandBar
            visibility={visibility}
            canPrivilegedWorkflow={canPrivilegedWorkflow}
            onVisibilityChange={(nextVisibility) =>
              setForm((current) => applyVisibility(current, nextVisibility))
            }
            canSave={canSave}
            saving={saving}
            dirty={dirty}
            recordMeta={recordMeta}
            publicHref={
              !isNew(id) && form.slug
                ? `${PUBLIC_SITE_BASE_URL}${cfg.publicPrefix}${form.slug}`
                : ''
            }
            saveLabel="Lưu dịch vụ"
          />

          <ServiceReadinessStrip checks={serviceQualityChecks} />

          <div className="space-y-4">
            <div className="space-y-4">
              <Card>
                <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Thông tin cơ bản</span>
                </div>
                <div className="space-y-4 p-4">
                  <Field label="Tên dịch vụ" required htmlFor="service-title">
                    <Input
                      id="service-title"
                      value={form.title}
                      onChange={(event) => updateField('title', event.target.value)}
                      placeholder="Tư vấn chọn thiết bị điện công nghiệp"
                      readOnly={!canSave}
                      required
                    />
                  </Field>

                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_14rem]">
                    <Field label="Đường dẫn website" htmlFor="slug">
                      <div className="flex h-10 overflow-hidden rounded-md border border-border bg-panel focus-within:border-primary">
                        <span className="flex shrink-0 items-center border-r border-border bg-slate-50 px-3 font-mono text-[13px] text-muted-foreground">
                          {cfg.publicPrefix}
                        </span>
                        <input
                          id="slug"
                          value={form.slug}
                          onChange={(event) => {
                            setSlugAutoGen(false);
                            updateField('slug', event.target.value);
                          }}
                          placeholder="tu-van-thiet-ke"
                          className="min-w-0 flex-1 bg-transparent px-3 font-mono text-sm outline-none"
                          readOnly={!canSave}
                        />
                      </div>
                    </Field>

                    <Field label="Thứ tự hiển thị" htmlFor="service-sort-order">
                      <Input
                        id="service-sort-order"
                        type="number"
                        min={0}
                        step={1}
                        value={form.sort_order}
                        onChange={(event) =>
                          updateField('sort_order', event.target.value.replace(/[^\d]/g, '').slice(0, 4) || '0')
                        }
                        readOnly={!canSave}
                      />
                    </Field>

                    <Field label="Biểu tượng thẻ" htmlFor="service-icon-key">
                      <select
                        id="service-icon-key"
                        value={form.icon_key}
                        onChange={(event) => updateField('icon_key', event.target.value)}
                        disabled={!canSave}
                        className="h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:border-primary"
                      >
                        {SERVICE_ICON_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="border-b border-border px-4 py-2.5">
                  <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Khách hàng cần biết
                  </span>
                </div>
                <div className="space-y-4 p-4">
                  <Field label="Dòng giới thiệu" htmlFor="service-subtitle">
                    <Input
                      id="service-subtitle"
                      value={form.subtitle}
                      maxLength={220}
                      onChange={(event) => updateField('subtitle', event.target.value)}
                      placeholder="Một dòng tóm tắt cốt lõi của dịch vụ..."
                      readOnly={!canSave}
                    />
                  </Field>
                  <Field label="Tóm tắt trên danh sách" htmlFor="service-description">
                    <Textarea
                      id="service-description"
                      value={form.description}
                      onChange={(event) => updateField('description', event.target.value)}
                      placeholder="Mô tả ngắn 2–3 câu cho khách hiểu phạm vi và đối tượng dịch vụ..."
                      className="min-h-[80px]"
                      readOnly={!canSave}
                    />
                  </Field>
                  <Field label="Khi nào nên liên hệ" htmlFor="service-when">
                    <Textarea
                      id="service-when"
                      value={form.when_to_contact}
                      onChange={(event) => updateField('when_to_contact', event.target.value)}
                      placeholder="Liệt kê 2–3 tình huống khách nên chọn dịch vụ này..."
                      className="min-h-[80px]"
                      readOnly={!canSave}
                    />
                  </Field>
                </div>
              </Card>

              <Card>
                <div className="border-b border-border px-4 py-2.5">
                  <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    Kết quả &amp; Thời gian
                  </span>
                </div>
                <div className="space-y-4 p-4">
                  <Field label="Kết quả khách hàng nhận được">
                    <div className="space-y-2">
                      {form.deliverables.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Chưa có mục nào.</p>
                      ) : (
                        form.deliverables.map((item, index) => (
                          <div key={index} className="flex gap-2">
                            <Input
                              value={item}
                              maxLength={120}
                              onChange={(event) => {
                                const next = [...form.deliverables];
                                next[index] = event.target.value;
                                updateField('deliverables', next);
                              }}
                              placeholder="Bảng so sánh 2–3 model phù hợp"
                              readOnly={!canSave}
                            />
                            {canSave ? (
                              <button
                                type="button"
                                className="shrink-0 rounded-md border border-border px-2 text-muted-foreground hover:bg-muted"
                                onClick={() => {
                                  const next = form.deliverables.filter((_, i) => i !== index);
                                  updateField('deliverables', next);
                                }}
                                aria-label="Xóa mục"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                        ))
                      )}
                      {canSave && form.deliverables.length < 6 ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                          onClick={() => updateField('deliverables', [...form.deliverables, ''])}
                        >
                          <Plus className="h-3.5 w-3.5" /> Thêm dòng
                        </button>
                      ) : null}
                    </div>
                  </Field>

                  <Field label="Thời gian phản hồi" htmlFor="service-duration">
                    <Input
                      id="service-duration"
                      value={form.typical_duration}
                      maxLength={120}
                      onChange={(event) => updateField('typical_duration', event.target.value)}
                      placeholder="1–3 ngày làm việc"
                      readOnly={!canSave}
                    />
                  </Field>
                </div>
              </Card>

              <Card data-domain-editor-media="true">
                <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Nội dung chi tiết</span>
                </div>
                <RichTextEditor
                  value={form.content_html}
                  onChange={(html) => updateField('content_html', html)}
                  placeholder="Viết cho khách hàng: trường hợp nên chọn dịch vụ này, thông tin khách nên gửi, Song Thanh sẽ rà soát và phản hồi gì."
                  readOnly={!canSave}
                />
              </Card>

              {!isNew(id) ? (
                <RelatedProductGroupsCard
                  canUpdate={canUpdateRelatedProducts}
                  detailRecord={detailRecord}
                  entityId={id}
                  kind={kind}
                  onReload={reloadRelatedProducts}
                  reviewAfterEdit={!canPrivilegedWorkflow && form.review_status === 'approved' && form.publish_status === 'published'}
                />
              ) : null}

              <Card>
                <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Ảnh đại diện</span>
                </div>
                <div className="space-y-4 p-4">
                  {previewFile ? (
                    <div className="space-y-2">
                      <AdminFileThumbnail
                        file={previewFile}
                        alt={form.title || 'Ảnh đại diện'}
                        className="aspect-[4/3] h-auto w-full"
                        emptyLabel="Không tải được ảnh"
                      />
                      <button
                        type="button"
                        onClick={() => updateField('image_file_id', '')}
                        disabled={!canSave}
                        className="w-full rounded-md border border-border py-1.5 text-xs transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Gỡ ảnh hiện tại
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-lg border-2 border-dashed border-border bg-slate-50 p-6 text-center">
                      <ImageIcon className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
                      <p className="text-xs font-medium text-slate-600">Chưa có ảnh đại diện</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">JPG, PNG, WebP</p>
                    </div>
                  )}

                  <FileReferencePicker
                    value={form.image_file_id}
                    onChange={(value) => updateField('image_file_id', value)}
                    readOnly={!canSave}
                    fieldLabel="ảnh đại diện"
                    preferredGroup="other"
                    discouragedGroups={['product_image']}
                    discouragedGroupMessage="Ảnh này đang được phân loại là ảnh sản phẩm. Chỉ dùng nếu ảnh thật sự đại diện cho dịch vụ."
                  />
                </div>
              </Card>

              <Card data-advanced-seo="true">
                <button
                  type="button"
                  onClick={() => setSeoOpen((open) => !open)}
                  className="flex w-full items-center gap-2 p-3.5 text-left"
                >
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-xs font-medium text-muted-foreground">SEO &amp; Chia sẻ</span>
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 text-muted-foreground transition-transform',
                      seoOpen ? 'rotate-180' : ''
                    )}
                  />
                </button>

                {seoOpen ? (
                  <div className="space-y-4 border-t border-border p-4">
                    <Field label="Tiêu đề SEO" htmlFor="seo-title">
                      <Input
                        id="seo-title"
                        value={form.seo_title}
                        onChange={(event) => updateField('seo_title', event.target.value)}
                        placeholder="Tự động lấy từ tên nếu để trống"
                        className="text-xs"
                        readOnly={!canSave}
                      />
                    </Field>
                    <Field label="Mô tả SEO" htmlFor="seo-description">
                      <Textarea
                        id="seo-description"
                        value={form.seo_description}
                        onChange={(event) => updateField('seo_description', event.target.value)}
                        placeholder="Tóm tắt nội dung..."
                        className="min-h-[50px] text-xs"
                        readOnly={!canSave}
                      />
                    </Field>
                    <Field label="Ảnh OG SEO" htmlFor="seo-og-image">
                      <FileReferencePicker
                        value={form.seo_og_image_file_id}
                        onChange={(value) => updateField('seo_og_image_file_id', value)}
                        readOnly={!canSave}
                        fieldLabel="ảnh OG SEO"
                        preferredGroup="other"
                        discouragedGroups={['product_image']}
                        discouragedGroupMessage="Ảnh OG đang được phân loại là ảnh sản phẩm. Hãy kiểm tra lại trước khi dùng cho chia sẻ dịch vụ."
                      />
                    </Field>
                  </div>
                ) : null}
              </Card>

              {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
              {saveMessage ? <p className="text-sm text-green-700" role="status">{saveMessage}</p> : null}
            </div>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <UnsavedChangesGuard when={dirty} />
      <form
        onSubmit={handleSave}
        className="space-y-5"
        data-domain-editor="true"
        data-domain-kind="project"
        data-domain-editor-layout="single-column"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-1 text-xs text-muted-foreground">
              Tổng quan / {cfg.label} / {isNew(id) ? 'Tạo mới' : pageTitle}
            </p>
            <h1 className="text-xl font-semibold text-text">{pageTitle}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Hiển thị tại {cfg.publicPrefix} trên website.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LinkButton href={cfg.listPath} variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Quay lại
            </LinkButton>
          </div>
        </div>

        <DomainEditorCommandBar
          visibility={visibility}
          canPrivilegedWorkflow={canPrivilegedWorkflow}
          onVisibilityChange={(nextVisibility) =>
            setForm((current) => applyVisibility(current, nextVisibility))
          }
          canSave={canSave}
          saving={saving}
          dirty={dirty}
          recordMeta={recordMeta}
          publicHref={
            !isNew(id) && form.slug
              ? `${PUBLIC_SITE_BASE_URL}${cfg.publicPrefix}${form.slug}`
              : ''
          }
          saveLabel="Lưu dự án"
        />

        <div className="space-y-4">
          <div className="space-y-4">
            <Card>
              <div className="space-y-4 p-4">
                  <Field label="Tên dự án" required htmlFor="project-title">
                    <Input
                      id="project-title"
                      value={form.title}
                      onChange={(event) => updateField('title', event.target.value)}
                      placeholder="Nhập tên dự án"
                      readOnly={!canSave}
                      required
                    />
                  </Field>
                  <Field label="Mô tả ngắn" htmlFor="project-description">
                    <Textarea
                      id="project-description"
                      value={form.description}
                      onChange={(event) => updateField('description', event.target.value)}
                      placeholder="Mô tả ngắn về dự án"
                      className="min-h-[64px]"
                      readOnly={!canSave}
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Khách hàng / Chủ đầu tư" htmlFor="project-client">
                      <Input
                        id="project-client"
                        value={form.client_name}
                        onChange={(event) => updateField('client_name', event.target.value)}
                        placeholder="Công ty ABC..."
                        readOnly={!canSave}
                      />
                    </Field>
                    <Field label="Năm thực hiện" htmlFor="project-year" error={yearError}>
                      <Input
                        id="project-year"
                        inputMode="numeric"
                        maxLength={4}
                        value={form.project_year}
                        onChange={(event) => updateField('project_year', event.target.value.replace(/\D/g, '').slice(0, 4))}
                        onBlur={() => setYearError(validateProjectYear(form.project_year))}
                        placeholder="2024"
                        readOnly={!canSave}
                      />
                    </Field>
                  </div>
                  <Field label="Địa điểm" htmlFor="project-location">
                    <Input
                      id="project-location"
                      value={form.location}
                      onChange={(event) => updateField('location', event.target.value)}
                      placeholder="TP.HCM, Bình Dương..."
                      readOnly={!canSave}
                    />
                  </Field>
              </div>
            </Card>

            <Card data-domain-editor-media="true">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-text">Ảnh đại diện</span>
              </div>
              <div className="grid gap-4 p-4 md:grid-cols-[minmax(15rem,22rem)_minmax(0,1fr)] md:items-start">
                {previewFile ? (
                  <AdminFileThumbnail
                    file={previewFile}
                    alt={form.title || 'Ảnh đại diện'}
                    className="aspect-video h-auto w-full rounded-md"
                    emptyLabel="Không tải được ảnh"
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-border bg-muted/40">
                    <div className="text-center">
                      <ImageIcon className="mx-auto h-7 w-7 text-muted-foreground" />
                      <p className="mt-2 text-sm font-medium text-slate-600">Chưa có ảnh đại diện</p>
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  <FileReferencePicker
                    value={form.image_file_id}
                    onChange={(value) => updateField('image_file_id', value)}
                    readOnly={!canSave}
                    fieldLabel="ảnh đại diện"
                    preferredGroup="other"
                  />
                  {previewFile ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => updateField('image_file_id', '')}
                      disabled={!canSave}
                    >
                      Gỡ ảnh hiện tại
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Nội dung chi tiết</span>
              </div>
              <RichTextEditor
                value={form.content_html}
                onChange={(html) => updateField('content_html', html)}
                placeholder="Mô tả phạm vi công việc, giải pháp kỹ thuật, kết quả đạt được..."
                readOnly={!canSave}
              />
            </Card>

            {!isNew(id) ? (
              <RelatedProductGroupsCard
                canUpdate={canUpdateRelatedProducts}
                detailRecord={detailRecord}
                entityId={id}
                kind={kind}
                onReload={reloadRelatedProducts}
                reviewAfterEdit={!canPrivilegedWorkflow && form.review_status === 'approved' && form.publish_status === 'published'}
              />
            ) : null}

            {kind === 'project' && !isNew(id) && canReadProjectGallery ? (
              <ProjectGalleryCard
                projectId={id}
                canRead={canReadProjectGallery}
                canCreate={canCreateProjectGallery}
                canUpdate={canUpdateProjectGallery}
                canArchive={canArchiveProjectGallery}
                canRestore={canRestoreProjectGallery}
                onChanged={reloadRelatedProducts}
                reviewAfterEdit={!canPrivilegedWorkflow && form.review_status === 'approved' && form.publish_status === 'published'}
              />
            ) : null}

            <Card data-advanced-seo="true">
              <button
                type="button"
                onClick={() => setSeoOpen((open) => !open)}
                className="flex w-full items-center gap-2 p-3.5 text-left"
              >
                <Search className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-xs font-medium text-muted-foreground">
                  SEO &amp; Đường dẫn
                </span>
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 text-muted-foreground transition-transform',
                    seoOpen ? 'rotate-180' : ''
                  )}
                />
              </button>

              {seoOpen ? (
                <div className="space-y-3 border-t border-border p-4">
                  <Field label="Đường dẫn" htmlFor="slug">
                    <div className="flex overflow-hidden rounded-md border border-border">
                      <span className="border-r border-border bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                        {cfg.publicPrefix}
                      </span>
                      <input
                        id="slug"
                        value={form.slug}
                        onChange={(event) => {
                          setSlugAutoGen(false);
                          updateField('slug', event.target.value);
                        }}
                        placeholder="du-an-tieu-bieu"
                        className="flex-1 bg-transparent px-2 py-1.5 text-xs outline-none"
                        readOnly={!canSave}
                      />
                    </div>
                  </Field>
                  <Field label="Tiêu đề SEO" htmlFor="seo-title">
                    <Input
                      id="seo-title"
                      value={form.seo_title}
                      onChange={(event) => updateField('seo_title', event.target.value)}
                      placeholder="Tự động lấy từ tên nếu để trống"
                      className="text-xs"
                      readOnly={!canSave}
                    />
                  </Field>
                  <Field label="Mô tả SEO" htmlFor="seo-description">
                    <Textarea
                      id="seo-description"
                      value={form.seo_description}
                      onChange={(event) => updateField('seo_description', event.target.value)}
                      placeholder="Tóm tắt nội dung..."
                      className="min-h-[50px] text-xs"
                      readOnly={!canSave}
                    />
                  </Field>
                </div>
              ) : null}
            </Card>

            {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
            {saveMessage ? <p className="text-sm text-green-700" role="status">{saveMessage}</p> : null}
          </div>
        </div>
      </form>
    </section>
  );
}

function DomainEditorCommandBar({
  visibility,
  canPrivilegedWorkflow,
  onVisibilityChange,
  canSave,
  saving,
  dirty,
  recordMeta,
  publicHref,
  saveLabel
}: {
  visibility: Visibility;
  canPrivilegedWorkflow: boolean;
  onVisibilityChange: (visibility: Visibility) => void;
  canSave: boolean;
  saving: boolean;
  dirty: boolean;
  recordMeta: RecordMeta | null;
  publicHref: string;
  saveLabel: string;
}) {
  return (
    <Card
      data-domain-editor-commandbar="true"
      className="overflow-hidden lg:sticky lg:top-[calc(var(--topbar-height)+8px)] lg:z-20"
    >
      <div className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="flex items-center gap-2 text-sm font-semibold text-text">
            <Eye className="h-4 w-4 text-primary" />
            Hiển thị
          </span>
          <div className="inline-grid grid-cols-3 rounded-md border border-border bg-muted/50 p-1">
            {[
              ['draft', 'Nháp'],
              ['published', 'Đang đăng'],
              ['hidden', 'Tạm ẩn']
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={visibility === value}
                disabled={!canSave || !canPrivilegedWorkflow}
                onClick={() => onVisibilityChange(value as Visibility)}
                className={cn(
                  'min-h-9 rounded px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                  visibility === value
                    ? 'bg-panel text-primary shadow-sm ring-1 ring-border'
                    : 'text-muted-foreground hover:text-text'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {!canPrivilegedWorkflow ? (
            <span className="text-xs text-muted-foreground">
              Nội dung sửa sẽ gửi Super Admin duyệt và tạm ẩn nếu đang công khai.
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="min-w-0 text-xs text-muted-foreground">
            <span className={cn('font-semibold', dirty ? 'text-amber-700' : 'text-emerald-700')}>
              {dirty ? 'Có thay đổi chưa lưu' : 'Đã lưu đồng bộ'}
            </span>
            {recordMeta?.updated_at ? (
              <span className="ml-2 hidden sm:inline">Cập nhật {formatDate(recordMeta.updated_at)}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {publicHref ? (
              <a
                href={publicHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-panel px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-muted"
              >
                <ExternalLink className="h-4 w-4" />
                Xem trên website
              </a>
            ) : null}
            {canSave ? (
              <Button type="submit" disabled={saving || !dirty}>
                <Save className="h-4 w-4" />
                {saving ? 'Đang lưu...' : saveLabel}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ServiceReadinessStrip({ checks }: { checks: ServiceQualityCheck[] }) {
  const completed = checks.filter((check) => check.ok).length;
  const missing = checks.filter((check) => !check.ok);

  return (
    <details
      data-domain-public-readiness="true"
      className={cn(
        'group rounded-md border bg-panel',
        missing.length > 0 ? 'border-amber-200' : 'border-emerald-200'
      )}
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3">
        {missing.length > 0 ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        )}
        <span className="min-w-0 flex-1 text-sm font-semibold text-text">
          {missing.length > 0
            ? `Trang dịch vụ còn ${missing.length} mục cần bổ sung`
            : 'Trang dịch vụ đã đủ nội dung chính'}
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          {completed}/{checks.length}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-2 border-t border-border px-4 py-3 sm:grid-cols-2 xl:grid-cols-3">
        {(missing.length > 0 ? missing : checks).map((check) => (
          <div key={check.label} className="flex items-start gap-2 text-sm text-slate-700">
            {check.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            )}
            <span>{check.label}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

function RelatedProductGroupsCard({
  kind,
  entityId,
  detailRecord,
  canUpdate,
  onReload,
  reviewAfterEdit
}: {
  kind: DomainKind;
  entityId: string;
  detailRecord: Record<string, unknown> | null;
  canUpdate: boolean;
  onReload: () => Promise<void>;
  reviewAfterEdit: boolean;
}) {
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const groups = relatedProductGroupsFromDetail(detailRecord);
  const counts = asRecord(detailRecord?.related_product_group_counts);
  const baseEndpoint = kind === 'service' ? endpoints.songThanh.services : endpoints.songThanh.projects;
  const endpoint = `${baseEndpoint}/${encodeURIComponent(entityId)}/product-groups`;
  const entityLabel = kind === 'service' ? 'dịch vụ' : 'dự án';
  const cardSubtitle =
    kind === 'service'
      ? 'Các nhóm sản phẩm này sẽ hiển thị trên trang chi tiết dịch vụ public nếu chúng đang public hợp lệ.'
      : 'Chỉ gắn nhóm phù hợp với phạm vi dự án. Website hiển thị nhóm đã liên kết, không xác nhận SKU cụ thể.';
  const unavailableProductGroups = Object.fromEntries(
    groups.flatMap((group) => {
      const productGroup = relationProductGroup(group);
      const productGroupId = textValue(productGroup.id);
      if (!productGroupId) return [];
      return [
        [
          productGroupId,
          asRecord(group.association).deleted_at ? 'Đã gỡ' : 'Đã gắn'
        ]
      ];
    })
  );

  async function runAction(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError('');
    setActionMessage('');
    try {
      await action();
      await onReload();
      setActionMessage(reviewAfterEdit
        ? `Đã lưu. Trang ${entityLabel} chuyển sang chờ duyệt và tạm ẩn khỏi website.`
        : 'Đã cập nhật sản phẩm liên quan.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Không cập nhật được sản phẩm liên quan.');
    } finally {
      setBusy(false);
    }
  }

  async function attachProductGroup(productGroupId: string) {
    const normalizedProductGroupId = productGroupId.trim();
    if (!normalizedProductGroupId) return;
    await runAction(async () => {
      await apiClient.post(endpoint, { product_group_id: normalizedProductGroupId });
    });
  }

  return (
    <Card>
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Package className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Sản phẩm liên quan</span>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <h2 className="text-sm font-semibold text-text">Gắn nhóm sản phẩm cho {entityLabel} này</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{cardSubtitle}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge tone="active">Đang gắn {formatValue(counts.active ?? activeRelatedCount(groups))}</Badge>
          <Badge tone="archived">Đã gỡ {formatValue(counts.deleted ?? deletedRelatedCount(groups))}</Badge>
        </div>

        {canUpdate ? (
          <RelationActionPicker
            kind="productGroup"
            readOnly={busy}
            buttonLabel="Gắn sản phẩm"
            loadingLabel="Đang gắn"
            unavailableItems={unavailableProductGroups}
            onSelect={(productGroupId) => attachProductGroup(productGroupId)}
          />
        ) : (
          <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            Bạn có quyền xem {entityLabel} nhưng chưa có quyền cập nhật liên kết sản phẩm.
          </div>
        )}

        {actionError ? <p className="text-xs text-red-600">{actionError}</p> : null}
        {actionMessage ? <p className="text-xs text-green-700" role="status">{actionMessage}</p> : null}

        {groups.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border bg-muted px-3 py-6 text-center text-sm text-muted-foreground">
            Chưa gắn nhóm sản phẩm nào cho {entityLabel} này.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-sm border border-border">
            {groups.map((group) => {
              const productGroup = relationProductGroup(group);
              const association = asRecord(group.association);
              const productGroupId = textValue(productGroup.id);
              const archived = Boolean(association.deleted_at);
              return (
                <div key={productGroupId} className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-text">
                        {formatValue(productGroup.name ?? productGroup.title)}
                      </p>
                      <Badge tone={archived ? 'archived' : 'success'}>{archived ? 'Đã gỡ' : 'Đang gắn'}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge tone={statusTone(productGroup.status)}>{formatValue(productGroup.status)}</Badge>
                      <Badge tone={statusTone(productGroup.review_status)}>{formatValue(productGroup.review_status)}</Badge>
                      <Badge tone={statusTone(productGroup.publish_status)}>{formatValue(productGroup.publish_status)}</Badge>
                    </div>
                  </div>

                  {canUpdate ? (
                    archived ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          runAction(() => apiClient.post(`${endpoint}/${encodeURIComponent(productGroupId)}/restore`, {}))
                        }
                      >
                        Khôi phục
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() =>
                          runAction(() => apiClient.delete(`${endpoint}/${encodeURIComponent(productGroupId)}`))
                        }
                      >
                        Gỡ
                      </Button>
                    )
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

function relatedProductGroupsFromDetail(detailRecord: Record<string, unknown> | null): Record<string, unknown>[] {
  const value = detailRecord?.related_product_groups;
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function relationProductGroup(record: Record<string, unknown>): Record<string, unknown> {
  const nested = record.product_group;
  return nested && typeof nested === 'object' && !Array.isArray(nested)
    ? (nested as Record<string, unknown>)
    : record;
}

function activeRelatedCount(groups: Record<string, unknown>[]) {
  return groups.filter((group) => !asRecord(group.association).deleted_at).length;
}

function deletedRelatedCount(groups: Record<string, unknown>[]) {
  return groups.filter((group) => Boolean(asRecord(group.association).deleted_at)).length;
}

function statusTone(value: unknown): 'default' | 'active' | 'inactive' | 'archived' | 'success' | 'warning' | 'info' | 'danger' {
  const status = String(value || '').toLowerCase();
  if (['published', 'approved'].includes(status)) return 'success';
  if (['active'].includes(status)) return 'active';
  if (['inactive', 'unpublished'].includes(status)) return 'inactive';
  if (['archived', 'deleted'].includes(status)) return 'archived';
  if (['pending', 'pending_review', 'draft'].includes(status)) return 'warning';
  if (['rejected'].includes(status)) return 'danger';
  return 'info';
}

function DetailSkeleton() {
  return (
    <section className="admin-page space-y-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="space-y-4">
        <Card>
          <div className="space-y-4 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </Card>
        <Card>
          <Skeleton className="h-80 w-full" />
        </Card>
      </div>
    </section>
  );
}
