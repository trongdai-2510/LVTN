import { authStore } from './auth.store';

export const authApi = {
  login: (email: string, password: string) => authStore.login(email, password),
  logout: () => authStore.logout(),
  me: () => authStore.loadMe(),
  refresh: () => authStore.refresh()
};
