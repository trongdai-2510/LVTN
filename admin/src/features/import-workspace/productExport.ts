export function pairProductVariants<
  TGroup extends { id?: unknown },
  TVariant extends { product_group_id?: unknown }
>(groups: TGroup[], variants: TVariant[]) {
  const variantsByGroup = new Map<string, TVariant[]>();

  for (const variant of variants) {
    const groupId = variant.product_group_id;
    if (typeof groupId !== 'string' || !groupId) continue;
    const groupVariants = variantsByGroup.get(groupId) ?? [];
    groupVariants.push(variant);
    variantsByGroup.set(groupId, groupVariants);
  }

  return groups.flatMap((group) => {
    const groupVariants = variantsByGroup.get(String(group.id ?? '')) ?? [];
    return (groupVariants.length > 0 ? groupVariants : [null]).map((variant) => ({
      group,
      variant
    }));
  });
}

export function indexProductDocuments<
  TDocument extends { product_group_id?: unknown; product_variant_id?: unknown }
>(documents: TDocument[]) {
  const groupDocuments = new Map<string, TDocument[]>();
  const variantDocuments = new Map<string, TDocument[]>();

  for (const document of documents) {
    const groupId = document.product_group_id;
    if (typeof groupId !== 'string' || !groupId) continue;
    const variantId = document.product_variant_id;
    const target = typeof variantId === 'string' && variantId ? variantDocuments : groupDocuments;
    const key = target === variantDocuments ? variantId as string : groupId;
    const entries = target.get(key) ?? [];
    entries.push(document);
    target.set(key, entries);
  }

  return (groupId: unknown, variantId: unknown) => [
    ...(groupDocuments.get(String(groupId ?? '')) ?? []),
    ...(variantDocuments.get(String(variantId ?? '')) ?? []).filter(
      (document) => document.product_group_id === groupId
    )
  ];
}
