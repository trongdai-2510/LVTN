'use client';

import { authStore } from '@/features/auth/auth.store';
import { adminPath } from './admin-navigation';

type ApiEnvelope<T> =
  | { ok: true; data: T; meta?: Record<string, unknown> }
  | {
      ok: false;
      error: { code: string; message: string; details?: Record<string, unknown> };
    };

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:4000';

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  retry = true
): Promise<T> {
  const token = authStore.getAccessToken();
  const isFormData =
    typeof FormData !== 'undefined' && body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body:
      body === undefined
        ? undefined
        : isFormData
          ? (body as FormData)
          : JSON.stringify(body)
  });

  if (response.status === 401 && retry && authStore.getRefreshToken()) {
    const refreshed = await authStore.refresh();
    if (refreshed) {
      return request<T>(method, path, body, false);
    }
    authStore.clear();
    if (typeof window !== 'undefined') window.location.assign(adminPath('/login'));
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? ((await response.json()) as ApiEnvelope<T>)
    : null;

  if (!response.ok || !payload || payload.ok === false) {
    const error =
      payload && payload.ok === false
        ? payload.error
        : { code: `HTTP_${response.status}`, message: 'Không thể kết nối hệ thống.' };
    throw new ApiClientError(response.status, error.code, error.message, error.details);
  }

  return payload.data;
}

async function requestBlob(path: string, retry = true): Promise<Blob> {
  const token = authStore.getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  if (response.status === 401 && retry && authStore.getRefreshToken()) {
    const refreshed = await authStore.refresh();
    if (refreshed) {
      return requestBlob(path, false);
    }
    authStore.clear();
    if (typeof window !== 'undefined') window.location.assign(adminPath('/login'));
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? ((await response.json()) as ApiEnvelope<never>)
      : null;
    const error =
      payload && payload.ok === false
        ? payload.error
        : { code: `HTTP_${response.status}`, message: 'Không thể kết nối hệ thống.' };
    throw new ApiClientError(response.status, error.code, error.message, error.details);
  }

  return response.blob();
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  getBlob: (path: string) => requestBlob(path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  postForm: <T>(path: string, body: FormData) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path)
};
