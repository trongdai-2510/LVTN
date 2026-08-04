import type { PublicSpecGroup } from '@/types/contracts/public-product-groups';

type ProductSpecsProps = {
  sharedSpecGroups: PublicSpecGroup[];
  variantSpecGroups: PublicSpecGroup[];
  variantName: string | null;
  variantModelCode?: string | null;
};

function hasValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function sanitizeSpecGroups(groups: PublicSpecGroup[]): PublicSpecGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => hasValue(item.spec_name) && hasValue(item.spec_value)
      )
    }))
    .filter((group) => group.items.length > 0);
}

function renderSpecGroups(groups: PublicSpecGroup[]) {
  return groups.map((group) => (
    <div className="rounded-sm border border-borderSoft bg-white p-4 shadow-soft sm:p-6" key={group.id}>
      <h3 className="type-body-sm font-bold text-secondary">{group.group_name}</h3>
      <div className="mt-4 divide-y divide-borderSoft">
        {group.items.map((item) => (
          <div className="grid gap-1 py-2.5 sm:gap-2 sm:py-3 md:grid-cols-[220px_minmax(0,1fr)]" key={item.id}>
            <span className="text-[12px] font-bold leading-5 text-body sm:type-caption">{item.spec_name}</span>
            <span className="type-body-sm text-secondary">{item.spec_value}</span>
          </div>
        ))}
      </div>
    </div>
  ));
}

export function ProductSpecs({
  sharedSpecGroups,
  variantSpecGroups,
  variantName,
  variantModelCode
}: ProductSpecsProps) {
  const safeSharedSpecGroups = sanitizeSpecGroups(sharedSpecGroups);
  const safeVariantSpecGroups = sanitizeSpecGroups(variantSpecGroups);
  const hasSpecs = safeSharedSpecGroups.length > 0 || safeVariantSpecGroups.length > 0;
  const variantLabel = variantModelCode?.trim() || variantName?.trim() || null;

  if (!hasSpecs) return null;

  return (
    <section className="space-y-6">
      <div className="space-y-6">
        {safeSharedSpecGroups.length > 0 ? (
          <div className="space-y-4">
            <h3 className="type-body-sm font-bold uppercase tracking-[0.04em] text-primary">
              Thông số áp dụng chung
            </h3>
            {renderSpecGroups(safeSharedSpecGroups)}
          </div>
        ) : null}

        {safeVariantSpecGroups.length > 0 ? (
          <div className="space-y-4">
            <h3 className="type-body-sm font-bold uppercase tracking-[0.04em] text-primary">
              {variantLabel
                ? `Thông số theo biến thể ${variantLabel}`
                : 'Thông số theo biến thể'}
            </h3>
            {renderSpecGroups(safeVariantSpecGroups)}
          </div>
        ) : null}
      </div>
    </section>
  );
}
