'use client';

import { optionalText, requiredOrNull, stringValue, stripNulls } from './businessForm';
import type { BusinessKind } from './businessTypes';
import { apiClient } from '@/lib/api-client';
import { byId, endpoints } from '@/lib/api-endpoints';
import { extractItems } from '@/features/shared/extract';
import { type RecordMap } from './businessPageShared';
import {
  type ProductVariantDraft,
  type VariantAttributeDraft,
  type ProductHighlightDraft,
  type TechnicalDocumentDraft
} from './productWorkspaceTypes';

export function isReviewOnlyProductSurface(kind: BusinessKind) {
  return kind === 'productVariant' || kind === 'technicalDocument';
}

export function renderReviewSurfaceNotice(kind: BusinessKind) {
  if (kind === 'productVariant') {
    return null;
  }

  if (kind === 'technicalDocument') {
    return (
      <div className="rounded-sm border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
        <div className="font-semibold">Rà soát toàn hệ thống.</div>
        <p className="mt-1 text-blue-900">Gắn tài liệu trong chi tiết Sản phẩm khi cần.</p>
      </div>
    );
  }

  return null;
}

export async function loadProductGroupWorkspace(productGroupId: string) {
  const variantParams = new URLSearchParams({
    product_group_id: productGroupId,
    page_size: '100',
    deleted_scope: 'active'
  });
  const documentParams = new URLSearchParams({
    product_group_id: productGroupId,
    page_size: '100',
    deleted_scope: 'active'
  });
  const [variantResult, documentResult] = await Promise.all([
    apiClient.get<unknown>(
      `${endpoints.songThanh.productVariants}?${variantParams.toString()}`
    ),
    apiClient.get<unknown>(
      `${endpoints.songThanh.technicalDocuments}?${documentParams.toString()}`
    )
  ]);
  const variants = extractItems(variantResult);
  const documents = extractItems(documentResult);

  return {
    variants,
    documents,
    attributes: {} as Record<string, RecordMap[]>,
    highlightSpecs: {} as Record<string, RecordMap[]>
  };
}

export async function loadProductVariantWorkspaceDetails(
  productGroupId: string,
  variantId: string
) {
  const params = new URLSearchParams({ variant_id: variantId });
  const [attributeResult, highlightResult] = await Promise.all([
    apiClient.get<unknown>(variantAttributesPath(variantId)),
    apiClient.get<unknown>(
      `${productHighlightSpecsPath(productGroupId)}?${params.toString()}`
    )
  ]);
  return {
    attributes: extractItems(attributeResult),
    highlightSpecs: extractItems(highlightResult)
  };
}

export function variantAttributesPath(productVariantId: string) {
  return `${byId(
    endpoints.songThanh.productVariants,
    productVariantId
  )}/attributes`;
}

export function productHighlightSpecsPath(productGroupId: string) {
  return `${byId(endpoints.songThanh.productGroups, productGroupId)}/highlight-specs`;
}

export function productHighlightSpecPath(productGroupId: string, highlightId: string) {
  return `${productHighlightSpecsPath(productGroupId)}/${encodeURIComponent(highlightId)}`;
}

export function productHighlightSpecSuggestionsPath(productGroupId: string) {
  return `${byId(endpoints.songThanh.productGroups, productGroupId)}/highlight-spec-suggestions`;
}

export function emptyProductVariantDraft(): ProductVariantDraft {
  return {
    variant_name: '',
    detailed_description: '',
    image_file_id: '',
    public_price_mode: 'contact_for_quote',
    public_price_amount: '',
    sku: '',
    external_code: '',
    model_code: '',
    status: 'active'
  };
}

export function emptyVariantAttributeDraft(): VariantAttributeDraft {
  return {
    attribute_name: '',
    attribute_value: '',
    display_order: ''
  };
}

export function emptyProductHighlightDraft(): ProductHighlightDraft {
  return {
    display_label: '',
    display_value: ''
  };
}

export function emptyTechnicalDocumentDraft(): TechnicalDocumentDraft {
  return {
    document_name: '',
    document_type: 'other',
    product_variant_id: '',
    file_id: '',
    version: '',
    is_public: 'true'
  };
}

export function productVariantDraftsEqual(
  left: ProductVariantDraft,
  right: ProductVariantDraft
) {
  return (
    left.variant_name === right.variant_name &&
    left.detailed_description === right.detailed_description &&
    left.image_file_id === right.image_file_id &&
    left.public_price_mode === right.public_price_mode &&
    left.public_price_amount === right.public_price_amount &&
    left.sku === right.sku &&
    left.external_code === right.external_code &&
    left.model_code === right.model_code &&
    left.status === right.status
  );
}

export function variantAttributeDraftsEqual(
  left: VariantAttributeDraft,
  right: VariantAttributeDraft
) {
  return (
    left.attribute_name === right.attribute_name &&
    left.attribute_value === right.attribute_value &&
    left.display_order === right.display_order
  );
}

export function productHighlightDraftsEqual(
  left: ProductHighlightDraft,
  right: ProductHighlightDraft
) {
  return (
    left.display_label === right.display_label &&
    left.display_value === right.display_value
  );
}

export function isVariantAttributeDraftEmpty(draft: VariantAttributeDraft) {
  return !draft.attribute_name.trim() && !draft.attribute_value.trim() && !draft.display_order.trim();
}

export function isProductHighlightDraftEmpty(draft: ProductHighlightDraft) {
  return !draft.display_label.trim() && !draft.display_value.trim();
}

export function productVariantDraftFromRecord(record: RecordMap): ProductVariantDraft {
  return {
    variant_name: stringValue(record.variant_name),
    detailed_description: stringValue(record.detailed_description),
    image_file_id: stringValue(record.image_file_id),
    public_price_mode: stringValue(record.public_price_mode) || 'contact_for_quote',
    public_price_amount: stringValue(record.public_price_amount),
    sku: stringValue(record.sku),
    external_code: stringValue(record.external_code),
    model_code: stringValue(record.model_code),
    status: stringValue(record.status) || 'active'
  };
}

export function variantAttributeDraftFromRecord(record: RecordMap): VariantAttributeDraft {
  return {
    attribute_name: stringValue(record.attribute_name),
    attribute_value: stringValue(record.attribute_value),
    display_order: stringValue(record.display_order)
  };
}

export function productHighlightDraftFromRecord(record: RecordMap): ProductHighlightDraft {
  return {
    display_label: stringValue(record.display_label),
    display_value: stringValue(record.display_value)
  };
}

export function findHighlightForVariantAttribute(highlightSpecs: RecordMap[], attributeId: string) {
  return (
    highlightSpecs.find(
      (item) =>
        item.source_type === 'variant_attribute' &&
        String(item.source_id ?? '') === attributeId
    ) ?? null
  );
}

export function highlightSourceLabel(value: unknown) {
  switch (value) {
    case 'product_spec':
      return 'Thông số chung';
    case 'variant_spec':
      return 'Spec biến thể';
    case 'variant_attribute':
      return 'Thông số biến thể';
    case 'manual':
      return 'Nhập tay';
    default:
      return 'Nguồn khác';
  }
}

export function validateVariantDraft(draft?: ProductVariantDraft) {
  if (!draft?.variant_name.trim()) return 'Vui lòng nhập tên biến thể.';
  if (
    draft.public_price_mode === 'public_price' &&
    (!draft.public_price_amount.trim() ||
      !Number.isSafeInteger(Number(draft.public_price_amount)) ||
      Number(draft.public_price_amount) < 1 ||
      Number(draft.public_price_amount) > 2_147_483_647)
  ) {
    return 'Giá công khai phải là số nguyên từ 1 đến 2.147.483.647 đồng.';
  }
  return null;
}

export function normalizeAttributeDrafts(rows: VariantAttributeDraft[]) {
  const normalized: Array<{
    attribute_name: string;
    attribute_value: string;
    display_order?: number;
  }> = [];

  for (const row of rows) {
    const attributeName = row.attribute_name.trim();
    const attributeValue = row.attribute_value.trim();
    const displayOrder = row.display_order.trim();
    if (!attributeName && !attributeValue && !displayOrder) continue;
    if (!attributeName || !attributeValue) return null;
    normalized.push({
      attribute_name: attributeName,
      attribute_value: attributeValue,
      ...(displayOrder ? { display_order: Number(displayOrder) } : {})
    });
  }

  return normalized;
}

export function buildVariantDraftPayload(productGroupId: string, draft: ProductVariantDraft) {
  return stripNulls({
    product_group_id: productGroupId,
    variant_name: requiredOrNull(draft.variant_name),
    detailed_description: optionalText(draft.detailed_description),
    image_file_id: optionalText(draft.image_file_id),
    public_price_mode: draft.public_price_mode || 'contact_for_quote',
    public_price_amount:
      draft.public_price_mode === 'public_price' && draft.public_price_amount.trim()
        ? Number(draft.public_price_amount)
        : null,
    ...(draft.sku.trim() ? { sku: draft.sku.trim() } : {}),
    external_code: optionalText(draft.external_code),
    model_code: optionalText(draft.model_code),
    status: draft.status || 'active'
  });
}
