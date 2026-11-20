'use client';

import { useEffect, useState } from 'react';

import { authStore } from './auth.store';
import type { AuthState } from './auth.types';

export function useAuthState() {
  const [state, setState] = useState<AuthState>(() => authStore.getState());

  useEffect(() => {
    const unsubscribe = authStore.subscribe(setState);
    authStore.hydrate();
    return unsubscribe;
  }, []);

  return state;
}

export function usePermissions() {
  return useAuthState().permissions;
}
