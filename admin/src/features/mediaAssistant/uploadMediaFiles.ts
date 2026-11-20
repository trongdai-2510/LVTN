import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import type { LocalAiStatus, MediaBatchDetail } from './mediaAssistantTypes';

const batchEndpoint = endpoints.songThanh.mediaBatches;

export interface MediaUploadResult {
  detail: MediaBatchDetail;
  added: number;
  matched: number;
  aiRead: number;
  addedItemIds: string[];
  failures: string[];
  aiStatus: LocalAiStatus | null;
}

export function initialMediaReads(items: MediaBatchDetail['items'], addedItemIds: readonly string[], limit = 2) {
  const added = new Set(addedItemIds);
  return items.filter((item) => added.has(item.id) && ['pending', 'suggested', 'unmatched'].includes(item.status)
    && !item.local_analysis && item.mime_type !== 'image/svg+xml')
    .sort((left, right) => Number(left.candidates.length === 1) - Number(right.candidates.length === 1))
    .slice(0, limit);
}

export async function uploadMediaFiles(input: {
  files: File[];
  currentBatch: MediaBatchDetail | null;
  importBatchId?: string;
  onProgress?: (text: string) => void;
  onBatchCreated?: (detail: MediaBatchDetail) => void;
  onDetail?: (detail: MediaBatchDetail) => void;
}): Promise<MediaUploadResult> {
  const { files, onProgress, onBatchCreated, onDetail } = input;
  if (!files.length) throw new Error('Hãy chọn ít nhất một ảnh hoặc PDF.');
  if ((input.currentBatch?.items.length ?? 0) + files.length > 500) {
    throw new Error('Mỗi lượt tối đa 500 file. Hãy chọn ít file hơn hoặc bắt đầu lượt khác.');
  }
  if (!files.some((file) => /\.(jpe?g|png|webp|svg|pdf)$/i.test(file.name) && file.size <= 25 * 1024 * 1024)) {
    throw new Error('Chỉ chọn ảnh hoặc PDF tối đa 25 MB mỗi file.');
  }

  let activeBatch = input.currentBatch;
  const failures: string[] = [];
  const addedItemIds: string[] = [];
  let added = 0;
  for (const [index, file] of files.entries()) {
    onProgress?.(`Đang tải file ${index + 1}/${files.length}: ${file.name}`);
    const extension = file.name.toLowerCase();
    if (!/\.(jpe?g|png|webp|svg|pdf)$/.test(extension) || file.size > 25 * 1024 * 1024) {
      failures.push(`${file.name}: chỉ nhận ảnh/PDF tối đa 25 MB`);
      continue;
    }
    let uploadedFileId: string | undefined;
    try {
      const data = new FormData();
      data.append('file', file);
      data.append('purpose', extension.endsWith('.pdf') ? 'technical_document' : 'product_image');
      const uploaded = await apiClient.postForm<{ file?: { id: string }; id?: string }>(endpoints.songThanh.fileUpload, data);
      uploadedFileId = uploaded.file?.id ?? uploaded.id;
      if (!uploadedFileId) throw new Error('Kho tệp không trả về mã file.');
      if (!activeBatch) {
        const date = new Intl.DateTimeFormat('vi-VN', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
          timeZone: 'Asia/Ho_Chi_Minh'
        }).format(new Date());
        activeBatch = await apiClient.post<MediaBatchDetail>(batchEndpoint, {
          batch_name: `Ảnh/PDF ${date}`,
          import_batch_id: input.importBatchId?.trim() || undefined
        });
        onBatchCreated?.(activeBatch);
      }
      const attached = await apiClient.post<{ item?: { id: string }; already_added?: boolean }>(
        `${batchEndpoint}/${activeBatch.batch.id}/items`,
        { file_id: uploadedFileId, source_path: file.webkitRelativePath || file.name }
      );
      if (!attached.already_added) {
        added += 1;
        if (attached.item?.id) addedItemIds.push(attached.item.id);
      }
    } catch (cause) {
      failures.push(`${file.name}: ${cause instanceof Error ? cause.message : 'lỗi tải lên'}`);
      if (!activeBatch && uploadedFileId) break;
    }
  }
  if (!activeBatch || added === 0) throw new Error(`Không thêm được file nào. ${failures.slice(0, 3).join('; ')}`);

  let matched = 0;
  let aiRead = 0;
  let aiStatus: LocalAiStatus | null = null;
  if (!activeBatch.batch.import_batch_id) {
    onProgress?.('Đang tìm sản phẩm từ mã trong tên file và thư mục…');
    try {
      let analyzed = await apiClient.post<MediaBatchDetail>(`${batchEndpoint}/${activeBatch.batch.id}/analyze`);
      onDetail?.(analyzed);
      aiStatus = await apiClient.get<LocalAiStatus>(`${batchEndpoint}/local-ai/status`);
      if (aiStatus.available) {
        const toRead = initialMediaReads(analyzed.items, addedItemIds);
        for (const [index, item] of toRead.entries()) {
          onProgress?.(`Robot đang đọc nội dung ${index + 1}/${toRead.length}: ${item.source_path}`);
          try {
            analyzed = await apiClient.post<MediaBatchDetail>(`${batchEndpoint}/${activeBatch.batch.id}/items/${item.id}/analyze-local`);
            aiRead += 1;
            onDetail?.(analyzed);
          } catch (cause) {
            failures.push(`${item.source_path}: robot chưa đọc được (${cause instanceof Error ? cause.message : 'lỗi phân tích'})`);
          }
        }
      }
      matched = analyzed.items.filter((item) => addedItemIds.includes(item.id) && item.candidates.length === 1).length;
    } catch (cause) {
      failures.push(`chưa đối chiếu tự động (${cause instanceof Error ? cause.message : 'lỗi phân tích'})`);
    }
  }
  const detail = await apiClient.get<MediaBatchDetail>(`${batchEndpoint}/${activeBatch.batch.id}`);
  onDetail?.(detail);
  onProgress?.('');
  return { detail, added, matched, aiRead, addedItemIds, failures, aiStatus };
}
