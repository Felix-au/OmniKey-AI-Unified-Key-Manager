import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from './firebase.js';
import { apiFetch } from './api.js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  localDbEnabled: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  localDbEnabled: true,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [localDbEnabled, setLocalDbEnabled] = useState(true);

  useEffect(() => {
    // 1. Detect dynamic database configuration mode from backend
    async function checkConfig() {
      try {
        const config = await apiFetch<{ localDbEnabled: boolean }>('/api/config');
        setLocalDbEnabled(config.localDbEnabled);
      } catch (e) {
        console.warn('Failed to load backend config, defaulting to local mode:', e);
        setLocalDbEnabled(true);
      }
    }
    checkConfig();

    // 2. Track Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, localDbEnabled, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
