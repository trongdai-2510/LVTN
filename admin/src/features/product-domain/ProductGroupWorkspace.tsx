'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, RefreshCcw } from '@/components/icons';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { optionalText } from './businessForm';
import { optimisticVersionPayload } from './businessStatus';
import type { ProductWorkspaceSection } from './businessTypes';
import { FormFeedback } from '@/components/form/FormFeedback';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Modal } from '@/components/ui/Modal';
import { apiClient } from '@/lib/api-client';
import { byId, endpoints } from '@/lib/api-endpoints';
import { formatValue } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { usePermissions } from '@/features/auth/useAuthState';
import { extractItems } from '@/features/shared/extract';
import { asRecord, extractNestedRecord, recordCount, type RecordMap } from './businessPageShared';
import {
  type ProductVariantDraft,
  type VariantAttributeDraft,
  type ProductHighlightDraft,
  type TechnicalDocumentDraft,
  type VariantWorkspaceModalState,
  type VariantDetailLoadState,
  type HighlightMoveDirection
} from './productWorkspaceTypes';
import {
  emptyProductVariantDraft,
  emptyVariantAttributeDraft,
  emptyTechnicalDocumentDraft,
  productVariantDraftFromRecord,
  loadProductGroupWorkspace,
  variantAttributeDraftFromRecord,
  productHighlightDraftFromRecord,
  loadProductVariantWorkspaceDetails,
  productVariantDraftsEqual,
  isVariantAttributeDraftEmpty,
  variantAttributeDraftsEqual,
  productHighlightDraftsEqual,
  isProductHighlightDraftEmpty,
  emptyProductHighlightDraft,
  validateVariantDraft,
  normalizeAttributeDrafts,
  buildVariantDraftPayload,
  variantAttributesPath,
  productHighlightSpecsPath,
  productHighlightSpecSuggestionsPath,
  productHighlightSpecPath
} from './productWorkspaceHelpers';
import {
  VariantSummaryCard,
  VariantCreatePanel,
  VariantEditorPanel,
  TechnicalDocumentWorkspace
} from './ProductWorkspacePanels';

export function ProductGroupWorkspace({
  productGroup,
  activeSection,
  onRelatedChange
}: {
  productGroup: RecordMap;
  activeSection: ProductWorkspaceSection;
  onRelatedChange: () => Promise<void>;
}) {
  const productGroupId = String(productGroup.id ?? '');
  const permissions = usePermissions();
  const canCreateVariant = permissions.includes(PERMISSIONS.productVariantCreate);
  const canUpdateVariant = permissions.includes(PERMISSIONS.productVariantUpdate);
  const canArchiveVariant = permissions.includes(PERMISSIONS.productVariantArchive);
  const canManageHighlightSpecs = permissions.includes(PERMISSIONS.productGroupUpdate);
  const canCreateDocument = permissions.includes(PERMISSIONS.technicalDocumentCreate);
  const canArchiveDocument = permissions.includes(PERMISSIONS.technicalDocumentArchive);

  const [variants, setVariants] = useState<RecordMap[]>([]);
  const [documents, setDocuments] = useState<RecordMap[]>([]);
  const [attributes, setAttributes] = useState<Record<string, RecordMap[]>>({});
  const [highlightSpecsByVariantId, setHighlightSpecsByVariantId] = useState<Record<string, RecordMap[]>>({});
  const [variantDrafts, setVariantDrafts] = useState<Record<string, ProductVariantDraft>>({});
  const [attributeDrafts, setAttributeDrafts] = useState<Record<string, VariantAttributeDraft>>({});
  const [highlightDrafts, setHighlightDrafts] = useState<Record<string, ProductHighlightDraft>>({});
  const [newAttributeDrafts, setNewAttributeDrafts] = useState<Record<string, VariantAttributeDraft>>({});
  const [newHighlightDrafts, setNewHighlightDrafts] = useState<Record<string, ProductHighlightDraft>>({});
  const [newVariant, setNewVariant] = useState<ProductVariantDraft>(() => emptyProductVariantDraft());
  const [newVariantAttributes, setNewVariantAttributes] = useState<VariantAttributeDraft[]>(() => [
    emptyVariantAttributeDraft()
  ]);
  const [newDocument, setNewDocument] = useState<TechnicalDocumentDraft>(() =>
    emptyTechnicalDocumentDraft()
  );
  const [variantModal, setVariantModal] = useState<VariantWorkspaceModalState>(null);
  const [variantDetailStates, setVariantDetailStates] = useState<
    Record<string, VariantDetailLoadState>
  >({});
  const [confirmDiscardVariantChanges, setConfirmDiscardVariantChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const workspaceMutationInFlightRef = useRef(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const activeVariant =
    variantModal?.mode === 'edit'
      ? variants.find((variant) => String(variant.id ?? '') === variantModal.variantId) ?? null
      : null;
  const activeVariantId = activeVariant ? String(activeVariant.id ?? '') : '';
  const activeVariantDraft =
    activeVariant && activeVariantId
      ? variantDrafts[activeVariantId] ?? productVariantDraftFromRecord(activeVariant)
      : null;

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const next = await loadProductGroupWorkspace(productGroupId);
        if (!active) return;
        applyWorkspaceState(next);
      } catch (err) {
        if (active) setError(err);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [productGroupId]);

  function applyWorkspaceState(next: {
    variants: RecordMap[];
    documents: RecordMap[];
    attributes: Record<string, RecordMap[]>;
    highlightSpecs: Record<string, RecordMap[]>;
  }) {
    setVariants(next.variants);
    setDocuments(next.documents);
    setAttributes(next.attributes);
    setHighlightSpecsByVariantId(next.highlightSpecs);
    setVariantDetailStates(
      Object.fromEntries(
        Object.keys(next.attributes).map((variantId) => [variantId, 'ready' as const])
      )
    );
    setVariantDrafts(
      Object.fromEntries(
        next.variants.map((variant) => [
          String(variant.id),
          productVariantDraftFromRecord(variant)
        ])
      )
    );
    setAttributeDrafts(
      Object.fromEntries(
        Object.values(next.attributes)
          .flat()
          .map((attribute) => [
            String(attribute.id),
            variantAttributeDraftFromRecord(attribute)
          ])
      )
    );
    setHighlightDrafts(
      Object.fromEntries(
        Object.values(next.highlightSpecs)
          .flat()
          .map((highlightSpec) => [
            String(highlightSpec.id),
            productHighlightDraftFromRecord(highlightSpec)
          ])
      )
    );
  }

  async function reloadWorkspace(successMessage?: string) {
    const next = await loadProductGroupWorkspace(productGroupId);
    if (
      activeVariantId &&
      next.variants.some((variant) => String(variant.id ?? '') === activeVariantId)
    ) {
      const detail = await loadProductVariantWorkspaceDetails(
        productGroupId,
        activeVariantId
      );
      next.attributes[activeVariantId] = detail.attributes;
      next.highlightSpecs[activeVariantId] = detail.highlightSpecs;
    }
    applyWorkspaceState(next);
    if (successMessage) setMessage(successMessage);
  }

  function openCreateVariantModal() {
    setError(null);
    setMessage('');
    setVariantModal({ mode: 'create' });
  }

  async function openEditVariantModal(variantId: string) {
    setError(null);
    setMessage('');
    setVariantModal({ mode: 'edit', variantId });
    if (
      variantDetailStates[variantId] === 'ready' ||
      variantDetailStates[variantId] === 'loading'
    ) {
      return;
    }

    setVariantDetailStates((current) => ({ ...current, [variantId]: 'loading' }));
    try {
      const detail = await loadProductVariantWorkspaceDetails(productGroupId, variantId);
      setAttributes((current) => ({ ...current, [variantId]: detail.attributes }));
      setHighlightSpecsByVariantId((current) => ({
        ...current,
        [variantId]: detail.highlightSpecs
      }));
      setAttributeDrafts((current) => ({
        ...current,
        ...Object.fromEntries(
          detail.attributes.map((attribute) => [
            String(attribute.id),
            variantAttributeDraftFromRecord(attribute)
          ])
        )
      }));
      setHighlightDrafts((current) => ({
        ...current,
        ...Object.fromEntries(
          detail.highlightSpecs.map((highlightSpec) => [
            String(highlightSpec.id),
            productHighlightDraftFromRecord(highlightSpec)
          ])
        )
      }));
      setVariantDetailStates((current) => ({ ...current, [variantId]: 'ready' }));
    } catch (err) {
      setError(err);
      setVariantDetailStates((current) => ({ ...current, [variantId]: 'error' }));
    }
  }

  function closeVariantModal() {
    if (savingKey) return;
    if (hasVariantModalUnsavedChanges()) {
      setConfirmDiscardVariantChanges(true);
      return;
    }
    discardVariantModalChanges();
  }

  function hasVariantModalUnsavedChanges() {
    if (variantModal?.mode === 'create') {
      return (
        !productVariantDraftsEqual(newVariant, emptyProductVariantDraft()) ||
        newVariantAttributes.some((draft) => !isVariantAttributeDraftEmpty(draft))
      );
    }

    if (!activeVariant || !activeVariantId || !activeVariantDraft) return false;
    const variantChanged = !productVariantDraftsEqual(
      activeVariantDraft,
      productVariantDraftFromRecord(activeVariant)
    );
    const attributeChanged = (attributes[activeVariantId] ?? []).some((attribute) => {
      const attributeId = String(attribute.id ?? '');
      const draft = attributeDrafts[attributeId] ?? variantAttributeDraftFromRecord(attribute);
      return !variantAttributeDraftsEqual(draft, variantAttributeDraftFromRecord(attribute));
    });
    const highlightChanged = (highlightSpecsByVariantId[activeVariantId] ?? []).some(
      (highlightSpec) => {
        const highlightId = String(highlightSpec.id ?? '');
        const draft =
          highlightDrafts[highlightId] ?? productHighlightDraftFromRecord(highlightSpec);
        return !productHighlightDraftsEqual(
          draft,
          productHighlightDraftFromRecord(highlightSpec)
        );
      }
    );

    return (
      variantChanged ||
      attributeChanged ||
      highlightChanged ||
      !isVariantAttributeDraftEmpty(
        newAttributeDrafts[activeVariantId] ?? emptyVariantAttributeDraft()
      ) ||
      !isProductHighlightDraftEmpty(
        newHighlightDrafts[activeVariantId] ?? emptyProductHighlightDraft()
      )
    );
  }

  function discardVariantModalChanges() {
    if (variantModal?.mode === 'create') {
      setNewVariant(emptyProductVariantDraft());
      setNewVariantAttributes([emptyVariantAttributeDraft()]);
    }
    if (variantModal?.mode === 'edit' && activeVariant && activeVariantId) {
      setVariantDrafts((current) => ({
        ...current,
        [activeVariantId]: productVariantDraftFromRecord(activeVariant)
      }));
      setAttributeDrafts((current) => ({
        ...current,
        ...Object.fromEntries(
          (attributes[activeVariantId] ?? []).map((attribute) => [
            String(attribute.id),
            variantAttributeDraftFromRecord(attribute)
          ])
        )
      }));
      setHighlightDrafts((current) => ({
        ...current,
        ...Object.fromEntries(
          (highlightSpecsByVariantId[activeVariantId] ?? []).map((highlightSpec) => [
            String(highlightSpec.id),
            productHighlightDraftFromRecord(highlightSpec)
          ])
        )
      }));
      setNewAttributeDrafts((current) => ({
        ...current,
        [activeVariantId]: emptyVariantAttributeDraft()
      }));
      setNewHighlightDrafts((current) => ({
        ...current,
        [activeVariantId]: emptyProductHighlightDraft()
      }));
    }
    setError(null);
    setMessage('');
    setConfirmDiscardVariantChanges(false);
    setVariantModal(null);
  }

  async function runWorkspaceAction(
    key: string,
    action: () => Promise<void>,
    successMessage: string
  ): Promise<boolean> {
    if (workspaceMutationInFlightRef.current) {
      return false;
    }
    workspaceMutationInFlightRef.current = true;
    setSavingKey(key);
    setError(null);
    setMessage('');
    try {
      await action();
      await reloadWorkspace(successMessage);
      await onRelatedChange();
      return true;
    } catch (err) {
      setError(err);
      return false;
    } finally {
      workspaceMutationInFlightRef.current = false;
      setSavingKey('');
    }
  }

  async function createVariant() {
    if (workspaceMutationInFlightRef.current) {
      return;
    }
    const validationError = validateVariantDraft(newVariant);
    if (validationError) {
      setError(new Error(validationError));
      setMessage('');
      return;
    }
    const attributeRows = normalizeAttributeDrafts(newVariantAttributes);
    if (attributeRows === null) {
      setError(new Error('Thông số biến thể cần nhập đủ tên thông số và giá trị.'));
      setMessage('');
      return;
    }

    workspaceMutationInFlightRef.current = true;
    setSavingKey('variant:create');
    setError(null);
    setMessage('');
    try {
      const result = await apiClient.post<unknown>(
        endpoints.songThanh.productVariants,
        buildVariantDraftPayload(productGroupId, newVariant)
      );
      const createdVariant = extractNestedRecord(asRecord(result), 'product_variant');
      const createdVariantId = String(createdVariant.id ?? '');
      const attributeResults = await Promise.allSettled(
        attributeRows.map((attribute, index) =>
          apiClient.post<unknown>(variantAttributesPath(createdVariantId), {
            ...attribute,
            display_order: index
          })
        )
      );
      const failedAttributes = attributeResults.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      );

      await reloadWorkspace();
      await onRelatedChange();
      if (failedAttributes.length > 0) {
        setError(
          new Error(
            `Đã tạo biến thể, nhưng ${failedAttributes.length}/${attributeRows.length} thông số ban đầu chưa lưu được. Mở biến thể vừa tạo để bổ sung lại các dòng này.`
          )
        );
        return;
      }

      setNewVariant(emptyProductVariantDraft());
      setNewVariantAttributes([emptyVariantAttributeDraft()]);
      setMessage('Đã thêm biến thể cho sản phẩm.');
      // React batches the draft reset above. Calling the guarded close handler
      // in the same tick would still inspect the stale, non-empty draft and
      // incorrectly ask the user whether to discard a successfully saved form.
      setConfirmDiscardVariantChanges(false);
      setVariantModal(null);
    } catch (err) {
      setError(err);
    } finally {
      workspaceMutationInFlightRef.current = false;
      setSavingKey('');
    }
  }

  async function updateVariant(variantId: string) {
    const draft = variantDrafts[variantId];
    const currentVariant = variants.find(
      (variant) => String(variant.id ?? '') === variantId
    );
    const validationError = validateVariantDraft(draft);
    if (validationError) {
      setError(new Error(validationError));
      setMessage('');
      return;
    }
    await runWorkspaceAction(
      `variant:update:${variantId}`,
      async () => {
        await apiClient.put<unknown>(
          byId(endpoints.songThanh.productVariants, variantId),
          {
            ...buildVariantDraftPayload(productGroupId, draft),
            ...optimisticVersionPayload('productVariant', currentVariant)
          }
        );
      },
      'Đã cập nhật biến thể.'
    );
  }

  async function archiveVariant(variantId: string) {
    const currentVariant = variants.find(
      (variant) => String(variant.id ?? '') === variantId
    );
    const archived = await runWorkspaceAction(
      `variant:archive:${variantId}`,
      async () => {
        await apiClient.post<unknown>(
          `${byId(endpoints.songThanh.productVariants, variantId)}/archive`,
          optimisticVersionPayload('productVariant', currentVariant)
        );
      },
      'Đã lưu trữ biến thể.'
    );
    if (archived) {
      closeVariantModal();
    }
  }

  async function createAttribute(variantId: string) {
    const draft = newAttributeDrafts[variantId] ?? emptyVariantAttributeDraft();
    if (!draft.attribute_name.trim() || !draft.attribute_value.trim()) {
      setError(new Error('Vui lòng nhập đủ tên thông số và giá trị.'));
      setMessage('');
      return;
    }
    await runWorkspaceAction(
      `attribute:create:${variantId}`,
      async () => {
        await apiClient.post<unknown>(variantAttributesPath(variantId), {
          attribute_name: draft.attribute_name.trim(),
          attribute_value: draft.attribute_value.trim(),
          ...(draft.display_order.trim()
            ? { display_order: Number(draft.display_order) }
            : {})
        });
        setNewAttributeDrafts((current) => ({
          ...current,
          [variantId]: emptyVariantAttributeDraft()
        }));
      },
      'Đã thêm thông số biến thể.'
    );
  }

  async function updateAttribute(variantId: string, attributeId: string) {
    const draft = attributeDrafts[attributeId];
    if (!draft?.attribute_name.trim() || !draft.attribute_value.trim()) {
      setError(new Error('Vui lòng nhập đủ tên thông số và giá trị.'));
      setMessage('');
      return;
    }
    await runWorkspaceAction(
      `attribute:update:${attributeId}`,
      async () => {
        await apiClient.put<unknown>(
          `${variantAttributesPath(variantId)}/${encodeURIComponent(attributeId)}`,
          {
            attribute_name: draft.attribute_name.trim(),
            attribute_value: draft.attribute_value.trim(),
            ...(draft.display_order.trim()
              ? { display_order: Number(draft.display_order) }
              : {})
          }
        );
      },
      'Đã cập nhật thông số biến thể.'
    );
  }

  async function archiveAttribute(variantId: string, attributeId: string) {
    await runWorkspaceAction(
      `attribute:archive:${attributeId}`,
      async () => {
        await apiClient.post<unknown>(
          `${variantAttributesPath(variantId)}/${encodeURIComponent(attributeId)}/archive`,
          {}
        );
      },
      'Đã lưu trữ thông số biến thể.'
    );
  }

  async function createHighlightFromAttribute(variantId: string, attributeId: string) {
    await runWorkspaceAction(
      `highlight:create-source:${attributeId}`,
      async () => {
        await apiClient.post<unknown>(productHighlightSpecsPath(productGroupId), {
          product_variant_id: variantId,
          source_type: 'variant_attribute',
          source_id: attributeId
        });
      },
      'Đã đưa thông số lên vùng nổi bật.'
    );
  }

  async function createManualHighlight(variantId: string) {
    const draft = newHighlightDrafts[variantId] ?? emptyProductHighlightDraft();
    if (!draft.display_label.trim() || !draft.display_value.trim()) {
      setError(new Error('Vui lòng nhập đủ nhãn và giá trị thông số nổi bật.'));
      setMessage('');
      return;
    }
    await runWorkspaceAction(
      `highlight:create-manual:${variantId}`,
      async () => {
        await apiClient.post<unknown>(productHighlightSpecsPath(productGroupId), {
          product_variant_id: variantId,
          source_type: 'manual',
          display_label: draft.display_label.trim(),
          display_value: draft.display_value.trim()
        });
        setNewHighlightDrafts((current) => ({
          ...current,
          [variantId]: emptyProductHighlightDraft()
        }));
      },
      'Đã thêm thông số nổi bật thủ công.'
    );
  }

  async function applyHighlightSuggestions(variantId: string) {
    if (workspaceMutationInFlightRef.current) {
      return;
    }
    workspaceMutationInFlightRef.current = true;
    const actionKey = `highlight:suggest:${variantId}`;
    setSavingKey(actionKey);
    setError(null);
    setMessage('');
    try {
      const suggestionParams = new URLSearchParams({ variant_id: variantId });
      const result = await apiClient.get<unknown>(
        `${productHighlightSpecSuggestionsPath(productGroupId)}?${suggestionParams.toString()}`
      );
      const suggestions = extractItems(result).filter(
        (item) => item.is_recommended && !item.already_highlighted && item.source_id
      );

      if (suggestions.length === 0) {
        setMessage('Không còn gợi ý nổi bật mới cho biến thể này.');
        return;
      }

      try {
        let sortOrder = highlightSpecsByVariantId[variantId]?.length ?? 0;
        for (const suggestion of suggestions) {
          await apiClient.post<unknown>(productHighlightSpecsPath(productGroupId), {
            product_variant_id: variantId,
            source_type: String(suggestion.source_type),
            source_id: String(suggestion.source_id),
            display_label: String(suggestion.suggested_label ?? suggestion.source_label ?? ''),
            display_value: String(suggestion.suggested_value ?? suggestion.source_value ?? ''),
            sort_order: sortOrder
          });
          sortOrder += 1;
        }
        await reloadWorkspace('Đã áp dụng gợi ý thông số nổi bật.');
        await onRelatedChange();
      } catch (err) {
        setError(err);
      }
    } catch (err) {
      setError(err);
    } finally {
      workspaceMutationInFlightRef.current = false;
      setSavingKey('');
    }
  }

  async function updateHighlightSpec(highlightId: string) {
    const draft = highlightDrafts[highlightId];
    if (!draft?.display_label.trim() || !draft.display_value.trim()) {
      setError(new Error('Vui lòng nhập đủ nhãn và giá trị thông số nổi bật.'));
      setMessage('');
      return;
    }
    await runWorkspaceAction(
      `highlight:update:${highlightId}`,
      async () => {
        await apiClient.put<unknown>(
          productHighlightSpecPath(productGroupId, highlightId),
          {
            display_label: draft.display_label.trim(),
            display_value: draft.display_value.trim()
          }
        );
      },
      'Đã cập nhật thông số nổi bật.'
    );
  }

  async function archiveHighlightSpec(highlightId: string) {
    await runWorkspaceAction(
      `highlight:archive:${highlightId}`,
      async () => {
        await apiClient.post<unknown>(
          `${productHighlightSpecPath(productGroupId, highlightId)}/archive`,
          {}
        );
      },
      'Đã gỡ thông số khỏi vùng nổi bật.'
    );
  }

  async function moveHighlightSpec(
    variantId: string,
    highlightId: string,
    direction: HighlightMoveDirection
  ) {
    const currentItems = highlightSpecsByVariantId[variantId] ?? [];
    const currentIndex = currentItems.findIndex((item) => String(item.id) === highlightId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= currentItems.length) {
      return;
    }

    const nextItems = [...currentItems];
    const [movedItem] = nextItems.splice(currentIndex, 1);
    if (!movedItem) {
      return;
    }
    nextItems.splice(nextIndex, 0, movedItem);

    await runWorkspaceAction(
      `highlight:move:${highlightId}:${direction}`,
      async () => {
        await apiClient.post<unknown>(
          `${productHighlightSpecsPath(productGroupId)}/reorder`,
          {
            items: nextItems.map((item, index) => ({
              id: String(item.id),
              sort_order: index
            }))
          }
        );
      },
      'Đã cập nhật thứ tự thông số nổi bật.'
    );
  }

  async function createDocument() {
    if (!newDocument.document_name.trim()) {
      setError(new Error('Vui lòng nhập tên tài liệu.'));
      setMessage('');
      return;
    }
    if (!newDocument.file_id) {
      setError(new Error('Vui lòng chọn tệp.'));
      setMessage('');
      return;
    }
    await runWorkspaceAction(
      'document:create',
      async () => {
        await apiClient.post<unknown>(endpoints.songThanh.technicalDocuments, {
          product_group_id: productGroupId,
          product_variant_id: optionalText(newDocument.product_variant_id),
          document_name: newDocument.document_name.trim(),
          document_type: newDocument.document_type || 'other',
          file_id: newDocument.file_id,
          version: optionalText(newDocument.version),
          is_public: newDocument.is_public === 'true'
        });
        setNewDocument(emptyTechnicalDocumentDraft());
      },
      'Đã thêm tài liệu kỹ thuật.'
    );
  }

  async function archiveDocument(documentId: string) {
    const currentDocument = documents.find(
      (document) => String(document.id ?? '') === documentId
    );
    await runWorkspaceAction(
      `document:archive:${documentId}`,
      async () => {
        await apiClient.post<unknown>(
          `${byId(endpoints.songThanh.technicalDocuments, documentId)}/archive`,
          optimisticVersionPayload('technicalDocument', currentDocument)
        );
      },
      'Đã lưu trữ tài liệu kỹ thuật.'
    );
  }

  return (
    <div className="space-y-4" data-product-group-workspace="true">
      <FormFeedback successMessage={message} error={error} context="module-action" />

      {activeSection === 'variants' ? (
        <>
          <section id="product-group-variants" className="rounded-sm border border-border bg-panel">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h2 className="text-base font-semibold text-text">Biến thể / SKU</h2>
                {!loading ? <p className="mt-0.5 text-sm text-muted-foreground">{variants.length} cấu hình</p> : null}
              </div>
              {canCreateVariant ? (
                <Button type="button" size="sm" onClick={openCreateVariantModal}>
                  <Plus className="h-4 w-4" />
                  Thêm biến thể / SKU
                </Button>
              ) : null}
            </div>
            {loading ? (
              <div className="px-4 py-6 text-sm text-muted-foreground" role="status">
                Đang tải biến thể và thông số.
              </div>
            ) : variants.length === 0 ? (
              <div className="p-4 sm:p-5">
                <EmptyState
                  title="Chưa có biến thể / SKU"
                  description="Tạo ít nhất một cấu hình bán được cho sản phẩm."
                />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {variants.map((variant) => {
                  const variantId = String(variant.id);
                  const draft =
                    variantDrafts[variantId] ?? productVariantDraftFromRecord(variant);
                  return (
                    <VariantSummaryCard
                      key={variantId}
                      variant={variant}
                      draft={draft}
                      attributeCount={recordCount(variant.attribute_count)}
                      highlightCount={recordCount(variant.highlight_spec_count)}
                      onOpen={() => void openEditVariantModal(variantId)}
                    />
                  );
                })}
              </div>
            )}
          </section>

          <Modal
        open={variantModal?.mode === 'create'}
        title="Thêm biến thể / SKU"
        onClose={closeVariantModal}
        panelClassName="max-w-[960px]"
        bodyClassName="bg-[#f7f8fb] p-0"
      >
        <VariantCreatePanel
          draft={newVariant}
          attributes={newVariantAttributes}
          saving={savingKey === 'variant:create'}
          feedbackError={error}
          successMessage={message}
          onDraftChange={setNewVariant}
          onAttributesChange={setNewVariantAttributes}
          onCreate={createVariant}
          onClose={closeVariantModal}
        />
          </Modal>

          <Modal
        open={variantModal?.mode === 'edit' && Boolean(activeVariant && activeVariantDraft)}
        title={
          activeVariant
            ? `Biến thể ${formatValue(activeVariant.variant_name)}`
            : 'Biến thể'
        }
        onClose={closeVariantModal}
        panelClassName="max-w-[960px]"
        bodyClassName="bg-[#f7f8fb] p-0"
      >
        {variantModal?.mode === 'edit' &&
        variantDetailStates[variantModal.variantId] === 'loading' ? (
          <div className="p-6 text-sm text-muted-foreground" role="status">
            Đang tải thông số và nội dung nổi bật của biến thể.
          </div>
        ) : variantModal?.mode === 'edit' &&
          variantDetailStates[variantModal.variantId] === 'error' ? (
          <div className="space-y-3 p-6">
            <ErrorState error={error} context="module-load" />
            <Button
              type="button"
              variant="secondary"
              onClick={() => void openEditVariantModal(variantModal.variantId)}
            >
              <RefreshCcw className="h-4 w-4" />
              Tải lại biến thể
            </Button>
          </div>
        ) : activeVariant && activeVariantDraft ? (
          <VariantEditorPanel
            variant={activeVariant}
            draft={activeVariantDraft}
            attributes={attributes[activeVariantId] ?? []}
            highlightSpecs={highlightSpecsByVariantId[activeVariantId] ?? []}
            attributeDrafts={attributeDrafts}
            highlightDrafts={highlightDrafts}
            newAttribute={
              newAttributeDrafts[activeVariantId] ?? emptyVariantAttributeDraft()
            }
            newHighlight={
              newHighlightDrafts[activeVariantId] ?? emptyProductHighlightDraft()
            }
            canUpdate={canUpdateVariant}
            canArchive={canArchiveVariant}
            canManageHighlights={canManageHighlightSpecs}
            savingKey={savingKey}
            feedbackError={error}
            successMessage={message}
            onDraftChange={(nextDraft) =>
              setVariantDrafts({
                ...variantDrafts,
                [activeVariantId]: nextDraft
              })
            }
            onAttributeDraftChange={(attributeId, nextDraft) =>
              setAttributeDrafts({
                ...attributeDrafts,
                [attributeId]: nextDraft
              })
            }
            onHighlightDraftChange={(highlightId, nextDraft) =>
              setHighlightDrafts({
                ...highlightDrafts,
                [highlightId]: nextDraft
              })
            }
            onNewAttributeChange={(nextDraft) =>
              setNewAttributeDrafts({
                ...newAttributeDrafts,
                [activeVariantId]: nextDraft
              })
            }
            onNewHighlightChange={(nextDraft) =>
              setNewHighlightDrafts({
                ...newHighlightDrafts,
                [activeVariantId]: nextDraft
              })
            }
            onUpdate={() => updateVariant(activeVariantId)}
            onArchive={() => archiveVariant(activeVariantId)}
            onCreateAttribute={() => createAttribute(activeVariantId)}
            onUpdateAttribute={(attributeId) => updateAttribute(activeVariantId, attributeId)}
            onArchiveAttribute={(attributeId) => archiveAttribute(activeVariantId, attributeId)}
            onCreateHighlightFromAttribute={(attributeId) =>
              createHighlightFromAttribute(activeVariantId, attributeId)
            }
            onCreateManualHighlight={() => createManualHighlight(activeVariantId)}
            onApplyHighlightSuggestions={() => applyHighlightSuggestions(activeVariantId)}
            onUpdateHighlight={updateHighlightSpec}
            onArchiveHighlight={archiveHighlightSpec}
            onMoveHighlight={(highlightId, direction) =>
              moveHighlightSpec(activeVariantId, highlightId, direction)
            }
            onClose={closeVariantModal}
          />
        ) : null}
          </Modal>

          <ConfirmDialog
            open={confirmDiscardVariantChanges}
            title="Bỏ thay đổi biến thể?"
            description="Các nội dung chưa lưu trong biểu mẫu biến thể, thông số và thông số nổi bật sẽ bị bỏ."
            confirmLabel="Bỏ thay đổi"
            tone="warning"
            onClose={() => setConfirmDiscardVariantChanges(false)}
            onConfirm={discardVariantModalChanges}
          />
        </>
      ) : null}

      {activeSection === 'documents' ? (
        <TechnicalDocumentWorkspace
          variants={variants}
          documents={documents}
          draft={newDocument}
          canCreate={canCreateDocument}
          canArchive={canArchiveDocument}
          savingKey={savingKey}
          onDraftChange={setNewDocument}
          onCreate={createDocument}
          onArchive={archiveDocument}
        />
      ) : null}
    </div>
  );
}

export { isReviewOnlyProductSurface, renderReviewSurfaceNotice } from './productWorkspaceHelpers';
