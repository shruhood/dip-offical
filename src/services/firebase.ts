import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  applyActionCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
  checkActionCode,
  type ActionCodeSettings,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { OperatorKycStatus, UserRole } from '../types';
import { buildAuthActionContinueUrl } from '../lib/siteUrls';

export const ADMIN_BOOTSTRAP_EMAIL = 'allindiadigitalseva@gmail.com';
const CANONICAL_HOSTNAMES = new Set(['digitalindiaproject.com', 'www.digitalindiaproject.com']);
const FIREBASE_DEFAULT_AUTH_DOMAIN = `${firebaseConfig.projectId}.firebaseapp.com`;

// Initialize Primary Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Secondary OAuth popup handler app bound to Firebase's default firebaseapp.com authDomain.
// Guarantees Google Sign-In works across preview hosts and custom domains without auth/internal-error,
// bridging the verified Google credential cleanly onto the primary auth instance via signInWithCredential.
function getOAuthFallbackAuth() {
  const existing = getApps().find((a) => a.name === 'dip-oauth-handler');
  const oauthApp =
    existing ||
    initializeApp(
      {
        ...firebaseConfig,
        authDomain: FIREBASE_DEFAULT_AUTH_DOMAIN,
      },
      'dip-oauth-handler'
    );
  return getAuth(oauthApp);
}

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.body.readonly',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/tasks.readonly',
];

function createGoogleProvider(includeWorkspaceScopes = false): GoogleAuthProvider {
  const gp = new GoogleAuthProvider();
  gp.addScope('email');
  gp.addScope('profile');
  gp.setCustomParameters({ prompt: 'select_account' });
  if (includeWorkspaceScopes) {
    WORKSPACE_SCOPES.forEach((scope) => gp.addScope(scope));
  }
  return gp;
}

// In-Memory Token Caching (Never stored in localStorage or sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

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
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
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
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function mapFirebaseAuthError(err: any): string {
  const code = err?.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Please sign in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 8 characters with letters and numbers.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please verify your credentials or reset your password.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not yet enabled in Firebase Console Authentication > Sign-in method. Use "Continue with Google" or enable Email/Password in Firebase Console.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before completing.';
    case 'auth/popup-blocked':
      return 'Google sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for Google Sign-In in Firebase Console Authentication > Settings > Authorized domains.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with the same email address using another sign-in method.';
    case 'auth/internal-error':
      return 'Google Sign-In encountered a temporary authentication configuration error. Please allow popups/cookies and try again.';
    case 'auth/expired-action-code':
      return 'This link has expired. Please request a fresh link from digitalindiaproject.com.';
    case 'auth/invalid-action-code':
      return 'This verification or reset link is invalid or has already been used.';
    case 'auth/too-many-requests':
      return 'Too many failed sign-in attempts. Please wait a few minutes and try again.';
    default:
      return err?.message || 'Authentication failed. Please try again.';
  }
}

export function getAuthActionCodeSettings(nextRoute: string = 'login', param: string = ''): ActionCodeSettings {
  return {
    url: buildAuthActionContinueUrl(nextRoute, param),
    handleCodeInApp: true,
  };
}

// Connection Probe on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    return false;
  }
}
testFirestoreConnection();

export interface SyncedUserProfile {
  uid: string;
  displayName: string;
  email: string;
  mobile: string;
  role: 'customer' | 'operator' | 'manager' | 'partner' | 'admin' | 'super_admin' | 'business';
  accountType: 'customer' | 'business' | 'operator' | 'partner' | 'manager' | 'admin';
  companyName?: string;
  businessId?: string;
  partnerId?: string;
  referralCode?: string;
  referredByCode?: string;
  kycStatus: OperatorKycStatus;
  operatorEnrollmentId?: string;
  managerScope?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileSyncMetadata {
  displayName?: string;
  mobile?: string;
  accountType?: 'customer' | 'business' | 'operator' | 'partner';
  companyName?: string;
  referredByCode?: string;
}

// Sync authenticated Firebase User profile to /users/{uid} adhering strictly to firestore.rules
export async function syncFirebaseUserProfile(
  fbUser: FirebaseUser,
  metadata?: ProfileSyncMetadata
): Promise<SyncedUserProfile> {
  const userRef = doc(db, 'users', fbUser.uid);
  const nowIso = new Date().toISOString();
  const isBootstrappedAdmin =
    fbUser.email?.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL && fbUser.emailVerified;

  try {
    const existingSnap = await getDoc(userRef);

    if (existingSnap.exists()) {
      const existingData = existingSnap.data();
      const existingRole = (existingData?.role || 'customer') as SyncedUserProfile['role'];
      const currentRole: SyncedUserProfile['role'] = isBootstrappedAdmin ? 'super_admin' : existingRole;

      // Preserve elevated accountType if previously chosen, or upgrade from 'customer' when user explicitly registers via /signup
      const nextAccountType = (
        metadata?.accountType &&
        metadata.accountType !== 'customer' &&
        (existingRole === 'customer' || !existingData?.accountType || existingData.accountType === 'customer')
          ? metadata.accountType
          : existingData?.accountType || metadata?.accountType || (currentRole === 'super_admin' ? 'admin' : currentRole)
      ) as SyncedUserProfile['accountType'];

      const payload: Record<string, any> = {
        uid: fbUser.uid,
        displayName: (metadata?.displayName || fbUser.displayName || existingData?.displayName || 'Citizen User').slice(0, 100),
        email: (fbUser.email || existingData?.email || '').slice(0, 150),
        mobile: (metadata?.mobile || fbUser.phoneNumber || existingData?.mobile || '').slice(0, 25),
        role: currentRole,
        accountType: nextAccountType,
        kycStatus: (existingData?.kycStatus as OperatorKycStatus) || 'Not Submitted',
        createdAt: existingData?.createdAt || nowIso,
        updatedAt: nowIso,
      };

      if (metadata?.companyName || existingData?.companyName) {
        payload.companyName = (metadata?.companyName || existingData?.companyName).slice(0, 140);
      }
      if (existingData?.businessId) {
        payload.businessId = String(existingData.businessId).slice(0, 64);
      } else if (nextAccountType === 'business' || currentRole === 'business') {
        payload.businessId = `biz-${fbUser.uid.slice(0, 12)}`;
      }
      if (existingData?.partnerId) payload.partnerId = String(existingData.partnerId).slice(0, 64);
      if (existingData?.referralCode) payload.referralCode = String(existingData.referralCode).slice(0, 40);
      if (existingData?.referredByCode || metadata?.referredByCode) {
        payload.referredByCode = String(metadata?.referredByCode || existingData.referredByCode).slice(0, 40);
      }
      if (existingData?.operatorEnrollmentId) {
        payload.operatorEnrollmentId = String(existingData.operatorEnrollmentId).slice(0, 64);
      }
      if (existingData?.managerScope) {
        payload.managerScope = String(existingData.managerScope).slice(0, 100);
      }

      await setDoc(userRef, payload, { merge: false });
      return payload as SyncedUserProfile;
    } else {
      const requestedType = metadata?.accountType || 'customer';
      const initialRole: SyncedUserProfile['role'] = isBootstrappedAdmin
        ? 'super_admin'
        : requestedType === 'business'
        ? 'business'
        : 'customer';

      const payload: Record<string, any> = {
        uid: fbUser.uid,
        displayName: (metadata?.displayName || fbUser.displayName || fbUser.email?.split('@')[0] || 'Citizen User').slice(0, 100),
        email: (fbUser.email || '').slice(0, 150),
        mobile: (metadata?.mobile || fbUser.phoneNumber || '').slice(0, 25),
        role: initialRole,
        accountType: isBootstrappedAdmin ? 'admin' : requestedType,
        kycStatus: 'Not Submitted' as OperatorKycStatus,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      if (metadata?.companyName) payload.companyName = metadata.companyName.slice(0, 140);
      if (metadata?.referredByCode) payload.referredByCode = metadata.referredByCode.slice(0, 40);
      if (initialRole === 'business' || requestedType === 'business') {
        payload.businessId = `biz-${fbUser.uid.slice(0, 12)}`;
      }

      await setDoc(userRef, payload);
      return payload as SyncedUserProfile;
    }
  } catch (err) {
    console.warn('Firestore user profile sync warning:', err);
    const requestedType = metadata?.accountType || 'customer';
    return {
      uid: fbUser.uid,
      displayName: metadata?.displayName || fbUser.displayName || 'Citizen User',
      email: fbUser.email || '',
      mobile: metadata?.mobile || fbUser.phoneNumber || '',
      role: isBootstrappedAdmin ? 'super_admin' : requestedType === 'business' ? 'business' : 'customer',
      accountType: isBootstrappedAdmin ? 'admin' : requestedType,
      companyName: metadata?.companyName,
      businessId: requestedType === 'business' ? `biz-${fbUser.uid.slice(0, 12)}` : undefined,
      referredByCode: metadata?.referredByCode,
      kycStatus: 'Not Submitted',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }
}

export const firebaseEmailSignUp = async (
  email: string,
  password: string,
  metadata: ProfileSyncMetadata
): Promise<{ user: FirebaseUser; profile: SyncedUserProfile }> => {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (metadata.displayName) {
      await updateProfile(cred.user, { displayName: metadata.displayName.trim() });
    }
    try {
      await sendEmailVerification(cred.user, getAuthActionCodeSettings('login'));
    } catch {
      // Verification email dispatch is best-effort
    }
    const profile = await syncFirebaseUserProfile(cred.user, metadata);
    return { user: cred.user, profile };
  } catch (err) {
    throw new Error(mapFirebaseAuthError(err));
  }
};

export const firebaseEmailSignIn = async (
  email: string,
  password: string
): Promise<{ user: FirebaseUser; profile: SyncedUserProfile }> => {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    const profile = await syncFirebaseUserProfile(cred.user);
    return { user: cred.user, profile };
  } catch (err) {
    throw new Error(mapFirebaseAuthError(err));
  }
};

export const firebaseResetPassword = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email.trim(), getAuthActionCodeSettings('login'));
  } catch (err) {
    throw new Error(mapFirebaseAuthError(err));
  }
};

export const firebaseResendVerificationEmail = async (): Promise<void> => {
  if (!auth.currentUser) {
    throw new Error('Please sign in first to resend your verification email.');
  }
  try {
    await sendEmailVerification(auth.currentUser, getAuthActionCodeSettings('dashboard'));
  } catch (err) {
    throw new Error(mapFirebaseAuthError(err));
  }
};

export const firebaseApplyActionCode = async (oobCode: string): Promise<void> => {
  try {
    await applyActionCode(auth, oobCode);
    if (auth.currentUser) {
      await auth.currentUser.reload();
    }
  } catch (err) {
    throw new Error(mapFirebaseAuthError(err));
  }
};

export const firebaseVerifyPasswordResetCode = async (oobCode: string): Promise<string> => {
  try {
    return await verifyPasswordResetCode(auth, oobCode);
  } catch (err) {
    throw new Error(mapFirebaseAuthError(err));
  }
};

export const firebaseConfirmPasswordReset = async (oobCode: string, newPass: string): Promise<void> => {
  try {
    await confirmPasswordReset(auth, oobCode, newPass);
  } catch (err) {
    throw new Error(mapFirebaseAuthError(err));
  }
};

export const firebaseCheckActionCode = async (oobCode: string) => {
  try {
    return await checkActionCode(auth, oobCode);
  } catch (err) {
    throw new Error(mapFirebaseAuthError(err));
  }
};

export const initAuth = (
  onAuthSuccess?: (user: FirebaseUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

const POPUP_FALLBACK_ERROR_CODES = new Set([
  'auth/internal-error',
  'auth/unauthorized-domain',
  'auth/operation-not-supported-in-this-environment',
  'auth/network-request-failed',
]);

export const googleSignIn = async (
  metadata?: ProfileSyncMetadata,
  options?: { includeWorkspaceScopes?: boolean }
): Promise<{
  user: FirebaseUser;
  accessToken: string;
  profile: SyncedUserProfile;
} | null> => {
  const googleProvider = createGoogleProvider(Boolean(options?.includeWorkspaceScopes));
  const onCanonicalHost =
    typeof window !== 'undefined' && CANONICAL_HOSTNAMES.has(window.location.hostname.toLowerCase());

  const runOAuthViaHandlerAndSignInPrimary = async () => {
    const fallbackAuth = getOAuthFallbackAuth();
    const popupResult = await signInWithPopup(fallbackAuth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(popupResult);
    const accessToken = credential?.accessToken || '';
    if (!credential?.idToken && !accessToken) {
      throw new Error('Google OAuth did not return a valid identity token. Please try again.');
    }
    const primaryCredential = GoogleAuthProvider.credential(
      credential?.idToken || null,
      accessToken || null
    );
    const primaryResult = await signInWithCredential(auth, primaryCredential);
    // Clean up temporary secondary auth session so only primary auth retains session state
    signOut(fallbackAuth).catch(() => {});
    return { user: primaryResult.user, accessToken };
  };

  try {
    isSigningIn = true;
    let signedInUser: FirebaseUser;
    let accessToken = '';

    if (onCanonicalHost) {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        signedInUser = result.user;
        accessToken = credential?.accessToken || '';
      } catch (primaryErr: any) {
        if (POPUP_FALLBACK_ERROR_CODES.has(primaryErr?.code || '')) {
          const bridged = await runOAuthViaHandlerAndSignInPrimary();
          signedInUser = bridged.user;
          accessToken = bridged.accessToken;
        } else {
          throw primaryErr;
        }
      }
    } else {
      // On preview hosts (*.run.app, localhost), authenticate via Firebase's default auth handler
      // and bridge the verified Google ID/access credential onto primary auth.
      const bridged = await runOAuthViaHandlerAndSignInPrimary();
      signedInUser = bridged.user;
      accessToken = bridged.accessToken;
    }

    if (accessToken) {
      cachedAccessToken = accessToken;
    }
    const profile = await syncFirebaseUserProfile(signedInUser, metadata);
    return { user: signedInUser, accessToken, profile };
  } catch (error: any) {
    console.error('Google sign-in error:', error);
    throw new Error(mapFirebaseAuthError(error));
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setAccessTokenManually = (token: string | null) => {
  cachedAccessToken = token;
};

export const firebaseLogout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export function sanitizeRoleForView(role: UserRole): 'customer' | 'operator' | 'manager' | 'partner' | 'admin' | 'business' {
  if (role === 'super_admin') return 'admin';
  return role;
}
