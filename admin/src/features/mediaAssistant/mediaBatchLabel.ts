import type { MediaBatch } from './mediaAssistantTypes';

export function mediaBatchLabel(batch: MediaBatch): string {
  const name = batch.batch_name?.trim();
  if (name) return name;

  const created = new Date(batch.created_at);
  if (Number.isNaN(created.getTime())) return 'Ảnh/PDF đã lưu';
  const date = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh'
  }).format(created);
  return `Ảnh/PDF tạo ${date}`;
}
