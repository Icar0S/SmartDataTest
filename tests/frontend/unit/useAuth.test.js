/**
 * Tests for frontend/src/hooks/useAuth.js
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock the users data
jest.mock('../../../frontend/src/data/users', () => ({
  REGISTERED_USERS: [
    {
      id: 'user-1',
      name: 'Admin User',
      email: 'admin@dataforgetest.com',
      password: 'admin123',
      role: 'admin',
      avatar: null,
    },
  ],
}));

// Mock authStorage utilities
const mockLogin = jest.fn();
const mockLogout = jest.fn();
const mockSaveUserProfile = jest.fn();
jest.mock('../../../frontend/src/context/AuthContext', () => ({
  useAuthContext: () => ({
    login: mockLogin,
    logout: mockLogout,
    saveUserProfile: mockSaveUserProfile,
    isAuthenticated: false,
    hasProfile: false,
    isLoading: false,
    user: null,
  }),
}));

// Mock bcrypt/password check — we mock the module that verifies passwords
jest.mock('../../../frontend/src/utils/authStorage', () => ({
  saveSession: jest.fn(),
  getSession: jest.fn(() => null),
  clearSession: jest.fn(),
  isAuthenticated: jest.fn(() => false),
  saveProfile: jest.fn(),
  hasProfile: jest.fn(() => false),
}));

import useAuth from '../../../frontend/src/hooks/useAuth';

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useAuth', () => {
  test('login with correct credentials returns true', async () => {
    const { result } = renderHook(() => useAuth());
    let loginResult;
    await act(async () => {
      const promise = result.current.handleLogin('admin@dataforgetest.com', 'admin123', false);
      jest.advanceTimersByTime(1200);
      loginResult = await promise;
    });
    expect(loginResult).toBe(true);
  });

  test('login with wrong email returns false and sets bilingual error', async () => {
    const { result } = renderHook(() => useAuth());
    let loginResult;
    await act(async () => {
      const promise = result.current.handleLogin('wrong@email.com', 'admin123', false);
      jest.advanceTimersByTime(1200);
      loginResult = await promise;
    });
    expect(loginResult).toBe(false);
    expect(result.current.error).not.toBeNull();
    expect(result.current.error['pt-BR']).toBeTruthy();
    expect(result.current.error['en-US']).toBeTruthy();
  });

  test('login with wrong password returns false and sets bilingual error', async () => {
    const { result } = renderHook(() => useAuth());
    let loginResult;
    await act(async () => {
      const promise = result.current.handleLogin('admin@dataforgetest.com', 'wrongpass', false);
      jest.advanceTimersByTime(1200);
      loginResult = await promise;
    });
    expect(loginResult).toBe(false);
    expect(result.current.error).not.toBeNull();
    expect(result.current.error['pt-BR']).toBeTruthy();
    expect(result.current.error['en-US']).toBeTruthy();
  });

  test('clearError sets error to null', async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      const promise = result.current.handleLogin('wrong@email.com', 'pass', false);
      jest.advanceTimersByTime(1200);
      await promise;
    });
    expect(result.current.error).not.toBeNull();
    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });

  test('handleSaveProfile calls saveUserProfile and navigates to /', () => {
    const { result } = renderHook(() => useAuth());
    act(() => {
      result.current.handleSaveProfile({ role: 'tester', setAt: new Date().toISOString() });
    });
    expect(mockSaveUserProfile).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  test('handleLogout calls logout and navigates to /login', () => {
    const { result } = renderHook(() => useAuth());
    act(() => {
      result.current.handleLogout();
    });
    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
