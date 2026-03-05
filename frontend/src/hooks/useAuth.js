import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { REGISTERED_USERS } from '../data/users';
import { useAuthContext } from '../context/AuthContext';

/**
 * useAuth hook — handles login, logout, and profile saving.
 *
 * ⚠️ MIGRATION: replace REGISTERED_USERS lookup with:
 *   fetch(getApiUrl('/api/auth/validate'), { method:'POST', body: JSON.stringify({email, password}) })
 */
export default function useAuth() {
  const { login, logout, saveUserProfile } = useAuthContext();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (email, password, rememberMe = false) => {
    setIsLoading(true);
    setError(null);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const user = REGISTERED_USERS.find((u) => u.email === email);
    if (!user) {
      setError({
        'pt-BR': 'Usuário não encontrado. Verifique o e-mail informado.',
        'en-US': 'User not found. Please check the email address.',
      });
      setIsLoading(false);
      return false;
    }

    if (user.password !== password) {
      setError({
        'pt-BR': 'Senha incorreta. Tente novamente.',
        'en-US': 'Wrong password. Please try again.',
      });
      setIsLoading(false);
      return false;
    }

    login(user, rememberMe);
    setIsLoading(false);
    return true;
  };

  const clearError = () => setError(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSaveProfile = (data) => {
    saveUserProfile(data);
    navigate('/');
  };

  return {
    handleLogin,
    handleLogout,
    handleSaveProfile,
    clearError,
    error,
    isLoading,
  };
}
