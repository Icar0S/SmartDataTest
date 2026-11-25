/**
 * Google sign-in, browser side.
 *
 * The browser invents a random verifier, keeps it, and sends only its hash to
 * the backend. What comes back from Google in the URL is a one-time code that
 * is worthless without that verifier — so a code read over a shoulder, left in
 * the history, or planted in a link by someone else opens nothing.
 */

import { getApiUrl, getBackendUrl } from '../config/api';
import { saveSession, toSession } from './authStorage';

const PENDING_KEY = 'smartdatatest_login';
const CONFIG_TIMEOUT_MS = 8000;

export class LoginError extends Error {
  constructor(code) {
    super(code);
    this.name = 'LoginError';
    this.code = code;
  }
}

const base64url = (bytes) =>
  window
    .btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export function createVerifier() {
  return base64url(window.crypto.getRandomValues(new Uint8Array(32)));
}

export async function challengeFor(verifier) {
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/** Only paths inside this app; never another site, however it is spelled. */
export function safeReturnPath(path) {
  return typeof path === 'string' && /^\/(?![/\\])/.test(path) ? path : '/';
}

/**
 * Whether the backend can log anyone in. Asked before leaving the page: a
 * failure here can be explained, one on the other side of a redirect is a
 * browser error page.
 */
async function assertBackendReady() {
  let response;
  try {
    response = await fetch(getApiUrl('/api/auth/config'), {
      signal: AbortSignal.timeout ? AbortSignal.timeout(CONFIG_TIMEOUT_MS) : undefined,
    });
  } catch {
    throw new LoginError('offline');
  }
  if (response.status >= 500) throw new LoginError('offline');
  if (response.status === 429) throw new LoginError('rate_limited');
  const body = response.ok ? await response.json().catch(() => ({})) : {};
  if (!body.sso) throw new LoginError('not_configured');
}

export async function startLogin({
  remember = false,
  returnTo = '/',
  redirect = (url) => window.location.assign(url),
} = {}) {
  await assertBackendReady();
  const verifier = createVerifier();
  const challenge = await challengeFor(verifier);
  window.sessionStorage.setItem(
    PENDING_KEY,
    JSON.stringify({ verifier, remember, returnTo: safeReturnPath(returnTo) })
  );
  const query = new URLSearchParams({ challenge, remember: remember ? '1' : '0' });
  redirect(`${getBackendUrl('/api/auth/google/login')}?${query}`);
}

/** What Google's way back left in the URL fragment, if anything. */
export function readLoginReturn(hash) {
  const params = new URLSearchParams((hash || '').replace(/^#/, ''));
  if (params.get('code')) return { code: params.get('code') };
  if (params.get('error')) return { error: params.get('error') };
  return null;
}

function takePending() {
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    window.sessionStorage.removeItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Forget a login that came back without a code. */
export function discardPendingLogin() {
  takePending();
}

/** Trade the one-time code for a session. Resolves to {session, returnTo}. */
export async function completeLogin(code) {
  const pending = takePending();
  if (!pending?.verifier) throw new LoginError('expired_login');
  let response;
  try {
    response = await fetch(getApiUrl('/api/auth/exchange'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, verifier: pending.verifier }),
    });
  } catch {
    throw new LoginError('offline');
  }
  if (response.status === 429) throw new LoginError('rate_limited');
  if (response.status >= 500) throw new LoginError('offline');
  if (!response.ok) throw new LoginError('expired_login');
  const data = await response.json();
  const session = toSession(data, data.token);
  saveSession(session, pending.remember);
  return { session, returnTo: safeReturnPath(pending.returnTo) };
}
