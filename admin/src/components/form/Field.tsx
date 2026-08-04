import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useId,
  useRef
} from 'react';

export function Field({
  label,
  children,
  hint,
  readOnly,
  required = false,
  error,
  htmlFor,
  fieldKey
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  readOnly?: boolean;
  required?: boolean;
  error?: string;
  htmlFor?: string;
  /**
   * Optional logical key that ties this field to a validation error key.
   * Emitted as `data-field` so scrollToFirstError() can locate the field by
   * the same key used in form validation maps.
   */
  fieldKey?: string;
}) {
  const fallbackId = useId();
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const controlId = htmlFor || fallbackId;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;

  // A visible field label must also be the accessible name of its control.
  // Most callers render one Input, Select, or Textarea directly. Give that
  // control a stable id when the caller has not supplied one, while preserving
  // explicit ids used by compound controls such as file pickers.
  const renderedChildren = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string }>, {
        id: (children.props as { id?: string }).id || controlId
      })
    : children;

  function focusExplicitControl() {
    if (typeof document === 'undefined') {
      return;
    }

    const target = document.getElementById(controlId);
    if (target instanceof HTMLElement) {
      target.focus();
      return;
    }

    // Some composite controls manage their own focus target. Keep the previous
    // helpful click-to-focus behavior for them while direct form controls gain
    // a real semantic label through htmlFor above.
    focusNestedControl();
  }

  function focusNestedControl() {
    const container = fieldRef.current;
    if (!container) {
      return;
    }

    const nextTarget = container.querySelector<HTMLElement>(
      'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]):not([data-field-label="true"]), [tabindex]:not([tabindex="-1"])'
    );

    nextTarget?.focus();
  }

  return (
    <div ref={fieldRef} className="block" data-field={fieldKey ?? controlId}>
      <div className="mb-1.5 flex items-center gap-2 text-[13px] font-medium leading-5 text-slate-700">
        <label htmlFor={controlId} onClick={focusExplicitControl}>
          {label}
        </label>
        {required ? (
          <span className="text-[11px] font-semibold normal-case tracking-normal text-red-600">
            *
          </span>
        ) : null}
        {readOnly ? (
          <span className="rounded-sm border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-slate-500">
            Chỉ đọc
          </span>
        ) : null}
      </div>
      {renderedChildren}
      {error ? (
        <span id={errorId} className="mt-1 block text-xs text-red-600">
          {error}
        </span>
      ) : null}
      {hint ? (
        <span id={hintId} className="mt-1 block text-xs text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
