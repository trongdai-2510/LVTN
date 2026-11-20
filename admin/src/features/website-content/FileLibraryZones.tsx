'use client';

import { cn } from '@/lib/cn';
import {
  FILE_USAGE_GROUP_OPTIONS,
  type FileUsageGroupFilter
} from '@/lib/file-workflow';

const FILE_LIBRARY_ZONES: Array<{
  value: FileUsageGroupFilter;
  label: string;
}> = [{ value: 'all', label: 'Tất cả tệp' }, ...FILE_USAGE_GROUP_OPTIONS];

export function FileLibraryZones({
  value,
  onChange
}: {
  value: FileUsageGroupFilter;
  onChange: (value: FileUsageGroupFilter) => void;
}) {
  return (
    <section className="rounded-sm border border-border bg-panel px-4 py-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-text">Khu tệp</h2>
        <p className="text-sm text-muted-foreground">
          Tệp mới được gán khu ngay khi tải lên. Với tệp cũ chưa phân loại, hệ
          thống sẽ suy ra từ nơi đang sử dụng.
        </p>
      </div>
      <div data-file-zone-nav="true" className="mt-4 flex flex-wrap gap-2">
        {FILE_LIBRARY_ZONES.map((zone) => (
          <button
            key={zone.value}
            type="button"
            className={cn(
              'rounded-sm border px-3 py-2 text-sm font-medium transition-colors',
              zone.value === value
                ? 'border-primary bg-blue-50 text-primary'
                : 'border-border bg-muted text-text hover:bg-panel'
            )}
            onClick={() => onChange(zone.value)}
          >
            {zone.label}
          </button>
        ))}
      </div>
    </section>
  );
}
