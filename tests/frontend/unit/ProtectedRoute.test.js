/**
 * Tests for frontend/src/components/ProtectedRoute.js
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

const mockUseAuthContext = jest.fn();
jest.mock('../../../frontend/src/context/AuthContext', () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

const mockUseLanguage = jest.fn(() => ({ language: 'pt-BR', changeLanguage: jest.fn() }));
jest.mock('../../../frontend/src/context/LanguageContext', () => ({
  useLanguage: () => mockUseLanguage(),
}));

// Mock Navigate to inspect redirect calls without actual navigation
const mockNavigateFn = jest.fn(() => null);
jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }) => <div>{children}</div>,
  Navigate: (props) => {
    mockNavigateFn(props);
    return <div data-testid="navigate" data-to={props.to} />;
  },
  useLocation: () => ({ pathname: '/dashboard', state: null }),
  useNavigate: () => jest.fn(),
  Route: ({ element }) => element,
  Routes: ({ children }) => <div>{children}</div>,
}));

import ProtectedRoute from '../../../frontend/src/components/ProtectedRoute';

const ChildComponent = () => <div data-testid="protected-content">Protected Content</div>;

const renderProtectedRoute = (authState) => {
  mockUseAuthContext.mockReturnValue(authState);
  return render(
    <BrowserRouter>
      <ProtectedRoute>
        <ChildComponent />
      </ProtectedRoute>
    </BrowserRouter>
  );
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLanguage.mockReturnValue({ language: 'pt-BR', changeLanguage: jest.fn() });
  });

  test('redirects to /login when not authenticated', () => {
    renderProtectedRoute({ isAuthenticated: false, hasProfile: false, isLoading: false });
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('navigate')).toBeInTheDocument();
    expect(screen.getByTestId('navigate').getAttribute('data-to')).toBe('/login');
  });

  test('renders children when authenticated with profile', () => {
    renderProtectedRoute({ isAuthenticated: true, hasProfile: true, isLoading: false });
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  test('redirects to /login when authenticated but without profile', () => {
    renderProtectedRoute({ isAuthenticated: true, hasProfile: false, isLoading: false });
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('navigate')).toBeInTheDocument();
    expect(screen.getByTestId('navigate').getAttribute('data-to')).toBe('/login');
  });

  test('shows LoadingScreen during isLoading=true', () => {
    renderProtectedRoute({ isAuthenticated: false, hasProfile: false, isLoading: true });
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
  });

  test('preserves original route in location.state.from when redirecting', () => {
    renderProtectedRoute({ isAuthenticated: false, hasProfile: false, isLoading: false });
    expect(mockNavigateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/login',
        state: expect.objectContaining({ from: expect.any(Object) }),
      })
    );
  });

  test('LoadingScreen shows "Loading..." label when language is en-US', () => {
    mockUseLanguage.mockReturnValue({ language: 'en-US', changeLanguage: jest.fn() });
    renderProtectedRoute({ isAuthenticated: false, hasProfile: false, isLoading: true });
    expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
