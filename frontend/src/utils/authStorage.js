/**
 * Where the session lives in the browser.
 *
 * Stores: {token, expiresAt, status, contact, userId, name, email, avatar,
 *          isAdmin, profile}
 *
 * The token is opaque, random, and only means something to the backend, which
 * checks the account behind it on every request and can end it at any time. It
 * is kept here, rather than in a cookie, because the frontend and the API are
 * on different sites and browsers block third-party cookies (docs/AUTH.md).
 *
 * "Remember me" decides where it goes: localStorage, until it expires, or
 * sessionStorage, which the browser clears when the tab closes — the right
 * default for a shared computer.
 */

export const SESSION_KEY = 'smartdatatest_session';

const stores = () => [window.sessionStorage, window.localStorage];

// Storage access throws when the browser blocks site data; being logged out is
// the correct reading of that, and crashing is not.
const attempt = (action, fallback) => {
  try {
    return action();
  } catch {
    return fallback;
  }
};

const read = (store) => {
  const raw = store.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    // Sessions from before Google sign-in carry no token: they were never more
    // than a note saying "logged in", and the API would refuse them.
    if (session?.token && session.expiresAt > Date.now()) return session;
  } catch {
    // Not ours, or corrupted.
  }
  store.removeItem(SESSION_KEY);
  return null;
};

/** Turn a backend answer (/exchange or /me) into what is stored. */
export function toSession(data, token) {
  return {
    token,
    expiresAt: data.expires_at * 1000,
    status: data.status,
    contact: data.contact || '',
    userId: data.user.id,
    name: data.user.name,
    email: data.user.email,
    avatar: data.user.avatar,
    isAdmin: Boolean(data.user.is_admin),
    profile: data.user.profile || null,
  };
}

export function saveSession(session, remember = false) {
  clearSession();
  attempt(() => {
    const store = remember ? window.localStorage : window.sessionStorage;
    store.setItem(SESSION_KEY, JSON.stringify(session));
  });
}

/** Change fields of the current session, wherever it is stored. */
export function updateSession(changes) {
  attempt(() => {
    for (const store of stores()) {
      const session = read(store);
      if (session) {
        store.setItem(SESSION_KEY, JSON.stringify({ ...session, ...changes }));
        return;
      }
    }
  });
}

/** The current session, or null if absent or expired. */
export function getSession() {
  return attempt(() => {
    for (const store of stores()) {
      const session = read(store);
      if (session) return session;
    }
    return null;
  }, null);
}

export function getToken() {
  return getSession()?.token || null;
}

export function clearSession() {
  attempt(() => stores().forEach((store) => store.removeItem(SESSION_KEY)));
}
