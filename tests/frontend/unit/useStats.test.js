/**
 * Tests for frontend/src/hooks/useStats.js
 */

import { renderHook, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock getApiUrl
jest.mock('../../../frontend/src/config/api', () => ({
  getApiUrl: (path) => `http://localhost:5000${path}`,
}));

const MOCK_RESPONSE = {
  tests_total: 971,
  datasets_total: 1180,
  coverage_pct: 86,
  response_sla_ms: 2000,
};

beforeEach(() => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => MOCK_RESPONSE,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

import useStats from '../../../frontend/src/hooks/useStats';

describe('useStats', () => {
  test('returns fallback values on initial render', () => {
    jest.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {})); // hanging
    const { result } = renderHook(() => useStats());
    // Before fetch resolves, fallback values are returned
    expect(result.current.tests).toBe('970+');
    expect(result.current.datasets).toBe('1180+');
    expect(result.current.coverage).toBe('86%');
    expect(result.current.responseSla).toBe('<2s');
  });

  test('updates stats after successful API response', async () => {
    const { result } = renderHook(() => useStats());
    await waitFor(() => {
      expect(result.current.tests).toBe('971+');
    });
    expect(result.current.datasets).toBe('1180+');
    expect(result.current.coverage).toBe('86%');
    expect(result.current.responseSla).toBe('<2s');
  });

  test('formats response_sla_ms >= 1000 as seconds', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ...MOCK_RESPONSE, response_sla_ms: 2000 }),
    });
    const { result } = renderHook(() => useStats());
    await waitFor(() => expect(result.current.tests).toBe('971+'));
    expect(result.current.responseSla).toBe('<2s');
  });

  test('formats response_sla_ms < 1000 as milliseconds', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ...MOCK_RESPONSE, response_sla_ms: 500 }),
    });
    const { result } = renderHook(() => useStats());
    await waitFor(() => expect(result.current.tests).toBe('971+'));
    expect(result.current.responseSla).toBe('<500ms');
  });

  test('keeps fallback values when fetch throws a network error', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useStats());
    // Wait a tick
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.tests).toBe('970+');
    expect(result.current.datasets).toBe('1180+');
  });

  test('keeps fallback values when API returns non-ok status', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, json: async () => ({}) });
    const { result } = renderHook(() => useStats());
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.tests).toBe('970+');
  });

  test('calls correct API endpoint', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const { result } = renderHook(() => useStats());
    await waitFor(() => expect(result.current.tests).toBe('971+'));
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:5000/api/stats',
      expect.objectContaining({ method: 'GET' })
    );
  });

  test('falls back gracefully when AbortSignal.timeout is unavailable', async () => {
    const originalTimeout = AbortSignal.timeout;
    // Simulate environments where AbortSignal.timeout does not exist
    delete AbortSignal.timeout;
    try {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => MOCK_RESPONSE,
      });
      const { result } = renderHook(() => useStats());
      await waitFor(() => expect(result.current.tests).toBe('971+'));
    } finally {
      AbortSignal.timeout = originalTimeout;
    }
  });
});
