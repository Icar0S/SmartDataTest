import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  clearSession,
  getSession,
  isAuthenticated as checkAuth,
  hasProfile as checkProfile,
  saveProfile,
  saveSession,
} from '../utils/authStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const session = getSession();
    if (session) {
      setUser(session);
    }
    setIsLoading(false);
  }, []);

  const login = (userData, rememberMe = false) => {
    saveSession(userData, rememberMe);
    const session = getSession();
    setUser(session);
  };

  const logout = () => {
    clearSession();
    setUser(null);
  };

  const saveUserProfile = (profileData) => {
    saveProfile(profileData);
    const session = getSession();
    setUser(session);
  };

  const isAuthenticated = checkAuth();
  const hasProfile = checkProfile();

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        saveUserProfile,
        isAuthenticated,
        hasProfile,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return ctx;
}
