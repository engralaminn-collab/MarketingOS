'use client';

export { useApiQuery, useApiMutation } from './use-api-query';

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mos_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(errBody.error || `Request failed (HTTP ${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
