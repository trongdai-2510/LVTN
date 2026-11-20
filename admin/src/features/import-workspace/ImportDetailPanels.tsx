'use client';

import { Fragment, type ReactNode } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  DatabaseZap,
  Eye,
  FileCheck2,
  GitPullRequest,
  ListChecks,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2
} from '@/components/icons';
import { Pagination } from '@/components/data-table/Pagination';
import { Field } from '@/components/form/Field';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ImportWorkbookPreview } from '@/features/import-workspace/ImportWorkbookPreview';
import { cn } from '@/lib/cn';
import { formatDate, formatValue } from '@/lib/formatters';
import {
  type RecordMap,
  type PendingGroupRow,
  type ReviewFilterKey,
  type PendingVariantRow,
  GROUP_FILTERS,
  type ConflictRow,
  type ApplyPreviewResponse
} from './importDetailTypes';
import {
  statusTone,
  formatPendingStatus,
  asRecord,
  getImportBlockers,
  getImportReadinessSummaryItems,
  getImportWorkflowGuide,
  isWorkflowStatusOnlyBlocker
} from './importDetailHelpers';
import {
  ImportReadinessSummaryGrid,
  ImportBlockerExplorer,
  ImportBlockerChecklist
} from './ImportReadinessPanels';

export function OverviewPanel({
  batch,
  stats,
  preview
}: {
  batch: RecordMap;
  stats: RecordMap;
  preview: RecordMap;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Dòng dữ liệu" value={stats.raw_data_count ?? batch.total_rows} />
        <Metric label="Nhóm sản phẩm tạm" value={stats.pending_product_group_count} />
        <Metric label="Biến thể tạm" value={stats.pending_variant_count} />
        <Metric
          label="Xung đột mở"
          value={stats.open_conflict_count ?? batch.conflict_count}
          tone="warning"
        />
      </div>

      <ImportWorkbookPreview
        preview={preview}
        title="Xem trước tệp"
        subtitle="Xem tên cột và dữ liệu mẫu của lô nhập."
      />
    </div>
  );
}

export function PendingGroupsPanel(props: {
  rows: PendingGroupRow[];
  pagination: { page: number; page_size: number; total: number };
  filter: ReviewFilterKey;
  query: string;
  selectedIds: string[];
  expandedId: string;
  canReview: boolean;
  bulkSubmitting: boolean;
  onFilterChange: (value: ReviewFilterKey) => void;
  onQueryChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onToggleSelected: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleExpanded: (id: string) => void;
  onApprove: (id: string) => void;
  onSkip: (id: string) => void;
  onApproveSelected: () => void;
  onSkipSelected: () => void;
  onApproveAllValid: () => void;
}) {
  const allSelected =
    props.rows.length > 0 &&
    props.rows.every((row) => props.selectedIds.includes(String(row.id || '')));
  const selectedRows = props.rows.filter((row) =>
    props.selectedIds.includes(String(row.id || ''))
  );
  const hasSelectedRows = selectedRows.length > 0;
  const hasSelectedValidRows = selectedRows.some(
    (row) => String(row.status || '') === 'pending_review' && !row.conflict_id
  );

  return (
    <PendingReviewPanelLayout
      title="Nhóm sản phẩm tạm"
      total={props.pagination.total}
      filter={props.filter}
      query={props.query}
      onFilterChange={props.onFilterChange}
      onQueryChange={props.onQueryChange}
      selectedCount={selectedRows.length}
      onApproveAllValid={props.onApproveAllValid}
      onApproveSelected={props.onApproveSelected}
      onSkipSelected={props.onSkipSelected}
      canReview={props.canReview}
      bulkSubmitting={props.bulkSubmitting}
      hasSelectedRows={hasSelectedRows}
      hasSelectedValidRows={hasSelectedValidRows}
      searchPlaceholder="Tìm theo tên nhóm, danh mục, thương hiệu..."
      dataPanelKey="groups"
    >
      {props.rows.length === 0 ? (
        <EmptyState
          title="Không có nhóm sản phẩm tạm"
          description="Không có nhóm sản phẩm tạm phù hợp với bộ lọc hiện tại."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-sm border border-border">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(event) => props.onToggleSelectAll(event.target.checked)}
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Nhóm sản phẩm tạm
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Phân loại
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Trạng thái
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-panel">
                {props.rows.map((row) => {
                  const rowId = String(row.id || '');
                  const hasConflict = Boolean(row.conflict_id);
                  const isPending = String(row.status || '') === 'pending_review';
                  const isExpanded = props.expandedId === rowId;
                  return (
                    <Fragment key={rowId}>
                      <tr>
                        <td className="px-3 py-3 align-top">
                          <input
                            type="checkbox"
                            checked={props.selectedIds.includes(rowId)}
                            onChange={() => props.onToggleSelected(rowId)}
                          />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <PrimaryCell
                            value={row.product_name}
                            sub={
                              row.mapped_official_id
                                ? 'Sẽ cập nhật bản ghi hiện có'
                                : 'Sẽ tạo bản ghi mới'
                            }
                          />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="space-y-1">
                            <div className="text-sm text-text">
                              Danh mục: {formatValue(row.category_name)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Thương hiệu: {formatValue(row.brand_name)}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-col items-start gap-2">
                            <Badge tone={statusTone(row.status)}>
                              {formatPendingStatus(row.status)}
                            </Badge>
                            {hasConflict ? (
                              <Badge tone="warning">Có lỗi cần xử lý</Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              data-import-approve-row="groups"
                              disabled={!props.canReview || !isPending || hasConflict}
                              onClick={() => void props.onApprove(rowId)}
                            >
                              Duyệt
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              data-import-skip-row="groups"
                              disabled={!props.canReview || !isPending}
                              onClick={() => void props.onSkip(rowId)}
                            >
                              Bỏ qua
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              data-import-toggle-row-detail="groups"
                              onClick={() => props.onToggleExpanded(rowId)}
                            >
                              <Eye className="h-4 w-4" />
                              {isExpanded ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr>
                          <td colSpan={5} className="bg-muted px-4 py-3">
                            <div className="grid gap-3 md:grid-cols-2">
                              <InfoCard
                                label="Mã ngoài"
                                value={row.external_code}
                              />
                              <InfoCard
                                label="Ghi chú duyệt"
                                value={row.review_note}
                              />
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={props.pagination.page}
            pageSize={props.pagination.page_size}
            total={props.pagination.total}
            onPageChange={props.onPageChange}
          />
        </>
      )}
    </PendingReviewPanelLayout>
  );
}

export function PendingVariantsPanel(props: {
  rows: PendingVariantRow[];
  pagination: { page: number; page_size: number; total: number };
  filter: ReviewFilterKey;
  query: string;
  selectedIds: string[];
  expandedId: string;
  canReview: boolean;
  bulkSubmitting: boolean;
  onFilterChange: (value: ReviewFilterKey) => void;
  onQueryChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onToggleSelected: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleExpanded: (id: string) => void;
  onApprove: (id: string) => void;
  onSkip: (id: string) => void;
  onApproveSelected: () => void;
  onSkipSelected: () => void;
  onApproveAllValid: () => void;
}) {
  const allSelected =
    props.rows.length > 0 &&
    props.rows.every((row) => props.selectedIds.includes(String(row.id || '')));
  const selectedRows = props.rows.filter((row) =>
    props.selectedIds.includes(String(row.id || ''))
  );
  const hasSelectedRows = selectedRows.length > 0;
  const hasSelectedValidRows = selectedRows.some(
    (row) => String(row.status || '') === 'pending_review' && !row.conflict_id
  );

  return (
    <PendingReviewPanelLayout
      title="Biến thể tạm"
      total={props.pagination.total}
      filter={props.filter}
      query={props.query}
      onFilterChange={props.onFilterChange}
      onQueryChange={props.onQueryChange}
      selectedCount={selectedRows.length}
      onApproveAllValid={props.onApproveAllValid}
      onApproveSelected={props.onApproveSelected}
      onSkipSelected={props.onSkipSelected}
      canReview={props.canReview}
      bulkSubmitting={props.bulkSubmitting}
      hasSelectedRows={hasSelectedRows}
      hasSelectedValidRows={hasSelectedValidRows}
      searchPlaceholder="Tìm theo tên biến thể, SKU, mã ngoài..."
      dataPanelKey="variants"
    >
      {props.rows.length === 0 ? (
        <EmptyState
          title="Không có biến thể tạm"
          description="Không có biến thể tạm phù hợp với bộ lọc hiện tại."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-sm border border-border">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(event) => props.onToggleSelectAll(event.target.checked)}
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Biến thể tạm
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Nhánh giá
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Trạng thái
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-panel">
                {props.rows.map((row) => {
                  const rowId = String(row.id || '');
                  const hasConflict = Boolean(row.conflict_id);
                  const isPending = String(row.status || '') === 'pending_review';
                  const isExpanded = props.expandedId === rowId;
                  const pendingProductGroup = asRecord(row.pending_product_group);
                  return (
                    <Fragment key={rowId}>
                      <tr>
                        <td className="px-3 py-3 align-top">
                          <input
                            type="checkbox"
                            checked={props.selectedIds.includes(rowId)}
                            onChange={() => props.onToggleSelected(rowId)}
                          />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <PrimaryCell
                            value={row.variant_name}
                            sub={formatValue(pendingProductGroup.product_name)}
                          />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="space-y-1">
                            <div className="text-sm text-text">
                              {formatValue(row.public_price_mode)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Giá công khai: {formatValue(row.public_price_amount)}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-col items-start gap-2">
                            <Badge tone={statusTone(row.status)}>
                              {formatPendingStatus(row.status)}
                            </Badge>
                            {hasConflict ? (
                              <Badge tone="warning">Có lỗi cần xử lý</Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              data-import-approve-row="variants"
                              disabled={!props.canReview || !isPending || hasConflict}
                              onClick={() => void props.onApprove(rowId)}
                            >
                              Duyệt
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              data-import-skip-row="variants"
                              disabled={!props.canReview || !isPending}
                              onClick={() => void props.onSkip(rowId)}
                            >
                              Bỏ qua
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              data-import-toggle-row-detail="variants"
                              onClick={() => props.onToggleExpanded(rowId)}
                            >
                              <Eye className="h-4 w-4" />
                              {isExpanded ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr>
                          <td colSpan={5} className="bg-muted px-4 py-3">
                            <div className="grid gap-3 md:grid-cols-3">
                              <InfoCard label="SKU" value={row.sku} />
                              <InfoCard label="Mã ngoài" value={row.external_code} />
                              <InfoCard label="Mã sản phẩm" value={row.model_code} />
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={props.pagination.page}
            pageSize={props.pagination.page_size}
            total={props.pagination.total}
            onPageChange={props.onPageChange}
          />
        </>
      )}
    </PendingReviewPanelLayout>
  );
}

function PendingReviewPanelLayout(props: {
  title: string;
  total: number;
  filter: ReviewFilterKey;
  query: string;
  selectedCount: number;
  canReview: boolean;
  bulkSubmitting: boolean;
  hasSelectedRows: boolean;
  hasSelectedValidRows: boolean;
  searchPlaceholder: string;
  dataPanelKey: 'groups' | 'variants';
  onFilterChange: (value: ReviewFilterKey) => void;
  onQueryChange: (value: string) => void;
  onApproveAllValid: () => void;
  onApproveSelected: () => void;
  onSkipSelected: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="space-y-4"
      data-import-review-panel={props.dataPanelKey}
      data-import-review-path="true"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text">
            {props.title} ({props.total})
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Duyệt các dòng hợp lệ hoặc bỏ qua các dòng chưa muốn áp dụng.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            data-import-bulk-approve-all={props.dataPanelKey}
            disabled={!props.canReview || props.bulkSubmitting}
            onClick={props.onApproveAllValid}
          >
            <FileCheck2 className="h-4 w-4" />
            {props.bulkSubmitting ? 'Đang duyệt' : 'Duyệt tất cả hợp lệ'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            data-import-bulk-approve-selected={props.dataPanelKey}
            disabled={!props.canReview || !props.hasSelectedValidRows}
            onClick={props.onApproveSelected}
          >
            Duyệt dòng đã chọn
          </Button>
          <Button
            type="button"
            variant="secondary"
            data-import-bulk-skip-selected={props.dataPanelKey}
            disabled={!props.canReview || !props.hasSelectedRows}
            onClick={props.onSkipSelected}
          >
            Bỏ qua dòng đã chọn
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-sm border border-border bg-panel p-4">
        <div className="flex flex-wrap gap-2" data-import-review-filters="true">
          {GROUP_FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              data-import-review-filter={item.key}
              className={cn(
                'inline-flex h-9 items-center rounded-sm border px-3 text-sm font-medium transition-colors',
                props.filter === item.key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-white text-slate-700 hover:bg-muted'
              )}
              onClick={() => props.onFilterChange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="max-w-lg">
          <Input
            data-import-review-search={props.dataPanelKey}
            value={props.query}
            onChange={(event) => props.onQueryChange(event.target.value)}
            placeholder={props.searchPlaceholder}
          />
        </div>
        {props.selectedCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            Đã chọn {props.selectedCount} dòng.
          </p>
        ) : null}
      </div>

      {props.children}
    </div>
  );
}

export function ConflictsPanel(props: {
  rows: ConflictRow[];
  pagination: { page: number; page_size: number; total: number };
  canResolve: boolean;
  selectedConflict?: ConflictRow;
  selectedId: string;
  decision: string;
  note: string;
  manualPriceMode: string;
  manualPriceAmount: string;
  onPageChange: (page: number) => void;
  onSelect: (id: string) => void;
  onDecision: (value: string) => void;
  onNote: (value: string) => void;
  onManualPriceMode: (value: string) => void;
  onManualPriceAmount: (value: string) => void;
  onResolve: () => void;
}) {
  const invalidPublicPrice =
    String(props.selectedConflict?.conflict_type || '') === 'invalid_public_price';
  const riskyDecision = ['overwrite', 'merge'].includes(props.decision);

  return (
    <div className="space-y-4">
      {props.rows.length === 0 ? (
        <EmptyState
          title="Không có xung đột"
          description="Không có xung đột nào đang mở trong lô nhập này."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-sm border border-border">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Xung đột
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Trạng thái
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-panel">
                {props.rows.map((row) => {
                  const rowId = String(row.id || '');
                  return (
                    <tr key={rowId}>
                      <td className="px-3 py-3">
                        <PrimaryCell
                          value={row.conflict_type}
                          sub={`${formatValue(row.entity_type)} - ${formatValue(
                            row.entity_id
                          )}`}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={statusTone(row.status)}>
                          {formatValue(row.status)}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => props.onSelect(rowId)}
                        >
                          {props.selectedId === rowId ? 'Đang chọn' : 'Chọn xử lý'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={props.pagination.page}
            pageSize={props.pagination.page_size}
            total={props.pagination.total}
            onPageChange={props.onPageChange}
          />
        </>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-border bg-muted px-4 py-3">
          <h3 className="text-sm font-semibold text-text">Xử lý xung đột</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Chọn một xung đột đang mở rồi quyết định cách xử lý phù hợp.
          </p>
        </div>
        <div className="space-y-4 p-4">
          <Field label="Xung đột đang chọn">
            <Select
              value={props.selectedId}
              onChange={(event) => props.onSelect(event.target.value)}
            >
              <option value="">Chọn xung đột</option>
              {props.rows.map((row) => (
                <option key={String(row.id || '')} value={String(row.id || '')}>
                  {formatValue(row.conflict_type)} - {formatValue(row.entity_type)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Quyết định">
            <Select
              value={props.decision}
              onChange={(event) => props.onDecision(event.target.value)}
              disabled={!props.canResolve}
            >
              <option value="manual_edit">Sửa thủ công</option>
              <option value="keep_existing">Giữ dữ liệu hiện có</option>
              <option value="skip">Bỏ qua</option>
              <option value="overwrite">Ghi đè</option>
              <option value="merge">Gộp dữ liệu</option>
            </Select>
          </Field>

          {props.decision === 'manual_edit' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nhánh giá">
                <Select
                  value={props.manualPriceMode}
                  onChange={(event) => props.onManualPriceMode(event.target.value)}
                  disabled={!props.canResolve}
                >
                  <option value="contact_for_quote">
                    {formatValue('contact_for_quote')}
                  </option>
                  <option value="public_price">{formatValue('public_price')}</option>
                </Select>
              </Field>
              <Field label="Giá công khai">
                <Input
                  value={props.manualPriceAmount}
                  onChange={(event) => props.onManualPriceAmount(event.target.value)}
                  disabled={
                    !props.canResolve || props.manualPriceMode !== 'public_price'
                  }
                  placeholder="Chỉ nhập khi có giá công khai"
                />
              </Field>
            </div>
          ) : null}

          {invalidPublicPrice && riskyDecision ? (
            <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
              Xung đột giá công khai không hợp lệ chỉ nên xử lý bằng sửa thủ công
              hoặc bỏ qua.
            </div>
          ) : null}

          <Field label="Ghi chú">
            <Textarea
              className="min-h-24"
              value={props.note}
              onChange={(event) => props.onNote(event.target.value)}
              disabled={!props.canResolve}
            />
          </Field>

          <div className="flex justify-end">
            <Button
              type="button"
              disabled={
                !props.canResolve ||
                !props.selectedId ||
                String(props.selectedConflict?.status) !== 'open' ||
                (invalidPublicPrice && riskyDecision)
              }
              onClick={props.onResolve}
            >
              <GitPullRequest className="h-4 w-4" />
              Xử lý xung đột
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function ReadinessPanel({
  batch,
  readiness,
  blockerCount,
  base,
  canReview,
  refreshing,
  onRefresh,
  onResolved
}: {
  batch: RecordMap;
  readiness: RecordMap | null;
  blockerCount: number;
  base: string;
  canReview: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onResolved: (message: string) => Promise<void>;
}) {
  if (!readiness) {
    return (
      <EmptyState
        title="Chưa có dữ liệu kiểm tra sẵn sàng"
        description="Không tải được dữ liệu kiểm tra sẵn sàng hiện tại."
      />
    );
  }

  if (String(batch.status || '') === 'applied' || batch.applied_at) {
    return (
      <div className="space-y-4" data-import-applied-readiness="true">
        <Card className="overflow-hidden border-blue-200 bg-blue-50">
          <div className="border-b border-blue-200 bg-blue-50/80 px-4 py-3">
            <h3 className="text-sm font-semibold text-blue-900">
              Đã áp dụng vào dữ liệu chính thức
            </h3>
            <p className="mt-1 text-xs text-blue-800">
              Lô nhập này đã hoàn tất áp dụng. Phần kiểm tra sẵn sàng chỉ còn giá trị
              đối chiếu lịch sử.
            </p>
          </div>
          <div className="space-y-3 p-4 text-sm text-blue-900">
            <div className="rounded-sm border border-blue-200 bg-white/70 px-4 py-3">
              Không còn thao tác áp dụng nào chờ xử lý cho lô nhập này.
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <InfoCard label="Trạng thái lô" value={batch.status} />
              <InfoCard label="Thời điểm áp dụng" value={formatDate(batch.applied_at)} />
              <InfoCard label="Thời điểm kiểm tra" value={formatDate(batch.validated_at)} />
            </div>
          </div>
        </Card>

        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Tạo nhóm" value={asRecord(readiness.planned_actions).create_product_group_count} />
          <Metric label="Cập nhật nhóm" value={asRecord(readiness.planned_actions).update_product_group_count} />
          <Metric label="Tạo biến thể" value={asRecord(readiness.planned_actions).create_variant_count} />
          <Metric label="Cập nhật biến thể" value={asRecord(readiness.planned_actions).update_variant_count} />
        </div>
      </div>
    );
  }

  const blockers = getImportBlockers(readiness.blockers);
  const planned = asRecord(readiness.planned_actions);
  const summaryItems = getImportReadinessSummaryItems(blockers);

    return (
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border bg-muted px-4 py-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text">Điều kiện chặn</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Kiểm tra các điều kiện cần hoàn tất trước khi áp dụng.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={refreshing}
              onClick={onRefresh}
            >
              <RefreshCw className={cn('h-4 w-4', refreshing ? 'animate-spin' : '')} />
              Kiểm tra lại
            </Button>
          </div>
          <div className="space-y-3 p-4">
            {blockers.length === 0 ? (
            <div className="rounded-sm border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              Không còn điều kiện chặn. Lô nhập có thể áp dụng khi trạng thái lô đã ở
              mức sẵn sàng áp dụng.
            </div>
          ) : (
            <div className="space-y-3">
                <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-semibold">
                    Lô này chưa thể áp dụng vì còn dữ liệu trùng hoặc thiếu thông tin.
                  </p>
                <p className="mt-1 text-amber-800">
                  Tổng cộng {formatValue(blockerCount)} vấn đề đang chưa được xử lý.
                </p>
              </div>
                <ImportReadinessSummaryGrid items={summaryItems} />
                <ImportBlockerExplorer
                  blockers={blockers}
                  tone="warning"
                  base={base}
                  batchStatus={String(batch.status || '')}
                  canMutate={canReview}
                  onResolved={onResolved}
                />
              </div>
            )}
          </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Tạo nhóm" value={planned.create_product_group_count} />
        <Metric label="Cập nhật nhóm" value={planned.update_product_group_count} />
        <Metric label="Tạo biến thể" value={planned.create_variant_count} />
        <Metric label="Cập nhật biến thể" value={planned.update_variant_count} />
      </div>
    </div>
  );
}

export function ApplyPreviewStrip({ preview }: { preview: ApplyPreviewResponse }) {
  const g = preview.product_groups;
  const v = preview.product_variants;
  const totalMissing = g.missing_key + v.missing_key;
  const grandTotal = g.total + v.total;

  if (grandTotal === 0) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-1 rounded-sm border px-3 py-2 text-sm',
        totalMissing > 0
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-blue-200 bg-blue-50 text-blue-900'
      )}
    >
      <span className="font-semibold">Khi áp dụng:</span>
      <span>
        Nhóm{' '}
        <strong className="tabular-nums">+{g.will_create}</strong>
        <span className="text-current/60"> / </span>
        <strong className="tabular-nums">{g.will_update}↻</strong>
      </span>
      <span>
        Biến thể{' '}
        <strong className="tabular-nums">+{v.will_create}</strong>
        <span className="text-current/60"> / </span>
        <strong className="tabular-nums">{v.will_update}↻</strong>
      </span>
      {totalMissing > 0 ? (
        <span className="ml-auto inline-flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          <strong className="tabular-nums">{totalMissing}</strong> dòng có thể trùng
        </span>
      ) : null}
    </div>
  );
}

export function ReadinessSummary({
  batch,
  readiness,
  blockerCount,
  conflictCount,
  canReviewAction,
  canTransitionToReady,
  reviewActionLabel,
  reviewActionDisabled,
  onReviewAction,
  showApplyAction,
  applyActionDisabled,
  applying,
  onApply,
  onOpenGroups,
  onOpenVariants,
  onOpenConflicts,
  onOpenReadiness
}: {
  batch: RecordMap;
  readiness: RecordMap | null;
  blockerCount: number;
  conflictCount: number;
  canReviewAction: boolean;
  canTransitionToReady: boolean;
  reviewActionLabel: string;
  reviewActionDisabled: boolean;
  onReviewAction: () => void;
  showApplyAction: boolean;
  applyActionDisabled: boolean;
  applying: boolean;
  onApply: () => void;
  onOpenGroups: () => void;
  onOpenVariants: () => void;
  onOpenConflicts: () => void;
  onOpenReadiness: () => void;
}) {
  const passes = Boolean(readiness?.passes_current_apply_checks);
  const blockers = getImportBlockers(readiness?.blockers);
  const applied = String(batch.status || '') === 'applied' || Boolean(batch.applied_at);
  const workflowGuide = getImportWorkflowGuide(batch, blockers, passes);
  const hasDetailedBlockers = blockers.some(
    (blocker) => !isWorkflowStatusOnlyBlocker(blocker)
  );
  const summaryItems = getImportReadinessSummaryItems(blockers);
  const primaryAction = showApplyAction
    ? {
        label: applying ? 'Đang áp dụng' : 'Áp dụng dữ liệu',
        icon: <DatabaseZap className="h-4 w-4" />,
        disabled: applyActionDisabled,
        onClick: onApply
      }
    : canReviewAction && !reviewActionDisabled
        ? {
            label: reviewActionLabel,
            icon: <ShieldCheck className="h-4 w-4" />,
            disabled: reviewActionDisabled,
            onClick: onReviewAction
          }
      : conflictCount > 0
        ? {
            label: 'Mở xung đột',
            icon: <GitPullRequest className="h-4 w-4" />,
            disabled: false,
            onClick: onOpenConflicts
          }
        : {
            label: hasDetailedBlockers ? 'Mở kiểm tra sẵn sàng' : 'Duyệt dữ liệu tạm',
            icon: hasDetailedBlockers ? (
              <ListChecks className="h-4 w-4" />
            ) : (
              <FileCheck2 className="h-4 w-4" />
            ),
            disabled: false,
            onClick: hasDetailedBlockers ? onOpenReadiness : onOpenGroups
          };

  if (applied) {
    return (
      <Card
        className="border-blue-200 bg-blue-50"
        data-import-applied-card="true"
      >
        <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-blue-200 bg-panel text-blue-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text">
                Đã áp dụng vào dữ liệu chính thức
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Xem lại dữ liệu tạm hoặc lưu trữ lô nhập khi không cần theo dõi nữa.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-blue-200 px-4 py-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              data-import-open-groups="true"
              onClick={onOpenGroups}
            >
              Xem nhóm sản phẩm tạm
            </Button>
            <Button
              type="button"
              variant="secondary"
              data-import-open-variants="true"
              onClick={onOpenVariants}
            >
              Xem biến thể tạm
            </Button>
            <Button
              type="button"
              variant="secondary"
              data-import-open-readiness="true"
              onClick={onOpenReadiness}
            >
              Xem kiểm tra sẵn sàng
            </Button>
            {conflictCount > 0 ? (
              <Button
                type="button"
                variant="secondary"
                data-import-open-conflicts="true"
                onClick={onOpenConflicts}
              >
                Xem xung đột
              </Button>
            ) : null}
          </div>

        </div>
      </Card>
    );
  }

  return (
    <Card
      className={
        passes ? 'border-blue-200 bg-blue-50' : 'border-amber-200 bg-amber-50'
      }
      data-import-not-ready-card="true"
    >
      <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border bg-panel',
              passes
                ? 'border-blue-200 text-blue-700'
                : 'border-amber-200 text-amber-700'
            )}
          >
            {passes ? (
              <ShieldCheck className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text">
              Hướng dẫn xử lý lô nhập
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {workflowGuide.summary}
            </p>
          </div>
        </div>
        <Badge tone={workflowGuide.badgeTone}>{workflowGuide.badgeLabel}</Badge>
      </div>

      <div className="space-y-3 border-t border-border px-4 py-4">
        <div className="grid gap-3 md:grid-cols-[220px_220px_minmax(0,1fr)]">
          <WorkflowSummaryCard label="Bước hiện tại" value={workflowGuide.current} />
          <WorkflowSummaryCard label="Bước tiếp theo" value={workflowGuide.next} />
          <WorkflowSummaryText label="Cần làm gì" value={workflowGuide.hint} />
        </div>

        {canTransitionToReady ? (
          <div className="rounded-sm border border-blue-200 bg-white/80 px-4 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-900">
                  Lô này đã qua kiểm tra dữ liệu. Hãy bấm Đặt sẵn sàng áp dụng để chuyển sang bước áp dụng.
                </p>
                <p className="mt-1 text-sm text-blue-800">
                  Sau khi chuyển trạng thái thành công, nút chính sẽ đổi thành Áp dụng dữ liệu.
                </p>
              </div>
              {canReviewAction ? (
                <Button
                  type="button"
                  disabled={reviewActionDisabled}
                  onClick={onReviewAction}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Đặt sẵn sàng áp dụng
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {!passes ? (
          <>
            <div className="rounded-sm border border-amber-200 bg-white/70 px-3 py-3 text-xs leading-5 text-amber-900">
              <p className="font-semibold">
                Còn {formatValue(blockerCount)} vấn đề cần xử lý trước khi áp dụng.
              </p>
              <p className="mt-1 text-amber-800">
                {canTransitionToReady
                  ? 'Lô này đã qua kiểm tra dữ liệu. Hãy bấm Đặt sẵn sàng áp dụng để chuyển sang bước áp dụng.'
                  : hasDetailedBlockers
                  ? 'Mở phần kiểm tra sẵn sàng để xem từng dòng bị trùng, thiếu thông tin hoặc mất liên kết áp dụng.'
                  : 'Lô nhập chưa được chuyển sang trạng thái sẵn sàng áp dụng. Hoàn tất bước duyệt rồi chuyển lô sang trạng thái này trước khi áp dụng.'}
              </p>
            </div>
            <ImportReadinessSummaryGrid items={summaryItems} />
            {hasDetailedBlockers ? (
              <ImportBlockerChecklist blockers={blockers} tone="warning" />
            ) : null}
          </>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {primaryAction ? (
            <Button
              type="button"
              disabled={primaryAction.disabled}
              onClick={primaryAction.onClick}
            >
              {primaryAction.icon}
              {primaryAction.label}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            data-import-open-groups="true"
            onClick={onOpenGroups}
          >
            Xem nhóm sản phẩm tạm
          </Button>
          <Button
            type="button"
            variant="secondary"
            data-import-open-variants="true"
            onClick={onOpenVariants}
          >
            Xem biến thể tạm
          </Button>
          <Button
            type="button"
            variant="secondary"
            data-import-open-readiness="true"
            onClick={onOpenReadiness}
          >
            Xem kiểm tra sẵn sàng
          </Button>
          {conflictCount > 0 ? (
            <Button
              type="button"
              variant="secondary"
              data-import-open-conflicts="true"
              onClick={onOpenConflicts}
            >
              Xem xung đột
            </Button>
          ) : null}
        </div>

      </div>
    </Card>
  );
}

function WorkflowSummaryCard({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-sm border border-border bg-white/70 px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-text">{value}</div>
    </div>
  );
}

function WorkflowSummaryText({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-sm border border-border bg-white/70 px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <p className="mt-1 text-sm text-text">{value}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'default'
}: {
  label: string;
  value: unknown;
  tone?: 'default' | 'warning';
}) {
  return (
    <Card
      className={
        tone === 'warning'
          ? 'border-amber-200 bg-amber-50 px-4 py-3'
          : 'px-4 py-3'
      }
    >
      <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-text">
        {formatValue(value)}
      </div>
    </Card>
  );
}

export function ImportBatchDangerZone({
  isArchivedBatch,
  canArchiveBatch,
  canDeleteBatch,
  deleting,
  onDelete,
  onArchive,
  onRestore
}: {
  isAppliedBatch: boolean;
  isArchivedBatch: boolean;
  canArchiveBatch: boolean;
  canDeleteBatch: boolean;
  deleting: boolean;
  onDelete: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const isArchiveMode = isArchivedBatch || canArchiveBatch;

  return (
    <Card
      className={cn(
        'bg-white',
        isArchiveMode ? 'border-border' : 'border-red-200'
      )}
      data-import-danger-zone="true"
    >
      <div
        className={cn(
          'border-b px-4 py-3',
          isArchiveMode
            ? 'border-border bg-muted'
            : 'border-red-200 bg-red-50'
        )}
      >
        <h2
          className={cn(
            'text-sm font-semibold',
            isArchiveMode ? 'text-text' : 'text-red-900'
          )}
        >
          {isArchivedBatch
            ? 'Khôi phục lô nhập'
            : canArchiveBatch
              ? 'Lưu trữ lô nhập'
              : 'Xóa lô nhập'}
        </h2>
        <p
          className={cn(
            'mt-0.5 text-xs',
            isArchiveMode ? 'text-muted-foreground' : 'text-red-800'
          )}
        >
          {isArchivedBatch
            ? 'Khôi phục lô nhập để đưa lại vào danh sách đang dùng.'
            : canArchiveBatch
              ? 'Lô nhập đã áp dụng nên không xóa cứng. Bạn có thể lưu trữ để ẩn khỏi danh sách mặc định mà vẫn giữ lịch sử.'
              : 'Thao tác này xóa lô nhập, dữ liệu tạm, các vấn đề đang xử lý, cách ghép cột và có thể xóa tệp nguồn nếu không còn lô nào khác sử dụng.'}
        </p>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex justify-end">
          {isArchivedBatch ? (
            <Button
              type="button"
              variant="secondary"
              data-import-archive-button="true"
              disabled={deleting}
              onClick={onRestore}
            >
              <RotateCcw className="h-4 w-4" />
              {deleting ? 'Đang khôi phục lô nhập' : 'Khôi phục lô nhập'}
            </Button>
          ) : canArchiveBatch ? (
            <Button
              type="button"
              variant="secondary"
              data-import-archive-button="true"
              disabled={deleting}
              onClick={onArchive}
            >
              <Archive className="h-4 w-4" />
              {deleting ? 'Đang lưu trữ lô nhập' : 'Lưu trữ lô nhập'}
            </Button>
          ) : (
            <Button
              type="button"
              variant="danger"
              data-import-delete-button="true"
              disabled={!canDeleteBatch || deleting}
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Đang xóa lô nhập' : 'Xóa lô nhập'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export function InfoCard({
  label,
  value
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div className="rounded-sm border border-border bg-muted px-3 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 break-words text-sm text-text">{formatValue(value)}</div>
    </div>
  );
}

function PrimaryCell({ value, sub }: { value: unknown; sub?: string }) {
  return (
    <div>
      <div className="font-medium text-text">{formatValue(value)}</div>
      {sub ? <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
