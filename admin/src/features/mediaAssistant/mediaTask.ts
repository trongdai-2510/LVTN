import type { MediaAttachment, MediaBatchDetail, MediaItem, ProductChoice } from './mediaAssistantTypes';

export type MediaTask = { itemId: string; fileName: string; targetName: string; attachment: MediaAttachment; reason: string; warning?: string };
export type ProductMatch = ProductChoice & { search_match?: { field: string; value: string } | null };
export type MediaTaskIntent = { intent: 'assign' | 'query' | 'unclear'; target_text: string; file_name: string; all_files: boolean; needs_clarification: boolean };

export function normalizeTaskText(value: string): string {
  return value.replace(/[đĐ]/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export function requestedProduct(text: string): string {
  const trimmed = text.trim();
  const afterTarget = trimmed.match(/(?:^|\s)(?:cho|vào|vao)\s+(?:(?:sản phẩm|san pham|mã|ma|model|sp)\s+)?(.+)$/iu);
  return (afterTarget?.[1] ?? (isAssignmentRequest(trimmed) ? '' : trimmed)).replace(/[?.!]+$/, '').trim();
}

export function isAssignmentRequest(text: string): boolean {
  const normalized = normalizeTaskText(text);
  if (/[?？]/.test(text) || /\b(truoc khi|sau khi) gan\b/.test(normalized)
    || /^(cho toi xem|xem|tim|lam sao|san pham nao)\b/.test(normalized)) return false;
  return /\b(gan|them|dua|ap dung|dinh kem|bo sung)\b/.test(normalized)
    && (/\b(anh|file|pdf|tai lieu|san pham)\b/.test(normalized) || /\.(?:jpe?g|png|webp|svg|pdf)\b/i.test(text));
}

export function likelyTaskSpeech(text: string): boolean {
  return /\b(gan|dinh kem|them|dua|bo sung|thuoc|cua ma|vao san pham)\b/.test(normalizeTaskText(text));
}

export function taskProductHint(intent: MediaTaskIntent | null, instruction: string): string {
  return (intent ? intent.intent === 'assign' ? intent.target_text : '' : requestedProduct(instruction))
    .replace(/^(?:sản phẩm|san pham|mã|ma|model|sp)\s+/iu, '').trim();
}

export function meansAllFiles(text: string): boolean {
  return /\b(tat ca|toan bo|moi file|ca [0-9]+ file)\b/.test(normalizeTaskText(text));
}

export function mentionedFile(items: MediaItem[], text: string): MediaItem | null {
  const normalized = normalizeTaskText(text);
  const found = items.filter((item) => {
    const name = normalizeTaskText(item.source_path.split('/').at(-1) ?? '');
    return name.length >= 4 && normalized.includes(name);
  });
  return found.length === 1 ? found[0] : null;
}

export function targetFromCandidates(item: MediaItem, hint: string): MediaTask | null {
  const requested = normalizeTaskText(hint);
  const matches = item.candidates.filter((candidate) => {
    if (!requested) return item.candidates.length === 1;
    const names = [candidate.groupName, candidate.variantName, ...candidate.evidence.map((entry) => entry.value)]
      .map(normalizeTaskText).filter((name) => name.length >= 3);
    return names.some((name) => requested === name || requested.includes(` ${name}`) || requested.startsWith(`${name} `));
  });
  if (matches.length !== 1) return null;
  const candidate = matches[0];
  const observed = item.local_analysis?.observed_codes ?? [];
  const contentMatches = candidate.evidence.some((entry) => entry.source === 'content' && observed.some((code) => normalizeTaskText(code) === normalizeTaskText(entry.value)));
  if (!requested && observed.length && !contentMatches) return null;
  const warning = observed.length && !contentMatches ? `AI đọc thấy mã ${observed.join(', ')} trong file, chưa xác minh được mã của sản phẩm này.` : undefined;
  const evidence = candidate.evidence.map((entry) => `${entry.value} từ ${entry.source === 'content' ? 'nội dung' : entry.source === 'folder' ? 'thư mục' : 'tên file'}`).join(', ');
  return makeTask(item, candidate.groupId, candidate.variantId, candidate.groupName, evidence || 'Theo sản phẩm bạn chỉ định', warning);
}

export function targetFromSearch(item: MediaItem, hint: string, products: ProductMatch[]): MediaTask | null {
  const requested = normalizeTaskText(hint);
  if (!requested) return null;
  const exact = products.filter((product) => normalizeTaskText(product.name) === requested
    || normalizeTaskText(product.search_match?.value ?? '') === requested);
  if (exact.length !== 1) return null;
  const product = exact[0];
  const observed = item.local_analysis?.observed_codes ?? [];
  const matchesObserved = observed.some((code) => normalizeTaskText(code) === normalizeTaskText(product.search_match?.value ?? ''));
  const warning = observed.length && !matchesObserved ? `AI đọc thấy mã ${observed.join(', ')}. Hãy kiểm tra mã này có thuộc ${product.name} trước khi đồng ý.` : undefined;
  return makeTask(item, product.id, null, product.name, `Tên/mã “${hint}” khớp một sản phẩm trong project`, warning);
}

function makeTask(item: MediaItem, groupId: string, variantId: string | null, targetName: string, reason: string, warning?: string): MediaTask {
  const attachment: MediaAttachment = item.mime_type.startsWith('image/')
    ? { kind: 'image', product_group_id: groupId, product_variant_id: variantId, set_thumbnail: false }
    : { kind: 'document', product_group_id: groupId, product_variant_id: variantId, document_type: 'other' };
  return { itemId: item.id, fileName: item.source_path, targetName, attachment, reason, warning };
}

export function taskIsCurrent(task: MediaTask, detail: MediaBatchDetail | null): boolean {
  return Boolean(detail?.items.some((item) => item.id === task.itemId && !['applied', 'skipped'].includes(item.status)));
}
