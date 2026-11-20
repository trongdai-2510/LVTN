'use client';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { readProductFeatures, writeProductFeatures, type ProductFeature } from './productFeatures';

export function ProductFeatureEditor({
  value,
  onChange,
  readOnly,
  error
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  error?: string;
}) {
  const draft = readProductFeatures(value);
  const features = draft.features;
  const hasLegacyTechnical = /Mã hàng|ĐẶC TÍNH KỸ THUẬT|TIÊU CHUẨN ÁP DỤNG|NHẬN BIẾT LÕI|CẤU TRÚC CÁP/i.test(draft.content);

  const updateFeatures = (next: ProductFeature[]) => {
    onChange(writeProductFeatures(draft.content, next));
  };
  const updateFeature = (index: number, key: keyof ProductFeature, nextValue: string) => {
    updateFeatures(features.map((feature, itemIndex) =>
      itemIndex === index ? { ...feature, [key]: nextValue } : feature
    ));
  };
  const moveFeature = (index: number, direction: -1 | 1) => {
    const next = [...features];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    updateFeatures(next);
  };

  if (draft.source === 'invalid') {
    return (
      <section aria-label="Đặc điểm nổi bật" data-field="detailed_description" tabIndex={-1}>
        <p className="mb-3 text-sm text-amber-800">Dữ liệu đặc điểm chưa đọc được. Hãy kiểm tra nội dung gốc trước khi lưu.</p>
        {error ? <p className="mb-3 text-sm font-medium text-red-700" role="alert">{error}</p> : null}
        <Textarea
          aria-label="Nội dung gốc sản phẩm"
          className="min-h-[380px] bg-white p-4 text-base leading-7"
          value={value}
          readOnly={readOnly}
          onChange={(event) => onChange(event.target.value)}
        />
      </section>
    );
  }

  return (
    <section aria-labelledby="product-features-title" data-field="detailed_description" tabIndex={-1}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-text" id="product-features-title">Đặc điểm nổi bật</h3>
          <p className="mt-1 max-w-[68ch] text-sm leading-6 text-muted-foreground">
            Mỗi mục bên dưới tương ứng một đặc điểm trên website. Sửa tiêu đề, nội dung và thứ tự ngay tại đây.
          </p>
          {hasLegacyTechnical ? (
            <p className="mt-1 max-w-[68ch] text-sm leading-6 text-muted-foreground">
              Với dữ liệu kỹ thuật cũ, Tổng quan hiển thị câu đầu của mỗi mục. Nội dung đầy đủ vẫn được giữ cùng phần thông số.
            </p>
          ) : null}
        </div>
        {!readOnly ? (
          <Button
            onClick={() => updateFeatures([...features, { title: '', description: '' }])}
            size="sm"
            type="button"
            variant="secondary"
          >
            Thêm đặc điểm
          </Button>
        ) : null}
      </div>

      {features.length > 0 ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {features.map((feature, index) => (
            <article className="min-w-0 rounded-md border border-border bg-slate-50/50 p-4 sm:p-5" key={index}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.08em] text-primary">Đặc điểm {String(index + 1).padStart(2, '0')}</span>
                {!readOnly ? (
                  <div className="flex flex-wrap gap-1">
                    <Button aria-label={`Đưa đặc điểm ${index + 1} lên`} disabled={index === 0} onClick={() => moveFeature(index, -1)} size="sm" type="button" variant="ghost">Lên</Button>
                    <Button aria-label={`Đưa đặc điểm ${index + 1} xuống`} disabled={index === features.length - 1} onClick={() => moveFeature(index, 1)} size="sm" type="button" variant="ghost">Xuống</Button>
                    <Button aria-label={`Xóa đặc điểm ${index + 1}`} onClick={() => updateFeatures(features.filter((_, itemIndex) => itemIndex !== index))} size="sm" type="button" variant="ghost">Xóa</Button>
                  </div>
                ) : null}
              </div>
              <label className="block text-sm font-medium text-text">
                Tiêu đề
                <Input
                  className="mt-1 bg-white"
                  maxLength={160}
                  readOnly={readOnly}
                  value={feature.title}
                  onChange={(event) => updateFeature(index, 'title', event.target.value)}
                />
              </label>
              <label className="mt-4 block text-sm font-medium text-text">
                Nội dung
                <Textarea
                  className="mt-1 min-h-[108px] bg-white leading-6"
                  readOnly={readOnly}
                  value={feature.description}
                  onChange={(event) => updateFeature(index, 'description', event.target.value)}
                />
              </label>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-md border border-dashed border-border px-5 py-7 text-sm text-muted-foreground">
          Chưa có đặc điểm nổi bật. Thêm mục đầu tiên nếu muốn hiển thị phần này trên website.
        </p>
      )}

      {error ? <p className="mt-3 text-sm font-medium text-red-700" role="alert">{error}</p> : null}

      <details className="mt-7 border-t border-border pt-5" open={features.length === 0 ? true : undefined}>
        <summary className="cursor-pointer font-semibold text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          Nội dung khác và bảng mã cũ
        </summary>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Giữ nguyên dữ liệu kỹ thuật đã nhập. Nếu có bảng mã, website hiển thị bảng ở tab Thông số kỹ thuật.
        </p>
        <Textarea
          aria-label="Nội dung khác và bảng mã cũ"
          className="mt-3 min-h-[300px] bg-white p-4 text-base leading-7"
          readOnly={readOnly}
          value={draft.content}
          onChange={(event) => onChange(writeProductFeatures(event.target.value, features))}
        />
      </details>
    </section>
  );
}
