import { evaluateProductReadiness } from './productReadiness';
import type { BusinessKind } from './businessTypes';

export type ValidationIssue = {
  field: string;
  message: string;
};

export function validateBusinessForm(
  kind: BusinessKind,
  form: Record<string, string>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  switch (kind) {
    case 'category':
      if (!form.name.trim()) {
        issues.push({ field: 'name', message: 'Vui lòng nhập tên danh mục.' });
      }
      if (form.category_level === 'level_2' && !form.parent_id) {
        issues.push({
          field: 'parent_id',
          message: 'Vui lòng chọn danh mục cấp 1 cha.'
        });
      }
      return issues;
    case 'brand':
      if (!form.name.trim()) {
        issues.push({ field: 'name', message: 'Vui lòng nhập tên thương hiệu.' });
      }
      return issues;
    case 'productGroup':
      if (!form.name.trim()) {
        issues.push({ field: 'name', message: 'Vui lòng nhập tên sản phẩm.' });
      }
      if (!form.category_level_1_id) {
        issues.push({
          field: 'category_level_1_id',
          message: 'Vui lòng chọn danh mục chính.'
        });
      }
      if (!form.category_id) {
        issues.push({ field: 'category_id', message: 'Vui lòng chọn danh mục con.' });
      }
      if (form.publish_status === 'published') {
        const publishBlockers = getProductGroupPersistedPublishBlockers(form);
        if (publishBlockers.length > 0) {
          issues.push({
            field: '__form',
            message: `Chưa thể chuyển sang “Đã xuất bản”: ${publishBlockers.join('; ')}`
          });
        }
      }
      return issues;
    case 'productVariant':
      if (!form.variant_name.trim()) {
        issues.push({ field: 'variant_name', message: 'Vui lòng nhập tên biến thể.' });
      }
      if (!form.product_group_id) {
        issues.push({ field: 'product_group_id', message: 'Vui lòng chọn sản phẩm.' });
      }
      if (
        form.public_price_mode === 'public_price' &&
        (!form.public_price_amount.trim() ||
          !Number.isSafeInteger(Number(form.public_price_amount)) ||
          Number(form.public_price_amount) < 1 ||
          Number(form.public_price_amount) > 2_147_483_647)
      ) {
        issues.push({
          field: 'public_price_amount',
          message: 'Giá công khai phải là số nguyên từ 1 đến 2.147.483.647 đồng.'
        });
      }
      if (form.publish_status === 'published') {
        const publishBlockers = getProductVariantPersistedPublishBlockers(form);
        if (publishBlockers.length > 0) {
          issues.push({
            field: '__form',
            message: `Chưa thể chuyển sang “Đã xuất bản”: ${publishBlockers.join('; ')}`
          });
        }
      }
      return issues;
    case 'technicalDocument':
      if (!form.document_name.trim()) {
        issues.push({ field: 'document_name', message: 'Vui lòng nhập tên tài liệu.' });
      }
      if (!form.product_group_id) {
        issues.push({ field: 'product_group_id', message: 'Vui lòng chọn sản phẩm.' });
      }
      if (!form.file_id) {
        issues.push({ field: 'file_id', message: 'Vui lòng chọn tệp tài liệu.' });
      }
      return issues;
  }
}

function getProductGroupPersistedPublishBlockers(
  form: Record<string, string>
) {
  const normalizedProduct = {
    ...form,
    category_level_2_id: form.category_level_2_id || form.category_id
  };

  return evaluateProductReadiness(normalizedProduct).blockingIssues.map(
    (item) => `${item.title}. ${item.action}.`
  );
}

function getProductVariantPersistedPublishBlockers(
  form: Record<string, string>
) {
  const blockers: string[] = [];
  if (form.status !== 'active') {
    blockers.push('Trạng thái sử dụng phải là “Đang hoạt động”.');
  }
  if (form.review_status !== 'approved') {
    blockers.push('Trạng thái duyệt phải là “Đã duyệt”.');
  }

  return blockers;
}

export function getDisplayPublishBlockers(
  kind: BusinessKind,
  form: Record<string, string>
) {
  if (kind === 'productGroup') {
    return getProductGroupPersistedPublishBlockers(form);
  }

  if (kind === 'productVariant') {
    return getProductVariantPersistedPublishBlockers(form);
  }

  return [] as string[];
}

export function buildBusinessPayload(
  kind: BusinessKind,
  form: Record<string, string>,
  canPrivilegedWorkflow = true
) {
  switch (kind) {
    case 'category':
      return stripNulls({
        name: requiredOrNull(form.name),
        slug: optionalText(form.slug),
        parent_id: form.category_level === 'level_2' ? optionalText(form.parent_id) : null,
        description: optionalText(form.description),
        icon_file_id: optionalText(form.icon_file_id),
        ...(form.sort_order.trim() ? { sort_order: Number(form.sort_order) } : {}),
        ...(form.status.trim() ? { status: form.status } : {})
      });
    case 'brand':
      return stripNulls({
        name: requiredOrNull(form.name),
        slug: optionalText(form.slug),
        primary_category_id: optionalText(form.primary_category_id),
        logo_file_id: optionalText(form.logo_file_id),
        description: optionalText(form.description),
        website_url: optionalText(form.website_url),
        ...(form.sort_order.trim() ? { sort_order: Number(form.sort_order) } : {}),
        ...(form.status.trim() ? { status: form.status } : {})
      });
    case 'productGroup':
      return stripNulls({
        name: requiredOrNull(form.name),
        slug: optionalText(form.slug),
        category_id: optionalText(form.category_id),
        brand_id: optionalText(form.brand_id),
        short_description: optionalText(form.short_description),
        detailed_description: optionalText(form.detailed_description),
        thumbnail_file_id: optionalText(form.thumbnail_file_id),
        seo_title: optionalText(form.seo_title),
        seo_description: optionalText(form.seo_description),
        seo_og_image_file_id: optionalText(form.seo_og_image_file_id),
        ...(form.sort_order.trim() ? { sort_order: Number(form.sort_order) } : {}),
        ...(form.status.trim() ? { status: form.status } : {}),
        ...(canPrivilegedWorkflow && form.review_status.trim() ? { review_status: form.review_status } : {}),
        ...(canPrivilegedWorkflow && form.publish_status.trim()
          ? { publish_status: form.publish_status }
          : {})
      });
    case 'productVariant':
      return stripNulls({
        product_group_id: optionalText(form.product_group_id),
        variant_name: requiredOrNull(form.variant_name),
        detailed_description: optionalText(form.detailed_description),
        image_file_id: optionalText(form.image_file_id),
        public_price_mode: form.public_price_mode || 'contact_for_quote',
        public_price_amount:
          form.public_price_mode === 'public_price' && form.public_price_amount.trim()
            ? Number(form.public_price_amount)
            : null,
        sku: optionalText(form.sku),
        external_code: optionalText(form.external_code),
        model_code: optionalText(form.model_code),
        ...(form.sort_order.trim() ? { sort_order: Number(form.sort_order) } : {}),
        ...(form.status.trim() ? { status: form.status } : {}),
        ...(canPrivilegedWorkflow && form.review_status.trim() ? { review_status: form.review_status } : {}),
        ...(canPrivilegedWorkflow && form.publish_status.trim()
          ? { publish_status: form.publish_status }
          : {})
      });
    case 'technicalDocument':
      return stripNulls({
        product_group_id: optionalText(form.product_group_id),
        product_variant_id: optionalText(form.product_variant_id),
        document_name: requiredOrNull(form.document_name),
        document_type: form.document_type || 'other',
        file_id: optionalText(form.file_id),
        version: optionalText(form.version),
        is_public: form.is_public === 'true',
        ...(form.sort_order.trim() ? { sort_order: Number(form.sort_order) } : {}),
        ...(form.status.trim() ? { status: form.status } : {})
      });
  }
}

export function businessFormFromRecord(
  kind: BusinessKind,
  record: Record<string, unknown>
): Record<string, string> {
  switch (kind) {
    case 'category':
      return {
        category_level: record.parent_id ? 'level_2' : 'level_1',
        name: stringValue(record.name),
        parent_id: stringValue(record.parent_id),
        slug: stringValue(record.slug),
        description: stringValue(record.description),
        icon_file_id: stringValue(record.icon_file_id),
        sort_order: stringValue(record.sort_order),
        status: stringValue(record.status) || 'active'
      };
    case 'brand':
      return {
        name: stringValue(record.name),
        primary_category_id: stringValue(record.primary_category_id),
        logo_file_id: stringValue(record.logo_file_id),
        slug: stringValue(record.slug),
        description: stringValue(record.description),
        website_url: stringValue(record.website_url),
        sort_order: stringValue(record.sort_order),
        status: stringValue(record.status) || 'active'
      };
    case 'productGroup':
      return {
        name: stringValue(record.name),
        category_level_1_id:
          stringValue(record.category_level_1_id) || stringValue(record.category_id),
        category_id:
          stringValue(record.category_level_2_id) || stringValue(record.category_id),
        brand_id: stringValue(record.brand_id),
        thumbnail_file_id: stringValue(record.thumbnail_file_id),
        slug: stringValue(record.slug),
        short_description: stringValue(record.short_description),
        detailed_description: stringValue(record.detailed_description),
        seo_title: stringValue(record.seo_title),
        seo_description: stringValue(record.seo_description),
        seo_og_image_file_id: stringValue(record.seo_og_image_file_id),
        sort_order: stringValue(record.sort_order),
        status: stringValue(record.status) || 'active',
        review_status: stringValue(record.review_status) || 'draft',
        publish_status: stringValue(record.publish_status) || 'unpublished'
      };
    case 'productVariant':
      return {
        product_group_id: stringValue(record.product_group_id),
        variant_name: stringValue(record.variant_name),
        detailed_description: stringValue(record.detailed_description),
        image_file_id: stringValue(record.image_file_id),
        public_price_mode: stringValue(record.public_price_mode) || 'contact_for_quote',
        public_price_amount: stringValue(record.public_price_amount),
        sku: stringValue(record.sku),
        external_code: stringValue(record.external_code),
        model_code: stringValue(record.model_code),
        sort_order: stringValue(record.sort_order),
        status: stringValue(record.status) || 'active',
        review_status: stringValue(record.review_status) || 'draft',
        publish_status: stringValue(record.publish_status) || 'unpublished'
      };
    case 'technicalDocument':
      return {
        product_group_id: stringValue(record.product_group_id),
        product_variant_id: stringValue(record.product_variant_id),
        document_name: stringValue(record.document_name),
        document_type: stringValue(record.document_type) || 'other',
        file_id: stringValue(record.file_id),
        version: stringValue(record.version),
        is_public: String(Boolean(record.is_public)),
        sort_order: stringValue(record.sort_order),
        status: stringValue(record.status) || 'active'
      };
  }
}

export function createBusinessForm(kind: BusinessKind): Record<string, string> {
  switch (kind) {
    case 'category':
      return {
        category_level: 'level_1',
        name: '',
        parent_id: '',
        slug: '',
        description: '',
        icon_file_id: '',
        sort_order: '',
        status: 'active'
      };
    case 'brand':
      return {
        name: '',
        primary_category_id: '',
        logo_file_id: '',
        slug: '',
        description: '',
        website_url: '',
        sort_order: '',
        status: 'active'
      };
    case 'productGroup':
      return {
        name: '',
        category_level_1_id: '',
        category_id: '',
        brand_id: '',
        thumbnail_file_id: '',
        slug: '',
        short_description: '',
        detailed_description: '',
        seo_title: '',
        seo_description: '',
        seo_og_image_file_id: '',
        sort_order: '',
        status: 'active',
        review_status: '',
        publish_status: ''
      };
    case 'productVariant':
      return {
        product_group_id: '',
        variant_name: '',
        detailed_description: '',
        image_file_id: '',
        public_price_mode: 'contact_for_quote',
        public_price_amount: '',
        sku: '',
        external_code: '',
        model_code: '',
        sort_order: '',
        status: 'active',
        review_status: '',
        publish_status: ''
      };
    case 'technicalDocument':
      return {
        product_group_id: '',
        product_variant_id: '',
        document_name: '',
        document_type: 'other',
        file_id: '',
        version: '',
        is_public: 'false',
        sort_order: '',
        status: 'active'
      };
  }
}

export function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function requiredOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function stringValue(value: unknown) {
  return value == null ? '' : String(value);
}

export function stripNulls<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).filter(
      ([, value]) => typeof value !== 'undefined' && value !== ''
    )
  );
}
