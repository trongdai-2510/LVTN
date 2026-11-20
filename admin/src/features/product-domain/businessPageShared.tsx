import { ReactNode } from 'react';
import { formatValue } from '@/lib/formatters';
import { extractRecord } from '@/features/shared/extract';

export type RecordMap = Record<string, unknown>;

export function TwoColumnGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

export function extractNestedRecord(detail: RecordMap, key: string) {
  const direct = detail[key];
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    return direct as RecordMap;
  }
  return extractRecord(detail);
}

export function asRecord(value: unknown): RecordMap {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordMap)
    : {};
}

export function recordCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

export function variantCodeSummary(row: RecordMap) {
  const modelCode = compactCode(row.model_code);
  if (modelCode) return `Model ${modelCode}`;

  const externalCode = compactCode(row.external_code);
  if (externalCode) return `Mã ngoài ${externalCode}`;

  const sku = compactCode(row.sku);
  if (sku) return `SKU ${sku}`;

  return undefined;
}

export function formatVariantOption(row: RecordMap) {
  const name = formatValue(row.variant_name);
  const modelCode = String(row.model_code ?? '').trim();
  const externalCode = String(row.external_code ?? '').trim();
  const sku = String(row.sku ?? '').trim();
  const identity = modelCode
    ? `Model ${modelCode}`
    : externalCode
      ? `Mã ngoài ${externalCode}`
      : sku
        ? `SKU ${sku}`
        : undefined;
  return identity ? `${name} · ${identity}` : name;
}

export function variantAccessibleIdentity(row: RecordMap) {
  const parts = [formatValue(row.variant_name)];
  const modelCode = String(row.model_code ?? '').trim();
  const sku = String(row.sku ?? '').trim();
  const externalCode = String(row.external_code ?? '').trim();

  if (modelCode) parts.push(`model ${modelCode}`);
  if (sku) parts.push(`SKU ${sku}`);
  if (externalCode) parts.push(`mã ngoài ${externalCode}`);

  return parts.join(', ');
}

function compactCode(value: unknown) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= 18) return text;
  return `${text.slice(0, 10)}...${text.slice(-4)}`;
}

export function formatPriceMode(value: unknown) {
  return value === 'public_price' ? 'Có giá công khai' : 'Liên hệ để báo giá';
}

export function statusTone(
  value: unknown
): 'default' | 'active' | 'inactive' | 'archived' | 'success' | 'warning' | 'info' | 'danger' {
  const status = String(value || '').toLowerCase();
  if (['published', 'approved', 'applied', 'resolved'].includes(status)) return 'success';
  if (['active'].includes(status)) return 'active';
  if (['inactive', 'unpublished'].includes(status)) return 'inactive';
  if (['archived', 'deleted'].includes(status)) return 'archived';
  if (['pending', 'pending_review', 'draft', 'in_review'].includes(status)) return 'warning';
  if (['rejected', 'invalid', 'failed'].includes(status)) return 'danger';
  return 'info';
}

export function formatCurrency(value: unknown) {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Chưa có giá';
  }

  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(amount);
}

export function canPreviewPublicPrice(value: string) {
  const amount = Number(value);
  return value.trim() !== '' && Number.isSafeInteger(amount) && amount > 0 && amount <= 2_147_483_647;
}
