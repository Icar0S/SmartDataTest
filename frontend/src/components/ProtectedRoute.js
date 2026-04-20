import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

function LoadingScreen() {
  const { language } = useLanguage();
  const label = language === 'pt-BR' ? 'Carregando...' : 'Loading...';
  return (
    <div
      data-testid="loading-screen"
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#1a1a2e]"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-300 text-sm">{label}</p>
      </div>
    </div>
  );
}

/**
 * ProtectedRoute — wraps routes that require authentication + profile.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, hasProfile, isLoading } = useAuthContext();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!hasProfile) {
    return <Navigate to="/login" state={{ step: 'profile' }} replace />;
  }

  return <>{children}</>;
}
