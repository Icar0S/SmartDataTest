/**
 * Tests for frontend/src/utils/authStorage.js
 */

import {
  SESSION_KEY,
  clearSession,
  getSession,
  getToken,
  saveSession,
  toSession,
  updateSession,
} from '../../../frontend/src/utils/authStorage';

const session = (overrides = {}) => ({
  token: 'sdt_abc',
  expiresAt: Date.now() + 60_000,
  status: 'approved',
  contact: '',
  userId: 'usr_1',
  name: 'Fulano',
  email: 'fulano@gmail.com',
  avatar: 'FU',
  isAdmin: false,
  profile: null,
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  jest.restoreAllMocks();
});

describe('where the session is kept', () => {
  test('by default, only until the tab closes', () => {
    saveSession(session());
    expect(sessionStorage.getItem(SESSION_KEY)).not.toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  test('with "remember me", across tabs and restarts', () => {
    saveSession(session(), true);
    expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  test('signing in again leaves no second session behind', () => {
    saveSession(session({ token: 'sdt_old' }), true);
    saveSession(session({ token: 'sdt_new' }));
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(getToken()).toBe('sdt_new');
  });

  test('clearing removes it from both places', () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session()));
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session()));
    clearSession();
    expect(getSession()).toBeNull();
  });
});

describe('getSession', () => {
  test('null when there is nothing', () => {
    expect(getSession()).toBeNull();
    expect(getToken()).toBeNull();
  });

  test('returns a valid session', () => {
    saveSession(session());
    expect(getSession().email).toBe('fulano@gmail.com');
    expect(getToken()).toBe('sdt_abc');
  });

  test('an expired session is null, and is removed', () => {
    saveSession(session({ expiresAt: Date.now() - 1 }));
    expect(getSession()).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  test('corrupted content is null, and is removed', () => {
    localStorage.setItem(SESSION_KEY, 'not-valid-json{{{');
    expect(getSession()).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  test('a session from before Google sign-in does not count', () => {
    // What the old login stored: no token, just a note saying "logged in".
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ userId: 'user-admin-001', role: 'admin', expiresAt: Date.now() + 60_000 })
    );
    expect(getSession()).toBeNull();
  });

  test.each(['null', '[]', '"text"', '1'])('unexpected JSON (%s) does not count', (raw) => {
    localStorage.setItem(SESSION_KEY, raw);
    expect(getSession()).toBeNull();
  });

  test('blocked site data reads as logged out instead of crashing', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(getSession()).toBeNull();
    expect(getToken()).toBeNull();
  });

  test('saving with blocked site data does not crash', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveSession(session(), true)).not.toThrow();
  });
});

describe('updateSession', () => {
  test.each([false, true])('changes fields in place (remember=%s)', (remember) => {
    saveSession(session(), remember);
    updateSession({ status: 'pending', profile: 'tester' });
    expect(getSession()).toMatchObject({ status: 'pending', profile: 'tester', token: 'sdt_abc' });
    expect(localStorage.getItem(SESSION_KEY) !== null).toBe(remember);
  });

  test('does nothing without a session', () => {
    updateSession({ profile: 'tester' });
    expect(getSession()).toBeNull();
  });
});

describe('toSession', () => {
  const answer = {
    expires_at: 1_900_000_000,
    status: 'approved',
    user: {
      id: 'usr_1',
      name: 'Fulano',
      email: 'fulano@gmail.com',
      avatar: 'FU',
      is_admin: true,
      profile: 'tester',
    },
  };

  test('translates the backend answer', () => {
    expect(toSession(answer, 'sdt_x')).toEqual({
      token: 'sdt_x',
      expiresAt: 1_900_000_000_000,
      status: 'approved',
      contact: '',
      userId: 'usr_1',
      name: 'Fulano',
      email: 'fulano@gmail.com',
      avatar: 'FU',
      isAdmin: true,
      profile: 'tester',
    });
  });

  test('a pending account carries the operator contact', () => {
    const pending = { ...answer, status: 'pending', contact: 'fale com fulano' };
    expect(toSession(pending, 'sdt_x').contact).toBe('fale com fulano');
  });
});
