/**
 * Scroll to and focus the first form field that has a validation error.
 *
 * Lookup order (first hit wins):
 *   1. [data-field="<key>"]   — preferred, wraps the whole Field component
 *   2. [name="<key>"]
 *   3. #<key>
 *
 * The function attempts to focus a real <input>/<select>/<textarea>/[tabindex]
 * inside the matched element after the scroll completes, so the user sees the
 * cursor land on the field they need to fix.
 *
 * Returns true when a field was located so callers can decide whether to also
 * surface a global toast.
 */
export function scrollToFirstError(
  container: HTMLElement | Document | null,
  errorKeys: Iterable<string>,
  options: { focus?: boolean } = {}
): boolean {
  if (!container) return false;
  const shouldFocus = options.focus ?? true;
  const root: ParentNode = container;
  const keys = Array.from(errorKeys).filter((value) => typeof value === 'string' && value.length > 0);
  if (keys.length === 0) return false;

  for (const rawKey of keys) {
    const key = rawKey;
    const escaped = typeof (window as unknown as { CSS?: { escape?: (value: string) => string } }).CSS?.escape === 'function'
      ? window.CSS.escape(key)
      : key.replace(/[^a-zA-Z0-9_-]/g, '\\$&');

    const candidate =
      root.querySelector<HTMLElement>(`[data-field="${escaped}"]`) ??
      root.querySelector<HTMLElement>(`[name="${escaped}"]`) ??
      (() => {
        try {
          return root.querySelector<HTMLElement>(`#${escaped}`);
        } catch {
          return null;
        }
      })() ??
      // Fuzzy fallbacks: many admin pages use `entity-field` ids while their
      // validation maps use the bare field name. Trailing-dash match covers
      // common cases (banner-title, service-slug, …).
      root.querySelector<HTMLElement>(`[data-field$="-${escaped}"]`) ??
      root.querySelector<HTMLElement>(`[id$="-${escaped}"]`);

    if (!candidate) continue;

    candidate.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (!shouldFocus) {
      return true;
    }

    // After the smooth scroll settles, focus the first interactive descendant
    // (or the candidate itself if it's interactive).
    window.setTimeout(() => {
      const focusTarget =
        candidate.matches?.('input, select, textarea, [tabindex]')
          ? candidate
          : candidate.querySelector<HTMLElement>(
              'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
      if (focusTarget) {
        try {
          focusTarget.focus({ preventScroll: true });
        } catch {
          focusTarget.focus();
        }
      }
    }, 280);

    return true;
  }

  return false;
}
