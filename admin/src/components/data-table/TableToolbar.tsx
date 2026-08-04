import { Search } from '@/components/icons';
import { type ReactNode, useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function TableToolbar({
  value,
  onChange,
  placeholder = 'Tìm kiếm',
  children,
  hasActiveFilters,
  onClear,
  debounceMs = 300
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  children?: ReactNode;
  hasActiveFilters?: boolean;
  onClear?: () => void;
  debounceMs?: number;
}) {
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  useEffect(() => {
    if (draftValue === value) {
      return;
    }
    const timer = window.setTimeout(() => {
      onChange(draftValue);
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [debounceMs, draftValue, onChange, value]);

  return (
    <div data-admin-filter-toolbar="true" className="border-b border-border bg-panel px-4 py-3">
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2.5">
          <div className="relative min-w-[280px] flex-[1_1_360px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={draftValue}
              onChange={(event) => setDraftValue(event.target.value)}
              placeholder={placeholder}
            />
          </div>
          {children ? <div className="flex min-w-0 flex-wrap items-end gap-2.5">{children}</div> : null}
        </div>
        {onClear ? (
          <Button
            type="button"
            className="h-[var(--control-height)]"
            variant="secondary"
            disabled={!hasActiveFilters}
            onClick={onClear}
          >
            Xóa lọc
          </Button>
        ) : null}
      </div>
    </div>
  );
}
