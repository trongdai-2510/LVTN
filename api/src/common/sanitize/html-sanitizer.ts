import sanitizeHtml = require('sanitize-html');

/**
 * Cấu hình sanitize cho rich-text (content_html, extra_blocks, ...).
 * Cho phép các thẻ định dạng phổ biến của TipTap, chặn script/iframe/handler.
 */
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
      'background-color': [/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i]
    }
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  transformTags: {
    // Mọi link đều gắn rel an toàn (chặn reverse-tabnabbing).
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: 'noopener noreferrer nofollow' }
    })
  }
};

/**
 * Cấu hình sanitize riêng cho SVG (logo thương hiệu, icon).
 * Giữ nguyên hoa/thường tên thẻ-thuộc tính (viewBox, linearGradient, ...),
 * chỉ cho phép thẻ/thuộc tính trình bày, loại bỏ script/foreignObject/on* handler.
 */
const SVG_ALLOWED_ATTRIBUTES = [
  'xmlns', 'xmlns:xlink', 'version', 'viewBox', 'preserveAspectRatio',
  'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'transform', 'transform-origin',
  'fill', 'fill-rule', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-linecap',
  'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'stroke-miterlimit',
  'opacity', 'color', 'class', 'id', 'style',
  'offset', 'stop-color', 'stop-opacity',
  'gradientUnits', 'gradientTransform', 'spreadMethod',
  'clip-path', 'clip-rule', 'mask', 'filter',
  'patternUnits', 'patternContentUnits', 'markerWidth', 'markerHeight',
  'refX', 'refY', 'orient', 'markerUnits',
  'href', 'xlink:href', 'aria-hidden', 'role', 'focusable',
  'text-anchor', 'font-family', 'font-size', 'font-weight', 'letter-spacing', 'dominant-baseline'
];

const SVG_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
    'text', 'tspan', 'defs', 'linearGradient', 'radialGradient', 'stop',
    'clipPath', 'mask', 'pattern', 'use', 'symbol', 'title', 'desc',
    'filter', 'feGaussianBlur', 'feOffset', 'feBlend', 'feColorMatrix',
    'feMerge', 'feMergeNode', 'feFlood', 'feComposite', 'marker', 'metadata'
  ],
  allowedAttributes: { '*': SVG_ALLOWED_ATTRIBUTES },
  // SVG cần giữ nguyên case của tag/attr, không có thẻ nuốt text như <style>/<script>.
  parser: { lowerCaseTags: false, lowerCaseAttributeNames: false },
  // Chỉ cho href trỏ http(s) hoặc tham chiếu nội bộ (#id); chặn javascript:, data:.
  allowedSchemes: ['http', 'https'],
  allowProtocolRelative: false,
  // Loại bỏ hẳn nội dung của các thẻ nguy hiểm nếu xuất hiện.
  disallowedTagsMode: 'discard'
};

/**
 * Làm sạch rich-text HTML trước khi lưu / trước khi trả ra public.
 * Giữ nguyên null; chuỗi rỗng/whitespace trả về ''.
 */
export function sanitizeRichTextHtml(html: string): string;
export function sanitizeRichTextHtml(html: string | null | undefined): string | null;
export function sanitizeRichTextHtml(html: string | null | undefined): string | null {
  if (html === null || html === undefined) {
    return null;
  }
  if (typeof html !== 'string') {
    return null;
  }
  if (!html.trim()) {
    return '';
  }
  return sanitizeHtml(html, RICH_TEXT_OPTIONS);
}

/**
 * Làm sạch markup SVG (giữ logo vector hiển thị được, loại bỏ script/handler).
 * Ném lỗi caller xử lý nếu kết quả rỗng (SVG không hợp lệ / toàn nội dung độc).
 */
export function sanitizeSvgMarkup(svg: string): string {
  return sanitizeHtml(svg, SVG_OPTIONS);
}
