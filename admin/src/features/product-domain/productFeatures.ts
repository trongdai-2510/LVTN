export type ProductFeature = {
  title: string;
  description: string;
};

export type ProductFeatureDraft = {
  content: string;
  features: ProductFeature[];
  source: 'managed' | 'legacy' | 'none' | 'invalid';
};

const START = '[[PRODUCT_FEATURES_V1]]';
const END = '[[/PRODUCT_FEATURES_V1]]';
const LEGACY_TITLES = [
  'Cấu Trúc Chắc Chắn, Bền Bỉ',
  'An Toàn Cao, Chống Nhiễu',
  'Chịu Được Môi Trường Khắc Nghiệt',
  'Tiết Kiệm Chi Phí, Dễ Lắp Đặt'
];

function managedRange(value: string) {
  const start = value.indexOf(START);
  const end = start < 0 ? -1 : value.indexOf(END, start + START.length);
  return start >= 0 && end >= 0 ? { start, end: end + END.length } : null;
}

function legacyRange(value: string) {
  const heading = /Đặc Điểm Nổi Bật(?!\s+của)/i.exec(value);
  if (!heading || heading.index === undefined) return null;

  const start = heading.index;
  const bodyStart = start + heading[0].length;
  const following = value.slice(bodyStart);
  const technical = /Mã hàng|ĐẶC TÍNH KỸ THUẬT|TIÊU CHUẨN ÁP DỤNG|NHẬN BIẾT LÕI|CẤU TRÚC CÁP/i.exec(following);
  let end = technical?.index === undefined ? value.length : bodyStart + technical.index;

  if (technical?.[0].toLocaleLowerCase('vi-VN') === 'mã hàng') {
    const beforeCatalog = value.slice(bodyStart, end);
    const lastSentence = beforeCatalog.lastIndexOf('. ');
    const catalogContext = lastSentence < 0 ? '' : beforeCatalog.slice(lastSentence + 2).trim();
    if (/^Lựa chọn\b/i.test(catalogContext) && catalogContext.length <= 120) {
      end = bodyStart + lastSentence + 2;
    }
  }

  const body = value.slice(bodyStart, end);
  const titlePattern = new RegExp(LEGACY_TITLES.join('|'), 'gi');
  const matches = [...body.matchAll(titlePattern)];
  if (matches.length < 2 || (matches[0].index ?? 0) > 30) return null;

  const features = matches.map((match, index) => ({
    title: match[0],
    description: body.slice(
      (match.index ?? 0) + match[0].length,
      matches[index + 1]?.index ?? body.length
    ).trim()
  }));
  if (features.some((feature) => !feature.description)) return null;
  return { start, end, features };
}

export function readProductFeatures(value: string): ProductFeatureDraft {
  const managed = managedRange(value);
  if (value.includes(START) && !managed) {
    return { content: value, features: [], source: 'invalid' };
  }
  if (managed) {
    try {
      const parsed: unknown = JSON.parse(value.slice(managed.start + START.length, managed.end - END.length).trim());
      if (!Array.isArray(parsed) || !parsed.every((item) =>
        item && typeof item === 'object' && typeof item.title === 'string' && typeof item.description === 'string'
      )) {
        throw new Error('Invalid product features');
      }
      const before = value.slice(0, managed.start);
      return {
        content: `${before.endsWith('\n\n') ? before.slice(0, -2) : before}${value.slice(managed.end)}`,
        features: parsed.map((item) => ({ title: item.title, description: item.description })),
        source: 'managed'
      };
    } catch {
      return { content: value, features: [], source: 'invalid' };
    }
  }

  const legacy = legacyRange(value);
  if (legacy) {
    return {
      content: `${value.slice(0, legacy.start)}${value.slice(legacy.end)}`.trimEnd(),
      features: legacy.features,
      source: 'legacy'
    };
  }

  return { content: value, features: [], source: 'none' };
}

export function writeProductFeatures(content: string, features: ProductFeature[]): string {
  if (features.length === 0) return content;
  const marker = `${START}\n${JSON.stringify(features)}\n${END}`;
  return content ? `${content}\n\n${marker}` : marker;
}
