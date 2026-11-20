import type { PublicFileSummary } from '@/types/contracts/public-site-shell';

const SERVICE_CONTEXT_PATTERN =
  /service|dich[-_\s]?vu|bao[-_\s]?tri|tu[-_\s]?van|thiet[-_\s]?ke|dao[-_\s]?tao|van[-_\s]?hanh|ky[-_\s]?thuat|cong[-_\s]?trinh|site|maintenance|training|consult|design|technical|project/i;

const PRODUCT_CATALOG_PATTERNS = [
  /^[a-z]{1,6}[-_\s]?\d{2,}[a-z0-9-]*[_-]?\d*\.(png|jpe?g|webp|avif)$/i,
  /\b(fld|lhb|led|lamp|driver|a\d{2,})[-_\d]/i,
  /[_-]0[1-9]\.(png|jpe?g|webp|avif)$/i
];

export function shouldUseServiceVisual(file: PublicFileSummary | null | undefined) {
  const filename = file?.original_filename?.trim() ?? '';
  const mimeType = file?.mime_type?.trim() ?? '';

  if (!filename || !mimeType.startsWith('image/')) {
    return false;
  }

  if (SERVICE_CONTEXT_PATTERN.test(filename)) {
    return true;
  }

  return !PRODUCT_CATALOG_PATTERNS.some((pattern) => pattern.test(filename));
}
