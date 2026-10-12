import sanitizeHtml from 'sanitize-html';

const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'hr', 'blockquote', 'pre', 'code', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'sub', 'sup', 'mark', 'small',
    'a', 'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col'
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    h1: ['id'],
    h2: ['id'],
    h3: ['id'],
    h4: ['id'],
    h5: ['id'],
    h6: ['id'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    td: ['colspan', 'rowspan', 'align'],
    th: ['colspan', 'rowspan', 'align', 'scope'],
    col: ['span'],
    colgroup: ['span'],
    '*': ['class', 'style']
  },
  allowedStyles: {
    '*': {
      'text-align': [/^(left|right|center|justify)$/],
      color: [/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i],
      'background-color': [
        /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i,
        /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i
      ]
    }
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: 'noopener noreferrer nofollow' }
    })
  }
};

/** Mirrors the API rich-text policy for public rendering and drafts that have not reached the API yet. */
export function sanitizeRichTextHtml(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const html = value.trim();
  return html ? sanitizeHtml(html, RICH_TEXT_OPTIONS) : null;
}
