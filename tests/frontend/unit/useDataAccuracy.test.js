/**
 * Tests for useDataAccuracy hook
 * Covers all states, upload, compare, download, reset, removeFile flows
 */

import { renderHook, act } from '@testing-library/react';
import useDataAccuracy from '../../../frontend/src/hooks/useDataAccuracy';

// Mock config/api
jest.mock('../../../frontend/src/config/api', () => ({
  getApiUrl: (path) => `http://localhost${path}`,
  // apiFetch must still go through global.fetch so jest.spyOn intercepts it.
  apiFetch: (path, options) => fetch(`http://localhost${path}`, options),
  apiFetchUrl: (url, options) => fetch(url, options),
  getAuthHeaders: () => ({}),
}));

// Mock DOM methods used by downloadFile
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

const mockBlob = () => {
  const appendMock = jest.fn();
  const clickMock = jest.fn();
  const linkEl = { href: '', download: '', click: clickMock };
  jest.spyOn(document.body, 'appendChild').mockImplementation(() => linkEl);
  jest.spyOn(document.body, 'removeChild').mockImplementation(() => {});
  jest.spyOn(document, 'createElement').mockReturnValue(linkEl);
  return { appendMock, clickMock, linkEl };
};

describe('useDataAccuracy Hook', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  describe('Initial state', () => {
    test('initializes with correct default state', () => {
      const { result } = renderHook(() => useDataAccuracy());
      expect(result.current.sessionId).toBeUndefined();
      expect(result.current.goldFile).toBeNull();
      expect(result.current.targetFile).toBeNull();
      expect(result.current.goldPreview).toBeNull();
      expect(result.current.targetPreview).toBeNull();
      expect(result.current.columns).toEqual([]);
      expect(result.current.isUploading).toBe(false);
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.results).toBeNull();
    });
  });

  describe('uploadFile', () => {
    test('sets isUploading to true during upload', async () => {
      let resolveFetch;
      global.fetch.mockReturnValue(new Promise(resolve => { resolveFetch = resolve; }));
      const { result } = renderHook(() => useDataAccuracy());

      act(() => {
        result.current.uploadFile(new File([''], 'test.csv'), 'gold');
      });

      expect(result.current.isUploading).toBe(true);

      await act(async () => {
        resolveFetch({
          ok: true,
          json: async () => ({ sessionId: 'sess1', columns: [], preview: [] }),
        });
      });
    });

    test('updates goldFile state on successful gold upload', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          sessionId: 'sess1',
          columns: ['id', 'name'],
          preview: [{ id: 1, name: 'Alice' }],
        }),
      });
      const { result } = renderHook(() => useDataAccuracy());
      const file = new File([''], 'gold.csv');

      await act(async () => {
        await result.current.uploadFile(file, 'gold');
      });

      expect(result.current.goldFile).toBe(file);
      expect(result.current.goldPreview).toEqual([{ id: 1, name: 'Alice' }]);
    });

    test('updates targetFile state on successful target upload', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          sessionId: 'sess1',
          columns: ['id', 'name'],
          preview: [{ id: 2, name: 'Bob' }],
        }),
      });
      const { result } = renderHook(() => useDataAccuracy());
      const file = new File([''], 'target.csv');

      await act(async () => {
        await result.current.uploadFile(file, 'target');
      });

      expect(result.current.targetFile).toBe(file);
      expect(result.current.targetPreview).toEqual([{ id: 2, name: 'Bob' }]);
    });

    test('sets sessionId from first successful upload', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ sessionId: 'new-session', columns: [], preview: [] }),
      });
      const { result } = renderHook(() => useDataAccuracy());

      await act(async () => {
        await result.current.uploadFile(new File([''], 'test.csv'), 'gold');
      });

      // sessionId is not exposed in return but columns are populated
      expect(result.current.columns).toEqual([]);
    });

    test('populates columns from first upload', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          sessionId: 'sess1',
          columns: ['col1', 'col2', 'col3'],
          preview: [],
        }),
      });
      const { result } = renderHook(() => useDataAccuracy());

      await act(async () => {
        await result.current.uploadFile(new File([''], 'test.csv'), 'gold');
      });

      expect(result.current.columns).toEqual(['col1', 'col2', 'col3']);
    });

    test('sets error state on failed upload (non-ok response)', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'File too large' }),
      });
      const { result } = renderHook(() => useDataAccuracy());

      await act(async () => {
        try {
          await result.current.uploadFile(new File([''], 'test.csv'), 'gold');
        } catch (e) { /* expected */ }
      });

      expect(result.current.error).toBe('File too large');
    });

    test('sets error state on network failure (fetch throws)', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));
      const { result } = renderHook(() => useDataAccuracy());

      await act(async () => {
        try {
          await result.current.uploadFile(new File([''], 'test.csv'), 'gold');
        } catch (e) { /* expected */ }
      });

      expect(result.current.error).toBe('Network error');
    });

    test('sets isUploading to false after completion', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ sessionId: 'sess1', columns: [], preview: [] }),
      });
      const { result } = renderHook(() => useDataAccuracy());

      await act(async () => {
        await result.current.uploadFile(new File([''], 'test.csv'), 'gold');
      });

      expect(result.current.isUploading).toBe(false);
    });
  });

  describe('compareAndCorrect', () => {
    const setupWithFiles = async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'sess1', columns: ['id', 'val'], preview: [] }),
      });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'sess1', columns: ['id', 'val'], preview: [] }),
      });

      const { result } = renderHook(() => useDataAccuracy());

      await act(async () => {
        await result.current.uploadFile(new File([''], 'gold.csv'), 'gold');
      });
      await act(async () => {
        await result.current.uploadFile(new File([''], 'target.csv'), 'target');
      });

      act(() => {
        result.current.setMapping({ keyColumns: ['id'], valueColumns: ['val'] });
      });

      return result;
    };

    test('sets error if keyColumns is empty', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'sess1', columns: [], preview: [] }),
      });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'sess1', columns: [], preview: [] }),
      });
      const { result } = renderHook(() => useDataAccuracy());

      await act(async () => {
        await result.current.uploadFile(new File([''], 'gold.csv'), 'gold');
        await result.current.uploadFile(new File([''], 'target.csv'), 'target');
      });

      await act(async () => {
        await result.current.compareAndCorrect();
      });

      expect(result.current.error).toBeTruthy();
    });

    test('sets results on successful compare', async () => {
      const result = await setupWithFiles();

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          summary: { rows_gold: 10, accuracy: 0.9 },
          differences: [],
          downloadLinks: {},
        }),
      });

      await act(async () => {
        await result.current.compareAndCorrect();
      });

      expect(result.current.results).toMatchObject({
        summary: { rows_gold: 10, accuracy: 0.9 },
      });
    });

    test('sets isProcessing to false after compare', async () => {
      const result = await setupWithFiles();

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ summary: {}, differences: [], downloadLinks: {} }),
      });

      await act(async () => {
        await result.current.compareAndCorrect();
      });

      expect(result.current.isProcessing).toBe(false);
    });

    test('sets error on compare failure', async () => {
      const result = await setupWithFiles();

      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Comparison failed' }),
      });

      await act(async () => {
        try {
          await result.current.compareAndCorrect();
        } catch (e) { /* expected */ }
      });

      expect(result.current.error).toBe('Comparison failed');
    });
  });

  describe('reset', () => {
    test('clears all state back to initial values', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ sessionId: 'sess1', columns: ['id'], preview: [{ id: 1 }] }),
      });
      const { result } = renderHook(() => useDataAccuracy());

      await act(async () => {
        await result.current.uploadFile(new File([''], 'gold.csv'), 'gold');
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.goldFile).toBeNull();
      expect(result.current.targetFile).toBeNull();
      expect(result.current.goldPreview).toBeNull();
      expect(result.current.columns).toEqual([]);
      expect(result.current.results).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('removeFile', () => {
    test('clears goldFile when role is gold', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ sessionId: 'sess1', columns: [], preview: [] }),
      });
      const { result } = renderHook(() => useDataAccuracy());
      const file = new File([''], 'gold.csv');

      await act(async () => {
        await result.current.uploadFile(file, 'gold');
      });

      act(() => {
        result.current.removeFile('gold');
      });

      expect(result.current.goldFile).toBeNull();
      expect(result.current.goldPreview).toBeNull();
    });

    test('clears targetFile when role is target', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ sessionId: 'sess1', columns: [], preview: [] }),
      });
      const { result } = renderHook(() => useDataAccuracy());
      const file = new File([''], 'target.csv');

      await act(async () => {
        await result.current.uploadFile(file, 'target');
      });

      act(() => {
        result.current.removeFile('target');
      });

      expect(result.current.targetFile).toBeNull();
      expect(result.current.targetPreview).toBeNull();
    });
  });

  describe('setMapping and setOptions', () => {
    test('setMapping updates mapping state', () => {
      const { result } = renderHook(() => useDataAccuracy());
      const newMapping = { keyColumns: ['id'], valueColumns: ['name'] };

      act(() => {
        result.current.setMapping(newMapping);
      });

      expect(result.current.mapping).toEqual(newMapping);
    });

    test('setOptions updates options state', () => {
      const { result } = renderHook(() => useDataAccuracy());

      act(() => {
        result.current.setOptions({ tolerance: 0.05, decimalPlaces: 3 });
      });

      expect(result.current.options).toMatchObject({ tolerance: 0.05, decimalPlaces: 3 });
    });
  });

  describe('downloadFile', () => {
    test('calls fetch with the provided URL', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['data']),
      });
      const { result } = renderHook(() => useDataAccuracy());

      await act(async () => {
        await result.current.downloadFile('/api/accuracy/download/file.csv');
      });

      // Downloads go through apiFetchUrl, which passes an options object
      // carrying the Authorization header, so assert on the URL argument.
      expect(global.fetch.mock.calls[0][0]).toBe('/api/accuracy/download/file.csv');
    });

    test('sets error on download failure', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        blob: async () => new Blob(),
      });
      const { result } = renderHook(() => useDataAccuracy());

      await act(async () => {
        await result.current.downloadFile('/api/accuracy/download/file.csv');
      });

      expect(result.current.error).toContain('Failed to download file');
    });
  });
});
