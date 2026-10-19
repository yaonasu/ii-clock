import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, type User } from 'firebase/auth';
export type { User };
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';

const provider = new GoogleAuthProvider();
provider.addScope(CALENDAR_SCOPE);
provider.setCustomParameters({
  prompt: 'select_account',
});

let isSigningIn = false;

// Token storage key
const TOKEN_STORAGE_KEY = 'ii_clock_google_access_token';

// Get cached access token from memory or localStorage
export const getStoredAccessToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
};

export const setStoredAccessToken = (token: string | null): void => {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
};

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User | null, token: string) => void,
  onAuthFailure?: () => void
) => {
  const storedToken = getStoredAccessToken();
  if (storedToken && onAuthSuccess) {
    onAuthSuccess(auth.currentUser, storedToken);
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    const token = getStoredAccessToken();
    if (token) {
      if (onAuthSuccess) onAuthSuccess(user, token);
    } else if (user) {
      // User logged in but no token stored
      if (onAuthFailure) onAuthFailure();
    } else {
      setStoredAccessToken(null);
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User | null; accessToken: string } | null> => {
  // 1. First attempt: Direct Google Identity Services (GIS) TokenClient
  // This bypasses Firebase Auth handler and eliminates "The requested action is invalid"
  if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2 && firebaseConfig.oAuthClientId) {
    try {
      const token = await new Promise<string>((resolve, reject) => {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: firebaseConfig.oAuthClientId,
          scope: CALENDAR_SCOPE,
          callback: (response: any) => {
            if (response.error) {
              reject(new Error(response.error_description || response.error));
            } else if (response.access_token) {
              resolve(response.access_token);
            } else {
              reject(new Error('アクセストークンを取得できませんでした'));
            }
          },
        });
        client.requestAccessToken({ prompt: 'select_account' });
      });
      setStoredAccessToken(token);
      return { user: auth.currentUser, accessToken: token };
    } catch (gisErr) {
      console.warn('GIS TokenClient error, trying Firebase popup fallback:', gisErr);
    }
  }

  // 2. Fallback attempt: Firebase Auth signInWithPopup
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Googleアカウントからアクセストークンを取得できませんでした。再度ログインしてください。');
    }
    const accessToken = credential.accessToken;
    setStoredAccessToken(accessToken);
    return { user: result.user, accessToken };
  } catch (error: unknown) {
    console.error('Google Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch {}
  setStoredAccessToken(null);
};
