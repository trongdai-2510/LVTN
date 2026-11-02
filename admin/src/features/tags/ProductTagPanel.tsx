'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, X } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { usePermissions } from '@/features/auth/useAuthState';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { PERMISSIONS } from '@/lib/permissions';
import type { Tag } from './TagManager';
import { TagGlyph, tagToneClass } from './tagAppearance';

export function ProductTagPanel({ productId }: { productId: string }) {
  const permissions = usePermissions();
  const canRead = permissions.includes(PERMISSIONS.tagRead);
  const canUpdate = permissions.includes(PERMISSIONS.productGroupUpdate);
  const canCreate = permissions.includes(PERMISSIONS.tagCreate) && canUpdate;
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const productPath = endpoints.songThanh.productGroups + '/' + productId + '/tags';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [all, assigned] = await Promise.all([
        apiClient.get<{ items: Tag[] }>(endpoints.songThanh.tags),
        apiClient.get<{ items: Tag[] }>(productPath)
      ]);
      setTags(all.items);
      setSelectedIds(assigned.items.map((tag) => tag.id));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được nhãn sản phẩm.');
    } finally {
      setLoading(false);
    }
  }, [productPath]);

  useEffect(() => {
    if (canRead) void load();
    else setLoading(false);
  }, [canRead, load]);

  const selectedTags = useMemo(
    () => tags.filter((tag) => selectedIds.includes(tag.id) && !tag.deleted_at),
    [tags, selectedIds]
  );
  const available = useMemo(() => tags.filter((tag) =>
    !tag.deleted_at &&
    tag.status === 'active' &&
    !selectedIds.includes(tag.id) &&
    tag.name.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))
  ), [tags, selectedIds, query]);
  const duplicateName = tags.some((tag) =>
    !tag.deleted_at && tag.name.toLocaleLowerCase('vi') === query.trim().toLocaleLowerCase('vi')
  );

  async function persist(ids: string[], message: string) {
    if (ids.length > 12) { setError('Mỗi sản phẩm có tối đa 12 nhãn.'); return; }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await apiClient.put(productPath, { tag_ids: ids });
      setSelectedIds(ids);
      setQuery('');
      setNotice(message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không cập nhật được nhãn.');
    } finally {
      setSaving(false);
    }
  }

  async function createAndAttach() {
    const name = query.trim();
    if (!name || saving || !canCreate || duplicateName) return;
    if (selectedIds.length >= 12) { setError('Mỗi sản phẩm có tối đa 12 nhãn.'); return; }
    setSaving(true);
    setError('');
    setNotice('');
    let created: Tag | null = null;
    try {
      const result = await apiClient.post<{ tag: Tag }>(endpoints.songThanh.tags, { name });
      const newTag = result.tag;
      created = newTag;
      await apiClient.put(productPath, { tag_ids: [...selectedIds, newTag.id] });
      setTags((current) => [...current, newTag]);
      setSelectedIds((current) => [...current, newTag.id]);
      setQuery('');
      setNotice('Đã tạo và gắn nhãn “' + newTag.name + '”.');
    } catch (cause) {
      if (created) {
        const newTag = created;
        setTags((current) => [...current, newTag]);
        setNotice('Nhãn đã tạo. Chọn nhãn bên dưới để gắn lại vào sản phẩm.');
      }
      setError(cause instanceof Error ? cause.message : 'Không tạo được nhãn.');
    } finally {
      setSaving(false);
    }
  }

  if (!canRead) return null;

  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-text">Nhãn sản phẩm</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Chọn nhãn để gắn ngay. Khi đổi nhãn của sản phẩm đã công khai, hệ thống có thể đưa sản phẩm về chờ duyệt.
          </p>
        </div>
        <Link className="inline-flex min-h-10 items-center text-sm font-semibold text-primary hover:underline" href="/tags">Quản lý bộ nhãn</Link>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}
      {notice ? <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{notice}</p> : null}

      <section aria-label="Nhãn đang gắn" className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-text">Đang gắn</h3>
          <span className="text-sm text-muted-foreground">{selectedIds.length}/12 nhãn</span>
        </div>
        {loading ? <p className="text-sm text-muted-foreground" role="status">Đang tải nhãn...</p> : selectedTags.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-surface px-4 py-3 text-sm text-muted-foreground">Sản phẩm này chưa có nhãn.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <button
                aria-label={'Gỡ nhãn ' + tag.name}
                className={'inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' + tagToneClass(tag.tone_key)}
                disabled={saving || !canUpdate}
                key={tag.id}
                onClick={() => void persist(selectedIds.filter((id) => id !== tag.id), 'Đã gỡ nhãn “' + tag.name + '”.')}
                type="button"
              >
                <TagGlyph className="h-4 w-4" icon={tag.icon_key} />
                {tag.name}
                {tag.status === 'inactive' ? <span className="text-xs font-normal">(tạm ẩn)</span> : null}
                {canUpdate ? <X size={14} /> : null}
              </button>
            ))}
          </div>
        )}
      </section>

      {canUpdate ? (
        <section aria-label="Gắn thêm nhãn" className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-text">Gắn thêm nhãn</h3>
          <label className="flex h-11 max-w-lg items-center gap-2 rounded-md border border-border bg-panel px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
            <Search size={16} className="shrink-0 text-muted-foreground" />
            <span className="sr-only">Tìm hoặc tạo nhãn</span>
            <input className="min-w-0 flex-1 bg-transparent text-sm outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm hoặc nhập tên nhãn mới" type="search" value={query} />
          </label>
          {!loading ? (
            <div className="flex flex-wrap gap-2">
              {available.slice(0, 10).map((tag) => (
                <button
                  className={'inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-medium hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' + tagToneClass(tag.tone_key)}
                  disabled={saving || selectedIds.length >= 12}
                  key={tag.id}
                  onClick={() => void persist([...selectedIds, tag.id], 'Đã gắn nhãn “' + tag.name + '”.')}
                  type="button"
                >
                  <Plus size={14} />
                  <TagGlyph className="h-4 w-4" icon={tag.icon_key} />
                  {tag.name}
                </button>
              ))}
              {available.length === 0 ? <p className="text-sm text-muted-foreground">Không có nhãn phù hợp.</p> : null}
            </div>
          ) : null}
          {query.trim() && !duplicateName && canCreate ? (
            <Button disabled={saving || selectedIds.length >= 12} onClick={() => void createAndAttach()} type="button" variant="secondary">
              <Plus size={16} /> Tạo và gắn “{query.trim()}”
            </Button>
          ) : null}
        </section>
      ) : null}
    </Card>
  );
}
