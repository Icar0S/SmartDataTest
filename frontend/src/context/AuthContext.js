import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, FORBIDDEN_EVENT, UNAUTHORIZED_EVENT } from '../config/api';
import { clearSession, getSession, getToken, toSession, updateSession } from '../utils/authStorage';
import { completeLogin, startLogin } from '../utils/sso';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(getSession);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  /**
   * Ask the backend who we are. The stored copy is what the interface starts
   * from; this is the truth. A network failure leaves things as they are: the
   * API enforces access by itself, and logging someone out because the server
   * restarted would help nobody.
   */
  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setSession(null);
      return;
    }
    try {
      const response = await apiFetch('/api/auth/me');
      if (!response.ok) return; // 401 is handled by the event below
      const fresh = toSession(await response.json(), token);
      updateSession(fresh);
      setSession(getSession());
    } catch {
      // Offline: keep the stored session.
    }
  }, []);

  useEffect(() => {
    setIsLoading(false);
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onUnauthorized = () => {
      clearSession();
      setSession(null);
      setSessionExpired(true);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    window.addEventListener(FORBIDDEN_EVENT, refresh);
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
      window.removeEventListener(FORBIDDEN_EVENT, refresh);
    };
  }, [refresh]);

  const signIn = useCallback((options) => {
    setSessionExpired(false);
    return startLogin(options);
  }, []);

  const finishSignIn = useCallback(async (code) => {
    const { session: fresh, returnTo } = await completeLogin(code);
    setSessionExpired(false);
    setSession(fresh);
    return returnTo;
  }, []);

  const logout = useCallback(() => {
    // Best effort: whatever the server answers, this browser forgets it now.
    if (getToken()) apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    clearSession();
    setSession(null);
    setSessionExpired(false);
  }, []);

  const saveUserProfile = useCallback((role) => {
    // Kept locally first. If the server never hears of it, the worst outcome
    // is being asked again next time.
    updateSession({ profile: role });
    setSession(getSession());
    apiFetch('/api/auth/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    }).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      user: session,
      isAuthenticated: session?.status === 'approved',
      isPending: session?.status === 'pending',
      hasProfile: Boolean(session?.profile),
      isLoading,
      sessionExpired,
      signIn,
      finishSignIn,
      logout,
      refresh,
      saveUserProfile,
    }),
    [session, isLoading, sessionExpired, signIn, finishSignIn, logout, refresh, saveUserProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return ctx;
}
