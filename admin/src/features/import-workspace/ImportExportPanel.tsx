'use client';

import { type ReactNode } from 'react';
import {
  Database,
  Download,
  FileDown,
  FileSpreadsheet,
  Filter,
  PackageSearch,
  Tags,
  Users
} from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorMessagePanel } from '@/components/ui/ErrorMessagePanel';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/cn';
import { filenameWithExtension } from '@/lib/exportFile';
import { exportDateRangeLabel, validateExportDateRange, type ExportDateField } from './exportDateRange';
import {
  type WorkspaceTab,
  type ExportPurpose,
  type ExportTemplateKey,
  type ExportScope,
  type ExportFormat,
  type ExportFilterState,
  type ImportRow,
  exportFormats,
  type CustomerExportSourceKind,
  type CustomerExportDeletedScope,
  type ExportDataStatus,
  exportPurposes
} from './importWorkspaceTypes';
import {
  exportFilterHasCondition,
  activeRecords,
  categoryParentId,
  recordId,
  recordName,
  localIsoDate
} from './importExportHelpers';
import {
  SectionTitle,
  QuickPresetButton,
  CompactCheckOption,
  ChoiceButton,
  CheckOption
} from './ImportWorkspaceParts';

export function WorkspaceTabs({
  active,
  onChange
}: {
  active: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
}) {
  return (
    <div
      className="inline-flex w-full rounded-sm border border-border bg-panel p-1 sm:w-auto"
      role="tablist"
      aria-label="Chọn khu dữ liệu"
      data-import-workspace-tabs="true"
    >
      <WorkspaceTabButton
        active={active === 'import'}
        icon={<Database className="h-4 w-4" />}
        label="Lô nhập"
        onClick={() => onChange('import')}
      />
      <WorkspaceTabButton
        active={active === 'export'}
        icon={<FileDown className="h-4 w-4" />}
        label="Xuất dữ liệu"
        onClick={() => onChange('export')}
      />
    </div>
  );
}

function WorkspaceTabButton({
  active,
  icon,
  label,
  onClick
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex min-h-11 flex-1 items-center justify-center gap-2 rounded-sm px-4 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 sm:flex-none',
        active ? 'bg-primary text-primary-foreground' : 'text-slate-600 hover:bg-muted'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export function SimpleExportWorkspacePanel({
  purpose,
  template,
  scope,
  format,
  filename,
  includeVariants,
  includeSpecs,
  includeDocuments,
  publicSafeOnly,
  filters,
  brands,
  categories,
  brandCategoryIds,
  brandCategoriesLoading,
  brandCategoriesError,
  referencesLoading,
  referencesError,
  exporting,
  actionError,
  actionMessage,
  onPurposeChange,
  onTemplateChange,
  onFilenameChange,
  onFilenameReset,
  onScopeChange,
  onFormatChange,
  onIncludeVariantsChange,
  onIncludeSpecsChange,
  onIncludeDocumentsChange,
  onPublicSafeOnlyChange,
  onFilterChange,
  onDownload
}: {
  purpose: ExportPurpose;
  template: ExportTemplateKey;
  scope: ExportScope;
  format: ExportFormat;
  filename: string;
  includeVariants: boolean;
  includeSpecs: boolean;
  includeDocuments: boolean;
  publicSafeOnly: boolean;
  filters: ExportFilterState;
  brands: ImportRow[];
  categories: ImportRow[];
  brandCategoryIds: string[];
  brandCategoriesLoading: boolean;
  brandCategoriesError: unknown;
  referencesLoading: boolean;
  referencesError: unknown;
  exporting: boolean;
  actionError: unknown;
  actionMessage: string;
  onPurposeChange: (purpose: ExportPurpose) => void;
  onTemplateChange: (template: ExportTemplateKey) => void;
  onFilenameChange: (filename: string) => void;
  onFilenameReset: () => void;
  onScopeChange: (scope: ExportScope) => void;
  onFormatChange: (format: ExportFormat) => void;
  onIncludeVariantsChange: (checked: boolean) => void;
  onIncludeSpecsChange: (checked: boolean) => void;
  onIncludeDocumentsChange: (checked: boolean) => void;
  onPublicSafeOnlyChange: (checked: boolean) => void;
  onFilterChange: (patch: Partial<ExportFilterState>) => void;
  onDownload: () => void;
}) {
  const selectedFormat = exportFormats.find((item) => item.key === format) ?? exportFormats[0];
  const isCustomerTemplate = template === 'customers';
  const supportsCsv = template === 'technical_documents';
  const templateLabel = {
    product_catalog: 'Sản phẩm',
    taxonomy_brand: 'Danh mục và thương hiệu',
    technical_documents: 'Tài liệu kỹ thuật',
    customers: 'Khách hàng',
    future_data: 'Dữ liệu'
  }[template];
  const sheetCount = template === 'taxonomy_brand' ? 2 : 1;
  const hasCondition = exportFilterHasCondition(filters);
  const dateRangeError = validateExportDateRange({
    from: filters.dateFrom,
    to: filters.dateTo
  });
  const downloadDisabled =
    exporting ||
    !filename.trim() ||
    Boolean(dateRangeError) ||
    (!isCustomerTemplate && referencesLoading) ||
    (!isCustomerTemplate && brandCategoriesLoading) ||
    (!isCustomerTemplate && scope === 'condition' && !hasCondition);
  const activeCategories = activeRecords(categories);
  const activeCategoryChildren = activeCategories.filter((category) => categoryParentId(category));
  const brandCategoryIdSet = new Set(brandCategoryIds);
  const isCategoryAllowedByBrand = (category: ImportRow) =>
    !filters.brandId || brandCategoryIdSet.has(recordId(category));
  const parentCategoryOptions = activeCategories
    .filter((category) => !categoryParentId(category))
    .filter((category) => {
      if (!filters.brandId) return true;
      if (isCategoryAllowedByBrand(category)) return true;

      const categoryId = recordId(category);
      return activeCategoryChildren.some(
        (child) => categoryParentId(child) === categoryId && isCategoryAllowedByBrand(child)
      );
    });
  const childCategoryOptions = filters.categoryParentId
    ? activeCategoryChildren.filter(
        (category) =>
          categoryParentId(category) === filters.categoryParentId && isCategoryAllowedByBrand(category)
      )
    : [];
  const categoryControlsDisabled = referencesLoading || brandCategoriesLoading || Boolean(brandCategoriesError);
  const variantOptionDisabled = template !== 'product_catalog';
  const specsOptionDisabled = variantOptionDisabled || !includeVariants;
  const documentOptionDisabled = template !== 'product_catalog';
  const documentOptionDescription =
    template === 'technical_documents'
      ? 'Mẫu tài liệu kỹ thuật luôn xuất sheet tài liệu, không cần chọn thêm.'
      : template === 'taxonomy_brand'
        ? 'Không áp dụng cho mẫu danh mục, thương hiệu.'
        : 'Ghi tên, loại, phiên bản và tên tệp tài liệu ngay trên dòng sản phẩm.';

  function selectPreset(nextTemplate: ExportTemplateKey) {
    onTemplateChange(nextTemplate);

    if (nextTemplate === 'product_catalog') {
      onPurposeChange('roundtrip');
      onFormatChange('xlsx');
      onIncludeVariantsChange(true);
      onIncludeSpecsChange(true);
      onIncludeDocumentsChange(true);
      onPublicSafeOnlyChange(false);
      return;
    }

    if (nextTemplate === 'taxonomy_brand') {
      onPurposeChange('internal_review');
      onFormatChange('xlsx');
      onIncludeVariantsChange(false);
      onIncludeSpecsChange(false);
      onIncludeDocumentsChange(false);
      onPublicSafeOnlyChange(false);
      return;
    }

    if (nextTemplate === 'customers') {
      onPurposeChange('internal_review');
      onScopeChange('all');
      onFormatChange('xlsx');
      onIncludeVariantsChange(false);
      onIncludeSpecsChange(false);
      onIncludeDocumentsChange(false);
      onPublicSafeOnlyChange(false);
      return;
    }

    if (nextTemplate === 'technical_documents') {
      onPurposeChange('public_share');
      onFormatChange('xlsx');
      onIncludeVariantsChange(false);
      onIncludeSpecsChange(false);
      onIncludeDocumentsChange(true);
      onPublicSafeOnlyChange(true);
    }
  }

  return (
    <div className="space-y-4" data-import-export-panel="true">
      <Card className="overflow-hidden">
        <div className="bg-[#153957] px-5 py-5 text-white lg:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a8d6ef]">Không gian dữ liệu / Xuất dữ liệu</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Tạo file xuất</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[#d6e5ef]">
                Chọn loại dữ liệu, xác định phạm vi, sau đó tải file để xem hoặc xử lý tiếp.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-md border border-white/25 bg-white/10 px-3 py-2 text-xs font-medium text-white">
              <FileSpreadsheet className="h-4 w-4" />
              {format === 'csv' ? 'CSV cho dữ liệu một sheet' : 'Excel có bộ lọc và cố định tiêu đề'}
            </span>
          </div>
        </div>

        {referencesError ? (
          <div className="border-b border-border px-4 py-4">
            <ErrorMessagePanel error={referencesError} context="module-load" compact />
          </div>
        ) : null}

        {actionError ? (
          <div className="border-b border-border px-4 py-4">
            <ErrorMessagePanel error={actionError} context="action" compact />
          </div>
        ) : null}

        {actionMessage ? (
          <div className="border-b border-border px-4 py-4">
            <div className="rounded-sm border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-700">
              {actionMessage}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-5 p-4 lg:p-6">
          <section>
            <SectionTitle
              icon={<PackageSearch className="h-4 w-4" />}
              title="1. Loại dữ liệu"
              helper="Mỗi lựa chọn tạo một hoặc nhiều sheet phù hợp với dữ liệu hiện có."
            />
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <QuickPresetButton
                active={template === 'product_catalog'}
                icon={<FileSpreadsheet className="h-4 w-4" />}
                title="Sản phẩm Excel"
                description="Một sheet với mã đã nhập, thông số và tài liệu theo từng biến thể."
                onClick={() => selectPreset('product_catalog')}
              />
              <QuickPresetButton
                active={template === 'taxonomy_brand'}
                icon={<Tags className="h-4 w-4" />}
                title="Danh mục, thương hiệu"
                description="Cây danh mục và danh sách thương hiệu."
                onClick={() => selectPreset('taxonomy_brand')}
              />
              <QuickPresetButton
                active={template === 'technical_documents'}
                icon={<FileDown className="h-4 w-4" />}
                title="Tài liệu kỹ thuật"
                description="Danh sách tài liệu và file liên kết."
                onClick={() => selectPreset('technical_documents')}
              />
              <QuickPresetButton
                active={template === 'customers'}
                icon={<Users className="h-4 w-4" />}
                title="Khách hàng Excel"
                description="Hồ sơ khách hàng, liên hệ, báo giá và lần tương tác gần nhất."
                onClick={() => selectPreset('customers')}
              />
            </div>
          </section>

          {isCustomerTemplate ? (
            <section>
              <SectionTitle
                icon={<Filter className="h-4 w-4" />}
                title="2. Lọc khách hàng"
              />
              <div className="mt-3 grid gap-3 rounded-sm border border-border bg-panel p-3 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Tìm kiếm
                  </span>
                  <Input
                    value={filters.customerQuery}
                    placeholder="Tên khách, công ty, số điện thoại, email..."
                    onChange={(event) => onFilterChange({ customerQuery: event.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Nguồn tương tác
                  </span>
                  <Select
                    value={filters.customerSourceKind}
                    onChange={(event) =>
                      onFilterChange({
                        customerSourceKind: event.target.value as CustomerExportSourceKind
                      })
                    }
                  >
                    <option value="all">Tất cả nguồn</option>
                    <option value="contact">Có liên hệ</option>
                    <option value="quote">Có báo giá</option>
                    <option value="both">Có cả hai</option>
                  </Select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Trạng thái hồ sơ
                  </span>
                  <Select
                    value={filters.customerDeletedScope}
                    onChange={(event) =>
                      onFilterChange({
                        customerDeletedScope: event.target.value as CustomerExportDeletedScope
                      })
                    }
                  >
                    <option value="active">Đang hoạt động</option>
                    <option value="deleted">Đã lưu trữ</option>
                    <option value="all">Tất cả</option>
                  </Select>
                </label>

                <div className="md:col-span-2 rounded-sm border border-border bg-muted/30 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-text">Nội dung Excel</p>
                    </div>
                    <Badge tone="info">Hồ sơ luôn có</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <CompactCheckOption
                      checked={filters.customerIncludeContacts}
                      label="Số liên hệ"
                      onChange={(checked) => onFilterChange({ customerIncludeContacts: checked })}
                    />
                    <CompactCheckOption
                      checked={filters.customerIncludeQuotes}
                      label="Số báo giá"
                      onChange={(checked) => onFilterChange({ customerIncludeQuotes: checked })}
                    />
                    <CompactCheckOption
                      checked={filters.customerIncludeLastInteraction}
                      label="Tương tác gần nhất"
                      onChange={(checked) =>
                        onFilterChange({ customerIncludeLastInteraction: checked })
                      }
                    />
                    <CompactCheckOption
                      checked={filters.customerIncludeSystemInfo}
                      label="Ngày tạo, cập nhật"
                      onChange={(checked) =>
                        onFilterChange({ customerIncludeSystemInfo: checked })
                      }
                    />
                  </div>
                </div>

              </div>
            </section>
          ) : (
            <section>
              <SectionTitle
                icon={<Filter className="h-4 w-4" />}
                title="2. Phạm vi"
                helper="Xuất tất cả để tải nhanh, hoặc chọn điều kiện để thu hẹp dữ liệu."
              />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <ChoiceButton
                  active={scope === 'all'}
                  title="Xuất tất cả"
                  description="Ít thao tác nhất, lấy toàn bộ dữ liệu hợp lệ."
                  badge="Nhanh"
                  onClick={() => onScopeChange('all')}
                />
                <ChoiceButton
                  active={scope === 'condition'}
                  title="Chọn điều kiện"
                  description="Chọn thương hiệu như MPE, hoặc lọc theo danh mục, trạng thái."
                  badge="Có lọc"
                  onClick={() => onScopeChange('condition')}
                />
              </div>

              {scope === 'condition' ? (
                <div className="mt-3 rounded-sm border border-primary bg-blue-50 p-3">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Thương hiệu
                    </span>
                    <Select
                      aria-label="Thương hiệu"
                      value={filters.brandId}
                      disabled={referencesLoading}
                      onChange={(event) =>
                        onFilterChange({
                          brandId: event.target.value,
                          categoryParentId: '',
                          categoryChildId: ''
                        })
                      }
                    >
                      <option value="">Tất cả thương hiệu</option>
                      {brands.map((brand) => (
                        <option key={recordId(brand)} value={recordId(brand)}>
                          {recordName(brand)}
                        </option>
                      ))}
                    </Select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Danh mục cha
                    </span>
                    <Select
                      aria-label="Danh mục cha"
                      value={filters.categoryParentId}
                      disabled={categoryControlsDisabled}
                      onChange={(event) =>
                        onFilterChange({
                          categoryParentId: event.target.value,
                          categoryChildId: ''
                        })
                      }
                    >
                      <option value="">Tất cả danh mục cha</option>
                      {parentCategoryOptions.map((category) => (
                        <option key={recordId(category)} value={recordId(category)}>
                          {recordName(category)}
                        </option>
                      ))}
                    </Select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Danh mục con
                    </span>
                    <Select
                      aria-label="Danh mục con"
                      value={filters.categoryChildId}
                      disabled={categoryControlsDisabled || !filters.categoryParentId}
                      onChange={(event) => onFilterChange({ categoryChildId: event.target.value })}
                    >
                      <option value="">
                        {filters.categoryParentId ? 'Tất cả danh mục con' : 'Chọn danh mục cha trước'}
                      </option>
                      {childCategoryOptions.map((category) => (
                        <option key={recordId(category)} value={recordId(category)}>
                          {recordName(category)}
                        </option>
                      ))}
                    </Select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Trạng thái
                    </span>
                    <Select
                      aria-label="Trạng thái"
                      value={filters.status}
                      disabled={referencesLoading}
                      onChange={(event) =>
                        onFilterChange({ status: event.target.value as ExportDataStatus })
                      }
                    >
                      <option value="all">Tất cả</option>
                      <option value="active">Đang hoạt động</option>
                      <option value="inactive">Tạm ngưng</option>
                    </Select>
                  </label>
                </div>

                {referencesLoading ? (
                  <p className="mt-3 rounded-sm border border-blue-200 bg-panel px-3 py-2 text-xs leading-5 text-blue-700">
                    Đang tải danh sách thương hiệu và danh mục...
                  </p>
                ) : null}

                {brandCategoriesLoading ? (
                  <p className="mt-3 rounded-sm border border-blue-200 bg-panel px-3 py-2 text-xs leading-5 text-blue-700">
                    Đang lọc danh mục theo thương hiệu đã chọn...
                  </p>
                ) : null}

                {brandCategoriesError ? (
                  <div className="mt-3">
                    <ErrorMessagePanel error={brandCategoriesError} context="module-load" compact />
                  </div>
                ) : null}

                {filters.brandId && !brandCategoriesLoading && !brandCategoriesError && parentCategoryOptions.length === 0 ? (
                  <p className="mt-3 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                    Thương hiệu này chưa có nhóm sản phẩm đang dùng, nên không có danh mục để chọn.
                  </p>
                ) : null}

                {filters.categoryParentId && !brandCategoriesLoading && childCategoryOptions.length === 0 ? (
                  <p className="mt-3 rounded-sm border border-blue-200 bg-panel px-3 py-2 text-xs leading-5 text-blue-700">
                    Danh mục cha này không có danh mục con phù hợp với bộ lọc hiện tại. Tệp sẽ lấy theo danh mục cha.
                  </p>
                ) : null}

                {!hasCondition ? (
                  <p className="mt-3 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                    Chọn ít nhất một điều kiện hoặc chuyển sang “Xuất tất cả”.
                  </p>
                ) : null}
                </div>
              ) : null}
            </section>
          )}

          <section data-export-date-range="true" className="rounded-md border border-border bg-[#f8fafc] p-4">
            <SectionTitle
              icon={<Filter className="h-4 w-4" />}
              title="3. Khoảng thời gian"
              helper="Để trống ngày nếu cần toàn bộ dữ liệu trong phạm vi đã chọn."
            />
            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-text">Mốc thời gian</span>
                  <Select
                    aria-label="Mốc thời gian"
                    value={filters.dateField}
                    onChange={(event) =>
                      onFilterChange({ dateField: event.target.value as ExportDateField })
                    }
                  >
                    <option value="updated_at">Ngày cập nhật</option>
                    <option value="created_at">Ngày tạo</option>
                  </Select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-text">Từ ngày</span>
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    max={filters.dateTo || undefined}
                    data-export-date-start="true"
                    onChange={(event) => onFilterChange({ dateFrom: event.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-text">Đến ngày</span>
                  <Input
                    type="date"
                    value={filters.dateTo}
                    min={filters.dateFrom || undefined}
                    data-export-date-end="true"
                    onChange={(event) => onFilterChange({ dateTo: event.target.value })}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2" aria-label="Chọn nhanh khoảng thời gian">
                {[7, 30, 90].map((days) => (
                  <button
                    key={days}
                    type="button"
                    className="min-h-10 rounded-md border border-border bg-panel px-3 text-sm font-medium text-slate-700 hover:bg-muted"
                    onClick={() => {
                      const today = localIsoDate();
                      onFilterChange({ dateFrom: localIsoDate(days - 1), dateTo: today });
                    }}
                  >
                    {days} ngày
                  </button>
                ))}
                {(filters.dateFrom || filters.dateTo) ? (
                  <button
                    type="button"
                    className="min-h-10 rounded-md px-3 text-sm font-medium text-primary hover:bg-blue-50"
                    onClick={() => onFilterChange({ dateFrom: '', dateTo: '' })}
                  >
                    Xóa ngày
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-muted-foreground">
                {exportDateRangeLabel({
                  field: filters.dateField,
                  from: filters.dateFrom,
                  to: filters.dateTo
                })}
              </span>
              {dateRangeError ? (
                <span role="alert" className="font-medium text-red-700">
                  {dateRangeError}
                </span>
              ) : null}
            </div>
          </section>

          {!isCustomerTemplate ? (
            <details className="rounded-sm border border-border bg-panel">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-text">
                Tùy chọn nâng cao
              </summary>
              <div className="space-y-4 border-t border-border p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Mục đích
                    </span>
                    <Select
                      value={purpose}
                      onChange={(event) => onPurposeChange(event.target.value as ExportPurpose)}
                    >
                      {exportPurposes.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.title}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Định dạng tệp
                    </span>
                    <Select
                      value={format}
                      disabled={!supportsCsv}
                      onChange={(event) => onFormatChange(event.target.value as ExportFormat)}
                    >
                      {exportFormats
                        .filter(
                          (item) =>
                            item.key === 'xlsx' || (supportsCsv && item.key === 'csv')
                        )
                        .map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.title} - tải ngay
                        </option>
                        ))}
                    </Select>
                  </label>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <CheckOption
                    checked={includeVariants}
                    label="Kèm biến thể và mã sản phẩm"
                    description={
                      variantOptionDisabled
                        ? 'Chỉ áp dụng cho mẫu Sản phẩm Excel.'
                        : 'Mỗi biến thể nằm cùng dòng với thông tin sản phẩm; tắt mục này sẽ không có mã sản phẩm.'
                    }
                    disabled={variantOptionDisabled}
                    onChange={onIncludeVariantsChange}
                  />
                  <CheckOption
                    checked={includeVariants && includeSpecs}
                    label="Kèm thông số kỹ thuật"
                    description={
                      specsOptionDisabled
                        ? 'Cần kèm biến thể để hiện thông số của từng mã sản phẩm.'
                        : 'Ghi tên và giá trị thông số ngay trên dòng biến thể.'
                    }
                    disabled={specsOptionDisabled}
                    onChange={onIncludeSpecsChange}
                  />
                  <CheckOption
                    checked={includeDocuments}
                    label="Kèm tài liệu"
                    description={documentOptionDescription}
                    disabled={documentOptionDisabled}
                    onChange={onIncludeDocumentsChange}
                  />
                  <CheckOption
                    checked={publicSafeOnly}
                    label="Chỉ dữ liệu đã công khai"
                    description="Chỉ lấy bản ghi đang hoạt động, đã duyệt và đã xuất bản."
                    onChange={onPublicSafeOnlyChange}
                  />
                </div>
              </div>
            </details>
          ) : null}

          <div className="rounded-md border border-border bg-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="export-filename" className="text-sm font-semibold text-text">Tên tệp khi tải</label>
              <button
                type="button"
                className="text-xs font-semibold text-primary hover:underline"
                onClick={onFilenameReset}
              >
                Dùng tên gợi ý
              </button>
            </div>
            <Input
              id="export-filename"
              className="mt-2 w-full"
              value={filename}
              maxLength={120}
              onChange={(event) => onFilenameChange(event.target.value)}
            />
            <p className="mt-2 break-all text-xs text-muted-foreground">
              Tệp tải về: <span className="font-medium text-text">{filenameWithExtension(filename, format === 'csv' ? 'csv' : 'xlsx')}</span>
            </p>
          </div>

          <div className="flex flex-col gap-4 rounded-md border border-[#bed4e4] bg-[#eff6fb] p-4 sm:flex-row sm:items-center sm:justify-between lg:px-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#396b91]">Tệp sẽ tạo</p>
              <p className="mt-1 text-sm font-semibold text-text">
                {templateLabel}
                <span className="font-normal text-muted-foreground"> · {isCustomerTemplate ? 'Theo bộ lọc khách hàng' : scope === 'all' ? 'Tất cả dữ liệu' : 'Theo điều kiện'} · {selectedFormat.title}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {exportDateRangeLabel({ field: filters.dateField, from: filters.dateFrom, to: filters.dateTo })}
                {` · ${sheetCount} sheet`}
              </p>
            </div>
            <Button
              type="button"
              disabled={downloadDisabled}
              onClick={onDownload}
              data-import-export-submit="true"
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Đang tạo file...' : `Tải ${selectedFormat.title}`}
            </Button>
          </div>
        </div>
      </Card>

    </div>
  );
}
