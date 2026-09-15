import type { ApiEnvelope } from '@/types';
import { http, withToken } from '@/config/axios.config';
import { useAuthStore } from '@/stores/auth-store';

export async function authed() {
  const token = await useAuthStore.getState().ensureAccessToken();
  return withToken(token);
}

export function unwrap<T>(envelope: ApiEnvelope<T>): T {
  if (envelope.data === undefined) {
    throw new Error('Empty response');
  }
  return envelope.data;
}

export async function getData<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const cleaned = Object.fromEntries(
    Object.entries(params ?? {}).filter(([, value]) => value !== undefined && value !== ''),
  );
  const response = await http.get<ApiEnvelope<T>>(url, { ...(await authed()), params: cleaned });
  return unwrap(response.data);
}

export async function postData<T>(url: string, body: unknown): Promise<T> {
  const response = await http.post<ApiEnvelope<T>>(url, body, await authed());
  return unwrap(response.data);
}

export async function patchData<T>(url: string, body: unknown): Promise<T> {
  const response = await http.patch<ApiEnvelope<T>>(url, body, await authed());
  return unwrap(response.data);
}

export async function deleteData<T>(url: string): Promise<T> {
  const response = await http.delete<ApiEnvelope<T>>(url, await authed());
  return unwrap(response.data);
}
