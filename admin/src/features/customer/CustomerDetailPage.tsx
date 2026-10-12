'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from 'react';
import {
  Clock,
  FileText,
  MessageSquare,
  Plus,
  UserRound
} from '@/components/icons';
import { useRouter } from 'next/navigation';

import { Field } from '@/components/form/Field';
import { ReadOnlyBanner } from '@/components/form/ReadOnlyBanner';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorMessagePanel } from '@/components/ui/ErrorMessagePanel';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { authStore } from '@/features/auth/auth.store';
import type { AuthState } from '@/features/auth/auth.types';
import { apiClient } from '@/lib/api-client';
import { formatDate, formatValue } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';

type DetailMode = 'create' | 'view' | 'edit';
type CustomerDetailPanel = 'timeline' | 'contacts' | 'quotes';
type CustomerRecord = Record<string, unknown>;

export function CustomerDetailPage({
  endpoint,
  id,
  initialMode
}: {
  endpoint: string;
  id?: string;
  initialMode: DetailMode;
}) {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>(() => authStore.getState());
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [mode, setMode] = useState<DetailMode>(initialMode);
  const [activePanel, setActivePanel] = useState<CustomerDetailPanel>('timeline');
  const [saving, setSaving] = useState(false);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [permanentDeleteOpen, setPermanentDeleteOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    company_name: ''
  });

  useEffect(() => {
    setAuthState(authStore.hydrate());
    return authStore.subscribe(setAuthState);
  }, []);

  useEffect(() => {
    const customerId = id ?? '';
    if (!customerId) {
      setLoading(false);
      return;
    }

    let active = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const result = await apiClient.get<unknown>(
          `${endpoint}/${encodeURIComponent(customerId)}`
        );
        if (!active) {
          return;
        }

        setData(result);
        hydrateForm(extractCustomer(result), setForm);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Không tải được hồ sơ khách hàng.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [endpoint, id]);

  const permissions = authState.permissions;
  const canCreate = permissions.includes(PERMISSIONS.customerCreate);
  const canUpdate = permissions.includes(PERMISSIONS.customerUpdate);
  const canArchive = permissions.includes(PERMISSIONS.customerArchive);
  const canRestore = permissions.includes(PERMISSIONS.customerRestore);
  const isSuperAdmin = authState.roles.includes('super_admin');

  const customer = useMemo(() => extractCustomer(data), [data]);
  const summary = useMemo(() => extractObject(data, 'summary'), [data]);
  const interactions = useMemo(() => extractArray(data, 'interactions'), [data]);
  const contacts = useMemo(() => extractArray(data, 'contacts'), [data]);
  const quotes = useMemo(() => extractArray(data, 'quotes'), [data]);
  const archived = Boolean(customer.deleted_at);
  const effectiveMode =
    initialMode === 'create'
      ? 'create'
      : archived
        ? 'view'
        : mode;
  const readOnly = effectiveMode === 'view';

  async function save() {
    setSaving(true);
    setActionError('');

    try {
      const payload = {
        full_name: form.full_name,
        phone: form.phone || null,
        email: form.email || null,
        company_name: form.company_name || null
      };

      const customerId = id ?? '';
      if (effectiveMode !== 'create' && !customerId) {
        throw new Error('Thiếu mã hồ sơ khách hàng.');
      }

      const result =
        effectiveMode === 'create'
          ? await apiClient.post(endpoint, payload)
          : await apiClient.put(`${endpoint}/${encodeURIComponent(customerId)}`, payload);

      setData(result);
      const nextCustomer = extractCustomer(result);
      hydrateForm(nextCustomer, setForm);

      if (effectiveMode === 'create') {
        const nextId = String(nextCustomer.id ?? '');
        if (nextId) {
          router.replace(`/customers/${encodeURIComponent(nextId)}`);
        }
      } else {
        setMode('view');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không lưu được hồ sơ khách hàng.');
    } finally {
      setSaving(false);
    }
  }

  async function applyLifecycleAction(kind: 'archive' | 'restore') {
    if (!id) {
      return;
    }

    setLifecycleLoading(true);
    setActionError('');

    try {
      const result = await apiClient.post(`${endpoint}/${encodeURIComponent(id)}/${kind}`);
      setData(result);
      const nextCustomer = extractCustomer(result);
      hydrateForm(nextCustomer, setForm);
      setMode('view');
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Không cập nhật được trạng thái hồ sơ.'
      );
    } finally {
      setLifecycleLoading(false);
    }
  }

  async function permanentlyDeleteCustomer() {
    if (!id) return;
    setLifecycleLoading(true);
    setActionError('');
    try {
      await apiClient.delete(`${endpoint}/${encodeURIComponent(id)}/permanent`);
      setPermanentDeleteOpen(false);
      router.replace('/customers?deleted_scope=deleted');
    } catch (err) {
      setPermanentDeleteOpen(false);
      setActionError(
        err instanceof Error ? err.message : 'Không xóa vĩnh viễn được hồ sơ khách hàng.'
      );
    } finally {
      setLifecycleLoading(false);
    }
  }

  if (loading) {
    return <CustomerDetailSkeleton />;
  }

  if (error) {
    return <ErrorState message={error} context="module-load" />;
  }

  if (effectiveMode === 'create' && !canCreate) {
    return (
      <ErrorState
        message="Tài khoản hiện tại không có quyền tạo hồ sơ khách hàng."
        context="module-load"
      />
    );
  }

  const detailPanels: Array<{
    key: CustomerDetailPanel;
    label: string;
    count: number;
  }> = [
    { key: 'timeline', label: 'Lịch sử', count: interactions.length },
    { key: 'contacts', label: 'Liên hệ', count: contacts.length },
    { key: 'quotes', label: 'Báo giá', count: quotes.length }
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Khách hàng & yêu cầu
          </p>
          <h1 className="mt-1 text-[22px] font-semibold leading-7 tracking-tight text-text">
            {effectiveMode === 'create'
              ? 'Tạo khách hàng'
              : formatValue(customer.full_name || customer.company_name || customer.id)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {effectiveMode === 'create'
              ? 'Tạo hồ sơ khách hàng để gom lịch sử liên hệ và báo giá vào một nơi quản lý.'
              : `Tạo lúc ${formatDate(customer.created_at)} • Cập nhật ${formatDate(customer.updated_at)}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {effectiveMode === 'view' && id && canUpdate && !archived ? (
            <Button type="button" variant="secondary" onClick={() => setMode('edit')}>
              Sửa thông tin
            </Button>
          ) : null}
          {effectiveMode === 'edit' ? (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  hydrateForm(customer, setForm);
                  setMode('view');
                }}
              >
                Hủy
              </Button>
              <Button type="button" disabled={saving} onClick={save}>
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </>
          ) : null}
          {effectiveMode === 'create' ? (
            <>
              <LinkButton href="/customers" variant="secondary">
                Quay lại danh sách
              </LinkButton>
              <Button type="button" disabled={saving} onClick={save}>
                <Plus className="h-4 w-4" />
                {saving ? 'Đang tạo...' : 'Tạo khách hàng'}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {archived ? (
        <ReadOnlyBanner>
          Hồ sơ này đang ở trạng thái lưu trữ. Bạn vẫn xem được lịch sử nhưng không chỉnh sửa cho tới khi khôi phục.
        </ReadOnlyBanner>
      ) : readOnly && id ? (
        <ReadOnlyBanner>
          Hồ sơ khách hàng được mở ở chế độ xem. Chuyển sang “Sửa thông tin” khi cần cập nhật tên, số điện thoại, email hoặc công ty.
        </ReadOnlyBanner>
      ) : null}

      {actionError ? (
        <ErrorMessagePanel compact context="generic" error={actionError} />
      ) : null}

      {effectiveMode !== 'create' ? (
        <Card className="overflow-hidden">
          <div className="grid divide-y divide-border md:grid-cols-[minmax(0,1fr)_auto] md:divide-x md:divide-y-0">
            <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
              <SummaryMetric
                icon={<UserRound className="h-4 w-4" />}
                label="Trạng thái"
                value={
                  <Badge tone={archived ? 'archived' : 'active'}>
                    {archived ? 'Đã lưu trữ' : 'Đang hoạt động'}
                  </Badge>
                }
              />
              <SummaryMetric
                icon={<MessageSquare className="h-4 w-4" />}
                label="Liên hệ"
                value={`${Number(summary.contact_count ?? 0)} bản ghi`}
              />
              <SummaryMetric
                icon={<FileText className="h-4 w-4" />}
                label="Báo giá"
                value={`${Number(summary.quote_count ?? 0)} yêu cầu`}
              />
              <SummaryMetric
                icon={<Clock className="h-4 w-4" />}
                label="Gần nhất"
                value={formatDate(summary.last_interaction_at)}
              />
            </div>

            {id && ((!archived && canArchive) || (archived && canRestore)) ? (
              <div className="flex items-center justify-start px-4 py-3 md:justify-end">
                {!archived && canArchive ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={lifecycleLoading}
                    onClick={() => applyLifecycleAction('archive')}
                  >
                    {lifecycleLoading ? 'Đang lưu...' : 'Lưu trữ'}
                  </Button>
                ) : null}
                {archived && canRestore ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={lifecycleLoading}
                    onClick={() => applyLifecycleAction('restore')}
                  >
                    {lifecycleLoading ? 'Đang lưu...' : 'Khôi phục'}
                  </Button>
                ) : null}
                {archived && isSuperAdmin ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-700 hover:bg-red-50"
                    disabled={lifecycleLoading}
                    onClick={() => setPermanentDeleteOpen(true)}
                  >
                    Xóa vĩnh viễn
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <SectionHeader
          icon={<UserRound className="h-4 w-4" />}
          title="Thông tin hồ sơ"
          description="Đây là hồ sơ tổng hợp, không ghi đè dữ liệu gốc của Liên hệ hoặc Yêu cầu báo giá."
        />
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Họ và tên" readOnly={readOnly} required>
            <Input
              value={form.full_name}
              maxLength={128}
              readOnly={readOnly}
              onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
            />
          </Field>
          <Field label="Công ty" readOnly={readOnly}>
            <Input
              value={form.company_name}
              maxLength={255}
              readOnly={readOnly}
              onChange={(event) => setForm((current) => ({ ...current, company_name: event.target.value }))}
            />
          </Field>
          <Field label="Số điện thoại" readOnly={readOnly}>
            <Input
              value={form.phone}
              maxLength={32}
              readOnly={readOnly}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            />
          </Field>
          <Field label="Email" readOnly={readOnly}>
            <Input
              value={form.email}
              maxLength={128}
              readOnly={readOnly}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            />
          </Field>
        </div>
      </Card>

      {effectiveMode !== 'create' ? (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap gap-2 border-b border-border bg-panel px-4 py-3">
            {detailPanels.map((panel) => (
              <DetailTabButton
                key={panel.key}
                active={activePanel === panel.key}
                label={panel.label}
                count={panel.count}
                onClick={() => setActivePanel(panel.key)}
              />
            ))}
          </div>

          {activePanel === 'timeline' ? (
            <div className="max-h-[560px] divide-y divide-border overflow-auto">
              {interactions.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Hồ sơ này chưa có tương tác nào được liên kết.
                </div>
              ) : (
                interactions.map((interaction, index) => (
                  <InteractionRow key={String(interaction.source_id ?? index)} interaction={interaction} />
                ))
              )}
            </div>
          ) : null}

          {activePanel === 'contacts' ? (
            <div className="max-h-[520px] divide-y divide-border overflow-auto">
              {contacts.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Chưa có liên hệ nào.
                </div>
              ) : (
                contacts.map((contact, index) => (
                  <RelatedRow
                    key={String(contact.id ?? index)}
                    href={`/contacts/${encodeURIComponent(String(contact.id ?? ''))}`}
                    title={formatValue(contact.full_name)}
                    subtitle={formatValue(contact.source_page)}
                    meta={formatDate(contact.created_at)}
                    status={formatValue(contact.status)}
                    archived={Boolean(contact.deleted_at)}
                  />
                ))
              )}
            </div>
          ) : null}

          {activePanel === 'quotes' ? (
            <div className="max-h-[520px] divide-y divide-border overflow-auto">
              {quotes.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Chưa có yêu cầu báo giá nào.
                </div>
              ) : (
                quotes.map((quote, index) => (
                  <RelatedRow
                    key={String(quote.id ?? index)}
                    href={`/quotes/${encodeURIComponent(String(quote.id ?? ''))}`}
                    title={formatValue(quote.full_name)}
                    subtitle={`${Number(quote.item_count ?? 0)} sản phẩm trong yêu cầu`}
                    meta={formatDate(quote.created_at)}
                    status={formatValue(quote.status)}
                    archived={Boolean(quote.deleted_at)}
                  />
                ))
              )}
            </div>
          ) : null}
        </Card>
      ) : null}

      <ConfirmDialog
        open={permanentDeleteOpen}
        title="Xóa vĩnh viễn hồ sơ khách hàng?"
        description="Hồ sơ sẽ mất hoàn toàn và không thể khôi phục. Hệ thống chỉ cho phép xóa khi không còn liên hệ hoặc báo giá đang hoạt động."
        confirmLabel="Xóa vĩnh viễn"
        pending={lifecycleLoading}
        onConfirm={() => void permanentlyDeleteCustomer()}
        onClose={() => setPermanentDeleteOpen(false)}
      />
    </section>
  );
}

function CustomerDetailSkeleton() {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-80" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-[220px] w-full" />
      <Skeleton className="h-[360px] w-full" />
    </section>
  );
}

function SummaryMetric({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border bg-muted text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {label}
        </p>
        <div className="mt-1 truncate text-sm font-semibold text-text">{value}</div>
      </div>
    </div>
  );
}

function DetailTabButton({
  active,
  label,
  count,
  onClick
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex h-9 items-center gap-2 rounded-sm border px-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
        active
          ? 'border-primary bg-blue-50 text-primary'
          : 'border-border bg-panel text-slate-700 hover:bg-muted'
      ].join(' ')}
    >
      {label}
      <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
        {count}
      </span>
    </button>
  );
}

function SectionHeader({
  icon,
  title,
  description
}: {
  icon: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-[52px] items-center gap-3 border-b border-border bg-muted px-4 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-border bg-panel text-primary">
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

function InteractionRow({ interaction }: { interaction: CustomerRecord }) {
  const isQuote = String(interaction.interaction_type) === 'quote';
  const href = isQuote
    ? `/quotes/${encodeURIComponent(String(interaction.source_id ?? ''))}`
    : `/contacts/${encodeURIComponent(String(interaction.source_id ?? ''))}`;
  const archived = Boolean(interaction.deleted_at);

  return (
    <div className="flex gap-3 px-4 py-4">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border bg-muted text-primary">
        {isQuote ? <FileText className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={isQuote ? 'warning' : 'info'}>
            {isQuote ? 'Yêu cầu báo giá' : 'Liên hệ'}
          </Badge>
          {archived ? <Badge tone="archived">Đã lưu trữ</Badge> : null}
          <span className="text-xs text-muted-foreground">
            {formatDate(interaction.occurred_at)}
          </span>
        </div>
        <p className="mt-2 text-sm font-medium text-text">
          {formatValue(interaction.full_name)}
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
          {formatValue(interaction.summary)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {interaction.source_page ? <span>{formatValue(interaction.source_page)}</span> : null}
          {interaction.item_count !== null && interaction.item_count !== undefined ? (
            <span>{Number(interaction.item_count ?? 0)} sản phẩm</span>
          ) : null}
          <span>Trạng thái: {formatValue(interaction.status)}</span>
          <Link href={href} className="font-medium text-primary hover:underline">
            Mở bản ghi gốc
          </Link>
        </div>
      </div>
    </div>
  );
}

function RelatedRow({
  href,
  title,
  subtitle,
  meta,
  status,
  archived
}: {
  href: string;
  title: string;
  subtitle: string;
  meta: string;
  status: string;
  archived: boolean;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={href} className="font-medium text-text hover:text-primary">
            {title}
          </Link>
          <p className="mt-0.5 text-sm text-slate-700">{subtitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge tone={archived ? 'archived' : 'default'}>{status}</Badge>
        </div>
      </div>
    </div>
  );
}

function extractCustomer(data: unknown): CustomerRecord {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const record = data as Record<string, unknown>;
  if (record.customer && typeof record.customer === 'object' && !Array.isArray(record.customer)) {
    return record.customer as CustomerRecord;
  }

  return record;
}

function extractObject(data: unknown, key: string): CustomerRecord {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const value = (data as Record<string, unknown>)[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as CustomerRecord)
    : {};
}

function extractArray(data: unknown, key: string) {
  if (!data || typeof data !== 'object') {
    return [] as CustomerRecord[];
  }

  const value = (data as Record<string, unknown>)[key];
  return Array.isArray(value) ? (value as CustomerRecord[]) : [];
}

function hydrateForm(
  customer: CustomerRecord,
  setForm: Dispatch<
    SetStateAction<{
      full_name: string;
      phone: string;
      email: string;
      company_name: string;
    }>
  >
) {
  setForm({
    full_name: String(customer.full_name ?? ''),
    phone: String(customer.phone ?? ''),
    email: String(customer.email ?? ''),
    company_name: String(customer.company_name ?? '')
  });
}

