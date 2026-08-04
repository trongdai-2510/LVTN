'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Mail,
  MessageSquare,
  Package,
  Phone,
  Send,
  UserRound
} from '@/components/icons';

import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { FileImage } from '@/components/ui/FileImage';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { authStore } from '@/features/auth/auth.store';
import type { AuthState } from '@/features/auth/auth.types';
import { extractRecord } from '@/features/shared/extract';
import { apiClient } from '@/lib/api-client';
import { byId } from '@/lib/api-endpoints';
import { formatDate, formatValue } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';

type WorkbenchType = 'contact' | 'quote';
type WorkbenchRecord = Record<string, unknown>;

const CONTACT_STATUSES = [
  { value: 'new',         label: 'Mới' },
  { value: 'in_progress', label: 'Đang xử lý' },
  { value: 'done',        label: 'Đã xong' },
  { value: 'spam',        label: 'Spam' },
  { value: 'invalid',     label: 'Không phù hợp' },
];

const QUOTE_STATUSES = [
  { value: 'new',         label: 'Mới' },
  { value: 'in_progress', label: 'Đang xử lý' },
  { value: 'done',        label: 'Đã xong' },
  { value: 'spam',        label: 'Spam' },
  { value: 'invalid',     label: 'Không phù hợp' },
];

const copy = {
  contact: {
    sectionLabel:       'LIÊN HỆ',
    listPath:           '/contacts',
    notePlaceholder:    'Ghi chú nội bộ...',
    statusPermission:   PERMISSIONS.contactUpdateStatus,
    notePermission:     PERMISSIONS.contactNoteCreate,
    assigneePermission: PERMISSIONS.contactAssign,
    archivePermission:  PERMISSIONS.contactArchive,
    restorePermission:  PERMISSIONS.contactRestore,
  },
  quote: {
    sectionLabel:       'YÊU CẦU BÁO GIÁ',
    listPath:           '/quotes',
    notePlaceholder:    'Ghi chú nội bộ...',
    statusPermission:   PERMISSIONS.quoteUpdateStatus,
    notePermission:     PERMISSIONS.quoteNoteCreate,
    assigneePermission: PERMISSIONS.quoteAssign,
    archivePermission:  PERMISSIONS.quoteArchive,
    restorePermission:  PERMISSIONS.quoteRestore,
  },
} satisfies Record<WorkbenchType, Record<string, string>>;

export function ContactQuoteDetailPage({
  type, endpoint, id
}: {
  type: WorkbenchType;
  endpoint: string;
  id: string;
}) {
  const [authState, setAuthState]     = useState<AuthState>(() => authStore.getState());
  const [data, setData]               = useState<unknown>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [actionError, setActionError] = useState('');

  const [statusDraft, setStatusDraft]   = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const statusSavingRef                 = useRef(false);
  const queuedStatusRef                 = useRef<string | null>(null);
  const [assigneeDraft, setAssigneeDraft]     = useState('');
  const [assigneeSaving, setAssigneeSaving]   = useState(false);
  const [assigneeOptions, setAssigneeOptions] = useState<Array<{ id: number; label: string; email: string | null }>>([]);
  const [noteDraft, setNoteDraft]   = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving]           = useState(false);

  const text          = copy[type];
  const detailPath    = byId(endpoint, id);
  const isQuote       = type === 'quote';
  const statusOptions = isQuote ? QUOTE_STATUSES : CONTACT_STATUSES;

  useEffect(() => {
    setAuthState(authStore.hydrate());
    return authStore.subscribe(setAuthState);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setActionError('');
    try {
      const result = await apiClient.get<unknown>(detailPath);
      const entity = extractEntity(result, type);
      setData(result);
      setStatusDraft(getString(entity, ['status']));
      setAssigneeDraft(entity.assigned_to != null ? String(entity.assigned_to) : '');
      setAssigneeOptions(extractAssigneeOptions(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được yêu cầu.');
    } finally {
      setLoading(false);
    }
  }, [detailPath, type]);

  useEffect(() => { load(); }, [load]);

  const permissions     = authState.permissions;
  const canUpdateStatus = permissions.includes(text.statusPermission);
  const canCreateNote   = permissions.includes(text.notePermission);
  const canAssign       = permissions.includes(text.assigneePermission);
  const canArchive      = text.archivePermission ? permissions.includes(text.archivePermission) : false;
  const canRestore      = text.restorePermission ? permissions.includes(text.restorePermission) : false;
  const canViewCustomer = permissions.includes(PERMISSIONS.customerRead);

  const entity     = useMemo(() => extractEntity(data, type), [data, type]);
  const notes      = useMemo(() => extractRelatedArray(data, entity, noteKeys(type)), [data, entity, type]);
  const quoteItems = useMemo(() => extractRelatedArray(data, entity, ['items', 'quote_items']), [data, entity]);

  const title         = getTitle(type, entity, id);
  const currentStatus = getString(entity, ['status']);
  const customerId    = getString(entity, ['customer_id']);
  const isDone        = currentStatus === 'done';
  const isArchived    = Boolean(entity.deleted_at);
  const messageText   = getString(entity, ['message', 'content', 'body']);

  async function applyStatus(nextStatus: string) {
    if (!nextStatus || nextStatus === currentStatus) return;

    // A select can emit consecutive changes before React has rendered the
    // disabled state. Persist the newest value after the in-flight mutation,
    // preventing an older response from overwriting the latest user intent.
    if (statusSavingRef.current) {
      queuedStatusRef.current = nextStatus;
      return;
    }

    statusSavingRef.current = true;
    setStatusSaving(true);
    setActionError('');
    try {
      let statusToSave: string | null = nextStatus;

      while (statusToSave) {
        await apiClient.put(`${detailPath}/status`, { status: statusToSave });

        const queuedStatus = queuedStatusRef.current;
        queuedStatusRef.current = null;
        statusToSave = queuedStatus && queuedStatus !== statusToSave ? queuedStatus : null;
      }

      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không cập nhật được trạng thái.');
    } finally {
      statusSavingRef.current = false;
      setStatusSaving(false);
    }
  }

  async function updateAssignee(nextValue: string) {
    const currentStr = entity.assigned_to != null ? String(entity.assigned_to) : '';
    if (nextValue === currentStr || assigneeSaving) return;
    setAssigneeSaving(true);
    setActionError('');
    try {
      await apiClient.put(`${detailPath}/assignee`, { assigned_to: nextValue ? Number(nextValue) : null });
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không phân công được.');
    } finally {
      setAssigneeSaving(false);
    }
  }

  async function createNote() {
    const note = noteDraft.trim();
    if (!note || noteSaving) return;
    setNoteSaving(true);
    setActionError('');
    try {
      await apiClient.post(`${detailPath}/internal-notes`, { note_text: note });
      setNoteDraft('');
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không thêm được ghi chú.');
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    setActionError('');
    try {
      await apiClient.post(`${detailPath}/archive`);
      window.location.href = text.listPath;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không ẩn được.');
      setConfirmArchive(false);
    } finally {
      setArchiving(false);
    }
  }

  async function handleRestore() {
    setArchiving(true);
    setActionError('');
    try {
      await apiClient.post(`${detailPath}/restore`);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không khôi phục được yêu cầu.');
    } finally {
      setArchiving(false);
    }
  }

  if (loading) return <DetailSkeleton />;
  if (error)   return <ErrorState message={error} />;

  return (
    <section className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {text.sectionLabel}
          </p>
          <h1 className="mt-1 text-[22px] font-semibold leading-7 tracking-tight text-text">
            {title}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{formatDate(entity.created_at)}</span>
            <span>·</span>
            <Badge tone={statusTone(currentStatus)}>{statusLabel(currentStatus)}</Badge>
            {isArchived && <Badge tone="archived">Đã lưu trữ</Badge>}
          </div>
        </div>

        {/* Nút hành động chính */}
        {isQuote && !isDone && !isArchived && canUpdateStatus && (
          <Button
            type="button"
            disabled={statusSaving}
            onClick={() => applyStatus('done')}
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            {statusSaving ? 'Đang lưu...' : 'Đánh dấu xong'}
          </Button>
        )}
      </div>

      {actionError && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {/* ── Body: 2 cột ── */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px]">

        {/* ── Cột trái ── */}
        <div className="space-y-4">

          {/* Sản phẩm — ưu tiên 1 */}
          {isQuote && (
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-3">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-text">Sản phẩm yêu cầu</span>
                </div>
                {quoteItems.length > 0 && (
                  <span className="text-xs text-muted-foreground">{quoteItems.length} mặt hàng</span>
                )}
              </div>
              {quoteItems.length === 0 ? (
                <p className="px-4 py-5 text-sm text-muted-foreground">
                  Khách chưa chọn sản phẩm cụ thể.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {quoteItems.map((item, index) => (
                    <ProductRow key={String(item.id ?? index)} item={item} />
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Khách hàng — ưu tiên 2 */}
          <CustomerCard entity={entity} customerId={customerId} canViewCustomer={canViewCustomer} />

          {/* Nội dung gửi kèm */}
          {messageText && (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border bg-muted px-4 py-3">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-text">Nội dung gửi kèm</span>
              </div>
              <div className="p-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {messageText}
                </p>
              </div>
            </Card>
          )}
        </div>

        {/* ── Cột phải: sidebar gọn ── */}
        <div className="space-y-4">

          {/* Trạng thái & ghi chú — gộp 1 card */}
          <Card className="overflow-hidden">

            {/* Trạng thái */}
            <div className="p-4">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Trạng thái</p>
              {canUpdateStatus && !isArchived ? (
                <Select
                  aria-label="Trạng thái"
                  value={statusDraft}
                  disabled={statusSaving}
                  onChange={(e) => {
                    setStatusDraft(e.target.value);
                    void applyStatus(e.target.value);
                  }}
                >
                  {statusOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              ) : (
                <>
                  <p className="text-sm text-text">{statusLabel(currentStatus)}</p>
                  {!isArchived && !canUpdateStatus ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Vai trò hiện tại chỉ có quyền xem, không thể cập nhật trạng thái.
                    </p>
                  ) : null}
                </>
              )}
              {statusSaving && <p className="mt-1 text-xs text-muted-foreground">Đang lưu...</p>}
            </div>

            {/* Người phụ trách — chỉ khi có options */}
            {(assigneeOptions.length > 0 || Boolean(entity.assigned_to)) && (
              <div className="border-t border-border p-4">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Người phụ trách</p>
                {canAssign && !isArchived && assigneeOptions.length > 0 ? (
                  <Select
                    aria-label="Người phụ trách"
                    value={assigneeDraft}
                    disabled={assigneeSaving}
                    onChange={(e) => {
                      setAssigneeDraft(e.target.value);
                      void updateAssignee(e.target.value);
                    }}
                  >
                    <option value="">— Chưa giao —</option>
                    {assigneeOptions.map((opt) => (
                      <option key={opt.id} value={String(opt.id)}>{opt.label}</option>
                    ))}
                  </Select>
                ) : (
                  <>
                    <p className="text-sm text-text">
                      {entity.assigned_to
                        ? formatValue(assigneeOptions.find((o) => String(o.id) === String(entity.assigned_to))?.label ?? entity.assigned_to)
                        : 'Chưa giao'}
                    </p>
                    {!isArchived && !canAssign ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Vai trò hiện tại không có quyền phân công người phụ trách.
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            )}

            {/* Ghi chú nội bộ */}
            <div className="border-t border-border p-4">
              <p className="mb-3 text-xs font-semibold text-muted-foreground">Ghi chú nội bộ</p>

              {notes.length > 0 && (
                <div className="mb-3 space-y-3">
                  {notes.map((note, index) => {
                    const author = getString(note, ['added_by_label', 'author', 'created_by_label']);
                    const initials = author
                      ? author.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                      : 'GH';
                    return (
                      <div key={String(note.id ?? index)} className="flex gap-2">
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-medium text-slate-700">{author || 'Nhân viên'}</span>
                            <span className="text-[11px] text-muted-foreground">{formatDate(note.created_at)}</span>
                          </div>
                          <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                            {formatValue(note.note_text)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {canCreateNote && !isArchived ? (
                <div className="space-y-2">
                  <Textarea
                    value={noteDraft}
                    rows={3}
                    placeholder={text.notePlaceholder}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void createNote();
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    disabled={noteSaving || !noteDraft.trim()}
                    onClick={() => void createNote()}
                  >
                    <Send className="mr-1.5 h-3 w-3" />
                    {noteSaving ? 'Đang gửi...' : 'Gửi ghi chú'}
                  </Button>
                </div>
              ) : (
                <>
                  {!isArchived && !canCreateNote ? (
                    <p className="text-xs text-muted-foreground">
                      Vai trò hiện tại không có quyền thêm ghi chú nội bộ.
                    </p>
                  ) : null}
                  {notes.length === 0 && (
                    <p className="text-sm text-muted-foreground">Chưa có ghi chú nào.</p>
                  )}
                </>
              )}
            </div>

            {/* Meta + ẩn */}
            <div className="border-t border-border px-4 py-3">
              <p className="text-[12px] text-muted-foreground">
                Gửi lúc {formatDate(entity.created_at)}
              </p>
              {canArchive && !isArchived && (
                <button
                  type="button"
                  onClick={() => setConfirmArchive(true)}
                  className="mt-2 text-[12px] text-muted-foreground underline-offset-2 hover:text-red-500 hover:underline"
                >
                  Lưu trữ yêu cầu
                </button>
              )}
              {canRestore && isArchived && (
                <button
                  type="button"
                  disabled={archiving}
                  onClick={handleRestore}
                  className="mt-2 text-[12px] font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
                >
                  {archiving ? 'Đang khôi phục...' : 'Khôi phục yêu cầu'}
                </button>
              )}
            </div>
          </Card>

        </div>
      </div>

      <ConfirmDialog
        open={confirmArchive}
        title="Lưu trữ yêu cầu này?"
        description="Yêu cầu sẽ chuyển sang mục Đã lưu trữ và có thể khôi phục khi cần."
        confirmLabel={archiving ? 'Đang xử lý...' : 'Lưu trữ'}
        tone="danger"
        onConfirm={handleArchive}
        onClose={() => setConfirmArchive(false)}
      />
    </section>
  );
}

/* ── Components ── */

function CustomerCard({
  entity,
  customerId,
  canViewCustomer
}: {
  entity: WorkbenchRecord;
  customerId: string;
  canViewCustomer: boolean;
}) {
  const name    = formatValue(entity.full_name ?? entity.customer_name);
  const company = entity.company_name ? formatValue(entity.company_name) : null;
  const phone   = entity.phone  ? formatValue(entity.phone)  : null;
  const email   = entity.email  ? formatValue(entity.email)  : null;

  const initials = name
    ? name.split(' ').filter(Boolean).map((w) => w[0]).slice(-2).join('').toUpperCase()
    : '?';

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-muted px-4 py-3">
        <UserRound className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-text">Khách hàng</span>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-text">{name}</p>
            {company && <p className="text-sm text-muted-foreground">{company}</p>}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {phone && (
            <div className="flex items-center gap-1.5 text-sm text-slate-700">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              {phone}
            </div>
          )}
          {email && (
            <div className="flex items-center gap-1.5 text-sm text-slate-700">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              {email}
            </div>
          )}
        </div>

        {customerId && canViewCustomer && (
          <LinkButton
            href={`/customers/${encodeURIComponent(customerId)}`}
            variant="ghost"
            size="sm"
            className="mt-3 w-full justify-between"
          >
            Xem lịch sử đặt hàng
            <ChevronRight className="h-4 w-4" />
          </LinkButton>
        )}
      </div>
    </Card>
  );
}

function ProductRow({ item }: { item: WorkbenchRecord }) {
  const productDeleted = Boolean(item.product_group_deleted_at);
  const productName    = formatValue(item.product_group_name ?? item.product_name_snapshot);
  const variantName    = (item.product_variant_name ?? item.variant_name_snapshot) as string | null;
  const sku            = (item.product_variant_sku ?? item.sku_snapshot) as string | null;
  const brandName      = item.brand_name as string | null;
  const thumbnailId    = item.thumbnail_file_id as string | null | undefined;
  const qty            = item.quantity;
  const notes          = (item.notes ?? item.note) as string | null;

  return (
    <div className="flex gap-3 p-4">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
        <FileImage
          fileId={thumbnailId}
          alt={productName}
          className="h-full w-full object-cover"
          fallback={
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-6 w-6 text-muted-foreground/30" />
            </div>
          }
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`font-medium leading-snug text-text${productDeleted ? ' line-through opacity-50' : ''}`}>
            {productName}
          </p>
          <span className="shrink-0 text-lg font-bold text-text">×{qty != null ? String(qty) : '?'}</span>
        </div>

        {variantName && (
          <p className="mt-0.5 text-sm text-muted-foreground">{variantName}</p>
        )}

        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {brandName && (
            <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
              {brandName}
            </span>
          )}
          {sku && (
            <span className="rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              {sku}
            </span>
          )}
        </div>

        {notes && (
          <p className="mt-1 text-xs italic text-muted-foreground">{notes}</p>
        )}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <Skeleton className="h-44 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </section>
  );
}

/* ── Helpers ── */

function extractEntity(data: unknown, type: WorkbenchType): WorkbenchRecord {
  const record = extractRecord(data);
  for (const key of [type, 'contact', 'quote', 'request']) {
    const value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as WorkbenchRecord;
    }
  }
  return record;
}

function extractRelatedArray(data: unknown, entity: WorkbenchRecord, keys: string[]) {
  const outer = data && typeof data === 'object' ? (data as WorkbenchRecord) : {};
  for (const source of [entity, outer]) {
    for (const key of keys) {
      const value = source[key];
      if (Array.isArray(value)) return value as WorkbenchRecord[];
    }
  }
  return [];
}

function noteKeys(type: WorkbenchType) {
  return type === 'contact'
    ? ['internal_notes', 'contact_internal_notes', 'notes']
    : ['internal_notes', 'quote_internal_notes', 'notes'];
}

function getTitle(type: WorkbenchType, entity: WorkbenchRecord, id: string) {
  const value = type === 'contact'
    ? getString(entity, ['full_name', 'email', 'phone'])
    : getString(entity, ['full_name', 'customer_name', 'email', 'phone']);
  return value || (type === 'quote' ? `Báo giá ${id}` : `Liên hệ ${id}`);
}

function getString(record: WorkbenchRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== '') return String(value);
  }
  return '';
}

function extractAssigneeOptions(data: unknown): Array<{ id: number; label: string; email: string | null }> {
  if (!data || typeof data !== 'object') return [];
  const opts = (data as WorkbenchRecord).assignee_options;
  if (!Array.isArray(opts)) return [];
  return opts as Array<{ id: number; label: string; email: string | null }>;
}

function statusTone(value: unknown): 'default' | 'active' | 'inactive' | 'archived' | 'success' | 'warning' | 'info' | 'danger' {
  const s = String(value || '').toLowerCase();
  if (['new', 'in_progress'].includes(s)) return 'warning';
  if (['done'].includes(s)) return 'success';
  if (['spam', 'invalid'].includes(s)) return 'danger';
  return 'info';
}

function statusLabel(value: unknown): string {
  const map: Record<string, string> = {
    new:         'Mới',
    in_progress: 'Đang xử lý',
    done:        'Đã xong',
    spam:        'Spam',
    invalid:     'Không phù hợp',
    archived:    'Đã lưu trữ',
  };
  return map[String(value || '')] ?? formatValue(value);
}

