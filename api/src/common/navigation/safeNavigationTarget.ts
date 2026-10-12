const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

const SAFE_NAVIGATION_TARGET_MAX_LENGTH = 2048;

/**
 * Accept only navigation targets that browsers can follow without executing
 * script-like schemes. Site-relative paths, page anchors, and credential-free
 * HTTP(S) URLs are supported.
 */
export function normalizeSafeNavigationTarget(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const target = value.trim();
  if (
    !target ||
    target.length > SAFE_NAVIGATION_TARGET_MAX_LENGTH ||
    CONTROL_CHARACTER_PATTERN.test(target)
  ) {
    return null;
  }

  if (target.startsWith('/')) {
    return target.startsWith('//') || target.includes('\\') ? null : target;
  }

  if (target.startsWith('#')) {
    return target.length > 1 ? target : null;
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return null;
  }

  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username !== '' ||
    parsed.password !== ''
  ) {
    return null;
  }
  return target;
}
