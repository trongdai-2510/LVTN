'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { usePermissions } from '@/features/auth/useAuthState';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { PERMISSIONS } from '@/lib/permissions';
import type { Tag } from './TagManager';

export function ProductTagPanel({ productId }: { productId: string }) {
  const permissions=usePermissions();
  const [tags,setTags]=useState<Tag[]>([]);
  const [selectedIds,setSelectedIds]=useState<string[]>([]);
  const [query,setQuery]=useState('');
  const [saving,setSaving]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const productPath=`${endpoints.songThanh.productGroups}/${productId}/tags`;
  const load=useCallback(async()=>{setLoading(true);try{const [all,assigned]=await Promise.all([apiClient.get<{items:Tag[]}>(endpoints.songThanh.tags),apiClient.get<{items:Tag[]}>(productPath)]);setTags(all.items);setSelectedIds(assigned.items.map(tag=>tag.id));setError('');}catch(cause){setError(cause instanceof Error?cause.message:'Không tải được nhãn sản phẩm.');}finally{setLoading(false);}},[productPath]);
  useEffect(()=>{if(permissions.includes(PERMISSIONS.tagRead))void load();else setLoading(false);},[load,permissions]);
  const visible=useMemo(()=>tags.filter(tag=>!tag.deleted_at&&(tag.status==='active'||selectedIds.includes(tag.id))&&tag.name.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))),[tags,query,selectedIds]);
  async function persist(ids:string[],message:string){if(ids.length>12){setError('Mỗi sản phẩm có tối đa 12 nhãn.');return;}setSaving(true);setError('');try{await apiClient.put(productPath,{tag_ids:ids});setSelectedIds(ids);setNotice(message);}catch(cause){setError(cause instanceof Error?cause.message:'Không gắn được nhãn.');}finally{setSaving(false);}}
  async function createAndAttach(){const name=query.trim();if(!name||saving||!permissions.includes(PERMISSIONS.tagCreate))return;if(selectedIds.length>=12){setError('Mỗi sản phẩm có tối đa 12 nhãn.');return;}setSaving(true);setError('');try{const result=await apiClient.post<{tag:Tag}>(endpoints.songThanh.tags,{name});const ids=[...selectedIds,result.tag.id];await apiClient.put(productPath,{tag_ids:ids});setTags(current=>[...current,result.tag]);setSelectedIds(ids);setQuery('');setNotice(`Đã tạo và gắn nhãn “${result.tag.name}”.`);}catch(cause){setError(cause instanceof Error?cause.message:'Không tạo được nhãn.');}finally{setSaving(false);}}
  if(!permissions.includes(PERMISSIONS.tagRead))return null;
  return <Card className="space-y-4 p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-xl font-semibold text-secondary">Nhãn sản phẩm</h2><p className="mt-1 text-sm text-body">Tìm nhãn, nhấn để gắn hoặc gỡ. Thay đổi được lưu ngay. Sản phẩm đã công khai có thể cần duyệt lại sau khi đổi nhãn.</p></div><Link className="text-sm font-semibold text-primary hover:underline" href="/tags">Quản lý nhãn</Link></div>
    {error?<p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>:null}{notice?<p className="rounded-md bg-green-50 p-3 text-sm text-green-800" role="status">{notice}</p>:null}
    <label className="block text-sm font-medium text-secondary">Tìm hoặc tạo nhãn<input className="mt-1 min-h-11 w-full rounded-md border border-border px-3" onChange={event=>setQuery(event.target.value)} placeholder="Ví dụ: Dùng ngoài trời" type="search" value={query}/></label>
    {loading?<p className="text-sm text-body">Đang tải nhãn...</p>:<div className="flex flex-wrap gap-2">{visible.map(tag=><button aria-pressed={selectedIds.includes(tag.id)} className={`min-h-11 rounded-full border px-4 text-sm font-medium ${selectedIds.includes(tag.id)?'border-primary bg-primarySoft text-primary':'border-border text-secondary hover:border-primary'}`} disabled={saving||!permissions.includes(PERMISSIONS.productGroupUpdate)} key={tag.id} onClick={()=>void persist(selectedIds.includes(tag.id)?selectedIds.filter(id=>id!==tag.id):[...selectedIds,tag.id],selectedIds.includes(tag.id)?'Đã gỡ nhãn.':'Đã gắn nhãn.')} type="button">{tag.name}</button>)}{visible.length===0?<p className="text-sm text-body">Không có nhãn phù hợp.</p>:null}</div>}
    {query.trim()&&!tags.some(tag=>!tag.deleted_at&&tag.name.toLocaleLowerCase('vi')===query.trim().toLocaleLowerCase('vi'))&&permissions.includes(PERMISSIONS.tagCreate)&&permissions.includes(PERMISSIONS.productGroupUpdate)?<Button disabled={saving} onClick={()=>void createAndAttach()} type="button">Tạo và gắn “{query.trim()}”</Button>:null}
  </Card>;
}
