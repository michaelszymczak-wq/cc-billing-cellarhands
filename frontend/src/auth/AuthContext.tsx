import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase';

export type UserRole = 'admin' | 'team_member' | 'cellar';

interface AuthState {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  const fetchRole = useCallback(async (currentUser: User) => {
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRole(data.role);
        setError(null);
      } else {
        setRole(null);
        setError('Account not authorized');
      }
    } catch {
      setRole(null);
      setError('Failed to verify account');
    }
  }, []);

  useEffect(() => {
    // Skip Firebase auth in local development
    if (isDev) {
      setRole('admin');
      setUser({ email: 'dev@localhost' } as User);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchRole(firebaseUser);
      } else {
        setRole(null);
        setError(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [fetchRole, isDev]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      const code = err.code;
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Invalid email or password');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError('Login failed. Please try again.');
      }
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    if (!isDev) await signOut(auth);
    setRole(null);
  }, [isDev]);

  const getToken = useCallback(async (): Promise<string | null> => {
    if (isDev) return null;
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  }, [isDev]);

  return (
    <AuthContext.Provider value={{ user, role, loading, error, login, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
