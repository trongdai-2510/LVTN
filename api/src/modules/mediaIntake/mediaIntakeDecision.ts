import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOCUMENT_TYPES = new Set(['datasheet', 'manual', 'catalogue', 'certificate', 'other']);

type MediaAttachment =
  | { kind: 'image'; product_group_id: string; product_variant_id: string | null; set_thumbnail: boolean }
  | { kind: 'document'; product_group_id: string; product_variant_id: string | null; document_type: 'datasheet' | 'manual' | 'catalogue' | 'certificate' | 'other'; is_public: false };

export type MediaDecision = { mode: 'skip' | 'attach'; attachments: MediaAttachment[] };

function invalid(message: string): never {
  throw new AppError({ code: ErrorCodes.VALIDATION_ERROR, message, statusCode: HttpStatus.BAD_REQUEST });
}

export function normalizeMediaDecision(value: unknown, mimeType: string): MediaDecision {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Quyết định media không hợp lệ.');
  const raw = value as Record<string, unknown>;
  if (raw.mode === 'skip') {
    if (raw.attachments != null && (!Array.isArray(raw.attachments) || raw.attachments.length > 0)) {
      invalid('Bỏ qua file không được kèm sản phẩm đích.');
    }
    return { mode: 'skip', attachments: [] };
  }
  if (raw.mode !== 'attach' || !Array.isArray(raw.attachments) || raw.attachments.length < 1 || raw.attachments.length > 20) {
    invalid('Chọn từ 1 đến 20 sản phẩm đích hoặc bỏ qua file.');
  }
  const attachments: MediaAttachment[] = [];
  const seen = new Set<string>();
  for (const entry of raw.attachments) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) invalid('Sản phẩm đích không hợp lệ.');
    const item = entry as Record<string, unknown>;
    if (typeof item.product_group_id !== 'string' || !UUID.test(item.product_group_id)) invalid('Mã sản phẩm đích không hợp lệ.');
    const variantId = item.product_variant_id == null ? null : item.product_variant_id;
    if (variantId !== null && (typeof variantId !== 'string' || !UUID.test(variantId))) invalid('Mã biến thể đích không hợp lệ.');
    const groupId = item.product_group_id as string;
    const key = item.kind === 'image' ? `${groupId}:image` : `${groupId}:${variantId ?? ''}:document`;
    if (seen.has(key)) invalid('Một file không được gán hai lần vào cùng một đích.');
    seen.add(key);
    if (item.kind === 'image') {
      if (!mimeType.startsWith('image/')) invalid('File này không phải ảnh.');
      if (item.set_thumbnail != null && typeof item.set_thumbnail !== 'boolean') invalid('Giá trị ảnh đại diện không hợp lệ.');
      const setThumbnail = item.set_thumbnail === true;
      attachments.push({ kind: 'image', product_group_id: groupId, product_variant_id: variantId as string | null, set_thumbnail: setThumbnail });
    } else if (item.kind === 'document') {
      if (mimeType !== 'application/pdf') invalid('Tài liệu kỹ thuật trong luồng này phải là PDF.');
      if (item.is_public === true) invalid('Tài liệu mới phải ở trạng thái riêng tư.');
      const documentType = item.document_type ?? 'other';
      if (typeof documentType !== 'string' || !DOCUMENT_TYPES.has(documentType)) invalid('Loại tài liệu không hợp lệ.');
      attachments.push({ kind: 'document', product_group_id: groupId, product_variant_id: variantId as string | null, document_type: documentType as 'datasheet' | 'manual' | 'catalogue' | 'certificate' | 'other', is_public: false });
    } else {
      invalid('Kiểu gán media không hợp lệ.');
    }
  }
  return { mode: 'attach', attachments };
}
