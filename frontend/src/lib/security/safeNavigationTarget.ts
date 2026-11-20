const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const MAX_NAVIGATION_TARGET_LENGTH = 2048;

export function normalizePublicNavigationTarget(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') return null;
  const target = value.trim();
  if (
    !target ||
    target.length > MAX_NAVIGATION_TARGET_LENGTH ||
    CONTROL_CHARACTER_PATTERN.test(target)
  ) {
    return null;
  }
  if (target.startsWith('/')) {
    return target.startsWith('//') || target.includes('\\') ? null : target;
  }
  if (target.startsWith('#')) return target.length > 1 ? target : null;

  try {
    const parsed = new URL(target);
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username !== '' ||
      parsed.password !== ''
    ) {
      return null;
    }
    return target;
  } catch {
    return null;
  }
}
