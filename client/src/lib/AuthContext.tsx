import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from './firebase.js';
import { apiFetch } from './api.js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  localDbEnabled: boolean;
  cloudDbAvailable: boolean;
  logout: () => Promise<void>;
  setDatabaseMode: (mode: 'local' | 'cloud', rememberChoice?: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  localDbEnabled: false,
  cloudDbAvailable: false,
  logout: async () => {},
  setDatabaseMode: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [cloudDbAvailable, setCloudDbAvailable] = useState(false);

  // Initialize localDbEnabled from localStorage selection, default to false (cloud MongoDB)
  const [localDbEnabled, setLocalDbEnabled] = useState(() => {
    const saved = localStorage.getItem('omnikey_db_mode');
    if (saved === 'local') return true;
    if (saved === 'cloud') return false;
    return false; // Default to cloud mode as primary greeting page
  });

  const setDatabaseMode = (mode: 'local' | 'cloud', rememberChoice = true) => {
    if (rememberChoice) {
      localStorage.setItem('omnikey_db_mode', mode);
    } else {
      localStorage.removeItem('omnikey_db_mode');
    }
    setLocalDbEnabled(mode === 'local');
    // Refresh page to purge React Query caches and reset application context state
    window.location.reload();
  };

  useEffect(() => {
    let isMounted = true;
    let hasAuthResolved = false;
    let configLoaded = false;

    // 1. Subscribe to Firebase Auth state immediately in parallel
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!isMounted) return;
      setUser(currentUser);
      hasAuthResolved = true;
      
      // If we are currently evaluating cloud mode, resolve loading once auth is ready
      if (configLoaded && !localDbEnabled) {
        setLoading(false);
      }
    });

    // 2. Set up defensive 3-second timeout for Firebase auth check (prevents hang if blocked)
    const timeoutId = setTimeout(() => {
      if (isMounted && !hasAuthResolved && configLoaded && !localDbEnabled) {
        console.warn('Firebase Auth SDK initial state check timed out (3s). Proceeding.');
        setLoading(false);
      }
    }, 3000);

    // 3. Query backend capabilities to see if a cloud database is even configured on Render
    async function initAuth() {
      try {
        const config = await apiFetch<{ cloudDbAvailable: boolean }>('/api/config');
        if (!isMounted) return;
        
        configLoaded = true;
        setCloudDbAvailable(config.cloudDbAvailable);
        
        // If MongoDB is NOT configured on the backend, force SQLite local mode
        if (!config.cloudDbAvailable) {
          setLocalDbEnabled(true);
          setLoading(false);
        } else {
          // If cloud is available, follow the client-side database selection
          if (localDbEnabled) {
            setLoading(false);
          } else {
            if (hasAuthResolved) {
              setLoading(false);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load backend config, defaulting to offline local mode:', e);
        if (!isMounted) return;
        setCloudDbAvailable(false);
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
  }, [localDbEnabled]);

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, localDbEnabled, cloudDbAvailable, logout, setDatabaseMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
