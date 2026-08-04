'use client';

import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useEffect,
  useMemo,
  useState
} from 'react';
import { ArrowRightLeft, CheckSquare2, Layers3, Save } from '@/components/icons';

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

const REQUIRED_FIELDS: Array<{
  key: keyof Pick<
    MappingFormState,
    | 'category_main_column'
    | 'category_sub_column'
    | 'product_group_column'
    | 'product_variant_column'
  >;
  label: string;
  helper: string;
}> = [
  {
    key: 'category_main_column',
    label: 'Danh mục chính',
    helper: 'Tầng điều hướng đầu tiên của sản phẩm.'
  },
  {
    key: 'category_sub_column',
    label: 'Danh mục con',
    helper: 'Nhánh con nằm dưới danh mục chính.'
  },
  {
    key: 'product_group_column',
    label: 'Nhóm sản phẩm',
    helper: 'Tên sản phẩm gốc, lặp lại qua nhiều biến thể.'
  },
  {
    key: 'product_variant_column',
    label: 'Biến thể sản phẩm',
    helper: 'Tên hiển thị chi tiết của từng biến thể.'
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
  { key: 'group_external_code_column', label: 'Mã nhóm ngoài' },
  { key: 'variant_external_code_column', label: 'Mã biến thể ngoài' },
  { key: 'sku_column', label: 'SKU' },
  { key: 'model_code_column', label: 'Mã model' },
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
  const [mappingMode, setMappingMode] = useState<MappingMode>(
    recognizedDefaults ? 'recognized_profile' : 'system_suggestion'
  );
  const [saveProfile, setSaveProfile] = useState(false);
  const [profileName, setProfileName] = useState(
    getProfileName(recognizedProfile, preview)
  );

  useEffect(() => {
    setForm(initialState);
    setLocalError('');
    setMappingMode(recognizedDefaults ? 'recognized_profile' : 'system_suggestion');
    setSaveProfile(false);
    setProfileName(getProfileName(recognizedProfile, preview));
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

  if (!preview || headers.length === 0) {
    return null;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const errorMessage = validateForm(form, saveProfile, profileName);
    if (errorMessage) {
      setLocalError(errorMessage);
      return;
    }

    setLocalError('');
    await onSubmit(toPayload(form, saveProfile, profileName));
  }

  function useSuggestedMapping() {
    setForm(defaults);
    setMappingMode('system_suggestion');
    setLocalError('');
  }

  function useRecognizedProfile() {
    if (!recognizedDefaults) return;
    setForm(recognizedDefaults);
    setMappingMode('recognized_profile');
    setLocalError('');
  }

  return (
    <Card className="overflow-hidden" data-import-column-mapping="true">
      <div className="border-b border-border bg-muted px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-sm border border-border bg-panel text-primary">
            <ArrowRightLeft className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text">Xác nhận cột dữ liệu</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Chọn cấu hình gợi ý của hệ thống, dùng cấu hình đã lưu nếu đây là file
              quen, hoặc tự chọn từng cột trước khi tạo dữ liệu tạm.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5 p-4">
        <section
          className="space-y-3 rounded-sm border border-border bg-panel px-4 py-4"
          data-import-mapping-stage="true"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text">Chọn cách gán cột</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Hệ thống có thể điền sẵn theo cấu hình đã lưu hoặc theo gợi ý mặc định.
              </p>
            </div>
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
              Hệ thống đã nhận ra mẫu cột quen{' '}
              <span className="font-semibold">
                “{formatValue(recognizedProfile.profile_name)}”
              </span>
              . Bạn có thể dùng lại cấu hình đã lưu này hoặc chuyển sang gợi ý hệ
              thống rồi chỉnh tay.
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
              }}
              data-import-use-manual-mapping="true"
            >
              Tự chọn cột
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-text">Phân cấp sản phẩm</h3>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {REQUIRED_FIELDS.map((field) => (
              <label key={field.key} className="block space-y-2">
                <span className="text-sm font-medium text-text">{field.label}</span>
                <Select
                  data-import-required-role={field.key}
                  value={form[field.key]}
                  onChange={(event) =>
                    updateSingleField(
                      setForm,
                      setMappingMode,
                      field.key,
                      event.target.value
                    )
                  }
                >
                  <option value="">Chọn cột dữ liệu</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">{field.helper}</p>
                <SampleValueChips header={form[field.key]} sampleRows={sampleRows} />
              </label>
            ))}
          </div>
        </section>

        <details className="rounded-sm border border-border bg-panel">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-text">
            Tùy chọn bổ sung
          </summary>
          <div className="grid gap-4 border-t border-border px-4 py-4 lg:grid-cols-2">
            {OPTIONAL_FIELDS.map((field) => (
              <label key={field.key} className="block space-y-2">
                <span className="text-sm font-medium text-text">{field.label}</span>
                <Select
                  value={form[field.key]}
                  onChange={(event) =>
                    updateSingleField(
                      setForm,
                      setMappingMode,
                      field.key,
                      event.target.value
                    )
                  }
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
        </details>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckSquare2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-text">Cột thông số và cột bỏ qua</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Với các cột còn lại, bạn có thể đánh dấu giữ ở thông số sản phẩm, thuộc tính
            biến thể hoặc bỏ qua trong lần nhập này.
          </p>

          {flexibleHeaders.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
              Tất cả cột hiện đã được gán vào các đích dữ liệu chính.
            </div>
          ) : (
            <div className="space-y-3">
              {flexibleHeaders.map((header) => (
                <div
                  key={header}
                  className="rounded-sm border border-border bg-panel px-3 py-3"
                >
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text">{header}</div>
                      <SampleValueChips header={header} sampleRows={sampleRows} />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {FLEXIBLE_ROLE_OPTIONS.map((option) => {
                        const checked = getFlexibleRole(form, header) === option.value;
                        return (
                          <label
                            key={option.value}
                            className={[
                              'flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-2 text-sm transition-colors',
                              checked
                                ? 'border-primary bg-primary/5 text-primary'
                                : 'border-border bg-white text-muted-foreground hover:border-primary/40'
                            ].join(' ')}
                          >
                            <input
                              className="h-4 w-4"
                              type="radio"
                              name={`mapping-role-${header}`}
                              checked={checked}
                              onChange={() =>
                                updateFlexibleRole(setForm, setMappingMode, header, option.value)
                              }
                            />
                            {option.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-sm border border-border bg-panel px-4 py-4">
          <div className="flex items-center gap-2">
            <Save className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-text">Lưu cấu hình mapping</h3>
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
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                placeholder="Ví dụ: Mẫu import đèn LED tháng 4"
                data-import-mapping-profile-name="true"
              />
            </label>
          ) : null}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-text">Xem nhanh kết quả mapping</h3>
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
          <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {localError}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Sau khi xác nhận, hệ thống mới tạo dữ liệu tạm để bạn duyệt từng dòng.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={useSuggestedMapping}
              disabled={submitting}
            >
              Dùng cấu hình gợi ý
            </Button>
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
      {values.map((value) => (
        <Badge key={`${header}-${value}`} tone="default">
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
  return 'Cấu hình import quen';
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : '';
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
  setForm((current) => ({
    ...current,
    [key]: value,
    spec_columns: current.spec_columns.filter((item) => item !== value),
    attribute_columns: current.attribute_columns.filter((item) => item !== value),
    ignored_columns: current.ignored_columns.filter((item) => item !== value)
  }));
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

function validateForm(
  form: MappingFormState,
  saveProfile: boolean,
  profileName: string
) {
  for (const field of REQUIRED_FIELDS) {
    if (!form[field.key]) {
      return `Vui lòng chọn cột cho ${field.label.toLowerCase()}.`;
    }
  }

  const singleAssignments = [
    ['Danh mục chính', form.category_main_column],
    ['Danh mục con', form.category_sub_column],
    ['Nhóm sản phẩm', form.product_group_column],
    ['Biến thể sản phẩm', form.product_variant_column],
    ['Thương hiệu', form.brand_column],
    ['Mô tả ngắn', form.short_description_column],
    ['Mã nhóm ngoài', form.group_external_code_column],
    ['Mã biến thể ngoài', form.variant_external_code_column],
    ['SKU', form.sku_column],
    ['Mã model', form.model_code_column],
    ['Giá công khai', form.public_price_column]
  ].filter(([, value]) => Boolean(value));

  const seen = new Map<string, string>();
  for (const [label, column] of singleAssignments) {
    const existing = seen.get(column);
    if (existing) {
      return `Cột “${column}” đang được gán cho cả ${existing.toLowerCase()} và ${label.toLowerCase()}.`;
    }
    seen.set(column, label);
  }

  if (saveProfile && profileName.trim().length === 0) {
    return 'Vui lòng nhập tên cấu hình mapping để lưu lại.';
  }

  return '';
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
