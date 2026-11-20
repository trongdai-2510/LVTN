import { resolvePublicFileSource } from '@/lib/public-file';
import type {
  PublicCompanyInfo,
  PublicSocialLink
} from '@/types/contracts/public-site-shell';

const PLACEHOLDER_VALUE_PATTERN = /example\.com|first-save flow|\bqa\b|\btest\b/i;
const DISALLOWED_HOSTS = new Set(['example.com', 'www.example.com', 'localhost', '127.0.0.1']);
const PUBLIC_SOCIAL_PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  messenger: 'Messenger',
  youtube: 'YouTube',
  zalo: 'Zalo',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  twitter: 'X',
  x: 'X',
  website: 'Website'
};

function getPublicValue(value: string | null | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  return PLACEHOLDER_VALUE_PATTERN.test(trimmedValue) ? null : trimmedValue;
}

export function getPublicSafeUrl(value: string | null | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    const url = new URL(trimmedValue);
    const hostname = url.hostname.toLowerCase();

    if (!['http:', 'https:'].includes(url.protocol) || DISALLOWED_HOSTS.has(hostname)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function getPublicCompanyName(companyInfo: PublicCompanyInfo | null | undefined) {
  return (
    getPublicValue(companyInfo?.display_name) ||
    getPublicValue(companyInfo?.legal_name) ||
    'Song Thanh'
  );
}

export function getPublicCompanyLegalName(companyInfo: PublicCompanyInfo | null | undefined) {
  return (
    getPublicValue(companyInfo?.legal_name) ||
    getPublicValue(companyInfo?.display_name) ||
    'Song Thanh'
  );
}

export function getPublicLogoSource(companyInfo: PublicCompanyInfo | null | undefined) {
  return resolvePublicFileSource(companyInfo?.logo_file);
}

export function getPublicFaviconSource(companyInfo: PublicCompanyInfo | null | undefined) {
  return resolvePublicFileSource(companyInfo?.favicon_file);
}

export function getPublicHotlines(companyInfo: PublicCompanyInfo | null | undefined) {
  const configuredHotlines = Array.isArray(companyInfo?.hotlines)
    ? companyInfo.hotlines
    : [];
  const candidates =
    configuredHotlines.length > 0
      ? configuredHotlines
      : [companyInfo?.hotline];

  return candidates.reduce<string[]>((hotlines, candidate) => {
    const hotline = getPublicValue(candidate);
    if (!hotline || hotlines.includes(hotline)) {
      return hotlines;
    }

    hotlines.push(hotline);
    return hotlines;
  }, []);
}

export function getPublicPrimaryHotline(companyInfo: PublicCompanyInfo | null | undefined) {
  return getPublicHotlines(companyInfo)[0] ?? null;
}

export function getPublicEmail(companyInfo: PublicCompanyInfo | null | undefined) {
  return getPublicValue(companyInfo?.email);
}

export function getPublicAddress(companyInfo: PublicCompanyInfo | null | undefined) {
  return getPublicValue(companyInfo?.address);
}

export function getPublicPhoneHref(value: string | null | undefined) {
  const hotline = getPublicValue(value);

  if (!hotline) {
    return null;
  }

  const normalized = hotline.replace(/[^\d+]/g, '');
  return normalized ? `tel:${normalized}` : null;
}

function normalizePublicSocialPlatform(value: string | null | undefined) {
  return value?.trim().toLowerCase() || '';
}

function getPublicSocialPlatformLabel(value: string | null | undefined) {
  const normalized = normalizePublicSocialPlatform(value);
  return PUBLIC_SOCIAL_PLATFORM_LABELS[normalized] || getPublicValue(value) || 'Liên kết ngoài';
}

export function getPublicSocialLinks(items: PublicSocialLink[]) {
  return items
    .filter((item) => item.status === 'active')
    .map((item) => {
      const label = getPublicValue(item.label) || getPublicValue(item.platform);
      const url = getPublicSafeUrl(item.url);

      if (!label || !url) {
        return null;
      }

      return {
        id: item.id,
        label,
        url,
        sort_order: item.sort_order,
        platform: normalizePublicSocialPlatform(item.platform),
        platform_label: getPublicSocialPlatformLabel(item.platform)
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => left.sort_order - right.sort_order);
}
