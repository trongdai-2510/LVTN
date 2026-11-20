import {
  cloneElement,
  isValidElement,
  useId,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode
} from 'react';

type FormFieldProps = PropsWithChildren<{
  htmlFor?: string;
  label: string;
  required?: boolean;
  helper?: ReactNode;
  error?: string | null;
}>;

export function FormField({
  children,
  htmlFor,
  label,
  required = false,
  helper,
  error
}: FormFieldProps) {
  const generatedId = useId();
  const generatedDescriptionId = useId();
  const control = isValidElement<FormControlProps>(children)
    ? (children as ReactElement<FormControlProps>)
    : null;
  const controlId = htmlFor ?? control?.props.id ?? generatedId;
  const descriptionId = error || helper ? generatedDescriptionId : undefined;
  const describedBy = [control?.props['aria-describedby'], descriptionId]
    .filter(Boolean)
    .join(' ') || undefined;
  const renderedControl = control
    ? cloneElement(control, {
        id: controlId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : control.props['aria-invalid'],
        'aria-required': required ? true : control.props['aria-required']
      })
    : children;

  return (
    <div className="type-body-sm flex w-full flex-col gap-2 text-text">
      <label className="type-label text-slate-700" htmlFor={controlId}>
        {label}
        {required ? <span aria-hidden="true" className="ml-1 text-error">*</span> : null}
      </label>
      {renderedControl}
      {error ? (
        <span id={descriptionId} className="type-body-sm text-error">
          {error}
        </span>
      ) : null}
      {!error && helper ? (
        <span id={descriptionId} className="type-body-sm text-muted">
          {helper}
        </span>
      ) : null}
    </div>
  );
}

type FormControlProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'false' | 'true' | 'grammar' | 'spelling';
  'aria-required'?: boolean | 'false' | 'true';
};
