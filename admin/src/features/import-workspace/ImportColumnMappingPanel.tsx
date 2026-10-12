'use client';

import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useEffect,
  useMemo,
  useState
} from 'react';
import { ArrowRightLeft, CheckSquare2, Layers, Save } from '@/components/icons';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatValue } from '@/lib/formatters';

type RecordMap = Record<string, unknown>;

export type ImportColumnMappingPayload = {
  category_main_column: string;
  category_sub_column: string;
  product_group_column: string;
  product_variant_column: string;
  brand_column?: string;
  short_description_column?: string;
  group_external_code_column?: string;
  variant_external_code_column?: string;
  sku_column?: string;
  model_code_column?: string;
  public_price_column?: string;
  spec_columns?: string[];
  attribute_columns?: string[];
  ignored_columns?: string[];
  save_mapping_profile?: boolean;
  mapping_profile_name?: string;
};

type MappingFormState = {
  category_main_column: string;
  category_sub_column: string;
  product_group_column: string;
  product_variant_column: string;
  brand_column: string;
  short_description_column: string;
  group_external_code_column: string;
  variant_external_code_column: string;
  sku_column: string;
  model_code_column: string;
  public_price_column: string;
  spec_columns: string[];
  attribute_columns: string[];
  ignored_columns: string[];
};

type FlexibleRole = 'unmapped' | 'spec' | 'attribute' | 'ignore';
type MappingMode = 'recognized_profile' | 'system_suggestion' | 'manual';
type ColumnView = 'unmapped' | 'all' | 'attribute' | 'ignore';
const COLUMN_PAGE_SIZE = 20;

const REQUIRED_FIELDS: Array<{
  key: keyof Pick<
    MappingFormState,
    | 'category_main_column'
    | 'category_sub_column'
    | 'product_group_column'
    | 'product_variant_column'
  >;
  label: string;
}> = [
  {
    key: 'category_main_column',
    label: 'Danh mục chính'
  },
  {
    key: 'category_sub_column',
    label: 'Danh mục con'
  },
  {
    key: 'product_group_column',
    label: 'Tên sản phẩm (dùng chung)'
  },
  {
    key: 'product_variant_column',
    label: 'Tên biến thể'
  }
];

const OPTIONAL_FIELDS: Array<{
  key: keyof Pick<
    MappingFormState,
    | 'brand_column'
    | 'short_description_column'
    | 'group_external_code_column'
    | 'variant_external_code_column'
    | 'sku_column'
    | 'model_code_column'
    | 'public_price_column'
  >;
  label: string;
}> = [
  { key: 'brand_column', label: 'Thương hiệu' },
  { key: 'short_description_column', label: 'Mô tả ngắn' },
  { key: 'group_external_code_column', label: 'Mã nhóm chung' },
  { key: 'variant_external_code_column', label: 'Mã liên kết riêng' },
  { key: 'sku_column', label: 'SKU' },
  { key: 'model_code_column', label: 'Mã sản phẩm' },
  { key: 'public_price_column', label: 'Giá công khai' }
];

// 'spec' is intentionally omitted from the UI radio options. Backend now
// merges spec_columns into variant_attribute on commit, so the two targets are
// functionally identical and an extra radio just confused admins. Existing
// batches that previously stored spec_columns are auto-migrated in
// buildStateFromMapping() below.
const FLEXIBLE_ROLE_OPTIONS: Array<{
  value: FlexibleRole;
  label: string;
}> = [
  { value: 'unmapped', label: 'Chưa gán' },
  { value: 'attribute', label: 'Thuộc tính biến thể' },
  { value: 'ignore', label: 'Bỏ qua' }
];

export function ImportColumnMappingPanel({
  preview,
  submitting,
  onSubmit
}: {
  preview: RecordMap | null;
  submitting: boolean;
  onSubmit: (payload: ImportColumnMappingPayload) => Promise<void>;
}) {
  const headers = useMemo(() => getStringArray(preview?.detected_columns), [preview]);
  const sampleRows = useMemo(() => getRecordArray(preview?.sample_rows), [preview]);
  const recognizedProfile = useMemo(
    () => asRecord(preview?.recognized_profile),
    [preview]
  );
  const defaults = useMemo(() => buildSystemSuggestedState(preview), [preview]);
  const recognizedDefaults = useMemo(
    () => buildRecognizedProfileState(preview),
    [preview]
  );
  const initialState = useMemo(
    () =>
      buildInitialState(
        preview,
        recognizedDefaults ?? defaults
      ),
    [preview, recognizedDefaults, defaults]
  );
  const defaultsKey = useMemo(
    () =>
      JSON.stringify({
        defaults,
        recognizedDefaults,
        initialState,
        recognizedProfile
      }),
    [defaults, recognizedDefaults, initialState, recognizedProfile]
  );

  const [form, setForm] = useState<MappingFormState>(initialState);
  const [localError, setLocalError] = useState('');
  const [invalidField, setInvalidField] = useState('');
  const [mappingMode, setMappingMode] = useState<MappingMode>(
    recognizedDefaults ? 'recognized_profile' : 'system_suggestion'
  );
  const [saveProfile, setSaveProfile] = useState(false);
  const [profileName, setProfileName] = useState(
    getProfileName(recognizedProfile, preview)
  );
  const [columnQuery, setColumnQuery] = useState('');
  const [columnView, setColumnView] = useState<ColumnView>('unmapped');
  const [columnPage, setColumnPage] = useState(1);

  useEffect(() => {
    setForm(initialState);
    setLocalError('');
    setInvalidField('');
    setMappingMode(recognizedDefaults ? 'recognized_profile' : 'system_suggestion');
    setSaveProfile(false);
    setProfileName(getProfileName(recognizedProfile, preview));
    setColumnQuery('');
    setColumnView('unmapped');
    setColumnPage(1);
  }, [defaultsKey, initialState, preview, recognizedDefaults, recognizedProfile]);

  const singleAssignedColumns = useMemo(() => {
    const values = [
      form.category_main_column,
      form.category_sub_column,
      form.product_group_column,
      form.product_variant_column,
      form.brand_column,
      form.short_description_column,
      form.group_external_code_column,
      form.variant_external_code_column,
      form.sku_column,
      form.model_code_column,
      form.public_price_column
    ];
    return values.filter(Boolean);
  }, [form]);

  const flexibleHeaders = useMemo(
    () => headers.filter((header) => !singleAssignedColumns.includes(header)),
    [headers, singleAssignedColumns]
  );

  const hierarchyPreviewRows = useMemo(
    () =>
      sampleRows.slice(0, 5).map((row, index) => {
        const cells = asRecord(row.cells);
        return {
          sourceRow: row.source_row_number ?? index + 1,
          categoryMain: readCellValue(cells, form.category_main_column),
          categorySub: readCellValue(cells, form.category_sub_column),
          productGroup: readCellValue(cells, form.product_group_column),
          productVariant: readCellValue(cells, form.product_variant_column)
        };
      }),
    [form, sampleRows]
  );
  const usesProductNameAsDefaultVariant =
    Boolean(form.product_group_column) &&
    form.product_variant_column === form.product_group_column;
  const assignedRequiredCount = REQUIRED_FIELDS.filter((field) => Boolean(form[field.key])).length;
  const selectedOptionalFields = OPTIONAL_FIELDS.filter((field) => Boolean(form[field.key]));
  const unresolvedHeaders = flexibleHeaders.filter(
    (header) => getFlexibleRole(form, header) === 'unmapped'
  );
  const normalizedQuery = normalizeColumnSearch(columnQuery);
  const filteredHeaders = flexibleHeaders.filter((header) => {
    if (normalizedQuery && !normalizeColumnSearch(header).includes(normalizedQuery)) return false;
    const role = getFlexibleRole(form, header);
    return columnView === 'all' || role === columnView;
  });
  const filteredUnresolved = filteredHeaders.filter(
    (header) => getFlexibleRole(form, header) === 'unmapped'
  );
  const columnPageCount = Math.max(1, Math.ceil(filteredHeaders.length / COLUMN_PAGE_SIZE));
  const visibleHeaders = filteredHeaders.slice(
    (Math.min(columnPage, columnPageCount) - 1) * COLUMN_PAGE_SIZE,
    Math.min(columnPage, columnPageCount) * COLUMN_PAGE_SIZE
  );

  if (!preview || headers.length === 0) {
    return null;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateForm(form, headers, saveProfile, profileName);
    if (validation) {
      setLocalError(validation.message);
      setInvalidField(validation.fieldId);
      if (validation.fieldId === 'import-mapping-remaining-columns') {
        setColumnQuery('');
        setColumnView('unmapped');
        setColumnPage(1);
      }
      requestAnimationFrame(() => {
        const field = document.getElementById(validation.fieldId);
        field?.focus();
        field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }

    setLocalError('');
    setInvalidField('');
    await onSubmit(toPayload(form, saveProfile, profileName));
  }

  function useSuggestedMapping() {
    setForm(defaults);
    setMappingMode('system_suggestion');
    setLocalError('');
    setInvalidField('');
    setColumnPage(1);
  }

  function useRecognizedProfile() {
    if (!recognizedDefaults) return;
    setForm(recognizedDefaults);
    setMappingMode('recognized_profile');
    setLocalError('');
    setInvalidField('');
    setColumnPage(1);
  }

  function assignUnresolvedColumns(role: 'attribute' | 'ignore') {
    if (filteredUnresolved.length === 0) return;
    setMappingMode('manual');
    setLocalError('');
    setInvalidField('');
    setColumnPage(1);
    setForm((current) => ({
      ...current,
      attribute_columns: role === 'attribute'
        ? [...current.attribute_columns, ...filteredUnresolved]
        : current.attribute_columns,
      ignored_columns: role === 'ignore'
        ? [...current.ignored_columns, ...filteredUnresolved]
        : current.ignored_columns
    }));
  }

  return (
    <Card className="overflow-hidden" data-import-column-mapping="true">
      <div className="border-b border-border bg-muted px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-sm border border-border bg-panel text-primary">
            <ArrowRightLeft className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-text">Xác nhận cột dữ liệu</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={assignedRequiredCount === REQUIRED_FIELDS.length ? 'success' : 'warning'}>
              {assignedRequiredCount}/{REQUIRED_FIELDS.length} cột chính
            </Badge>
            {unresolvedHeaders.length > 0 ? (
              <Badge tone="warning">{unresolvedHeaders.length} cột chưa xử lý</Badge>
            ) : (
              <Badge tone="success">Đã xử lý mọi cột</Badge>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5 p-4">
        <section
          className="space-y-3 rounded-sm border border-border bg-panel px-4 py-4"
          data-import-mapping-stage="true"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h3 className="text-sm font-semibold text-text">Cách ghép cột</h3>
            <Badge tone="info">
              {mappingMode === 'recognized_profile'
                ? 'Đang dùng cấu hình đã lưu'
                : mappingMode === 'system_suggestion'
                  ? 'Đang dùng gợi ý hệ thống'
                  : 'Đang chỉnh tay cột dữ liệu'}
            </Badge>
          </div>

          {recognizedDefaults ? (
            <div
              className="rounded-sm border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
              data-import-mapping-recognized-profile="true"
            >
              Đã nhận ra mẫu cột quen{' '}
              <span className="font-semibold">
                “{formatValue(recognizedProfile.profile_name)}”
              </span>
              . Kiểm tra lại bốn cột chính trước khi tiếp tục.
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {recognizedDefaults ? (
              <Button
                type="button"
                variant={mappingMode === 'recognized_profile' ? 'primary' : 'secondary'}
                onClick={useRecognizedProfile}
                data-import-use-recognized-profile="true"
              >
                Dùng cấu hình đã lưu
              </Button>
            ) : null}
            <Button
              type="button"
              variant={mappingMode === 'system_suggestion' ? 'primary' : 'secondary'}
              onClick={useSuggestedMapping}
              data-import-use-suggested-mapping="true"
            >
              Dùng cấu hình gợi ý
            </Button>
            <Button
              type="button"
              variant={mappingMode === 'manual' ? 'primary' : 'secondary'}
              onClick={() => {
                setMappingMode('manual');
                setLocalError('');
                setInvalidField('');
              }}
              data-import-use-manual-mapping="true"
            >
              Tự chọn cột
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-text">Sản phẩm và biến thể / SKU</h3>
          </div>
          <div className="grid overflow-hidden rounded-sm border border-border bg-slate-50 sm:grid-cols-2">
            <div className="border-b border-border px-3 py-2.5 sm:border-b-0 sm:border-r">
              <p className="text-xs font-semibold text-text">Sản phẩm</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Tên, danh mục, thương hiệu và nội dung dùng chung.</p>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-xs font-semibold text-text">Biến thể / SKU</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Mã hàng, model, giá và thông số của cấu hình bán được.</p>
            </div>
          </div>
          <label className="flex items-start gap-3 rounded-sm border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-text">
            <input
              className="mt-0.5 h-4 w-4"
              type="checkbox"
              checked={usesProductNameAsDefaultVariant}
              disabled={!form.product_group_column}
              data-import-flat-product-mode="true"
              onChange={(event) => {
                setMappingMode('manual');
                setLocalError('');
                setForm((current) => ({
                  ...current,
                  product_variant_column: event.target.checked
                    ? current.product_group_column
                    : current.product_variant_column === current.product_group_column
                      ? ''
                      : current.product_variant_column
                }));
              }}
            />
            <span>
              <span className="block font-medium">Mỗi sản phẩm chỉ có một cấu hình</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                Tự tạo một biến thể mặc định từ tên sản phẩm.
              </span>
            </span>
          </label>
          <div className="grid gap-4 lg:grid-cols-2">
            {REQUIRED_FIELDS.map((field) => (
              <label key={field.key} className="block space-y-2">
                <span className="text-sm font-medium text-text">{field.label}</span>
                <Select
                  id={mappingFieldId(field.key)}
                  data-import-required-role={field.key}
                  value={form[field.key]}
                  aria-invalid={invalidField === mappingFieldId(field.key)}
                  className={invalidField === mappingFieldId(field.key) ? 'border-red-500 ring-2 ring-red-100' : ''}
                  disabled={
                    field.key === 'product_variant_column' &&
                    usesProductNameAsDefaultVariant
                  }
                  onChange={(event) => {
                    setLocalError('');
                    setInvalidField('');
                    updateSingleField(
                      setForm,
                      setMappingMode,
                      field.key,
                      event.target.value
                    )
                  }}
                >
                  <option value="">Chọn cột dữ liệu</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </Select>
                <SampleValueChips header={form[field.key]} sampleRows={sampleRows} />
              </label>
            ))}
          </div>
        </section>

        <details className="rounded-sm border border-border bg-panel">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-text">
            <span>Thương hiệu, mã hàng, mô tả và giá</span>
            <span className="text-xs font-normal text-muted-foreground">
              {selectedOptionalFields.length > 0
                ? `${selectedOptionalFields.length} cột đã ghép: ${selectedOptionalFields.map((field) => field.label).join(', ')}`
                : 'Chưa ghép cột nào'}
            </span>
          </summary>
          <div className="border-t border-border px-4 py-4">
            <p className="mb-4 text-sm text-muted-foreground">
              Nhập lại file: ghép cột Mã sản phẩm của từng mặt hàng nếu có. SKU hoặc mã liên kết riêng cũng giúp nhận diện; khi không có mã, đổi tên sẽ cần đối chiếu lại.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {OPTIONAL_FIELDS.map((field) => (
                <label key={field.key} className="block space-y-2">
                  <span className="text-sm font-medium text-text">{field.label}</span>
                  <Select
                    id={mappingFieldId(field.key)}
                    value={form[field.key]}
                    aria-invalid={invalidField === mappingFieldId(field.key)}
                    className={invalidField === mappingFieldId(field.key) ? 'border-red-500 ring-2 ring-red-100' : ''}
                    onChange={(event) => {
                      setLocalError('');
                      setInvalidField('');
                      updateSingleField(
                        setForm,
                        setMappingMode,
                        field.key,
                        event.target.value
                      );
                    }}
                  >
                    <option value="">Không dùng cột này</option>
                    {headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </Select>
                  <SampleValueChips header={form[field.key]} sampleRows={sampleRows} />
                </label>
              ))}
            </div>
          </div>
        </details>

        <section
          id="import-mapping-remaining-columns"
          tabIndex={-1}
          className="space-y-3 outline-none"
          data-import-remaining-columns="true"
        >
          <div className="flex items-center gap-2">
            <CheckSquare2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-text">Các cột còn lại</h3>
          </div>

          {flexibleHeaders.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
              Tất cả cột hiện đã được gán vào các đích dữ liệu chính.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 rounded-sm border border-border bg-slate-50 p-3 lg:flex-row lg:items-end lg:justify-between">
                <label className="block min-w-0 flex-1 space-y-1.5">
                  <span className="text-xs font-semibold text-text">Tìm cột trong tệp</span>
                  <Input
                    value={columnQuery}
                    onChange={(event) => {
                      setColumnQuery(event.target.value);
                      setColumnPage(1);
                    }}
                    placeholder="Nhập tên cột Excel"
                    data-import-column-search="true"
                  />
                </label>
                <label className="block space-y-1.5 lg:w-56">
                  <span className="text-xs font-semibold text-text">Hiển thị</span>
                  <Select
                    value={columnView}
                    onChange={(event) => {
                      setColumnView(event.target.value as ColumnView);
                      setColumnPage(1);
                    }}
                    data-import-column-view="true"
                  >
                    <option value="unmapped">Chưa xử lý ({unresolvedHeaders.length})</option>
                    <option value="all">Tất cả ({flexibleHeaders.length})</option>
                    <option value="attribute">Giữ làm thuộc tính ({form.attribute_columns.length})</option>
                    <option value="ignore">Bỏ qua ({form.ignored_columns.length})</option>
                  </Select>
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{filteredHeaders.length} cột phù hợp · Hiển thị tối đa {COLUMN_PAGE_SIZE} cột mỗi trang</span>
                {filteredUnresolved.length > 0 ? (
                  <span>Thao tác hàng loạt áp dụng cho {filteredUnresolved.length} cột chưa xử lý phù hợp, kể cả ở trang khác.</span>
                ) : null}
              </div>
              {filteredUnresolved.length > 0 ? (
                <div className="flex flex-wrap gap-2" data-import-column-bulk-actions="true">
                  <Button type="button" variant="secondary" onClick={() => assignUnresolvedColumns('attribute')}>
                    Giữ {filteredUnresolved.length} cột làm thuộc tính
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => assignUnresolvedColumns('ignore')}>
                    Bỏ qua {filteredUnresolved.length} cột
                  </Button>
                </div>
              ) : null}
              {filteredHeaders.length === 0 ? (
                <p className="rounded-sm border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  {unresolvedHeaders.length === 0 && columnView === 'unmapped'
                    ? 'Đã xử lý tất cả cột. Bạn có thể xem lại ở mục “Tất cả”.'
                    : 'Không tìm thấy cột phù hợp. Thử tên khác hoặc đổi chế độ hiển thị.'}
                </p>
              ) : null}
              {visibleHeaders.map((header) => (
                <div
                  key={header}
                  className="rounded-sm border border-border bg-panel px-3 py-2.5"
                  data-import-flexible-column={header}
                >
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text">{header}</div>
                      <SampleValueChips header={header} sampleRows={sampleRows} />
                    </div>
                    <label className="block shrink-0 space-y-1 lg:w-52">
                      <span className="sr-only">Cách xử lý cột {header}</span>
                      <Select
                        value={getFlexibleRole(form, header)}
                        onChange={(event) => {
                          setLocalError('');
                          setInvalidField('');
                          updateFlexibleRole(setForm, setMappingMode, header, event.target.value as FlexibleRole);
                        }}
                        data-import-flexible-role={header}
                      >
                        {FLEXIBLE_ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                    </label>
                  </div>
                </div>
              ))}
              {columnPageCount > 1 ? (
                <div className="flex items-center justify-end gap-3 text-sm">
                  <Button type="button" variant="secondary" disabled={columnPage <= 1} onClick={() => setColumnPage((page) => page - 1)}>Trước</Button>
                  <span>Trang {Math.min(columnPage, columnPageCount)} / {columnPageCount}</span>
                  <Button type="button" variant="secondary" disabled={columnPage >= columnPageCount} onClick={() => setColumnPage((page) => page + 1)}>Tiếp</Button>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-sm border border-border bg-panel px-4 py-4">
          <div className="flex items-center gap-2">
            <Save className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-text">Lưu cách ghép cột</h3>
          </div>
          <label className="flex items-start gap-3 text-sm text-text">
            <input
              className="mt-1 h-4 w-4"
              type="checkbox"
              checked={saveProfile}
              onChange={(event) => setSaveProfile(event.target.checked)}
            />
            <span>
              {recognizedDefaults
                ? 'Cập nhật và lưu lại cấu hình này cho các file cùng mẫu cột.'
                : 'Lưu cấu hình này để lần sau hệ thống tự nhận ra file cùng mẫu cột.'}
            </span>
          </label>
          {saveProfile ? (
            <label className="block space-y-2">
              <span className="text-sm font-medium text-text">Tên cấu hình</span>
              <Input
                id="import-mapping-profile-name"
                value={profileName}
                aria-invalid={invalidField === 'import-mapping-profile-name'}
                className={invalidField === 'import-mapping-profile-name' ? 'border-red-500 ring-2 ring-red-100' : ''}
                onChange={(event) => {
                  setProfileName(event.target.value);
                  setLocalError('');
                  setInvalidField('');
                }}
                placeholder="Ví dụ: Mẫu đèn LED tháng 4"
                data-import-mapping-profile-name="true"
              />
            </label>
          ) : null}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-text">Xem trước kết quả</h3>
          <div className="overflow-x-auto rounded-sm border border-border">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Dòng nguồn
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Danh mục chính
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Danh mục con
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Nhóm sản phẩm
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Biến thể
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {hierarchyPreviewRows.map((row) => (
                  <tr key={String(row.sourceRow)}>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {formatValue(row.sourceRow)}
                    </td>
                    <td className="px-3 py-2.5 text-text">{formatValue(row.categoryMain)}</td>
                    <td className="px-3 py-2.5 text-text">{formatValue(row.categorySub)}</td>
                    <td className="px-3 py-2.5 text-text">{formatValue(row.productGroup)}</td>
                    <td className="px-3 py-2.5 text-text">
                      {formatValue(row.productVariant)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {localError ? (
          <div
            className="flex flex-col gap-2 rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
            role="alert"
            data-import-mapping-error="true"
          >
            <span>{localError}</span>
            <button
              type="button"
              className="shrink-0 font-semibold underline underline-offset-4"
              onClick={() => document.getElementById(invalidField)?.focus()}
            >
              Đi đến chỗ cần sửa
            </button>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" data-import-mapping-submit="true" disabled={submitting}>
              {submitting ? 'Đang tạo dữ liệu tạm' : 'Tạo dữ liệu tạm'}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

function SampleValueChips({
  header,
  sampleRows
}: {
  header: string;
  sampleRows: RecordMap[];
}) {
  if (!header) return null;

  const values = sampleRows
    .map((row) => readCellValue(asRecord(row.cells), header))
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .slice(0, 3);

  if (!values.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value, index) => (
        <Badge key={`${header}-${index}`} tone="default">
          {value}
        </Badge>
      ))}
    </div>
  );
}

function buildInitialState(
  preview: RecordMap | null,
  fallbackState: MappingFormState
): MappingFormState {
  const confirmed = asRecord(preview?.confirmed_mapping);
  if (Object.keys(confirmed).length > 0) {
    return buildStateFromMapping(confirmed);
  }
  return fallbackState;
}

function buildSystemSuggestedState(preview: RecordMap | null): MappingFormState {
  return buildStateFromMapping(asRecord(preview?.mapping_defaults));
}

function buildRecognizedProfileState(preview: RecordMap | null): MappingFormState | null {
  const recognized = asRecord(preview?.recognized_profile);
  const mapping = asRecord(recognized.mapping);
  return Object.keys(mapping).length > 0 ? buildStateFromMapping(mapping) : null;
}

function buildStateFromMapping(mapping: RecordMap): MappingFormState {
  // Merge any legacy spec_columns into attribute_columns so the UI shows them
  // as "Thuộc tính biến thể". Backend treats both targets identically now, but
  // older batches in the DB may still carry spec_columns entries.
  const legacySpecColumns = getStringArray(mapping.spec_columns);
  const attributeColumns = getStringArray(mapping.attribute_columns);
  const mergedAttributeColumns = Array.from(
    new Set([...attributeColumns, ...legacySpecColumns])
  );

  return {
    category_main_column: readString(mapping.category_main_column),
    category_sub_column: readString(mapping.category_sub_column),
    product_group_column: readString(mapping.product_group_column),
    product_variant_column: readString(mapping.product_variant_column),
    brand_column: readString(mapping.brand_column),
    short_description_column: readString(mapping.short_description_column),
    group_external_code_column: readString(mapping.group_external_code_column),
    variant_external_code_column: readString(mapping.variant_external_code_column),
    sku_column: readString(mapping.sku_column),
    model_code_column: readString(mapping.model_code_column),
    public_price_column: readString(mapping.public_price_column),
    spec_columns: [],
    attribute_columns: mergedAttributeColumns,
    ignored_columns: getStringArray(mapping.ignored_columns)
  };
}

function getProfileName(recognizedProfile: RecordMap, preview: RecordMap | null) {
  const recognizedName = readString(recognizedProfile.profile_name);
  if (recognizedName) return recognizedName;

  const sheetName = readString(preview?.sheet_name);
  if (sheetName) return `Cấu hình ${sheetName}`;
  return 'Cấu hình cột quen';
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function normalizeColumnSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .trim();
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item): item is string => Boolean(item))
    : [];
}

function getRecordArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is RecordMap =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function asRecord(value: unknown): RecordMap {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordMap)
    : {};
}

function readCellValue(cells: RecordMap, header: string) {
  if (!header) return null;
  return cells[header] ?? null;
}

function updateSingleField(
  setForm: Dispatch<SetStateAction<MappingFormState>>,
  setMappingMode: Dispatch<SetStateAction<MappingMode>>,
  key: keyof Omit<
    MappingFormState,
    'spec_columns' | 'attribute_columns' | 'ignored_columns'
  >,
  value: string
) {
  setMappingMode('manual');
  setForm((current) => {
    const keepDefaultVariantInSync =
      key === 'product_group_column' &&
      current.product_variant_column === current.product_group_column;

    return {
      ...current,
      [key]: value,
      ...(keepDefaultVariantInSync ? { product_variant_column: value } : {}),
      spec_columns: current.spec_columns.filter((item) => item !== value),
      attribute_columns: current.attribute_columns.filter((item) => item !== value),
      ignored_columns: current.ignored_columns.filter((item) => item !== value)
    };
  });
}

function getFlexibleRole(form: MappingFormState, header: string): FlexibleRole {
  if (form.spec_columns.includes(header)) return 'spec';
  if (form.attribute_columns.includes(header)) return 'attribute';
  if (form.ignored_columns.includes(header)) return 'ignore';
  return 'unmapped';
}

function updateFlexibleRole(
  setForm: Dispatch<SetStateAction<MappingFormState>>,
  setMappingMode: Dispatch<SetStateAction<MappingMode>>,
  header: string,
  role: FlexibleRole
) {
  setMappingMode('manual');
  setForm((current) => {
    const next: MappingFormState = {
      ...current,
      spec_columns: current.spec_columns.filter((item) => item !== header),
      attribute_columns: current.attribute_columns.filter((item) => item !== header),
      ignored_columns: current.ignored_columns.filter((item) => item !== header)
    };

    if (role === 'spec') next.spec_columns = [...next.spec_columns, header];
    if (role === 'attribute') next.attribute_columns = [...next.attribute_columns, header];
    if (role === 'ignore') next.ignored_columns = [...next.ignored_columns, header];

    return next;
  });
}

type MappingValidation = {
  message: string;
  fieldId: string;
};

function mappingFieldId(key: string) {
  return `import-mapping-${key}`;
}

function validateForm(
  form: MappingFormState,
  headers: string[],
  saveProfile: boolean,
  profileName: string
): MappingValidation | null {
  for (const field of REQUIRED_FIELDS) {
    if (!form[field.key]) {
      return {
        message: `Chưa chọn cột “${field.label}”. Hãy chọn cột dữ liệu tương ứng để tiếp tục.`,
        fieldId: mappingFieldId(field.key)
      };
    }
  }

  const singleAssignments: Array<[string, string, string]> = [
    ['Danh mục chính', form.category_main_column, 'category_main_column'],
    ['Danh mục con', form.category_sub_column, 'category_sub_column'],
    ['Tên sản phẩm (dùng chung)', form.product_group_column, 'product_group_column'],
    ['Tên biến thể', form.product_variant_column, 'product_variant_column'],
    ['Thương hiệu', form.brand_column, 'brand_column'],
    ['Mô tả ngắn', form.short_description_column, 'short_description_column'],
    ['Mã nhóm chung', form.group_external_code_column, 'group_external_code_column'],
    ['Mã liên kết riêng', form.variant_external_code_column, 'variant_external_code_column'],
    ['SKU', form.sku_column, 'sku_column'],
    ['Mã sản phẩm', form.model_code_column, 'model_code_column'],
    ['Giá công khai', form.public_price_column, 'public_price_column']
  ];

  const seen = new Map<string, string>();
  for (const [label, column, key] of singleAssignments) {
    if (!column) continue;
    const existing = seen.get(column);
    if (existing) {
      const isFlatProductNameReuse =
        existing === 'Tên sản phẩm (dùng chung)' && label === 'Tên biến thể';
      if (isFlatProductNameReuse) continue;

      return {
        message: `Cột “${column}” đang được dùng cho cả ${existing.toLowerCase()} và ${label.toLowerCase()}. Hãy chọn một cột khác cho “${label}”.`,
        fieldId: mappingFieldId(key)
      };
    }
    seen.set(column, label);
  }

  const handledColumns = new Set([
    ...singleAssignments.map(([, column]) => column).filter(Boolean),
    ...form.spec_columns,
    ...form.attribute_columns,
    ...form.ignored_columns
  ]);
  const unresolvedCount = headers.filter((header) => !handledColumns.has(header)).length;
  if (unresolvedCount > 0) {
    return {
      message: `Còn ${unresolvedCount} cột chưa xử lý. Hãy chọn giữ làm thuộc tính hoặc bỏ qua rõ ràng trước khi tạo dữ liệu tạm.`,
      fieldId: 'import-mapping-remaining-columns'
    };
  }

  if (saveProfile && profileName.trim().length === 0) {
    return {
      message: 'Chưa có tên cho cách ghép cột. Hãy nhập tên để lưu và dùng lại lần sau.',
      fieldId: 'import-mapping-profile-name'
    };
  }

  return null;
}

function toPayload(
  form: MappingFormState,
  saveProfile: boolean,
  profileName: string
): ImportColumnMappingPayload {
  const payload: ImportColumnMappingPayload = {
    category_main_column: form.category_main_column,
    category_sub_column: form.category_sub_column,
    product_group_column: form.product_group_column,
    product_variant_column: form.product_variant_column
  };

  if (form.brand_column) payload.brand_column = form.brand_column;
  if (form.short_description_column) {
    payload.short_description_column = form.short_description_column;
  }
  if (form.group_external_code_column) {
    payload.group_external_code_column = form.group_external_code_column;
  }
  if (form.variant_external_code_column) {
    payload.variant_external_code_column = form.variant_external_code_column;
  }
  if (form.sku_column) payload.sku_column = form.sku_column;
  if (form.model_code_column) payload.model_code_column = form.model_code_column;
  if (form.public_price_column) {
    payload.public_price_column = form.public_price_column;
  }
  if (form.spec_columns.length > 0) payload.spec_columns = form.spec_columns;
  if (form.attribute_columns.length > 0) {
    payload.attribute_columns = form.attribute_columns;
  }
  if (form.ignored_columns.length > 0) payload.ignored_columns = form.ignored_columns;
  if (saveProfile) {
    payload.save_mapping_profile = true;
    payload.mapping_profile_name = profileName.trim();
  }

  return payload;
}
