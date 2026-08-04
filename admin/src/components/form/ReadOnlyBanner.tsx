export function ReadOnlyBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
      {children}
    </div>
  );
}
