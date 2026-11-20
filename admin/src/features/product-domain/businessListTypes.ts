import { type RecordMap } from './businessPageShared';

export type BulkStatusActionConfig = {
  key: string;
  label: string;
  description: string;
  targetSummary: string;
  payload: Record<string, string>;
};

type BulkStatusResultItem = {
  id: string;
  label?: string;
  name: string;
  status: string;
  success: boolean;
  error_code: string | null;
  message: string;
};

export type BulkStatusResponse = {
  total_selected: number;
  updated_count: number;
  blocked_count: number;
  dry_run?: boolean;
  results: BulkStatusResultItem[];
};

export type BulkStatusDialogState = {
  action: BulkStatusActionConfig;
  preview: BulkStatusResponse;
};

export type BulkStatusRunState = {
  action: BulkStatusActionConfig;
  response: BulkStatusResponse;
};

export type BrandStatusValue = 'active' | 'inactive';

export type BrandVisibilityAction = {
  row: RecordMap;
  nextStatus: BrandStatusValue;
};
