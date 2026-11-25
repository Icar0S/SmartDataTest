/**
 * Tests for frontend/src/context/AuthContext.js
 */

import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FORBIDDEN_EVENT, UNAUTHORIZED_EVENT } from '../../../frontend/src/config/api';
import { AuthProvider, useAuthContext } from '../../../frontend/src/context/AuthContext';
import { getSession, saveSession } from '../../../frontend/src/utils/authStorage';

const mockStartLogin = jest.fn();
const mockCompleteLogin = jest.fn();
jest.mock('../../../frontend/src/utils/sso', () => ({
  startLogin: (...args) => mockStartLogin(...args),
  completeLogin: (...args) => mockCompleteLogin(...args),
}));

const stored = (overrides = {}) => ({
  token: 'sdt_abc',
  expiresAt: Date.now() + 60_000,
  status: 'approved',
  contact: '',
  userId: 'usr_1',
  name: 'Fulano',
  email: 'fulano@gmail.com',
  avatar: 'FU',
  isAdmin: false,
  profile: 'tester',
  ...overrides,
});

const me = (overrides = {}, user = {}) => ({
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  status: 'approved',
  user: {
    id: 'usr_1',
    name: 'Fulano',
    email: 'fulano@gmail.com',
    avatar: 'FU',
    is_admin: false,
    profile: 'tester',
    ...user,
  },
  ...overrides,
});

const answer = (status, body = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

let ctx;
const Consumer = () => {
  ctx = useAuthContext();
  return (
    <div>
      <span data-testid="email">{ctx.user?.email ?? 'none'}</span>
      <span data-testid="flags">
        {`auth=${ctx.isAuthenticated} pending=${ctx.isPending} profile=${ctx.hasProfile} expired=${ctx.sessionExpired}`}
      </span>
    </div>
  );
};

const start = async () => {
  await act(async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
  });
};

const flags = () => screen.getByTestId('flags').textContent;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mockStartLogin.mockReset();
  mockCompleteLogin.mockReset();
  global.fetch = jest.fn().mockResolvedValue(answer(200, me()));
});

describe('starting up', () => {
  test('nobody is logged in, and nothing is asked', async () => {
    await start();
    expect(screen.getByTestId('email')).toHaveTextContent('none');
    expect(flags()).toBe('auth=false pending=false profile=false expired=false');
    expect(ctx.isLoading).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('a stored session is used at once and confirmed with the server', async () => {
    saveSession(stored());
    await start();
    expect(flags()).toBe('auth=true pending=false profile=true expired=false');
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('/api/auth/me');
    expect(options.headers.Authorization).toBe('Bearer sdt_abc');
  });

  test('what the server says wins over what was stored', async () => {
    saveSession(stored({ isAdmin: false, profile: null }));
    global.fetch = jest.fn().mockResolvedValue(answer(200, me({}, { is_admin: true })));
    await start();
    await waitFor(() => expect(ctx.user.isAdmin).toBe(true));
    expect(ctx.hasProfile).toBe(true);
    expect(getSession().isAdmin).toBe(true);
  });

  test('a suspended account stops being authenticated', async () => {
    saveSession(stored());
    global.fetch = jest.fn().mockResolvedValue(answer(200, me({ status: 'pending' })));
    await start();
    await waitFor(() => expect(flags()).toContain('auth=false pending=true'));
  });

  test('a session the server refuses is dropped, and the person is told', async () => {
    saveSession(stored());
    global.fetch = jest.fn().mockResolvedValue(answer(401));
    await start();
    await waitFor(() => expect(flags()).toContain('auth=false'));
    expect(flags()).toContain('expired=true');
    expect(getSession()).toBeNull();
  });

  test.each([
    ['is unreachable', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['answers with an error', () => Promise.resolve(answer(502))],
  ])('a server that %s does not log anyone out', async (_name, reply) => {
    saveSession(stored());
    global.fetch = jest.fn(reply);
    await start();
    expect(flags()).toContain('auth=true');
    expect(getSession()).not.toBeNull();
  });
});

describe('signing in', () => {
  test('signIn hands over to the redirect', async () => {
    await start();
    await act(async () => ctx.signIn({ remember: true, returnTo: '/x' }));
    expect(mockStartLogin).toHaveBeenCalledWith({ remember: true, returnTo: '/x' });
  });

  test('finishSignIn installs the session and returns where to go', async () => {
    mockCompleteLogin.mockResolvedValue({ session: stored(), returnTo: '/checklist' });
    await start();
    let path;
    await act(async () => {
      path = await ctx.finishSignIn('code');
    });
    expect(path).toBe('/checklist');
    expect(flags()).toContain('auth=true');
  });

  test('a pending account is known but not authenticated', async () => {
    mockCompleteLogin.mockResolvedValue({ session: stored({ status: 'pending' }), returnTo: '/' });
    await start();
    await act(async () => {
      await ctx.finishSignIn('code');
    });
    expect(flags()).toContain('auth=false pending=true');
    expect(screen.getByTestId('email')).toHaveTextContent('fulano@gmail.com');
  });

  test('a failure reaches the caller and changes nothing', async () => {
    mockCompleteLogin.mockRejectedValue(new Error('expired_login'));
    await start();
    await expect(ctx.finishSignIn('code')).rejects.toThrow('expired_login');
    expect(flags()).toContain('auth=false');
  });

  test('signing in again clears the "session expired" notice', async () => {
    saveSession(stored());
    global.fetch = jest.fn().mockResolvedValue(answer(401));
    await start();
    await waitFor(() => expect(flags()).toContain('expired=true'));
    await act(async () => ctx.signIn());
    expect(flags()).toContain('expired=false');
  });
});

describe('logging out', () => {
  test('ends the session here and on the server', async () => {
    saveSession(stored(), true);
    await start();
    act(() => ctx.logout());
    expect(flags()).toBe('auth=false pending=false profile=false expired=false');
    expect(getSession()).toBeNull();
    const [url, options] = global.fetch.mock.calls.at(-1);
    expect(url).toContain('/api/auth/logout');
    expect(options.method).toBe('POST');
    // Asked before the token was forgotten, or the server could not act on it.
    expect(options.headers.Authorization).toBe('Bearer sdt_abc');
  });

  test('works with the server down', async () => {
    saveSession(stored());
    await start();
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await act(async () => ctx.logout());
    expect(getSession()).toBeNull();
  });

  test('without a session nothing is sent', async () => {
    await start();
    act(() => ctx.logout());
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('profile', () => {
  test('is kept locally and sent to the server', async () => {
    saveSession(stored({ profile: null }));
    global.fetch = jest.fn().mockResolvedValue(answer(500));
    await start();
    expect(flags()).toContain('profile=false');
    act(() => ctx.saveUserProfile('data_eng'));
    expect(flags()).toContain('profile=true');
    const [url, options] = global.fetch.mock.calls.at(-1);
    expect(url).toContain('/api/auth/profile');
    expect(JSON.parse(options.body)).toEqual({ role: 'data_eng' });
  });

  test('a server that does not answer is not an obstacle', async () => {
    saveSession(stored({ profile: null }));
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await start();
    await act(async () => ctx.saveUserProfile('tester'));
    expect(flags()).toContain('profile=true');
  });
});

describe('what other parts of the app run into', () => {
  test('any request refused with 401 ends the session', async () => {
    saveSession(stored());
    await start();
    act(() => {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    });
    expect(flags()).toContain('auth=false');
    expect(flags()).toContain('expired=true');
  });

  test('a 403 asks the server what changed', async () => {
    saveSession(stored());
    await start();
    global.fetch = jest.fn().mockResolvedValue(answer(200, me({ status: 'pending' })));
    await act(async () => {
      window.dispatchEvent(new Event(FORBIDDEN_EVENT));
    });
    await waitFor(() => expect(flags()).toContain('pending=true'));
  });

  test('refreshing after the session is gone logs out', async () => {
    saveSession(stored());
    await start();
    sessionStorage.clear();
    await act(async () => ctx.refresh());
    expect(flags()).toContain('auth=false');
  });
});

test('useAuthContext throws outside AuthProvider', () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const Broken = () => {
    useAuthContext();
    return null;
  };
  expect(() => render(<Broken />)).toThrow('useAuthContext must be used within an AuthProvider');
});
