/**
 * Parsers tách HTML content của page_content thành các structured block
 * mà các editorial component có thể render đẹp hơn raw HTML.
 *
 * Convention admin gõ trong RichTextEditor:
 *   - <h2>Bảng thời hạn ...</h2> + <table> → warranty term cards
 *   - <h2>Quy trình ...</h2> + <h3>...</h3> items → timeline steps
 *   - <h2>Được ...</h2> + <ul> AND <h2>Không ...</h2> + <ul> → 2-col compare
 *   - <blockquote cite="...">...</blockquote> → testimonial
 *   - <h2>Category</h2> + <h3>Question</h3> + <p> answer → FAQ items
 *
 * Nguyên tắc: nếu pattern không match, parser trả về null/empty array →
 * component fallback về render HTML raw, không crash.
 */

export interface FaqCategory {
  id: string;
  title: string;
  /** Icon name suggested theo title — component map sang lucide icon */
  iconKey: string;
  items: FaqItem[];
}

interface FaqItem {
  id: string;
  question: string;
  answerHtml: string;
}

export interface WarrantyTerm {
  duration: string; // "12 tháng"
  scope: string;    // "MCB, Aptomat, phụ kiện"
  detail?: string;  // optional 3rd column
}

export interface ProcessStep {
  number: string;       // "01"
  title: string;        // "Liên hệ"
  description: string;  // body text
  sla?: string;         // "< 1 ngày"
  iconKey: string;
}

export interface ComparisonList {
  positive: { title: string; items: string[] };
  negative: { title: string; items: string[] };
}

export interface Testimonial {
  quote: string;
  attribution: string; // "Nguyễn Văn A, Cty Cơ Khí Minh Anh"
}

// ----- Helpers -----

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value: string, fallback: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

/** Split HTML thành đoạn theo h2 — mỗi đoạn gồm title + nội dung bên trong */
function splitByH2(html: string): Array<{ title: string; body: string }> {
  const matches = Array.from(html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi));
  if (matches.length === 0) return [];
  return matches.map((match, index) => {
    const title = stripHtml(match[1] ?? '');
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? html.length;
    const body = html.slice(start, end).trim();
    return { title, body };
  });
}

/** Split body của 1 h2-section thành các h3 items */
function splitByH3(source: string): Array<{ title: string; body: string }> {
  const matches = Array.from(source.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi));
  if (matches.length === 0) return [];
  return matches.map((match, index) => {
    const title = stripHtml(match[1] ?? '');
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? source.length;
    const body = source.slice(start, end).trim();
    return { title, body };
  });
}

function pickIconFromTitle(title: string, fallback = 'help'): string {
  const lower = title.toLowerCase();
  if (lower.includes('đặt') || lower.includes('order')) return 'package';
  if (lower.includes('giao') || lower.includes('ship') || lower.includes('vận')) return 'truck';
  if (lower.includes('bảo hành') || lower.includes('warranty')) return 'shield';
  if (lower.includes('thanh toán') || lower.includes('payment')) return 'credit-card';
  if (lower.includes('kỹ thuật') || lower.includes('technical')) return 'wrench';
  if (lower.includes('liên hệ') || lower.includes('contact') || lower.includes('hỏi')) return 'phone';
  if (lower.includes('doanh nghiệp') || lower.includes('business')) return 'building';
  if (lower.includes('gửi') || lower.includes('package') || lower.includes('hàng')) return 'package';
  if (lower.includes('kiểm tra') || lower.includes('inspect') || lower.includes('check')) return 'search';
  if (lower.includes('trả') || lower.includes('đổi') || lower.includes('refund')) return 'gift';
  return fallback;
}

// ----- Public parsers -----

/** Parse FAQ — mỗi h2 = category, mỗi h3 trong category = câu hỏi */
export function extractFaqCategories(html: string | null | undefined): FaqCategory[] {
  if (!html?.trim()) return [];
  const sections = splitByH2(html);
  if (sections.length === 0) return [];

  return sections
    .map((section, index) => {
      const items = splitByH3(section.body).map((item, itemIndex) => ({
        id: slugify(item.title, `q-${index}-${itemIndex}`),
        question: item.title,
        answerHtml: item.body
      }));
      return {
        id: slugify(section.title, `cat-${index}`),
        title: section.title,
        iconKey: pickIconFromTitle(section.title),
        items
      };
    })
    .filter((category) => category.items.length > 0);
}

/**
 * Parse warranty terms từ table dưới h2 chứa "thời hạn bảo hành".
 * Table format: 2-3 cột → duration | scope | detail (optional)
 */
export function extractWarrantyTerms(html: string | null | undefined): WarrantyTerm[] {
  if (!html?.trim()) return [];
  const sections = splitByH2(html);
  const target = sections.find((section) =>
    /th[ờo]i\s*h[ạa]n.*b[ảa]o\s*h[àa]nh/i.test(section.title)
  );
  if (!target) return [];

  const tableMatch = target.body.match(/<table\b[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return [];

  const rows = Array.from(tableMatch[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi));
  const terms: WarrantyTerm[] = [];
  for (const row of rows) {
    if (/<th\b/i.test(row[0])) continue;
    const cells = Array.from(row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((cell) =>
      stripHtml(cell[1] ?? '')
    );
    if (cells.length < 2 || !cells[0]) continue;
    const term: WarrantyTerm = { duration: cells[0], scope: cells[1] };
    if (cells[2]) term.detail = cells[2];
    terms.push(term);
  }
  return terms;
}

/** Parse timeline steps từ h2 "Quy trình..." + h3 items */
export function extractProcessSteps(html: string | null | undefined): ProcessStep[] {
  if (!html?.trim()) return [];
  const sections = splitByH2(html);
  const target = sections.find((section) => /quy\s*tr[ìi]nh/i.test(section.title));
  if (!target) return [];

  const items = splitByH3(target.body);
  return items.map((item, index) => {
    const number = String(index + 1).padStart(2, '0');
    const slaMatch = item.body.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    const description = slaMatch ? stripHtml(slaMatch[1] ?? '') : stripHtml(item.body);
    const slaInlineMatch = description.match(/(<\s*\d+\s*ngày|[\d-]+\s*ngày|trong\s+\d+\s*ngày)/i);
    return {
      number,
      title: item.title,
      description: description.replace(slaInlineMatch?.[0] ?? '', '').trim() || description,
      sla: slaInlineMatch?.[0]?.trim(),
      iconKey: pickIconFromTitle(item.title)
    };
  });
}

/** Parse 2 list "Được/Không" thành comparison */
export function extractComparisonLists(html: string | null | undefined): ComparisonList | null {
  if (!html?.trim()) return null;
  const sections = splitByH2(html);

  const positiveSection = sections.find((section) =>
    /^(được|được\s+bảo\s+hành|được\s+đổi|trường\s+hợp\s+được)/i.test(section.title)
  );
  const negativeSection = sections.find((section) =>
    /^(không|không\s+bảo\s+hành|không\s+đổi|trường\s+hợp\s+không)/i.test(section.title)
  );

  if (!positiveSection || !negativeSection) return null;

  function extractListItems(body: string): string[] {
    const ulMatch = body.match(/<ul\b[^>]*>([\s\S]*?)<\/ul>/i);
    if (!ulMatch) return [];
    return Array.from(ulMatch[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi))
      .map((m) => stripHtml(m[1] ?? ''))
      .filter(Boolean);
  }

  const positiveItems = extractListItems(positiveSection.body);
  const negativeItems = extractListItems(negativeSection.body);

  if (positiveItems.length === 0 && negativeItems.length === 0) return null;

  return {
    positive: { title: positiveSection.title, items: positiveItems },
    negative: { title: negativeSection.title, items: negativeItems }
  };
}

/** Parse 1 testimonial từ blockquote đầu tiên có cite */
export function extractTestimonial(html: string | null | undefined): Testimonial | null {
  if (!html?.trim()) return null;
  const match = html.match(/<blockquote\b([^>]*)>([\s\S]*?)<\/blockquote>/i);
  if (!match) return null;
  const attrs = match[1] ?? '';
  const body = match[2] ?? '';
  const citeMatch = attrs.match(/cite\s*=\s*"([^"]+)"/i);
  return {
    quote: stripHtml(body),
    attribution: citeMatch?.[1] ?? ''
  };
}

/**
 * Loại bỏ các section đã được parse ra block riêng — để render phần text còn lại
 * như nội dung tự do (intro, ghi chú, etc.) mà không bị duplicate.
 */
export function extractRemainderHtml(
  html: string | null | undefined,
  consumedH2Titles: string[]
): string {
  if (!html?.trim()) return '';
  if (consumedH2Titles.length === 0) return html;

  const consumed = new Set(consumedH2Titles.map((t) => t.trim().toLowerCase()));
  const sections = splitByH2(html);
  if (sections.length === 0) return html;

  const matches = Array.from(html.matchAll(/<h2\b[^>]*>[\s\S]*?<\/h2>/gi));
  const firstH2Index = matches[0]?.index ?? html.length;
  const prefix = html.slice(0, firstH2Index).trim();

  const kept = sections
    .filter((section) => !consumed.has(section.title.trim().toLowerCase()))
    .map((section) => `<h2>${section.title}</h2>\n${section.body}`);

  return [prefix, ...kept].filter(Boolean).join('\n').trim();
}
