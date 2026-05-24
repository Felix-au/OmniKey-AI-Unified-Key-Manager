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
    let unsubscribe: (() => void) | null = null;

    // 1. Detect dynamic database configuration mode from backend
    async function initAuth() {
      try {
        const config = await apiFetch<{ localDbEnabled: boolean }>('/api/config');
        setLocalDbEnabled(config.localDbEnabled);
        
        if (config.localDbEnabled) {
          // Local mode active: immediately complete loading with zero Firebase dependencies (offline-friendly)
          setLoading(false);
        } else {
          // Cloud mode active: subscribe to Firebase Auth events
          unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
          });
        }
      } catch (e) {
        console.warn('Failed to load backend config, defaulting to offline local mode:', e);
        setLocalDbEnabled(true);
        setLoading(false);
      }
    }
    
    initAuth();

    return () => {
      if (unsubscribe) unsubscribe();
    };
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
