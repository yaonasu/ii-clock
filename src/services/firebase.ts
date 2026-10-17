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
  access_type: 'offline',
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
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const storedToken = getStoredAccessToken();
      if (storedToken) {
        if (onAuthSuccess) onAuthSuccess(user, storedToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      setStoredAccessToken(null);
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
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
  await signOut(auth);
  setStoredAccessToken(null);
};
