import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../types';
import {
  auth,
  db,
  googleSignIn,
  firebaseLogout,
  firebaseEmailSignIn,
  firebaseEmailSignUp,
  firebaseResetPassword,
  syncFirebaseUserProfile,
  SyncedUserProfile,
  ProfileSyncMetadata,
} from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import {
  DEFAULT_ROLE_PERMISSIONS,
  getPermissionsForRole,
  normalizeRole,
  PermissionCode,
  RolePermissionMap,
} from '../lib/rbac';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  permissions: PermissionCode[];
  isAuthenticated: boolean;
  authLoading: boolean;
  can: (permission: PermissionCode) => boolean;
  login: (email: string, pass: string) => Promise<User>;
  loginWithGoogle: (metadata?: ProfileSyncMetadata) => Promise<User | null>;
  register: (
    name: string,
    email: string,
    mobile: string,
    pass: string,
    accountType?: 'customer' | 'business' | 'operator' | 'partner',
    companyName?: string,
    referredByCode?: string
  ) => Promise<User>;
  resetPassword: (email: string) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

const SESSION_STORAGE_KEY = 'dip_auth_user_v2';

function loadRoleMatrix(): RolePermissionMap {
  try {
    const raw = localStorage.getItem('dip_role_permissions');
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return DEFAULT_ROLE_PERMISSIONS;
}

function mapProfileToUser(fbUid: string, photoURL: string | null, profile: SyncedUserProfile): User {
  const normalizedRole = normalizeRole(profile.role);
  const perms = getPermissionsForRole(normalizedRole, loadRoleMatrix());
  return {
    id: fbUid,
    name: profile.displayName || profile.email.split('@')[0] || 'User',
    email: profile.email,
    mobile: profile.mobile || '+91 77779 41227',
    role: normalizedRole,
    accountType: profile.accountType,
    permissions: perms,
    companyName: profile.companyName,
    businessId: profile.businessId,
    partnerId: profile.partnerId,
    referralCode: profile.referralCode,
    referredByCode: profile.referredByCode,
    kycStatus: profile.kycStatus,
    operatorEnrollmentId: profile.operatorEnrollmentId,
    managerScope: profile.managerScope,
    isActive: true,
    avatarUrl: photoURL || undefined,
    createdAt: profile.createdAt,
  };
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: 'customer',
  permissions: [],
  isAuthenticated: false,
  authLoading: true,
  can: () => false,
  login: async () => {
    throw new Error('AuthProvider not initialized');
  },
  loginWithGoogle: async () => null,
  register: async () => {
    throw new Error('AuthProvider not initialized');
  },
  resetPassword: async () => {},
  refreshUserProfile: async () => {},
  logout: async () => {},
  updateUser: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(SESSION_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [authLoading, setAuthLoading] = useState(true);
  const authActionInFlightRef = React.useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (authActionInFlightRef.current) {
        return;
      }
      if (fbUser && fbUser.email) {
        try {
          const profile = await syncFirebaseUserProfile(fbUser);
          const mappedUser = mapProfileToUser(fbUser.uid, fbUser.photoURL, profile);
          setUser(mappedUser);
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(mappedUser));
        } catch (err) {
          console.error('Error syncing authenticated user:', err);
        }
      } else {
        setUser(null);
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const refreshUserProfile = useCallback(async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) return;
    try {
      const snap = await getDoc(doc(db, 'users', fbUser.uid));
      if (snap.exists()) {
        const data = snap.data() as SyncedUserProfile;
        const mapped = mapProfileToUser(fbUser.uid, fbUser.photoURL, data);
        setUser(mapped);
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(mapped));
      }
    } catch (err) {
      console.warn('Could not refresh Firestore user profile:', err);
    }
  }, []);

  const role: UserRole = user ? normalizeRole(user.role) : 'customer';
  const permissions: PermissionCode[] = user
    ? getPermissionsForRole(role, loadRoleMatrix())
    : [];

  const can = useCallback(
    (perm: PermissionCode) => permissions.includes(perm),
    [permissions]
  );

  const login = async (email: string, pass: string): Promise<User> => {
    authActionInFlightRef.current = true;
    setAuthLoading(true);
    try {
      if (!email.trim() || !pass) {
        throw new Error('Please enter both your email address and password.');
      }
      const { user: fbUser, profile } = await firebaseEmailSignIn(email, pass);
      const mapped = mapProfileToUser(fbUser.uid, fbUser.photoURL, profile);
      setUser(mapped);
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(mapped));
      return mapped;
    } finally {
      authActionInFlightRef.current = false;
      setAuthLoading(false);
    }
  };

  const loginWithGoogle = async (metadata?: ProfileSyncMetadata): Promise<User | null> => {
    authActionInFlightRef.current = true;
    setAuthLoading(true);
    try {
      const res = await googleSignIn(metadata);
      if (!res?.user) return null;
      const mapped = mapProfileToUser(res.user.uid, res.user.photoURL, res.profile);
      setUser(mapped);
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(mapped));
      return mapped;
    } finally {
      authActionInFlightRef.current = false;
      setAuthLoading(false);
    }
  };

  const register = async (
    name: string,
    email: string,
    mobile: string,
    pass: string,
    accountType: 'customer' | 'business' | 'operator' | 'partner' = 'customer',
    companyName?: string,
    referredByCode?: string
  ): Promise<User> => {
    authActionInFlightRef.current = true;
    setAuthLoading(true);
    try {
      if (!name.trim()) {
        throw new Error('Please enter your full legal name.');
      }
      if (pass.length < 8) {
        throw new Error('Password must be at least 8 characters long.');
      }
      const cleanMobile = mobile.replace(/\D/g, '');
      if (cleanMobile.length < 10) {
        throw new Error('Please enter a valid 10-digit Indian mobile number.');
      }
      const formattedMobile = `+91 ${cleanMobile.slice(-10)}`;

      const { user: fbUser, profile } = await firebaseEmailSignUp(email, pass, {
        displayName: name.trim(),
        mobile: formattedMobile,
        accountType,
        companyName: companyName?.trim() || undefined,
        referredByCode: referredByCode?.trim() || undefined,
      });

      const mapped = mapProfileToUser(fbUser.uid, fbUser.photoURL, profile);
      setUser(mapped);
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(mapped));
      return mapped;
    } finally {
      authActionInFlightRef.current = false;
      setAuthLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    await firebaseResetPassword(email);
  };

  const logout = async () => {
    try {
      await firebaseLogout();
    } catch {
      // ignore if already logged out
    }
    setUser(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  };

  const updateUser = (data: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...data };
    setUser(updated);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        permissions,
        isAuthenticated: !!user,
        authLoading,
        can,
        login,
        loginWithGoogle,
        register,
        resetPassword,
        refreshUserProfile,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
