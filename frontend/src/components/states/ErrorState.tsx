type ErrorStateProps = {
  title: string;
  description: string;
};

export function ErrorState({ title, description }: ErrorStateProps) {
  return (
    <div
      className="rounded-sm border border-red-200 bg-red-50 px-5 py-4 text-red-900"
      role="alert"
    >
      <h3 className="type-body-sm font-bold">{title}</h3>
      <p className="type-body-sm mt-1">{description}</p>
    </div>
  );
}
