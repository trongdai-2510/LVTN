'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { AlertTriangle } from '@/components/icons';
import { Field } from '@/components/form/Field';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiClient } from '@/lib/api-client';
import { formatValue } from '@/lib/formatters';
import {
  type RecordMap,
  type ImportBlocker,
  type ImportReadinessSummaryItem,
  type ImportCategoryTreeNode,
  type ImportNotReadyPresentation
} from './importDetailTypes';
import {
  asRecord,
  getImportBlockerChecklistItems,
  getImportBlockerPresentation,
  formatImportEntityType,
  formatSuggestedAction,
  getImportBlockerDisplayGroupKey,
  groupImportBlockers,
  canEditImportBlocker,
  canSkipImportBlocker,
  isVariantIdentifierBlocker,
  isPendingProductGroupEditableBlocker,
  normalizeImportCategoryOptions,
  findImportCategorySelection,
  getApiErrorMessage,
  requiresCategorySelection,
  getImportMutationTargetStatus,
  normalizeEditableValue,
  formatImportBlockerFieldLabel,
  formatImportBlockerHint
} from './importDetailHelpers';

export function ImportBlockerChecklist({
  blockers,
  tone
}: {
  blockers: ImportBlocker[];
  tone?: 'warning' | 'danger';
}) {
  const palette =
    tone === 'danger'
      ? {
          border: 'border-red-200',
          background: 'bg-red-50',
          text: 'text-red-800',
          title: 'text-red-900',
          badge: 'danger' as const
        }
      : {
          border: 'border-amber-200',
          background: 'bg-amber-50',
          text: 'text-amber-800',
          title: 'text-amber-900',
          badge: 'warning' as const
        };
  const items = useMemo(
    () => getImportBlockerChecklistItems(blockers),
    [blockers]
  );
  const visibleItems = items.slice(0, 4);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);

  return (
    <div className="space-y-2">
      {visibleItems.map((item) =>
        item.kind === 'blocker' ? (
          <div
            key={item.key}
            className={`rounded-sm border px-4 py-3 ${palette.border} ${palette.background}`}
          >
            {(() => {
              const presentation = getImportBlockerPresentation(item.blocker);
              return (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className={`text-sm font-semibold ${palette.title}`}>
                      {presentation.message}
                    </h3>
                    {presentation.hint ? (
                      <p className={`mt-1 text-sm ${palette.text}`}>{presentation.hint}</p>
                    ) : null}
                  </div>
                  {item.blocker.count !== undefined ? (
                    <Badge tone={palette.badge}>
                      {formatValue(item.blocker.count)}
                    </Badge>
                  ) : null}
                </div>
              );
            })()}
          </div>
        ) : (
          <div
            key={item.key}
            className={`rounded-sm border px-4 py-3 ${palette.border} ${palette.background}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className={`text-sm font-semibold ${palette.title}`}>{item.title}</h3>
                <p className={`mt-1 text-sm ${palette.text}`}>{item.summary}</p>
                <p className={`mt-1 text-sm ${palette.text}`}>{item.hint}</p>
                <p className={`mt-2 text-xs font-medium ${palette.text}`}>
                  Gợi ý xử lý: {item.actionHint}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone={palette.badge}>{formatValue(item.rowCount)} dòng</Badge>
                <Badge tone={palette.badge}>
                  {formatValue(item.duplicateValueCount)} mã trùng
                </Badge>
              </div>
            </div>

            <details className="mt-3 rounded-sm border border-border bg-white/70">
              <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Xem các dòng bị ảnh hưởng
              </summary>
              <div className="space-y-3 border-t border-border px-3 py-3">
                {item.duplicates.map((duplicate) => (
                  <div
                    key={`${item.key}-${duplicate.value}`}
                    className="rounded-sm border border-border bg-panel px-3 py-3"
                  >
                    <p className="text-sm font-semibold text-text">
                      Mã định danh từ file: {formatValue(duplicate.value)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatValue(duplicate.blockers.length)} dòng đang dùng cùng mã này.
                    </p>
                    <div className="mt-2 space-y-2">
                      {duplicate.blockers.map((blocker, index) => (
                        <div
                          key={`${item.key}-${duplicate.value}-${blocker.entityId || index}`}
                          className="rounded-sm border border-border bg-muted/40 px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-text">
                              {blocker.entityLabel || 'Dòng dữ liệu'}
                            </span>
                            <Badge tone="info">
                              {formatImportEntityType(blocker.entityType)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Gợi ý xử lý:{' '}
                            {blocker.suggestedAction
                              ? formatSuggestedAction(blocker.suggestedAction)
                              : item.actionHint}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

              </div>
            </details>
          </div>
        )
      )}
      {hiddenCount > 0 ? (
        <div className={`rounded-sm border px-4 py-3 text-sm ${palette.border} ${palette.background} ${palette.text}`}>
          Còn {formatValue(hiddenCount)} nhóm vấn đề khác trong tab Kiểm tra sẵn sàng.
        </div>
      ) : null}
    </div>
  );
}

export function ImportReadinessSummaryGrid({
  items
}: {
  items: ImportReadinessSummaryItem[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.key}
          className="rounded-sm border border-amber-200 bg-white/80 px-3 py-3"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-amber-700">
            {item.label}
          </p>
          <p className="mt-1 text-base font-semibold text-amber-900">
            {formatValue(item.value)} {item.unit}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ImportBlockerExplorer({
  blockers,
  tone,
  base,
  batchStatus,
  canMutate,
  onResolved
}: {
  blockers: ImportBlocker[];
  tone?: 'warning' | 'danger';
  base: string;
  batchStatus: string;
  canMutate: boolean;
  onResolved: (message: string) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const filteredBlockers = useMemo(() => {
    return blockers.filter((blocker) => {
      if (groupFilter !== 'all' && getImportBlockerDisplayGroupKey(blocker) !== groupFilter) {
        return false;
      }
      if (deferredQuery === '') return true;
      const haystack = [
        blocker.code,
        blocker.message,
        blocker.entityLabel,
        blocker.field,
        blocker.pendingValue,
        blocker.matchedOfficialLabel,
        getImportBlockerPresentation(blocker).message,
        getImportBlockerPresentation(blocker).hint
      ]
        .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
        .join(' ')
        .toLowerCase();
      return haystack.includes(deferredQuery);
    });
  }, [blockers, deferredQuery, groupFilter]);

  const groupedBlockers = useMemo(
    () => groupImportBlockers(filteredBlockers),
    [filteredBlockers]
  );
  const groupOptions = useMemo(() => groupImportBlockers(blockers), [blockers]);
  const palette =
    tone === 'danger'
      ? {
          shell: 'border-red-200 bg-red-50/70',
          section: 'border-red-200 bg-white/80',
          meta: 'border-red-200 bg-red-50 text-red-800',
          title: 'text-red-900',
          text: 'text-red-800',
          badge: 'danger' as const
        }
      : {
          shell: 'border-amber-200 bg-amber-50/70',
          section: 'border-amber-200 bg-white/80',
          meta: 'border-amber-200 bg-amber-50 text-amber-800',
          title: 'text-amber-900',
          text: 'text-amber-800',
          badge: 'warning' as const
        };

  return (
    <div className="space-y-3">
      <div className={`rounded-sm border p-3 ${palette.shell}`}>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <Field label="Tìm vấn đề">
            <Input
              value={query}
              maxLength={255}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tên dòng, mã sản phẩm, SKU hoặc mã định danh từ file"
            />
          </Field>
          <Field label="Nhóm vấn đề">
            <Select
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
            >
              <option value="all">Tất cả vấn đề</option>
              {groupOptions.map((group) => (
                <option key={group.key} value={group.key}>
                  {group.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      {groupedBlockers.length === 0 ? (
        <EmptyState
          title="Không tìm thấy vấn đề phù hợp"
          description="Thử đổi từ khóa tìm kiếm hoặc bỏ bộ lọc nhóm vấn đề."
        />
      ) : (
        groupedBlockers.map((group) => (
          <div key={group.key} className={`rounded-sm border ${palette.section}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h3 className={`text-sm font-semibold ${palette.title}`}>{group.label}</h3>
                <p className={`mt-1 text-xs ${palette.text}`}>
                  {formatValue(group.count)} vấn đề trong nhóm này.
                </p>
              </div>
              <Badge tone={palette.badge}>{formatValue(group.count)}</Badge>
            </div>
            <div className="space-y-3 px-4 py-4">
                {group.blockers.map((blocker, index) => (
                  <ImportBlockerRow
                    key={`${blocker.code || 'blocker'}-${blocker.entityId || index}`}
                    blocker={blocker}
                    badgeTone={palette.badge}
                    metaClassName={palette.meta}
                    base={base}
                    batchStatus={batchStatus}
                    canMutate={canMutate}
                    onResolved={onResolved}
                  />
                ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ImportBlockerRow({
  blocker,
  badgeTone,
  metaClassName,
  base,
  batchStatus,
  canMutate,
  onResolved
}: {
  blocker: ImportBlocker;
  badgeTone: 'warning' | 'danger';
  metaClassName: string;
  base: string;
  batchStatus: string;
  canMutate: boolean;
  onResolved: (message: string) => Promise<void>;
}) {
  const presentation = getImportBlockerPresentation(blocker);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [variantForm, setVariantForm] = useState({
    externalCode: '',
    sku: '',
    modelCode: ''
  });
  const [groupForm, setGroupForm] = useState({
    externalCode: '',
    rootCategoryId: '',
    categoryId: ''
  });
  const [categoryOptions, setCategoryOptions] = useState<ImportCategoryTreeNode[]>([]);
  const canEdit = canMutate && canEditImportBlocker(blocker);
  const canSkip = canMutate && canSkipImportBlocker(blocker);
  const isVariantEdit = isVariantIdentifierBlocker(blocker);
  const isGroupEdit = isPendingProductGroupEditableBlocker(blocker);
  const selectedRoot = useMemo(
    () => categoryOptions.find((item) => item.id === groupForm.rootCategoryId) ?? null,
    [categoryOptions, groupForm.rootCategoryId]
  );

  async function openEditor() {
    if (!canEdit || !blocker.entityId) return;
    setSubmitError('');
    setLoading(true);
    try {
      if (isVariantEdit) {
        const response = await apiClient.get<RecordMap>(
          `${base}/pending-variants/${encodeURIComponent(blocker.entityId)}`
        );
        const item = asRecord(response.item);
        setVariantForm({
          externalCode: typeof item.external_code === 'string' ? item.external_code : '',
          sku: typeof item.sku === 'string' ? item.sku : '',
          modelCode: typeof item.model_code === 'string' ? item.model_code : ''
        });
      } else if (isGroupEdit) {
        const [detailResponse, categoriesResponse] = await Promise.all([
          apiClient.get<RecordMap>(
            `${base}/pending-product-groups/${encodeURIComponent(blocker.entityId)}`
          ),
          apiClient.get<RecordMap>(`${base}/category-options`)
        ]);
        const item = asRecord(detailResponse.item);
        const options = normalizeImportCategoryOptions(categoriesResponse.items);
        const selectedCategory = findImportCategorySelection(
          options,
          typeof item.main_category_name === 'string' ? item.main_category_name : '',
          typeof item.category_name === 'string' ? item.category_name : ''
        );
        setCategoryOptions(options);
        setGroupForm({
          externalCode: typeof item.external_code === 'string' ? item.external_code : '',
          rootCategoryId: selectedCategory.rootCategoryId,
          categoryId: selectedCategory.categoryId
        });
      }
      setEditing(true);
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(error, 'Không tải được dữ liệu của vấn đề này để chỉnh sửa.')
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit() {
    if (!blocker.entityId) return;
    if (!isVariantEdit && !isGroupEdit) return;
    if (isGroupEdit && requiresCategorySelection(blocker) && !groupForm.categoryId) {
      setSubmitError('Vui lòng chọn danh mục con trước khi lưu thay đổi.');
      return;
    }

    setSubmitError('');
    setLoading(true);
    try {
      if (isVariantEdit) {
        await apiClient.post(`${base}/review-transition`, {
          target_status: getImportMutationTargetStatus(batchStatus),
          pending_variants: [
            {
              id: blocker.entityId,
              external_code: normalizeEditableValue(variantForm.externalCode),
              sku: normalizeEditableValue(variantForm.sku),
              model_code: normalizeEditableValue(variantForm.modelCode)
            }
          ]
        });
        await onResolved('Đã cập nhật biến thể tạm và kiểm tra lại điều kiện áp dụng.');
      } else {
        const payload: RecordMap = {
          id: blocker.entityId,
          external_code: normalizeEditableValue(groupForm.externalCode)
        };
        if (groupForm.categoryId) payload.category_id = groupForm.categoryId;
        await apiClient.post(`${base}/review-transition`, {
          target_status: getImportMutationTargetStatus(batchStatus),
          pending_product_groups: [payload]
        });
        await onResolved('Đã cập nhật nhóm sản phẩm tạm và kiểm tra lại điều kiện áp dụng.');
      }
      setEditing(false);
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Không thể lưu thay đổi cho vấn đề này.'));
    } finally {
      setLoading(false);
    }
  }

  async function skipRow() {
    if (!canSkip || !blocker.entityId || !blocker.entityType) return;
    const confirmed = window.confirm(
      'Bỏ qua dòng tạm này? Dòng bị bỏ qua sẽ không còn chặn readiness và sẽ không được áp dụng.'
    );
    if (!confirmed) return;

    setSubmitError('');
    setLoading(true);
    try {
      if (blocker.entityType === 'pending_variant') {
        await apiClient.post(`${base}/review-transition`, {
          target_status: getImportMutationTargetStatus(batchStatus),
          pending_variants: [{ id: blocker.entityId, status: 'rejected' }]
        });
      } else if (blocker.entityType === 'pending_product_group') {
        await apiClient.post(`${base}/review-transition`, {
          target_status: getImportMutationTargetStatus(batchStatus),
          pending_product_groups: [{ id: blocker.entityId, status: 'rejected' }]
        });
      }
      await onResolved('Đã bỏ qua dòng tạm và cập nhật lại điều kiện áp dụng.');
      setEditing(false);
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Không thể bỏ qua dòng dữ liệu này.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-sm border border-border bg-panel px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-text">
              {blocker.entityLabel || 'Dòng dữ liệu'}
            </h4>
            <Badge tone="info">{formatImportEntityType(blocker.entityType)}</Badge>
          </div>
          <p className="mt-2 text-sm font-medium text-text">{presentation.message}</p>
          {presentation.hint ? (
            <p className="mt-1 text-sm text-muted-foreground">{presentation.hint}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {blocker.field ? (
              <span className={`rounded-sm border px-2 py-1 ${metaClassName}`}>
                Trường: {formatImportBlockerFieldLabel(blocker.field)}
              </span>
            ) : null}
            {blocker.pendingValue ? (
              <span className={`rounded-sm border px-2 py-1 ${metaClassName}`}>
                Giá trị hiện tại: {blocker.pendingValue}
              </span>
            ) : null}
            {blocker.matchedOfficialLabel ? (
              <span className={`rounded-sm border px-2 py-1 ${metaClassName}`}>
                Bản ghi liên quan: {blocker.matchedOfficialLabel}
              </span>
            ) : null}
              {blocker.suggestedAction ? (
                <span className={`rounded-sm border px-2 py-1 ${metaClassName}`}>
                  Gợi ý xử lý: {formatSuggestedAction(blocker.suggestedAction)}
                </span>
              ) : null}
            </div>
            {canEdit || canSkip ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {canEdit ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={loading}
                    onClick={() => void openEditor()}
                  >
                    {loading && !editing ? 'Đang tải' : 'Sửa'}
                  </Button>
                ) : null}
                {canSkip ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={loading}
                    onClick={() => void skipRow()}
                  >
                    Bỏ qua dòng này
                  </Button>
                ) : null}
              </div>
            ) : null}
            {submitError ? (
              <div className="mt-3 rounded-sm border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
                {submitError}
              </div>
            ) : null}
            {editing ? (
              <div className="mt-3 rounded-sm border border-border bg-muted/40 p-3">
                {isVariantEdit ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Mã liên kết">
                        <Input
                          value={variantForm.externalCode}
                          onChange={(event) =>
                            setVariantForm((current) => ({
                              ...current,
                              externalCode: event.target.value
                            }))
                          }
                          placeholder="Nhập mã liên kết nếu cần"
                        />
                      </Field>
                      <Field label="SKU">
                        <Input
                          value={variantForm.sku}
                          onChange={(event) =>
                            setVariantForm((current) => ({
                              ...current,
                              sku: event.target.value
                            }))
                          }
                          placeholder="Nhập SKU"
                        />
                      </Field>
                      <Field label="Mã sản phẩm">
                        <Input
                          value={variantForm.modelCode}
                          onChange={(event) =>
                            setVariantForm((current) => ({
                              ...current,
                              modelCode: event.target.value
                            }))
                          }
                          placeholder="Nhập mã sản phẩm"
                        />
                      </Field>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Khoảng trắng thừa sẽ được tự dọn. Hệ thống sẽ kiểm tra lại ngay sau khi lưu.
                    </p>
                  </div>
                ) : isGroupEdit ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Mã liên kết">
                        <Input
                          value={groupForm.externalCode}
                          onChange={(event) =>
                            setGroupForm((current) => ({
                              ...current,
                              externalCode: event.target.value
                            }))
                          }
                          placeholder="Nhập mã liên kết nếu cần"
                        />
                      </Field>
                      <Field label="Danh mục chính">
                        <Select
                          value={groupForm.rootCategoryId}
                          onChange={(event) =>
                            setGroupForm((current) => ({
                              ...current,
                              rootCategoryId: event.target.value,
                              categoryId: ''
                            }))
                          }
                        >
                          <option value="">Chọn danh mục chính</option>
                          {categoryOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Danh mục con">
                        <Select
                          value={groupForm.categoryId}
                          onChange={(event) =>
                            setGroupForm((current) => ({
                              ...current,
                              categoryId: event.target.value
                            }))
                          }
                          disabled={!groupForm.rootCategoryId}
                        >
                          <option value="">Chọn danh mục con</option>
                          {(selectedRoot?.children ?? []).map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Khi lưu danh mục con, hệ thống sẽ tự ghi lại đúng danh mục chính tương ứng cho dòng tạm này.
                    </p>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={loading}
                    onClick={() => void saveEdit()}
                  >
                    {loading ? 'Đang lưu thay đổi' : 'Lưu thay đổi'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={loading}
                    onClick={() => {
                      setEditing(false);
                      setSubmitError('');
                    }}
                  >
                    Hủy
                  </Button>
                </div>
              </div>
            ) : null}
        </div>
        {blocker.count !== undefined ? (
          <Badge tone={badgeTone}>{formatValue(blocker.count)}</Badge>
        ) : null}
      </div>
    </div>
  );
}

export function ImportApplyBlockedAlert({
  error,
  base,
  batchStatus,
  canMutate,
  onResolved
}: {
  error: ImportNotReadyPresentation;
  base: string;
  batchStatus: string;
  canMutate: boolean;
  onResolved: (message: string) => Promise<void>;
}) {
  const firstBlocker = error.blockers[0];
  const firstHint = firstBlocker ? formatImportBlockerHint(firstBlocker) : '';

  return (
    <Card className="border-red-200 bg-red-50 px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-red-200 bg-white text-red-700">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-red-900">
            Chưa thể áp dụng lô nhập
          </h2>
          <p className="mt-1 text-sm text-red-800">
            Lô này chưa thể áp dụng vì còn dữ liệu trùng hoặc thiếu thông tin.
          </p>
          <div className="mt-3 space-y-3">
            <div className="rounded-sm border border-red-200 bg-white/70 px-3 py-3 text-xs leading-5 text-red-900">
              <p className="font-semibold">
                Tổng cộng {formatValue(error.blockerCount)} vấn đề đang chặn thao tác áp dụng.
              </p>
              {firstHint ? <p className="mt-1 text-red-800">{firstHint}</p> : null}
            </div>
            <ImportBlockerExplorer
              blockers={error.blockers}
              tone="danger"
              base={base}
              batchStatus={batchStatus}
              canMutate={canMutate}
              onResolved={onResolved}
            />
          </div>
          <p className="mt-3 text-xs leading-5 text-red-700">
            Mở phần kiểm tra sẵn sàng để xem đầy đủ từng dòng cần chỉnh sửa hoặc tiếp tục bước duyệt dữ liệu tạm.
          </p>
        </div>
      </div>
    </Card>
  );
}

export function ImportDetailSkeleton() {
  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-7 w-80" />
        <Skeleton className="h-4 w-[560px]" />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-[560px] w-full" />
    </section>
  );
}
