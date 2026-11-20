export type MediaCandidate = {
  groupId: string;
  variantId: string;
  groupName: string;
  variantName: string;
  evidence: Array<{ source: 'filename' | 'folder' | 'content'; field: string; value: string }>;
};

export type MediaAttachment = {
  kind: 'image' | 'document';
  product_group_id: string;
  product_variant_id: string | null;
  document_type?: string;
  set_thumbnail?: boolean;
};

export type MediaItem = {
  id: string;
  file_id: string;
  source_path: string;
  original_filename: string;
  mime_type: string;
  status: 'pending' | 'suggested' | 'unmatched' | 'confirmed' | 'applied' | 'skipped' | 'failed';
  candidates: MediaCandidate[];
  decision: { mode: 'skip' | 'attach'; attachments: MediaAttachment[] } | null;
  applied_result: Array<{ kind: 'image' | 'document'; product_group_id: string; product_variant_id: string | null; record_id: string; added: boolean }> | null;
  error_message: string | null;
  target_labels?: Record<string, string>;
  local_analysis?: { model: string; observed_codes: string[]; visible_text: string[]; description: string; uncertainty: string; analyzed_pages: number } | null;
};

export type MediaBatch = {
  id: string;
  batch_name: string | null;
  import_batch_id: string | null;
  status: string;
  item_count?: number;
  created_at: string;
};

export type MediaBatchDetail = { batch: MediaBatch; items: MediaItem[]; applied?: number; errors?: Array<{ item_id: string; message: string }> };

export type ProductChoice = { id: string; name: string; thumbnail_file_id?: string | null };

export type LocalAiStatus = { available: boolean; busy: boolean; model: string; locality: 'localhost'; message: string };
export type AssistantAnswer = { answer: string; referenced_item_ids: string[]; model: string };

export const MEDIA_BATCH_SELECTION_KEY = 'song-thanh-media-active-batch';
export const MEDIA_ASSISTANT_OPEN_EVENT = 'song-thanh-media-assistant-open';
export const MEDIA_BATCH_SELECTED_EVENT = 'song-thanh-media-batch-selected';
export const MEDIA_BATCH_UPDATED_EVENT = 'song-thanh-media-batch-updated';
