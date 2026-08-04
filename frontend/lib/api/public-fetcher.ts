type ApiSuccessEnvelope<T> = {
  ok: true;
  data: T;
  meta: Record<string, unknown>;
};

type ApiErrorEnvelope = {
  ok: false;
  error: {
    code: string;
    message: string;
    details: unknown;
  };
};

type PublicApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

const IMPLICIT_LOCAL_API_BASE_URL = 'http://localhost:4000';

export class PublicApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details: unknown
  ) {
    super(message);
    this.name = 'PublicApiError';
  }
}

function resolvePublicApiUrl(pathname: string): string {
  if (typeof window !== 'undefined') {
    return pathname;
  }

  const baseUrl =
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    IMPLICIT_LOCAL_API_BASE_URL;

  return `${baseUrl}${pathname}`;
}

function hasConfiguredServerApiBaseUrl(): boolean {
  return Boolean(process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL);
}

function shouldBlockImplicitLocalApiFetch(): boolean {
  return typeof window === 'undefined' && process.env.NODE_ENV === 'production' && !hasConfiguredServerApiBaseUrl();
}

export async function publicFetcher<T>(pathname: string, init?: RequestInit): Promise<T> {
  if (shouldBlockImplicitLocalApiFetch()) {
    throw new PublicApiError(
      'Public API base URL is not configured for production server rendering.',
      0,
      'PUBLIC_API_BASE_URL_MISSING',
      {
        pathname,
        expected_env: ['API_BASE_URL', 'NEXT_PUBLIC_API_BASE_URL']
      }
    );
  }

  const fetchInit: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } } = {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {})
    }
  };

  const hasCacheOverride = init && ('cache' in init || 'next' in (init as Record<string, unknown>));

  if (!hasCacheOverride) {
    fetchInit.cache = 'no-store';
  }

  let response: Response;
  try {
    response = await fetch(resolvePublicApiUrl(pathname), fetchInit);
  } catch (error) {
    throw new PublicApiError('Public API is unavailable.', 0, 'PUBLIC_API_UNAVAILABLE', {
      pathname,
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  let payload: PublicApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as PublicApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || !payload.ok) {
    const code = payload && !payload.ok ? payload.error.code : 'HTTP_ERROR';
    const message =
      payload && !payload.ok ? payload.error.message : `HTTP ${response.status} ${response.statusText}`.trim();
    const details = payload && !payload.ok ? payload.error.details : null;

    throw new PublicApiError(message, response.status, code, details);
  }

  return payload.data;
}
