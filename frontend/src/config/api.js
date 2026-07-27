/**
 * API Configuration
 * 
 * This file configures the API URL for different environments.
 * - In development: Uses the proxy configured in package.json (localhost:5000)
 * - In production: Uses the environment variable REACT_APP_API_URL
 */

const config = {
  // API Base URL
  // In production, this should be set via REACT_APP_API_URL environment variable
  // In development, the proxy in package.json handles routing to localhost:5000
  apiUrl: process.env.REACT_APP_API_URL || '',

  // Bearer token for the backend API.
  //
  // The backend requires this on every route except /, /api/stats,
  // /api/auth/validate and the per-blueprint /health probes.
  //
  // SECURITY: Create React App inlines REACT_APP_* variables into the built
  // bundle, so this token is readable by anyone who opens DevTools. It is not
  // a user credential and must never be treated as one — it raises the cost of
  // anonymous and automated abuse, nothing more. Authenticating a *person* is
  // Cloudflare Access's job. Rotate it by adding the new value to the
  // backend's comma-separated API_TOKENS, redeploying the frontend, then
  // dropping the old one.
  apiToken: process.env.REACT_APP_API_TOKEN || '',

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
 * Authorization headers for backend calls.
 * Returns an empty object when no token is configured, so local development
 * against a backend with API_AUTH_DISABLED keeps working unchanged.
 * @returns {Object} Headers to merge into a request
 */
export const getAuthHeaders = () => {
  return config.apiToken ? { Authorization: `Bearer ${config.apiToken}` } : {};
};

/**
 * fetch() against the backend, with the API token attached.
 *
 * Use this instead of calling fetch(getApiUrl(path)) directly — the backend
 * rejects untokenised requests with 401, and routing every call through here
 * means a new one cannot forget the header.
 *
 * Caller-supplied headers win, and Content-Type is deliberately never set:
 * FormData uploads need the browser to generate the multipart boundary.
 *
 * @param {string} path - API path, e.g. '/api/synth/preview'
 * @param {Object} [options] - Standard fetch options
 * @returns {Promise<Response>}
 */
export const apiFetch = (path, options = {}) => {
  return fetch(getApiUrl(path), {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
};

/**
 * As apiFetch, but for an already-built absolute URL (download links built
 * from a session id, for instance).
 * @param {string} url - Full URL
 * @param {Object} [options] - Standard fetch options
 * @returns {Promise<Response>}
 */
export const apiFetchUrl = (url, options = {}) => {
  return fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
};

export default config;
