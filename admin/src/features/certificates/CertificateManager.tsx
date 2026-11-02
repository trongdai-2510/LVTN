'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { FileReferencePicker } from '@/components/form/ReferencePickers';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { usePermissions } from '@/features/auth/useAuthState';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { PERMISSIONS } from '@/lib/permissions';

type Certificate = {
  id: string; title: string; file_id: string | null; image_file_id: string | null;
  issued_date: string | null; expires_date: string | null; sort_order: number;
  status: 'active' | 'inactive'; deleted_at: string | null;
};
type Form = { title: string; file_id: string; image_file_id: string; issued_date: string; expires_date: string; sort_order: string; status: 'active' | 'inactive' };
const empty: Form = { title: '', file_id: '', image_file_id: '', issued_date: '', expires_date: '', sort_order: '0', status: 'active' };
const inputClass = 'mt-1 min-h-11 w-full rounded-md border border-border bg-panel px-3 text-sm text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-60';
function messageOf(error: unknown) { return error instanceof Error ? error.message : 'Không thể hoàn tất thao tác.'; }
function dateOf(value: string | null) { return value?.slice(0, 10) ?? ''; }
function asForm(row: Certificate): Form {
  return { title: row.title, file_id: row.file_id ?? '', image_file_id: row.image_file_id ?? '', issued_date: dateOf(row.issued_date), expires_date: dateOf(row.expires_date), sort_order: String(row.sort_order), status: row.status };
}

export function CertificateManager() {
  const permissions = usePermissions();
  const [items, setItems] = useState<Certificate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const canSave = selected ? permissions.includes(PERMISSIONS.certificateUpdate) && !selected.deleted_at : permissions.includes(PERMISSIONS.certificateCreate);
  const load = useCallback(async () => {
    setLoading(true);
    try { const result = await apiClient.get<{ items: Certificate[] }>(endpoints.songThanh.certificates); setItems(result.items); setError(null); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function select(row: Certificate | null) { setSelectedId(row?.id ?? null); setForm(row ? asForm(row) : empty); setError(null); setNotice(null); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || saving) return;
    const payload = {
      title: form.title.trim(), file_id: form.file_id || null, image_file_id: form.image_file_id || null,
      issued_date: form.issued_date || null, expires_date: form.expires_date || null,
      sort_order: Number(form.sort_order), status: form.status
    };
    if (!payload.title) { setError('Vui lòng nhập tên chứng nhận.'); return; }
    if (payload.issued_date && payload.expires_date && payload.expires_date < payload.issued_date) { setError('Ngày hết hạn phải sau ngày cấp.'); return; }
    if (!Number.isInteger(payload.sort_order) || payload.sort_order < 0 || payload.sort_order > 32767) { setError('Thứ tự phải là số nguyên từ 0 đến 32767.'); return; }
    setSaving(true); setError(null); setNotice(null);
    try {
      if (selected) await apiClient.put(`${endpoints.songThanh.certificates}/${selected.id}`, payload);
      else await apiClient.post(endpoints.songThanh.certificates, payload);
      await load(); select(null); setNotice(selected ? 'Đã lưu chứng nhận.' : 'Đã thêm chứng nhận.');
    } catch (cause) { setError(messageOf(cause)); }
    finally { setSaving(false); }
  }
  async function changeArchive(action: 'archive' | 'restore') {
    if (!selected || saving) return;
    if (action === 'archive' && !window.confirm(`Lưu trữ chứng nhận “${selected.title}”?`)) return;
    setSaving(true); setError(null);
    try { await apiClient.post(`${endpoints.songThanh.certificates}/${selected.id}/${action}`); await load(); select(null); setNotice(action === 'archive' ? 'Đã lưu trữ chứng nhận.' : 'Đã khôi phục chứng nhận.'); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setSaving(false); }
  }

  return <div className="space-y-6 pb-12">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-primary">Nội dung website</p><h1 className="mt-2 font-display text-3xl font-semibold text-secondary">Chứng nhận</h1>
        <p className="mt-2 max-w-2xl text-sm text-body">Quản lý chứng nhận của Song Thanh. Chỉ chứng nhận đang hiển thị mới xuất hiện ở trang chủ và Giới thiệu.</p></div>
      {permissions.includes(PERMISSIONS.certificateCreate) ? <Button onClick={() => select(null)} type="button">Thêm chứng nhận</Button> : null}
    </header>
    {error ? <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</p> : null}
    {notice ? <p className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800" role="status">{notice}</p> : null}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,450px)]">
      <Card className="p-5 sm:p-6"><label className="block text-sm font-medium text-secondary">Tìm chứng nhận<input className={inputClass} onChange={(event) => setQuery(event.target.value)} type="search" value={query} /></label>
        {loading ? <p className="py-8 text-sm text-body">Đang tải...</p> : items.length === 0 ? <p className="py-8 text-sm text-body">Chưa có chứng nhận. Website sẽ ẩn mục này.</p> :
          <ul className="mt-4 divide-y divide-border">{items.filter((item) => item.title.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))).map((item) =>
            <li key={item.id}><button className="flex min-h-16 w-full items-center justify-between gap-3 py-3 text-left text-secondary hover:text-primary" onClick={() => select(item)} type="button">
              <span className="font-semibold">{item.title}</span><span className="text-xs">{item.deleted_at ? 'Đã lưu trữ' : item.status === 'active' ? 'Đang hiển thị' : 'Tạm ẩn'}</span>
            </button></li>)}</ul>}
      </Card>
      <Card className="p-5 sm:p-6"><h2 className="font-display text-xl font-semibold text-secondary">{selected ? `Sửa ${selected.title}` : 'Chứng nhận mới'}</h2>
        {selected?.deleted_at ? <div className="mt-5"><p className="mb-4 text-sm text-body">Chứng nhận đang lưu trữ.</p>{permissions.includes(PERMISSIONS.certificateRestore) ? <Button disabled={saving} onClick={() => void changeArchive('restore')} type="button">Khôi phục</Button> : null}</div> :
        <form className="mt-5 space-y-4" onSubmit={(event) => void save(event)}>
          <label className="block text-sm font-medium text-secondary">Tên chứng nhận<input className={inputClass} disabled={!canSave || saving} maxLength={255} onChange={(event) => setForm({ ...form, title: event.target.value })} required value={form.title} /></label>
          <div className="text-sm font-medium text-secondary">Tệp chứng nhận (PDF hoặc ảnh)<div className="mt-1"><FileReferencePicker fieldLabel="tệp chứng nhận" onChange={(value) => setForm({ ...form, file_id: value })} readOnly={!canSave || saving} value={form.file_id} /></div></div>
          <div className="text-sm font-medium text-secondary">Ảnh xem trước<div className="mt-1"><FileReferencePicker allowedMimePrefix="image/" fieldLabel="ảnh chứng nhận" onChange={(value) => setForm({ ...form, image_file_id: value })} readOnly={!canSave || saving} value={form.image_file_id} /></div></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-secondary">Ngày cấp<input className={inputClass} disabled={!canSave || saving} onChange={(event) => setForm({ ...form, issued_date: event.target.value })} type="date" value={form.issued_date} /></label>
          <label className="text-sm font-medium text-secondary">Ngày hết hạn<input className={inputClass} disabled={!canSave || saving} min={form.issued_date || undefined} onChange={(event) => setForm({ ...form, expires_date: event.target.value })} type="date" value={form.expires_date} /></label></div>
          <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium text-secondary">Thứ tự<input className={inputClass} disabled={!canSave || saving} max={32767} min={0} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} type="number" value={form.sort_order} /></label>
          <label className="text-sm font-medium text-secondary">Trạng thái<select className={inputClass} disabled={!canSave || saving} onChange={(event) => setForm({ ...form, status: event.target.value as Form['status'] })} value={form.status}><option value="active">Hiển thị</option><option value="inactive">Tạm ẩn</option></select></label></div>
          <div className="flex flex-wrap gap-2">{canSave ? <Button disabled={saving} type="submit">{saving ? 'Đang lưu...' : 'Lưu chứng nhận'}</Button> : null}
            {selected && permissions.includes(PERMISSIONS.certificateArchive) ? <Button disabled={saving} onClick={() => void changeArchive('archive')} type="button" variant="danger">Lưu trữ</Button> : null}</div>
        </form>}
      </Card>
    </div>
  </div>;
}
