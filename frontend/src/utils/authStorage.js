/**
 * Auth storage utilities.
 *
 * SESSION_KEY: 'dataforgetest_session'
 * Stores: {userId, name, email, role, avatar, profile, loginAt, expiresAt}
 * ⚠️ passwordHash is NEVER stored.
 */

export const SESSION_KEY = 'dataforgetest_session';

/**
 * Save user session to localStorage.
 * @param {Object} user - User object (passwordHash is stripped).
 * @param {boolean} rememberMe - true → 7 days expiry; false → 8 hours.
 */
export function saveSession(user, rememberMe = false) {
  const now = Date.now();
  const expiresAt = now + (rememberMe ? 7 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000);
  const session = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar || null,
    profile: null,
    loginAt: now,
    expiresAt,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/**
 * Update the profile field in the stored session.
 * @param {Object} profileData - Profile data to save.
 */
export function saveProfile(profileData) {
  const session = getSession();
  if (!session) return;
  session.profile = profileData;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/**
 * Return the current session, or null if absent/expired.
 */
export function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/**
 * Remove the session from localStorage.
 */
export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Return true if a valid (non-expired) session exists.
 */
export function isAuthenticated() {
  return getSession() !== null;
}

/**
 * Return true if the current session has a non-null profile.
 */
export function hasProfile() {
  const session = getSession();
  return session !== null && session.profile !== null;
}
