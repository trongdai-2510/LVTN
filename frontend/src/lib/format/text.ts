export function formatWorkingHours(
  from: string | null,
  to: string | null,
  workingDays?: string | null
): string | null {
  if (!from || !to) return null;
  const hours = `${from.slice(0, 5)} - ${to.slice(0, 5)}`;
  const days = workingDays?.trim() || 'Thứ 2 – Thứ 6';
  return `${days}: ${hours}`;
}
