/**
 * Tests for frontend/src/pages/LoginPage.js — sign-in step, the way back from
 * Google, and the waiting-for-approval step.
 *
 * LoginPage.profile.test.js covers the profile step.
 */

import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockNavigate = jest.fn();
const mockLocation = jest.fn(() => ({ pathname: '/login', state: null, hash: '' }));
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation(),
}));

const mockAuth = {
  handleLogin: jest.fn(),
  handleLoginReturn: jest.fn(),
  handleLogout: jest.fn(),
  handleRefresh: jest.fn(),
  handleSaveProfile: jest.fn(),
  showError: jest.fn(),
  clearError: jest.fn(),
};
const mockUseAuth = jest.fn();
jest.mock('../../../frontend/src/hooks/useAuth', () => () => mockUseAuth());

jest.mock('../../../frontend/src/hooks/useStats', () => () => ({
  tests: '970+',
  datasets: '1180+',
  coverage: '86%',
  responseSla: '<2s',
}));

const mockLanguage = jest.fn(() => 'pt-BR');
jest.mock('../../../frontend/src/context/LanguageContext', () => ({
  useLanguage: () => ({ language: mockLanguage(), changeLanguage: jest.fn() }),
}));

const mockContext = jest.fn();
jest.mock('../../../frontend/src/context/AuthContext', () => ({
  useAuthContext: () => mockContext(),
}));

jest.mock('framer-motion', () => {
  const passthrough = (Tag) =>
    function Motion({ children, ...props }) {
      return <Tag {...props}>{children}</Tag>;
    };
  return {
    motion: new Proxy({}, { get: (_target, tag) => passthrough(tag) }),
    AnimatePresence: ({ children }) => <>{children}</>,
  };
});

jest.mock('lucide-react', () => new Proxy({}, { get: () => () => <span /> }));

// Mock LanguageToggle
jest.mock('../../../frontend/src/components/LanguageToggle', () =>
  function MockLanguageToggle() {
    return (
      <div data-testid="language-toggle">
        <button data-testid="btn-pt">PT-BR</button>
        <button data-testid="btn-en">EN-US</button>
      </div>
    );
  }
);

import LoginPage from '../../../frontend/src/pages/LoginPage';

const anonymous = {
  user: null,
  isAuthenticated: false,
  isPending: false,
  hasProfile: false,
  sessionExpired: false,
};

const setup = ({ context = {}, auth = {}, location = {} } = {}) => {
  mockContext.mockReturnValue({ ...anonymous, ...context });
  mockUseAuth.mockReturnValue({ ...mockAuth, error: null, isLoading: false, ...auth });
  mockLocation.mockReturnValue({ pathname: '/login', state: null, hash: '', ...location });
  return render(<LoginPage />);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage.mockReturnValue('pt-BR');
});

describe('sign-in step', () => {
  test('offers Google and nothing that asks for a password', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Entrar com Google' })).toBeEnabled();
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(document.querySelector('input[type="email"]')).toBeNull();
  });

  test('no longer prints demo credentials', () => {
    const { container } = setup();
    expect(container.textContent).not.toMatch(/admin123|engineer123|qa123456|@smartdatatest\.com/);
    expect(document.querySelector('details')).toBeNull();
  });

  test('says that access is granted by the administrator', () => {
    setup();
    expect(screen.getByText(/liberado pelo administrador/i)).toBeInTheDocument();
  });

  test('clicking starts the login', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar com Google' }));
    expect(mockAuth.handleLogin).toHaveBeenCalledWith(false, '/');
  });

  test('"remember me" and the page that was asked for go along', () => {
    setup({ location: { state: { from: { pathname: '/qa-checklist' } } } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Entrar com Google' }));
    expect(mockAuth.handleLogin).toHaveBeenCalledWith(true, '/qa-checklist');
  });

  test('is busy while it happens', () => {
    setup({ auth: { isLoading: true } });
    expect(screen.getByRole('button', { name: /Autenticando/ })).toBeDisabled();
  });

  test('shows the error in the current language', () => {
    const error = { 'pt-BR': 'Deu errado.', 'en-US': 'It went wrong.' };
    setup({ auth: { error } });
    expect(screen.getByRole('alert')).toHaveTextContent('Deu errado.');
  });

  test('speaks English too', () => {
    mockLanguage.mockReturnValue('en-US');
    setup();
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument();
  });

  test('says why when the session ended by itself', () => {
    setup({ context: { sessionExpired: true } });
    expect(mockAuth.showError).toHaveBeenCalledWith('session_expired');
  });

  test('renders background, footer and version', () => {
    setup();
    expect(screen.getByTestId('animated-bg')).toBeInTheDocument();
    expect(screen.getByText(/dev · 2026/)).toBeInTheDocument();
  });
});

describe('back from Google', () => {
  test('trades the code, and takes it out of the address bar first', () => {
    setup({ location: { hash: '#code=abc' } });
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    expect(mockAuth.handleLoginReturn).toHaveBeenCalledWith('abc', expect.any(Function));
    expect(mockNavigate.mock.invocationCallOrder[0]).toBeLessThan(
      mockAuth.handleLoginReturn.mock.invocationCallOrder[0]
    );
  });

  test('a code is used once, even where effects run twice', () => {
    mockContext.mockReturnValue(anonymous);
    mockUseAuth.mockReturnValue({ ...mockAuth, error: null, isLoading: false });
    mockLocation.mockReturnValue({ pathname: '/login', state: null, hash: '#code=abc' });
    render(
      <React.StrictMode>
        <LoginPage />
      </React.StrictMode>
    );
    expect(mockAuth.handleLoginReturn).toHaveBeenCalledTimes(1);
  });

  test('shows the reason when there is no code, and forgets the attempt', () => {
    sessionStorage.setItem('smartdatatest_login', '{"verifier":"x"}');
    setup({ location: { hash: '#error=cancelled' } });
    expect(sessionStorage.getItem('smartdatatest_login')).toBeNull();
    expect(mockAuth.showError).toHaveBeenCalledWith('cancelled');
    expect(mockAuth.handleLoginReturn).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  test('then goes to the page that was asked for', () => {
    const view = setup({ location: { hash: '#code=abc' } });
    const [, onReturnTo] = mockAuth.handleLoginReturn.mock.calls[0];
    onReturnTo('/data-accuracy');
    mockContext.mockReturnValue({ ...anonymous, isAuthenticated: true, hasProfile: true });
    mockLocation.mockReturnValue({ pathname: '/login', state: null, hash: '' });
    view.rerender(<LoginPage />);
    expect(mockNavigate).toHaveBeenLastCalledWith('/data-accuracy', { replace: true });
  });

  test('does not move on while the exchange is still running', () => {
    setup({
      context: { isAuthenticated: true, hasProfile: true },
      auth: { isLoading: true },
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('waiting for approval', () => {
  const pending = {
    isPending: true,
    user: { name: 'Fulano', email: 'fulano@gmail.com', contact: '' },
  };

  test('says which account is waiting, and offers no way around', () => {
    setup({ context: pending });
    expect(screen.getByText('Aguardando liberação')).toBeInTheDocument();
    expect(screen.getByText('fulano@gmail.com')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Entrar com Google' })).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('shows the operator contact when there is one', () => {
    setup({ context: { ...pending, user: { ...pending.user, contact: 'ramal 123' } } });
    expect(screen.getByText('ramal 123')).toBeInTheDocument();
  });

  test('hides the contact line when there is none', () => {
    setup({ context: pending });
    expect(screen.queryByText(/Contato/)).toBeNull();
  });

  test('checks again on request and by itself', () => {
    jest.useFakeTimers();
    setup({ context: pending });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar agora' }));
    expect(mockAuth.handleRefresh).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(20000));
    expect(mockAuth.handleRefresh).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  test('stops checking when the page goes away', () => {
    jest.useFakeTimers();
    const { unmount } = setup({ context: pending });
    unmount();
    act(() => jest.advanceTimersByTime(60000));
    expect(mockAuth.handleRefresh).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('another account can be used', () => {
    setup({ context: pending });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar com outra conta' }));
    expect(mockAuth.handleLogout).toHaveBeenCalled();
  });
});

describe('right panel', () => {
  test('does not contain the removed live detection feed', () => {
    setup();
    expect(screen.queryByText(/Detecções/i)).not.toBeInTheDocument();
  });

describe('beside the card', () => {
  test('shows the platform numbers and the pipeline', () => {
    setup();
    expect(screen.getByText('1.180+')).toBeInTheDocument();
    expect(screen.getByText('86%')).toBeInTheDocument();
    expect(screen.getByText('Pipeline de Qualidade')).toBeInTheDocument();
    expect(screen.getByText('Validação de schema')).toBeInTheDocument();
  });

  test('says how sign-in is protected', () => {
    setup();
    expect(screen.getByText('Google + PKCE')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma senha armazenada')).toBeInTheDocument();
  });

  test('in English too', () => {
    mockLanguage.mockReturnValue('en-US');
    setup();
    expect(screen.getByText('Quality Pipeline')).toBeInTheDocument();
    expect(screen.getByText('1,180+')).toBeInTheDocument();
    expect(screen.getByText('No passwords stored')).toBeInTheDocument();
  });

  test('falls back to Portuguese for an unknown language', () => {
    mockLanguage.mockReturnValue('fr-FR');
    setup();
    expect(screen.getByRole('button', { name: 'Entrar com Google' })).toBeInTheDocument();
  });

  test('the page title is the sign-in heading', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: 'Bem-vindo de volta' })).toBeInTheDocument();
  });

  test('ticks "remember me" visibly', () => {
    setup();
    const checkbox = screen.getByRole('checkbox', { name: 'Lembrar-me por 7 dias' });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });
});
});
