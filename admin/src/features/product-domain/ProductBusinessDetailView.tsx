'use client';

import { ReactNode } from 'react';
import { ProductImageGalleryCard } from './ProductImageGalleryCard';
import { ProductFeatureEditor } from './ProductFeatureEditor';
import { ProductPicker } from './ProductPicker';
import { type BusinessReferenceData as ReferenceData } from './businessListFilters';
import { getDisplayPublishBlockers } from './businessForm';
import { getProductVariantParentPublishIssue, type DisplayStatusAction } from './businessStatus';
import { BUSINESS_CONFIGS } from './businessConfig';
import type { BusinessKind, ProductWorkspaceSection } from './businessTypes';
import { Field } from '@/components/form/Field';
import { FileReferencePicker } from '@/components/form/ReferencePickers';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { formatDate, formatValue } from '@/lib/formatters';
import { formatStatusLabel } from '@/lib/status-labels';
import {
  TwoColumnGrid,
  asRecord,
  canPreviewPublicPrice,
  formatCurrency,
  formatVariantOption,
  type RecordMap
} from './businessPageShared';
import { formatProductGroupOption } from './businessPageData';
import { type FieldErrors } from './businessDetailTypes';
import {
  SectionCard,
  DetailsCard,
  hasAnyValue,
  CompactInfoCard,
  DependencyCard
} from './businessDetailHelpers';

export function renderFormSections(
  kind: BusinessKind,
  context: {
    form: Record<string, string>;
    setForm: (value: Record<string, string>) => void;
    fieldErrors: FieldErrors;
    rootCategories: RecordMap[];
    filteredLevel2Categories: RecordMap[];
    filteredBrands: RecordMap[];
    refs: ReferenceData;
    technicalDocumentVariants: RecordMap[];
    isCreate: boolean;
    canSave: boolean;
    recordId: string;
    activeProductSection: ProductWorkspaceSection;
    displayStatusSection: ReactNode;
    onRelatedChange: () => Promise<void>;
  }
) {
  switch (kind) {
    case 'category':
      return renderCategorySections(context);
    case 'brand':
      return renderBrandSections(context);
    case 'productGroup':
      return renderProductGroupSections(context);
    case 'productVariant':
      return renderProductVariantSections(context);
    case 'technicalDocument':
      return renderTechnicalDocumentSections(context);
  }
}

const PRODUCT_WORKSPACE_SECTIONS: ProductWorkspaceSection[] = [
  'main',
  'content',
  'variants',
  'documents'
];

export function resolveProductWorkspaceSection(value: string | null): ProductWorkspaceSection {
  return PRODUCT_WORKSPACE_SECTIONS.includes(value as ProductWorkspaceSection)
    ? (value as ProductWorkspaceSection)
    : 'main';
}

export function buildProductSectionHrefs(
  pathname: string,
  currentSearch: string
): Record<ProductWorkspaceSection, string> {
  return Object.fromEntries(
    PRODUCT_WORKSPACE_SECTIONS.map((section) => {
      const params = new URLSearchParams(currentSearch);
      if (section === 'main') {
        params.delete('view');
      } else {
        params.set('view', section);
      }
      const query = params.toString();
      return [section, `${pathname}${query ? `?${query}` : ''}`];
    })
  ) as Record<ProductWorkspaceSection, string>;
}

function buildFieldControlId(kind: string, key: string) {
  return `${kind}-${key}`;
}

function buildFieldDescribedBy(controlId: string, hasHint: boolean, error?: string) {
  const ids = [error ? `${controlId}-error` : null, hasHint ? `${controlId}-hint` : null].filter(
    Boolean
  );
  return ids.length > 0 ? ids.join(' ') : undefined;
}

function renderCategorySections({
  form,
  setForm,
  fieldErrors,
  rootCategories,
  isCreate,
  canSave
}: {
  form: Record<string, string>;
  setForm: (value: Record<string, string>) => void;
  fieldErrors: FieldErrors;
  rootCategories: RecordMap[];
  filteredLevel2Categories: RecordMap[];
  filteredBrands: RecordMap[];
  refs: ReferenceData;
  technicalDocumentVariants: RecordMap[];
  isCreate: boolean;
  canSave: boolean;
}) {
  const nameId = buildFieldControlId('category', 'name');
  const parentId = buildFieldControlId('category', 'parent_id');

  return (
    <>
      <SectionCard
        title="Thiết lập danh mục"
      >
        <TwoColumnGrid>
          <Field label="Loại danh mục" readOnly={!canSave}>
            <Select
              data-product-category-level-select="true"
              value={form.category_level}
              disabled={!canSave}
              onChange={(event) =>
                setForm({
                  ...form,
                  category_level: event.target.value,
                  parent_id: event.target.value === 'level_1' ? '' : form.parent_id
                })
              }
            >
              <option value="level_1">Danh mục cấp 1 / Lớp ông</option>
              <option value="level_2">Danh mục cấp 2 / Lớp cha</option>
            </Select>
          </Field>
          <Field
            label="Tên danh mục"
            htmlFor={nameId}
            readOnly={!canSave}
            required
            error={fieldErrors.name}
          >
            <Input
              id={nameId}
              data-field="name"
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={buildFieldDescribedBy(nameId, false, fieldErrors.name)}
              aria-required="true"
              value={form.name}
              readOnly={!canSave}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          {form.category_level === 'level_2' ? (
            <Field
              label="Danh mục cấp 1 cha"
              hint="Chỉ hiển thị các danh mục cấp 1 đang hoạt động."
              htmlFor={parentId}
              readOnly={!canSave}
              required
              error={fieldErrors.parent_id}
            >
              <Select
                id={parentId}
                data-product-category-parent-select="true"
                data-field="parent_id"
                aria-invalid={Boolean(fieldErrors.parent_id)}
                aria-describedby={buildFieldDescribedBy(parentId, true, fieldErrors.parent_id)}
                aria-required="true"
                value={form.parent_id}
                disabled={!canSave}
                onChange={(event) =>
                  setForm({ ...form, parent_id: event.target.value })
                }
              >
                <option value="">Chọn danh mục cấp 1</option>
                {rootCategories.map((category) => (
                  <option key={String(category.id)} value={String(category.id)}>
                    {formatValue(category.name)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </TwoColumnGrid>
      </SectionCard>

      <DetailsCard
        title="Tùy chọn nâng cao"
      >
        <TwoColumnGrid>
          <Field label="Slug" readOnly={!canSave}>
            <Input
              value={form.slug}
              readOnly={!canSave}
              placeholder="Tự tạo từ tên nếu để trống"
              onChange={(event) => setForm({ ...form, slug: event.target.value })}
            />
          </Field>
          <Field label="Biểu tượng" readOnly={!canSave}>
            <FileReferencePicker
              value={form.icon_file_id}
              readOnly={!canSave}
              fieldLabel="biểu tượng"
              preferredGroup="product_image"
              onChange={(value) => setForm({ ...form, icon_file_id: value })}
            />
          </Field>
          <Field label="Mô tả" readOnly={!canSave}>
            <Textarea
              className="min-h-28"
              value={form.description}
              readOnly={!canSave}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </Field>
          {!isCreate ? (
            <>
              <Field label="Trạng thái" readOnly={!canSave}>
                <Select
                  value={form.status}
                  disabled={!canSave}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value })
                  }
                >
                  <option value="active">Đang hoạt động</option>
                  <option value="inactive">Tạm ngưng</option>
                </Select>
              </Field>
            </>
          ) : null}
        </TwoColumnGrid>
      </DetailsCard>
    </>
  );
}

function renderBrandSections({
  form,
  setForm,
  fieldErrors,
  isCreate,
  canSave
}: {
  form: Record<string, string>;
  setForm: (value: Record<string, string>) => void;
  fieldErrors: FieldErrors;
  rootCategories: RecordMap[];
  filteredLevel2Categories: RecordMap[];
  filteredBrands: RecordMap[];
  refs: ReferenceData;
  technicalDocumentVariants: RecordMap[];
  isCreate: boolean;
  canSave: boolean;
}) {
  const nameId = buildFieldControlId('brand', 'name');

  return (
    <>
      <SectionCard
        title="Thông tin thương hiệu"
      >
        <TwoColumnGrid>
          <Field
            label="Tên thương hiệu"
            htmlFor={nameId}
            readOnly={!canSave}
            required
            error={fieldErrors.name}
          >
            <Input
              id={nameId}
              data-field="name"
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={buildFieldDescribedBy(nameId, false, fieldErrors.name)}
              aria-required="true"
              value={form.name}
              readOnly={!canSave}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <Field label="Logo" readOnly={!canSave}>
            <FileReferencePicker
              value={form.logo_file_id}
              readOnly={!canSave}
              fieldLabel="logo"
              preferredGroup="brand_logo"
              onChange={(value) => setForm({ ...form, logo_file_id: value })}
            />
          </Field>
        </TwoColumnGrid>
      </SectionCard>

      <DetailsCard
        title="Tùy chọn nâng cao"
      >
        <TwoColumnGrid>
          <Field label="Slug" readOnly={!canSave}>
            <Input
              value={form.slug}
              readOnly={!canSave}
              placeholder="Tự tạo từ tên nếu để trống"
              onChange={(event) => setForm({ ...form, slug: event.target.value })}
            />
          </Field>
          <Field label="Website" readOnly={!canSave}>
            <Input
              value={form.website_url}
              readOnly={!canSave}
              onChange={(event) =>
                setForm({ ...form, website_url: event.target.value })
              }
            />
          </Field>
          <Field label="Mô tả" readOnly={!canSave}>
            <Textarea
              className="min-h-28"
              value={form.description}
              readOnly={!canSave}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </Field>
          {!isCreate ? (
            <>
              <Field label="Trạng thái" readOnly={!canSave}>
                <Select
                  value={form.status}
                  disabled={!canSave}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value })
                  }
                >
                  <option value="active">Đang hoạt động</option>
                  <option value="inactive">Tạm ngưng</option>
                </Select>
              </Field>
            </>
          ) : null}
        </TwoColumnGrid>
      </DetailsCard>
    </>
  );
}

function renderProductGroupSections({
  form,
  setForm,
  fieldErrors,
  rootCategories,
  filteredLevel2Categories,
  filteredBrands,
  isCreate,
  canSave,
  recordId,
  activeProductSection,
  displayStatusSection,
  onRelatedChange
}: {
  form: Record<string, string>;
  setForm: (value: Record<string, string>) => void;
  fieldErrors: FieldErrors;
  rootCategories: RecordMap[];
  filteredLevel2Categories: RecordMap[];
  filteredBrands: RecordMap[];
  refs: ReferenceData;
  technicalDocumentVariants: RecordMap[];
  isCreate: boolean;
  canSave: boolean;
  recordId: string;
  activeProductSection: ProductWorkspaceSection;
  displayStatusSection: ReactNode;
  onRelatedChange: () => Promise<void>;
}) {
  const nameId = buildFieldControlId('product-group', 'name');
  const categoryLevel1Id = buildFieldControlId('product-group', 'category_level_1_id');
  const categoryId = buildFieldControlId('product-group', 'category_id');

  return (
    <>
      {isCreate || activeProductSection === 'main' ? (
        <>
          <SectionCard
            id="product-group-main"
            title="Thông tin sản phẩm"
          >
        {displayStatusSection}
        <TwoColumnGrid>
          <Field
            label="Tên sản phẩm"
            htmlFor={nameId}
            readOnly={!canSave}
            required
            error={fieldErrors.name}
          >
            <Input
              id={nameId}
              data-field="name"
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={buildFieldDescribedBy(nameId, false, fieldErrors.name)}
              aria-required="true"
              value={form.name}
              readOnly={!canSave}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <Field
            label="Danh mục chính"
            htmlFor={categoryLevel1Id}
            readOnly={!canSave}
            required
            error={fieldErrors.category_level_1_id}
          >
            <Select
              id={categoryLevel1Id}
              data-product-group-level1-select="true"
              data-field="category_level_1_id"
              aria-invalid={Boolean(fieldErrors.category_level_1_id)}
              aria-describedby={buildFieldDescribedBy(
                categoryLevel1Id,
                false,
                fieldErrors.category_level_1_id
              )}
              aria-required="true"
              value={form.category_level_1_id}
              disabled={!canSave}
              onChange={(event) =>
                setForm({
                  ...form,
                  category_level_1_id: event.target.value,
                  category_id: ''
                })
              }
            >
              <option value="">Chọn danh mục chính</option>
              {rootCategories.map((category) => (
                <option key={String(category.id)} value={String(category.id)}>
                  {formatValue(category.name)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Danh mục con"
            htmlFor={categoryId}
            readOnly={!canSave}
            required
            error={fieldErrors.category_id}
          >
            <Select
              id={categoryId}
              data-product-group-level2-select="true"
              data-field="category_id"
              aria-invalid={Boolean(fieldErrors.category_id)}
              aria-describedby={buildFieldDescribedBy(categoryId, false, fieldErrors.category_id)}
              aria-required="true"
              value={form.category_id}
              disabled={!canSave || !form.category_level_1_id}
              onChange={(event) =>
                setForm({ ...form, category_id: event.target.value })
              }
            >
              <option value="">
                {form.category_level_1_id ? 'Chọn danh mục con' : 'Chọn danh mục chính trước'}
              </option>
              {filteredLevel2Categories.map((category) => (
                <option key={String(category.id)} value={String(category.id)}>
                  {formatValue(category.name)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Thương hiệu" readOnly={!canSave}>
            <Select
              data-product-group-brand-select="true"
              value={form.brand_id}
              disabled={!canSave}
              onChange={(event) =>
                setForm({ ...form, brand_id: event.target.value })
              }
            >
              <option value="">Chưa chọn thương hiệu</option>
              {filteredBrands.map((brand) => (
                <option key={String(brand.id)} value={String(brand.id)}>
                  {formatValue(brand.name)}
              </option>
              ))}
            </Select>
          </Field>
          <Field label="Ảnh chính" readOnly={!canSave}>
            <FileReferencePicker
              value={form.thumbnail_file_id}
              readOnly={!canSave}
              fieldLabel="ảnh chính"
              preferredGroup="product_image"
              onChange={(value) => setForm({ ...form, thumbnail_file_id: value })}
            />
          </Field>
          <Field label="Ưu tiên mặc định" hint="Số nhỏ hơn đứng trước khi website chọn sắp xếp Ưu tiên; không thay thế các chế độ Mới nhất hoặc theo tên." readOnly={!canSave}>
            <Input
              type="number"
              min="0"
              step="1"
              data-field="sort_order"
              value={form.sort_order ?? ''}
              readOnly={!canSave}
              onChange={(event) => setForm({ ...form, sort_order: event.target.value })}
            />
          </Field>
        </TwoColumnGrid>
          </SectionCard>

          {!isCreate && recordId ? (
            <ProductImageGalleryCard productGroupId={recordId} canEdit={canSave} onSaved={onRelatedChange} />
          ) : null}
        </>
      ) : null}

      {isCreate || activeProductSection === 'content' ? (
        <>
          <section id="product-group-content" className="rounded-md border border-border bg-white p-5 sm:p-7">
            <div className="mb-7 border-b border-border pb-5">
              <h2 className="text-[22px] font-semibold leading-7 text-text">Nội dung trên website</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Giới thiệu ngắn và đặc điểm nổi bật hiển thị ở Tổng quan. Bảng mã và thông tin kỹ thuật của dữ liệu cũ hiển thị ở Thông số kỹ thuật.
              </p>
            </div>
            <div className="space-y-8">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-primary">Hiển thị ngay</p>
                  <Field
                    label="Giới thiệu ngắn"
                    hint="Một đến hai câu để khách hiểu sản phẩm ngay khi mở trang."
                    readOnly={!canSave}
                  >
                    <Textarea
                      className="min-h-[140px] bg-white p-4 text-base leading-7"
                      data-field="short_description"
                      value={form.short_description}
                      readOnly={!canSave}
                      onChange={(event) => setForm({ ...form, short_description: event.target.value })}
                    />
                  </Field>
                  {!form.short_description.trim() && form.detailed_description.trim() ? (
                    <p className="mt-3 text-sm leading-6 text-amber-800">
                      Chưa có giới thiệu ngắn. Website đang tạm lấy phần đầu mô tả chi tiết.
                    </p>
                  ) : null}
                </div>
                <div className="border-t border-border pt-7">
                  <ProductFeatureEditor
                    value={form.detailed_description}
                    onChange={(value) => setForm({ ...form, detailed_description: value })}
                    readOnly={!canSave}
                    error={fieldErrors.detailed_description}
                  />
                </div>
            </div>
          </section>

          <DetailsCard
            id="product-group-seo"
            title="Mã và SEO nâng cao"
            defaultOpen={!isCreate && hasAnyValue(form, ['slug', 'seo_title', 'seo_description', 'seo_og_image_file_id'])}
            dataAttrs={{ 'data-advanced-seo': 'true' }}
          >
        <TwoColumnGrid>
          <Field label="Slug" readOnly={!canSave}>
            <Input
              value={form.slug}
              readOnly={!canSave}
              placeholder="Tự tạo từ tên nếu để trống"
              onChange={(event) => setForm({ ...form, slug: event.target.value })}
            />
          </Field>
          <Field label="Tiêu đề SEO" readOnly={!canSave}>
            <Input
              value={form.seo_title}
              readOnly={!canSave}
              onChange={(event) => setForm({ ...form, seo_title: event.target.value })}
            />
          </Field>
          <Field label="Ảnh chia sẻ SEO" readOnly={!canSave}>
            <FileReferencePicker
              value={form.seo_og_image_file_id}
              readOnly={!canSave}
              fieldLabel="ảnh chia sẻ SEO"
              preferredGroup="product_image"
              onChange={(value) =>
                setForm({ ...form, seo_og_image_file_id: value })
              }
            />
          </Field>
          <Field label="Mô tả SEO" readOnly={!canSave}>
            <Textarea
              className="min-h-28"
              value={form.seo_description}
              readOnly={!canSave}
              onChange={(event) =>
                setForm({ ...form, seo_description: event.target.value })
              }
            />
          </Field>
        </TwoColumnGrid>
          </DetailsCard>
        </>
      ) : null}

    </>
  );
}

function renderProductVariantSections({
  form,
  setForm,
  fieldErrors,
  isCreate,
  canSave
}: {
  form: Record<string, string>;
  setForm: (value: Record<string, string>) => void;
  fieldErrors: FieldErrors;
  rootCategories: RecordMap[];
  filteredLevel2Categories: RecordMap[];
  filteredBrands: RecordMap[];
  refs: ReferenceData;
  technicalDocumentVariants: RecordMap[];
  isCreate: boolean;
  canSave: boolean;
}) {
  const variantNameId = buildFieldControlId('product-variant', 'variant_name');
  const productGroupId = buildFieldControlId('product-variant', 'product_group_id');
  const detailedDescriptionId = buildFieldControlId('product-variant', 'detailed_description');
  const publicPriceAmountId = buildFieldControlId('product-variant', 'public_price_amount');

  return (
    <>
      <SectionCard
        id="product-variant-main"
        title={isCreate ? 'Thêm biến thể / SKU' : 'Thông tin biến thể / SKU'}
      >
        <TwoColumnGrid>
          <Field
            label="Tên biến thể / SKU"
            htmlFor={variantNameId}
            readOnly={!canSave}
            required
            error={fieldErrors.variant_name}
          >
            <Input
              id={variantNameId}
              data-field="variant_name"
              aria-invalid={Boolean(fieldErrors.variant_name)}
              aria-describedby={buildFieldDescribedBy(
                variantNameId,
                false,
                fieldErrors.variant_name
              )}
              aria-required="true"
              value={form.variant_name}
              readOnly={!canSave}
              onChange={(event) =>
                setForm({ ...form, variant_name: event.target.value })
              }
            />
          </Field>
          <Field
            label="Sản phẩm dùng chung"
            htmlFor={productGroupId}
            readOnly={!canSave}
            required
            error={fieldErrors.product_group_id}
          >
            <ProductPicker
              id={productGroupId}
              value={form.product_group_id}
              dataField="product_group_id"
              disabled={!canSave}
              invalid={Boolean(fieldErrors.product_group_id)}
              describedBy={buildFieldDescribedBy(
                productGroupId,
                false,
                fieldErrors.product_group_id
              )}
              onChange={(nextValue) => setForm({ ...form, product_group_id: nextValue })}
            />
          </Field>
          <Field label="Cách hiển thị giá" readOnly={!canSave}>
            <Select
              data-product-variant-price-mode-select="true"
              value={form.public_price_mode}
              disabled={!canSave}
              onChange={(event) =>
                setForm({ ...form, public_price_mode: event.target.value })
              }
            >
              <option value="contact_for_quote">Yêu cầu báo giá</option>
              <option value="public_price">Hiển thị giá công khai</option>
            </Select>
          </Field>
          <Field
            label="Giá công khai (đồng)"
            htmlFor={publicPriceAmountId}
            readOnly={!canSave}
            error={fieldErrors.public_price_amount}
          >
            <Input
              id={publicPriceAmountId}
              data-field="public_price_amount"
              type="number"
              inputMode="numeric"
              min={1}
              max={2147483647}
              step={1}
              aria-invalid={Boolean(fieldErrors.public_price_amount)}
              aria-describedby={buildFieldDescribedBy(
                publicPriceAmountId,
                false,
                fieldErrors.public_price_amount
              )}
              value={form.public_price_mode === 'public_price' ? form.public_price_amount : ''}
              readOnly={!canSave}
              disabled={form.public_price_mode !== 'public_price'}
              onChange={(event) =>
                setForm({ ...form, public_price_amount: event.target.value })
              }
            />
            {form.public_price_mode === 'public_price' && canPreviewPublicPrice(form.public_price_amount) ? (
              <p className="mt-1 text-sm font-semibold text-primaryStrong">
                Xem trước: {formatCurrency(form.public_price_amount)}
              </p>
            ) : null}
          </Field>
          <div className="md:col-span-2">
            <Field
              label="Ảnh biến thể"
              hint="Chỉ chọn khi biến thể có ảnh khác sản phẩm dùng chung."
              readOnly={!canSave}
            >
              <FileReferencePicker
                value={form.image_file_id}
                readOnly={!canSave}
                fieldLabel="ảnh biến thể"
                preferredGroup="product_image"
                allowedMimePrefix="image/"
                onChange={(value) => setForm({ ...form, image_file_id: value })}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field
              label="Mô tả chi tiết riêng"
              hint="Để trống nếu biến thể dùng chung mô tả của sản phẩm."
              htmlFor={detailedDescriptionId}
              readOnly={!canSave}
            >
              <Textarea
                id={detailedDescriptionId}
                data-field="detailed_description"
                className="min-h-28"
                value={form.detailed_description}
                readOnly={!canSave}
                onChange={(event) =>
                  setForm({ ...form, detailed_description: event.target.value })
                }
              />
            </Field>
          </div>
        </TwoColumnGrid>
      </SectionCard>

      <DetailsCard
        title="Tùy chọn nâng cao"
        dataAttrs={{ 'data-product-variant-advanced': 'true' }}
      >
        <TwoColumnGrid>
          <Field
            label="SKU"
            readOnly={!canSave}
          >
            <Input
              value={form.sku}
              placeholder="Tự tạo nếu để trống"
              readOnly={!canSave}
              onChange={(event) => setForm({ ...form, sku: event.target.value })}
            />
          </Field>
          <Field label="Mã ngoài" readOnly={!canSave}>
            <Input
              value={form.external_code}
              readOnly={!canSave}
              onChange={(event) =>
                setForm({ ...form, external_code: event.target.value })
              }
            />
          </Field>
          <Field label="Mã model" readOnly={!canSave}>
            <Input
              value={form.model_code}
              readOnly={!canSave}
              onChange={(event) =>
                setForm({ ...form, model_code: event.target.value })
              }
            />
          </Field>
        </TwoColumnGrid>
      </DetailsCard>
    </>
  );
}

export function DisplayStatusSection({
  id,
  inline = false,
  kind,
  form,
  record,
  dependencies,
  canOpenParent,
  canAct,
  canPrivilegedWorkflow,
  hasUnsavedChanges,
  pendingAction,
  onAction
}: {
  id?: string;
  inline?: boolean;
  kind: BusinessKind;
  form: Record<string, string>;
  record: RecordMap;
  dependencies: Record<string, unknown>;
  canOpenParent: boolean;
  canAct: boolean;
  canPrivilegedWorkflow: boolean;
  hasUnsavedChanges: boolean;
  pendingAction: DisplayStatusAction | null;
  onAction: (action: DisplayStatusAction) => void;
}) {
  const status = displayStatusState(form, canPrivilegedWorkflow);
  const parentIssue = kind === 'productVariant' ? getProductVariantParentPublishIssue(record) : null;
  const parentId = typeof record.product_group_id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(record.product_group_id)
      ? record.product_group_id
      : null;
  const publishBlockers =
    status.actions.includes('publish') ? getDisplayPublishBlockers(kind, form, dependencies) : [];
  const actionDisabled = pendingAction !== null || !canAct || hasUnsavedChanges;

  const content = (
    <div className="space-y-3" data-display-status-card="true">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-display-status-badge="true">
          <Badge tone={status.tone} className="h-7 px-3 text-xs">
            Website: {status.label}
          </Badge>
          <details className="group text-sm text-muted-foreground">
            <summary className="flex min-h-11 cursor-pointer items-center rounded-sm px-1 font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:min-h-10">
              Chi tiết trạng thái
            </summary>
            <p className="pb-1 pl-1 text-sm leading-5">
              Sử dụng: {formatStatusLabel(form.status)} · Duyệt: {formatStatusLabel(form.review_status)}
            </p>
          </details>
        </div>
        {form.publish_status === 'published' ? null : <p className="text-sm text-muted-foreground">{status.description}</p>}

        {hasUnsavedChanges ? (
          <p className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Lưu thay đổi đang soạn trước khi cập nhật trạng thái duyệt hoặc hiển thị.
          </p>
        ) : null}

        {parentIssue ? (
          <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900" data-variant-parent-publish-warning="true">
            <p className="font-medium">{parentIssue}</p>
            <p className="mt-1">Hoàn thiện và xuất bản sản phẩm cha, sau đó quay lại xuất bản biến thể này.</p>
            {canOpenParent && parentId ? (
              <LinkButton href={`${BUSINESS_CONFIGS.productGroup.listPath}/${parentId}`} variant="secondary" size="sm" className="mt-3">
                Mở sản phẩm cha
              </LinkButton>
            ) : null}
          </div>
        ) : null}

        {publishBlockers.length > 0 ? (
          <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
            <div className="font-medium">Chưa thể xuất bản.</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {publishBlockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {canAct ? (
          <div className="flex flex-wrap gap-2" data-display-status-actions="true">
            {status.actions.map((action) => (
              <Button
                key={action}
                type="button"
                variant={displayStatusActionVariant(action)}
                className={displayStatusActionClassName(action)}
                disabled={
                  actionDisabled || (action === 'publish' && (publishBlockers.length > 0 || Boolean(parentIssue)))
                }
                data-display-status-action={action}
                onClick={() => onAction(action)}
              >
                {pendingAction === action
                  ? displayStatusActionBusyLabel(action)
                  : displayStatusActionLabel(action)}
              </Button>
            ))}
          </div>
        ) : null}
    </div>
  );

  return inline ? (
    <div id={id} className="mb-5 scroll-mt-24 border-b border-border pb-5">
      <h3 className="mb-3 text-sm font-semibold text-text">Hiển thị website</h3>
      {content}
    </div>
  ) : (
    <SectionCard id={id} title="Trạng thái hiển thị">
      {content}
    </SectionCard>
  );
}

function displayStatusState(
  form: Record<string, string>,
  canPrivilegedWorkflow: boolean
): {
  label: string;
  description: string;
  tone: 'success' | 'warning' | 'archived';
  actions: DisplayStatusAction[];
} {
  const publishStatus = form.publish_status;
  const reviewStatus = form.review_status;
  const active = form.status === 'active';

  switch (publishStatus) {
    case 'published':
      return {
        label: 'Đã xuất bản',
        description: 'Đang hiển thị trên website.',
        tone: 'success',
        actions: canPrivilegedWorkflow ? ['unpublish', 'archive-display'] : []
      };
    case 'archived':
      return {
        label: 'Đã lưu trữ',
        description: 'Đã được lưu trữ và không còn hiển thị trên website.',
        tone: 'archived',
        actions: ['restore-display']
      };
    default:
      if (!active) {
        return {
          label: 'Chưa xuất bản',
          description: 'Cần kích hoạt bản ghi trước khi có thể gửi duyệt hoặc xuất bản.',
          tone: 'warning',
          actions: ['activate']
        };
      }
      if (reviewStatus === 'draft' || reviewStatus === 'rejected') {
        return {
          label: 'Chưa xuất bản',
          description: 'Hoàn thiện nội dung rồi gửi người có quyền duyệt.',
          tone: 'warning',
          actions: ['submit-review']
        };
      }
      if (reviewStatus === 'pending_review') {
        return {
          label: 'Chưa xuất bản',
          description: canPrivilegedWorkflow
            ? 'Nội dung đang chờ quyết định duyệt.'
            : 'Nội dung đang chờ người có quyền duyệt.',
          tone: 'warning',
          actions: canPrivilegedWorkflow ? ['reject-review', 'approve-review'] : []
        };
      }
      return {
        label: 'Chưa xuất bản',
        description: canPrivilegedWorkflow
          ? 'Đã duyệt. Kiểm tra điều kiện hiển thị trước khi xuất bản.'
          : 'Đã duyệt. Người có quyền xuất bản có thể đưa nội dung lên website.',
        tone: 'warning',
        actions: canPrivilegedWorkflow ? ['publish', 'archive-display'] : []
      };
  }
}

function displayStatusActionLabel(action: DisplayStatusAction) {
  switch (action) {
    case 'activate':
      return 'Kích hoạt';
    case 'deactivate':
      return 'Tạm ngưng';
    case 'submit-review':
      return 'Gửi duyệt';
    case 'approve-review':
      return 'Duyệt';
    case 'reject-review':
      return 'Từ chối';
    case 'publish':
      return 'Xuất bản';
    case 'unpublish':
      return 'Ngừng hiển thị';
    case 'archive-display':
      return 'Lưu trữ hiển thị';
    case 'restore-display':
      return 'Khôi phục';
  }
}

function displayStatusActionBusyLabel(action: DisplayStatusAction) {
  switch (action) {
    case 'activate':
      return 'Đang kích hoạt';
    case 'deactivate':
      return 'Đang tạm ngưng';
    case 'submit-review':
      return 'Đang gửi duyệt';
    case 'approve-review':
      return 'Đang duyệt';
    case 'reject-review':
      return 'Đang từ chối';
    case 'publish':
      return 'Đang xuất bản';
    case 'unpublish':
      return 'Đang cập nhật';
    case 'archive-display':
      return 'Đang lưu trữ';
    case 'restore-display':
      return 'Đang khôi phục';
  }
}

function displayStatusActionVariant(action: DisplayStatusAction) {
  switch (action) {
    case 'approve-review':
    case 'publish':
      return 'primary' as const;
    case 'restore-display':
      return 'primary' as const;
    default:
      return 'secondary' as const;
  }
}

function displayStatusActionClassName(action: DisplayStatusAction) {
  switch (action) {
    case 'reject-review':
    case 'archive-display':
      return 'border-red-200 text-red-700 hover:bg-red-50';
    default:
      return '';
  }
}

function renderTechnicalDocumentSections({
  form,
  setForm,
  fieldErrors,
  refs,
  technicalDocumentVariants,
  isCreate,
  canSave
}: {
  form: Record<string, string>;
  setForm: (value: Record<string, string>) => void;
  fieldErrors: FieldErrors;
  rootCategories: RecordMap[];
  filteredLevel2Categories: RecordMap[];
  filteredBrands: RecordMap[];
  refs: ReferenceData;
  technicalDocumentVariants: RecordMap[];
  isCreate: boolean;
  canSave: boolean;
}) {
  const documentNameId = buildFieldControlId('technical-document', 'document_name');
  const productGroupId = buildFieldControlId('technical-document', 'product_group_id');
  const fileId = buildFieldControlId('technical-document', 'file_id');

  return (
    <>
      <SectionCard
        title={isCreate ? 'Thêm tài liệu thủ công' : 'Thông tin tài liệu kỹ thuật'}
        description={
          isCreate
            ? 'Dùng khi cần tạo tài liệu riêng.'
            : 'Quản lý tài liệu đính kèm.'
        }
      >
        <TwoColumnGrid>
          <Field
            label="Tên tài liệu"
            htmlFor={documentNameId}
            readOnly={!canSave}
            required
            error={fieldErrors.document_name}
          >
            <Input
              id={documentNameId}
              data-field="document_name"
              aria-invalid={Boolean(fieldErrors.document_name)}
              aria-describedby={buildFieldDescribedBy(
                documentNameId,
                false,
                fieldErrors.document_name
              )}
              aria-required="true"
              value={form.document_name}
              readOnly={!canSave}
              onChange={(event) =>
                setForm({ ...form, document_name: event.target.value })
              }
            />
          </Field>
          <Field
            label="Sản phẩm"
            htmlFor={productGroupId}
            readOnly={!canSave}
            required
            error={fieldErrors.product_group_id}
          >
            <Select
              id={productGroupId}
              data-technical-document-group-select="true"
              data-field="product_group_id"
              aria-invalid={Boolean(fieldErrors.product_group_id)}
              aria-describedby={buildFieldDescribedBy(
                productGroupId,
                false,
                fieldErrors.product_group_id
              )}
              aria-required="true"
              value={form.product_group_id}
              disabled={!canSave}
              onChange={(event) =>
                setForm({
                  ...form,
                  product_group_id: event.target.value,
                  product_variant_id: ''
                })
              }
            >
              <option value="">Chọn sản phẩm</option>
              {refs.productGroups.map((group) => (
                <option key={String(group.id)} value={String(group.id)}>
                  {formatProductGroupOption(group)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Biến thể / SKU"
            hint="Tùy chọn. Chỉ hiển thị các biến thể thuộc sản phẩm đã chọn."
            readOnly={!canSave}
          >
            <Select
              data-technical-document-variant-select="true"
              value={form.product_variant_id}
              disabled={!canSave || !form.product_group_id}
              onChange={(event) =>
                setForm({ ...form, product_variant_id: event.target.value })
              }
            >
              <option value="">Chưa chọn biến thể</option>
              {technicalDocumentVariants.map((variant) => (
                <option key={String(variant.id)} value={String(variant.id)}>
                  {formatVariantOption(variant)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Tệp tài liệu"
            htmlFor={fileId}
            readOnly={!canSave}
            required
            error={fieldErrors.file_id}
          >
            <FileReferencePicker
              value={form.file_id}
              readOnly={!canSave}
              fieldLabel="tệp tài liệu"
              preferredGroup="technical_document"
              inputId={fileId}
              describedBy={buildFieldDescribedBy(fileId, false, fieldErrors.file_id)}
              invalid={Boolean(fieldErrors.file_id)}
              dataField="file_id"
              onChange={(value) => setForm({ ...form, file_id: value })}
            />
          </Field>
        </TwoColumnGrid>
      </SectionCard>

      <DetailsCard
        title="Tùy chọn nâng cao"
      >
        <TwoColumnGrid>
          <Field label="Loại tài liệu" readOnly={!canSave}>
            <Select
              value={form.document_type}
              disabled={!canSave}
              onChange={(event) =>
                setForm({ ...form, document_type: event.target.value })
              }
            >
              <option value="other">Khác</option>
              <option value="datasheet">Datasheet</option>
              <option value="catalogue">Catalogue</option>
              <option value="manual">Hướng dẫn</option>
              <option value="certificate">Chứng nhận</option>
            </Select>
          </Field>
          <Field label="Phiên bản" readOnly={!canSave}>
            <Input
              value={form.version}
              readOnly={!canSave}
              onChange={(event) => setForm({ ...form, version: event.target.value })}
            />
          </Field>
          <Field label="Hiển thị công khai" readOnly={!canSave}>
            <Select
              value={form.is_public}
              disabled={!canSave}
              onChange={(event) =>
                setForm({ ...form, is_public: event.target.value })
              }
            >
                <option value="false">Không</option>
                <option value="true">Có</option>
            </Select>
          </Field>
          {!isCreate ? (
            <>
              <Field label="Trạng thái" readOnly={!canSave}>
                <Select
                  value={form.status}
                  disabled={!canSave}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value })
                  }
                >
                  <option value="active">Đang hoạt động</option>
                  <option value="inactive">Tạm ngưng</option>
                </Select>
              </Field>
            </>
          ) : null}
        </TwoColumnGrid>
      </DetailsCard>
    </>
  );
}

export function renderSummaryCards(kind: BusinessKind, record: RecordMap, detail: RecordMap) {
  return (
    <>
      {kind === 'productGroup' ? (
        <CompactInfoCard
          title="Tóm tắt giá"
          items={[
            ['Hiển thị ngoài website', (() => {
              const summary = asRecord(record.public_price_summary);
              const mode = summary.display_mode;
              if (mode === 'exact_price') return formatCurrency(summary.display_amount);
              if (mode === 'from_price') {
                return Number(summary.priced_public_variant_count ?? 0) < Number(summary.public_variant_count ?? 0)
                  ? 'Một số biến thể có giá'
                  : 'Giá theo từng biến thể';
              }
              return 'Yêu cầu báo giá';
            })()],
            ['Biến thể có giá / đang hiển thị', `${Number(asRecord(record.public_price_summary).priced_public_variant_count ?? 0)} / ${Number(asRecord(record.public_price_summary).public_variant_count ?? 0)}`]
          ]}
        />
      ) : null}
      <CompactInfoCard
        title="Thông tin hệ thống"
        items={[
          ['ID', record.id],
          ['Tạo lúc', formatDate(record.created_at)],
          ['Cập nhật', formatDate(record.updated_at)],
          ['Lưu trữ', record.deleted_at ? formatDate(record.deleted_at) : 'Chưa lưu trữ']
        ]}
        monoLabels={['ID']}
      />
      <DependencyCard counts={asRecord(detail.dependency_counts)} />
    </>
  );
}
