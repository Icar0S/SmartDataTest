/**
 * Tests for frontend/src/context/AuthContext.js
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SESSION_KEY } from '../../../frontend/src/utils/authStorage';
import { AuthProvider, useAuthContext } from '../../../frontend/src/context/AuthContext';

// Use real authStorage with jsdom localStorage

const mockUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'tester',
  avatar: null,
};

beforeEach(() => {
  localStorage.clear();
});

// Helper consumer that exposes context values
const ContextConsumer = ({ onMount } = {}) => {
  const ctx = useAuthContext();
  React.useEffect(() => {
    if (onMount) onMount(ctx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div>
      <span data-testid="user">{ctx.user ? ctx.user.email : 'null'}</span>
      <span data-testid="is-loading">{String(ctx.isLoading)}</span>
      <span data-testid="is-auth">{String(ctx.isAuthenticated)}</span>
      <span data-testid="has-profile">{String(ctx.hasProfile)}</span>
      <button data-testid="btn-login" onClick={() => ctx.login(mockUser, false)}>Login</button>
      <button data-testid="btn-logout" onClick={() => ctx.logout()}>Logout</button>
      <button
        data-testid="btn-save-profile"
        onClick={() => ctx.saveUserProfile({ role: 'tester', setAt: '2026-01-01' })}
      >
        Save Profile
      </button>
    </div>
  );
};

const renderWithProvider = (ui = <ContextConsumer />) =>
  render(<AuthProvider>{ui}</AuthProvider>);

describe('AuthContext — AuthProvider', () => {
  test('renders children without crashing', () => {
    renderWithProvider(<div data-testid="child">hello</div>);
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  test('isLoading becomes false after mount', async () => {
    renderWithProvider();
    await waitFor(() => {
      expect(screen.getByTestId('is-loading').textContent).toBe('false');
    });
  });

  test('user is null on mount when no session in localStorage', async () => {
    renderWithProvider();
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('null');
    });
  });

  test('restores user from localStorage session on mount', async () => {
    // Pre-seed a valid session
    const session = {
      userId: 'user-1',
      name: 'Test User',
      email: 'restored@example.com',
      role: 'tester',
      avatar: null,
      profile: null,
      loginAt: Date.now(),
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));

    renderWithProvider();
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('restored@example.com');
    });
  });

  test('login saves session and updates user', async () => {
    renderWithProvider();
    await waitFor(() => {
      expect(screen.getByTestId('is-loading').textContent).toBe('false');
    });

    act(() => {
      screen.getByTestId('btn-login').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('test@example.com');
    });
    expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();
  });

  test('logout clears session and sets user to null', async () => {
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('is-loading').textContent).toBe('false'));

    act(() => { screen.getByTestId('btn-login').click(); });
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('test@example.com'));

    act(() => { screen.getByTestId('btn-logout').click(); });
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('null');
    });
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  test('saveUserProfile updates profile in session', async () => {
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('is-loading').textContent).toBe('false'));

    act(() => { screen.getByTestId('btn-login').click(); });
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('test@example.com'));

    act(() => { screen.getByTestId('btn-save-profile').click(); });
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(SESSION_KEY));
      expect(stored.profile).not.toBeNull();
      expect(stored.profile.role).toBe('tester');
    });
  });

  test('isAuthenticated is false when no session', async () => {
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('is-loading').textContent).toBe('false'));
    expect(screen.getByTestId('is-auth').textContent).toBe('false');
  });

  test('isAuthenticated is true after login', async () => {
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('is-loading').textContent).toBe('false'));

    act(() => { screen.getByTestId('btn-login').click(); });
    await waitFor(() => {
      expect(screen.getByTestId('is-auth').textContent).toBe('true');
    });
  });

  test('hasProfile is false when profile is null', async () => {
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('is-loading').textContent).toBe('false'));
    act(() => { screen.getByTestId('btn-login').click(); });
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('test@example.com'));
    expect(screen.getByTestId('has-profile').textContent).toBe('false');
  });

  test('login with rememberMe=true is accepted', async () => {
    const Consumer = () => {
      const ctx = useAuthContext();
      React.useEffect(() => {}, []);
      return (
        <div>
          <span data-testid="user2">{ctx.user ? ctx.user.email : 'null'}</span>
          <button data-testid="btn-login-remember" onClick={() => ctx.login(mockUser, true)}>Login Remember</button>
        </div>
      );
    };
    render(<AuthProvider><Consumer /></AuthProvider>);
    act(() => { screen.getByTestId('btn-login-remember').click(); });
    await waitFor(() => {
      expect(screen.getByTestId('user2').textContent).toBe('test@example.com');
    });
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY));
    const expectedExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
    expect(stored.expiresAt).toBeGreaterThan(expectedExpiry - 10000);
  });
});

describe('useAuthContext outside AuthProvider', () => {
  test('throws when used outside AuthProvider', () => {
    const originalError = console.error;
    console.error = jest.fn();
    const BrokenComponent = () => {
      useAuthContext();
      return null;
    };
    expect(() => render(<BrokenComponent />)).toThrow(
      'useAuthContext must be used within an AuthProvider'
    );
    console.error = originalError;
  });
});
