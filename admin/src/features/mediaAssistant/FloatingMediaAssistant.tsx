'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { PERMISSIONS } from '@/lib/permissions';
import { AssistantMascot, type MascotState } from './AssistantMascot';
import { MediaItemCard } from './MediaItemCard';
import { mediaBatchLabel } from './mediaBatchLabel';
import { isAssignmentRequest, meansAllFiles, mentionedFile, normalizeTaskText, requestedProduct, targetFromCandidates, targetFromSearch, taskIsCurrent, type MediaTask, type ProductMatch } from './mediaTask';
import { MEDIA_ASSISTANT_OPEN_EVENT, MEDIA_BATCH_SELECTED_EVENT, MEDIA_BATCH_SELECTION_KEY, MEDIA_BATCH_UPDATED_EVENT,
  type AssistantAnswer, type LocalAiStatus, type MediaAttachment, type MediaBatch, type MediaBatchDetail } from './mediaAssistantTypes';
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
  const [reviewItemId, setReviewItemId] = useState('');
  const [question, setQuestion] = useState('');
  const [pendingItemIds, setPendingItemIds] = useState<string[]>([]);
  const [pendingInstruction, setPendingInstruction] = useState('');
  const [proposedTasks, setProposedTasks] = useState<MediaTask[]>([]);
  const [proposalBatchId, setProposalBatchId] = useState('');
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
  const bodyRef = useRef<HTMLDivElement>(null);
  const reviewBackRef = useRef<HTMLButtonElement>(null);
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
  useEffect(() => {
    if (!open || !reviewItemId) return;
    bodyRef.current?.scrollTo({ top: 0 });
    reviewBackRef.current?.focus();
  }, [open, reviewItemId]);
  useEffect(() => { if (open && !reviewItemId && (messages.length > 0 || progress || busy)) bottomRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length, progress, busy, reviewItemId, open]);
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
        setReviewItemId('');
        setQuestionScope('project');
        setMessages([]);
        setPendingItemIds([]);
        setPendingInstruction('');
        setProposedTasks([]);
        return;
      }
      void apiClient.get<MediaBatchDetail>(`${batchEndpoint}/${id}`).then((selected) => {
        setDetail(selected);
        setReviewItemId('');
        setQuestionScope(selected.items.length ? 'batch' : 'project');
        setMessages([]);
        setPendingItemIds([]);
        setPendingInstruction('');
        setProposedTasks([]);
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

  async function ask(text: string, scope = questionScope) {
    const prompt = text.trim();
    if (!prompt || busy) return;
    if (/^(?:ok|oke|duoc|da|vang|uh|um)$/.test(normalizeTaskText(prompt)) && (pendingItemIds.length || proposedTasks.length)) {
      append('user', prompt, { scope: 'batch' });
      setQuestion('');
      append('assistant', proposedTasks.length
        ? 'Mình đã chuẩn bị đích gán ở trên. Nếu đúng, bạn bấm “Đồng ý gán file”; mình sẽ thực hiện ngay.'
        : 'Mình đang đợi mã model hoặc tên sản phẩm cho file vừa gửi. Bạn gửi mã/tên đó, mình sẽ chuẩn bị việc gán.', { scope: 'batch' });
      return;
    }
    const taskReply = pendingItemIds.length > 0 && !/[?？]/.test(prompt) && !/^(vì sao|vi sao|còn|con|bao nhiêu|bao nhieu)/i.test(prompt);
    if (isAssignmentRequest(prompt) || taskReply) {
      append('user', prompt, { scope: 'batch' });
      setQuestion('');
      if (!detail?.items.length) {
        setPendingInstruction(prompt);
        append('assistant', 'Mình đã ghi nhớ sản phẩm bạn dặn. Bạn gửi ảnh/PDF vào đây, mình sẽ đối chiếu và đưa việc gán ra để bạn đồng ý.', { scope: 'batch' });
        return;
      }
      setBusy(true);
      setError('');
      setRobotState('searching');
      try {
        const selectable = detail.items.filter((item) => pendingItemIds.includes(item.id) && !['applied', 'skipped'].includes(item.status));
        await prepareTaskPlan(detail, selectable.length ? selectable.map((item) => item.id) : detail.items.filter((item) => !['applied', 'skipped'].includes(item.status)).map((item) => item.id), prompt);
        setRobotState('speaking');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Chưa tìm được sản phẩm đích.');
        setRobotState('error');
      } finally { setBusy(false); }
      return;
    }
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

  async function prepareTaskPlan(batch: MediaBatchDetail, ids: string[], instruction: string) {
    const items = batch.items.filter((item) => ids.includes(item.id) && !['applied', 'skipped'].includes(item.status));
    if (!items.length) {
      append('assistant', 'Lượt này chưa có file nào cần gán. Bạn gửi ảnh hoặc PDF vào khung chat nhé.', { scope: 'batch' });
      return;
    }
    const namedFile = mentionedFile(items, instruction);
    if (instruction && items.length > 1 && !meansAllFiles(instruction) && !namedFile) {
      append('assistant', `Mình đang có ${items.length} file. Bạn nói rõ tên file cần gán, hoặc nói “gán tất cả file cho [mã/tên sản phẩm]” nhé.`, { scope: 'batch', references: items.slice(0, 3).map((item) => item.id) });
      return;
    }
    const chosen = namedFile ? [namedFile] : items;
    const hint = requestedProduct(instruction);
    let products: ProductMatch[] = [];
    if (hint && chosen.some((item) => !targetFromCandidates(item, hint))) {
      const params = new URLSearchParams({ q: hint, page: '1', page_size: '20', deleted_scope: 'active', status: 'active' });
      const result = await apiClient.get<{ items: ProductMatch[] }>(`${endpoints.songThanh.productGroups}?${params}`);
      products = result.items ?? [];
    }
    const tasks = chosen.map((item) => targetFromCandidates(item, hint) ?? targetFromSearch(item, hint, products)).filter((task): task is MediaTask => Boolean(task));
    const missing = chosen.filter((item) => !tasks.some((task) => task.itemId === item.id));
    const remaining = items.filter((item) => !chosen.some((entry) => entry.id === item.id));
    setPendingItemIds([...remaining, ...missing].map((item) => item.id));
    if (tasks.length) {
      const plan = proposalBatchId === batch.batch.id
        ? [...proposedTasks.filter((task) => !chosen.some((item) => item.id === task.itemId)), ...tasks] : tasks;
      setProposalBatchId(batch.batch.id);
      setProposedTasks(plan);
      append('assistant', `Mình chuẩn bị gán ${plan.length} file. Xem từng đích ở dưới rồi bấm Đồng ý; lúc đó mình sẽ gắn file vào sản phẩm cho bạn.${missing.length ? ` Còn ${missing.length} file chưa xác định được sản phẩm.` : ''}`, { scope: 'batch' });
    } else if (hint) {
      append('assistant', `Mình chưa tìm được đúng một sản phẩm “${hint}” trong project cho ${chosen.length === 1 ? chosen[0].source_path : `${chosen.length} file`}. Bạn gửi mã model hoặc tên sản phẩm chính xác hơn nhé.`, { scope: 'batch', references: chosen.slice(0, 3).map((item) => item.id) });
    } else {
      const observed = chosen.length === 1 ? chosen[0].local_analysis?.observed_codes ?? [] : [];
      const conflict = observed.length > 0 && chosen[0].candidates.length > 0;
      append('assistant', chosen.length === 1
        ? `Mình đã nhận ${chosen[0].source_path}.${conflict ? ` AI đọc thấy mã ${observed.join(', ')}, chưa khớp gợi ý từ tên file.` : ''} File này thuộc sản phẩm nào? Bạn trả lời bằng mã model hoặc tên sản phẩm; mình sẽ chuẩn bị việc gán cho bạn đồng ý.`
        : `Mình đã nhận ${chosen.length} file nhưng chưa tìm được đích gán chắc chắn. Bạn cho mình mã/tên sản phẩm và nói rõ file nào, hoặc “tất cả file”, nhé.`,
      { scope: 'batch', references: chosen.slice(0, 3).map((item) => item.id) });
    }
  }

  async function approveTaskPlan() {
    if (!detail || busy || proposalBatchId !== detail.batch.id || !proposedTasks.length) return;
    const tasks = proposedTasks.filter((task) => taskIsCurrent(task, detail));
    if (tasks.length !== proposedTasks.length) {
      setProposedTasks([]);
      setError('File đã thay đổi sau khi mình chuẩn bị. Hãy yêu cầu Songbot kiểm tra lại.');
      return;
    }
    setBusy(true);
    setError('');
    setRobotState('working');
    try {
      let latest = await apiClient.get<MediaBatchDetail>(`${batchEndpoint}/${detail.batch.id}`);
      if (tasks.some((task) => !taskIsCurrent(task, latest))) throw new Error('File đã thay đổi. Hãy xem lại trước khi gán.');
      if (latest.items.some((item) => item.status === 'confirmed' && !tasks.some((task) => task.itemId === item.id))) {
        throw new Error('Lượt này còn file đã xác nhận trước đó. Hãy áp dụng hoặc sửa các file đó trước khi đồng ý việc mới.');
      }
      for (const [index, task] of tasks.entries()) {
        setProgress(`Đang xác nhận ${index + 1}/${tasks.length}: ${task.fileName}`);
        latest = await apiClient.post<MediaBatchDetail>(`${batchEndpoint}/${detail.batch.id}/items/${task.itemId}/confirm`,
          { decision: { mode: 'attach', attachments: [task.attachment] } });
        setDetail(latest);
      }
      setProgress('Đang gắn file vào sản phẩm.');
      latest = await apiClient.post<MediaBatchDetail>(`${batchEndpoint}/${detail.batch.id}/apply`);
      setDetail(latest);
      window.dispatchEvent(new CustomEvent(MEDIA_BATCH_UPDATED_EVENT, { detail: detail.batch.id }));
      const applied = tasks.filter((task) => latest.items.find((item) => item.id === task.itemId)?.status === 'applied');
      setProposedTasks([]);
      setPendingItemIds((current) => current.filter((id) => !applied.some((task) => task.itemId === id)));
      append('assistant', applied.length === tasks.length
        ? `Xong rồi. Mình đã gán ${applied.length} file vào sản phẩm như bạn đồng ý.`
        : `Đã gán ${applied.length}/${tasks.length} file. ${tasks.length - applied.length} file chưa gán được; mình giữ lại để bạn xem lỗi và thử tiếp.`,
      { scope: 'batch', references: tasks.map((task) => task.itemId) });
      setRobotState(applied.length === tasks.length ? 'happy' : 'error');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa gán được file.');
      setRobotState('error');
    } finally { setBusy(false); setProgress(''); }
  }

  async function intake(files: File[]) {
    if (!files.length || !canUpload || busy || loading) return;
    const instruction = question.trim() || pendingInstruction;
    append('user', instruction ? `${instruction}\n${files.length} file đính kèm` : `Mình gửi ${files.length} ảnh/PDF để tìm sản phẩm.`);
    if (instruction) setQuestion('');
    setProposedTasks([]);
    setBusy(true);
    setError('');
    setRobotState('thinking');
    try {
      const importBatchId = importIdFromPage();
      const currentBatch = detail && !detail.items.some((item) => item.status === 'confirmed') && ['open', 'partially_applied'].includes(detail.batch.status) &&
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
      setPendingInstruction('');
      setReviewItemId('');
      setQuestionScope('batch');
      void apiClient.get<{ items: MediaBatch[] }>(batchEndpoint).then((list) => setBatches(list.items ?? [])).catch(() => undefined);
      if (result.aiStatus) setStatus(result.aiStatus);
      window.sessionStorage.setItem(MEDIA_BATCH_SELECTION_KEY, result.detail.batch.id);
      window.dispatchEvent(new CustomEvent(MEDIA_BATCH_SELECTED_EVENT, { detail: result.detail.batch.id }));
      if (result.detail.batch.import_batch_id) {
        setPendingItemIds([]);
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
          result.failures.length ? `Có lỗi: ${result.failures.slice(0, 2).join('; ')}` : ''
        ].filter(Boolean).join(' ');
        append('assistant', summary, { scope: 'batch', illustration: result.failures.length ? 'error' : 'happy' });
        await prepareTaskPlan(result.detail, result.addedItemIds, instruction);
      }
      setRobotState(result.failures.length ? 'error' : 'happy');
    } catch (cause) {
      if (instruction) setQuestion(instruction);
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

  async function analyzeOne(itemId: string) {
    if (!detail || !status?.available || busy) return;
    setBusy(true);
    setError('');
    setProgress('Mình đang đọc nội dung file để kiểm tra mã.');
    setRobotState('thinking');
    try {
      setDetail(await apiClient.post<MediaBatchDetail>(`${batchEndpoint}/${detail.batch.id}/items/${itemId}/analyze-local`));
      setProposedTasks([]);
      window.dispatchEvent(new CustomEvent(MEDIA_BATCH_UPDATED_EVENT, { detail: detail.batch.id }));
      setRobotState('happy');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa đọc được nội dung file.');
      setRobotState('error');
    } finally { setBusy(false); setProgress(''); }
  }

  async function confirmItem(itemId: string, decision: { mode: 'skip' | 'attach'; attachments?: MediaAttachment[] }) {
    if (!detail || busy) return;
    const item = detail.items.find((entry) => entry.id === itemId);
    const allowedToAttach = item?.mime_type.startsWith('image/')
      ? permissions.includes(PERMISSIONS.productGroupUpdate) : permissions.includes(PERMISSIONS.technicalDocumentCreate);
    if (!item || (decision.mode === 'attach' && !allowedToAttach)) {
      setError('Bạn chưa có quyền xác nhận file này.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      setDetail(await apiClient.post<MediaBatchDetail>(`${batchEndpoint}/${detail.batch.id}/items/${itemId}/confirm`, { decision }));
      setProposedTasks([]);
      window.dispatchEvent(new CustomEvent(MEDIA_BATCH_UPDATED_EVENT, { detail: detail.batch.id }));
      append('assistant', decision.mode === 'skip' ? 'Mình đã bỏ qua file này.' : 'Mình đã lưu quyết định. Bấm áp dụng để gắn file vào sản phẩm.', { scope: 'batch', references: [itemId] });
      setRobotState('happy');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa lưu được quyết định cho file.');
      setRobotState('error');
    } finally { setBusy(false); }
  }

  async function applyBatch() {
    if (!detail || busy) return;
    setBusy(true);
    setError('');
    setProgress('Mình đang gắn các file đã xác nhận vào sản phẩm.');
    setRobotState('working');
    try {
      const result = await apiClient.post<MediaBatchDetail>(`${batchEndpoint}/${detail.batch.id}/apply`);
      setDetail(result);
      setProposedTasks([]);
      window.dispatchEvent(new CustomEvent(MEDIA_BATCH_UPDATED_EVENT, { detail: detail.batch.id }));
      append('assistant', `Đã gán ${result.applied ?? 0} file vào sản phẩm.${result.errors?.length ? ` ${result.errors.length} file cần xem lại.` : ''}`, { scope: 'batch' });
      setRobotState(result.errors?.length ? 'error' : 'happy');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa áp dụng được các file đã xác nhận.');
      setRobotState('error');
    } finally { setBusy(false); setProgress(''); }
  }

  if (!allowed) return null;
  const reviewItem = detail?.items.find((item) => item.id === reviewItemId);
  const confirmedCount = detail?.items.filter((item) => item.status === 'confirmed').length ?? 0;
  const reviewCanConfirm = reviewItem?.mime_type.startsWith('image/')
    ? permissions.includes(PERMISSIONS.productGroupUpdate) : permissions.includes(PERMISSIONS.technicalDocumentCreate);
  const canApplyConfirmed = detail?.items.every((item) => item.status !== 'confirmed' ||
    (item.mime_type.startsWith('image/') ? permissions.includes(PERMISSIONS.productGroupUpdate)
      : permissions.includes(PERMISSIONS.technicalDocumentCreate))) ?? false;
  const proposedCurrent = proposalBatchId === detail?.batch.id ? proposedTasks.filter((task) => taskIsCurrent(task, detail)) : [];
  const otherConfirmed = detail?.items.filter((item) => item.status === 'confirmed' && !proposedCurrent.some((task) => task.itemId === item.id)).length ?? 0;
  const canApproveProposed = otherConfirmed === 0 && proposedCurrent.length === proposedTasks.length && proposedCurrent.every((task) =>
    permissions.includes(task.attachment.kind === 'image' ? PERMISSIONS.productGroupUpdate : PERMISSIONS.technicalDocumentCreate));
  const unresolved = detail?.items.filter((item) => ['pending', 'suggested', 'unmatched', 'failed'].includes(item.status)) ?? [];
  const unread = unresolved.filter((item) => !item.local_analysis && item.mime_type !== 'image/svg+xml');
  const usableBatches = batches.filter((batch) => (batch.item_count ?? 0) > 0);
  const latestAssistantId = [...messages].reverse().find((message) => message.role === 'assistant')?.id;
  const onImportDetail = /\/import\/[0-9a-f-]{36}\/?$/i.test(pathname ?? '');
  const welcomeTitle = detail?.items.length
    ? unresolved.length ? `Mình thấy ${unresolved.length} file cần bạn xem.` : 'Lượt file này đã xử lý xong.'
    : onImportDetail ? 'Mình xem ảnh/PDF cho lô Excel này.' : 'Chào bạn!';
  const welcomeDescription = detail?.items.length
    ? 'Bạn có thể hỏi file nào cần xử lý trước, hoặc mở từng gợi ý để duyệt.'
    : onImportDetail ? 'Gửi file tại đây. Mình sẽ tìm sản phẩm từ dữ liệu đã nhập và nêu chỗ chưa chắc chắn.'
      : 'Mình có thể kiểm tra sản phẩm còn thiếu ảnh, tài liệu kỹ thuật hoặc tìm sản phẩm phù hợp với file bạn gửi.';
  const activityTitle = robotState === 'working' ? 'Mình đang nhận file'
    : robotState === 'searching' ? 'Mình đang tìm mã sản phẩm'
      : robotState === 'thinking' ? 'Mình đang đọc và đối chiếu' : 'Mình đang xử lý';

  return <>
    {open && <section id="floating-media-assistant" role="dialog" aria-label="Trợ lý sản phẩm" aria-modal="false" data-robot-state={robotState} data-mode={messages.length ? 'conversation' : 'welcome'} data-has-batch={Boolean(detail?.items.length)} data-expanded={expanded} data-review={Boolean(reviewItem)} data-dragging={dragging}
      onKeyDown={(event) => { if (event.key === 'Escape') reviewItem ? setReviewItemId('') : close(); }} className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <h2>Songbot <span>Trợ lý sản phẩm</span></h2>
          <span className={styles.eyebrow}><i className={`${styles.statusDot} ${status?.available ? styles.statusDotOnline : ''}`} aria-hidden="true" />{busy ? activityTitle : loading ? 'Đang kết nối…' : status?.available ? 'Sẵn sàng đọc ảnh và PDF' : 'Tra sản phẩm đang sẵn sàng'}</span>
        </div>
        {usableBatches.length > 0 && <Link href="/media" onClick={close} aria-label="Xem lượt file đã gửi" className={styles.historyLink}>File đã gửi</Link>}
        {(messages.length > 0 || Boolean(detail?.items.length)) && <button type="button" onClick={() => setExpanded((current) => !current)} aria-label={expanded ? 'Thu gọn trợ lý' : 'Mở rộng trợ lý'} aria-pressed={expanded} className={styles.expand}>
          {expanded ? <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 4v4H4m12 12v-4h4M4 8l5 5m11 3-5-5" /></svg>
            : <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10V4h6m10 10v6h-6M4 4l6 6m10 10-6-6" /></svg>}
        </button>}
        <button ref={closeRef} type="button" onClick={close} aria-label="Đóng trợ lý" className={styles.close}>×</button>
      </header>

      {detail && detail.items.length > 0 && !reviewItem && <div className={styles.batch}>
        <div><span className={styles.batchLabel}>Lượt file đang xem</span><strong title={mediaBatchLabel(detail.batch)}>{mediaBatchLabel(detail.batch)}</strong>
          <span>{detail.items.length} file · {unresolved.length} cần xem</span></div>
        <button type="button" onClick={() => setReviewItemId((unresolved[0] ?? detail.items[0]).id)}>Xem file</button>
      </div>}

      <div ref={bodyRef} className={styles.body} onDragOver={(event) => event.preventDefault()}
        onDragEnter={(event) => { if (event.dataTransfer.types.includes('Files')) setDragging(true); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); if (canUpload) void intake(Array.from(event.dataTransfer.files)); }}>
        {reviewItem && <section className={styles.reviewMode} aria-label="Kiểm tra file trong trợ lý">
          <button ref={reviewBackRef} type="button" className={styles.reviewBack} onClick={() => setReviewItemId('')}>Trở lại trò chuyện</button>
          <div className={styles.reviewIntro}>
            <AssistantMascot state={robotState} size={56} paused />
            <div><strong>{reviewItem.candidates.length === 1 ? 'Mình có một gợi ý cho file này' : reviewItem.candidates.length > 1 ? 'Mình thấy vài sản phẩm có thể khớp' : 'Mình chưa tìm được sản phẩm phù hợp'}</strong><p>So lại file và sản phẩm. Bạn quyết định trước khi mình gắn.</p></div>
          </div>
          {busy && <p role="status" className={styles.reviewProgress}>{progress || 'Mình đang xử lý file.'}</p>}
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <MediaItemCard key={reviewItem.id} item={reviewItem} embedded canConfirm={Boolean(reviewCanConfirm)}
            canAnalyzeLocally={Boolean(status?.available) && ['pending', 'suggested', 'unmatched'].includes(reviewItem.status) && !reviewItem.local_analysis && reviewItem.mime_type !== 'image/svg+xml'}
            busy={busy} onConfirm={confirmItem} onAnalyzeLocally={analyzeOne} />
          {detail && detail.items.length > 1 && <div className={styles.reviewNext}>
            <label htmlFor="assistant-review-next">Chuyển sang file khác trong lượt này</label>
            <select id="assistant-review-next" value="" onChange={(event) => { if (event.target.value) setReviewItemId(event.target.value); }}>
              <option value="">Chọn file…</option>
              {detail.items.filter((item) => item.id !== reviewItem.id).map((item) => <option key={item.id} value={item.id}>{item.source_path} · {item.status === 'applied' ? 'Đã gán' : item.status === 'confirmed' ? 'Đã xác nhận' : 'Cần xem'}</option>)}
            </select>
          </div>}
        </section>}
        {!reviewItem && <>
        {dragging && <div className={styles.dropHint}>Thả ảnh hoặc PDF để mình bắt đầu</div>}
        {loading && messages.length === 0 && <div className={styles.loadingState} role="status">
          <AssistantMascot state="thinking" size={72} label="Robot trợ lý" />
          <span>Mình đang kiểm tra dữ liệu sản phẩm và các file gần đây…</span>
        </div>}
        {!loading && messages.length === 0 && <div className={styles.welcome}>
          <span className={styles.welcomeRobot}><AssistantMascot state={robotState} size={78} label="Robot trợ lý" /></span>
          <div className={styles.welcomeCopy}>
            <h3>{welcomeTitle}</h3>
            <p className={styles.welcomeDescription}>{welcomeDescription}</p>
            {!status?.available && !loading && <><p className={styles.offlineNote}>AI chưa đọc nội dung ảnh/PDF. Mình vẫn có thể tra dữ liệu sản phẩm và đối chiếu mã trong tên file.</p>
              <button type="button" className={styles.statusRetry} onClick={() => void refreshStatus()}>Kiểm tra lại AI đọc file</button></>}
          </div>
        </div>}

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
              return <button key={id} type="button" onClick={() => setReviewItemId(id)} className={styles.referenceItem}>
                <strong>{item?.source_path.split('/').at(-1) ?? id}</strong>
                <span>{candidate ? `${candidate.groupName}${candidate.variantName && candidate.variantName !== candidate.groupName ? ` · ${candidate.variantName}` : ''}` : item?.candidates.length ? 'Nhiều sản phẩm có thể khớp' : 'Cần chọn sản phẩm'}</span>
                {candidate?.evidence.length ? <small>{[...new Set(candidate.evidence.map((entry) => `${entry.value} từ ${describeEvidence(entry.source)}`))].join(' · ')}</small> : null}
              </button>;
            })}
          </div> : null}
          {message.products?.length ? <div className={styles.products}>{message.products.map((product) => <Link key={product.id} href={`/product-groups/${product.id}`} onClick={close}>{product.name}</Link>)}</div> : null}
        </div>)}
        {proposedCurrent.length > 0 && !reviewItem && <section className={styles.taskPlan} aria-label="Việc Songbot chuẩn bị">
          <div className={styles.taskPlanHeader}><strong>Songbot chuẩn bị gán</strong><span>{proposedCurrent.length} file</span></div>
          <div className={styles.taskPlanItems}>{proposedCurrent.map((task) => <div key={task.itemId} className={styles.taskPlanItem}>
            <button type="button" onClick={() => setReviewItemId(task.itemId)} disabled={busy}>
              <strong>{task.fileName}</strong><span>→ {task.targetName}</span>
            </button>
            <small>{task.reason}</small>
            {task.warning && <p className={styles.taskWarning}>{task.warning}</p>}
          </div>)}</div>
          {otherConfirmed > 0 && <p className={styles.taskWarning}>Lượt này còn {otherConfirmed} file đã xác nhận trước đó. Hãy xử lý các file đó trước khi đồng ý việc mới.</p>}
          <div className={styles.taskPlanActions}>
            <button type="button" onClick={() => { setPendingItemIds(proposedCurrent.map((task) => task.itemId)); setProposedTasks([]); append('assistant', 'Bạn gửi mã hoặc tên sản phẩm đúng, mình sẽ chuẩn bị lại việc gán.', { scope: 'batch' }); }} disabled={busy} className={styles.taskCancel}>Đổi sản phẩm</button>
            <button type="button" onClick={() => void approveTaskPlan()} disabled={busy || !canApproveProposed} className={styles.taskApprove}>Đồng ý gán {proposedCurrent.length} file</button>
          </div>
        </section>}
        {busy && <div role="status" className={styles.activity}>
          <span className={styles.activityRobot}><AssistantMascot state={robotState} size={64} /></span>
          <span className={styles.activityCopy}><strong>{activityTitle}</strong><small>{progress || 'Mình đang tra dữ liệu trong project.'}</small></span>
          <span className={styles.activityDots} aria-hidden="true"><i /><i /><i /></span>
        </div>}
        {error && <p role="alert" className={styles.error}>{error}</p>}

        {!loading && !busy && unread.length > 0 && status?.available && <div className={styles.suggestions}>
          <button type="button" className={styles.analyzePrompt} onClick={() => void analyzeMany()}>Robot đọc {Math.min(unread.length, 5)} file tiếp</button>
        </div>}
        <div ref={bottomRef} />
        </>}
      </div>

      {reviewItem && confirmedCount > 0 && <div className={styles.reviewApply}>
        <p>{confirmedCount} file đã xác nhận, đang chờ gắn vào sản phẩm.</p>
        <button type="button" disabled={busy || !canApplyConfirmed} onClick={() => void applyBatch()}>Áp dụng {confirmedCount} file đã xác nhận</button>
      </div>}
      {!reviewItem && <form onSubmit={(event) => { event.preventDefault(); void ask(question); }} className={styles.composer}>
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
            disabled={busy || loading} placeholder="Ví dụ: Gán ảnh này cho sản phẩm ABC-100…" />
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
      </form>}
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
