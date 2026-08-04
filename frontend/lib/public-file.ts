import type { PublicFileSummary } from '@/types/contracts/public-site-shell';

export function resolvePublicFileSource(file: PublicFileSummary | null | undefined): string | null {
  const publicUrl = file?.url?.trim();

  if (!publicUrl) {
    return null;
  }

  if (
    publicUrl.startsWith('http://') ||
    publicUrl.startsWith('https://') ||
    publicUrl.startsWith('data:image/') ||
    publicUrl.startsWith('/')
  ) {
    return publicUrl;
  }

  return null;
}

export function formatCurrencyVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
}
