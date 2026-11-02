'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Plus, Search, Tag as TagIcon } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { usePermissions } from '@/features/auth/useAuthState';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { PERMISSIONS } from '@/lib/permissions';
import { TagGlyph, tagIconOptions, tagToneClass, tagToneOptions, type TagIconKey, type TagToneKey } from './tagAppearance';

export type Tag = {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  icon_key: TagIconKey | null;
  tone_key: TagToneKey | null;
  deleted_at: string | null;
  product_count?: string | number;
};

export function TagManager() {
  const permissions = usePermissions();
  const [items, setItems] = useState<Tag[]>([]);
  const [selected, setSelected] = useState<Tag | null>(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [iconKey, setIconKey] = useState<TagIconKey>('none');
  const [toneKey, setToneKey] = useState<TagToneKey>('blue');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'unused' | 'archived'>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const editorRef = useRef<HTMLElement>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get<{ items: Tag[] }>(endpoints.songThanh.tags);
      setItems(result.items);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được nhãn.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const visible = useMemo(() => items.filter((item) => {
    if (query.trim() && !item.name.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))) return false;
    if (filter === 'archived') return Boolean(item.deleted_at);
    if (item.deleted_at) return false;
    if (filter === 'unused') return Number(item.product_count ?? 0) === 0;
    return filter === 'all' || item.status === filter;
  }), [items, query, filter]);
  const activeCount = items.filter((item) => !item.deleted_at && item.status === 'active').length;
  const unusedCount = items.filter((item) => !item.deleted_at && Number(item.product_count ?? 0) === 0).length;

  function choose(tag: Tag | null, scroll = true) {
    setSelected(tag);
    setName(tag?.name ?? '');
    setStatus(tag?.status ?? 'active');
    setIconKey(tag?.icon_key ?? 'none');
    setToneKey(tag?.tone_key ?? 'blue');
    setError('');
    setNotice('');
    if (scroll) requestAnimationFrame(() => editorRef.current?.scrollIntoView({ block: 'start' }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const value = name.trim();
    if (!value) { setError('Nhập tên nhãn trước khi lưu.'); return; }
    if (items.some((item) => !item.deleted_at && item.id !== selected?.id && item.name.toLocaleLowerCase('vi') === value.toLocaleLowerCase('vi'))) {
      setError('Tên nhãn này đã có. Hãy chọn nhãn trong danh sách.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { name: value, status, icon_key: iconKey, tone_key: toneKey };
      if (selected) await apiClient.put(endpoints.songThanh.tags + '/' + selected.id, payload);
      else await apiClient.post(endpoints.songThanh.tags, payload);
      await load();
      choose(null, false);
      setNotice(selected ? 'Đã cập nhật nhãn.' : 'Đã tạo nhãn.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không lưu được nhãn.');
    } finally {
      setSaving(false);
    }
  }

  async function changeArchive(action: 'archive' | 'restore') {
    if (!selected || saving) return;
    if (action === 'archive' && !window.confirm('Lưu trữ nhãn “' + selected.name + '”? Nhãn sẽ không còn hiện trên website.')) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.post(endpoints.songThanh.tags + '/' + selected.id + '/' + action);
      await load();
      choose(null, false);
      setNotice(action === 'archive' ? 'Đã lưu trữ nhãn.' : 'Đã khôi phục nhãn.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đổi trạng thái nhãn.');
    } finally {
      setSaving(false);
    }
  }
  const canSave = selected
    ? permissions.includes(PERMISSIONS.tagUpdate) && !selected.deleted_at
    : permissions.includes(PERMISSIONS.tagCreate);

  return (
    <div className="space-y-5 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Sản phẩm / Phân loại nhanh</p>
          <h1 className="mt-1 font-display text-[28px] font-semibold leading-tight text-text">Nhãn sản phẩm</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Tạo nhãn tại đây, sau đó gắn trực tiếp trong trang sửa sản phẩm. Màu và biểu tượng đi cùng nhãn trên website.
          </p>
        </div>
        {permissions.includes(PERMISSIONS.tagCreate) ? <Button onClick={() => choose(null)} type="button"><Plus size={17} /> Thêm nhãn</Button> : null}
      </header>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p> : null}
      {notice ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">{notice}</p> : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section aria-label="Bộ nhãn sản phẩm" className="min-w-0 overflow-hidden rounded-md border border-border bg-panel">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
            <h2 className="font-display text-lg font-semibold text-text">Bộ nhãn</h2>
            <p className="text-sm text-muted-foreground">{activeCount} đang bật · {unusedCount} chưa gắn sản phẩm</p>
          </div>
          <div className="grid gap-3 border-b border-border bg-surface px-4 py-4 sm:grid-cols-[minmax(0,1fr)_170px] sm:px-5">
            <label className="flex h-11 min-w-0 items-center gap-2 rounded-md border border-border bg-panel px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
              <Search size={16} className="shrink-0 text-muted-foreground" />
              <span className="sr-only">Tìm nhãn</span>
              <input className="min-w-0 flex-1 bg-transparent text-sm outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên nhãn" type="search" value={query} />
            </label>
            <label>
              <span className="sr-only">Lọc nhãn</span>
              <select className="h-11 w-full rounded-md border border-border bg-panel px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" onChange={(event) => setFilter(event.target.value as typeof filter)} value={filter}>
                <option value="all">Đang quản lý</option>
                <option value="active">Đang bật</option>
                <option value="inactive">Tạm ẩn</option>
                <option value="unused">Chưa gắn</option>
                <option value="archived">Lưu trữ</option>
              </select>
            </label>
          </div>
          {loading ? <p className="px-5 py-12 text-sm text-muted-foreground" role="status">Đang tải nhãn...</p> : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center" role="status">
              <TagIcon size={27} className="text-muted-foreground" />
              <p className="mt-1 font-medium text-text">{items.length === 0 ? 'Chưa có nhãn sản phẩm.' : 'Không có nhãn phù hợp.'}</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {items.length === 0 ? 'Tạo một nhãn, chọn hình và màu, rồi gắn vào sản phẩm.' : 'Thử tên hoặc trạng thái khác.'}
              </p>
            </div>
          ) : (
            <ul className="flex flex-wrap content-start gap-3 p-4 sm:p-5">
              {visible.map((item) => (
                <li key={item.id}>
                  <button
                    aria-current={selected?.id === item.id ? 'true' : undefined}
                    className={selected?.id === item.id
                      ? 'group rounded-md border-2 border-primary bg-white p-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/25'
                      : 'group rounded-md border border-border bg-white p-2 text-left outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-primary/25'}
                    onClick={() => choose(item)}
                    type="button"
                  >
                    <span className={'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ' + tagToneClass(item.tone_key)}>
                      <TagGlyph className="h-4 w-4 shrink-0" icon={item.icon_key} />{item.name}
                    </span>
                    <span className="mt-2 flex items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
                      <span>{item.deleted_at ? 'Lưu trữ' : item.status === 'active' ? 'Đang bật' : 'Tạm ẩn'}</span>
                      <span>{Number(item.product_count ?? 0)} SP</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside aria-label="Thiết kế nhãn" className="scroll-mt-5 overflow-hidden rounded-md border border-border bg-panel xl:sticky xl:top-5" ref={editorRef}>
          <div className="border-b border-border bg-surface px-5 py-4">
            <h2 className="font-display text-lg font-semibold text-text">{selected ? 'Chỉnh sửa nhãn' : 'Tạo nhãn mới'}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{selected ? Number(selected.product_count ?? 0) + ' sản phẩm đang gắn' : 'Xem nhãn sẽ trông như thế nào trước khi lưu.'}</p>
          </div>
          {selected?.deleted_at ? (
            <div className="space-y-4 p-5">
              <Badge tone="archived">Đã lưu trữ</Badge>
              <p className="text-sm text-muted-foreground">Nhãn không hiển thị trên website khi đang lưu trữ.</p>
              {permissions.includes(PERMISSIONS.tagRestore) ? <Button disabled={saving} onClick={() => void changeArchive('restore')} type="button" variant="secondary">Khôi phục nhãn</Button> : null}
            </div>
          ) : (
            <form className="space-y-5 p-5" onSubmit={(event) => void save(event)}>
              <label className="block text-sm font-medium text-text">Tên nhãn
                <input className="mt-1 min-h-11 w-full rounded-md border border-border bg-panel px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60" disabled={!canSave || saving} maxLength={64} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Bán chạy" required value={name} />
              </label>

              <div className="rounded-md border border-border bg-surface p-4">
                <p className="text-sm font-medium text-muted-foreground">Xem trước trên website</p>
                <span className={'mt-3 inline-flex min-h-10 max-w-full items-center gap-2 rounded-full border px-3.5 text-sm font-semibold ' + tagToneClass(toneKey)}>
                  <TagGlyph className="h-4 w-4 shrink-0" icon={iconKey} />
                  <span className="truncate">{name.trim() || 'Tên nhãn'}</span>
                </span>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-text">Biểu tượng</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
                  {tagIconOptions.map((option) => (
                    <button
                      aria-pressed={iconKey === option.value}
                      className={iconKey === option.value
                        ? 'flex min-h-11 items-center gap-2 rounded-md border-2 border-primary bg-blue-50 px-3 text-left text-sm font-medium text-text'
                        : 'flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-left text-sm text-text hover:border-primary'}
                      disabled={!canSave || saving}
                      key={option.value}
                      onClick={() => setIconKey(option.value)}
                      type="button"
                    >
                      {option.value === 'none' ? <TagIcon size={17} /> : <TagGlyph className="h-4 w-4" icon={option.value} />}
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-text">Màu nhãn</legend>
                <div className="flex flex-wrap gap-2">
                  {tagToneOptions.map((option) => (
                    <button
                      aria-pressed={toneKey === option.value}
                      className={toneKey === option.value
                        ? 'min-h-10 rounded-full border-2 border-primary px-3 text-sm font-semibold ' + tagToneClass(option.value)
                        : 'min-h-10 rounded-full border px-3 text-sm font-medium hover:brightness-95 ' + tagToneClass(option.value)}
                      disabled={!canSave || saving}
                      key={option.value}
                      onClick={() => setToneKey(option.value)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="block text-sm font-medium text-text">Trạng thái
                <select className="mt-1 min-h-11 w-full rounded-md border border-border bg-panel px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60" disabled={!canSave || saving} onChange={(event) => setStatus(event.target.value as typeof status)} value={status}>
                  <option value="active">Đang bật</option><option value="inactive">Tạm ẩn</option>
                </select>
              </label>

              {selected ? (
                <div className="space-y-1 border-t border-border pt-4 text-sm text-muted-foreground">
                  <p>Đường dẫn: <code className="break-all text-text">/san-pham/nhan/{selected.slug}</code></p>
                  <Link className="inline-flex min-h-9 items-center text-primary hover:underline" href="/product-groups">Mở danh sách sản phẩm để gắn nhãn</Link>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                {canSave ? <Button disabled={saving} type="submit">{saving ? 'Đang lưu...' : 'Lưu nhãn'}</Button> : null}
                {selected && permissions.includes(PERMISSIONS.tagArchive) ? <Button disabled={saving} onClick={() => void changeArchive('archive')} type="button" variant="danger">Lưu trữ</Button> : null}
              </div>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
