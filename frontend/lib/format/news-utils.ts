export interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

export function calcReadingTime(html: string): number {
  const text = html.replace(/<[^>]+>/g, '');
  return Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length / 200));
}

export function extractHeadings(html: string): Heading[] {
  const headings: Heading[] = [];
  const regex = /<h([23])[^>]*>(.*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  const usedIds = new Set<string>();

  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1], 10) as 2 | 3;
    const rawText = match[2].replace(/<[^>]+>/g, '').trim();
    if (!rawText) continue;

    let baseId = rawText
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0111/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 64);

    let id = baseId;
    let counter = 1;
    while (usedIds.has(id)) {
      id = `${baseId}-${counter++}`;
    }
    usedIds.add(id);
    headings.push({ id, text: rawText, level });
  }

  return headings;
}

export function injectHeadingIds(html: string): string {
  const usedIds = new Set<string>();

  return html.replace(/<h([23])([^>]*)>(.*?)<\/h\1>/gi, (_, levelStr: string, attrs: string, inner: string) => {
    const level = levelStr;
    const rawText = inner.replace(/<[^>]+>/g, '').trim();

    let baseId = rawText
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0111/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 64);

    let id = baseId;
    let counter = 1;
    while (usedIds.has(id)) {
      id = `${baseId}-${counter++}`;
    }
    usedIds.add(id);

    const cleanAttrs = attrs.replace(/\bid="[^"]*"/i, '').trim();
    return `<h${level} id="${id}"${cleanAttrs ? ' ' + cleanAttrs : ''}>${inner}</h${level}>`;
  });
}

export function formatNewsDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}
