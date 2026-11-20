'use client';

import { authStore } from '@/features/auth/auth.store';
import { adminPath } from './admin-navigation';

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly serverMessage: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(status >= 500
      ? 'Hệ thống đang gặp lỗi xử lý. Vui lòng thử lại sau.'
      : status === 0
        ? 'Không thể kết nối hệ thống. Vui lòng kiểm tra mạng và thử lại.'
      : status === 401 || status === 403
        ? 'Phiên đăng nhập hoặc quyền thao tác chưa hợp lệ.'
        : 'Chưa thể hoàn tất thao tác. Vui lòng kiểm tra dữ liệu và thử lại.');
    this.status = status;
    this.code = code;
    this.serverMessage = message;
    this.details = details;
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:4000';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function responseError(status: number, payload: unknown): ApiClientError {
  const error = asRecord(asRecord(payload)?.error);
  return new ApiClientError(
    status,
    typeof error?.code === 'string' ? error.code : `HTTP_${status}`,
    typeof error?.message === 'string' ? error.message : 'Không thể kết nối hệ thống.',
    asRecord(error?.details) ?? undefined
  );
}

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
  }).catch(() => {
    throw new ApiClientError(0, 'NETWORK_ERROR', 'Network request failed');
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
    ? await response.json().catch(() => null) as unknown
    : null;
  const envelope = asRecord(payload);

  if (!response.ok || envelope?.ok !== true || !('data' in envelope)) {
    throw responseError(response.status, payload);
  }

  return envelope.data as T;
}

async function requestBlob(path: string, retry = true): Promise<Blob> {
  const token = authStore.getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  }).catch(() => {
    throw new ApiClientError(0, 'NETWORK_ERROR', 'Network request failed');
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
      ? await response.json().catch(() => null) as unknown
      : null;
    throw responseError(response.status, payload);
  }

  return response.blob().catch(() => {
    throw new ApiClientError(0, 'NETWORK_ERROR', 'Network request failed');
  });
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  getBlob: (path: string) => requestBlob(path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  postForm: <T>(path: string, body: FormData) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path)
};
