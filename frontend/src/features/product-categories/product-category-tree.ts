import type { PublicProductCategory } from '@/types/contracts/public-product-categories';

export type ProductCategoryTreeNode = PublicProductCategory & {
  children: ProductCategoryTreeNode[];
};

type FlattenedProductCategoryNode = {
  category: ProductCategoryTreeNode;
  depth: number;
};

function normalizePublicCategorySlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

export function getPublicProductCategorySlug(
  category: Pick<PublicProductCategory, 'name' | 'slug'>
): string {
  return normalizePublicCategorySlug(category.slug) || normalizePublicCategorySlug(category.name);
}

function compareCategories(
  left: Pick<PublicProductCategory, 'sort_order' | 'name'>,
  right: Pick<PublicProductCategory, 'sort_order' | 'name'>
) {
  if (left.sort_order !== right.sort_order) {
    return left.sort_order - right.sort_order;
  }

  return left.name.localeCompare(right.name, 'vi', { sensitivity: 'base' });
}

export function sortProductCategories<T extends Pick<PublicProductCategory, 'sort_order' | 'name'>>(
  categories: readonly T[]
): T[] {
  return [...categories].sort(compareCategories);
}

export function buildProductCategoryTree(
  categories: readonly PublicProductCategory[]
): ProductCategoryTreeNode[] {
  const sortedCategories = sortProductCategories(categories);
  const nodeMap = new Map<string, ProductCategoryTreeNode>();

  for (const category of sortedCategories) {
    nodeMap.set(category.id, {
      ...category,
      children: []
    });
  }

  const roots: ProductCategoryTreeNode[] = [];

  for (const category of sortedCategories) {
    const node = nodeMap.get(category.id);

    if (!node) {
      continue;
    }

    if (category.parent_id && nodeMap.has(category.parent_id)) {
      nodeMap.get(category.parent_id)?.children.push(node);
      continue;
    }

    roots.push(node);
  }

  return roots;
}

function flattenProductCategoryTree(
  nodes: readonly ProductCategoryTreeNode[],
  depth = 0
): FlattenedProductCategoryNode[] {
  const flattened: FlattenedProductCategoryNode[] = [];

  for (const node of nodes) {
    flattened.push({
      category: node,
      depth
    });

    if (node.children.length > 0) {
      flattened.push(...flattenProductCategoryTree(node.children, depth + 1));
    }
  }

  return flattened;
}

export function createProductCategoryNodeMap(
  nodes: readonly ProductCategoryTreeNode[]
): Map<string, ProductCategoryTreeNode> {
  return new Map(
    flattenProductCategoryTree(nodes).map(({ category }) => [category.id, category])
  );
}

export function createProductCategorySlugMap(
  nodes: readonly ProductCategoryTreeNode[]
): Map<string, ProductCategoryTreeNode> {
  const slugMap = new Map<string, ProductCategoryTreeNode>();

  for (const { category } of flattenProductCategoryTree(nodes)) {
    slugMap.set(category.slug, category);

    const publicSlug = getPublicProductCategorySlug(category);
    if (publicSlug !== category.slug) {
      slugMap.set(publicSlug, category);
    }
  }

  return slugMap;
}

export function getProductCategoryNodeOrNull(
  nodeMap: ReadonlyMap<string, ProductCategoryTreeNode>,
  categoryId: string
): ProductCategoryTreeNode | null {
  return nodeMap.get(categoryId) ?? null;
}

export function getProductCategoryNodeBySlugOrNull(
  slugMap: ReadonlyMap<string, ProductCategoryTreeNode>,
  slug: string
): ProductCategoryTreeNode | null {
  return slugMap.get(slug) ?? null;
}

export function findProductCategoryRoot(
  nodeMap: ReadonlyMap<string, ProductCategoryTreeNode>,
  categoryId: string
): ProductCategoryTreeNode | null {
  let currentNode = getProductCategoryNodeOrNull(nodeMap, categoryId);

  while (currentNode?.parent_id) {
    currentNode = getProductCategoryNodeOrNull(nodeMap, currentNode.parent_id);
  }

  return currentNode;
}

export function getProductCategoryPath(
  nodeMap: ReadonlyMap<string, ProductCategoryTreeNode>,
  categoryId: string
): ProductCategoryTreeNode[] {
  const path: ProductCategoryTreeNode[] = [];
  let currentNode = getProductCategoryNodeOrNull(nodeMap, categoryId);

  while (currentNode) {
    path.unshift(currentNode);

    if (!currentNode.parent_id) {
      break;
    }

    currentNode = getProductCategoryNodeOrNull(nodeMap, currentNode.parent_id);
  }

  return path;
}

export function isProductCategoryDescendant(
  nodeMap: ReadonlyMap<string, ProductCategoryTreeNode>,
  categoryId: string,
  ancestorCategoryId: string
): boolean {
  let currentNode = getProductCategoryNodeOrNull(nodeMap, categoryId);

  while (currentNode?.parent_id) {
    if (currentNode.parent_id === ancestorCategoryId) {
      return true;
    }

    currentNode = getProductCategoryNodeOrNull(nodeMap, currentNode.parent_id);
  }

  return false;
}
