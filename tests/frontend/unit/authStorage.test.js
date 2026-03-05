/**
 * Tests for frontend/src/utils/authStorage.js
 */

import {
  saveSession,
  getSession,
  clearSession,
  isAuthenticated,
  saveProfile,
  hasProfile,
} from '../../../frontend/src/utils/authStorage';

const SESSION_KEY = 'dataforgetest_session';

const mockUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'tester',
  avatar: null,
  passwordHash: 'should-not-be-stored',
};

beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

describe('saveSession', () => {
  test('stores session without including passwordHash', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
    saveSession(mockUser, false);
    expect(setItemSpy).toHaveBeenCalled();
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY));
    expect(stored).not.toHaveProperty('passwordHash');
    expect(stored.email).toBe(mockUser.email);
  });

  test('with rememberMe=true sets expiry ~7 days from now', () => {
    const now = Date.now();
    saveSession(mockUser, true);
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY));
    const expectedExpiry = now + 7 * 24 * 60 * 60 * 1000;
    expect(stored.expiresAt).toBeGreaterThanOrEqual(expectedExpiry - 5000);
    expect(stored.expiresAt).toBeLessThanOrEqual(expectedExpiry + 5000);
  });

  test('without rememberMe sets expiry ~8 hours from now', () => {
    const now = Date.now();
    saveSession(mockUser, false);
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY));
    const expectedExpiry = now + 8 * 60 * 60 * 1000;
    expect(stored.expiresAt).toBeGreaterThanOrEqual(expectedExpiry - 5000);
    expect(stored.expiresAt).toBeLessThanOrEqual(expectedExpiry + 5000);
  });
});

describe('getSession', () => {
  test('returns null when storage is empty', () => {
    expect(getSession()).toBeNull();
  });

  test('returns null and clears key when JSON is malformed', () => {
    localStorage.setItem(SESSION_KEY, 'not-valid-json{{{');
    expect(getSession()).toBeNull();
  });

  test('returns null when session is expired', () => {
    const expired = {
      userId: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'tester',
      avatar: null,
      profile: null,
      loginAt: Date.now() - 10000,
      expiresAt: Date.now() - 1000, // expired 1 second ago
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(expired));
    expect(getSession()).toBeNull();
  });

  test('returns session object when session is valid', () => {
    const valid = {
      userId: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'tester',
      avatar: null,
      profile: null,
      loginAt: Date.now(),
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(valid));
    const session = getSession();
    expect(session).not.toBeNull();
    expect(session.email).toBe('test@example.com');
  });
});

describe('clearSession', () => {
  test('removes the session key from localStorage', () => {
    const removeItemSpy = jest.spyOn(Storage.prototype, 'removeItem');
    saveSession(mockUser, false);
    clearSession();
    expect(removeItemSpy).toHaveBeenCalledWith(SESSION_KEY);
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
});

describe('isAuthenticated', () => {
  test('returns false when there is no session', () => {
    expect(isAuthenticated()).toBe(false);
  });

  test('returns true when there is a valid session', () => {
    saveSession(mockUser, false);
    expect(isAuthenticated()).toBe(true);
  });
});

describe('saveProfile', () => {
  test('updates session.profile in localStorage', () => {
    saveSession(mockUser, false);
    const profileData = { role: 'tester', setAt: new Date().toISOString() };
    saveProfile(profileData);
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY));
    expect(stored.profile).toEqual(profileData);
  });

  test('does nothing when there is no active session', () => {
    // No session in localStorage
    expect(() => saveProfile({ role: 'tester' })).not.toThrow();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
});

describe('hasProfile', () => {
  test('returns false when profile is null', () => {
    saveSession(mockUser, false);
    expect(hasProfile()).toBe(false);
  });

  test('returns true when profile is set', () => {
    saveSession(mockUser, false);
    saveProfile({ role: 'tester', setAt: new Date().toISOString() });
    expect(hasProfile()).toBe(true);
  });
});
