export interface CurrentUser {
  id: string;
  email: string;
  display_name: string;
  status: 'active' | 'inactive' | 'locked';
  roles: string[];
  permissions: string[];
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  revision: number;
  iat?: number;
  exp?: number;
}
