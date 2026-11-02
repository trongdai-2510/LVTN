'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { FileCheck2, FileText, Plus, Search } from '@/components/icons';
import { FileReferencePicker } from '@/components/form/ReferencePickers';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FileImage } from '@/components/ui/FileImage';
import { Modal } from '@/components/ui/Modal';
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
function dateLabel(value: string | null) {
  const date = dateOf(value);
  return date ? date.split('-').reverse().join('/') : null;
}
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
  const [editorOpen, setEditorOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'current' | 'active' | 'inactive' | 'archived'>('current');
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const canSave = selected ? permissions.includes(PERMISSIONS.certificateUpdate) && !selected.deleted_at : permissions.includes(PERMISSIONS.certificateCreate);
  const visible = useMemo(() => items.filter((item) => {
    if (query.trim() && !item.title.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))) return false;
    if (filter === 'archived') return Boolean(item.deleted_at);
    if (item.deleted_at) return false;
    return filter === 'current' || item.status === filter;
  }), [items, query, filter]);
  const activeCount = items.filter((item) => !item.deleted_at && item.status === 'active').length;
  const load = useCallback(async () => {
    setLoading(true);
    try { const result = await apiClient.get<{ items: Certificate[] }>(endpoints.songThanh.certificates); setItems(result.items); setError(null); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function select(row: Certificate | null) {
    setSelectedId(row?.id ?? null);
    setForm(row ? asForm(row) : empty);
    setError(null);
    setNotice(null);
    setEditorOpen(true);
  }
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
      await load(); setEditorOpen(false); setNotice(selected ? 'Đã lưu chứng nhận.' : 'Đã thêm chứng nhận.');
    } catch (cause) { setError(messageOf(cause)); }
    finally { setSaving(false); }
  }
  async function changeArchive(action: 'archive' | 'restore') {
    if (!selected || saving) return;
    if (action === 'archive' && !window.confirm(`Lưu trữ chứng nhận “${selected.title}”?`)) return;
    setSaving(true); setError(null);
    try { await apiClient.post(`${endpoints.songThanh.certificates}/${selected.id}/${action}`); await load(); setEditorOpen(false); setNotice(action === 'archive' ? 'Đã lưu trữ chứng nhận.' : 'Đã khôi phục chứng nhận.'); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-5 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Nội dung website / Hồ sơ công ty</p>
          <h1 className="mt-1 font-display text-[28px] font-semibold leading-tight text-text">Chứng nhận</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Chứng nhận đang bật xuất hiện ở trang chủ và Giới thiệu. Danh sách trống sẽ tự ẩn ngoài website.
          </p>
        </div>
        {permissions.includes(PERMISSIONS.certificateCreate) ? <Button onClick={() => select(null)} type="button"><Plus size={17} /> Thêm chứng nhận</Button> : null}
      </header>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p> : null}
      {notice ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">{notice}</p> : null}

      <div>
        <section aria-label="Thư viện chứng nhận" className="min-w-0">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-text">Thư viện chứng nhận</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{activeCount} đang hiển thị ngoài website</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="flex h-11 min-w-0 items-center gap-2 rounded-md border border-border bg-panel px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                <Search size={16} className="shrink-0 text-muted-foreground" />
                <span className="sr-only">Tìm chứng nhận</span>
                <input className="w-36 min-w-0 bg-transparent text-sm outline-none sm:w-48" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm chứng nhận" type="search" value={query} />
              </label>
              <label>
                <span className="sr-only">Lọc chứng nhận</span>
                <select className="h-11 rounded-md border border-border bg-panel px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" onChange={(event) => setFilter(event.target.value as typeof filter)} value={filter}>
                  <option value="current">Đang quản lý</option>
                  <option value="active">Hiển thị</option>
                  <option value="inactive">Tạm ẩn</option>
                  <option value="archived">Lưu trữ</option>
                </select>
              </label>
            </div>
          </div>

          {loading ? <p className="rounded-md border border-border bg-panel px-5 py-12 text-sm text-muted-foreground" role="status">Đang tải chứng nhận...</p> : visible.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-md border border-dashed border-border bg-panel px-6 py-10 text-center" role="status">
              <FileCheck2 size={30} className="text-muted-foreground" />
              <p className="mt-3 font-medium text-text">{items.length === 0 ? 'Chưa có chứng nhận.' : 'Không có chứng nhận phù hợp.'}</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {items.length === 0 ? 'Thêm chứng nhận đầu tiên để chuẩn bị nội dung cho trang chủ và Giới thiệu.' : 'Thử tên hoặc trạng thái khác.'}
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {visible.map((item) => (
                <li key={item.id}>
                  <button
                    className="group h-full w-full overflow-hidden rounded-md border border-border bg-panel text-left outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
                    onClick={() => select(item)}
                    type="button"
                  >
                    <span className="flex aspect-[4/3] items-center justify-center overflow-hidden border-b border-border bg-white">
                      <FileImage fileId={item.image_file_id} alt="" className="h-full w-full object-contain p-4" fallback={<FileText size={32} className="text-muted-foreground" />} />
                    </span>
                    <span className="block space-y-2 p-4">
                      <span className="block min-h-11 font-semibold leading-snug text-text">{item.title}</span>
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge tone={item.deleted_at ? 'archived' : item.status === 'active' ? 'active' : 'inactive'}>
                          {item.deleted_at ? 'Lưu trữ' : item.status === 'active' ? 'Hiển thị' : 'Tạm ẩn'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{item.file_id ? 'Có tệp đính kèm' : 'Chưa có tệp'}</span>
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {dateLabel(item.issued_date) ? 'Cấp ngày ' + dateLabel(item.issued_date) : 'Chưa nhập ngày cấp'}
                        {dateLabel(item.expires_date) ? ' · Hết hạn ' + dateLabel(item.expires_date) : ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Modal open={editorOpen} title={selected ? 'Chỉnh sửa chứng nhận' : 'Thêm chứng nhận'} onClose={() => setEditorOpen(false)} closeDisabled={saving} panelClassName="max-w-3xl" bodyClassName="p-0">
          {error ? <p className="mx-5 mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p> : null}
          {selected?.deleted_at ? (
            <div className="space-y-4 p-5">
              <p className="text-sm text-muted-foreground">Chứng nhận này đang lưu trữ và không xuất hiện trên website.</p>
              {permissions.includes(PERMISSIONS.certificateRestore) ? <Button disabled={saving} onClick={() => void changeArchive('restore')} type="button" variant="secondary">Khôi phục chứng nhận</Button> : null}
            </div>
          ) : (
            <form className="grid gap-5 p-5 md:grid-cols-2" onSubmit={(event) => void save(event)}>
              <label className="block text-sm font-medium text-text md:col-span-2">Tên chứng nhận
                <input className={inputClass} disabled={!canSave || saving} maxLength={255} onChange={(event) => setForm({ ...form, title: event.target.value })} required value={form.title} />
              </label>
              <div className="grid gap-4 border-t border-border pt-4 md:col-span-2 md:grid-cols-2">
                <h3 className="text-sm font-semibold text-text md:col-span-2">Tệp và hình đại diện</h3>
                <div className="text-sm font-medium text-text">Tệp chứng nhận (PDF hoặc ảnh)
                  <div className="mt-1"><FileReferencePicker fieldLabel="tệp chứng nhận" onChange={(value) => setForm({ ...form, file_id: value })} readOnly={!canSave || saving} value={form.file_id} /></div>
                </div>
                <div className="text-sm font-medium text-text">Ảnh xem trước
                  <div className="mt-1"><FileReferencePicker allowedMimePrefix="image/" fieldLabel="ảnh chứng nhận" onChange={(value) => setForm({ ...form, image_file_id: value })} readOnly={!canSave || saving} value={form.image_file_id} /></div>
                </div>
              </div>
              <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 md:col-span-2">
                <label className="block text-sm font-medium text-text">Ngày cấp
                  <input className={inputClass} disabled={!canSave || saving} onChange={(event) => setForm({ ...form, issued_date: event.target.value })} type="date" value={form.issued_date} />
                </label>
                <label className="block text-sm font-medium text-text">Ngày hết hạn
                  <input className={inputClass} disabled={!canSave || saving} min={form.issued_date || undefined} onChange={(event) => setForm({ ...form, expires_date: event.target.value })} type="date" value={form.expires_date} />
                </label>
                <label className="block text-sm font-medium text-text">Thứ tự
                  <input className={inputClass} disabled={!canSave || saving} max={32767} min={0} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} type="number" value={form.sort_order} />
                </label>
                <label className="block text-sm font-medium text-text">Trạng thái
                  <select className={inputClass} disabled={!canSave || saving} onChange={(event) => setForm({ ...form, status: event.target.value as Form['status'] })} value={form.status}>
                    <option value="active">Hiển thị</option><option value="inactive">Tạm ẩn</option>
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-border pt-4 md:col-span-2">
                {canSave ? <Button disabled={saving} type="submit">{saving ? 'Đang lưu...' : 'Lưu chứng nhận'}</Button> : null}
                {selected && permissions.includes(PERMISSIONS.certificateArchive) ? <Button disabled={saving} onClick={() => void changeArchive('archive')} type="button" variant="danger">Lưu trữ</Button> : null}
              </div>
            </form>
          )}
        </Modal>
      </div>
    </div>
  );
}
