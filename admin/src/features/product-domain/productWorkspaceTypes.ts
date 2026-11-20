

export type ProductVariantDraft = {
  variant_name: string;
  detailed_description: string;
  image_file_id: string;
  public_price_mode: string;
  public_price_amount: string;
  sku: string;
  external_code: string;
  model_code: string;
  status: string;
};

export type VariantAttributeDraft = {
  attribute_name: string;
  attribute_value: string;
  display_order: string;
};

export type ProductHighlightDraft = {
  display_label: string;
  display_value: string;
};

export type HighlightMoveDirection = -1 | 1;

export type TechnicalDocumentDraft = {
  document_name: string;
  document_type: string;
  product_variant_id: string;
  file_id: string;
  version: string;
  is_public: string;
};

export type VariantWorkspaceModalState =
  | { mode: 'create' }
  | { mode: 'edit'; variantId: string }
  | null;

export type VariantDetailLoadState = 'loading' | 'ready' | 'error';
