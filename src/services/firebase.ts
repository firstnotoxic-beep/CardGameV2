import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Use named firestoreDatabaseId if configured
export const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

// State tracking for anonymous auth availability
let isAnonymousDisabled = false;
let hasAttemptedAnonymous = false;

export function isAnonymousAuthDisabled(): boolean {
  return isAnonymousDisabled;
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

// Google Sign-In with popup
export async function loginWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  } catch (error: any) {
    console.error('Google Sign-In failed:', error);
    throw error;
  }
}

// User Sign-Out
export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Sign-Out failed:', error);
    throw error;
  }
}

// Test connection on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or cannot connect to Firestore.');
      return false;
    }
    // Permission denied on 'test/connection' is expected and normal under security rules
    return true;
  }
}

// Auto sign-in or session observer with graceful handling of auth/admin-restricted-operation
export function initAuthSession(onUserChange: (user: User | null) => void): () => void {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      onUserChange(user);
    } else {
      onUserChange(null);
      // Attempt anonymous auth once if not already known to be disabled
      if (!hasAttemptedAnonymous && !isAnonymousDisabled) {
        hasAttemptedAnonymous = true;
        try {
          await signInAnonymously(auth);
        } catch (err: any) {
          if (
            err?.code === 'auth/admin-restricted-operation' ||
            String(err?.message || '').includes('admin-restricted-operation')
          ) {
            isAnonymousDisabled = true;
            console.info(
              '[Firebase Auth] Anonymous authentication is disabled in Firebase Console (auth/admin-restricted-operation). Operating in Guest / Google Sign-In mode.'
            );
          } else {
            console.warn('[Firebase Auth] Anonymous sign-in note:', err?.message || err);
          }
        }
      }
    }
  });

  return unsubscribe;
}

// Ensure an authenticated user is ready before initiating Firestore writes
export async function ensureAuth(): Promise<User> {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  // If anonymous auth is not disabled, try it
  if (!isAnonymousDisabled) {
    try {
      const credential = await signInAnonymously(auth);
      return credential.user;
    } catch (err: any) {
      if (
        err?.code === 'auth/admin-restricted-operation' ||
        String(err?.message || '').includes('admin-restricted-operation')
      ) {
        isAnonymousDisabled = true;
      }
    }
  }

  // If we reach here, anonymous sign-in is disabled or unavailable. Prompt for Google Sign-in.
  throw new Error(
    'กรุณาเข้าสู่ระบบด้วย Google บัญชีจริง (กดปุ่ม "เข้าสู่ระบบด้วย Google" ด้านบน) เพื่อเปิดห้องออนไลน์หรือบันทึกข้อมูลไปยังคลาวด์'
  );
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
