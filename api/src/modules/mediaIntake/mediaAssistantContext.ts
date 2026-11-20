import type { MediaBatchRow, MediaItemRow } from './mediaIntakeRepository';

type CandidateEvidence = { source: string; field: string; value: string };
type Candidate = { groupName: string; variantName: string; evidence: CandidateEvidence[] };

export interface MediaAssistantContext {
  batch: {
    name: string;
    status: string;
    total_files: number;
    counts: Record<string, number>;
    candidate_counts: { single: number; multiple: number; none: number; waiting: number };
    evidence_counts: { content_verified: number; path_only: number; conflicts: number; unread: number };
  };
  items: Array<{
    id: string;
    filename: string;
    kind: 'image' | 'pdf';
    status: string;
    analyzed: boolean;
    observed_codes: string[];
    description: string;
    uncertainty: string;
    candidates: Candidate[];
    error: string;
  }>;
  omitted_files: number;
  focus_files: string[];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function short(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.slice(0, limit) : '';
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

function hasContentEvidence(candidates: unknown, observedCodes: string[]): boolean {
  const codes = observedCodes.map(normalize);
  return Array.isArray(candidates) && candidates.some((candidate) => {
    const evidence = record(candidate).evidence;
    return Array.isArray(evidence) && evidence.some((entry) => {
      const value = record(entry);
      return value.source === 'content' && typeof value.value === 'string' && codes.includes(normalize(value.value));
    });
  });
}

export function buildMediaAssistantContext(
  batch: MediaBatchRow,
  items: MediaItemRow[],
  question: string,
  focusItemIds: string[] = []
): MediaAssistantContext {
  const normalizedQuestion = normalize(question);
  const focus = new Set(focusItemIds.slice(0, 3));
  const terms = normalizedQuestion.match(/[a-z0-9]{4,}/g) ?? [];
  const seekingUnclear = /chua|khong tim|mo ho|nhieu|loi|can xem|mau thuan|khong khop/.test(normalizedQuestion);
  const seekingSummary = /tom tat|tong quan|bao cao|tinh hinh|thong ke/.test(normalizedQuestion);
  const counts: Record<string, number> = {};
  const candidateCounts = { single: 0, multiple: 0, none: 0, waiting: 0 };
  const evidenceCounts = { content_verified: 0, path_only: 0, conflicts: 0, unread: 0 };
  for (const item of items) {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    const candidates = Array.isArray(item.candidates) ? item.candidates.length : 0;
    if (candidates === 1) candidateCounts.single += 1;
    else if (candidates > 1) candidateCounts.multiple += 1;
    else if (item.status === 'pending') candidateCounts.waiting += 1;
    else candidateCounts.none += 1;
    const observed = record(item.local_analysis).observed_codes;
    const codes = Array.isArray(observed) ? observed.filter((code): code is string => typeof code === 'string') : [];
    const verified = hasContentEvidence(item.candidates, codes);
    if (verified) evidenceCounts.content_verified += 1;
    if (candidates > 0 && !verified) evidenceCounts.path_only += 1;
    if (codes.length > 0 && candidates > 0 && !verified) evidenceCounts.conflicts += 1;
    if (!item.local_analysis && ['pending', 'suggested', 'unmatched'].includes(item.status) && item.mime_type !== 'image/svg+xml') evidenceCounts.unread += 1;
  }

  const ranked = items.map((item, index) => {
    const analysis = record(item.local_analysis);
    const candidates = Array.isArray(item.candidates) ? item.candidates.map(record) : [];
    const codes = Array.isArray(analysis.observed_codes)
      ? analysis.observed_codes.filter((code): code is string => typeof code === 'string').slice(0, 5) : [];
    const conflict = codes.length > 0 && candidates.length > 0 && !hasContentEvidence(item.candidates, codes);
    const searchable = normalize([
      item.source_path, item.original_filename, ...codes,
      ...candidates.flatMap((candidate) => [candidate.groupName, candidate.variantName])
    ].filter((value): value is string => typeof value === 'string').join(' '));
    const exactName = normalize(item.original_filename);
    const score = (exactName.length >= 4 && normalizedQuestion.includes(exactName) ? 100 : 0)
      + (focus.has(item.id) ? 30 : 0)
      + terms.reduce((total, term) => total + (searchable.includes(term) ? 10 : 0), 0)
      + (seekingUnclear && ['unmatched', 'failed'].includes(item.status) ? 5 : 0)
      + (seekingUnclear && conflict ? 10 : 0)
      + (seekingSummary && candidates.length === 0 ? 5 : 0)
      + (['pending', 'suggested', 'unmatched', 'failed'].includes(item.status) ? 1 : 0);
    return { item, analysis, candidates, codes, score, index };
  }).sort((left, right) => right.score - left.score || left.index - right.index);

  const selected = ranked.slice(0, 12).map(({ item, analysis, candidates, codes }) => ({
    id: item.id,
    filename: short(item.source_path, 120),
    kind: item.mime_type === 'application/pdf' ? 'pdf' as const : 'image' as const,
    status: item.status,
    analyzed: Boolean(item.local_analysis),
    observed_codes: codes.map((code) => short(code, 60)),
    description: short(analysis.description, 200),
    uncertainty: short(analysis.uncertainty, 160),
    candidates: candidates.slice(0, 3).map((candidate) => ({
      groupName: short(candidate.groupName, 100),
      variantName: short(candidate.variantName, 100),
      evidence: (Array.isArray(candidate.evidence) ? candidate.evidence : []).slice(0, 4).map((entry) => {
        const evidence = record(entry);
        return { source: short(evidence.source, 20), field: short(evidence.field, 30), value: short(evidence.value, 80) };
      })
    })),
    error: short(item.error_message, 180)
  }));

  return {
    batch: {
      name: short(batch.batch_name, 100) || 'Lượt ảnh/PDF chưa đặt tên',
      status: batch.status,
      total_files: items.length,
      counts,
      candidate_counts: candidateCounts,
      evidence_counts: evidenceCounts
    },
    items: selected,
    omitted_files: Math.max(0, items.length - selected.length),
    focus_files: selected.filter((item) => focus.has(item.id)).map((item) => item.filename)
  };
}
