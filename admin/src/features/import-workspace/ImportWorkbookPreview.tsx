'use client';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import { formatValue } from '@/lib/formatters';

type RecordMap = Record<string, unknown>;

const ROLE_LABELS: Record<string, string> = {
  category_main_column: 'Danh mục chính',
  category_sub_column: 'Danh mục con',
  product_group_column: 'Nhóm sản phẩm',
  product_variant_column: 'Biến thể / SKU',
  brand_column: 'Thương hiệu',
  short_description_column: 'Mô tả ngắn',
  group_external_code_column: 'Mã nhóm chung',
  variant_external_code_column: 'Mã liên kết riêng',
  sku_column: 'SKU',
  model_code_column: 'Mã sản phẩm',
  public_price_column: 'Giá công khai'
};

export function ImportWorkbookPreview({
  preview,
  title = 'Bản xem trước tệp',
  subtitle = 'Kiểm tra các cột và mẫu dữ liệu trước khi tạo dữ liệu tạm.',
  condensed = false
}: {
  preview: RecordMap | null;
  title?: string;
  subtitle?: string;
  condensed?: boolean;
}) {
  if (!preview || Object.keys(preview).length === 0) {
    return null;
  }

  if (preview.preview_status === 'unavailable') {
    return (
      <Card
        className="overflow-hidden border-slate-200"
        data-import-preview="true"
        data-import-preview-unavailable="true"
      >
        <div className="border-b border-border bg-muted px-4 py-3">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
        </div>
        <div className="p-4 text-sm">
          <p className="font-semibold text-text">Không có bản xem trước của tệp</p>
          <p className="mt-1 text-muted-foreground">
            Lô nhập vẫn còn nguyên dữ liệu. Mở nhóm sản phẩm tạm hoặc biến thể tạm để
            xem những gì đã được đọc từ tệp nguồn.
          </p>
        </div>
      </Card>
    );
  }

  const detectedColumns = getStringArray(preview.detected_columns);
  const sampleRows = getRecordArray(preview.sample_rows);
  const proposedMapping = getRecordArray(preview.proposed_mapping);
  const unresolvedColumns = getRecordArray(preview.unresolved_columns);
  const warnings = Array.from(new Set(getStringArray(preview.warnings)));
  const embeddedImageCount = Math.max(0, Number(preview.embedded_image_count) || 0);
  const confirmedMapping = asRecord(preview.confirmed_mapping);
  const mappingDefaults = asRecord(preview.mapping_defaults);
  const currentMapping =
    Object.keys(confirmedMapping).length > 0 ? confirmedMapping : mappingDefaults;

  const mappingRows = buildMappingRows(currentMapping);
  const noteGroups = buildNoteGroups(unresolvedColumns, warnings);

  return (
    <Card className="overflow-hidden" data-import-preview="true">
      <div className="border-b border-border bg-muted px-4 py-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text">{title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <Badge tone={Object.keys(confirmedMapping).length > 0 ? 'active' : 'info'}>
            {Object.keys(confirmedMapping).length > 0
              ? 'Đã xác nhận cột dữ liệu'
              : 'Gợi ý của hệ thống'}
          </Badge>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className={cn('grid grid-cols-2 gap-3', embeddedImageCount > 0 ? 'md:grid-cols-5' : 'md:grid-cols-4')}>
          <PreviewMetric label="Sheet" value={preview.sheet_name || 'Sheet1'} />
          <PreviewMetric label="Tổng dòng dữ liệu" value={preview.total_data_row_count} />
          <PreviewMetric label="Dòng đã chọn" value={preview.selected_row_count} />
          <PreviewMetric label="Số cột" value={detectedColumns.length} />
          {embeddedImageCount > 0 ? <PreviewMetric label="Ảnh nhúng chưa nhập" value={embeddedImageCount} /> : null}
        </div>

        {noteGroups.length > 0 ? (
          <section
            className={cn(
              'rounded-sm border px-4 py-3 text-sm',
              embeddedImageCount > 0
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-blue-200 bg-blue-50 text-blue-800'
            )}
            role="status"
          >
            <h3 className="font-semibold">{embeddedImageCount > 0 ? 'Kiểm tra trước khi nhập' : 'Lưu ý khi nhập'}</h3>
            <div className="mt-2 space-y-2">
              {noteGroups.map((group) => (
                <div key={group.title}>
                  <h4 className="text-xs font-semibold uppercase tracking-[0.06em]">{group.title}</h4>
                  <ul className="mt-1 list-inside list-disc space-y-1">
                    {group.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!condensed && mappingRows.length > 0 ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-text">
              Cột đang được dùng cho từng đích dữ liệu
            </h3>
            <div className="grid gap-3 lg:grid-cols-2">
              {mappingRows.map((row) => (
                <div
                  key={row.key}
                  className="rounded-sm border border-border bg-panel px-3 py-3"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    {row.label}
                  </div>
                  <div className="mt-1 text-sm font-medium text-text">
                    {row.value || 'Chưa gán'}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!condensed && detectedColumns.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-text">Cột phát hiện</h3>
            <div className="flex flex-wrap gap-2">
              {detectedColumns.map((column) => (
                <Badge key={column} tone="info">
                  {column}
                </Badge>
              ))}
            </div>
          </section>
        ) : null}

        {sampleRows.length > 0 ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-text">Mẫu dữ liệu</h3>
            <div className="grid gap-3 lg:grid-cols-2">
              {sampleRows.slice(0, 4).map((row, index) => {
                const cells = asRecord(row.cells);
                return (
                  <div
                    key={`${row.source_row_number ?? index}`}
                    className="rounded-sm border border-border bg-panel p-3"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-text">
                        Dòng nguồn {formatValue(row.source_row_number ?? index + 1)}
                      </div>
                      <Badge tone="default">{Object.keys(cells).length} cột</Badge>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {Object.entries(cells).slice(0, condensed ? 16 : undefined).map(([key, value]) => (
                        <div
                          key={key}
                          className="rounded-sm border border-border bg-muted px-2 py-2"
                        >
                          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                            {key}
                          </div>
                          <div className="mt-1 text-sm text-text">
                            {formatValue(value)}
                          </div>
                        </div>
                      ))}
                    </div>
                    {condensed && Object.keys(cells).length > 16 ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Còn {Object.keys(cells).length - 16} cột. Tìm tên cột ở khu vực ghép cột để xem giá trị mẫu.
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {!condensed && proposedMapping.length > 0 ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-text">
              Hệ thống đang hiểu các cột này như thế nào
            </h3>
            <div className="space-y-2">
              {proposedMapping.map((column) => {
                const sampleValues = getStringArray(column.sample_values);
                return (
                  <div
                    key={String(column.source_column ?? column.target_label)}
                    className="rounded-sm border border-border bg-panel px-3 py-3"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="text-sm font-medium text-text">
                          {formatValue(column.source_column)}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {formatValue(column.target_label)}
                        </div>
                      </div>
                      <Badge tone={mappingTone(column.status)}>
                        {mappingStatusLabel(column.status)}
                      </Badge>
                    </div>
                    {sampleValues.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {sampleValues.map((value) => (
                          <Badge key={value} tone="default">
                            {value}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-3 text-sm text-muted-foreground">
                      {formatValue(column.decision)}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

      </div>
    </Card>
  );
}

function PreviewMetric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-sm border border-border bg-panel px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-text">{formatValue(value)}</div>
    </div>
  );
}

function buildMappingRows(mapping: RecordMap) {
  return Object.entries(ROLE_LABELS)
    .map(([key, label]) => ({
      key,
      label,
      value: typeof mapping[key] === 'string' ? String(mapping[key]) : ''
    }))
    .filter((row) => row.value);
}

function mappingStatusLabel(value: unknown) {
  if (value === 'mapped') return 'Đã gán';
  if (value === 'staged_only') return 'Giữ ở dữ liệu tạm';
  return 'Chưa xác định';
}

function mappingTone(
  value: unknown
): 'default' | 'active' | 'inactive' | 'archived' | 'warning' | 'info' {
  if (value === 'mapped') return 'active';
  if (value === 'staged_only') return 'warning';
  return 'info';
}

function normalizeHeader(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildNoteGroups(unresolvedColumns: RecordMap[], warnings: string[]) {
  const groups = new Map<string, Set<string>>([
    ['Cần xử lý', new Set<string>()],
    ['Giới hạn hiện tại', new Set<string>()],
    ['Thông tin', new Set<string>()]
  ]);
  const seen = new Set<string>();

  const addItem = (groupTitle: string, value: string) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) return;
    groups.get(groupTitle)?.add(normalized);
    seen.add(normalized);
  };

  for (const column of unresolvedColumns) {
    const status = String(column.status || '');
    const decision = String(column.decision || '').trim();
    if (!decision) continue;

    if (status === 'unmapped') {
      addItem('Cần xử lý', decision);
      continue;
    }

    if (status === 'staged_only') {
      addItem('Giới hạn hiện tại', decision);
      continue;
    }

    addItem('Thông tin', decision);
  }

  for (const warning of warnings) {
    const normalized = normalizeHeader(warning);
    if (
      normalized.includes('giu o du lieu tam') ||
      normalized.includes('chua ghi') ||
      normalized.includes('chua ap dung')
    ) {
      addItem('Giới hạn hiện tại', warning);
      continue;
    }
    if (
      normalized.includes('can xac nhan') ||
      normalized.includes('chua gan')
    ) {
      addItem('Cần xử lý', warning);
      continue;
    }
    addItem('Thông tin', warning);
  }

  return Array.from(groups.entries())
    .map(([title, items]) => ({
      title,
      items: Array.from(items)
    }))
    .filter((group) => group.items.length > 0);
}

function asRecord(value: unknown): RecordMap {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordMap)
    : {};
}

function getRecordArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is RecordMap =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item): item is string => Boolean(item))
    : [];
}
