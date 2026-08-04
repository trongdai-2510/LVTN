'use client';

import Link from 'next/link';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Archive, FolderTree, GitBranchPlus, ListTree, PackageSearch, Plus } from '@/components/icons';

import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { TableToolbar } from '@/components/data-table/TableToolbar';
import { FormFeedback } from '@/components/form/FormFeedback';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { apiClient } from '@/lib/api-client';
import { byId, endpoints } from '@/lib/api-endpoints';
import { formatDate, formatValue } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { extractItems, extractPagination } from '@/features/shared/extract';
import { usePermissions } from '@/features/auth/useAuthState';

type CategoryRecord = Record<string, unknown>;
type CategoryScope = 'main' | 'sub';
type CategoryFilterState = {
  status: string;
  deleted_scope: 'active' | 'deleted' | 'all';
  updated_on: string;
  parent_id: string;
  child_state: string;
  product_group_state: string;
};

type TreeNode = {
  root: CategoryRecord;
  children: CategoryRecord[];
};

export function ProductCategoryOverviewPage() {
  const permissions = usePermissions();
  const canCreate = permissions.includes(PERMISSIONS.productCategoryCreate);
  const canArchive = permissions.includes(PERMISSIONS.productCategoryArchive);
  const [reloadKey, setReloadKey] = useState(0);
  const { categories, loading, error } = useAllCategories(reloadKey);
  const archiveActions = useCategoryArchiveActions(() => setReloadKey((current) => current + 1));
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<CategoryFilterState>(() =>
    defaultCategoryFilters()
  );

  const roots = useMemo(() => categories.filter((category) => !category.parent_id), [categories]);
  const children = useMemo(
    () => categories.filter((category) => Boolean(category.parent_id)),
    [categories]
  );
  const childrenByParent = useMemo(() => groupChildrenByParent(children), [children]);

  const hasActiveFilters = hasActiveCategoryFilters(query, filters);
  const hasAdvancedFilters = Boolean(filters.child_state || filters.product_group_state);
  const treeNodes = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    return roots
      .map<TreeNode | null>((root) => {
        const allChildren = childrenByParent.get(String(root.id ?? '')) ?? [];
        const rootMatches =
          categoryMatchesFilters(root, filters, childrenByParent) &&
          matchesCategory(root, normalizedQuery);
        const matchingChildren = allChildren.filter(
          (child) =>
            categoryMatchesFilters(child, filters, childrenByParent) &&
            matchesCategory(child, normalizedQuery)
        );

        if (!rootMatches && matchingChildren.length === 0) {
          return null;
        }

        return {
          root,
          children: matchingChildren
        };
      })
      .filter((node): node is TreeNode => Boolean(node));
  }, [childrenByParent, filters, query, roots]);

  const totalProductGroups = useMemo(
    () =>
      categories.reduce(
        (sum, category) => sum + numberValue(category.active_product_group_count),
        0
      ),
    [categories]
  );

  return (
    <section className="space-y-4" data-product-category-overview="true">
      <div className="flex min-h-16 flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-[#c4c5d5] bg-panel text-primary">
            <FolderTree className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-[20px] font-semibold leading-7 tracking-tight text-text">
              Danh mục sản phẩm
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-[#444653]">Rà soát cây danh mục.</p>
          </div>
        </div>
        {canCreate ? (
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/product-categories/new?level=main" variant="secondary">
                <Plus className="h-4 w-4" />
                Tạo danh mục chính
            </LinkButton>
            <LinkButton href="/product-categories/new?level=sub">
                <Plus className="h-4 w-4" />
                Tạo danh mục con
            </LinkButton>
          </div>
        ) : null}
      </div>

      <FormFeedback
        successMessage={archiveActions.message}
        error={archiveActions.error}
        context="module-action"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={ListTree}
          title="Danh mục chính"
          value={roots.length}
          href="/product-categories/main"
        />
        <SummaryCard
          icon={GitBranchPlus}
          title="Danh mục con"
          value={children.length}
          href="/product-categories/sub"
        />
        <SummaryCard
          icon={PackageSearch}
          title="Nhóm sản phẩm"
          value={totalProductGroups}
          href="/product-groups"
        />
      </div>

      <Card className="overflow-hidden border-[#c4c5d5]">
        <TableToolbar
          value={query}
          onChange={setQuery}
          placeholder="Tìm trong cây danh mục..."
          hasActiveFilters={hasActiveFilters}
          onClear={() => {
            setQuery('');
            setFilters(defaultCategoryFilters());
          }}
        >
          <CategoryFilterField label="Ngày">
            <Input
              type="date"
              value={filters.updated_on}
              onChange={(event) =>
                setFilters((current) => ({ ...current, updated_on: event.target.value }))
              }
            />
          </CategoryFilterField>
          <CategoryFilterField label="Trạng thái">
            <Select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({ ...current, status: event.target.value }))
              }
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Tạm ngưng</option>
            </Select>
          </CategoryFilterField>
          <CategoryFilterField label="Hiển thị">
            <Select
              value={filters.deleted_scope}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  deleted_scope: event.target.value as CategoryFilterState['deleted_scope']
                }))
              }
            >
              <option value="active">Đang dùng</option>
              <option value="deleted">Đã lưu trữ</option>
              <option value="all">Tất cả</option>
            </Select>
          </CategoryFilterField>
          <CategoryFilterDetails defaultOpen={hasAdvancedFilters}>
            <CategoryFilterField label="Danh mục con">
              <Select
                value={filters.child_state}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, child_state: event.target.value }))
                }
              >
                <option value="">Tất cả</option>
                <option value="with_children">Có danh mục con</option>
                <option value="without_children">Chưa có danh mục con</option>
              </Select>
            </CategoryFilterField>
            <CategoryFilterField label="Nhóm sản phẩm">
              <Select
                value={filters.product_group_state}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    product_group_state: event.target.value
                  }))
                }
              >
                <option value="">Tất cả</option>
                <option value="with_product_groups">Có nhóm sản phẩm</option>
                <option value="without_product_groups">Chưa có nhóm sản phẩm</option>
              </Select>
            </CategoryFilterField>
          </CategoryFilterDetails>
        </TableToolbar>

        {loading ? (
          <CategoryOverviewSkeleton />
        ) : error ? (
          <div className="p-4">
            <ErrorState error={error} context="module-load" />
          </div>
        ) : treeNodes.length === 0 ? (
          <div className="p-4">
            <EmptyState description="Chưa có danh mục phù hợp với bộ lọc hiện tại." />
          </div>
        ) : (
          <div className="space-y-4 p-4" data-product-category-tree="true">
            {treeNodes.map(({ root, children: rootChildren }) => (
              <article
                key={String(root.id)}
                className="rounded-sm border border-border bg-panel px-4 py-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-text">
                        {formatValue(root.name)}
                      </h2>
                      <Badge tone="active">Danh mục chính</Badge>
                      {root.deleted_at ? <Badge tone="archived">Đã lưu trữ</Badge> : null}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {numberValue(rootChildren.length)} danh mục con ·{' '}
                      {numberValue(root.active_product_group_count)} nhóm sản phẩm
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/product-categories/${String(root.id)}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Xem chi tiết
                    </Link>
                    {!root.deleted_at && canArchive ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-700 hover:bg-red-50 hover:text-red-800"
                        data-product-delete-button="true"
                        disabled={archiveActions.pendingId === String(root.id)}
                        onClick={() => archiveActions.setConfirmId(String(root.id))}
                      >
                        {archiveActions.pendingId === String(root.id) ? 'Đang xóa' : 'Xóa'}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {rootChildren.length === 0 ? (
                  <div className="mt-4 rounded-sm border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                    Chưa có danh mục con dưới nhánh này.
                  </div>
                ) : (
                  <div className="mt-4 space-y-2 border-l border-border pl-4">
                    {rootChildren.map((child) => (
                      <div
                        key={String(child.id)}
                        className="flex flex-col gap-2 rounded-sm border border-border bg-muted/20 px-3 py-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-medium text-text">
                              {formatValue(child.name)}
                            </div>
                            <Badge tone="info">Danh mục con</Badge>
                            {child.deleted_at ? <Badge tone="archived">Đã lưu trữ</Badge> : null}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {numberValue(child.active_product_group_count)} nhóm sản phẩm · cập
                            nhật {formatDate(child.updated_at)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/product-categories/${String(child.id)}`}
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            Xem chi tiết
                          </Link>
                          {!child.deleted_at && canArchive ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-700 hover:bg-red-50 hover:text-red-800"
                              data-product-delete-button="true"
                              disabled={archiveActions.pendingId === String(child.id)}
                              onClick={() => archiveActions.setConfirmId(String(child.id))}
                            >
                              {archiveActions.pendingId === String(child.id) ? 'Đang xóa' : 'Xóa'}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(archiveActions.confirmId)}
        title="Xóa danh mục"
        description="Thao tác này sẽ lưu trữ mềm danh mục và ẩn khỏi danh sách đang dùng. Dữ liệu không bị xóa vĩnh viễn."
        confirmLabel="Xóa"
        onClose={() => archiveActions.setConfirmId(null)}
        onConfirm={() => archiveActions.confirmArchive()}
      />
    </section>
  );
}

export function ProductCategoryScopedListPage({ scope }: { scope: CategoryScope }) {
  const permissions = usePermissions();
  const canCreate = permissions.includes(PERMISSIONS.productCategoryCreate);
  const canArchive = permissions.includes(PERMISSIONS.productCategoryArchive);
  const [reloadKey, setReloadKey] = useState(0);
  const { categories, loading, error } = useAllCategories(reloadKey);
  const archiveActions = useCategoryArchiveActions(() => setReloadKey((current) => current + 1));
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<CategoryFilterState>(() =>
    defaultCategoryFilters()
  );

  const roots = useMemo(() => categories.filter((category) => !category.parent_id), [categories]);
  const children = useMemo(
    () => categories.filter((category) => Boolean(category.parent_id)),
    [categories]
  );
  const childrenByParent = useMemo(() => groupChildrenByParent(children), [children]);
  const parentNames = useMemo(
    () => new Map(roots.map((root) => [String(root.id), formatValue(root.name)])),
    [roots]
  );

  const items = useMemo(() => {
    const source = scope === 'main' ? roots : children;
    const normalizedQuery = normalizeSearch(query);
    return source.filter((category) => {
      if (!categoryMatchesFilters(category, filters, childrenByParent)) {
        return false;
      }
      if (scope === 'sub' && filters.parent_id && String(category.parent_id ?? '') !== filters.parent_id) {
        return false;
      }
      if (matchesCategory(category, normalizedQuery)) {
        return true;
      }
      if (scope === 'sub') {
        return normalizeSearch(parentNames.get(String(category.parent_id ?? ''))).includes(
          normalizedQuery
        );
      }
      return false;
    });
  }, [children, childrenByParent, filters, parentNames, query, roots, scope]);

  const title = scope === 'main' ? 'Danh mục chính' : 'Danh mục con';
  const subtitle =
    scope === 'main'
      ? 'Quản lý danh mục chính.'
      : 'Quản lý danh mục con.';
  const createHref =
    scope === 'main' ? '/product-categories/new?level=main' : '/product-categories/new?level=sub';
  const hasActiveFilters = hasActiveCategoryFilters(query, filters);
  const hasAdvancedFilters =
    scope === 'main'
      ? Boolean(filters.child_state || filters.product_group_state)
      : Boolean(filters.status || filters.product_group_state);

  return (
    <section className="space-y-4" data-product-category-scope={scope}>
      <div className="flex min-h-16 flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-[#c4c5d5] bg-panel text-primary">
            {scope === 'main' ? <ListTree className="h-5 w-5" /> : <GitBranchPlus className="h-5 w-5" />}
          </div>
          <div>
            <h1 className="text-[20px] font-semibold leading-7 tracking-tight text-text">
              {title}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-[#444653]">{subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/product-categories" variant="secondary">Xem cây danh mục</LinkButton>
          {canCreate ? (
            <LinkButton href={createHref}>
              
                <Plus className="h-4 w-4" />
                {scope === 'main' ? 'Tạo danh mục chính' : 'Tạo danh mục con'}
              
            </LinkButton>
          ) : null}
        </div>
      </div>

      <FormFeedback
        successMessage={archiveActions.message}
        error={archiveActions.error}
        context="module-action"
      />

      <Card className="overflow-hidden border-[#c4c5d5]">
        <TableToolbar
          value={query}
          onChange={setQuery}
          placeholder={
            scope === 'main'
              ? 'Tìm theo tên danh mục chính...'
              : 'Tìm theo tên danh mục con hoặc danh mục chính...'
          }
          hasActiveFilters={hasActiveFilters}
          onClear={() => {
            setQuery('');
            setFilters(defaultCategoryFilters());
          }}
        >
          {scope === 'sub' ? (
            <CategoryFilterField label="Danh mục chính">
              <Select
                value={filters.parent_id}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, parent_id: event.target.value }))
                }
              >
                <option value="">Tất cả danh mục chính</option>
                {roots.map((category) => (
                  <option key={String(category.id)} value={String(category.id)}>
                    {formatValue(category.name)}
                  </option>
                ))}
              </Select>
            </CategoryFilterField>
          ) : null}
          <CategoryFilterField label="Ngày">
            <Input
              type="date"
              value={filters.updated_on}
              onChange={(event) =>
                setFilters((current) => ({ ...current, updated_on: event.target.value }))
              }
            />
          </CategoryFilterField>
          {scope === 'main' ? (
            <CategoryFilterField label="Trạng thái">
              <Select
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, status: event.target.value }))
                }
              >
                <option value="">Tất cả trạng thái</option>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Tạm ngưng</option>
              </Select>
            </CategoryFilterField>
          ) : null}
          <CategoryFilterField label="Hiển thị">
            <Select
              value={filters.deleted_scope}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  deleted_scope: event.target.value as CategoryFilterState['deleted_scope']
                }))
              }
            >
              <option value="active">Đang dùng</option>
              <option value="deleted">Đã lưu trữ</option>
              <option value="all">Tất cả</option>
            </Select>
          </CategoryFilterField>
          <CategoryFilterDetails defaultOpen={hasAdvancedFilters}>
            {scope === 'main' ? (
              <>
                <CategoryFilterField label="Danh mục con">
                  <Select
                    value={filters.child_state}
                    onChange={(event) =>
                      setFilters((current) => ({ ...current, child_state: event.target.value }))
                    }
                  >
                    <option value="">Tất cả</option>
                    <option value="with_children">Có danh mục con</option>
                    <option value="without_children">Chưa có danh mục con</option>
                  </Select>
                </CategoryFilterField>
                <CategoryFilterField label="Nhóm sản phẩm">
                  <Select
                    value={filters.product_group_state}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        product_group_state: event.target.value
                      }))
                    }
                  >
                    <option value="">Tất cả</option>
                    <option value="with_product_groups">Có nhóm sản phẩm</option>
                    <option value="without_product_groups">Chưa có nhóm sản phẩm</option>
                  </Select>
                </CategoryFilterField>
              </>
            ) : (
              <>
                <CategoryFilterField label="Trạng thái">
                  <Select
                    value={filters.status}
                    onChange={(event) =>
                      setFilters((current) => ({ ...current, status: event.target.value }))
                    }
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="active">Đang hoạt động</option>
                    <option value="inactive">Tạm ngưng</option>
                  </Select>
                </CategoryFilterField>
                <CategoryFilterField label="Nhóm sản phẩm">
                  <Select
                    value={filters.product_group_state}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        product_group_state: event.target.value
                      }))
                    }
                  >
                    <option value="">Tất cả</option>
                    <option value="with_product_groups">Có nhóm sản phẩm</option>
                    <option value="without_product_groups">Chưa có nhóm sản phẩm</option>
                  </Select>
                </CategoryFilterField>
              </>
            )}
          </CategoryFilterDetails>
        </TableToolbar>

        {loading ? (
          <CategoryListSkeleton columns={scope === 'main' ? 6 : 6} />
        ) : error ? (
          <div className="p-4">
            <ErrorState error={error} context="module-load" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              description={
                scope === 'main'
                  ? 'Chưa có danh mục chính phù hợp với bộ lọc hiện tại.'
                  : 'Chưa có danh mục con phù hợp với bộ lọc hiện tại.'
              }
            />
          </div>
        ) : (
          <div className="admin-table-scroll overflow-x-auto">
            <table className="min-w-full table-fixed divide-y divide-border text-sm">
              <thead className="bg-muted">
                <tr>
                  {(scope === 'main'
                    ? ['Danh mục chính', 'Danh mục con', 'Số nhóm sản phẩm', 'Trạng thái', 'Cập nhật']
                    : ['Danh mục con', 'Danh mục chính', 'Số nhóm sản phẩm', 'Trạng thái', 'Cập nhật']
                  ).map((header) => (
                    <th
                      key={header}
                      className="h-[41px] whitespace-nowrap px-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#444653]"
                    >
                      {header}
                    </th>
                  ))}
                  <th className="h-[41px] w-[164px] px-4 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-[#444653]">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-panel">
                {items.map((category, index) => (
                  <tr key={String(category.id ?? index)} className="h-[52px] hover:bg-muted">
                    {scope === 'main' ? (
                      <>
                        <IdentityCell title={category.name} subtitle="Danh mục chính" />
                        <TextCell
                          value={`${numberValue(
                            (childrenByParent.get(String(category.id ?? '')) ?? []).length
                          )} danh mục con`}
                        />
                      </>
                    ) : (
                      <>
                        <IdentityCell title={category.name} subtitle="Danh mục con" />
                        <TextCell
                          value={parentNames.get(String(category.parent_id ?? '')) || 'Chưa có danh mục chính'}
                        />
                      </>
                    )}
                    <TextCell value={category.active_product_group_count ?? 0} />
                    <StatusCell value={category.status} archived={Boolean(category.deleted_at)} />
                    <TextCell value={formatDate(category.updated_at)} />
                    <td className="px-4 py-2 text-right align-middle">
                      <div className="flex items-center justify-end gap-1">
                        <LinkButton href={`/product-categories/${String(category.id)}`} variant="ghost" size="sm">
                          Xem
                        </LinkButton>
                        {!category.deleted_at && canArchive ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-700 hover:bg-red-50 hover:text-red-800"
                            data-product-delete-button="true"
                            disabled={archiveActions.pendingId === String(category.id)}
                            onClick={() => archiveActions.setConfirmId(String(category.id))}
                          >
                            {archiveActions.pendingId === String(category.id) ? 'Đang xóa' : 'Xóa'}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(archiveActions.confirmId)}
        title="Xóa danh mục"
        description="Thao tác này sẽ lưu trữ mềm danh mục và ẩn khỏi danh sách đang dùng. Dữ liệu không bị xóa vĩnh viễn."
        confirmLabel="Xóa"
        onClose={() => archiveActions.setConfirmId(null)}
        onConfirm={() => archiveActions.confirmArchive()}
      />
    </section>
  );
}

function useAllCategories(reloadKey = 0) {
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const items = await fetchAllCategories();
        if (active) {
          setCategories(items);
        }
      } catch (nextError) {
        if (active) {
          setError(nextError);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  return { categories, loading, error };
}

function useCategoryArchiveActions(onSuccess: () => void) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function confirmArchive() {
    if (!confirmId) {
      return;
    }

    try {
      setPendingId(confirmId);
      setError(null);
      setMessage('');
      await apiClient.post<unknown>(`${byId(endpoints.songThanh.productCategories, confirmId)}/archive`, {});
      setMessage('Đã xóa danh mục khỏi danh sách đang dùng.');
      onSuccess();
    } catch (nextError) {
      setError(nextError);
    } finally {
      setPendingId(null);
      setConfirmId(null);
    }
  }

  return {
    message,
    error,
    pendingId,
    confirmId,
    setConfirmId,
    confirmArchive
  };
}

function SummaryCard({
  icon: Icon,
  title,
  value,
  description,
  href
}: {
  icon: typeof FolderTree;
  title: string;
  value: number;
  description?: string;
  href: string;
}) {
  return (
    <Card className="border-[#c4c5d5] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-text">{title}</div>
          <div className="mt-1 text-[28px] font-semibold leading-none text-text">
            {value}
          </div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-[#c4c5d5] bg-panel text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {description ? <p className="mt-3 text-sm text-muted-foreground">{description}</p> : null}
      <Link href={href} className="mt-3 inline-flex text-sm font-medium text-primary hover:underline">
        Mở màn này
      </Link>
    </Card>
  );
}

async function fetchAllCategories() {
  const items: CategoryRecord[] = [];
  let page = 1;
  let pageCount = 1;

  do {
    const params = new URLSearchParams({
      page: String(page),
      page_size: '100',
      deleted_scope: 'all'
    });
    const result = await apiClient.get<unknown>(
      `${endpoints.songThanh.productCategories}?${params.toString()}`
    );
    const pageItems = extractItems(result);
    items.push(...pageItems);
    const pagination = extractPagination(result, pageItems.length);
    pageCount = Math.max(
      1,
      Math.ceil(
        Number(pagination.total || items.length) /
          Math.max(1, Number(pagination.page_size || 100))
      )
    );
    page += 1;
  } while (page <= pageCount);

  return items;
}

function defaultCategoryFilters(): CategoryFilterState {
  return {
    status: '',
    deleted_scope: 'active',
    updated_on: '',
    parent_id: '',
    child_state: '',
    product_group_state: ''
  };
}

function groupChildrenByParent(children: CategoryRecord[]) {
  const result = new Map<string, CategoryRecord[]>();
  for (const child of children) {
    const parentId = String(child.parent_id ?? '');
    if (!result.has(parentId)) {
      result.set(parentId, []);
    }
    result.get(parentId)?.push(child);
  }
  return result;
}

function normalizeSearch(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (char) => (char === 'đ' ? 'd' : 'D'))
    .toLowerCase()
    .trim();
}

function matchesCategory(category: CategoryRecord, query: string) {
  if (!query) {
    return true;
  }
  return normalizeSearch(category.name).includes(query);
}

function hasActiveCategoryFilters(query: string, filters: CategoryFilterState) {
  if (query.trim()) {
    return true;
  }
  return Object.entries(filters).some(([key, value]) =>
    key === 'deleted_scope' ? value !== 'active' : Boolean(value)
  );
}

function categoryMatchesFilters(
  category: CategoryRecord,
  filters: CategoryFilterState,
  childrenByParent: Map<string, CategoryRecord[]>
) {
  if (filters.deleted_scope === 'active' && category.deleted_at) {
    return false;
  }
  if (filters.deleted_scope === 'deleted' && !category.deleted_at) {
    return false;
  }
  if (filters.status && String(category.status ?? '') !== filters.status) {
    return false;
  }
  if (filters.updated_on && !matchesSelectedDay(category.updated_at, filters.updated_on)) {
    return false;
  }
  if (filters.child_state) {
    const childCount = numberValue((childrenByParent.get(String(category.id ?? '')) ?? []).length);
    if (filters.child_state === 'with_children' && childCount === 0) {
      return false;
    }
    if (filters.child_state === 'without_children' && childCount > 0) {
      return false;
    }
  }
  if (filters.product_group_state) {
    const groupCount = numberValue(category.active_product_group_count);
    if (filters.product_group_state === 'with_product_groups' && groupCount === 0) {
      return false;
    }
    if (filters.product_group_state === 'without_product_groups' && groupCount > 0) {
      return false;
    }
  }
  return true;
}

function matchesSelectedDay(value: unknown, selectedDate: string) {
  if (!value || typeof value !== 'string') {
    return false;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}` === selectedDate;
}

function numberValue(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function statusTone(value: unknown): 'default' | 'active' | 'inactive' | 'archived' | 'success' | 'warning' | 'info' | 'danger' {
  const normalized = String(value || '').toLowerCase();
  if (['published', 'approved', 'applied'].includes(normalized)) return 'success';
  if (normalized === 'active') return 'active';
  if (['inactive', 'unpublished'].includes(normalized)) return 'inactive';
  if (normalized === 'archived') return 'archived';
  if (['pending', 'draft', 'in_review'].includes(normalized)) return 'warning';
  if (['rejected', 'invalid'].includes(normalized)) return 'danger';
  return 'info';
}

function IdentityCell({ title, subtitle }: { title: unknown; subtitle?: string }) {
  return (
    <td className="px-4 py-2 align-middle">
      <div className="line-clamp-1 text-[13px] font-semibold text-text">
        {formatValue(title)}
      </div>
      {subtitle ? <div className="text-[12px] text-muted-foreground">{subtitle}</div> : null}
    </td>
  );
}

function TextCell({ value }: { value: unknown }) {
  return (
    <td className="px-4 py-2 align-middle text-[13px] text-slate-700">
      {formatValue(value)}
    </td>
  );
}

function StatusCell({ value, archived = false }: { value: unknown; archived?: boolean }) {
  return (
    <td className="px-4 py-2 align-middle">
      <div className="flex flex-wrap gap-1.5">
        {archived ? <Badge tone="archived">Đã lưu trữ</Badge> : null}
        <Badge tone={statusTone(value)}>{formatValue(value)}</Badge>
      </div>
    </td>
  );
}

function CategoryFilterField({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-[160px]">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function CategoryFilterDetails({
  children,
  defaultOpen = false
}: {
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="min-w-[160px] rounded-sm border border-border bg-panel"
      open={defaultOpen}
      data-product-filter-advanced="true"
    >
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-text">
        Lọc thêm
      </summary>
      <div className="grid gap-3 border-t border-border px-3 py-3 md:grid-cols-2">
        {children}
      </div>
    </details>
  );
}

function CategoryOverviewSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-sm border border-border px-4 py-4">
          <div className="h-4 w-48 rounded bg-border/60" />
          <div className="mt-2 h-3 w-40 rounded bg-border/50" />
          <div className="mt-4 space-y-2 border-l border-border pl-4">
            {Array.from({ length: 2 }).map((__, childIndex) => (
              <div key={childIndex} className="rounded-sm border border-border px-3 py-3">
                <div className="h-4 w-44 rounded bg-border/50" />
                <div className="mt-2 h-3 w-32 rounded bg-border/40" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CategoryListSkeleton({ columns }: { columns: number }) {
  return (
    <div className="space-y-0 p-0">
      <div
        className="grid h-[41px] gap-4 border-b border-border bg-muted px-4 py-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }).map((_, index) => (
          <div key={index} className="h-3 rounded bg-border/60" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 6 }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid h-[52px] items-center gap-4 px-4"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((__, columnIndex) => (
              <div key={columnIndex} className="h-4 rounded bg-border/50" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
