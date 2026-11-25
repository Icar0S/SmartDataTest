/**
 * Tests for frontend/src/pages/LoginPage.js — Profile step, auth effects and
 * RightPanel timer.
 *
 * Complements LoginPage.test.js, which covers sign-in and approval.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

// ─── Mutable mock primitives (names start with "mock" so Jest hoisting works) ──

const mockNavigate = jest.fn();
const mockHandleSaveProfile = jest.fn();
const mockClearError = jest.fn();

const signedOut = { isAuthenticated: false, isPending: false, hasProfile: false, user: null };
const withoutProfile = { ...signedOut, isAuthenticated: true, user: { email: 'test@example.com' } };
const auth = {
  handleLogin: jest.fn(),
  handleLoginReturn: jest.fn(),
  handleLogout: jest.fn(),
  handleRefresh: jest.fn(),
  handleSaveProfile: mockHandleSaveProfile,
  showError: jest.fn(),
  clearError: mockClearError,
  error: null,
  isLoading: false,
};

// Mutable per-test — change `.mockReturnValue(...)` in beforeEach / per test
const mockUseLocation = jest.fn(() => ({ pathname: '/login', state: null, hash: '' }));
const mockUseAuthContext = jest.fn();
const mockUseAuth = jest.fn();

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
  Lock: () => <span>Lock</span>,
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

// ─── Suites ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocation.mockReturnValue({ pathname: '/login', state: null, hash: '' });
  mockUseAuth.mockReturnValue(auth);
});

describe('LoginPage — Profile step rendering', () => {
  beforeEach(() => mockUseAuthContext.mockReturnValue(withoutProfile));

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
    expect(mockHandleSaveProfile).toHaveBeenCalledWith('data_eng');
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
    expect(mockHandleSaveProfile).toHaveBeenCalledWith('Data Scientist');
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
    expect(mockHandleSaveProfile).toHaveBeenCalledWith('unset');
  });
});

describe('LoginPage — Auth redirect effects', () => {
  const complete = { ...withoutProfile, hasProfile: true };

  test('goes to "/" when signed in with a profile', () => {
    mockUseAuthContext.mockReturnValue(complete);
    renderPage();
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  test('goes to the page that was asked for', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/login',
      state: { from: { pathname: '/checklist' } },
      hash: '',
    });
    mockUseAuthContext.mockReturnValue(complete);
    renderPage();
    expect(mockNavigate).toHaveBeenCalledWith('/checklist', { replace: true });
  });

  test('asks for the profile when there is none yet', () => {
    mockUseAuthContext.mockReturnValue(withoutProfile);
    renderPage();
    expect(screen.getByText(/Quase lá/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('moves on once the profile is saved', () => {
    mockUseAuthContext.mockReturnValue(withoutProfile);
    const { rerender } = renderPage();
    mockUseAuthContext.mockReturnValue(complete);
    rerender(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });
});

describe('LoginPage — RightPanel timer', () => {
  beforeEach(() => mockUseAuthContext.mockReturnValue(signedOut));

  test('timer interval fires without crashing after 3100ms', () => {
    jest.useFakeTimers();
    renderPage();
    act(() => {
      jest.advanceTimersByTime(3100);
    });
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
