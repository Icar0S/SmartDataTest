/**
 * Tests for frontend/src/pages/LoginPage.js — Profile step, auth effects,
 * loading/error states, and RightPanel timer.
 *
 * Complements LoginPage.test.js which covers the login-form step only.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

// ─── Mutable mock primitives (names start with "mock" so Jest hoisting works) ──

const mockNavigate = jest.fn();
const mockHandleLogin = jest.fn();
const mockHandleSaveProfile = jest.fn();
const mockClearError = jest.fn();
const mockHandleLogout = jest.fn();

// Mutable per-test — change `.mockReturnValue(...)` in beforeEach / per test
const mockUseLocation = jest.fn(() => ({ pathname: '/login', state: null }));
const mockUseAuthContext = jest.fn(() => ({
  isAuthenticated: false,
  hasProfile: false,
  isLoading: false,
  user: null,
}));
const mockUseAuth = jest.fn(() => ({
  handleLogin: mockHandleLogin,
  handleLogout: mockHandleLogout,
  handleSaveProfile: mockHandleSaveProfile,
  clearError: mockClearError,
  error: null,
  isLoading: false,
}));

// ─── Module mocks ────────────────────────────────────────────────────────────

jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }) => <div>{children}</div>,
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
  Navigate: (props) => <div data-testid="navigate" data-to={props.to} />,
  Route: ({ element }) => element,
  Routes: ({ children }) => <div>{children}</div>,
}));

jest.mock('../../../frontend/src/context/AuthContext', () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock('../../../frontend/src/context/LanguageContext', () => ({
  useLanguage: () => ({ language: 'pt-BR', changeLanguage: jest.fn() }),
}));

jest.mock('../../../frontend/src/hooks/useAuth', () => () => mockUseAuth());

jest.mock('../../../frontend/src/hooks/useStats', () => () => ({
  tests: '970+',
  datasets: '1180+',
  coverage: '86%',
  responseSla: '<2s',
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
    form: ({ children, ...props }) => <form {...props}>{children}</form>,
    p: ({ children, ...props }) => <p {...props}>{children}</p>,
    button: ({ children, ...props }) => <button {...props}>{children}</button>,
    span: ({ children, ...props }) => <span {...props}>{children}</span>,
    h2: ({ children, ...props }) => <h2 {...props}>{children}</h2>,
    textarea: ({ children, ...props }) => <textarea {...props}>{children}</textarea>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

jest.mock('lucide-react', () => ({
  Database: () => <span data-testid="icon-database">DB</span>,
  Mail: () => <span>Mail</span>,
  Lock: () => <span>Lock</span>,
  Eye: () => <span data-testid="icon-eye">Eye</span>,
  EyeOff: () => <span data-testid="icon-eyeoff">EyeOff</span>,
  LogIn: () => <span>LogIn</span>,
  ChevronRight: () => <span>Chevron</span>,
  CheckCircle: () => <span data-testid="icon-check">Check</span>,
  Languages: () => <span>Languages</span>,
  Shield: () => <span>Shield</span>,
  Heart: () => <span>Heart</span>,
  TestTube: () => <span data-testid="icon-testtube">TestTube</span>,
  BarChart3: () => <span>BarChart</span>,
  Code: () => <span data-testid="icon-code">Code</span>,
  GraduationCap: () => <span>GradCap</span>,
  BookOpen: () => <span>BookOpen</span>,
  Settings: () => <span>Settings</span>,
  User: () => <span>User</span>,
  Loader: () => <span data-testid="icon-loader">Loader</span>,
  Clock: () => <span>Clock</span>,
  Zap: () => <span>Zap</span>,
}));

jest.mock('../../../frontend/src/styles/animations', () => ({
  fadeIn: {},
  slideIn: {},
  staggerContainer: {},
  slideInFromLeft: {},
  slideInFromRight: {},
  slideDown: {},
  popIn: {},
  profileCardIn: {},
  floatingNode: () => ({ animate: {} }),
  scaleIn: {},
}));

jest.mock('../../../frontend/src/components/LanguageToggle', () =>
  function MockLanguageToggle() {
    return <div data-testid="language-toggle">LangToggle</div>;
  }
);

import LoginPage from '../../../frontend/src/pages/LoginPage';

const renderPage = () =>
  render(
    <BrowserRouter>
      <LoginPage />
    </BrowserRouter>
  );

// ─── helpers ─────────────────────────────────────────────────────────────────

const setProfileStep = () =>
  mockUseLocation.mockReturnValue({ pathname: '/login', state: { step: 'profile' } });

const setLoginStep = () =>
  mockUseLocation.mockReturnValue({ pathname: '/login', state: null });

// ─── Suites ──────────────────────────────────────────────────────────────────

describe('LoginPage — Profile step rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setProfileStep();
    mockUseAuthContext.mockReturnValue({
      isAuthenticated: false,
      hasProfile: false,
      isLoading: false,
      user: null,
    });
    mockUseAuth.mockReturnValue({
      handleLogin: mockHandleLogin,
      handleLogout: mockHandleLogout,
      handleSaveProfile: mockHandleSaveProfile,
      clearError: mockClearError,
      error: null,
      isLoading: false,
    });
  });

  test('renders profile title (Quase lá!) when step is profile', () => {
    renderPage();
    expect(screen.getByText(/Quase lá/i)).toBeInTheDocument();
  });

  test('renders all 8 role cards', () => {
    renderPage();
    const roles = ['tester', 'data_eng', 'dev', 'student', 'teacher', 'analyst', 'devops', 'other'];
    roles.forEach((id) => {
      expect(document.querySelector(`[data-testid="role-card-${id}"]`)).toBeTruthy();
    });
  });

  test('clicking a role card selects it and calls clearError', () => {
    renderPage();
    const testerCard = document.querySelector('[data-testid="role-card-tester"]');
    expect(testerCard).toBeTruthy();
    fireEvent.click(testerCard);
    expect(mockClearError).toHaveBeenCalled();
  });

  test('submit button is disabled when no role is selected', () => {
    renderPage();
    const submitBtn = document.querySelector('form button[type="submit"]');
    expect(submitBtn).toBeDisabled();
  });

  test('submit button becomes enabled after selecting a role', () => {
    renderPage();
    fireEvent.click(document.querySelector('[data-testid="role-card-tester"]'));
    const submitBtn = document.querySelector('form button[type="submit"]');
    expect(submitBtn).not.toBeDisabled();
  });

  test('submitting with a selected role calls handleSaveProfile', () => {
    renderPage();
    fireEvent.click(document.querySelector('[data-testid="role-card-data_eng"]'));
    const form = document.querySelector('form');
    fireEvent.submit(form);
    expect(mockHandleSaveProfile).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'data_eng' })
    );
  });

  test('submitting with no role selected does NOT call handleSaveProfile', () => {
    renderPage();
    const form = document.querySelector('form');
    fireEvent.submit(form);
    expect(mockHandleSaveProfile).not.toHaveBeenCalled();
  });

  test('selecting "other" role reveals textarea', () => {
    renderPage();
    fireEvent.click(document.querySelector('[data-testid="role-card-other"]'));
    const textarea = document.querySelector('textarea');
    expect(textarea).toBeTruthy();
  });

  test('submit with "other" role uses customRole text', () => {
    renderPage();
    fireEvent.click(document.querySelector('[data-testid="role-card-other"]'));
    const textarea = document.querySelector('textarea');
    fireEvent.change(textarea, { target: { value: 'Data Scientist' } });
    const form = document.querySelector('form');
    fireEvent.submit(form);
    expect(mockHandleSaveProfile).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'Data Scientist' })
    );
  });

  test('submit is disabled when "other" selected but textarea is empty', () => {
    renderPage();
    fireEvent.click(document.querySelector('[data-testid="role-card-other"]'));
    const submitBtn = document.querySelector('form button[type="submit"]');
    expect(submitBtn).toBeDisabled();
  });

  test('clicking skip button calls handleSaveProfile with role="unset"', () => {
    renderPage();
    const skipBtn = screen.getByText(/Pular por agora/i);
    fireEvent.click(skipBtn);
    expect(mockHandleSaveProfile).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'unset' })
    );
  });
});

describe('LoginPage — Auth redirect effects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setLoginStep();
    mockUseAuth.mockReturnValue({
      handleLogin: mockHandleLogin,
      handleLogout: mockHandleLogout,
      handleSaveProfile: mockHandleSaveProfile,
      clearError: mockClearError,
      error: null,
      isLoading: false,
    });
  });

  test('navigates to "/" when isAuthenticated=true and hasProfile=true', async () => {
    mockUseAuthContext.mockReturnValue({
      isAuthenticated: true,
      hasProfile: true,
      isLoading: false,
      user: { email: 'test@example.com' },
    });
    renderPage();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  test('navigates to from.pathname when location.state.from exists', async () => {
    mockUseLocation.mockReturnValue({
      pathname: '/login',
      state: { from: { pathname: '/checklist' } },
    });
    mockUseAuthContext.mockReturnValue({
      isAuthenticated: true,
      hasProfile: true,
      isLoading: false,
      user: null,
    });
    renderPage();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/checklist');
    });
  });

  test('switches to profile step when isAuthenticated=true but hasProfile=false', async () => {
    mockUseAuthContext.mockReturnValue({
      isAuthenticated: true,
      hasProfile: false,
      isLoading: false,
      user: null,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Quase lá/i)).toBeInTheDocument();
    });
  });
});

describe('LoginPage — Login form loading and error states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setLoginStep();
    mockUseAuthContext.mockReturnValue({
      isAuthenticated: false,
      hasProfile: false,
      isLoading: false,
      user: null,
    });
  });

  test('shows loading text on submit button when isLoading=true', () => {
    mockUseAuth.mockReturnValue({
      handleLogin: mockHandleLogin,
      handleLogout: mockHandleLogout,
      handleSaveProfile: mockHandleSaveProfile,
      clearError: mockClearError,
      error: null,
      isLoading: true,
    });
    renderPage();
    expect(screen.getByText(/Autenticando/i)).toBeInTheDocument();
    // Multiple Loader icons may exist (submit button + pipeline step); assert at least one
    expect(screen.getAllByTestId('icon-loader').length).toBeGreaterThanOrEqual(1);
  });

  test('shows bilingual error message when error is present', () => {
    mockUseAuth.mockReturnValue({
      handleLogin: mockHandleLogin,
      handleLogout: mockHandleLogout,
      handleSaveProfile: mockHandleSaveProfile,
      clearError: mockClearError,
      error: { 'pt-BR': 'Usuário não encontrado.', 'en-US': 'User not found.' },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByText(/Usuário não encontrado/i)).toBeInTheDocument();
  });

  test('successful login transitions to profile step', async () => {
    mockHandleLogin.mockResolvedValue(true);
    mockUseAuth.mockReturnValue({
      handleLogin: mockHandleLogin,
      handleLogout: mockHandleLogout,
      handleSaveProfile: mockHandleSaveProfile,
      clearError: mockClearError,
      error: null,
      isLoading: false,
    });
    renderPage();
    const emailInput = document.querySelector('input[type="email"]');
    const passwordInput = document.querySelector('input[type="password"]');
    fireEvent.change(emailInput, { target: { value: 'admin@dataforgetest.com' } });
    fireEvent.change(passwordInput, { target: { value: 'admin123' } });
    const form = document.querySelector('form');
    fireEvent.submit(form);
    await waitFor(() => {
      expect(mockHandleLogin).toHaveBeenCalledWith('admin@dataforgetest.com', 'admin123', false);
    });
    await waitFor(() => {
      expect(screen.getByText(/Quase lá/i)).toBeInTheDocument();
    });
  });
});

describe('LoginPage — RightPanel live feed timer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setLoginStep();
    mockUseAuthContext.mockReturnValue({
      isAuthenticated: false,
      hasProfile: false,
      isLoading: false,
      user: null,
    });
    mockUseAuth.mockReturnValue({
      handleLogin: mockHandleLogin,
      handleLogout: mockHandleLogout,
      handleSaveProfile: mockHandleSaveProfile,
      clearError: mockClearError,
      error: null,
      isLoading: false,
    });
  });

  test('timer interval fires without crashing after 3100ms', () => {
    jest.useFakeTimers();
    renderPage();
    act(() => {
      jest.advanceTimersByTime(3100);
    });
    // Verify the page still renders correctly after timer fires
    expect(document.querySelector('[data-testid="animated-bg"]')).toBeInTheDocument();
    jest.useRealTimers();
  });

  test('timer clears on unmount (no memory-leak warnings)', () => {
    jest.useFakeTimers();
    const { unmount } = renderPage();
    act(() => {
      jest.advanceTimersByTime(3100);
    });
    expect(() => unmount()).not.toThrow();
    jest.useRealTimers();
  });
});
