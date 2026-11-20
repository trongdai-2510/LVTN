export type MediaTaskIntent = {
  intent: 'assign' | 'query' | 'unclear';
  target_text: string;
  file_name: string;
  all_files: boolean;
  needs_clarification: boolean;
};

function normalize(value: string): string {
  return value.replace(/[đĐ]/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export function normalizeMediaTaskIntent(raw: unknown, question: string): MediaTaskIntent {
  const response = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const normalizedQuestion = normalize(question);
  const explicitQuery = /^(cho toi xem|xem|tim|lam sao|san pham nao)\b/.test(normalizedQuestion)
    || /\b(truoc khi|sau khi) gan\b/.test(normalizedQuestion);
  const intent = explicitQuery ? 'query'
    : response.intent === 'assign' || response.intent === 'query' ? response.intent : 'unclear';
  const target = typeof response.target_text === 'string' ? response.target_text.trim().replace(/^["'“”]+|["'“”?.!]+$/g, '').slice(0, 120) : '';
  const targetText = target.length >= 2 && normalize(question).includes(normalize(target)) ? target : '';
  const suppliedName = typeof response.file_name === 'string' ? response.file_name.trim().slice(0, 160) : '';
  const ambiguousReference = /\b(cai ben canh|cai kia|file kia|anh kia)\b/.test(normalizedQuestion);
  const fileName = !ambiguousReference && /^[^\\/]+\.(?:jpe?g|png|webp|svg|pdf)$/i.test(suppliedName)
    && question.toLowerCase().includes(suppliedName.toLowerCase()) ? suppliedName : '';
  return {
    intent,
    target_text: targetText,
    file_name: fileName,
    all_files: /\b(tat ca|toan bo|moi file)\b/.test(normalizedQuestion),
    needs_clarification: response.needs_clarification === true || ambiguousReference
  };
}
