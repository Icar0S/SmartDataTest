import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';

/** What each outcome of a login means for the person in front of it. */
export const LOGIN_ERRORS = {
  cancelled: {
    'pt-BR': 'Login cancelado. Quando quiser, é só tentar de novo.',
    'en-US': 'Sign-in cancelled. Try again whenever you like.',
  },
  failed: {
    'pt-BR': 'Não foi possível confirmar sua identidade com o Google. Tente de novo.',
    'en-US': 'We could not confirm your identity with Google. Please try again.',
  },
  email_unverified: {
    'pt-BR': 'Sua conta Google precisa ter o e-mail verificado.',
    'en-US': 'Your Google account needs a verified e-mail address.',
  },
  blocked: {
    'pt-BR': 'Este acesso está bloqueado. Fale com o administrador da plataforma.',
    'en-US': 'This account is blocked. Please contact the platform administrator.',
  },
  unavailable: {
    'pt-BR': 'O Google não respondeu agora. Tente de novo em instantes.',
    'en-US': 'Google did not answer. Please try again in a moment.',
  },
  offline: {
    'pt-BR':
      'Não conseguimos falar com o servidor da plataforma. Ele pode estar reiniciando: tente de novo em um minuto.',
    'en-US':
      'We could not reach the platform server. It may be restarting: please try again in a minute.',
  },
  not_configured: {
    'pt-BR':
      'O login com Google ainda não está ativo neste servidor. Fale com o administrador da plataforma.',
    'en-US':
      'Google sign-in is not active on this server yet. Please contact the platform administrator.',
  },
  rate_limited: {
    'pt-BR': 'Foram muitas tentativas seguidas. Aguarde um minuto e tente de novo.',
    'en-US': 'Too many attempts in a row. Wait a minute and try again.',
  },
  expired_login: {
    'pt-BR': 'Este login expirou ou começou em outra aba. Clique em entrar para recomeçar.',
    'en-US': 'This sign-in expired or started in another tab. Sign in to start over.',
  },
  session_expired: {
    'pt-BR': 'Sua sessão terminou. Entre de novo para continuar.',
    'en-US': 'Your session has ended. Sign in again to continue.',
  },
};

export const loginError = (code) => LOGIN_ERRORS[code] || LOGIN_ERRORS.failed;

/**
 * useAuth hook — sign-in, sign-out and profile, with the state a screen needs
 * to show while they happen.
 */
export default function useAuth() {
  const { signIn, finishSignIn, logout, refresh, saveUserProfile } = useAuthContext();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const showError = useCallback((code) => setError(loginError(code)), []);
  const clearError = useCallback(() => setError(null), []);

  /** Leaves for Google. Stays "loading" on success: the page is going away. */
  const handleLogin = useCallback(
    async (remember, returnTo) => {
      setIsLoading(true);
      setError(null);
      try {
        await signIn({ remember, returnTo });
      } catch (problem) {
        showError(problem.code);
        setIsLoading(false);
      }
    },
    [signIn, showError]
  );

  /**
   * Back from Google. *onReturnTo* receives the page the person was heading to
   * before isLoading goes false, so a screen that moves on at that point
   * already knows where.
   */
  const handleLoginReturn = useCallback(
    async (code, onReturnTo) => {
      setIsLoading(true);
      setError(null);
      try {
        onReturnTo(await finishSignIn(code));
      } catch (problem) {
        showError(problem.code);
      } finally {
        setIsLoading(false);
      }
    },
    [finishSignIn, showError]
  );

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  return {
    handleLogin,
    handleLoginReturn,
    handleLogout,
    handleRefresh: refresh,
    handleSaveProfile: saveUserProfile,
    showError,
    clearError,
    error,
    isLoading,
  };
}
