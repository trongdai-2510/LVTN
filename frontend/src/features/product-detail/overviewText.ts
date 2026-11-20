export type OverviewTextBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'subheading'; text: string }
  | { kind: 'list'; items: string[] };

export type OverviewPart =
  | { kind: 'text'; title: string | null; blocks: OverviewTextBlock[] }
  | {
      kind: 'catalog';
      context: string | null;
      columns: string[];
      rows: Array<{ code: string; group: string | null; values: string[] }>;
    };

export type OverviewHighlight = { title: string; description: string };

const TECHNICAL_SECTION_TITLES = new Set([
  'đặc tính kỹ thuật',
  'tiêu chuẩn áp dụng',
  'nhận biết lõi',
  'cấu trúc cáp'
]);

export function partitionOverviewParts(parts: OverviewPart[]): {
  overviewParts: OverviewPart[];
  technicalParts: OverviewPart[];
} {
  const overviewParts: OverviewPart[] = [];
  const technicalParts: OverviewPart[] = [];
  let hasCatalog = false;

  for (const part of parts) {
    if (part.kind === 'catalog') {
      technicalParts.push(part);
      hasCatalog = true;
      continue;
    }

    const title = part.title?.toLocaleLowerCase('vi-VN') ?? '';
    if (TECHNICAL_SECTION_TITLES.has(title) || (hasCatalog && title === 'tổng quan')) {
      technicalParts.push(part);
    } else {
      overviewParts.push(part);
    }
  }

  return { overviewParts, technicalParts };
}

export function buildOverviewHighlights(parts: OverviewPart[]): OverviewHighlight[] {
  const highlights: OverviewHighlight[] = [];

  for (const part of parts) {
    if (part.kind !== 'text') continue;
    let current: OverviewHighlight | null = null;
    for (const block of part.blocks) {
      if (block.kind === 'subheading') {
        current = { title: block.text, description: '' };
        highlights.push(current);
      } else if (current && block.kind === 'paragraph') {
        current.description = [current.description, block.text].filter(Boolean).join(' ');
      } else if (current && block.kind === 'list') {
        current.description = [current.description, block.items.join('. ')].filter(Boolean).join(' ');
      }
    }
  }

  return highlights.filter((item) => item.description);
}

const SECTION_TITLES = [
  'ĐẶC TÍNH KỸ THUẬT',
  'TIÊU CHUẨN ÁP DỤNG',
  'NHẬN BIẾT LÕI',
  'CẤU TRÚC CÁP',
  'Đặc Điểm Nổi Bật',
  'TỔNG QUAN'
];

const COLUMN_TITLES = [
  'Tiết diện mm2',
  'Dòng chịu tải A',
  'Đường kính tổng mm',
  'Khối lượng dây kg/km',
  'Khối lượng kg/km',
  'Điện áp Volt'
];

const FLAT_FEATURE_TITLES = [
  'Cấu Trúc Chắc Chắn, Bền Bỉ',
  'An Toàn Cao, Chống Nhiễu',
  'Chịu Được Môi Trường Khắc Nghiệt',
  'Tiết Kiệm Chi Phí, Dễ Lắp Đặt'
];

const MODEL_CODE_PATTERN = '\\b[A-Za-z][A-Za-z0-9]*(?:[-/][A-Za-z0-9]+)*-\\d+(?:[x×]\\d+)?(?:[.,]\\d+)?\\b';
const CATALOG_TOKEN_PATTERN = new RegExp(`Loại\\s+\\d+\\s+lõi|${MODEL_CODE_PATTERN}`, 'gi');
const MANAGED_FEATURE_START = '[[PRODUCT_FEATURES_V1]]';
const MANAGED_FEATURE_END = '[[/PRODUCT_FEATURES_V1]]';

function splitReadableParagraph(text: string): string[] {
  if (text.length <= 380) return [text];

  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const parts: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence;
    if (current && next.length > 380) {
      parts.push(current);
      current = sentence;
    } else {
      current = next;
    }
  }
  if (current) parts.push(current);

  return parts.flatMap((part) => {
    if (part.length <= 520) return [part];
    const chunks: string[] = [];
    let chunk = '';
    for (const word of part.split(/\s+/)) {
      if (chunk && `${chunk} ${word}`.length > 460) {
        chunks.push(chunk);
        chunk = word;
      } else {
        chunk = chunk ? `${chunk} ${word}` : word;
      }
    }
    if (chunk) chunks.push(chunk);
    return chunks;
  });
}

function parseTextBlocks(text: string): OverviewTextBlock[] {
  const blocks: OverviewTextBlock[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) blocks.push({ kind: 'list', items: listItems });
    listItems = [];
  };

  for (const line of text.split(/\n+/).map((item) => item.trim()).filter(Boolean)) {
    if (/^[-•]\s+/.test(line)) {
      listItems.push(...line.replace(/^[-•]\s+/, '').split(/\s+-\s+/).map((item) => item.trim()).filter(Boolean));
      continue;
    }

    flushList();
    for (const paragraph of splitReadableParagraph(line)) {
      blocks.push({ kind: 'paragraph', text: paragraph });
    }
  }
  flushList();
  return blocks;
}

function parseSectionBlocks(text: string, title: string | null): OverviewTextBlock[] {
  if (title?.toLocaleLowerCase('vi-VN') !== 'đặc điểm nổi bật') {
    return parseTextBlocks(text);
  }

  const headingPattern = new RegExp(FLAT_FEATURE_TITLES.join('|'), 'g');
  const matches = [...text.matchAll(headingPattern)];
  if (matches.length < 2) return parseTextBlocks(text);

  const blocks: OverviewTextBlock[] = [];
  let cursor = 0;
  for (const match of matches) {
    blocks.push(...parseTextBlocks(text.slice(cursor, match.index).trim()));
    blocks.push({ kind: 'subheading', text: match[0] });
    cursor = match.index + match[0].length;
  }
  blocks.push(...parseTextBlocks(text.slice(cursor).trim()));
  return blocks;
}

function parseTextParts(text: string): OverviewPart[] {
  const headingPattern = new RegExp(
    SECTION_TITLES.map((title) => title === 'Đặc Điểm Nổi Bật'
      ? 'Đặc Điểm Nổi Bật(?!\\s+của)'
      : title).join('|'),
    'gi'
  );
  const matches = [...text.matchAll(headingPattern)];
  const parts: OverviewPart[] = [];
  let cursor = 0;
  let title: string | null = null;

  for (const match of matches) {
    const blocks = parseSectionBlocks(text.slice(cursor, match.index).trim(), title);
    if (blocks.length > 0) parts.push({ kind: 'text', title, blocks });
    title = match[0];
    cursor = match.index + match[0].length;
  }

  const blocks = parseSectionBlocks(text.slice(cursor).trim(), title);
  if (blocks.length > 0) parts.push({ kind: 'text', title, blocks });
  return parts;
}

function parseCatalog(text: string): { start: number; end: number; part: OverviewPart } | null {
  const start = text.indexOf('Mã hàng');
  if (start < 0) return null;

  const nextHeading = new RegExp(SECTION_TITLES.filter((title) => title !== 'Đặc Điểm Nổi Bật').join('|'), 'gi');
  nextHeading.lastIndex = start + 'Mã hàng'.length;
  const end = nextHeading.exec(text)?.index ?? text.length;
  const catalogText = text.slice(start, end);
  const matches = [...catalogText.matchAll(CATALOG_TOKEN_PATTERN)];
  const firstModelIndex = matches.findIndex((match) => !/^Loại\s+\d+\s+lõi$/i.test(match[0]));
  if (firstModelIndex < 0) return null;

  const header = catalogText.slice(0, matches[0].index).trim();
  const columns = COLUMN_TITLES
    .map((label) => ({ label, index: header.indexOf(label) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.label);
  if (columns.length < 2) return null;
  const unknownHeader = columns.reduce((remaining, column) => remaining.replace(column, ''), header)
    .replace('Mã hàng', '').trim();
  if (unknownHeader) return null;

  let group: string | null = null;
  const rows: Array<{ code: string; group: string | null; values: string[] }> = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    if (/^Loại\s+\d+\s+lõi$/i.test(match[0])) {
      group = match[0];
      continue;
    }

    const rawValues = catalogText.slice(
      match.index! + match[0].length,
      matches[index + 1]?.index ?? catalogText.length
    ).trim().split(/\s+/);
    if (rawValues.length < columns.length) return null;
    const values = [
      ...rawValues.slice(0, columns.length - 1),
      rawValues.slice(columns.length - 1).join(' ')
    ];
    if (values.some((value) => !/^\d[\d.,/]*(?:\s+(?:V|kV))?$/.test(value))) return null;
    rows.push({
      code: match[0],
      group,
      values
    });
  }

  if (rows.length < 2) return null;
  const beforeCatalog = text.slice(0, start);
  const lastSentenceEnd = beforeCatalog.lastIndexOf('. ');
  const contextStart = lastSentenceEnd >= 0 ? lastSentenceEnd + 2 : 0;
  const context = beforeCatalog.slice(contextStart).trim();
  const hasContext = context.length <= 120 && /^(Lựa chọn\b|Cadivi\b)/i.test(context);
  return {
    start: hasContext ? contextStart : start,
    end,
    part: { kind: 'catalog', context: hasContext ? context : null, columns, rows }
  };
}

export function buildOverviewParts(content: string): OverviewPart[] {
  const text = content.trim();
  if (!text) return [];

  const featureStart = text.indexOf(MANAGED_FEATURE_START);
  const featureEnd = featureStart < 0 ? -1 : text.indexOf(MANAGED_FEATURE_END, featureStart + MANAGED_FEATURE_START.length);
  if (featureEnd >= 0) {
    try {
      const parsed: unknown = JSON.parse(text.slice(featureStart + MANAGED_FEATURE_START.length, featureEnd).trim());
      if (Array.isArray(parsed) && parsed.every((item) =>
        item && typeof item === 'object' && typeof item.title === 'string' && typeof item.description === 'string'
      )) {
        const remaining = `${text.slice(0, featureStart)}${text.slice(featureEnd + MANAGED_FEATURE_END.length)}`;
        const blocks = parsed.flatMap((item) => {
          if (!item.title.trim() || !item.description.trim()) return [];
          return [
            { kind: 'subheading' as const, text: item.title.trim() },
            ...parseTextBlocks(item.description.trim())
          ];
        });
        return [
          ...buildOverviewParts(remaining),
          ...(blocks.length > 0 ? [{ kind: 'text' as const, title: 'Đặc Điểm Nổi Bật', blocks }] : [])
        ];
      }
    } catch {
      // Invalid managed data is kept as readable source text below.
    }
  }

  const catalog = parseCatalog(text);
  if (catalog) {
    return [
      ...parseTextParts(text.slice(0, catalog.start)),
      catalog.part,
      ...parseTextParts(text.slice(catalog.end))
    ];
  }

  // Keep admin-authored paragraphs and bullets intact when there is no
  // recognizable legacy catalog to extract.
  if (text.includes('\n')) {
    return [{ kind: 'text', title: null, blocks: parseTextBlocks(text) }];
  }

  return parseTextParts(text);
}

export function resolveOverviewCopy(shortDescription: string, detailedDescription: string) {
  const short = shortDescription.trim();
  const detailed = detailedDescription.trim();
  if (short || !detailed) {
    return { summary: short, detail: short === detailed ? '' : detailed };
  }

  const firstSection = detailed.split(/\n|Đặc Điểm Nổi Bật(?!\s+của)|ĐẶC TÍNH KỸ THUẬT|TỔNG QUAN|Mã hàng/i)[0].trim();
  const sentences = firstSection.split(/(?<=[.!?])\s+/).filter(Boolean);
  let summary = '';
  for (const sentence of sentences) {
    if (summary && (summary.length + sentence.length > 340 || summary.length > 180)) break;
    summary = summary ? `${summary} ${sentence}` : sentence;
  }
  if (summary.length > 380) {
    summary = summary.slice(0, 380).replace(/\s+\S*$/, '').trim();
  }

  return {
    summary,
    detail: detailed.startsWith(summary) ? detailed.slice(summary.length).trim() : detailed
  };
}
