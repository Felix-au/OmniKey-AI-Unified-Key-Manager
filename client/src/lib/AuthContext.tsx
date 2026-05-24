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
    let isMounted = true;
    let hasAuthResolved = false;
    let configLoaded = false;
    let isLocal = true;

    // 1. Subscribe to Firebase Auth state immediately in parallel
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!isMounted) return;
      setUser(currentUser);
      hasAuthResolved = true;
      
      // If backend config is already loaded and is cloud mode, resolve loading
      if (configLoaded && !isLocal) {
        setLoading(false);
      }
    });

    // 2. Set up a defensive 3-second timeout to prevent getting stuck if Firebase endpoints are slow/unreachable
    const timeoutId = setTimeout(() => {
      if (isMounted && !hasAuthResolved && configLoaded && !isLocal) {
        console.warn('Firebase Auth SDK initial state check timed out (3s). Proceeding to login interface.');
        setLoading(false);
      }
    }, 3000);

    // 3. Query dynamic config from backend
    async function initAuth() {
      try {
        const config = await apiFetch<{ localDbEnabled: boolean }>('/api/config');
        if (!isMounted) return;
        
        configLoaded = true;
        isLocal = config.localDbEnabled;
        setLocalDbEnabled(config.localDbEnabled);
        
        if (config.localDbEnabled) {
          // Local mode: immediately complete loading with zero external auth checks
          setLoading(false);
        } else {
          // Cloud mode: resolve loading immediately if auth has already resolved
          if (hasAuthResolved) {
            setLoading(false);
          }
        }
      } catch (e) {
        console.warn('Failed to load backend config, defaulting to offline local mode:', e);
        if (!isMounted) return;
        setLocalDbEnabled(true);
        setLoading(false);
      }
    }
    
    initAuth();

    return () => {
      isMounted = false;
      unsubscribe();
      clearTimeout(timeoutId);
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
