const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

export function isSafeNavigationTarget(value: string): boolean {
  const target = value.trim();
  if (!target || target.length > 2048 || CONTROL_CHARACTER_PATTERN.test(target)) {
    return false;
  }
  if (target.startsWith('/')) {
    return !target.startsWith('//') && !target.includes('\\');
  }
  if (target.startsWith('#')) return target.length > 1;
  try {
    const parsed = new URL(target);
    return (
      ['http:', 'https:'].includes(parsed.protocol) &&
      parsed.username === '' &&
      parsed.password === ''
    );
  } catch {
    return false;
  }
}
