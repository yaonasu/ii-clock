import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, type User } from 'firebase/auth';
export type { User };
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const SCOPES = ['https://www.googleapis.com/auth/calendar.events.readonly'];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account',
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;
const TOKEN_KEY = 'ii_clock_google_access_token';

export const getStoredAccessToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return cachedAccessToken || localStorage.getItem(TOKEN_KEY);
};

export const setStoredAccessToken = (token: string | null): void => {
  cachedAccessToken = token;
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

export const initAuth = (
  onAuthSuccess?: (user: User | null, token: string) => void,
  onAuthFailure?: () => void
) => {
  const token = getStoredAccessToken();
  if (token && onAuthSuccess) {
    onAuthSuccess(auth.currentUser, token);
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    const currentToken = getStoredAccessToken();
    if (currentToken) {
      if (onAuthSuccess) onAuthSuccess(user, currentToken);
    } else if (user) {
      if (onAuthFailure) onAuthFailure();
    } else {
      setStoredAccessToken(null);
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User | null; accessToken: string }> => {
  // Method 1: Google Identity Services (GIS) TokenClient
  // Direct client-side authorization that avoids Firebase /__/auth/handler "The requested action is invalid"
  if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2 && firebaseConfig.oAuthClientId) {
    try {
      const token = await new Promise<string>((resolve, reject) => {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: firebaseConfig.oAuthClientId,
          scope: SCOPES.join(' '),
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
    } catch (gisError) {
      console.warn('GIS TokenClient attempt failed, trying Firebase popup fallback:', gisError);
    }
  }

  // Method 2: Firebase Auth signInWithPopup
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Googleアカウントからアクセストークンを取得できませんでした');
    }

    setStoredAccessToken(credential.accessToken);
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: unknown) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return getStoredAccessToken();
};

export const logout = async () => {
  try {
    await auth.signOut();
  } catch {}
  setStoredAccessToken(null);
};
