'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Field } from '@/components/form/Field';
import { FormActions } from '@/components/form/FormActions';
import { ReadOnlyBanner } from '@/components/form/ReadOnlyBanner';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { apiClient } from '@/lib/api-client';
import { byId } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { formatValue } from '@/lib/formatters';
import { authStore } from '@/features/auth/auth.store';
import type { ModuleConfig } from '@/features/module-config';
import { extractRecord } from './extract';

type DetailField = ModuleConfig['fields'][number];

export function ModuleDetailPage({ config, id }: { config: ModuleConfig; id: string }) {
  const router = useRouter();
  const isCreate = id === 'new';
  const [record, setRecord] = useState<Record<string, unknown>>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmAction, setConfirmAction] = useState<'archive' | 'restore' | null>(null);
  const permissions = authStore.getState().permissions;
  const canUpdate = isCreate
    ? !!config.createPermission && permissions.includes(config.createPermission)
    : !!config.updatePermission && permissions.includes(config.updatePermission);
  const canArchive = !!config.archivePermission && permissions.includes(config.archivePermission);
  const canRestore = !!config.restorePermission && permissions.includes(config.restorePermission);
  const archived = !!record.deleted_at;

  useEffect(() => {
    if (isCreate) {
      setRecord({});
      setForm({});
      return;
    }
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const result = await apiClient.get<unknown>(byId(config.endpoint, id));
        const nextRecord = extractRecord(result);
        if (!active) return;
        setRecord(nextRecord);
        setForm(toForm(nextRecord, config.fields.map((field) => field.key)));
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Không tải được chi tiết.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [config, id, isCreate]);

  const title = useMemo(() => {
    if (isCreate) return `Tạo mới ${config.title.toLowerCase()}`;
    return String(record.title || record.name || record.variant_name || record.original_name || record.id || config.title);
  }, [config.title, isCreate, record]);
  const fieldGroups = useMemo(() => groupDetailFields(config.fields), [config.fields]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!canUpdate) return;
    setSaving(true);
    setError('');
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([key, value]) => [key, normalizeFormValue(value)])
      );
      const result = isCreate
        ? await apiClient.post<unknown>(config.endpoint, payload)
        : await apiClient.put<unknown>(byId(config.endpoint, id), payload);
      const nextRecord = extractRecord(result);
      if (isCreate && nextRecord.id && config.detailPath) {
        router.replace(`${config.detailPath}/${String(nextRecord.id)}`);
        return;
      }
      setRecord(nextRecord);
      setForm(toForm(nextRecord, config.fields.map((field) => field.key)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được dữ liệu.');
    } finally {
      setSaving(false);
    }
  }

  async function runArchiveRestore() {
    if (!confirmAction) return;
    try {
      const result = await apiClient.post<unknown>(
        `${byId(config.endpoint, id)}/${confirmAction}`,
        {}
      );
      const nextRecord = extractRecord(result);
      setRecord(nextRecord);
      setConfirmAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thực hiện được thao tác.');
      setConfirmAction(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="min-h-16">
        <h1 className="text-[20px] font-semibold leading-7 tracking-tight text-text">{title}</h1>
        {config.subtitle ? <p className="mt-1 max-w-3xl text-sm text-[#444653]">{config.subtitle}</p> : null}
      </div>
      {config.notes ? <ReadOnlyBanner>{config.notes}</ReadOnlyBanner> : null}
      {!canUpdate ? <ReadOnlyBanner>Không có quyền chỉnh sửa, biểu mẫu đang ở chế độ chỉ đọc.</ReadOnlyBanner> : null}
      {error ? <ErrorState message={error} context="module-action" /> : null}
      {loading ? (
        <DetailSkeleton />
      ) : (
        <form onSubmit={save}>
          <Card className="overflow-visible">
            <div className="p-5">
              <div className="mx-auto w-full max-w-4xl space-y-4">
                <DetailSection
                  title="Thông tin chính"
                  fields={fieldGroups.main}
                  form={form}
                  canUpdate={canUpdate}
                  setForm={setForm}
                />
                {fieldGroups.mediaSeo.length > 0 ? (
                  <DetailSection
                    title="SEO, tệp và liên kết"
                    fields={fieldGroups.mediaSeo}
                    form={form}
                    canUpdate={canUpdate}
                    setForm={setForm}
                  />
                ) : null}
                {fieldGroups.status.length > 0 ? (
                  <DetailSection
                    title="Trạng thái hệ thống"
                    description="Trạng thái hiển thị và quy trình duyệt."
                    fields={fieldGroups.status}
                    form={form}
                    canUpdate={canUpdate}
                    setForm={setForm}
                  />
                ) : null}
              </div>
            </div>
            <FormActions
              canSave={canUpdate}
              saving={saving}
              archived={archived}
              onArchive={!isCreate && canArchive && !archived ? () => setConfirmAction('archive') : undefined}
              onRestore={!isCreate && canRestore && archived ? () => setConfirmAction('restore') : undefined}
            />
          </Card>
        </form>
      )}
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction === 'restore' ? 'Khôi phục bản ghi' : 'Lưu trữ bản ghi'}
        description="Thao tác sẽ cập nhật trạng thái lưu trữ và có thể ảnh hưởng tới dữ liệu đang hiển thị trong admin."
        confirmLabel={confirmAction === 'restore' ? 'Khôi phục' : 'Lưu trữ'}
        onClose={() => setConfirmAction(null)}
        onConfirm={runArchiveRestore}
      />
    </section>
  );
}

function DetailSection({
  title,
  description,
  fields,
  form,
  canUpdate,
  setForm
}: {
  title: string;
  description?: string;
  fields: DetailField[];
  form: Record<string, string>;
  canUpdate: boolean;
  setForm: (next: Record<string, string>) => void;
}) {
  if (fields.length === 0) return null;

  return (
    <section className="rounded-sm border border-border bg-panel p-4">
      <div className="mb-4 border-b border-border pb-3">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((field) => {
          const readOnly = field.readOnly || !canUpdate;
          return (
            <div key={field.key} className={cn(field.multiline ? 'md:col-span-2' : '')}>
              <Field label={field.label} readOnly={readOnly}>
                {readOnly && field.multiline && isJsonViewerField(field.key) ? (
                  <pre className="max-h-72 overflow-auto rounded-sm border border-border bg-muted p-3 text-xs leading-5 text-slate-700">
                    {formatValue(form[field.key])}
                  </pre>
                ) : field.multiline ? (
                  <Textarea
                    className="min-h-32"
                    value={form[field.key] ?? ''}
                    readOnly={readOnly}
                    onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                  />
                ) : (
                  <Input
                    value={form[field.key] ?? ''}
                    readOnly={readOnly}
                    onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                  />
                )}
              </Field>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function isJsonViewerField(key: string) {
  return ['old_value', 'new_value', 'changed_fields'].includes(key);
}

function DetailSkeleton() {
  return (
    <Card className="min-h-[520px] p-5">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        {Array.from({ length: 3 }).map((_, sectionIndex) => (
          <div key={sectionIndex} className="rounded-sm border border-border bg-panel p-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-2 h-3 w-64" />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {Array.from({ length: sectionIndex === 0 ? 4 : 3 }).map((__, fieldIndex) => (
                <div key={fieldIndex} className={cn('space-y-2', fieldIndex === 2 ? 'md:col-span-2' : '')}>
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className={fieldIndex === 2 ? 'h-32 w-full' : 'h-9 w-full'} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function groupDetailFields(fields: DetailField[]) {
  const main: DetailField[] = [];
  const mediaSeo: DetailField[] = [];
  const status: DetailField[] = [];

  for (const field of fields) {
    if (isStatusField(field.key)) {
      status.push(field);
    } else if (isMediaSeoField(field.key)) {
      mediaSeo.push(field);
    } else {
      main.push(field);
    }
  }

  return { main, mediaSeo, status };
}

function isStatusField(key: string) {
  return [
    'status',
    'review_status',
    'publish_status',
    'is_public',
    'public_price_mode',
    'public_price_amount',
    'assigned_to'
  ].includes(key);
}

function isMediaSeoField(key: string) {
  return (
    key.startsWith('seo_') ||
    key.endsWith('_file_id') ||
    key === 'file_id' ||
    key.includes('image') ||
    key.includes('thumbnail') ||
    key.includes('logo') ||
    key.includes('link') ||
    key.includes('url') ||
    key === 'content_type' ||
    key === 'document_type' ||
    key === 'version'
  );
}

function toForm(record: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, record[key] == null ? '' : String(record[key])]));
}

function normalizeFormValue(value: string) {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}
