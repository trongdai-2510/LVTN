export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  status: 'active' | 'inactive' | 'locked';
}

export interface AuthState {
  hydrated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: AdminUser | null;
  permissions: string[];
  roles: string[];
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: AdminUser;
  roles: string[];
  permissions: string[];
}

export interface MeResponse {
  user: AdminUser;
  roles: string[];
  permissions: string[];
}
