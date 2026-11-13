'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { ErrorMessagePanel } from '@/components/ui/ErrorMessagePanel';
import { authStore } from '@/features/auth/auth.store';
import type { AuthState } from '@/features/auth/auth.types';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { PERMISSIONS } from '@/lib/permissions';
import { MediaItemCard } from './MediaItemCard';
import { mediaBatchLabel } from './mediaBatchLabel';
import { MEDIA_ASSISTANT_OPEN_EVENT, MEDIA_BATCH_SELECTED_EVENT, MEDIA_BATCH_SELECTION_KEY, MEDIA_BATCH_UPDATED_EVENT, type LocalAiStatus, type MediaAttachment, type MediaBatch, type MediaBatchDetail } from './mediaAssistantTypes';
import { initialMediaReads } from './uploadMediaFiles';

const batchEndpoint = endpoints.songThanh.mediaBatches;

export function MediaAssistantPage() {
  const searchParams = useSearchParams();
  const [auth, setAuth] = useState<AuthState>(() => authStore.getState());
  const [batches, setBatches] = useState<MediaBatch[]>([]);
  const [detail, setDetail] = useState<MediaBatchDetail | null>(null);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [importBatchId, setImportBatchId] = useState(searchParams.get('import_batch_id') ?? '');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingQuery, setExistingQuery] = useState('');
  const [existingFiles, setExistingFiles] = useState<Array<{ id: string; original_filename: string; mime_type: string }>>([]);
  const [localAi, setLocalAi] = useState<LocalAiStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [aiProgress, setAiProgress] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState<unknown>(null);
  const canUpload = auth.permissions.includes(PERMISSIONS.fileCreate);
  const canAttachImage = auth.permissions.includes(PERMISSIONS.productGroupUpdate);
  const canAttachDocument = auth.permissions.includes(PERMISSIONS.technicalDocumentCreate);

  useEffect(() => {
    setAuth(authStore.hydrate());
    const unsubscribe = authStore.subscribe(setAuth);
    void loadBatches().then((items) => {
      const linkedBatchId = searchParams.get('batch_id');
      const linkedImportId = searchParams.get('import_batch_id');
      const remembered = window.sessionStorage.getItem(MEDIA_BATCH_SELECTION_KEY);
      const selected = linkedBatchId ? { id: linkedBatchId } : linkedImportId
        ? items.find((batch) => batch.import_batch_id === linkedImportId && (batch.item_count ?? 0) > 0)
        : items.find((batch) => batch.id === remembered);
      if (selected) void openBatch(selected.id, false);
    });
    void refreshLocalAi();
    return unsubscribe;
  }, []);

  useEffect(() => {
    setSelectedItemId(searchParams.get('item_id') ?? '');
  }, [searchParams]);

  useEffect(() => {
    function onSelection(event: Event) {
      const id = (event as CustomEvent<string>).detail;
      if (!id) {
        setDetail(null);
        setSelectedFiles([]);
        setNotice('');
        return;
      }
      if (id && id !== detail?.batch.id) void openBatch(id, false);
    }
    function onUpdate(event: Event) {
      const id = (event as CustomEvent<string>).detail;
      if (id && id === detail?.batch.id) void openBatch(id, false);
    }
    window.addEventListener(MEDIA_BATCH_SELECTED_EVENT, onSelection);
    window.addEventListener(MEDIA_BATCH_UPDATED_EVENT, onUpdate);
    return () => {
      window.removeEventListener(MEDIA_BATCH_SELECTED_EVENT, onSelection);
      window.removeEventListener(MEDIA_BATCH_UPDATED_EVENT, onUpdate);
    };
  }, [detail?.batch.id]);

  async function loadBatches() {
    try {
      const data = await apiClient.get<{ items: MediaBatch[] }>(batchEndpoint);
      setBatches(data.items ?? []);
      return data.items ?? [];
    } catch (cause) { setError(cause); return []; }
  }

  async function refreshLocalAi() {
    try { setLocalAi(await apiClient.get<LocalAiStatus>(`${batchEndpoint}/local-ai/status`)); }
    catch { setLocalAi({ available: false, busy: false, model: 'qwen3-vl:2b-instruct', locality: 'localhost', message: 'Chưa kiểm tra được AI cục bộ.' }); }
  }

  async function openBatch(id: string, announce = true) {
    setError(null);
    try {
      setDetail(await apiClient.get<MediaBatchDetail>(`${batchEndpoint}/${id}`));
      if (announce) {
        window.sessionStorage.setItem(MEDIA_BATCH_SELECTION_KEY, id);
        window.dispatchEvent(new CustomEvent(MEDIA_BATCH_SELECTED_EVENT, { detail: id }));
      }
    } catch (cause) { setError(cause); }
  }

  async function uploadFiles() {
    if (selectedFiles.length === 0) return;
    if ((detail?.items.length ?? 0) + selectedFiles.length > 500) {
      setError(new Error('Mỗi lượt tối đa 500 file. Hãy chọn ít file hơn hoặc bắt đầu lượt khác.'));
      return;
    }
    const validFiles = selectedFiles.filter((file) => /\.(jpe?g|png|webp|svg|pdf)$/i.test(file.name) && file.size <= 25 * 1024 * 1024);
    if (validFiles.length === 0) {
      setError(new Error('Chỉ chọn ảnh hoặc PDF tối đa 25 MB mỗi file.'));
      return;
    }
    setBusy(true);
    setError(null);
    const failures: string[] = [];
    let added = 0;
    const addedItemIds: string[] = [];
    let activeBatch = detail;
    for (let index = 0; index < selectedFiles.length; index += 1) {
      const file = selectedFiles[index];
      setProgress(`Đang tải file ${index + 1}/${selectedFiles.length}: ${file.name}`);
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
        const fileId = uploaded.file?.id ?? uploaded.id;
        if (!fileId) throw new Error('Kho tệp không trả về mã file.');
        uploadedFileId = fileId;
        if (!activeBatch) {
          const date = new Intl.DateTimeFormat('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
            timeZone: 'Asia/Ho_Chi_Minh'
          }).format(new Date());
          activeBatch = await apiClient.post<MediaBatchDetail>(batchEndpoint, {
            batch_name: `Ảnh/PDF ${date}`,
            import_batch_id: importBatchId.trim() || undefined
          });
          setDetail(activeBatch);
          setImportBatchId('');
          window.sessionStorage.setItem(MEDIA_BATCH_SELECTION_KEY, activeBatch.batch.id);
          window.dispatchEvent(new CustomEvent(MEDIA_BATCH_SELECTED_EVENT, { detail: activeBatch.batch.id }));
        }
        const attached = await apiClient.post<{ item?: { id: string }; already_added?: boolean }>(`${batchEndpoint}/${activeBatch.batch.id}/items`, {
          file_id: fileId, source_path: file.webkitRelativePath || file.name
        });
        if (!attached.already_added) {
          added += 1;
          if (attached.item?.id) addedItemIds.push(attached.item.id);
        }
      } catch (cause) {
        failures.push(`${file.name}: ${cause instanceof Error ? cause.message : 'lỗi tải lên'}`);
        if (!activeBatch && uploadedFileId) break;
      }
    }
    if (!activeBatch) {
      setProgress('');
      setBusy(false);
      setError(new Error(`Không thêm được file nào. ${failures.slice(0, 3).join('; ')}`));
      return;
    }
    let matched = 0;
    let aiRead = 0;
    if (added > 0 && !activeBatch.batch.import_batch_id) {
      setProgress('Đang tìm sản phẩm từ mã trong tên file và thư mục…');
      try {
        let analyzed: MediaBatchDetail = await apiClient.post<MediaBatchDetail>(`${batchEndpoint}/${activeBatch.batch.id}/analyze`);
        setDetail(analyzed);
        window.dispatchEvent(new CustomEvent(MEDIA_BATCH_UPDATED_EVENT, { detail: activeBatch.batch.id }));
        const status = await apiClient.get<LocalAiStatus>(`${batchEndpoint}/local-ai/status`);
        setLocalAi(status);
        if (status.available) {
          const toRead = initialMediaReads(analyzed.items, addedItemIds);
          for (const [index, item] of toRead.entries()) {
            setProgress(`Robot đang đọc nội dung ${index + 1}/${toRead.length}: ${item.source_path}`);
            try {
              analyzed = await apiClient.post<MediaBatchDetail>(
                `${batchEndpoint}/${activeBatch.batch.id}/items/${item.id}/analyze-local`);
              aiRead += 1;
              setDetail(analyzed);
              window.dispatchEvent(new CustomEvent(MEDIA_BATCH_UPDATED_EVENT, { detail: activeBatch.batch.id }));
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
    await openBatch(activeBatch.batch.id);
    await loadBatches();
    setProgress('');
    setBusy(false);
    setSelectedFiles([]);
    if (added === 0) {
      setNotice('');
      setError(new Error(`Không thêm được file nào. ${failures.slice(0, 3).join('; ')}`));
    } else {
      setNotice(`Đã thêm ${added} file${matched ? `, có gợi ý một sản phẩm cho ${matched} file` : ''}${aiRead ? `; robot đã đọc nội dung ${aiRead} file` : ''}.${failures.length ? ` Cần xem lại: ${failures.slice(0, 3).join('; ')}` : ''}`);
    }
  }

  async function searchExisting() {
    if (existingQuery.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: existingQuery.trim(), deleted_scope: 'active', page_size: '20' });
      const response = await apiClient.get<{ items: Array<{ id: string; original_filename: string; mime_type: string }> }>(`${endpoints.songThanh.files}?${params}`);
      setExistingFiles((response.items ?? []).filter((file) => file.mime_type.startsWith('image/') || file.mime_type === 'application/pdf'));
    } catch (cause) { setError(cause); }
    finally { setBusy(false); }
  }

  async function addExisting(fileId: string) {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`${batchEndpoint}/${detail.batch.id}/items`, { file_id: fileId });
      setNotice('Đã thêm file từ Kho tệp vào lượt đang làm.');
      await openBatch(detail.batch.id);
      await loadBatches();
    } catch (cause) { setError(cause); }
    finally { setBusy(false); }
  }

  async function analyze() {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiClient.post<MediaBatchDetail & { analyzed: number }>(`${batchEndpoint}/${detail.batch.id}/analyze`);
      setDetail(result);
      window.dispatchEvent(new CustomEvent(MEDIA_BATCH_UPDATED_EVENT, { detail: detail.batch.id }));
      setNotice(`Đã đối chiếu ${result.analyzed} file với sản phẩm trong project. Gợi ý chưa gắn file.`);
    } catch (cause) { setError(cause); }
    finally { setBusy(false); }
  }

  async function analyzeLocally(itemId: string) {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiClient.post<MediaBatchDetail>(`${batchEndpoint}/${detail.batch.id}/items/${itemId}/analyze-local`);
      setDetail(result);
      window.dispatchEvent(new CustomEvent(MEDIA_BATCH_UPDATED_EVENT, { detail: detail.batch.id }));
      setNotice('AI cục bộ đã đọc file và đối chiếu các mã quan sát được với sản phẩm trong project. Hãy kiểm tra gợi ý.');
    } catch (cause) { setError(cause); }
    finally { setBusy(false); await refreshLocalAi(); }
  }

  async function analyzeManyLocally() {
    if (!detail || !localAi?.available) return;
    const eligible = detail.items.filter((item) =>
      ['pending', 'suggested', 'unmatched'].includes(item.status) && !item.local_analysis && item.mime_type !== 'image/svg+xml'
    ).slice(0, 10);
    if (!eligible.length) return;
    setBusy(true);
    setError(null);
    const failures: string[] = [];
    let completed = 0;
    for (const [index, item] of eligible.entries()) {
      setAiProgress(`Robot đang đọc ${index + 1}/${eligible.length}: ${item.source_path}`);
      try {
        setDetail(await apiClient.post<MediaBatchDetail>(`${batchEndpoint}/${detail.batch.id}/items/${item.id}/analyze-local`));
        completed += 1;
      } catch (cause) {
        failures.push(`${item.source_path}: ${cause instanceof Error ? cause.message : 'không đọc được'}`);
      }
    }
    window.dispatchEvent(new CustomEvent(MEDIA_BATCH_UPDATED_EVENT, { detail: detail.batch.id }));
    setAiProgress('');
    setNotice(`Robot đã đọc ${completed}/${eligible.length} file. ${failures.length ? `Cần xem lại: ${failures.slice(0, 3).join('; ')}` : 'Hãy kiểm tra gợi ý và xác nhận từng file.'}`);
    setBusy(false);
    await refreshLocalAi();
  }

  async function confirmItem(itemId: string, decision: { mode: 'skip' | 'attach'; attachments?: MediaAttachment[] }) {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      setDetail(await apiClient.post<MediaBatchDetail>(`${batchEndpoint}/${detail.batch.id}/items/${itemId}/confirm`, { decision }));
      window.dispatchEvent(new CustomEvent(MEDIA_BATCH_UPDATED_EVENT, { detail: detail.batch.id }));
      setNotice(decision.mode === 'skip' ? 'Đã bỏ qua file.' : 'Đã lưu quyết định. File sẽ được gán khi bạn bấm áp dụng.');
    } catch (cause) { setError(cause); }
    finally { setBusy(false); }
  }

  async function applyBatch() {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiClient.post<MediaBatchDetail>(`${batchEndpoint}/${detail.batch.id}/apply`);
      setDetail(result);
      window.dispatchEvent(new CustomEvent(MEDIA_BATCH_UPDATED_EVENT, { detail: detail.batch.id }));
      setNotice(`Đã áp dụng ${result.applied ?? 0} file.${result.errors?.length ? ` ${result.errors.length} file cần xem lại.` : ''}`);
      await loadBatches();
    } catch (cause) { setError(cause); }
    finally { setBusy(false); }
  }

  const counts = useMemo(() => {
    const items = detail?.items ?? [];
    return { total: items.length, suggested: items.filter((item) => item.status === 'suggested').length,
      unresolved: items.filter((item) => ['pending', 'suggested', 'unmatched', 'failed'].includes(item.status)).length,
      confirmed: items.filter((item) => item.status === 'confirmed').length,
      skipped: items.filter((item) => item.status === 'skipped').length,
      applied: items.filter((item) => item.status === 'applied').length };
  }, [detail]);
  const unreadCount = detail?.items.filter((item) =>
    ['pending', 'suggested', 'unmatched'].includes(item.status) && !item.local_analysis && item.mime_type !== 'image/svg+xml'
  ).length ?? 0;
  const hasFiles = counts.total > 0;
  const visibleBatches = batches.filter((batch) => (batch.item_count ?? 0) > 0);
  const selectedItem = detail?.items.find((item) => item.id === selectedItemId) ?? detail?.items[0];
  const itemStatusLabels: Record<MediaBatchDetail['items'][number]['status'], string> = {
    pending: 'Chưa đối chiếu', suggested: 'Có gợi ý', unmatched: 'Chưa tìm thấy',
    confirmed: 'Đã xác nhận', applied: 'Đã gán', skipped: 'Đã bỏ qua', failed: 'Cần xem lại'
  };

  return <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
    <header className="space-y-2">
      <h1 className="text-2xl font-semibold">Duyệt ảnh &amp; PDF</h1>
      <p className="text-sm text-muted-foreground">Kiểm tra gợi ý của trợ lý trước khi gắn file vào sản phẩm.</p>
    </header>
    {Boolean(error) && <ErrorMessagePanel error={error} context="generic" compact />}
    {notice && <div role="status" className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm">{notice}</div>}

    {!hasFiles && <section className="mx-auto flex max-w-xl flex-col items-center pb-10 pt-12 text-center md:pt-16">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-[25px] border border-[#d4e7f2] bg-[#eaf5fb] text-[#397cad]">
        <svg width="46" height="46" viewBox="0 0 46 46" fill="none" aria-hidden="true">
          <rect x="5" y="8" width="30" height="28" rx="4" stroke="currentColor" strokeWidth="2" />
          <circle cx="13" cy="17" r="2.5" fill="currentColor" />
          <path d="m8 31 8-8 6 6 4-4 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M38 18v18a4 4 0 0 1-4 4H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <p className="mb-3 text-xs font-semibold text-primary">BẮT ĐẦU VỚI ẢNH HOẶC PDF</p>
      <h2 className="text-2xl font-semibold text-text md:text-[28px]">Chưa có file nào để duyệt</h2>
      <p className="mt-3 max-w-lg text-sm leading-7 text-muted-foreground">Gửi ảnh hoặc PDF cho trợ lý. Robot sẽ tìm sản phẩm trong project, nêu lý do gợi ý và chờ bạn kiểm tra trước khi gán.</p>
      {importBatchId && <p className="mt-4 rounded-lg border border-border bg-panel px-4 py-2 text-sm text-text">File gửi ở đây sẽ đi cùng lô Excel bạn vừa mở.</p>}
      <button type="button" data-media-assistant-trigger onClick={() => window.dispatchEvent(new Event(MEDIA_ASSISTANT_OPEN_EVENT))}
        className="mt-6 min-h-11 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[#104f86] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none">Mở trợ lý để gửi ảnh/PDF</button>
      <p className="mt-8 text-xs text-muted-foreground">Gửi file <span className="mx-2 text-[#a3b8c8]">→</span> Xem gợi ý <span className="mx-2 text-[#a3b8c8]">→</span> Bạn duyệt và áp dụng</p>
    </section>}

    {detail && hasFiles && <section className="border-b border-border pb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-semibold text-primary">LƯỢT ĐANG XEM</p>
          <h2 className="mt-1 text-xl font-semibold text-text">{mediaBatchLabel(detail.batch)}</h2></div>
        <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-muted-foreground">{counts.total} file · {unreadCount} chưa đọc nội dung · {counts.confirmed} đã xác nhận · {counts.applied} đã áp dụng</p>
          <button type="button" data-media-assistant-trigger onClick={() => window.dispatchEvent(new Event(MEDIA_ASSISTANT_OPEN_EVENT))} className="min-h-10 rounded-lg border border-border px-3 text-sm font-semibold text-primary hover:bg-surface">Hỏi trợ lý</button></div>
      </div>
      {detail.batch.import_batch_id && <p className="mt-3 text-sm">Các file này đi cùng <Link href={'/import/' + detail.batch.import_batch_id} className="text-primary underline">lô Excel đã mở</Link>. Sau khi áp dụng lô Excel, quay lại đây và bấm “Đối chiếu nhanh theo tên file” để robot tìm sản phẩm vừa nhập.</p>}
    </section>}

    <section className="space-y-5">
      {hasFiles && <details className="border-b border-border pb-3">
        <summary className="cursor-pointer py-2 text-sm font-semibold text-primary">Thêm file vào lượt này</summary>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="mt-3 text-base font-semibold text-text">Chọn thêm file từ máy</h2>
            <p className="mt-1 text-sm text-muted-foreground">Chọn nhiều file hoặc cả thư mục trên máy. Hệ thống lưu lượt xử lý để bạn quay lại sau.</p>
          </div>
          {detail && <button type="button" onClick={() => { setDetail(null); setSelectedFiles([]); setNotice(''); window.sessionStorage.removeItem(MEDIA_BATCH_SELECTION_KEY); window.dispatchEvent(new CustomEvent(MEDIA_BATCH_SELECTED_EVENT, { detail: '' })); }} className="min-h-10 rounded-md border border-border px-3 text-sm font-medium text-primary hover:bg-surface">Bắt đầu lượt mới</button>}
        </div>
        {(!detail || ['open', 'partially_applied'].includes(detail.batch.status)) && <>
          <div className="mt-4 flex flex-wrap gap-2">
            <input id="media-file-picker" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.svg,.pdf" disabled={!canUpload || busy}
              onChange={(event) => { setSelectedFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ''; }} className="peer/file sr-only" />
            <label htmlFor="media-file-picker" className="flex min-h-11 cursor-pointer items-center rounded-md border border-border px-4 text-sm font-semibold text-text hover:bg-surface peer-focus-visible/file:outline peer-focus-visible/file:outline-2 peer-focus-visible/file:outline-primary">Chọn file từ máy</label>
            <input id="media-folder-picker" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.svg,.pdf" disabled={!canUpload || busy}
              ref={(element) => { if (element) element.setAttribute('webkitdirectory', ''); }}
              onChange={(event) => { setSelectedFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ''; }} className="peer/folder sr-only" />
            <label htmlFor="media-folder-picker" className="flex min-h-11 cursor-pointer items-center rounded-md border border-border px-4 text-sm font-semibold text-text hover:bg-surface peer-focus-visible/folder:outline peer-focus-visible/folder:outline-2 peer-focus-visible/folder:outline-primary">Chọn cả thư mục</label>
          </div>
          {selectedFiles.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md bg-muted p-3">
            <span className="text-sm font-medium">Đã chọn {selectedFiles.length} file</span>
            <button type="button" disabled={!canUpload || busy} onClick={() => void uploadFiles()}
              className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{detail ? 'Tải thêm file' : 'Tải file và bắt đầu'}</button>
          </div>}
          {progress && <p role="status" className="mt-3 text-sm">{progress}</p>}
          <p className="mt-3 text-xs text-muted-foreground">Tối đa 500 file mỗi lượt, 25 MB mỗi file. Tên file và thư mục giúp hệ thống tìm mã sản phẩm.</p>
        </>}
        {detail && ['open', 'partially_applied'].includes(detail.batch.status) && <details className="mt-4 border-t border-border pt-3 text-sm">
          <summary className="cursor-pointer font-medium text-primary">Dùng file đã có trong Kho tệp</summary>
          <div className="mt-3 flex gap-2">
            <input aria-label="Tìm file trong Kho tệp" value={existingQuery} onChange={(event) => setExistingQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void searchExisting(); }}
              className="min-w-0 h-11 flex-1 rounded-md border border-border bg-panel px-3" placeholder="Nhập tên file" />
            <button type="button" disabled={busy || existingQuery.trim().length < 2} onClick={() => void searchExisting()}
              className="min-h-11 rounded-md border border-border px-4 disabled:opacity-50">Tìm</button>
          </div>
          {existingFiles.map((file) => <div key={file.id} className="mt-2 flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
            <span className="min-w-0 break-all">{file.original_filename}</span>
            <button type="button" disabled={!canUpload || busy} onClick={() => void addExisting(file.id)} className="shrink-0 font-medium text-primary disabled:opacity-50">Thêm</button>
          </div>)}
        </details>}
      </details>}

      <div className="space-y-5">
        {detail && hasFiles && <>
          {counts.total > 0 && <details open={Boolean(detail.batch.import_batch_id) && detail.items.every((item) => item.status === 'pending')} className="border-b border-border pb-3">
            <summary className="cursor-pointer py-2 text-sm font-semibold text-primary">Đối chiếu và đọc nội dung{unreadCount ? ` · ${unreadCount} file chưa đọc` : ''}</summary>
            <p className="mt-3 text-sm text-muted-foreground">{detail.batch.import_batch_id ? 'Sau khi lô Excel đã được áp dụng, hãy đối chiếu file với sản phẩm vừa nhập và cho robot đọc nội dung khi cần.' : 'Khi gửi, hệ thống tìm mã trong tên file/thư mục. Kể cả file có một gợi ý, bạn có thể cho robot đọc nội dung để kiểm tra thêm.'}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {unreadCount > 0 && <button type="button" disabled={!localAi?.available || busy} onClick={() => void analyzeManyLocally()}
                className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Robot đọc {Math.min(unreadCount, 10)} file chưa phân tích</button>}
              <button type="button" disabled={busy || !['open', 'partially_applied'].includes(detail.batch.status)} onClick={() => void analyze()}
                className="min-h-11 rounded-md border border-border px-4 py-2 text-sm font-medium text-text disabled:opacity-50">Đối chiếu nhanh theo tên file</button>
            </div>
            {unreadCount > 0 && !localAi?.available && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-warning">
              <span>Robot chưa kết nối. Vẫn có thể đối chiếu theo tên file hoặc chọn sản phẩm thủ công.</span>
              <button type="button" onClick={() => void refreshLocalAi()} className="font-semibold text-primary underline">Kiểm tra lại robot</button>
            </div>}
            {aiProgress && <p role="status" className="mt-3 text-sm">{aiProgress}</p>}
          </details>}

          {counts.total > 0 && <section className="space-y-3">
            <div><h2 className="text-lg font-semibold text-text">Kiểm tra từng file</h2>
              <p className="mt-1 text-sm text-muted-foreground">Chọn file trong danh sách để xem ảnh/PDF, lý do gợi ý và quyết định gán.</p></div>
            <div className="grid overflow-hidden rounded-xl border border-border bg-panel lg:grid-cols-[280px_minmax(0,1fr)]">
              <nav aria-label="Danh sách file cần duyệt" className="max-h-60 overflow-y-auto border-b border-border bg-[#f8fafc] lg:max-h-[760px] lg:border-b-0 lg:border-r">
                <div className="sticky top-0 border-b border-border bg-[#f8fafc] px-4 py-3 text-xs font-semibold text-muted-foreground">{counts.total} file trong lượt này</div>
                {detail.items.map((item) => {
                  const active = selectedItem?.id === item.id;
                  const filename = item.source_path.split('/').at(-1) ?? item.source_path;
                  return <button key={item.id} type="button" onClick={() => setSelectedItemId(item.id)} aria-current={active ? 'true' : undefined}
                    className={'flex w-full items-start gap-3 border-b border-border/70 px-4 py-3 text-left transition-colors hover:bg-[#edf4f8] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ' + (active ? 'bg-[#e9f2f8]' : '')}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-panel text-[10px] font-bold text-primary">{item.mime_type.startsWith('image/') ? 'ẢNH' : 'PDF'}</span>
                    <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold text-text" title={item.source_path}>{filename}</strong>
                      <small className="mt-1 block text-xs text-muted-foreground">{itemStatusLabels[item.status]}{item.candidates.length === 1 ? ' · ' + item.candidates[0].groupName : ''}</small></span>
                  </button>;
                })}
              </nav>
              <div className="min-w-0 p-4 md:p-5">
                {selectedItem && <MediaItemCard key={selectedItem.id} item={selectedItem} embedded
                  canConfirm={selectedItem.mime_type.startsWith('image/') ? canAttachImage : canAttachDocument}
                  canAnalyzeLocally={Boolean(localAi?.available) && ['pending', 'suggested', 'unmatched'].includes(selectedItem.status) && !selectedItem.local_analysis && selectedItem.mime_type !== 'image/svg+xml'}
                  busy={busy} onConfirm={confirmItem} onAnalyzeLocally={analyzeLocally} />}
              </div>
            </div>
          </section>}

          {counts.total > 0 && <details open={counts.confirmed > 0 || counts.unresolved === 0} className="rounded-lg border border-border bg-panel p-4 md:p-5">
            <summary className="cursor-pointer text-lg font-semibold text-text">Áp dụng các file đã xác nhận</summary>
            <p className="mt-3 text-sm text-muted-foreground">{detail.batch.status === 'applied' ? 'Đã hoàn tất. Kết quả gán file nằm ở danh sách phía trên.' : 'Chỉ những file đã xác nhận mới được gán vào sản phẩm. ' + counts.confirmed + ' file đang chờ áp dụng.'}</p>
            {detail.batch.status !== 'applied' && <button type="button" disabled={busy || (counts.confirmed === 0 && counts.skipped === 0) || detail.items.some((item) => item.status === 'confirmed' && !(item.mime_type.startsWith('image/') ? canAttachImage : canAttachDocument))} onClick={() => void applyBatch()}
              className="mt-4 min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{counts.confirmed ? 'Áp dụng ' + counts.confirmed + ' file đã xác nhận' : 'Chưa có file nào để áp dụng'}</button>}
            {counts.confirmed > 0 && !auth.roles.includes('super_admin') && detail.items.some((item) => item.status === 'confirmed' && item.mime_type.startsWith('image/')) &&
              <p className="mt-3 text-xs text-muted-foreground">Gắn ảnh vào sản phẩm công khai có thể đưa sản phẩm về chờ duyệt theo quy trình hiện tại.</p>}
            {counts.confirmed > 0 && detail.items.some((item) => item.status === 'confirmed' && item.mime_type === 'application/pdf') &&
              <p className="mt-3 text-xs text-muted-foreground">PDF mới ở trạng thái riêng tư; cần duyệt riêng để hiển thị trên website.</p>}
          </details>}
        </>}
      </div>
      {visibleBatches.length > 0 && <details className="rounded-lg border border-border bg-panel p-4">
        <summary className="cursor-pointer font-semibold text-text">Tiếp tục lượt đã lưu</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{visibleBatches.map((batch) => <button type="button" key={batch.id} onClick={() => void openBatch(batch.id)}
          className={'rounded-md border px-3 py-2 text-left text-sm ' + (detail?.batch.id === batch.id ? 'border-primary bg-muted' : 'border-border hover:bg-muted')}>
          <span className="block font-medium">{mediaBatchLabel(batch)}</span>
          <span className="text-xs text-muted-foreground">{batch.item_count ?? 0} file</span>
        </button>)}</div>
      </details>}
    </section>
  </main>;
}
