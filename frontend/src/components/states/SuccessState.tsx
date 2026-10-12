type SuccessStateProps = {
  title: string;
  description: string;
};

export function SuccessState({ title, description }: SuccessStateProps) {
  return (
    <div
      aria-live="polite"
      className="rounded-sm border border-green-200 bg-green-50 px-5 py-4 text-green-900"
      role="status"
    >
      <h3 className="type-body-sm font-bold">{title}</h3>
      <p className="type-body-sm mt-1">{description}</p>
    </div>
  );
}
