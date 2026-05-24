import { auth } from './firebase.js';

const BASE = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, '');

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const selectedMode = localStorage.getItem('omnikey_db_mode') || 'cloud';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-database-mode': selectedMode,
    ...(options?.headers as Record<string, string>),
  };

  // If a Firebase user is logged in, attach the fresh ID Token automatically
  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    } catch (e) {
      console.warn('Failed to retrieve active Firebase ID token:', e);
    }
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(body.error?.message ?? body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}
