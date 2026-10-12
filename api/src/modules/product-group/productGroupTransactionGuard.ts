import { HttpStatus } from '@nestjs/common';
import type { Knex } from 'knex';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';

const PRODUCT_GROUP_TABLE = 'product_group';
const PRODUCT_CATEGORY_TABLE = 'product_category';
const BRAND_TABLE = 'brand';

export interface ProductGroupReference {
  category_id: string;
  brand_id: string | null;
}

interface LockedProductCategoryReference {
  id: string;
  parent_id: string | null;
  status: string;
  deleted_at: Date | string | null;
}

interface LockedBrandReference {
  id: string;
  status: string;
  deleted_at: Date | string | null;
}

export interface LockedUsableProductGroup {
  id: string;
  category_id: string;
  brand_id: string | null;
  status: string;
  review_status: string;
  publish_status: string;
  deleted_at: Date | string | null;
}

/**
 * Serializes creation/restoration of active child records with product-group
 * archival. The service-level check remains useful for fast feedback; this
 * locked check is the authoritative guard after any concurrent writer waits.
 */
export async function lockUsableProductGroupForChildMutation(
  trx: Knex.Transaction,
  productGroupId: string
): Promise<LockedUsableProductGroup> {
  const row = await trx(PRODUCT_GROUP_TABLE)
    .where({ id: productGroupId })
    .forUpdate()
    .first<LockedUsableProductGroup>([
      'id',
      'category_id',
      'brand_id',
      'status',
      'review_status',
      'publish_status',
      'deleted_at'
    ]);

  if (!row || row.deleted_at || row.status !== 'active') {
    throw new AppError({
      code: ErrorCodes.NOT_FOUND,
      message: 'Product group was not found.',
      statusCode: HttpStatus.NOT_FOUND
    });
  }

  return row;
}

/**
 * Locks every category/brand row that controls product-group usability.
 *
 * Child categories, parent categories, and brands are each locked in sorted
 * order. Product-group/variant/quote writers call this only after their own
 * group locks, so concurrent ancestor changes are serialized without creating
 * inconsistent lock orders between those writers.
 */
export async function lockProductGroupReferenceRows(
  trx: Knex.Transaction,
  references: ProductGroupReference[]
): Promise<{
  categories: Map<string, LockedProductCategoryReference>;
  parents: Map<string, LockedProductCategoryReference>;
  brands: Map<string, LockedBrandReference>;
}> {
  const categoryIds = Array.from(
    new Set(references.map((reference) => reference.category_id))
  ).sort();
  const categoryRows = categoryIds.length > 0
    ? await trx(PRODUCT_CATEGORY_TABLE)
        .whereIn('id', categoryIds)
        .orderBy('id', 'asc')
        .forUpdate()
        .select<LockedProductCategoryReference[]>(
          'id',
          'parent_id',
          'status',
          'deleted_at'
        )
    : [];
  const categories = new Map(categoryRows.map((row) => [row.id, row]));

  const parentIds = Array.from(
    new Set(
      categoryRows
        .map((row) => row.parent_id)
        .filter((id): id is string => Boolean(id))
    )
  ).sort();
  const parentRows = parentIds.length > 0
    ? await trx(PRODUCT_CATEGORY_TABLE)
        .whereIn('id', parentIds)
        .orderBy('id', 'asc')
        .forUpdate()
        .select<LockedProductCategoryReference[]>(
          'id',
          'parent_id',
          'status',
          'deleted_at'
        )
    : [];
  const parents = new Map(parentRows.map((row) => [row.id, row]));

  const brandIds = Array.from(
    new Set(
      references
        .map((reference) => reference.brand_id)
        .filter((id): id is string => Boolean(id))
    )
  ).sort();
  const brandRows = brandIds.length > 0
    ? await trx(BRAND_TABLE)
        .whereIn('id', brandIds)
        .orderBy('id', 'asc')
        .forUpdate()
        .select<LockedBrandReference[]>('id', 'status', 'deleted_at')
    : [];
  const brands = new Map(brandRows.map((row) => [row.id, row]));

  return { categories, parents, brands };
}

/** Re-checks active level-2 category, active level-1 parent, and brand under lock. */
export async function lockAndAssertActiveProductGroupReferences(
  trx: Knex.Transaction,
  reference: ProductGroupReference
): Promise<void> {
  const locked = await lockProductGroupReferenceRows(trx, [reference]);
  const category = locked.categories.get(reference.category_id);
  if (!category || category.deleted_at || category.status !== 'active') {
    throw new AppError({
      code: ErrorCodes.NOT_FOUND,
      message: 'Referenced product category was not found.',
      statusCode: HttpStatus.NOT_FOUND
    });
  }
  if (!category.parent_id) {
    throw new AppError({
      code: 'PRODUCT_GROUP_CATEGORY_LEVEL_INVALID',
      message: 'Product group must be linked to a level-2 category.',
      statusCode: HttpStatus.CONFLICT
    });
  }

  const parent = locked.parents.get(category.parent_id);
  if (
    !parent ||
    parent.deleted_at ||
    parent.status !== 'active' ||
    parent.parent_id
  ) {
    throw new AppError({
      code: ErrorCodes.NOT_FOUND,
      message: 'Referenced level-1 product category was not found.',
      statusCode: HttpStatus.NOT_FOUND
    });
  }

  if (reference.brand_id) {
    const brand = locked.brands.get(reference.brand_id);
    if (!brand || brand.deleted_at || brand.status !== 'active') {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: 'Referenced brand was not found.',
        statusCode: HttpStatus.NOT_FOUND
      });
    }
  }
}

/** Re-checks the public-parent invariant while all authoritative locks are held. */
export async function assertLockedProductGroupReadyForPublishedVariant(
  trx: Knex.Transaction,
  group: LockedUsableProductGroup
): Promise<void> {
  await lockAndAssertActiveProductGroupReferences(trx, group);
  if (
    group.review_status === 'approved' &&
    group.publish_status === 'published'
  ) {
    return;
  }

  throw new AppError({
    code: 'PRODUCT_VARIANT_PUBLISH_REQUIRES_PUBLIC_GROUP',
    message:
      'Product variant cannot be published before its product group is approved and published.',
    statusCode: HttpStatus.CONFLICT,
    details: {
      product_group_id: group.id,
      product_group_review_status: group.review_status,
      product_group_publish_status: group.publish_status
    }
  });
}
