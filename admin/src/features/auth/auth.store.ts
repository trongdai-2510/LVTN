'use client';

import type { AuthState, LoginResponse, MeResponse } from './auth.types';

const STORAGE_KEY = 'song-thanh-admin-auth';
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:4000';

type Listener = (state: AuthState) => void;

export class AuthRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const emptyState: AuthState = {
  hydrated: false,
  accessToken: null,
  refreshToken: null,
  user: null,
  permissions: [],
  roles: []
};

function readStoredState(): AuthState {
  if (typeof window === 'undefined') return emptyState;
  const raw =
    window.sessionStorage.getItem(STORAGE_KEY) ??
    window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...emptyState, hydrated: true };
  try {
    const storedState = {
      ...emptyState,
      ...(JSON.parse(raw) as Partial<AuthState>),
      hydrated: true
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(storedState));
    window.localStorage.removeItem(STORAGE_KEY);
    return storedState;
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(STORAGE_KEY);
    return { ...emptyState, hydrated: true };
  }
}

function writeStoredState(state: AuthState) {
  if (typeof window === 'undefined') return;
  if (!state.accessToken && !state.refreshToken) {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  const { hydrated: _hydrated, ...persisted } = state;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  window.localStorage.removeItem(STORAGE_KEY);
}

async function postEnvelope<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new AuthRequestError(payload?.error?.message || 'Không thể kết nối hệ thống.', response.status);
  }
  return payload.data as T;
}

async function getEnvelope<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new AuthRequestError(payload?.error?.message || 'Không thể kết nối hệ thống.', response.status);
  }
  return payload.data as T;
}

class AuthStore {
  private state: AuthState = emptyState;
  private listeners = new Set<Listener>();

  hydrate() {
    if (this.state.hydrated) return this.state;
    this.state = readStoredState();
    this.listeners.forEach((listener) => listener(this.state));
    return this.state;
  }

  getState() {
    return this.state;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getAccessToken() {
    return this.getState().accessToken;
  }

  getRefreshToken() {
    return this.getState().refreshToken;
  }

  hasPermission(permission?: string) {
    return !permission || this.getState().permissions.includes(permission);
  }

  setState(next: AuthState) {
    this.state = { ...next, hydrated: true };
    writeStoredState(next);
    this.listeners.forEach((listener) => listener(this.state));
  }

  async login(email: string, password: string) {
    const data = await postEnvelope<LoginResponse>('/auth/login', { email, password });
    this.setState({
      hydrated: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      user: data.user,
      permissions: data.permissions,
      roles: data.roles
    });
    return data;
  }

  async refresh() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;
    try {
      const data = await postEnvelope<
        MeResponse & { access_token: string; refresh_token: string }
      >('/auth/refresh', {
        refresh_token: refreshToken
      });
      this.setState({
        hydrated: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        user: data.user,
        permissions: data.permissions,
        roles: data.roles
      });
      return true;
    } catch {
      this.clear();
      return false;
    }
  }

  async loadMe() {
    const accessToken = this.getAccessToken();
    if (!accessToken) return null;
    const data = await getEnvelope<MeResponse>('/auth/me', accessToken);
    this.setState({
      ...this.getState(),
      hydrated: true,
      user: data.user,
      permissions: data.permissions,
      roles: data.roles
    });
    return data;
  }

  async logout() {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      try {
        await postEnvelope('/auth/logout', { refresh_token: refreshToken });
      } catch {
        // Local session cleanup is still required if the network request fails.
      }
    }
    this.clear();
  }

  clear() {
    this.setState({ ...emptyState, hydrated: true });
  }
}

export const authStore = new AuthStore();
