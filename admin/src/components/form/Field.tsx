import {
  Children,
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
  const rootControl = isValidElement<FieldControlProps>(children) ? children : null;
  const controlId = htmlFor || rootControl?.props.id || fallbackId;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;

  // A visible field label must also be the accessible name of its control.
  // Most callers render one Input, Select, or Textarea directly. Give that
  // control a stable id when the caller has not supplied one, while preserving
  // explicit ids used by compound controls such as file pickers.
  const renderedChildren = enhanceFirstControl(children, {
    controlId,
    hintId: hint ? hintId : undefined,
    errorId: error ? errorId : undefined,
    required
  });

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
      <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold leading-5 text-slate-800">
        <label htmlFor={controlId} onClick={focusExplicitControl}>
          {label}
        </label>
        {required ? (
          <span aria-hidden="true" className="text-[11px] font-semibold normal-case tracking-normal text-red-600">
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
        <span id={errorId} role="alert" className="mt-1.5 block text-[13px] font-medium leading-5 text-red-700">
          {error}
        </span>
      ) : null}
      {hint ? (
        <span id={hintId} className="mt-1.5 block text-[13px] leading-5 text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

type FieldControlProps = {
  id?: string;
  children?: ReactNode;
  'aria-describedby'?: string;
  'aria-errormessage'?: string;
  'aria-invalid'?: boolean | 'false' | 'true' | 'grammar' | 'spelling';
  'aria-required'?: boolean | 'false' | 'true';
};

function enhanceFirstControl(
  children: ReactNode,
  options: {
    controlId: string;
    hintId?: string;
    errorId?: string;
    required: boolean;
  }
): ReactNode {
  let enhanced = false;

  function visit(node: ReactNode, isRoot: boolean): ReactNode {
    if (!isValidElement<FieldControlProps>(node)) return node;

    const element = node as ReactElement<FieldControlProps>;
    const nativeType = typeof element.type === 'string' ? element.type : null;
    const isNativeControl = nativeType
      ? ['input', 'select', 'textarea', 'button'].includes(nativeType)
      : false;
    const matchesExplicitId = Boolean(element.props.id && element.props.id === options.controlId);
    const isCustomRootControl = isRoot && nativeType === null;

    if (!enhanced && (matchesExplicitId || isNativeControl || isCustomRootControl)) {
      enhanced = true;
      const describedBy = joinAriaIds(
        element.props['aria-describedby'],
        options.hintId,
        options.errorId
      );
      return cloneElement(element, {
        id: element.props.id || options.controlId,
        'aria-describedby': describedBy,
        'aria-errormessage': options.errorId || element.props['aria-errormessage'],
        'aria-invalid': options.errorId ? true : element.props['aria-invalid'],
        'aria-required': options.required ? true : element.props['aria-required']
      });
    }

    if (element.props.children === undefined) return element;
    return cloneElement(
      element,
      {},
      Children.map(element.props.children, (child) => visit(child, false))
    );
  }

  return visit(children, true);
}

function joinAriaIds(...values: Array<string | undefined>): string | undefined {
  const ids = values
    .flatMap((value) => value?.split(/\s+/) ?? [])
    .map((value) => value.trim())
    .filter(Boolean);
  return ids.length ? Array.from(new Set(ids)).join(' ') : undefined;
}
