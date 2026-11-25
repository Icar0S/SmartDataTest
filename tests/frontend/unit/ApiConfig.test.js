/**
 * Tests for config/api.js
 * Covers getApiUrl and getApiBaseUrl in different environments
 */

describe('API Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getApiUrl', () => {
    test('returns path with leading slash in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.REACT_APP_API_URL = '';
      const { getApiUrl } = require('../../../frontend/src/config/api');
      expect(getApiUrl('/api/test')).toBe('/api/test');
    });

    test('strips double slash when path already has leading slash in development', () => {
      process.env.NODE_ENV = 'development';
      const { getApiUrl } = require('../../../frontend/src/config/api');
      const result = getApiUrl('/api/test');
      expect(result.startsWith('//')).toBe(false);
      expect(result).toBe('/api/test');
    });

    test('returns relative path when path has no leading slash in development', () => {
      process.env.NODE_ENV = 'development';
      const { getApiUrl } = require('../../../frontend/src/config/api');
      expect(getApiUrl('api/test')).toBe('/api/test');
    });

    test('prepends apiUrl in production when REACT_APP_API_URL is set', () => {
      process.env.NODE_ENV = 'production';
      process.env.REACT_APP_API_URL = 'https://backend.example.com';
      const { getApiUrl } = require('../../../frontend/src/config/api');
      expect(getApiUrl('/api/test')).toBe('https://backend.example.com/api/test');
    });

    test('returns relative path when no REACT_APP_API_URL in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.REACT_APP_API_URL;
      const { getApiUrl } = require('../../../frontend/src/config/api');
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      const result = getApiUrl('/api/test');
      expect(result).toBe('/api/test');
    });

    test('logs warning when no REACT_APP_API_URL in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.REACT_APP_API_URL;
      const { getApiUrl } = require('../../../frontend/src/config/api');
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      getApiUrl('/api/test');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('REACT_APP_API_URL'));
      warnSpy.mockRestore();
    });

    test('does NOT log warning in development mode', () => {
      process.env.NODE_ENV = 'development';
      const { getApiUrl } = require('../../../frontend/src/config/api');
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      getApiUrl('/api/test');
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('getApiBaseUrl', () => {
    test('returns empty string when no REACT_APP_API_URL', () => {
      delete process.env.REACT_APP_API_URL;
      const { getApiBaseUrl } = require('../../../frontend/src/config/api');
      expect(getApiBaseUrl()).toBe('');
    });

    test('returns configured URL when REACT_APP_API_URL is set', () => {
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      const { getApiBaseUrl } = require('../../../frontend/src/config/api');
      expect(getApiBaseUrl()).toBe('https://api.example.com');
    });
  });

  describe('default config export', () => {
    test('isProduction is true when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      const config = require('../../../frontend/src/config/api').default;
      expect(config.isProduction).toBe(true);
    });

    test('isDevelopment is true when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development';
      const config = require('../../../frontend/src/config/api').default;
      expect(config.isDevelopment).toBe(true);
    });

    test('apiUrl reflects REACT_APP_API_URL value', () => {
      process.env.REACT_APP_API_URL = 'https://custom.api.com';
      const config = require('../../../frontend/src/config/api').default;
      expect(config.apiUrl).toBe('https://custom.api.com');
    });

    test('apiUrl is empty string when REACT_APP_API_URL is not set', () => {
      delete process.env.REACT_APP_API_URL;
      const config = require('../../../frontend/src/config/api').default;
      expect(config.apiUrl).toBe('');
    });
  });

  describe('getBackendUrl', () => {
    test('points straight at the backend in development', () => {
      // The dev server answers page navigations itself instead of proxying them.
      process.env.NODE_ENV = 'development';
      process.env.REACT_APP_API_URL = '';
      const { getBackendUrl } = require('../../../frontend/src/config/api');
      expect(getBackendUrl('/api/x')).toBe('http://localhost:5000/api/x');
    });

    test('uses the configured API in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      const { getBackendUrl } = require('../../../frontend/src/config/api');
      expect(getBackendUrl('/api/x')).toBe('https://api.example.com/api/x');
    });

    test('stays relative in production without one', () => {
      process.env.NODE_ENV = 'production';
      process.env.REACT_APP_API_URL = '';
      const { getBackendUrl } = require('../../../frontend/src/config/api');
      expect(getBackendUrl('/api/x')).toBe('/api/x');
    });
  });

  describe('requests', () => {
    const logIn = () =>
      sessionStorage.setItem(
        'smartdatatest_session',
        JSON.stringify({ token: 'sdt_abc', expiresAt: Date.now() + 60000 })
      );
    const sentHeaders = () => global.fetch.mock.calls[0][1].headers;
    const listen = (name) => {
      const listener = jest.fn();
      window.addEventListener(name, listener);
      return listener;
    };

    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      sessionStorage.clear();
      localStorage.clear();
      global.fetch = jest.fn().mockResolvedValue({ status: 200, ok: true });
    });

    test('carry the session of whoever is logged in', async () => {
      logIn();
      const { apiFetch } = require('../../../frontend/src/config/api');
      await apiFetch('/api/x', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      expect(global.fetch.mock.calls[0][0]).toBe('https://api.example.com/api/x');
      expect(sentHeaders()).toEqual({
        Authorization: 'Bearer sdt_abc',
        'Content-Type': 'application/json',
      });
    });

    test('carry nothing when nobody is', async () => {
      const { apiFetch, getAuthHeaders } = require('../../../frontend/src/config/api');
      await apiFetch('/api/x');
      expect(sentHeaders()).toEqual({});
      expect(getAuthHeaders()).toEqual({});
    });

    test('no build-time token is sent, even if someone sets the old variable', async () => {
      process.env.REACT_APP_API_TOKEN = 'public-because-it-is-in-the-bundle';
      const { apiFetch } = require('../../../frontend/src/config/api');
      await apiFetch('/api/x');
      expect(JSON.stringify(global.fetch.mock.calls)).not.toContain('public-because');
    });

    test('caller headers win', async () => {
      logIn();
      const { apiFetch } = require('../../../frontend/src/config/api');
      await apiFetch('/api/x', { headers: { Authorization: 'Bearer other' } });
      expect(sentHeaders().Authorization).toBe('Bearer other');
    });

    test('never set Content-Type by themselves', async () => {
      logIn();
      const { apiFetch } = require('../../../frontend/src/config/api');
      await apiFetch('/api/x', { method: 'POST', body: new FormData() });
      expect(sentHeaders()).not.toHaveProperty('Content-Type');
    });

    test.each([
      ['https://api.example.com/api/gold/download/a/b', true],
      ['/api/gold/download/a/b', true],
      ['https://evil.example/api/gold/download/a/b', false],
      ['https://api.example.com.evil.example/x', false],
      ['http://api.example.com/x', false],
      ['//evil.example/x', false],
      ['http://[not-a-url', false],
    ])('the session goes to %s: %s', async (url, expected) => {
      logIn();
      const { apiFetchUrl, isBackendUrl } = require('../../../frontend/src/config/api');
      expect(isBackendUrl(url)).toBe(expected);
      await apiFetchUrl(url);
      expect('Authorization' in sentHeaders()).toBe(expected);
    });

    test('401 announces that the session is over', async () => {
      logIn();
      global.fetch.mockResolvedValue({ status: 401, ok: false });
      const { apiFetch, UNAUTHORIZED_EVENT } = require('../../../frontend/src/config/api');
      const listener = listen(UNAUTHORIZED_EVENT);
      const response = await apiFetch('/api/x');
      expect(listener).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(401); // the caller still gets its answer
    });

    test('403 announces that access may have changed', async () => {
      logIn();
      global.fetch.mockResolvedValue({ status: 403, ok: false });
      const { apiFetch, FORBIDDEN_EVENT } = require('../../../frontend/src/config/api');
      const listener = listen(FORBIDDEN_EVENT);
      await apiFetch('/api/x');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    test('a 401 to an anonymous request says nothing about a session', async () => {
      global.fetch.mockResolvedValue({ status: 401, ok: false });
      const { apiFetch, UNAUTHORIZED_EVENT } = require('../../../frontend/src/config/api');
      const listener = listen(UNAUTHORIZED_EVENT);
      await apiFetch('/api/x');
      expect(listener).not.toHaveBeenCalled();
    });

    test('a network failure reaches the caller', async () => {
      logIn();
      global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
      const { apiFetch } = require('../../../frontend/src/config/api');
      await expect(apiFetch('/api/x')).rejects.toThrow('Failed to fetch');
    });
  });
});
