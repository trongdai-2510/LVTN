'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { usePermissions } from '@/features/auth/useAuthState';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { PERMISSIONS } from '@/lib/permissions';

export type Tag = { id: string; name: string; slug: string; status: 'active' | 'inactive'; deleted_at: string | null };
export function TagManager() {
  const permissions = usePermissions();
  const [items,setItems] = useState<Tag[]>([]);
  const [selected,setSelected] = useState<Tag | null>(null);
  const [name,setName] = useState('');
  const [status,setStatus] = useState<'active'|'inactive'>('active');
  const [query,setQuery] = useState('');
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const load=useCallback(async()=>{setLoading(true);try{const result=await apiClient.get<{items:Tag[]}>(endpoints.songThanh.tags);setItems(result.items);setError('');}catch(cause){setError(cause instanceof Error?cause.message:'Không tải được nhãn.');}finally{setLoading(false);}},[]);
  useEffect(()=>{void load();},[load]);
  function choose(tag:Tag|null){setSelected(tag);setName(tag?.name??'');setStatus(tag?.status??'active');setError('');setNotice('');}
  async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();if(saving)return;const value=name.trim();if(!value){setError('Nhập tên nhãn trước khi lưu.');return;}setSaving(true);setError('');try{if(selected)await apiClient.put(`${endpoints.songThanh.tags}/${selected.id}`,{name:value,status});else await apiClient.post(endpoints.songThanh.tags,{name:value,status});await load();choose(null);setNotice(selected?'Đã cập nhật nhãn.':'Đã tạo nhãn.');}catch(cause){setError(cause instanceof Error?cause.message:'Không lưu được nhãn.');}finally{setSaving(false);}}
  async function changeArchive(action:'archive'|'restore'){if(!selected||saving)return;if(action==='archive'&&!window.confirm(`Lưu trữ nhãn “${selected.name}”? Nhãn sẽ không còn hiện trên website.`))return;setSaving(true);try{await apiClient.post(`${endpoints.songThanh.tags}/${selected.id}/${action}`);await load();choose(null);setNotice(action==='archive'?'Đã lưu trữ nhãn.':'Đã khôi phục nhãn.');}catch(cause){setError(cause instanceof Error?cause.message:'Không thể đổi trạng thái nhãn.');}finally{setSaving(false);}}
  const canSave=selected?permissions.includes(PERMISSIONS.tagUpdate)&&!selected.deleted_at:permissions.includes(PERMISSIONS.tagCreate);
  return <div className="space-y-6 pb-12"><header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-primary">Sản phẩm</p><h1 className="mt-2 font-display text-3xl font-semibold text-secondary">Nhãn sản phẩm</h1><p className="mt-2 max-w-2xl text-sm text-body">Tạo nhãn một lần, sau đó tìm và gắn ngay trong trang sửa sản phẩm. Hệ thống tự quản lý liên kết giữa nhãn và sản phẩm.</p></div>{permissions.includes(PERMISSIONS.tagCreate)?<Button onClick={()=>choose(null)} type="button">Thêm nhãn</Button>:null}</header>
    {error?<p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</p>:null}{notice?<p className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800" role="status">{notice}</p>:null}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]"><Card className="p-5 sm:p-6"><label className="block text-sm font-medium text-secondary">Tìm nhãn<input className="mt-1 min-h-11 w-full rounded-md border border-border px-3" onChange={event=>setQuery(event.target.value)} type="search" value={query}/></label>{loading?<p className="py-8 text-sm text-body">Đang tải...</p>:items.length===0?<p className="py-8 text-sm text-body">Chưa có nhãn. Có thể tạo ngay ở đây hoặc trong trang sửa sản phẩm.</p>:<ul className="mt-4 divide-y divide-border">{items.filter(item=>item.name.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))).map(item=><li key={item.id}><button className="flex min-h-14 w-full items-center justify-between gap-3 text-left text-secondary hover:text-primary" onClick={()=>choose(item)} type="button"><span className="font-semibold">{item.name}</span><span className="text-xs">{item.deleted_at?'Đã lưu trữ':item.status==='active'?'Đang dùng':'Tạm ẩn'}</span></button></li>)}</ul>}</Card>
    <Card className="p-5 sm:p-6"><h2 className="font-display text-xl font-semibold text-secondary">{selected?`Sửa ${selected.name}`:'Nhãn mới'}</h2>{selected?.deleted_at?<div className="mt-5">{permissions.includes(PERMISSIONS.tagRestore)?<Button disabled={saving} onClick={()=>void changeArchive('restore')} type="button">Khôi phục</Button>:null}</div>:<form className="mt-5 space-y-4" onSubmit={event=>void save(event)}><label className="block text-sm font-medium text-secondary">Tên nhãn<input className="mt-1 min-h-11 w-full rounded-md border border-border px-3" disabled={!canSave||saving} maxLength={64} onChange={event=>setName(event.target.value)} required value={name}/></label><p className="text-xs text-body">Đường dẫn được tạo tự động; đổi tên không làm mất liên kết đã gắn.</p><label className="block text-sm font-medium text-secondary">Trạng thái<select className="mt-1 min-h-11 w-full rounded-md border border-border px-3" disabled={!canSave||saving} onChange={event=>setStatus(event.target.value as typeof status)} value={status}><option value="active">Đang dùng</option><option value="inactive">Tạm ẩn</option></select></label><div className="flex flex-wrap gap-2">{canSave?<Button disabled={saving} type="submit">{saving?'Đang lưu...':'Lưu nhãn'}</Button>:null}{selected&&permissions.includes(PERMISSIONS.tagArchive)?<Button disabled={saving} onClick={()=>void changeArchive('archive')} type="button" variant="danger">Lưu trữ</Button>:null}</div></form>}</Card></div>
  </div>;
}
