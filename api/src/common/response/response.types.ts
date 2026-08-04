export interface ApiSuccessResponse<TData = unknown, TMeta = Record<string, unknown>> {
  ok: true;
  data: TData;
  meta: TMeta;
}

export interface ApiErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown> | null;
  };
}

export interface ApiPayload<TData = unknown, TMeta = Record<string, unknown>> {
  data: TData;
  meta?: TMeta;
}
