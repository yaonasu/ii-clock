import { registerPlugin } from '@capacitor/core';

// Android APK only. Google Play Services AuthorizationClient handles account consent.
const calendarAuth = registerPlugin<{
  authorize(): Promise<{ accessToken: string }>;
  logout(): Promise<void>;
}>('CalendarAuth');

export interface User { email?: string | null }
export const auth = {
  currentUser: null as User | null,
  onAuthStateChanged(callback: (user: User | null) => void) {
    callback(null);
    return () => {};
  },
};

let accessToken: string | null = null;
let connected = localStorage.getItem('ii_clock_google_connected') === '1';
const listeners = new Set<(user: User | null, token: string | null) => void>();
const emit = () => listeners.forEach(fn => fn(connected ? {} : null, accessToken));

export const googleSignIn = async (): Promise<{ user: User | null; accessToken: string }> => {
  const result = await calendarAuth.authorize();
  accessToken = result.accessToken;
  connected = true;
  localStorage.setItem('ii_clock_google_connected', '1');
  emit();
  return { user: {}, accessToken };
};

export const getAccessToken = async (): Promise<string | null> => {
  if (accessToken) return accessToken;
  if (!connected) return null;
  try {
    const result = await calendarAuth.authorize();
    accessToken = result.accessToken;
    return accessToken;
  } catch { connected = false; emit(); return null; }
};

export const initAuth = (
  onAuthSuccess?: (user: User | null, token: string) => void,
  onAuthFailure?: () => void,
) => {
  const fn = (user: User | null, token: string | null) => {
    if (token) onAuthSuccess?.(user, token);
    else onAuthFailure?.();
  };
  listeners.add(fn);
  fn(connected ? {} : null, accessToken);
  if (connected && !accessToken) {
    void getAccessToken().then(token => { if (token) emit(); });
  }
  return () => { listeners.delete(fn); };
};

export const logout = async () => {
  await calendarAuth.logout();
  connected = false;
  localStorage.removeItem('ii_clock_google_connected');
  accessToken = null;
  emit();
};
