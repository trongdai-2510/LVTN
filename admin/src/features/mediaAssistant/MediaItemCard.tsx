'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AdminFileThumbnail } from '@/features/website-content/AdminFileThumbnail';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import type { MediaAttachment, MediaCandidate, MediaItem, ProductChoice } from './mediaAssistantTypes';

const documentTypes = [
  ['datasheet', 'Datasheet'], ['manual', 'Hướng dẫn'], ['catalogue', 'Catalogue'],
  ['certificate', 'Chứng nhận'], ['other', 'Khác']
];
const itemStatusLabels: Record<MediaItem['status'], string> = {
  pending: 'Chưa đối chiếu', suggested: 'Có gợi ý', unmatched: 'Chưa tìm thấy sản phẩm',
  confirmed: 'Đã xác nhận', applied: 'Đã gán', skipped: 'Đã bỏ qua', failed: 'Cần xem lại'
};

function labelFor(candidate: MediaCandidate) {
  return candidate.variantName && candidate.variantName !== candidate.groupName
    ? `${candidate.groupName} — ${candidate.variantName}` : candidate.groupName;
}

function evidenceFor(candidate: MediaCandidate) {
  return [...new Set(candidate.evidence.map((entry) => {
    const place = entry.source === 'filename' ? 'tên file' : entry.source === 'folder' ? 'tên thư mục' : 'nội dung file';
    return `Mã ${entry.value} từ ${place}`;
  }))].join(' · ');
}

function documentTypeHint(path: string): string {
  const name = path.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
  const hints = [
    ['datasheet', /data[ _-]?sheet|technical[ _-]?data|thong[ _-]?so/],
    ['manual', /manual|user[ _-]?guide|huong[ _-]?dan|lap[ _-]?dat/],
    ['catalogue', /catalog|brochure/],
    ['certificate', /certificate|chung[ _-]?nhan|test[ _-]?report/]
  ].filter(([, pattern]) => (pattern as RegExp).test(name));
  return hints.length === 1 ? hints[0][0] as string : 'other';
}

export function MediaItemCard({ item, embedded = false, canConfirm, canAnalyzeLocally, busy, onConfirm, onAnalyzeLocally }: {
  item: MediaItem;
  embedded?: boolean;
  canConfirm: boolean;
  canAnalyzeLocally: boolean;
  busy: boolean;
  onConfirm: (itemId: string, decision: { mode: 'skip' | 'attach'; attachments?: MediaAttachment[] }) => Promise<void>;
  onAnalyzeLocally: (itemId: string) => Promise<void>;
}) {
  const isImage = item.mime_type.startsWith('image/');
  const [attachments, setAttachments] = useState<MediaAttachment[]>(() => item.decision?.attachments ?? []);
  const [query, setQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [results, setResults] = useState<ProductChoice[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const locked = item.status === 'applied';
  const savedDecisionKey = JSON.stringify(item.decision);
  const documentHint = documentTypeHint(item.source_path);
  const observedCodes = item.local_analysis?.observed_codes ?? [];
  const contentMatchesCandidate = item.candidates.some((candidate) => candidate.evidence.some((entry) => entry.source === 'content'
    && observedCodes.some((code) => code.toLowerCase() === entry.value.toLowerCase())));
  const contentConflict = observedCodes.length > 0 && item.candidates.length > 0 && !contentMatchesCandidate;
  const suggestedCandidate = item.status === 'suggested' && item.candidates.length === 1 && !contentConflict ? item.candidates[0] : null;
  const suggestedCandidateKey = suggestedCandidate ? `${suggestedCandidate.groupId}:${suggestedCandidate.variantId}` : '';

  useEffect(() => {
    if (item.decision?.attachments) {
      setAttachments(item.decision.attachments);
    } else if (contentConflict) {
      setAttachments([]);
    } else if (suggestedCandidate) {
      setAttachments((current) => current.length ? current : [isImage
        ? { kind: 'image', product_group_id: suggestedCandidate.groupId, product_variant_id: suggestedCandidate.variantId, set_thumbnail: false }
        : { kind: 'document', product_group_id: suggestedCandidate.groupId, product_variant_id: suggestedCandidate.variantId, document_type: documentHint }]);
    }
  }, [savedDecisionKey, suggestedCandidateKey, item.status, contentConflict]);

  function addTarget(groupId: string, variantId: string | null) {
    const next: MediaAttachment = isImage
      ? { kind: 'image', product_group_id: groupId, product_variant_id: variantId, set_thumbnail: false }
      : { kind: 'document', product_group_id: groupId, product_variant_id: variantId, document_type: documentHint };
    setAttachments((current) => current.some((entry) =>
      entry.product_group_id === groupId && (isImage || entry.product_variant_id === variantId)
    ) ? current : [...current, next]);
  }

  async function searchProducts() {
    if (query.trim().length < 2) return;
    setSearching(true);
    setSearchError('');
    try {
      const params = new URLSearchParams({ q: query.trim(), page: '1', page_size: '10', deleted_scope: 'active' });
      const response = await apiClient.get<{ items: ProductChoice[] }>(`${endpoints.songThanh.productGroups}?${params}`);
      setResults(response.items ?? []);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Không tìm được sản phẩm.');
    } finally {
      setSearching(false);
    }
  }

  return <article className={embedded ? 'space-y-4' : 'rounded-xl border border-border bg-card p-4 space-y-4'} data-media-item={item.id}>
    <div className="flex gap-4">
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
        <AdminFileThumbnail file={{ id: item.file_id, original_filename: item.original_filename, mime_type: item.mime_type }} alt={item.original_filename} className="h-full w-full object-contain" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="break-all font-medium">{item.source_path}</div>
        <div className="text-sm text-muted-foreground">{isImage ? 'Ảnh sản phẩm' : 'Tài liệu PDF'} · {itemStatusLabels[item.status]}</div>
        {!isImage && documentHint !== 'other' && <div className="text-xs text-muted-foreground">Gợi ý loại tài liệu từ tên file: {documentTypes.find(([value]) => value === documentHint)?.[1]}</div>}
        {item.error_message && <div className="mt-1 text-sm text-red-600">{item.error_message}</div>}
      </div>
    </div>

    {item.status === 'pending' && <p className="text-sm text-muted-foreground">Chưa tìm sản phẩm cho file này. Bạn có thể để AI đọc nội dung hoặc tìm sản phẩm bên dưới.</p>}
    {item.status === 'unmatched' && <p className="text-sm text-muted-foreground">Chưa có gợi ý phù hợp. Có thể cho robot đọc lại hoặc tìm sản phẩm bằng ô bên dưới.</p>}
    {item.candidates.length > 0 && !item.local_analysis && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Gợi ý hiện dựa trên tên file/thư mục; robot chưa đọc nội dung. Hãy cho robot đọc hoặc so file trực tiếp trước khi xác nhận.</p>}
    {contentConflict && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">Mã robot đọc từ nội dung không khớp gợi ý từ tên file/thư mục. Hãy xem file và tự chọn đúng sản phẩm; hệ thống không chọn sẵn đích gán.</p>}
    {item.local_analysis && item.candidates.length > 0 && !contentConflict && !contentMatchesCandidate && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Robot đã xem file nhưng chưa xác minh được mã của gợi ý trong nội dung. Gợi ý vẫn chỉ dựa trên tên file/thư mục.</p>}

    {item.candidates.length > 0 && <div>
      <div className="mb-2 text-sm font-semibold">Robot tìm thấy {item.candidates.length === 1 ? 'một sản phẩm' : `${item.candidates.length} sản phẩm có thể khớp`}</div>
      <div className="grid gap-2">
        {item.candidates.slice(0, 8).map((candidate) => <button key={candidate.variantId} type="button"
          disabled={locked || busy} onClick={() => addTarget(candidate.groupId, candidate.variantId)}
          className="rounded-lg border border-border bg-[#f8fbfd] px-3 py-3 text-left text-sm hover:border-primary hover:bg-[#edf5fa] disabled:opacity-50">
          <strong className="block font-semibold text-text">{labelFor(candidate)}</strong>
          <span className="mt-1 block text-xs text-muted-foreground">{evidenceFor(candidate)}</span>
        </button>)}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Hãy so lại file và sản phẩm trước khi xác nhận.</p>
    </div>}

    {item.local_analysis && <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm space-y-1">
      <div className="font-medium">AI cục bộ quan sát được</div>
      <p>{item.local_analysis.description || 'Chưa mô tả được nội dung.'}</p>
      <p>Mã đọc được: {item.local_analysis.observed_codes.length ? item.local_analysis.observed_codes.join(', ') : 'chưa thấy mã rõ ràng'}</p>
      {item.local_analysis.uncertainty && <p className="text-amber-700">Cần kiểm tra: {item.local_analysis.uncertainty}</p>}
      <p className="text-xs text-muted-foreground">{item.local_analysis.model} · {item.local_analysis.analyzed_pages ? `đã xem ${item.local_analysis.analyzed_pages} trang đầu` : 'đã xem ảnh'} · mã và mô tả cần admin kiểm chứng.</p>
    </div>}

    {!locked && <div className="space-y-2">
      {suggestedCandidate && !showSearch ? <button type="button" onClick={() => setShowSearch(true)} className="text-sm font-semibold text-primary hover:underline">Tìm thêm hoặc đổi sản phẩm</button> : <label htmlFor={`search-${item.id}`} className="text-sm font-medium">Tìm sản phẩm khác</label>}
      {(!suggestedCandidate || showSearch) && <>
      <div className="flex gap-2">
        <input id={`search-${item.id}`} value={query} onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') void searchProducts(); }}
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Tên hoặc mã sản phẩm" />
        <button type="button" onClick={() => void searchProducts()} disabled={searching || busy || query.trim().length < 2}
          className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">{searching ? 'Đang tìm' : 'Tìm'}</button>
      </div>
      {searchError && <p className="text-sm text-red-600">{searchError}</p>}
      {results.map((product) => <button key={product.id} type="button" onClick={() => addTarget(product.id, null)}
        className="mr-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">+ {product.name}</button>)}
      {suggestedCandidate && showSearch && <p className="text-xs text-muted-foreground">Nếu gợi ý cũ không đúng, bỏ đích đó ở phần dự kiến gán bên dưới.</p>}
      </>}
    </div>}

    {attachments.length > 0 && <div className="space-y-2">
      <div className="text-sm font-medium">{item.decision ? 'Sản phẩm đã xác nhận' : 'Dự kiến gán vào — kiểm tra trước khi xác nhận'}</div>
      {attachments.map((entry, index) => {
        const candidate = item.candidates.find((candidate) => candidate.groupId === entry.product_group_id && candidate.variantId === entry.product_variant_id);
        const result = results.find((product) => product.id === entry.product_group_id);
        return <div key={`${entry.product_group_id}-${entry.product_variant_id ?? ''}`} className="flex flex-col gap-2 rounded-lg bg-muted/50 px-3 py-3 text-sm sm:flex-row sm:flex-wrap sm:items-center">
          <span className="min-w-0 font-medium sm:min-w-[180px] sm:flex-1">{candidate ? labelFor(candidate) : result?.name ?? item.target_labels?.[`${entry.product_group_id}:${entry.product_variant_id ?? ''}`] ?? entry.product_group_id}</span>
          {isImage ? <label className="flex items-center gap-2"><input type="checkbox" disabled={locked || busy} checked={entry.set_thumbnail === true}
            onChange={(event) => setAttachments((current) => current.map((value, at) => at === index ? { ...value, set_thumbnail: event.target.checked } : value))} /> Ảnh đại diện nếu còn trống</label>
            : <select disabled={locked || busy} value={entry.document_type ?? 'other'} onChange={(event) => setAttachments((current) => current.map((value, at) => at === index ? { ...value, document_type: event.target.value } : value))}
              className="rounded border border-border bg-background px-2 py-1">{documentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}
          {!locked && <button type="button" onClick={() => setAttachments((current) => current.filter((_, at) => at !== index))} className="self-start text-red-600 sm:self-auto">Bỏ đích này</button>}
        </div>;
      })}
    </div>}

    {!locked && <div className="flex flex-wrap gap-2">
      {canAnalyzeLocally && <button type="button" disabled={busy} onClick={() => void onAnalyzeLocally(item.id)}
        className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary disabled:opacity-50">Để AI đọc nội dung file</button>}
      {canConfirm && <button type="button" disabled={busy || attachments.length === 0} onClick={() => void onConfirm(item.id, { mode: 'attach', attachments })}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Xác nhận gán file</button>}
      <button type="button" disabled={busy} onClick={() => void onConfirm(item.id, { mode: 'skip' })}
        className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50">Bỏ qua file này</button>
    </div>}
    {item.status === 'confirmed' && <p className="text-xs text-muted-foreground">Đã xác nhận, vẫn có thể sửa đích trước khi áp dụng đợt.</p>}
    {item.status === 'applied' && Array.isArray(item.applied_result) && <div className="space-y-1 text-sm">
      {item.applied_result.map((result) => <div key={result.record_id}>
        {result.added ? 'Đã gán' : 'Đã có sẵn'} {result.kind === 'image' ? 'ảnh' : result.added ? 'PDF riêng tư' : 'PDF'} vào{' '}
        <Link href={`/product-groups/${result.product_group_id}`} className="underline">{item.target_labels?.[`${result.product_group_id}:${result.product_variant_id ?? ''}`] ?? 'sản phẩm'}</Link>.
      </div>)}
    </div>}
  </article>;
}
