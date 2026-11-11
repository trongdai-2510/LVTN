'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { PERMISSIONS } from '@/lib/permissions';
import { AssistantMascot, type MascotState } from './AssistantMascot';
import { mediaBatchLabel } from './mediaBatchLabel';
import { MEDIA_ASSISTANT_OPEN_EVENT, MEDIA_BATCH_SELECTED_EVENT, MEDIA_BATCH_SELECTION_KEY, MEDIA_BATCH_UPDATED_EVENT,
  type AssistantAnswer, type LocalAiStatus, type MediaBatch, type MediaBatchDetail } from './mediaAssistantTypes';
import { uploadMediaFiles } from './uploadMediaFiles';
import styles from './mediaAssistant.module.css';

const batchEndpoint = endpoints.songThanh.mediaBatches;
type ProjectAnswer = { answer: string; model: string; products?: Array<{ id: string; name: string }> };
type ChatMessage = { id: number; role: 'user' | 'assistant'; text: string; scope?: 'project' | 'batch'; references?: string[]; products?: ProjectAnswer['products']; illustration?: 'happy' | 'error' };

function describeEvidence(source: 'filename' | 'folder' | 'content'): string {
  return source === 'content' ? 'nội dung file AI đọc' : source === 'folder' ? 'tên thư mục' : 'tên file';
}

function importIdFromPage(): string {
  const queryId = new URLSearchParams(window.location.search).get('import_batch_id');
  if (queryId) return queryId;
  return window.location.pathname.match(/\/admin\/import\/([0-9a-f-]{36})\/?$/i)?.[1] ?? '';
}

export function FloatingMediaAssistant({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const allowed = [PERMISSIONS.productGroupRead, PERMISSIONS.productVariantRead, PERMISSIONS.fileRead]
    .every((permission) => permissions.includes(permission));
  const canUpload = permissions.includes(PERMISSIONS.fileCreate);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [batches, setBatches] = useState<MediaBatch[]>([]);
  const [detail, setDetail] = useState<MediaBatchDetail | null>(null);
  const [status, setStatus] = useState<LocalAiStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [questionScope, setQuestionScope] = useState<'project' | 'batch'>('project');
  const [robotState, setRobotState] = useState<MascotState>('idle');
  const [launcherActive, setLauncherActive] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageId = useRef(0);

  function append(role: ChatMessage['role'], text: string, extra: Partial<ChatMessage> = {}) {
    setMessages((current) => [...current, { id: ++messageId.current, role, text, ...extra }]);
  }

  useEffect(() => {
    if (!open || !allowed) return;
    let current = true;
    setLoading(true);
    setError('');
    void Promise.all([
      apiClient.get<{ items: MediaBatch[] }>(batchEndpoint),
      apiClient.get<LocalAiStatus>(`${batchEndpoint}/local-ai/status`)
    ]).then(async ([list, aiStatus]) => {
      if (!current) return;
      const available = list.items ?? [];
      setBatches(available);
      setStatus(aiStatus);
      const importBatchId = importIdFromPage();
      const remembered = window.sessionStorage.getItem(MEDIA_BATCH_SELECTION_KEY);
      const selected = importBatchId
        ? available.find((batch) => batch.import_batch_id === importBatchId && (batch.item_count ?? 0) > 0)
        : available.find((batch) => batch.id === remembered);
      if (selected) {
        const selectedDetail = await apiClient.get<MediaBatchDetail>(`${batchEndpoint}/${selected.id}`);
        if (current) {
          setDetail(selectedDetail);
          setQuestionScope(selectedDetail.items.length ? 'batch' : 'project');
        }
      } else if (current) {
        setDetail(null);
        setQuestionScope('project');
      }
    }).catch((cause) => {
      if (current) setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu trợ lý.');
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [open, allowed]);

  useEffect(() => { if (open) closeRef.current?.focus(); }, [open]);
  useEffect(() => { if (open && (messages.length > 0 || progress || busy)) bottomRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length, progress, busy]);
  useEffect(() => {
    if (!['speaking', 'happy', 'error'].includes(robotState)) return;
    const timeout = window.setTimeout(() => setRobotState(questionRef.current === document.activeElement ? 'listening' : 'idle'), robotState === 'error' ? 3200 : 2400);
    return () => window.clearTimeout(timeout);
  }, [robotState]);
  useEffect(() => {
    const onOpen = () => { setLoading(true); setOpen(true); };
    window.addEventListener(MEDIA_ASSISTANT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(MEDIA_ASSISTANT_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    function onSelection(event: Event) {
      const id = (event as CustomEvent<string>).detail;
      if (!open || busy) return;
      if (!id) {
        setDetail(null);
        setQuestionScope('project');
        setMessages([]);
        return;
      }
      void apiClient.get<MediaBatchDetail>(`${batchEndpoint}/${id}`).then((selected) => {
        setDetail(selected);
        setQuestionScope(selected.items.length ? 'batch' : 'project');
        setMessages([]);
      }).catch(() => undefined);
    }
    function onUpdate(event: Event) {
      const id = (event as CustomEvent<string>).detail;
      if (!id || !open || busy || id !== detail?.batch.id) return;
      void apiClient.get<MediaBatchDetail>(`${batchEndpoint}/${id}`).then(setDetail).catch(() => undefined);
    }
    window.addEventListener(MEDIA_BATCH_SELECTED_EVENT, onSelection);
    window.addEventListener(MEDIA_BATCH_UPDATED_EVENT, onUpdate);
    return () => {
      window.removeEventListener(MEDIA_BATCH_SELECTED_EVENT, onSelection);
      window.removeEventListener(MEDIA_BATCH_UPDATED_EVENT, onUpdate);
    };
  }, [open, busy, detail?.batch.id]);

  function close() {
    setOpen(false);
    setExpanded(false);
    setRobotState('idle');
    requestAnimationFrame(() => (toggleRef.current ?? document.querySelector<HTMLButtonElement>('[data-media-assistant-trigger]'))?.focus());
  }

  async function refreshStatus() {
    try { setStatus(await apiClient.get<LocalAiStatus>(`${batchEndpoint}/local-ai/status`)); }
    catch { setStatus({ available: false, busy: false, model: 'qwen3-vl:2b-instruct', locality: 'localhost', message: 'Không kết nối được AI cục bộ.' }); }
  }

  async function chooseBatch(id: string) {
    if (busy) return;
    if (!id) {
      setDetail(null);
      setQuestionScope('project');
      setMessages([]);
      window.sessionStorage.removeItem(MEDIA_BATCH_SELECTION_KEY);
      window.dispatchEvent(new CustomEvent(MEDIA_BATCH_SELECTED_EVENT, { detail: '' }));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const selected = await apiClient.get<MediaBatchDetail>(`${batchEndpoint}/${id}`);
      setDetail(selected);
      setQuestionScope(selected.items.length ? 'batch' : 'project');
      setMessages([]);
      window.sessionStorage.setItem(MEDIA_BATCH_SELECTION_KEY, id);
      window.dispatchEvent(new CustomEvent(MEDIA_BATCH_SELECTED_EVENT, { detail: id }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không mở được lượt ảnh/PDF.');
    } finally { setBusy(false); }
  }

  async function ask(text: string, scope = questionScope) {
    const prompt = text.trim();
    if (!prompt || busy) return;
    const history = messages.filter((message) => message.scope === scope)
      .slice(-6).map(({ role, text }) => ({ role, text: text.slice(0, 1000) }));
    append('user', prompt, { scope });
    setQuestion('');
    setBusy(true);
    setError('');
    setRobotState('thinking');
    try {
      if (scope === 'batch' && detail?.items.length) {
        const focus = [...messages].reverse().find((message) => message.scope === 'batch' && message.role === 'assistant')?.references?.slice(0, 3) ?? [];
        const result = await apiClient.post<AssistantAnswer>(`${batchEndpoint}/${detail.batch.id}/ask`, { question: prompt, focus_item_ids: focus, history });
        append('assistant', result.answer, { scope, references: result.referenced_item_ids });
      } else {
        const result = await apiClient.post<ProjectAnswer>(`${batchEndpoint}/assistant/ask`, { question: prompt, history });
        append('assistant', result.answer, { scope, products: result.products });
      }
      setRobotState('speaking');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Robot chưa trả lời được.');
      setRobotState('error');
    } finally { setBusy(false); }
  }

  async function intake(files: File[]) {
    if (!files.length || !canUpload || busy || loading) return;
    append('user', `Mình gửi ${files.length} ảnh/PDF để tìm sản phẩm.`);
    setBusy(true);
    setError('');
    setRobotState('thinking');
    try {
      const importBatchId = importIdFromPage();
      const currentBatch = detail && ['open', 'partially_applied'].includes(detail.batch.status) &&
        (!importBatchId || detail.batch.import_batch_id === importBatchId) ? detail : null;
      const result = await uploadMediaFiles({ files, currentBatch, importBatchId,
        onProgress: (text) => {
          setProgress(text);
          if (text.startsWith('Đang tải file')) setRobotState('working');
          else if (text.startsWith('Đang tìm sản phẩm')) setRobotState('searching');
          else if (text.startsWith('Robot đang đọc')) setRobotState('thinking');
        },
        onBatchCreated: (created) => {
          setDetail(created);
          setQuestionScope('batch');
          window.sessionStorage.setItem(MEDIA_BATCH_SELECTION_KEY, created.batch.id);
        },
        onDetail: setDetail
      });
      setDetail(result.detail);
      setQuestionScope('batch');
      void apiClient.get<{ items: MediaBatch[] }>(batchEndpoint).then((list) => setBatches(list.items ?? [])).catch(() => undefined);
      if (result.aiStatus) setStatus(result.aiStatus);
      window.sessionStorage.setItem(MEDIA_BATCH_SELECTION_KEY, result.detail.batch.id);
      window.dispatchEvent(new CustomEvent(MEDIA_BATCH_SELECTED_EVENT, { detail: result.detail.batch.id }));
      if (result.detail.batch.import_batch_id) {
        append('assistant', `Đã nhận ${result.added} file cho lô Excel này. Hãy áp dụng lô Excel trước; sau đó quay lại lượt ảnh/PDF để robot đối chiếu với sản phẩm vừa nhập.${result.failures.length ? ` Có lỗi: ${result.failures.slice(0, 2).join('; ')}` : ''}`, { scope: 'batch' });
      } else {
        const unclear = result.detail.items.filter((item) => ['pending', 'unmatched', 'failed'].includes(item.status) || item.candidates.length > 1).length;
        const unread = result.detail.items.filter((item) => ['pending', 'suggested', 'unmatched'].includes(item.status)
          && !item.local_analysis && item.mime_type !== 'image/svg+xml').length;
        const summary = [
          `Đã nhận ${result.added} file${result.matched ? `, tìm được gợi ý cho ${result.matched} file` : ''}.`,
          result.aiRead ? `Mình đã đọc nội dung ${result.aiRead} file để kiểm tra mã.` : '',
          result.aiStatus && !result.aiStatus.available ? 'AI chưa đọc nội dung file vì dịch vụ cục bộ chưa chạy; gợi ý hiện tại chỉ dựa vào tên file hoặc thư mục.' : '',
          result.aiStatus?.available && unread ? `Còn ${unread} file chưa được robot đọc nội dung; bấm “Robot đọc file tiếp” để kiểm tra.` : '',
          unclear ? `Còn ${unclear} file cần xem kỹ.` : '',
          result.addedItemIds.length > 3 ? 'Mình hiển thị 3 file đầu; mở bản duyệt để xem tất cả.'
            : result.addedItemIds.length ? 'Chọn file bên dưới để xem lý do và duyệt.' : 'Mở bản duyệt để kiểm tra từng file.',
          result.failures.length ? `Có lỗi: ${result.failures.slice(0, 2).join('; ')}` : ''
        ].filter(Boolean).join(' ');
        append('assistant', summary, { scope: 'batch', references: result.addedItemIds.slice(0, 3), illustration: result.failures.length ? 'error' : 'happy' });
      }
      setRobotState(result.failures.length ? 'error' : 'happy');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không nhận được file.');
      setRobotState('error');
    } finally { setBusy(false); setProgress(''); }
  }

  async function analyzeMany() {
    if (!detail || !status?.available || busy) return;
    const eligible = detail.items.filter((item) =>
      ['pending', 'suggested', 'unmatched'].includes(item.status) && !item.local_analysis && item.mime_type !== 'image/svg+xml'
    ).slice(0, 5);
    if (!eligible.length) return;
    setBusy(true);
    setError('');
    setRobotState('thinking');
    let completed = 0;
    for (const [index, item] of eligible.entries()) {
      setProgress(`Đang đọc ${index + 1}/${eligible.length}: ${item.source_path}`);
      try {
        setDetail(await apiClient.post<MediaBatchDetail>(`${batchEndpoint}/${detail.batch.id}/items/${item.id}/analyze-local`));
        completed += 1;
      } catch { /* The remaining files can be retried from the same conversation. */ }
    }
    window.dispatchEvent(new CustomEvent(MEDIA_BATCH_UPDATED_EVENT, { detail: detail.batch.id }));
    append('assistant', `AI đã đọc ${completed}/${eligible.length} file. Hãy xem phần gợi ý trước khi xác nhận.`, { scope: 'batch' });
    setProgress('');
    setBusy(false);
    setRobotState(completed ? 'happy' : 'error');
    await refreshStatus();
  }

  if (!allowed) return null;
  const unresolved = detail?.items.filter((item) => ['pending', 'suggested', 'unmatched', 'failed'].includes(item.status)) ?? [];
  const unread = unresolved.filter((item) => !item.local_analysis && item.mime_type !== 'image/svg+xml');
  const usableBatches = batches.filter((batch) => (batch.item_count ?? 0) > 0);
  const quickQuestions = questionScope === 'batch' && detail?.items.length
    ? ['Tóm tắt lượt này', 'File nào cần xử lý trước?', 'File nào chưa rõ sản phẩm?', 'Có mã nào mâu thuẫn không?']
    : ['Sản phẩm nào thiếu ảnh?', 'Sản phẩm nào thiếu tài liệu kỹ thuật?'];
  const latestAssistantId = [...messages].reverse().find((message) => message.role === 'assistant')?.id;
  const onImportDetail = /\/import\/[0-9a-f-]{36}\/?$/i.test(pathname ?? '');
  const welcomeTitle = detail?.items.length
    ? unresolved.length ? `Mình thấy ${unresolved.length} file cần bạn xem.` : 'Lượt file này đã xử lý xong.'
    : onImportDetail ? 'Mình xem ảnh/PDF cho lô Excel này.' : 'Chào bạn, mình là Songbot.';
  const welcomeDescription = detail?.items.length
    ? 'Bạn có thể hỏi file nào cần xử lý trước, hoặc mở từng gợi ý để duyệt.'
    : onImportDetail ? 'Gửi file tại đây. Mình sẽ tìm sản phẩm từ dữ liệu đã nhập và nêu chỗ chưa chắc chắn.'
      : 'Bạn hỏi về sản phẩm hoặc gửi ảnh/PDF. Mình tìm trong dữ liệu Song Thanh và nêu lý do cho từng gợi ý.';
  const activityTitle = robotState === 'working' ? 'Mình đang nhận file'
    : robotState === 'searching' ? 'Mình đang tìm mã sản phẩm'
      : robotState === 'thinking' ? 'Mình đang đọc và đối chiếu' : 'Mình đang xử lý';

  return <>
    {open && <section id="floating-media-assistant" role="dialog" aria-label="Trợ lý sản phẩm" aria-modal="false" data-robot-state={robotState} data-mode={messages.length ? 'conversation' : 'welcome'} data-has-batch={Boolean(detail?.items.length)} data-expanded={expanded} data-dragging={dragging}
      onKeyDown={(event) => { if (event.key === 'Escape') close(); }} className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <h2>Songbot <span>Trợ lý sản phẩm</span></h2>
          <span className={styles.eyebrow}><i className={`${styles.statusDot} ${status?.available ? styles.statusDotOnline : ''}`} aria-hidden="true" />{busy ? activityTitle : loading ? 'Đang kết nối…' : status?.available ? 'Sẵn sàng đọc ảnh và PDF' : 'Tra sản phẩm đang sẵn sàng'}</span>
        </div>
        {(messages.length > 0 || Boolean(detail?.items.length)) && <button type="button" onClick={() => setExpanded((current) => !current)} aria-label={expanded ? 'Thu gọn trợ lý' : 'Mở rộng trợ lý'} aria-pressed={expanded} className={styles.expand}>
          {expanded ? <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 4v4H4m12 12v-4h4M4 8l5 5m11 3-5-5" /></svg>
            : <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10V4h6m10 10v6h-6M4 4l6 6m10 10-6-6" /></svg>}
        </button>}
        <button ref={closeRef} type="button" onClick={close} aria-label="Đóng trợ lý" className={styles.close}>×</button>
      </header>

      {detail && detail.items.length > 0 && <div className={styles.batch}>
        <div><span className={styles.batchLabel}>Lượt file đang xem</span><strong title={mediaBatchLabel(detail.batch)}>{mediaBatchLabel(detail.batch)}</strong>
          <span>{detail.items.length} file · {unresolved.length} cần xem</span></div>
        <Link href="/media" onClick={close}>Duyệt file</Link>
      </div>}

      <div className={styles.body} onDragOver={(event) => event.preventDefault()}
        onDragEnter={(event) => { if (event.dataTransfer.types.includes('Files')) setDragging(true); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); if (canUpload) void intake(Array.from(event.dataTransfer.files)); }}>
        {dragging && <div className={styles.dropHint}>Thả ảnh hoặc PDF để mình bắt đầu</div>}
        {loading && messages.length === 0 && <div className={styles.loadingState} role="status">
          <AssistantMascot state="thinking" size={72} label="Robot trợ lý" />
          <span>Mình đang kiểm tra dữ liệu sản phẩm và các file gần đây…</span>
        </div>}
        {!loading && messages.length === 0 && <div className={styles.welcome}>
          <span className={styles.welcomeRobot}><AssistantMascot state={robotState} size={78} label="Robot trợ lý" /></span>
          <div className={styles.welcomeCopy}>
            <span className={styles.welcomeByline}>Songbot</span>
            <h3>{welcomeTitle}</h3>
            <p className={styles.welcomeDescription}>{welcomeDescription}</p>
            {!status?.available && !loading && <><p className={styles.offlineNote}>AI chưa đọc nội dung ảnh/PDF. Mình vẫn có thể tra dữ liệu sản phẩm và đối chiếu mã trong tên file.</p>
              <button type="button" className={styles.statusRetry} onClick={() => void refreshStatus()}>Kiểm tra lại AI đọc file</button></>}
          </div>
        </div>}

        {usableBatches.length > 0 && <details className={styles.switchBatch}>
          <summary>{detail?.items.length ? 'Đổi lượt đang hỗ trợ' : 'Lượt file đã lưu'}</summary>
          <select aria-label="Chọn lượt ảnh/PDF" value={detail?.batch.id ?? ''} onChange={(event) => void chooseBatch(event.target.value)} disabled={busy}>
            <option value="">Lượt mới · hỏi dữ liệu sản phẩm</option>
            {usableBatches.map((batch) => <option key={batch.id} value={batch.id}>{mediaBatchLabel(batch)} · {batch.item_count ?? 0} file</option>)}
          </select>
        </details>}

        {messages.map((message) => <div key={message.id} className={`${styles.message} ${message.role === 'user' ? styles.userMessage : styles.assistantMessage} ${message.illustration ? styles.resultMessage : ''}`}>
          {message.illustration ? <div className={styles.resultIntro}>
            <span className={styles.resultRobot}><AssistantMascot state={message.id === latestAssistantId ? robotState : message.illustration} size={52} paused={busy || message.id !== latestAssistantId} /></span>
            <strong>{message.illustration === 'happy' ? 'Mình đã chuẩn bị gợi ý' : 'Mình đã nhận file, có chỗ cần xem lại'}</strong>
          </div> : message.role === 'assistant' ? <div className={styles.messageByline}>
            <AssistantMascot state="idle" size={42} paused />
            <span className={styles.messageAuthor}>Songbot</span>
          </div> : null}
          <p>{message.text}</p>
          {message.references?.length ? <div className={styles.referenceList}>
            {message.references.map((id) => {
              const item = detail?.items.find((entry) => entry.id === id);
              const candidate = item?.candidates.length === 1 ? item.candidates[0] : null;
              return <Link key={id} href={`/media?batch_id=${detail?.batch.id ?? ''}&item_id=${id}`} onClick={close} className={styles.referenceItem}>
                <strong>{item?.source_path.split('/').at(-1) ?? id}</strong>
                <span>{candidate ? `${candidate.groupName}${candidate.variantName && candidate.variantName !== candidate.groupName ? ` · ${candidate.variantName}` : ''}` : item?.candidates.length ? 'Nhiều sản phẩm có thể khớp' : 'Cần chọn sản phẩm'}</span>
                {candidate?.evidence.length ? <small>{[...new Set(candidate.evidence.map((entry) => `${entry.value} từ ${describeEvidence(entry.source)}`))].join(' · ')}</small> : null}
              </Link>;
            })}
          </div> : null}
          {message.products?.length ? <div className={styles.products}>{message.products.map((product) => <Link key={product.id} href={`/product-groups/${product.id}`} onClick={close}>{product.name}</Link>)}</div> : null}
        </div>)}
        {busy && <div role="status" className={styles.activity}>
          <span className={styles.activityRobot}><AssistantMascot state={robotState} size={64} /></span>
          <span className={styles.activityCopy}><strong>{activityTitle}</strong><small>{progress || 'Mình đang tra dữ liệu trong project.'}</small></span>
          <span className={styles.activityDots} aria-hidden="true"><i /><i /><i /></span>
        </div>}
        {error && <p role="alert" className={styles.error}>{error}</p>}

        {!loading && !busy && (messages.length === 0 || unread.length > 0) && <div className={styles.suggestions}>
          {messages.length === 0 && <span className={styles.suggestionLabel}>Thử hỏi mình</span>}
          {messages.length === 0 && quickQuestions.map((prompt) => <button type="button" key={prompt} onClick={() => void ask(prompt, questionScope)}>{prompt}</button>)}
          {unread.length > 0 && status?.available && <button type="button" className={styles.analyzePrompt} onClick={() => void analyzeMany()}>Robot đọc {Math.min(unread.length, 5)} file tiếp</button>}
        </div>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={(event) => { event.preventDefault(); void ask(question); }} className={styles.composer}>
        {Boolean(detail?.items.length) && <div className={styles.questionScope} role="group" aria-label="Phạm vi câu hỏi">
          <span>Hỏi về</span>
          <button type="button" aria-pressed={questionScope === 'project'} onClick={() => setQuestionScope('project')} disabled={busy}>Sản phẩm</button>
          <button type="button" aria-pressed={questionScope === 'batch'} onClick={() => setQuestionScope('batch')} disabled={busy}>File đang xem</button>
        </div>}
        <input ref={fileRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.svg,.pdf" className="sr-only" aria-label="Tệp ảnh hoặc PDF"
          onChange={(event) => { void intake(Array.from(event.target.files ?? [])); event.currentTarget.value = ''; }} />
        <input ref={(element) => { folderRef.current = element; if (element) element.setAttribute('webkitdirectory', ''); }} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.svg,.pdf" className="sr-only" aria-label="Chọn thư mục ảnh hoặc PDF"
          onChange={(event) => { void intake(Array.from(event.target.files ?? [])); event.currentTarget.value = ''; }} />
        <div className={styles.composerField}>
          <label htmlFor="floating-media-question" className="sr-only">Hỏi trợ lý sản phẩm</label>
          <textarea ref={questionRef} id="floating-media-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} rows={1}
            onFocus={() => { if (!busy) setRobotState('listening'); }}
            onBlur={() => setRobotState((current) => current === 'listening' ? 'idle' : current)}
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void ask(question); } }}
            disabled={busy || loading} placeholder="Hỏi Songbot về sản phẩm hoặc file…" />
          <div className={styles.composerActions}>
            <button type="submit" aria-label="Gửi" disabled={busy || loading || !question.trim()} className={styles.send}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5m0 0L6 11m6-6 6 6" /></svg>
            </button>
          </div>
        </div>
        {canUpload && <div className={styles.composerTools}>
          <button type="button" className={styles.fileTool} disabled={busy || loading} onClick={() => fileRef.current?.click()}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m8 12.5 5.7-5.7a3.2 3.2 0 0 1 4.5 4.5l-8 8a5 5 0 0 1-7.1-7.1l8.2-8.2" /></svg>
            Chọn ảnh hoặc PDF
          </button>
          <button type="button" className={styles.fileTool} disabled={busy || loading} onClick={() => folderRef.current?.click()}>Chọn thư mục ảnh/PDF</button>
        </div>}
      </form>
    </section>}
    {!open && !pathname?.endsWith('/media') && <button ref={toggleRef} type="button" onClick={() => { setLoading(true); setOpen(true); }} aria-label="Mở trợ lý sản phẩm"
      onPointerEnter={() => setLauncherActive(true)} onPointerLeave={() => setLauncherActive(false)}
      onFocus={() => setLauncherActive(true)} onBlur={() => setLauncherActive(false)}
      aria-expanded={false} aria-controls="floating-media-assistant" data-active={launcherActive} className={styles.launcher}>
      <span className={styles.launcherCopy}><strong>{launcherActive ? 'Mình nghe đây' : 'Trợ lý AI'}</strong><small>Ảnh &amp; tài liệu</small></span>
      <span className={styles.launcherRobot}><AssistantMascot state={launcherActive ? 'listening' : robotState} size={86} /></span>
    </button>}
  </>;
}
