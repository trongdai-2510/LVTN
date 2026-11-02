'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Building2, ExternalLink, Globe2, Plus, Search } from '@/components/icons';
import { FileReferencePicker } from '@/components/form/ReferencePickers';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FileImage } from '@/components/ui/FileImage';
import { Modal } from '@/components/ui/Modal';
import { useAuthState } from '@/features/auth/useAuthState';
import { ApiClientError, apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { PERMISSIONS } from '@/lib/permissions';

interface Partner {
  id: string;
  name: string;
  logo_file_id: string | null;
  website_url: string | null;
  sort_order: number;
  status: 'active' | 'inactive';
  deleted_at: string | null;
}

type PartnerForm = {
  name: string;
  logo_file_id: string;
  website_url: string;
  sort_order: string;
  status: 'active' | 'inactive';
};

const EMPTY_FORM: PartnerForm = {
  name: '', logo_file_id: '', website_url: '', sort_order: '0', status: 'active'
};

const inputClass = 'min-h-11 w-full rounded-md border border-border bg-panel px-3 text-sm text-secondary outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60';
const filterOptions = [
  { value: 'all', label: 'Đang quản lý' },
  { value: 'active', label: 'Hiển thị' },
  { value: 'inactive', label: 'Tạm ẩn' },
  { value: 'archived', label: 'Lưu trữ' }
] as const;

function toForm(partner: Partner): PartnerForm {
  return {
    name: partner.name,
    logo_file_id: partner.logo_file_id ?? '',
    website_url: partner.website_url ?? '',
    sort_order: String(partner.sort_order),
    status: partner.status
  };
}

function messageOf(error: unknown): string {
  if (error instanceof ApiClientError && error.status === 409 && error.serverMessage.includes('Thứ tự hiển thị')) {
    return error.serverMessage;
  }
  return error instanceof Error ? error.message : 'Không thể hoàn tất thao tác. Vui lòng thử lại.';
}

function nextOrder(items: Partner[]): number {
  const used = new Set(items.filter((item) => !item.deleted_at).map((item) => item.sort_order));
  let order = 0;
  while (used.has(order)) order += 1;
  return order;
}

function websiteHost(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.hostname.replace(/^www\./, '') : null;
  } catch {
    return null;
  }
}

export function PartnerManager() {
  const auth = useAuthState();
  const [items, setItems] = useState<Partner[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<PartnerForm>(EMPTY_FORM);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'archived'>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const canCreate = auth.permissions.includes(PERMISSIONS.partnerCreate);
  const canUpdate = auth.permissions.includes(PERMISSIONS.partnerUpdate);
  const canArchive = auth.permissions.includes(PERMISSIONS.partnerArchive);
  const canRestore = auth.permissions.includes(PERMISSIONS.partnerRestore);
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const canSave = selected ? canUpdate && !selected.deleted_at : canCreate;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<{ items: Partner[] }>(endpoints.songThanh.partners);
      setItems(data.items);
      setError(null);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => items.filter((item) => {
    if (query && !item.name.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))) return false;
    if (filter === 'archived') return Boolean(item.deleted_at);
    if (item.deleted_at) return false;
    return filter === 'all' || item.status === filter;
  }), [items, query, filter]);
  const counts = useMemo(() => ({
    active: items.filter((item) => !item.deleted_at && item.status === 'active').length,
    inactive: items.filter((item) => !item.deleted_at && item.status === 'inactive').length,
    archived: items.filter((item) => Boolean(item.deleted_at)).length
  }), [items]);

  function select(partner: Partner | null) {
    setSelectedId(partner?.id ?? null);
    setForm(partner ? toForm(partner) : { ...EMPTY_FORM, sort_order: String(nextOrder(items)) });
    setError(null);
    setNotice(null);
    setEditing(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        name: form.name.trim(),
        logo_file_id: form.logo_file_id || null,
        website_url: form.website_url.trim() || null,
        sort_order: Number(form.sort_order),
        status: form.status
      };
      if (!payload.name) throw new Error('Vui lòng nhập tên đối tác.');
      if (!Number.isInteger(payload.sort_order) || payload.sort_order < 0 || payload.sort_order > 32767) {
        throw new Error('Thứ tự phải là số nguyên từ 0 đến 32767.');
      }
      if (items.some((item) => !item.deleted_at && item.id !== selected?.id && item.sort_order === payload.sort_order)) {
        throw new Error('Thứ tự hiển thị này đã được dùng. Vui lòng chọn số khác.');
      }
      if (selected) {
        await apiClient.put(`${endpoints.songThanh.partners}/${selected.id}`, payload);
      } else {
        await apiClient.post(endpoints.songThanh.partners, payload);
      }
      await load();
      setEditing(false);
      setSelectedId(null);
      setForm(EMPTY_FORM);
      setNotice(selected ? 'Đã lưu thay đổi đối tác.' : 'Đã thêm đối tác.');
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }

  async function changeArchive(action: 'archive' | 'restore') {
    if (!selected || saving) return;
    if (action === 'archive' && !window.confirm(`Lưu trữ đối tác “${selected.name}”? Đối tác sẽ ẩn khỏi website.`)) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.post(`${endpoints.songThanh.partners}/${selected.id}/${action}`);
      await load();
      setEditing(false);
      setSelectedId(null);
      setForm(EMPTY_FORM);
      setNotice(action === 'archive' ? 'Đã lưu trữ đối tác.' : 'Đã khôi phục đối tác.');
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Nội dung website / Đối tác</p>
          <h1 className="mt-1 font-display text-[28px] font-semibold leading-tight text-text">Đối tác</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Logo và đường dẫn của đối tác sẽ xuất hiện cùng khu thương hiệu khi bản ghi được bật.
          </p>
        </div>
        {canCreate ? <Button onClick={() => select(null)} type="button"><Plus size={17} /> Thêm đối tác</Button> : null}
      </header>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p> : null}
      {notice ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">{notice}</p> : null}

      <section aria-label="Danh sách đối tác" className="overflow-hidden rounded-md border border-border bg-panel">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
          <h2 className="font-semibold text-text">Danh sách đối tác</h2>
          <p className="text-sm text-muted-foreground">
            <strong className="font-semibold text-text">{counts.active}</strong> hiển thị
            <span className="mx-2 text-border">·</span>
            {counts.inactive} tạm ẩn
            {counts.archived > 0 ? <span> · {counts.archived} lưu trữ</span> : null}
          </p>
        </div>

        <div className="flex flex-col gap-3 border-b border-border bg-surface px-4 py-4 lg:flex-row lg:items-center lg:justify-between sm:px-5">
          <label className="flex h-11 min-w-0 items-center gap-2 rounded-md border border-border bg-panel px-3 text-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 lg:w-80">
            <Search size={17} className="shrink-0 text-muted-foreground" />
            <span className="sr-only">Tìm đối tác</span>
            <input className="min-w-0 flex-1 bg-transparent outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên đối tác" type="search" value={query} />
          </label>
          <div aria-label="Lọc trạng thái đối tác" className="flex flex-wrap gap-1" role="group">
            {filterOptions.map((option) => (
              <button
                aria-pressed={filter === option.value}
                className={filter === option.value
                  ? 'min-h-10 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground'
                  : 'min-h-10 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-text'}
                key={option.value}
                onClick={() => setFilter(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? <p className="px-5 py-12 text-sm text-muted-foreground" role="status">Đang tải đối tác...</p> : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-14 text-center" role="status">
            <Building2 size={28} className="text-muted-foreground" />
            <p className="font-medium text-text">{items.length === 0 ? 'Chưa có đối tác.' : 'Không có đối tác phù hợp.'}</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {items.length === 0 ? 'Mục đối tác ngoài website sẽ được ẩn cho tới khi có đối tác đang hiển thị.' : 'Thử tên hoặc trạng thái khác để tìm bản ghi.'}
            </p>
            {items.length === 0 && canCreate ? <Button onClick={() => select(null)} type="button" variant="secondary">Thêm đối tác đầu tiên</Button> : null}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((item) => (
              <li key={item.id}>
                <button
                  aria-current={selectedId === item.id && editing ? 'true' : undefined}
                  className={selectedId === item.id && editing
                    ? 'grid min-h-20 w-full grid-cols-[52px_minmax(0,1fr)] items-center gap-3 bg-blue-50 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:grid-cols-[52px_minmax(0,1fr)_120px_110px] sm:px-5'
                    : 'grid min-h-20 w-full grid-cols-[52px_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-left outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:grid-cols-[52px_minmax(0,1fr)_120px_110px] sm:px-5'}
                  onClick={() => select(item)}
                  type="button"
                >
                  <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border border-border bg-white">
                    <FileImage fileId={item.logo_file_id} alt="" className="h-full w-full object-contain p-1" fallback={<Building2 size={20} className="text-muted-foreground" />} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-text">{item.name}</span>
                    <span className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground">
                      {websiteHost(item.website_url) ? <Globe2 size={13} className="shrink-0" /> : null}
                      {websiteHost(item.website_url) ?? 'Chưa có website'}
                    </span>
                  </span>
                  <span className="hidden text-sm text-muted-foreground sm:block">Thứ tự {item.sort_order}</span>
                  <Badge className="mt-1 w-fit sm:mt-0" tone={item.deleted_at ? 'archived' : item.status === 'active' ? 'active' : 'inactive'}>
                    {item.deleted_at ? 'Lưu trữ' : item.status === 'active' ? 'Hiển thị' : 'Tạm ẩn'}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal open={editing} title={selected ? 'Chỉnh sửa đối tác' : 'Thêm đối tác'} onClose={() => setEditing(false)} closeDisabled={saving} panelClassName="max-w-4xl" bodyClassName="p-0">
          {error ? <p className="mx-5 mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p> : null}
          {selected?.deleted_at ? (
            <div className="space-y-4 px-5 py-7">
              <p className="text-sm text-muted-foreground">Bản ghi này đang được lưu trữ và không xuất hiện ngoài website.</p>
              {canRestore ? <Button disabled={saving} onClick={() => void changeArchive('restore')} type="button" variant="secondary">Khôi phục đối tác</Button> : null}
            </div>
          ) : (
            <form className="grid gap-6 p-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:p-6" onSubmit={(event) => void save(event)}>
              <div>
                <div className="flex h-44 items-center justify-center overflow-hidden rounded-md border border-border bg-white">
                  <FileImage fileId={form.logo_file_id || null} alt="" className="h-full w-full object-contain p-4" fallback={<Building2 size={38} className="text-muted-foreground" />} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Logo dùng trên trang Đối tác và thương hiệu.</p>
              </div>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-text sm:col-span-2">Tên đối tác
                  <input className={inputClass + ' mt-1'} disabled={!canSave || saving} maxLength={255} onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} />
                </label>
                <div className="min-w-0 text-sm font-medium text-text sm:col-span-2">Logo đối tác
                  <div className="mt-1"><FileReferencePicker allowedMimePrefix="image/" fieldLabel="logo đối tác" onChange={(value) => setForm((previous) => ({ ...previous, logo_file_id: value }))} readOnly={!canSave || saving} value={form.logo_file_id} /></div>
                </div>
                <label className="block min-w-0 text-sm font-medium text-text sm:col-span-2">Website đối tác
                  <input className={inputClass + ' mt-1'} disabled={!canSave || saving} maxLength={2048} onChange={(event) => setForm({ ...form, website_url: event.target.value })} placeholder="https://..." type="url" value={form.website_url} />
                </label>
                <label className="block text-sm font-medium text-text">Thứ tự hiển thị
                  <input className={inputClass + ' mt-1'} disabled={!canSave || saving} max={32767} min={0} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} type="number" value={form.sort_order} />
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">Mỗi đối tác đang quản lý cần một số riêng.</span>
                </label>
                <label className="block text-sm font-medium text-text">Trạng thái
                  <select className={inputClass + ' mt-1'} disabled={!canSave || saving} onChange={(event) => setForm({ ...form, status: event.target.value as PartnerForm['status'] })} value={form.status}>
                    <option value="active">Hiển thị</option><option value="inactive">Tạm ẩn</option>
                  </select>
                </label>
                {selected?.website_url && websiteHost(selected.website_url) ? (
                  <a className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary hover:underline sm:col-span-2" href={selected.website_url} rel="noopener noreferrer" target="_blank">
                    Xem website đối tác <ExternalLink size={15} />
                  </a>
                ) : null}
                <div className="flex flex-wrap gap-2 border-t border-border pt-4 sm:col-span-2">
                  {canSave ? <Button disabled={saving} type="submit">{saving ? 'Đang lưu...' : 'Lưu đối tác'}</Button> : null}
                  {selected && canArchive ? <Button disabled={saving} onClick={() => void changeArchive('archive')} type="button" variant="danger">Lưu trữ</Button> : null}
                </div>
              </div>
            </form>
          )}
      </Modal>
    </div>
  );
}
