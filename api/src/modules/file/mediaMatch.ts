export interface MediaProductCandidate {
  groupId: string;
  variantId: string;
  modelCode?: string | null;
  sku?: string | null;
  externalCode?: string | null;
}

interface MediaMatchEvidence {
  source: 'filename' | 'folder' | 'content';
  field: 'modelCode' | 'sku' | 'externalCode';
  value: string;
}

interface MediaMatchCandidate {
  groupId: string;
  variantId: string;
  evidence: MediaMatchEvidence[];
}

export interface MediaMatchResult {
  status: 'unique' | 'ambiguous' | 'unmatched';
  candidates: MediaMatchCandidate[];
}

const CODE_FIELDS = ['modelCode', 'sku', 'externalCode'] as const;
const GENERATED_CODE_PREFIXES = ['STSKU', 'STPV', 'STPG'];

function codeTokens(value: string): string[] {
  return (
    value
      .replace(/[đĐ]/g, 'd')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .match(/[A-Z0-9]+/g) ?? []
  );
}

function validCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = codeTokens(value).join('');
  if (compact.length < 4 || GENERATED_CODE_PREFIXES.some((prefix) => compact.startsWith(prefix))) {
    return null;
  }
  return compact;
}

function evidenceScore(evidence: MediaMatchEvidence): number {
  const sourceWeight = evidence.source === 'content' ? 20 : evidence.source === 'filename' ? 10 : 0;
  const fieldWeight = evidence.field === 'modelCode' ? 3 : evidence.field === 'sku' ? 2 : 1;
  return sourceWeight + fieldWeight;
}

type IndexedCode = { groupId: string; variantId: string; field: MediaMatchEvidence['field']; value: string };

export function buildMediaMatchIndex(products: readonly MediaProductCandidate[]): (relativePath: string, observedCodes?: readonly string[]) => MediaMatchResult {
  const codes = new Map<string, IndexedCode[]>();
  let longestCode = 0;
  for (const product of products) {
    for (const field of CODE_FIELDS) {
      const value = product[field];
      const compactCode = validCode(value);
      if (!value || !compactCode) continue;
      longestCode = Math.max(longestCode, compactCode.length);
      const entries = codes.get(compactCode) ?? [];
      entries.push({ groupId: product.groupId, variantId: product.variantId, field, value });
      codes.set(compactCode, entries);
    }
  }

  return (relativePath: string, observedCodes: readonly string[] = []): MediaMatchResult => {
    const parts = relativePath.replace(/\\/g, '/').split('/').filter(Boolean);
    const filename = (parts.at(-1) ?? '').replace(/\.[^.]+$/, '');
    const matches = new Map<string, MediaMatchCandidate>();
    function scan(tokens: string[], source: MediaMatchEvidence['source']) {
      for (let start = 0; start < tokens.length; start += 1) {
        let compact = '';
        for (let index = start; index < tokens.length; index += 1) {
          compact += tokens[index];
          if (compact.length > longestCode) break;
          for (const entry of codes.get(compact) ?? []) {
            const key = `${entry.groupId}:${entry.variantId}`;
            const candidate = matches.get(key) ?? { groupId: entry.groupId, variantId: entry.variantId, evidence: [] };
            if (!candidate.evidence.some((item) => item.source === source && item.field === entry.field && item.value === entry.value)) {
              candidate.evidence.push({ source, field: entry.field, value: entry.value });
            }
            matches.set(key, candidate);
          }
        }
      }
    }
    scan(codeTokens(filename), 'filename');
    for (const folder of parts.slice(0, -1)) scan(codeTokens(folder), 'folder');
    for (const code of observedCodes.slice(0, 20)) scan(codeTokens(code.slice(0, 80)), 'content');
    const candidates = [...matches.values()];
    candidates.sort((left, right) => {
      const leftScore = Math.max(...left.evidence.map(evidenceScore));
      const rightScore = Math.max(...right.evidence.map(evidenceScore));
      return rightScore - leftScore || left.groupId.localeCompare(right.groupId) ||
        left.variantId.localeCompare(right.variantId);
    });

    return {
      status: candidates.length === 0 ? 'unmatched' : candidates.length === 1 ? 'unique' : 'ambiguous',
      candidates
    };
  };
}

export function suggestMediaMatches(relativePath: string, products: readonly MediaProductCandidate[]): MediaMatchResult {
  return buildMediaMatchIndex(products)(relativePath);
}
