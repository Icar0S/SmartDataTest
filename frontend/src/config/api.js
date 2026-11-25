/**
 * API Configuration
 * 
 * This file configures the API URL for different environments.
 * - In development: Uses the proxy configured in package.json (localhost:5000)
 * - In production: Uses the environment variable REACT_APP_API_URL
 *
 * No credential belongs in this file or in any REACT_APP_* variable: Create
 * React App inlines them into the bundle, where anyone can read them. Requests
 * carry the session of whoever is logged in, and nothing else.
 */

import { getToken } from '../utils/authStorage';

/** The session is no longer valid: expired, ended, or the account was blocked. */
export const UNAUTHORIZED_EVENT = 'smartdatatest:unauthorized';

/** The session is valid but not allowed; the account's status may have changed. */
export const FORBIDDEN_EVENT = 'smartdatatest:forbidden';

const config = {
  // API Base URL
  // In production, this should be set via REACT_APP_API_URL environment variable
  // In development, the proxy in package.json handles routing to localhost:5000
  apiUrl: process.env.REACT_APP_API_URL || '',

  // Whether we're in production mode
  isProduction: process.env.NODE_ENV === 'production',
  
  // Whether we're in development mode
  isDevelopment: process.env.NODE_ENV === 'development',
};

/**
 * Get the full API endpoint URL
 * @param {string} path - The API path (e.g., '/api/synth/health')
 * @returns {string} The full URL for the API endpoint
 */
export const getApiUrl = (path) => {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // In development, return the path as-is (proxy will handle it)
  if (config.isDevelopment) {
    return `/${cleanPath}`;
  }
  
  // In production, check if API URL is configured
  if (config.isProduction && !config.apiUrl) {
    console.warn(
      'REACT_APP_API_URL is not set in production. API calls may fail. ' +
      'Please configure the backend URL in Vercel environment variables or use vercel.json rewrites.'
    );
  }
  
  return config.apiUrl ? `${config.apiUrl}/${cleanPath}` : `/${cleanPath}`;
};

/**
 * Get the API base URL
 * @returns {string} The base URL for API calls
 */
export const getApiBaseUrl = () => {
  return config.apiUrl || '';
};

/**
 * Absolute backend URL, for navigating the browser there.
 *
 * Not the same as getApiUrl in development: the dev server proxies fetch calls
 * but answers page navigations with the app itself, so a login link has to
 * point straight at the backend.
 * @param {string} path - Backend path, e.g. '/api/auth/google/login'
 * @returns {string}
 */
export const getBackendUrl = (path) => {
  const base = config.apiUrl || (config.isDevelopment ? 'http://localhost:5000' : '');
  return `${base}${path}`;
};

/**
 * Authorization headers for backend calls: the session of whoever is logged
 * in, or nothing.
 * @returns {Object} Headers to merge into a request
 */
export const getAuthHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const originOf = (url) => new URL(url, window.location.origin).origin;

/** True if *url* is served by our own backend, and may see the session. */
export const isBackendUrl = (url) => {
  try {
    const origin = originOf(url);
    return origin === window.location.origin || (Boolean(config.apiUrl) && origin === originOf(config.apiUrl));
  } catch {
    return false;
  }
};

const request = (url, options) => {
  const auth = isBackendUrl(url) ? getAuthHeaders() : {};
  const pending = fetch(url, { ...options, headers: { ...auth, ...(options.headers || {}) } });
  if (!auth.Authorization) return pending;
  return pending.then((response) => {
    if (response?.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    if (response?.status === 403) window.dispatchEvent(new Event(FORBIDDEN_EVENT));
    return response;
  });
};

/**
 * fetch() against the backend, with the session attached.
 *
 * Use this instead of calling fetch(getApiUrl(path)) directly — the backend
 * rejects anonymous requests with 401, and routing every call through here
 * means a new one cannot forget the header, and that an expired session is
 * noticed wherever it is first met.
 *
 * Caller-supplied headers win, and Content-Type is deliberately never set:
 * FormData uploads need the browser to generate the multipart boundary.
 *
 * @param {string} path - API path, e.g. '/api/synth/preview'
 * @param {Object} [options] - Standard fetch options
 * @returns {Promise<Response>}
 */
export const apiFetch = (path, options = {}) => request(getApiUrl(path), options);

/**
 * As apiFetch, but for an already-built absolute URL (download links built
 * from a session id, for instance). The session is attached only when the URL
 * points at our own backend.
 * @param {string} url - Full URL
 * @param {Object} [options] - Standard fetch options
 * @returns {Promise<Response>}
 */
export const apiFetchUrl = (url, options = {}) => request(url, options);

export default config;
