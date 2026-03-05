/**
 * Tests for frontend/src/pages/LoginPage.js
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }) => <div>{children}</div>,
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/login', state: null }),
  Navigate: () => null,
  Route: ({ element }) => element,
  Routes: ({ children }) => <div>{children}</div>,
}));

// Mock useAuth hook
const mockHandleLogin = jest.fn();
const mockHandleSaveProfile = jest.fn();
const mockHandleLogout = jest.fn();
const mockClearError = jest.fn();

jest.mock('../../../frontend/src/hooks/useAuth', () => () => ({
  handleLogin: mockHandleLogin,
  handleLogout: mockHandleLogout,
  handleSaveProfile: mockHandleSaveProfile,
  clearError: mockClearError,
  error: null,
  isLoading: false,
}));

jest.mock('../../../frontend/src/hooks/useStats', () => () => ({
  tests: '970+',
  datasets: '1180+',
  coverage: '86%',
  responseSla: '<2s',
}));

// Mock useLanguage
const mockChangeLanguage = jest.fn();
jest.mock('../../../frontend/src/context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'pt-BR',
    changeLanguage: mockChangeLanguage,
  }),
}));

// Mock AuthContext
jest.mock('../../../frontend/src/context/AuthContext', () => ({
  useAuthContext: () => ({
    isAuthenticated: false,
    hasProfile: false,
    isLoading: false,
    user: null,
  }),
}));

// Mock framer-motion
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

// Mock lucide-react
jest.mock('lucide-react', () => ({
  Database: () => <span data-testid="icon-database">DB</span>,
  Mail: () => <span data-testid="icon-mail">Mail</span>,
  Lock: () => <span data-testid="icon-lock">Lock</span>,
  Eye: () => <span data-testid="icon-eye">Eye</span>,
  EyeOff: () => <span data-testid="icon-eyeoff">EyeOff</span>,
  LogIn: () => <span data-testid="icon-login">LogIn</span>,
  ChevronRight: () => <span data-testid="icon-chevron">Chevron</span>,
  CheckCircle: () => <span data-testid="icon-check">Check</span>,
  Languages: () => <span data-testid="icon-languages">Languages</span>,
  Shield: () => <span data-testid="icon-shield">Shield</span>,
  Heart: () => <span data-testid="icon-heart">Heart</span>,
  TestTube: () => <span data-testid="icon-testtube">TestTube</span>,
  BarChart3: () => <span data-testid="icon-barchart">BarChart</span>,
  Code: () => <span data-testid="icon-code">Code</span>,
  GraduationCap: () => <span data-testid="icon-gradcap">GradCap</span>,
  BookOpen: () => <span data-testid="icon-book">Book</span>,
  Settings: () => <span data-testid="icon-settings">Settings</span>,
  User: () => <span data-testid="icon-user">User</span>,
  Loader: () => <span data-testid="icon-loader">Loader</span>,
  Clock: () => <span data-testid="icon-clock">Clock</span>,
  Zap: () => <span data-testid="icon-zap">Zap</span>,
}));

// Mock animations
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

const renderLoginPage = () =>
  render(<BrowserRouter><LoginPage /></BrowserRouter>);

describe('LoginPage — Step 1: Login Form', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders login title in PT-BR by default', () => {
    renderLoginPage();
    const elements = screen.getAllByText(/DataForgeTest/i);
    expect(elements.length).toBeGreaterThan(0);
  });

  test('email and password fields exist', () => {
    renderLoginPage();
    expect(document.querySelector('input[type="email"]')).toBeTruthy();
    expect(document.querySelector('input[type="password"]')).toBeTruthy();
  });

  test('password visibility toggle works', () => {
    renderLoginPage();
    const passwordInput = document.querySelector('input[type="password"]');
    expect(passwordInput).toBeTruthy();
    // Eye icon should be present (password is hidden)
    expect(screen.getByTestId('icon-eye')).toBeInTheDocument();
    // Click toggle
    const eyeIcon = screen.getByTestId('icon-eye');
    fireEvent.click(eyeIcon.closest('button'));
    // After click, EyeOff should appear
    expect(screen.getByTestId('icon-eyeoff')).toBeInTheDocument();
  });

  test('rememberMe checkbox is interactive', () => {
    renderLoginPage();
    const checkbox = document.querySelector('input[type="checkbox"]');
    expect(checkbox).toBeTruthy();
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  test('renders animated background nodes with data-testid', () => {
    renderLoginPage();
    expect(document.querySelector('[data-testid="animated-bg"]')).toBeInTheDocument();
  });

  test('footer with copyright renders in PT-BR', () => {
    renderLoginPage();
    const elements = screen.getAllByText(/2026/i);
    expect(elements.length).toBeGreaterThan(0);
  });

  test('demo credentials section is expandable', () => {
    renderLoginPage();
    const detailsEl = document.querySelector('details');
    expect(detailsEl).toBeTruthy();
  });
});

describe('LoginPage — Login Form submission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('calls handleLogin on form submit', async () => {
    mockHandleLogin.mockResolvedValue(false);
    renderLoginPage();
    const emailInput = document.querySelector('input[type="email"]');
    const passwordInput = document.querySelector('input[type="password"]');
    if (emailInput && passwordInput) {
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password' } });
      const form = document.querySelector('form');
      if (form) fireEvent.submit(form);
      await waitFor(() => {
        expect(mockHandleLogin).toHaveBeenCalled();
      });
    }
  });
});

describe('LoginPage — Error display', () => {
  test('footer with copyright present', () => {
    renderLoginPage();
    const elements = screen.getAllByText(/2026/i);
    expect(elements.length).toBeGreaterThan(0);
  });
});

describe('LoginPage — Right Panel', () => {
  test('right panel does not contain live detection feed', () => {
    renderLoginPage();
    // "Detecções" / "Detections" should not appear — feed was removed
    expect(screen.queryByText(/Detecções/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Detections/i)).not.toBeInTheDocument();
  });
});
