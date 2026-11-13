import type { MediaAssistantContext } from './mediaAssistantContext';

export interface EvidenceAnswer {
  answer: string;
  referenced_item_ids: string[];
  model: 'project-evidence';
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

function candidateName(candidate: MediaAssistantContext['items'][number]['candidates'][number]): string {
  return [candidate.groupName, candidate.variantName]
    .filter((name, index, all) => Boolean(name) && all.indexOf(name) === index).join(' — ');
}

function mentionedItems(question: string, context: MediaAssistantContext) {
  const q = normalize(question);
  return context.items.filter((item) => {
    const full = normalize(item.filename);
    const basename = full.split('/').at(-1) ?? '';
    return (full.length >= 5 && q.includes(full)) || (basename.length >= 5 && q.includes(basename));
  }).sort((left, right) => {
    const leftName = normalize(left.filename.split('/').at(-1) ?? left.filename);
    const rightName = normalize(right.filename.split('/').at(-1) ?? right.filename);
    return q.indexOf(leftName) - q.indexOf(rightName);
  });
}

function selectedItem(question: string, context: MediaAssistantContext) {
  const q = normalize(question);
  return context.items.find((item) => q.includes(normalize(item.filename)))
    ?? context.items.find((item) => {
      const stem = normalize(item.filename.split('/').at(-1) ?? '').replace(/\.[^.]+$/, '');
      return stem.length >= 4 && q.includes(stem);
    })
    ?? context.items.find((item) => item.candidates.some((candidate) =>
      candidate.evidence.some((evidence) => evidence.value.length >= 4 && q.includes(normalize(evidence.value)))))
    ?? (context.focus_files.length === 1 ? context.items.find((item) => item.filename === context.focus_files[0]) : null)
    ?? (context.items.length === 1 ? context.items[0] : null);
}

function needsAction(item: MediaAssistantContext['items'][number]): boolean {
  return !['applied', 'skipped'].includes(item.status);
}

function hasContentConflict(item: MediaAssistantContext['items'][number]): boolean {
  return item.observed_codes.length > 0 && item.candidates.length > 0 && !item.candidates.some((candidate) =>
    candidate.evidence.some((entry) => entry.source === 'content' && item.observed_codes.some((code) => normalize(code) === normalize(entry.value))));
}

function reviewRisk(item: MediaAssistantContext['items'][number]): number {
  if (hasContentConflict(item)) return 5;
  if (item.status === 'failed') return 4;
  if (!item.candidates.length) return 3;
  if (item.candidates.length > 1) return 2;
  if (!item.observed_codes.length) return 1;
  return 0;
}

function reviewReason(item: MediaAssistantContext['items'][number]): string {
  if (item.status === 'applied') return 'đã gán vào sản phẩm';
  if (item.status === 'skipped') return 'đã bỏ qua, không gán';
  if (item.status === 'confirmed') return 'đã xác nhận nhưng chưa áp dụng';
  if (item.status === 'failed') return item.error ? `xử lý lỗi: ${item.error}` : 'xử lý lỗi, cần thử lại';
  if (hasContentConflict(item)) return `AI đọc mã ${item.observed_codes.join(', ')} từ nội dung nhưng mã này không khớp gợi ý theo tên file/thư mục`;
  if (!item.candidates.length) return 'chưa tìm thấy sản phẩm phù hợp';
  if (item.candidates.length > 1) return `có ${item.candidates.length} sản phẩm có thể khớp`;
  const evidence = item.candidates[0].evidence;
  const contentCodes = [...new Set(evidence.filter((entry) => entry.source === 'content'
    && item.observed_codes.some((code) => normalize(code) === normalize(entry.value))).map((entry) => entry.value))];
  if (contentCodes.length) return `AI đọc mã ${contentCodes.join(', ')} từ nội dung file, cần so lại với ${item.candidates[0].groupName}`;
  const pathEvidence = evidence.find((entry) => entry.source === 'filename' || entry.source === 'folder');
  if (pathEvidence) return `mã ${pathEvidence.value} chỉ lấy từ ${pathEvidence.source === 'folder' ? 'tên thư mục' : 'tên file'}, cần xem nội dung`;
  return 'gợi ý chưa có mã đối chiếu rõ';
}

export function answerFromEvidence(question: string, context: MediaAssistantContext): EvidenceAnswer | null {
  const q = normalize(question);
  const asksAutoAttach = /tu gan|tu dong gan|gan luon|khong can.{0,25}(duyet|xac nhan)/.test(q);
  const asksApplied = /da gan|da ap dung|da xac nhan|gan chua|ap dung chua/.test(q);
  const asksSkipped = /bo qua|skipped/.test(q);
  const asksUnverifiedFact = /cong suat|dien ap|thong so|bao nhieu trang|so trang|kich thuoc|do day/.test(q);
  const asksLimits = /gioi han|han che|chat luong|do tin cay/.test(q) && /anh|pdf|file|du lieu|goi y/.test(q);
  const asksSummary = /tom tat|tong quan|bao cao|tinh hinh|thong ke/.test(q);
  const asksEvidenceAudit = /mau thuan|khong khop|chi.{0,20}ten file|chua doc noi dung|bao nhieu file.{0,15}(da doc|chua doc)/.test(q);
  const asksSharedCode = /(cung|trung|lap).{0,15}ma|ma.{0,25}(cung|trung|lap|nhieu file)/.test(q);
  const asksCompare = /so sanh|khac nhau|giong nhau|ca hai|hai file|cung (duoc |co |giai thich|goi y)|doi chieu (hai|2)/.test(q);
  const asksNext = /tiep theo|lam gi tiep|gio lam gi|gio sao/.test(q);
  const asksFollowup = /file (nay|do|kia)|anh (nay|do|kia)|pdf (nay|do|kia)|cai (nay|do)|con no|no thi sao|sao vay|sao the/.test(q);
  const asksProduct = /san pham|vi sao|goi y|gan cho|phu hop|chac chan|dung khong|khop/.test(q) || asksFollowup;
  const asksCodes = /ma nao|ma gi|doc duoc ma|nhin thay ma/.test(q);
  const asksUnclear = /file nao|nhung file|file chua/.test(q) && /chua ro|chua co|chua tim|khong tim|san pham nao/.test(q);
  const asksPriority = /uu tien|file nao truoc|xu ly truoc/.test(q);
  const asksReview = /kiem tra|truoc khi|ap dung|xac nhan/.test(q)
    && /file|anh|pdf|ap dung|xac nhan/.test(q);
  if (asksAutoAttach) {
    return { answer: 'Bạn có thể gửi file kèm lời dặn gán cho mã hoặc tên sản phẩm. Songbot đối chiếu với dữ liệu project, hiển thị file và sản phẩm đích để bạn bấm Đồng ý; sau đó Songbot gắn file. Khi chưa tìm được đúng một sản phẩm, mình sẽ hỏi thêm.',
      referenced_item_ids: [], model: 'project-evidence' };
  }
  if (asksSkipped) {
    const skipped = context.items.filter((item) => item.status === 'skipped');
    const names = skipped.length ? ` Ví dụ: ${skipped.slice(0, 5).map((item) => item.filename).join(', ')}.` : '';
    return { answer: `Lượt này có ${context.batch.counts.skipped ?? 0} file đã được bỏ qua. Quyết định bỏ qua không gán file vào sản phẩm; số file đã gán trong lượt là ${context.batch.counts.applied ?? 0}.${names}`,
      referenced_item_ids: skipped.slice(0, 5).map((item) => item.id), model: 'project-evidence' };
  }
  if (asksApplied) {
    const counts = context.batch.counts;
    return { answer: `Trong lượt này: ${counts.applied ?? 0} file đã gán, ${counts.confirmed ?? 0} file đã xác nhận nhưng chưa áp dụng, ${counts.skipped ?? 0} file được bỏ qua. ${counts.suggested ?? 0} file mới có gợi ý; gợi ý không phải là đã gán.`,
      referenced_item_ids: context.items.filter((item) => item.status === 'applied' || item.status === 'confirmed').slice(0, 5).map((item) => item.id), model: 'project-evidence' };
  }
  if (asksUnverifiedFact) {
    const mentioned = mentionedItems(question, context);
    const focused = context.items.filter((item) => context.focus_files.includes(item.filename));
    const items = mentioned.length ? mentioned : focused.length ? focused : [];
    const about = items.length ? ` của ${items.slice(0, 2).map((item) => item.filename).join(' và ')}` : ' từ lượt file này';
    const answer = /bao nhieu trang|so trang/.test(q)
      ? `Mình chưa lưu tổng số trang${about}, nên chưa thể trả lời chính xác. Hãy mở PDF nguồn để kiểm tra.`
      : `Mình chưa có thông số kỹ thuật đã xác thực${about} để trả lời câu này. Phần phân tích chỉ lưu chữ và mã AI đọc được nhằm gợi ý sản phẩm; hãy mở file nguồn để kiểm tra thông số.`;
    return { answer,
      referenced_item_ids: items.slice(0, 2).map((item) => item.id), model: 'project-evidence' };
  }
  if (asksLimits) {
    const read = context.items.filter((item) => item.observed_codes.length > 0);
    const pathOnly = context.items.filter((item) => item.observed_codes.length === 0 && item.candidates.some((candidate) =>
      candidate.evidence.some((evidence) => evidence.source === 'filename' || evidence.source === 'folder')));
    const examples = [...read, ...pathOnly].slice(0, 3);
    const evidence = read.length
      ? `AI đã đọc mã từ nội dung ${read.slice(0, 3).map((item) => `${item.filename} (${item.observed_codes.join(', ')})`).join('; ')}.`
      : 'Chưa có mã nào được xác minh từ nội dung các file đang xem.';
    const pathNote = pathOnly.length ? ` ${pathOnly.slice(0, 2).map((item) => item.filename).join(', ')} chỉ có bằng chứng từ tên file hoặc thư mục.` : '';
    return { answer: `${evidence}${pathNote} Dữ liệu hiện lưu chưa đánh giá độ nét ảnh, độ đầy đủ của PDF hoặc xác nhận file chắc chắn thuộc sản phẩm được gợi ý. Hãy mở file gốc và so với sản phẩm trước khi xác nhận gán.`,
      referenced_item_ids: examples.map((item) => item.id), model: 'project-evidence' };
  }
  if (asksEvidenceAudit) {
    const counts = context.batch.evidence_counts;
    const examples = /mau thuan|khong khop/.test(q)
      ? context.items.filter(hasContentConflict)
      : /chua doc/.test(q) ? context.items.filter((item) => !item.analyzed && needsAction(item))
        : context.items.filter((item) => item.candidates.length > 0 && !item.candidates.some((candidate) => candidate.evidence.some((entry) => entry.source === 'content')));
    const detail = examples.length ? ` Cần xem: ${examples.slice(0, 3).map((item) => `${item.filename} (${reviewReason(item)})`).join('; ')}.` : '';
    return { answer: `Trong lượt này, ${counts.content_verified} file có mã đã đối chiếu từ nội dung, ${counts.path_only} file có gợi ý nhưng chưa xác minh mã từ nội dung, ${counts.conflicts} file có mã nội dung không khớp gợi ý, và ${counts.unread} file còn chờ robot đọc.${detail} Mở file cần xem để kiểm tra trước khi xác nhận.`,
      referenced_item_ids: examples.slice(0, 3).map((item) => item.id), model: 'project-evidence' };
  }
  if (asksSummary) {
    const counts = context.batch.candidate_counts;
    const unresolved = context.items.filter((item) => needsAction(item) && (item.candidates.length !== 1 || hasContentConflict(item))).slice(0, 3);
    const candidates = context.items.filter((item) => item.candidates.length === 1).slice(0, 3);
    const waiting = Object.entries(context.batch.counts).reduce((total, [status, count]) =>
      total + (['applied', 'skipped'].includes(status) ? 0 : count), 0);
    const examples = candidates.length ? ` Ví dụ đã có gợi ý: ${candidates.map((item) => item.filename).join(', ')}${counts.single > candidates.length ? ` và ${counts.single - candidates.length} file khác` : ''}.` : '';
    const next = unresolved.length ? ` Cần xem kỹ: ${unresolved.map((item) => `${item.filename} (${reviewReason(item)})`).join('; ')}.`
      : waiting ? ` Còn ${waiting} file chờ admin duyệt hoặc áp dụng.` : ' Không còn file chờ xử lý trong lượt.';
    const omitted = context.omitted_files ? ` Còn ${context.omitted_files} file không được liệt kê ở đây.` : '';
    return { answer: `Lượt ${context.batch.name} có ${context.batch.total_files} file. Kết quả phân tích: ${counts.single} file có một sản phẩm được gợi ý, ${counts.multiple} file có nhiều sản phẩm có thể khớp, ${counts.none} file chưa có gợi ý, ${counts.waiting} file đang chờ phân tích. Bằng chứng: ${context.batch.evidence_counts.content_verified} file có mã từ nội dung, ${context.batch.evidence_counts.path_only} file chỉ có gợi ý chưa xác minh từ nội dung, ${context.batch.evidence_counts.conflicts} file có mã mâu thuẫn, ${context.batch.evidence_counts.unread} file chưa được robot đọc.${examples}${next}${omitted} Trạng thái hiện tại: ${context.batch.counts.applied ?? 0} file đã gán, ${context.batch.counts.skipped ?? 0} file bỏ qua; gợi ý không có nghĩa là đã gán.`,
      referenced_item_ids: [...new Set([...unresolved, ...candidates].map((item) => item.id))].slice(0, 5), model: 'project-evidence' };
  }
  if (asksSharedCode) {
    const groups = new Map<string, { code: string; items: MediaAssistantContext['items'] }>();
    for (const item of context.items) {
      for (const code of [...new Set(item.observed_codes)]) {
        const key = normalize(code);
        const entry = groups.get(key) ?? { code, items: [] };
        if (!entry.items.some((other) => other.id === item.id)) entry.items.push(item);
        groups.set(key, entry);
      }
    }
    const focused = context.items.filter((item) => context.focus_files.includes(item.filename));
    const selected = [...groups.entries()].find(([key]) => q.includes(key))?.[1]
      ?? [...groups.values()].find((entry) => focused.length && focused.every((item) => entry.items.includes(item)))
      ?? [...groups.values()].find((entry) => entry.items.length > 1);
    if (!selected) return { answer: 'Trong các file đang xem, AI chưa tìm thấy mã đọc từ nội dung xuất hiện ở nhiều file. Nếu file nằm ngoài phần đang xem, hãy hỏi bằng tên hoặc mã cụ thể.',
      referenced_item_ids: [], model: 'project-evidence' };
    const names = selected.items.slice(0, 5).map((item) => item.filename).join(', ');
    return { answer: `AI đọc cùng mã ${selected.code} từ ${selected.items.length} file trong phần đang xem: ${names}${selected.items.length > 5 ? ` và ${selected.items.length - 5} file khác` : ''}. Cùng mã gợi ý liên quan cùng sản phẩm, chưa chứng minh ảnh hoặc PDF trùng nội dung.`,
      referenced_item_ids: selected.items.slice(0, 5).map((item) => item.id), model: 'project-evidence' };
  }
  if (asksCompare) {
    const mentioned = mentionedItems(question, context);
    const focused = context.items.filter((item) => context.focus_files.includes(item.filename));
    const items = mentioned.length >= 2 ? mentioned : focused.length === 2 ? focused : context.items.length === 2 ? context.items : [];
    if (items.length < 2) return { answer: 'Mình cần tên của hai file muốn so sánh để đối chiếu mã đọc được, nguồn bằng chứng và sản phẩm ứng viên. Hãy nêu tên file trong lượt này.',
      referenced_item_ids: mentioned.map((item) => item.id), model: 'project-evidence' };
    const [first, second] = items;
    const sharedCodes = first.observed_codes.filter((code) => second.observed_codes.some((other) => normalize(code) === normalize(other)));
    const sharedProducts = first.candidates.map(candidateName).filter((name) => second.candidates.some((candidate) => normalize(candidateName(candidate)) === normalize(name)));
    const sameProduct = sharedProducts.length ? `Cả hai cùng được gợi ý cho ${sharedProducts[0]}.` : 'Hai file chưa có một sản phẩm được gợi ý chung.';
    const sameCode = sharedCodes.length ? `AI đọc được mã ${[...new Set(sharedCodes)].join(', ')} từ nội dung cả hai file.`
      : `Mã AI đọc từ nội dung: ${first.filename} ${first.observed_codes.join(', ') || 'chưa có'}; ${second.filename} ${second.observed_codes.join(', ') || 'chưa có'}.`;
    const basis = sharedProducts.length && sharedCodes.length ? `${first.filename} và ${second.filename} đều cần mở xem để xác nhận mã.`
      : `${first.filename}: ${reviewReason(first)}; ${second.filename}: ${reviewReason(second)}.`;
    return { answer: `${sameProduct} ${sameCode} ${basis} Đây vẫn là gợi ý cần admin kiểm tra trước khi gán.`,
      referenced_item_ids: [first.id, second.id], model: 'project-evidence' };
  }
  if (asksNext) {
    const focused = context.items.filter((item) => context.focus_files.includes(item.filename));
    const pending = context.items.filter(needsAction);
    const item = [...(focused.length ? focused : pending)]
      .sort((left, right) => reviewRisk(right) - reviewRisk(left))[0];
    if (item) {
      const action = item.status === 'applied' ? `${item.filename} đã gán vào sản phẩm; có thể mở sản phẩm để kiểm tra kết quả.`
        : item.status === 'skipped' ? `${item.filename} đã được bỏ qua trong lượt này và chưa gán vào sản phẩm.`
        : item.status === 'confirmed' ? `${item.filename} đã xác nhận đích nhưng chưa áp dụng; kiểm tra lại quyết định rồi áp dụng lượt khi sẵn sàng.`
        : item.status === 'failed' ? `Kiểm tra lỗi của ${item.filename}: ${item.error || 'chưa rõ nguyên nhân'}. Sau đó thử xử lý lại.`
        : hasContentConflict(item)
        ? `Mở ${item.filename}: ${reviewReason(item)}. Không xác nhận đích gán sẵn; hãy chọn sản phẩm đúng sau khi xem file.`
        : item.candidates.length === 1
        ? `Mở ${item.filename}, đối chiếu mã với ${candidateName(item.candidates[0])}, rồi xác nhận nếu đúng. Sau đó mới áp dụng lượt.`
        : item.candidates.length > 1
          ? `Mở ${item.filename} và so từng mã với ${item.candidates.length} sản phẩm ứng viên trước khi chọn.`
          : `Kiểm tra ${item.filename}: ${reviewReason(item)}. Có thể tìm sản phẩm thủ công nếu file không có mã rõ ràng.`;
      return { answer: action, referenced_item_ids: [item.id], model: 'project-evidence' };
    }
    return { answer: 'Lượt này không còn file chờ xử lý. Các file đã được gán hoặc bỏ qua; hãy mở bản duyệt nếu cần xem kết quả.',
      referenced_item_ids: [], model: 'project-evidence' };
  }
  if (asksFollowup && context.focus_files.length !== 1 && context.items.length !== 1 && !mentionedItems(question, context).length) {
    return { answer: 'Mình chưa biết bạn đang nói tới file nào. Hãy nêu tên file để mình đối chiếu đúng bằng chứng.',
      referenced_item_ids: [], model: 'project-evidence' };
  }
  if (asksPriority || asksReview) {
    if (asksReview && asksFollowup && context.focus_files.length === 1) {
      const focused = selectedItem(question, context);
      if (focused) {
        const action = focused.status === 'skipped' ? 'File đã được bỏ qua trong lượt này; không có quyết định gán đang chờ xác nhận.'
          : focused.status === 'applied' ? 'File đã gán; hãy mở sản phẩm để kiểm tra kết quả.'
            : focused.status === 'confirmed' ? 'Kiểm tra lại sản phẩm đích trước khi áp dụng lượt.'
              : 'Hãy xem file và sản phẩm đích trước khi xác nhận; AI chưa gán file này.';
        return { answer: `${focused.filename}: ${reviewReason(focused)}. ${action}`,
        referenced_item_ids: [focused.id], model: 'project-evidence' };
      }
    }
    const priority = context.items.filter(needsAction).sort((left, right) => reviewRisk(right) - reviewRisk(left));
    if (!priority.length) {
      const waiting = Object.entries(context.batch.counts).reduce((total, [status, count]) =>
        total + (['applied', 'skipped'].includes(status) ? 0 : count), 0);
      return { answer: waiting > 0
        ? `Lượt còn ${waiting} file chờ xử lý nhưng chưa nằm trong phần dữ liệu đang xem. Hãy nêu tên file để mình kiểm tra đúng file.`
        : 'Lượt này không còn file chờ xử lý; các file đã được gán hoặc bỏ qua.',
      referenced_item_ids: [], model: 'project-evidence' };
    }
    const examples = priority.slice(0, 3).map((item) => `${item.filename}: ${reviewReason(item)}`);
    const equalRisk = priority.length > 1 && priority.every((item) => reviewRisk(item) === reviewRisk(priority[0]));
    const opening = asksPriority
      ? equalRisk ? 'Các file đang xem có cùng mức cần kiểm tra theo bằng chứng hiện có; chưa có lý do để ưu tiên một file.'
        : 'Ưu tiên kiểm tra các file chưa có gợi ý rõ ràng trước.'
      : 'Cần xem trực tiếp từng ảnh/PDF trước khi xác nhận.';
    return { answer: `${opening} ${examples.join('; ')}.${priority.length > 3 || context.omitted_files ? ` Còn ${priority.length - examples.length + context.omitted_files} file khác trong lượt.` : ''} Chưa file nào được gán chỉ vì AI gợi ý.`,
      referenced_item_ids: priority.slice(0, 3).map((item) => item.id), model: 'project-evidence' };
  }
  if (!asksProduct && !asksCodes) return null;
  if (asksUnclear) {
    const unclear = context.items.filter((item) => needsAction(item) && (['pending', 'unmatched', 'failed'].includes(item.status) || item.candidates.length !== 1 || hasContentConflict(item)));
    return { answer: unclear.length
      ? `${unclear.length} file trong phần đang xem chưa có một sản phẩm rõ ràng: ${unclear.slice(0, 5).map((item) => item.filename).join(', ')}.${context.omitted_files ? ` Lượt này còn ${context.omitted_files} file chưa hiện trong câu trả lời; hãy hỏi tên file cụ thể để xem tiếp.` : ''}`
      : 'Không có file đang chờ xử lý nào thiếu một gợi ý sản phẩm trong phần đang xem. Gợi ý vẫn cần kiểm tra trước khi xác nhận.',
    referenced_item_ids: unclear.slice(0, 5).map((item) => item.id), model: 'project-evidence' };
  }
  const item = selectedItem(question, context);
  if (asksCodes && !item) {
    const observed = context.items.filter((entry) => entry.observed_codes.length > 0);
    return { answer: observed.length
      ? `AI đã đọc được mã từ ${observed.length} file đang xem: ${observed.slice(0, 5).map((entry) => `${entry.filename}: ${entry.observed_codes.join(', ')}`).join('; ')}. Hãy kiểm tra chữ trên từng file trước khi xác nhận.`
      : 'AI chưa đọc được mã rõ ràng từ nội dung các file đang xem. Mã trong tên file hoặc thư mục là nguồn bằng chứng riêng.',
    referenced_item_ids: observed.slice(0, 5).map((entry) => entry.id), model: 'project-evidence' };
  }
  if (!item) return null;

  if (asksCodes && !asksProduct) {
    return {
      answer: item.observed_codes.length
        ? `AI đã đọc được ${item.observed_codes.join(', ')} từ nội dung ${item.filename}. Hãy kiểm tra lại chữ trên file trước khi xác nhận.`
        : `AI chưa đọc được mã nào từ nội dung ${item.filename}. Mã trong tên file hoặc thư mục, nếu có, là nguồn bằng chứng riêng.`,
      referenced_item_ids: [item.id], model: 'project-evidence'
    };
  }

  if (item.candidates.length === 0) {
    return {
      answer: `${item.filename} chưa có sản phẩm phù hợp được gợi ý từ mã trong project. ${item.observed_codes.length
        ? `AI đọc được ${item.observed_codes.join(', ')} nhưng chưa đối chiếu được với mã sản phẩm đang có.`
        : 'AI chưa đọc được mã sản phẩm rõ ràng từ file.'} Hãy kiểm tra file hoặc tìm sản phẩm thủ công.`,
      referenced_item_ids: [item.id], model: 'project-evidence'
    };
  }

  const candidates = item.candidates.slice(0, 3);
  const names = candidates.map(candidateName);
  const evidence = candidates.flatMap((candidate) => candidate.evidence).filter((entry) =>
    entry.source !== 'content' || item.observed_codes.some((code) => normalize(code) === normalize(entry.value))
  );
  const sources = [...new Set(evidence.map((entry) => entry.source === 'content' ? 'nội dung file do AI đọc'
    : entry.source === 'folder' ? 'tên thư mục' : 'tên file'))];
  const codes = [...new Set(evidence.map((entry) => entry.value))];
  const basis = codes.length ? `Mã ${codes.join(', ')} được đối chiếu từ ${sources.join(' và ')}.`
    : 'Chưa có mã đối chiếu đủ rõ trong dữ liệu đang lưu.';
  const conclusion = candidates.length === 1
    ? `${item.filename} được gợi ý cho ${names[0]}. ${basis}${hasContentConflict(item) ? ` AI đọc mã ${item.observed_codes.join(', ')} từ nội dung nhưng không khớp gợi ý này; hãy chọn lại sản phẩm sau khi xem file.` : ' Đây chưa phải xác nhận ảnh/PDF thuộc sản phẩm đó; hãy xem file và sản phẩm trước khi gán.'}`
    : `${item.filename} có nhiều sản phẩm ứng viên: ${names.join('; ')}. ${basis} Chưa thể chọn một sản phẩm; hãy kiểm tra nội dung file và từng mã.`;
  return { answer: conclusion, referenced_item_ids: [item.id], model: 'project-evidence' };
}
