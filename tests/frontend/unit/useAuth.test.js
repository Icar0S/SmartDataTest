/**
 * Tests for frontend/src/hooks/useAuth.js
 */

import { act, renderHook } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockSignIn = jest.fn();
const mockFinishSignIn = jest.fn();
const mockLogout = jest.fn();
const mockRefresh = jest.fn();
const mockSaveUserProfile = jest.fn();
jest.mock('../../../frontend/src/context/AuthContext', () => ({
  useAuthContext: () => ({
    signIn: mockSignIn,
    finishSignIn: mockFinishSignIn,
    logout: mockLogout,
    refresh: mockRefresh,
    saveUserProfile: mockSaveUserProfile,
  }),
}));

import useAuth, { LOGIN_ERRORS, loginError } from '../../../frontend/src/hooks/useAuth';

const problem = (code) => Object.assign(new Error(code), { code });

beforeEach(() => jest.clearAllMocks());

describe('handleLogin', () => {
  test('leaves for Google and stays loading, because the page is going away', async () => {
    mockSignIn.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAuth());
    await act(async () => result.current.handleLogin(true, '/checklist'));
    expect(mockSignIn).toHaveBeenCalledWith({ remember: true, returnTo: '/checklist' });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  test('a failure is explained and the button comes back', async () => {
    mockSignIn.mockRejectedValue(problem('offline'));
    const { result } = renderHook(() => useAuth());
    await act(async () => result.current.handleLogin(false, '/'));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toEqual(LOGIN_ERRORS.offline);
  });

  test('trying again clears the previous error', async () => {
    mockSignIn.mockRejectedValueOnce(problem('offline')).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAuth());
    await act(async () => result.current.handleLogin(false, '/'));
    await act(async () => result.current.handleLogin(false, '/'));
    expect(result.current.error).toBeNull();
  });
});

describe('handleLoginReturn', () => {
  test('hands over the destination before loading ends', async () => {
    mockFinishSignIn.mockResolvedValue('/qa-checklist');
    const { result } = renderHook(() => useAuth());
    const onReturnTo = jest.fn();
    await act(async () => result.current.handleLoginReturn('code', onReturnTo));
    expect(mockFinishSignIn).toHaveBeenCalledWith('code');
    expect(onReturnTo).toHaveBeenCalledWith('/qa-checklist');
    expect(result.current.isLoading).toBe(false);
  });

  test('a failure is explained and goes nowhere', async () => {
    mockFinishSignIn.mockRejectedValue(problem('expired_login'));
    const { result } = renderHook(() => useAuth());
    const onReturnTo = jest.fn();
    await act(async () => result.current.handleLoginReturn('code', onReturnTo));
    expect(onReturnTo).not.toHaveBeenCalled();
    expect(result.current.error).toEqual(LOGIN_ERRORS.expired_login);
  });
});

describe('the rest', () => {
  test('handleLogout ends the session and goes to /login', () => {
    const { result } = renderHook(() => useAuth());
    act(() => result.current.handleLogout());
    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  test('profile and refresh go straight to the context', () => {
    const { result } = renderHook(() => useAuth());
    result.current.handleSaveProfile('tester');
    result.current.handleRefresh();
    expect(mockSaveUserProfile).toHaveBeenCalledWith('tester');
    expect(mockRefresh).toHaveBeenCalled();
  });

  test('showError and clearError', () => {
    const { result } = renderHook(() => useAuth());
    act(() => result.current.showError('blocked'));
    expect(result.current.error).toEqual(LOGIN_ERRORS.blocked);
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });
});

describe('messages', () => {
  test.each(Object.keys(LOGIN_ERRORS))('%s exists in both languages', (code) => {
    expect(LOGIN_ERRORS[code]['pt-BR']).toBeTruthy();
    expect(LOGIN_ERRORS[code]['en-US']).toBeTruthy();
  });

  // Every reason the backend can send back (src/auth/routes.py and oidc.py).
  test.each(['cancelled', 'failed', 'email_unverified', 'blocked', 'unavailable'])(
    'the backend reason %s has its own message',
    (code) => {
      expect(LOGIN_ERRORS).toHaveProperty(code);
    }
  );

  test('an unknown reason still says something', () => {
    expect(loginError('never-heard-of-it')).toEqual(LOGIN_ERRORS.failed);
    expect(loginError(undefined)).toEqual(LOGIN_ERRORS.failed);
  });
});
