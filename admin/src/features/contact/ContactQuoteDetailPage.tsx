'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
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
import { adminPath } from '@/lib/admin-navigation';
import { formatDate, formatValue } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';

type WorkbenchType = 'contact' | 'quote';
type WorkbenchRecord = Record<string, unknown>;
const quotePriceFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND', maximumFractionDigits: 0
});

const CONTACT_STATUSES = [
  { value: 'new',         label: 'Mới' },
  { value: 'in_progress', label: 'Đang xử lý' },
  { value: 'done',        label: 'Đã xong' },
  { value: 'spam',        label: 'Spam' },
  { value: 'invalid',     label: 'Không hợp lệ' },
];

const QUOTE_STATUSES = [
  { value: 'new',         label: 'Mới' },
  { value: 'in_progress', label: 'Đang xử lý' },
  { value: 'done',        label: 'Đã xong' },
  { value: 'spam',        label: 'Spam' },
  { value: 'invalid',     label: 'Không hợp lệ' },
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

  const showDetail = useCallback((result: unknown) => {
    const entity = extractEntity(result, type);
    setData(result);
    setStatusDraft(getString(entity, ['status']));
    setAssigneeDraft(entity.assigned_to != null ? String(entity.assigned_to) : '');
    setAssigneeOptions(extractAssigneeOptions(result));
  }, [type]);

  const load = useCallback(async (refresh = false) => {
    if (!refresh) {
      setLoading(true);
      setError('');
      setActionError('');
    }
    try {
      const result = await apiClient.get<unknown>(detailPath);
      showDetail(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không tải được yêu cầu.';
      if (refresh) setActionError(message);
      else setError(message);
    } finally {
      if (!refresh) setLoading(false);
    }
  }, [detailPath, showDetail]);

  useEffect(() => { void load(); }, [load]);

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
  const assigneeId    = entity.assigned_to != null ? String(entity.assigned_to) : '';
  const assigneeIsAvailable = assigneeOptions.some((option) => String(option.id) === assigneeId);
  const assigneeLabel = getString(entity, ['assigned_to_label']) ||
    assigneeOptions.find((option) => String(option.id) === assigneeId)?.label ||
    (assigneeId ? 'Người phụ trách không còn trong hệ thống' : 'Chưa giao');
  const messageText   = getString(entity, ['message', 'content', 'body']);
  const projectName = getString(entity, ['project_name']);
  const projectContext = getString(entity, ['project_context']);
  const projectRequirements = getProjectRequirements(entity.project_requirements);
  const unresolvedQuantityCount = quoteItems.filter(
    (item) => item.quantity_state === 'unspecified' || item.quantity == null
  ).length;
  const hasProjectBrief = Boolean(
    projectName || projectContext || projectRequirements.length > 0
  );
  const allowedActions = [
    canUpdateStatus && 'đổi trạng thái',
    canAssign && 'phân công',
    canCreateNote && 'ghi chú',
    canArchive && 'lưu trữ'
  ].filter(Boolean).join(' · ');
  const permissionSummary = isArchived
    ? canRestore ? 'Đã lưu trữ · Bạn có thể khôi phục yêu cầu.' : 'Đã lưu trữ · Bạn chỉ có thể xem yêu cầu.'
    : `Quyền của bạn: ${allowedActions || 'chỉ xem yêu cầu'}.`;

  async function applyStatus(nextStatus: string) {
    if (!nextStatus) return;

    if (!statusSavingRef.current && nextStatus === currentStatus) return;

    queuedStatusRef.current = nextStatus;

    // A select can emit consecutive changes before React has rendered the
    // disabled state. Keep draining the latest intent, including changes that
    // arrive while the previous API request is still pending.
    if (statusSavingRef.current) {
      return;
    }

    statusSavingRef.current = true;
    setStatusSaving(true);
    setActionError('');
    let lastPersistedStatus = currentStatus;
    try {
      while (true) {
        const queuedStatus = queuedStatusRef.current;
        queuedStatusRef.current = null;
        if (queuedStatus && queuedStatus !== lastPersistedStatus) {
          const result = await apiClient.put<unknown>(`${detailPath}/status`, { status: queuedStatus });
          showDetail(result);
          lastPersistedStatus = queuedStatus;
          continue;
        }

        break;
      }
    } catch (err) {
      queuedStatusRef.current = null;
      setStatusDraft(lastPersistedStatus);
      await load(true);
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
      const result = await apiClient.put<unknown>(`${detailPath}/assignee`, { assigned_to: nextValue ? Number(nextValue) : null });
      showDetail(result);
    } catch (err) {
      setAssigneeDraft(currentStr);
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
      const result = await apiClient.post<unknown>(`${detailPath}/internal-notes`, { note_text: note });
      showDetail(result);
      setNoteDraft('');
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
      window.location.assign(adminPath(text.listPath));
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
      const result = await apiClient.post<unknown>(`${detailPath}/restore`);
      showDetail(result);
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
            {isQuote && unresolvedQuantityCount > 0 ? (
              <Badge tone="warning">{unresolvedQuantityCount} mục cần xác nhận</Badge>
            ) : null}
          </div>
        </div>

        {/* Nút hành động chính */}
        {!isDone && !isArchived && canUpdateStatus && ['new', 'in_progress'].includes(currentStatus) && (
          <Button
            type="button"
            disabled={statusSaving}
            onClick={() => applyStatus('done')}
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            {statusSaving ? 'Đang lưu...' : 'Đánh dấu đã xong'}
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

          {isQuote && hasProjectBrief ? (
            <ProjectBriefCard
              context={projectContext}
              name={projectName}
              requirements={projectRequirements}
            />
          ) : null}

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

          {/* Các thao tác xử lý hiện có, theo quyền của vai trò */}
          <Card className="overflow-hidden border-[#c7d9e8]">
            <div className="border-b border-[#d4e3ef] bg-[#eef5fb] px-4 py-3">
              <div className="flex items-center gap-2 text-primary">
                <ClipboardList className="h-4 w-4" />
                <h2 className="text-sm font-semibold text-text">Xử lý yêu cầu</h2>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-700">{permissionSummary}</p>
            </div>

            {/* Trạng thái */}
            <div className="p-4">
              <p className="mb-2 text-sm font-semibold text-text">Trạng thái xử lý</p>
              {canUpdateStatus && !isArchived ? (
                <>
                  <Select
                    aria-label="Trạng thái"
                    className="border-[#b9cddd] bg-white font-medium"
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
                  <p className="mt-2 text-xs text-slate-600">Chọn trạng thái để lưu ngay.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-text">{statusLabel(currentStatus)}</p>
                  {!isArchived && !canUpdateStatus ? (
                    <p className="mt-1 text-xs text-slate-600">
                      Bạn có thể xem nhưng không có quyền đổi trạng thái.
                    </p>
                  ) : null}
                </>
              )}
              {statusSaving && <p className="mt-2 text-xs font-medium text-primary">Đang lưu trạng thái...</p>}
            </div>

            {/* Người phụ trách */}
            <div className="border-t border-border p-4">
              <p className="mb-2 text-sm font-semibold text-text">Người phụ trách</p>
              {canAssign && !isArchived && assigneeOptions.length > 0 ? (
                <Select
                  aria-label="Người phụ trách"
                  className="border-[#b9cddd] bg-white font-medium"
                  value={assigneeDraft}
                  disabled={assigneeSaving}
                  onChange={(e) => {
                    setAssigneeDraft(e.target.value);
                    void updateAssignee(e.target.value);
                  }}
                >
                  <option value="">— Chưa giao —</option>
                  {assigneeId && !assigneeIsAvailable ? (
                    <option value={assigneeId}>{assigneeLabel} (không còn đủ điều kiện nhận việc)</option>
                  ) : null}
                  {assigneeOptions.map((opt) => (
                    <option key={opt.id} value={String(opt.id)}>{opt.label}</option>
                  ))}
                </Select>
              ) : (
                <>
                  <p className="text-sm font-medium text-text">{assigneeLabel}</p>
                  {!isArchived && !canAssign ? (
                    <p className="mt-1 text-xs text-slate-600">
                      Bạn có thể xem nhưng không có quyền phân công.
                    </p>
                  ) : null}
                  {!isArchived && canAssign && assigneeOptions.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-600">Chưa có tài khoản đủ quyền để nhận việc.</p>
                  ) : null}
                </>
              )}
              <p className="mt-2 text-xs leading-5 text-slate-600">
                Chỉ tài khoản có quyền xem và đổi trạng thái mới nhận việc. Người được giao hiển thị trên danh sách để theo dõi.
              </p>
              {assigneeSaving && <p className="mt-1 text-xs font-medium text-primary">Đang lưu phân công...</p>}
            </div>

            {/* Ghi chú nội bộ */}
            <div className="border-t border-border p-4">
              <p className="mb-3 text-sm font-semibold text-text">Ghi chú nội bộ</p>

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
                    maxLength={10_000}
                    placeholder={text.notePlaceholder}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void createNote();
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="w-full font-semibold disabled:bg-slate-200 disabled:text-slate-600 disabled:opacity-100"
                    disabled={noteSaving || !noteDraft.trim()}
                    onClick={() => void createNote()}
                  >
                    <Send className="mr-1.5 h-3 w-3" />
                    {noteSaving ? 'Đang gửi...' : 'Gửi ghi chú'}
                  </Button>
                  {!noteDraft.trim() && !noteSaving ? (
                    <p className="text-xs text-slate-600">Nhập ghi chú để bật nút gửi.</p>
                  ) : null}
                </div>
              ) : (
                <>
                  {!isArchived && !canCreateNote ? (
                    <p className="text-xs text-slate-600">
                      Bạn có thể xem nhưng không có quyền thêm ghi chú nội bộ.
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
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirmArchive(true)}
                  className="mt-3 w-full border-slate-300 font-semibold text-slate-700"
                >
                  Lưu trữ yêu cầu
                </Button>
              )}
              {canRestore && isArchived && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={archiving}
                  onClick={handleRestore}
                  className="mt-3 w-full border-slate-300 font-semibold text-primary"
                >
                  {archiving ? 'Đang khôi phục...' : 'Khôi phục yêu cầu'}
                </Button>
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

function ProjectBriefCard({
  context,
  name,
  requirements
}: {
  context: string;
  name: string;
  requirements: Array<{ label: string; value: string }>;
}) {
  return (
    <Card className="overflow-hidden border-primary/20">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/15 bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-text">Hồ sơ dự án khách cung cấp</span>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          Nguồn: website
        </span>
      </div>
      <div className="space-y-5 p-4">
        {name ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dự án / công trình</p>
            <p className="mt-1 text-base font-semibold text-text">{name}</p>
          </div>
        ) : null}
        {context ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bối cảnh nguyên văn</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{context}</p>
          </div>
        ) : null}
        {requirements.length > 0 ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            {requirements.map((requirement, index) => (
              <div className="rounded-md border border-border bg-muted/50 px-3 py-3" key={`${requirement.label}-${index}`}>
                <dt className="text-xs font-semibold text-muted-foreground">{requirement.label}</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm font-medium leading-5 text-text">{requirement.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </Card>
  );
}

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
  const quantityRaw    = typeof item.quantity_raw === 'string' ? item.quantity_raw : null;
  const quantityUnit   = typeof item.quantity_unit === 'string' ? item.quantity_unit : null;
  const quantityState  = item.quantity_state === 'unspecified' || qty == null
    ? 'unspecified'
    : 'confirmed';
  const notes          = (item.notes ?? item.note) as string | null;
  const priceSnapshot  = typeof item.public_price_amount_at_request === 'number'
    ? item.public_price_amount_at_request
    : null;

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
          {quantityState === 'confirmed' ? (
            <span className="shrink-0 text-lg font-bold text-text">
              ×{String(qty)}{quantityUnit ? ` ${quantityUnit}` : ''}
            </span>
          ) : (
            <Badge tone="warning">Cần xác nhận</Badge>
          )}
        </div>

        {variantName && (
          <p className="mt-0.5 text-sm text-muted-foreground">{variantName}</p>
        )}

        {priceSnapshot !== null && priceSnapshot > 0 ? (
          <p className="mt-2 text-sm font-semibold tabular-nums text-primary">
            Giá công khai lúc gửi: {quotePriceFormatter.format(priceSnapshot)}
          </p>
        ) : null}

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

        {quantityState === 'unspecified' ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div>
                <p className="text-xs font-semibold text-amber-900">
                  Khách nhập: “{quantityRaw || 'chưa ghi số lượng'}{quantityUnit ? ` ${quantityUnit}` : ''}”
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  Hệ thống chưa diễn giải thành số. Cần hỏi lại khách trước khi lập báo giá.
                </p>
              </div>
            </div>
          </div>
        ) : quantityRaw ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Nguyên văn khách nhập: “{quantityRaw}{quantityUnit ? ` ${quantityUnit}` : ''}” · Đã xác nhận thành {String(qty)}
          </p>
        ) : null}
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
  if (type === 'quote') {
    const projectName = getString(entity, ['project_name']);
    if (projectName) return projectName;
  }
  const value = type === 'contact'
    ? getString(entity, ['full_name', 'email', 'phone'])
    : getString(entity, ['full_name', 'customer_name', 'email', 'phone']);
  return value || (type === 'quote' ? `Báo giá ${id}` : `Liên hệ ${id}`);
}

function getProjectRequirements(value: unknown): Array<{ label: string; value: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const label = typeof record.label === 'string' ? record.label.trim() : '';
    const requirementValue = typeof record.value === 'string' ? record.value.trim() : '';
    return label && requirementValue ? [{ label, value: requirementValue }] : [];
  });
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
    invalid:     'Không hợp lệ',
    archived:    'Đã lưu trữ',
  };
  return map[String(value || '')] ?? formatValue(value);
}

