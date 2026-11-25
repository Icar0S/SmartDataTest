/**
 * Tests for frontend/src/utils/sso.js — the browser side of Google sign-in.
 */

import { webcrypto } from 'crypto';
import { TextEncoder } from 'util';
import {
  LoginError,
  challengeFor,
  completeLogin,
  createVerifier,
  discardPendingLogin,
  readLoginReturn,
  safeReturnPath,
  startLogin,
} from '../../../frontend/src/utils/sso';
import { getSession, SESSION_KEY } from '../../../frontend/src/utils/authStorage';

const PENDING_KEY = 'smartdatatest_login';

const answer = (status, body = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

const exchanged = {
  token: 'sdt_token',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  status: 'approved',
  user: { id: 'usr_1', name: 'Fulano', email: 'f@gmail.com', avatar: 'FU', is_admin: false },
};

beforeAll(() => {
  Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
  global.TextEncoder = TextEncoder;
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  global.fetch = jest.fn().mockResolvedValue(answer(200, { sso: true }));
});

const codeOf = (promise) => promise.then(() => 'resolved', (e) => e.code);

describe('verifier and challenge', () => {
  test('verifiers are random and have the length the backend requires', () => {
    const one = createVerifier();
    expect(one).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createVerifier()).not.toBe(one);
  });

  test('the challenge is the one in RFC 7636, appendix B', async () => {
    expect(await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
    );
  });
});

describe('startLogin', () => {
  test('sends the hash to the backend and keeps the verifier', async () => {
    const redirect = jest.fn();
    await startLogin({ remember: true, returnTo: '/qa-checklist', redirect });

    const url = new URL(redirect.mock.calls[0][0], 'http://localhost');
    const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY));
    expect(url.pathname).toBe('/api/auth/google/login');
    expect(url.searchParams.get('remember')).toBe('1');
    expect(url.searchParams.get('challenge')).toBe(await challengeFor(pending.verifier));
    expect(url.href).not.toContain(pending.verifier);
    expect(pending).toMatchObject({ remember: true, returnTo: '/qa-checklist' });
  });

  test('defaults to a session that ends with the tab, back to the home page', async () => {
    const redirect = jest.fn();
    await startLogin({ redirect });
    expect(redirect.mock.calls[0][0]).toContain('remember=0');
    expect(JSON.parse(sessionStorage.getItem(PENDING_KEY)).returnTo).toBe('/');
  });

  test.each([
    ['the server is unreachable', () => Promise.reject(new TypeError('Failed to fetch')), 'offline'],
    ['the tunnel answers for it', () => Promise.resolve(answer(530)), 'offline'],
    ['sign-in is not configured', () => Promise.resolve(answer(200, { sso: false })), 'not_configured'],
    ['the backend predates sign-in', () => Promise.resolve(answer(401)), 'not_configured'],
    ['too many attempts', () => Promise.resolve(answer(429)), 'rate_limited'],
    [
      'the answer is not JSON',
      () =>
        Promise.resolve({
          status: 200,
          ok: true,
          json: () => Promise.reject(new SyntaxError('x')),
        }),
      'not_configured',
    ],
  ])('stays on the page when %s', async (_name, reply, expected) => {
    global.fetch = jest.fn(reply);
    const redirect = jest.fn();
    expect(await codeOf(startLogin({ redirect }))).toBe(expected);
    expect(redirect).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
  });
});

describe('safeReturnPath', () => {
  test.each(['/', '/qa-checklist', '/data-accuracy/metrics'])('keeps %s', (path) => {
    expect(safeReturnPath(path)).toBe(path);
  });

  test.each([
    undefined,
    null,
    '',
    'qa-checklist',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    42,
  ])('%p becomes the home page', (path) => {
    expect(safeReturnPath(path)).toBe('/');
  });
});

describe('readLoginReturn', () => {
  test.each([
    ['', null],
    [undefined, null],
    ['#', null],
    ['#something', null],
    ['#code=abc-_1', { code: 'abc-_1' }],
    ['#error=cancelled', { error: 'cancelled' }],
  ])('%p', (hash, expected) => {
    expect(readLoginReturn(hash)).toEqual(expected);
  });
});

describe('completeLogin', () => {
  const pending = (extra = {}) =>
    sessionStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ verifier: 'v'.repeat(43), remember: false, returnTo: '/checklist', ...extra })
    );

  test('trades the code for a session and says where to go', async () => {
    pending();
    global.fetch = jest.fn().mockResolvedValue(answer(200, exchanged));
    const { session, returnTo } = await completeLogin('the-code');

    expect(returnTo).toBe('/checklist');
    expect(session.token).toBe('sdt_token');
    expect(getSession().email).toBe('f@gmail.com');
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('/api/auth/exchange');
    expect(JSON.parse(options.body)).toEqual({ code: 'the-code', verifier: 'v'.repeat(43) });
  });

  test('honours "remember me" from before the redirect', async () => {
    pending({ remember: true });
    global.fetch = jest.fn().mockResolvedValue(answer(200, exchanged));
    await completeLogin('c');
    expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();
  });

  test('a tampered return path cannot leave the app', async () => {
    pending({ returnTo: 'https://evil.example' });
    global.fetch = jest.fn().mockResolvedValue(answer(200, exchanged));
    expect((await completeLogin('c')).returnTo).toBe('/');
  });

  test('the verifier is used once', async () => {
    pending();
    global.fetch = jest.fn().mockResolvedValue(answer(200, exchanged));
    await completeLogin('c');
    expect(await codeOf(completeLogin('c'))).toBe('expired_login');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('a code this browser did not ask for is refused without asking the server', async () => {
    expect(await codeOf(completeLogin('planted-code'))).toBe('expired_login');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(getSession()).toBeNull();
  });

  test.each(['not json', '{}', 'null'])('corrupted pending login (%s)', async (raw) => {
    sessionStorage.setItem(PENDING_KEY, raw);
    expect(await codeOf(completeLogin('c'))).toBe('expired_login');
  });

  test.each([
    [() => Promise.reject(new TypeError('Failed to fetch')), 'offline'],
    [() => Promise.resolve(answer(400, { error: 'invalid_code' })), 'expired_login'],
    [() => Promise.resolve(answer(429)), 'rate_limited'],
    [() => Promise.resolve(answer(502)), 'offline'],
  ])('failure %#', async (reply, expected) => {
    pending();
    global.fetch = jest.fn(reply);
    expect(await codeOf(completeLogin('c'))).toBe(expected);
    expect(getSession()).toBeNull();
  });

  test('a discarded login cannot be completed', async () => {
    pending();
    discardPendingLogin();
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
    expect(await codeOf(completeLogin('c'))).toBe('expired_login');
  });

  test('errors are LoginError', async () => {
    await expect(completeLogin('c')).rejects.toBeInstanceOf(LoginError);
  });
});
