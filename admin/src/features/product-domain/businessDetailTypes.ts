

export type DetailConfirmAction =
  | 'soft-archive'
  | 'soft-restore'
  | 'display-archive'
  | null;

export type FieldErrors = Record<string, string>;
