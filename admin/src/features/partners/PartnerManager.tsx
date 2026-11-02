'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { FileReferencePicker } from '@/components/form/ReferencePickers';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuthState } from '@/features/auth/useAuthState';
import { apiClient } from '@/lib/api-client';
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
  return error instanceof Error ? error.message : 'Không thể hoàn tất thao tác. Vui lòng thử lại.';
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

  function select(partner: Partner | null) {
    setSelectedId(partner?.id ?? null);
    setForm(partner ? toForm(partner) : EMPTY_FORM);
    setError(null);
    setNotice(null);
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
      if (selected) {
        await apiClient.put(`${endpoints.songThanh.partners}/${selected.id}`, payload);
      } else {
        await apiClient.post(endpoints.songThanh.partners, payload);
      }
      await load();
      select(null);
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
      select(null);
      setNotice(action === 'archive' ? 'Đã lưu trữ đối tác.' : 'Đã khôi phục đối tác.');
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Nội dung website</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-secondary">Đối tác</h1>
          <p className="mt-2 max-w-2xl text-sm text-body">Quản lý logo, website và trạng thái hiển thị. Mục đối tác chỉ xuất hiện trên website khi có bản ghi đang hoạt động.</p>
        </div>
        {canCreate ? <Button onClick={() => select(null)} type="button">Thêm đối tác</Button> : null}
      </header>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</p> : null}
      {notice ? <p className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800" role="status">{notice}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex-1 text-sm font-medium text-secondary">Tìm đối tác
              <input className={`${inputClass} mt-1`} onChange={(event) => setQuery(event.target.value)} placeholder="Nhập tên đối tác" type="search" value={query} />
            </label>
            <label className="text-sm font-medium text-secondary">Hiển thị
              <select className={`${inputClass} mt-1 sm:min-w-40`} onChange={(event) => setFilter(event.target.value as typeof filter)} value={filter}>
                <option value="all">Chưa lưu trữ</option>
                <option value="active">Đang hiển thị</option>
                <option value="inactive">Tạm ẩn</option>
                <option value="archived">Đã lưu trữ</option>
              </select>
            </label>
          </div>
          {loading ? <p className="py-10 text-sm text-body" role="status">Đang tải đối tác...</p> : visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-body" role="status">{items.length === 0 ? 'Chưa có đối tác. Mục đối tác ngoài website sẽ được ẩn.' : 'Không có đối tác phù hợp bộ lọc.'}</p>
          ) : (
            <ul className="mt-5 divide-y divide-border">
              {visible.map((item) => <li key={item.id}>
                <button aria-current={selectedId === item.id ? 'true' : undefined} className={`flex min-h-16 w-full items-center justify-between gap-3 py-3 text-left hover:text-primary ${selectedId === item.id ? 'text-primary' : 'text-secondary'}`} onClick={() => select(item)} type="button">
                  <span className="min-w-0"><span className="block truncate font-semibold">{item.name}</span><span className="mt-1 block text-xs text-body">Thứ tự {item.sort_order}</span></span>
                  <span className="shrink-0 text-xs font-medium">{item.deleted_at ? 'Đã lưu trữ' : item.status === 'active' ? 'Đang hiển thị' : 'Tạm ẩn'}</span>
                </button>
              </li>)}</ul>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="font-display text-xl font-semibold text-secondary">{selected ? `Sửa ${selected.name}` : 'Đối tác mới'}</h2>
          {selected?.deleted_at ? (
            <div className="mt-5 space-y-4 text-sm text-body">
              <p>Đối tác này đang được lưu trữ và không xuất hiện ngoài website.</p>
              {canRestore ? <Button disabled={saving} onClick={() => void changeArchive('restore')} type="button" variant="secondary">Khôi phục đối tác</Button> : null}
            </div>
          ) : (
            <form className="mt-5 space-y-4" onSubmit={(event) => void save(event)}>
              <label className="block text-sm font-medium text-secondary">Tên đối tác <span aria-hidden="true">*</span>
                <input className={`${inputClass} mt-1`} disabled={!canSave || saving} maxLength={255} onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} />
              </label>
              <div className="text-sm font-medium text-secondary">Logo đối tác
                <div className="mt-1"><FileReferencePicker allowedMimePrefix="image/" fieldLabel="logo đối tác" onChange={(value) => setForm({ ...form, logo_file_id: value })} readOnly={!canSave || saving} value={form.logo_file_id} /></div>
              </div>
              <label className="block text-sm font-medium text-secondary">Website đối tác
                <input className={`${inputClass} mt-1`} disabled={!canSave || saving} maxLength={2048} onChange={(event) => setForm({ ...form, website_url: event.target.value })} placeholder="https://..." type="url" value={form.website_url} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-secondary">Thứ tự
                  <input className={`${inputClass} mt-1`} disabled={!canSave || saving} max={32767} min={0} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} type="number" value={form.sort_order} />
                </label>
                <label className="block text-sm font-medium text-secondary">Trạng thái
                  <select className={`${inputClass} mt-1`} disabled={!canSave || saving} onChange={(event) => setForm({ ...form, status: event.target.value as PartnerForm['status'] })} value={form.status}>
                    <option value="active">Hiển thị</option><option value="inactive">Tạm ẩn</option>
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {canSave ? <Button disabled={saving} type="submit">{saving ? 'Đang lưu...' : 'Lưu đối tác'}</Button> : null}
                {selected && canArchive ? <Button disabled={saving} onClick={() => void changeArchive('archive')} type="button" variant="danger">Lưu trữ</Button> : null}
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
