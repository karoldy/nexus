import { http, type ApiEnvelope, withToken } from '@/config/axios.config';
import { paths } from '@/routers/paths';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type MePayload = {
  user: AuthUser;
  permissionCodes: string[];
};

function sessionTokenFromHeaders(headers: Record<string, unknown>): string {
  const token = headers['set-auth-token'];
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('未返回会话 token');
  }
  return token;
}

export async function signInEmail(email: string, password: string): Promise<string> {
  const response = await http.post('/api/auth/sign-in/email', { email, password });
  return sessionTokenFromHeaders(response.headers as Record<string, unknown>);
}

export async function signUpEmail(name: string, email: string, password: string): Promise<string> {
  const response = await http.post('/api/auth/sign-up/email', { name, email, password });
  return sessionTokenFromHeaders(response.headers as Record<string, unknown>);
}

export async function fetchAccessToken(sessionToken: string): Promise<string> {
  const response = await http.get<{ token?: string }>('/api/auth/token', withToken(sessionToken));
  if (!response.data.token) {
    throw new Error('未返回 access token');
  }
  return response.data.token;
}

export async function fetchMe(accessToken: string): Promise<MePayload> {
  const response = await http.get<ApiEnvelope<MePayload>>('/api/me', withToken(accessToken));
  if (!response.data.data) {
    throw new Error('未返回用户信息');
  }
  return response.data.data;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await http.post('/api/auth/request-password-reset', {
    email,
    redirectTo: `${window.location.origin}${paths.resetPassword}`,
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await http.post('/api/auth/reset-password', { token, newPassword });
}

export async function changePassword(
  sessionToken: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await http.post(
    '/api/auth/change-password',
    {
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    },
    withToken(sessionToken),
  );
}

export async function signOut(sessionToken: string | null): Promise<void> {
  if (!sessionToken) {
    return;
  }
  await http.post('/api/auth/sign-out', undefined, withToken(sessionToken));
}

export function isJwtExpired(token: string, skewMs = 30_000): boolean {
  try {
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment) {
      return true;
    }
    const payload = JSON.parse(atob(payloadSegment.replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number;
    };
    if (typeof payload.exp !== 'number') {
      return true;
    }
    return Date.now() >= payload.exp * 1000 - skewMs;
  } catch {
    return true;
  }
}
