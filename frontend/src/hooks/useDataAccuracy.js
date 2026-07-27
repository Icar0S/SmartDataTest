import { useState, useCallback } from 'react';
import { apiFetch, apiFetchUrl } from '../config/api';

const useDataAccuracy = () => {
  const [sessionId, setSessionId] = useState(null);
  const [goldFile, setGoldFile] = useState(null);
  const [targetFile, setTargetFile] = useState(null);
  const [goldPreview, setGoldPreview] = useState(null);
  const [targetPreview, setTargetPreview] = useState(null);
  const [columns, setColumns] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [mapping, setMapping] = useState({
    keyColumns: [],
    valueColumns: []
  });
  const [options, setOptions] = useState({
    normalizeKeys: true,
    lowercase: true,
    stripAccents: true,
    stripPunctuation: true,
    coerceNumeric: true,
    decimalPlaces: 2,
    tolerance: 0.0,
    targetDuplicatePolicy: 'keep_last'
  });
  const [results, setResults] = useState(null);

  const uploadFile = useCallback(async (file, role) => {
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const queryParams = new URLSearchParams({
        role: role,
        ...(sessionId && { sessionId })
      });

      const response = await apiFetch(`/api/accuracy/upload?${queryParams}`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();

      // Set session ID if not already set
      if (!sessionId) {
        setSessionId(data.sessionId);
      }

      // Update state based on role
      if (role === 'gold') {
        setGoldFile(file);
        setGoldPreview(data.preview);
      } else {
        setTargetFile(file);
        setTargetPreview(data.preview);
      }

      // Update columns (use the first uploaded dataset's columns)
      if (columns.length === 0) {
        setColumns(data.columns);
      }

      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, [sessionId, columns.length]);

  const compareAndCorrect = useCallback(async () => {
    if (!sessionId || !goldFile || !targetFile) {
      setError('Both GOLD and TARGET files must be uploaded');
      return;
    }

    if (mapping.keyColumns.length === 0) {
      setError('At least one key column must be selected');
      return;
    }

    if (mapping.valueColumns.length === 0) {
      setError('At least one value column must be selected');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await apiFetch('/api/accuracy/compare-correct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          keyColumns: mapping.keyColumns,
          valueColumns: mapping.valueColumns,
          options
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Comparison failed');
      }

      const data = await response.json();
      setResults(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [sessionId, goldFile, targetFile, mapping, options]);

  const downloadFile = useCallback(async (url) => {
    try {
      // Fetch the file as a blob to ensure proper download.
      // apiFetchUrl, not fetch: download routes require the API token too.
      const response = await apiFetchUrl(url);
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      // Get the blob from response
      const blob = await response.blob();
      
      // Extract filename from URL or Content-Disposition header
      const filename = url.split('/').pop();
      
      // Create a blob URL and trigger download
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(`Failed to download file: ${err.message}`);
      console.error('Download error:', err);
    }
  }, []);

  const reset = useCallback(() => {
    setSessionId(null);
    setGoldFile(null);
    setTargetFile(null);
    setGoldPreview(null);
    setTargetPreview(null);
    setColumns([]);
    setMapping({
      keyColumns: [],
      valueColumns: []
    });
    setOptions({
      normalizeKeys: true,
      lowercase: true,
      stripAccents: true,
      stripPunctuation: true,
      coerceNumeric: true,
      decimalPlaces: 2,
      tolerance: 0.0,
      targetDuplicatePolicy: 'keep_last'
    });
    setResults(null);
    setError(null);
  }, []);

  const removeFile = useCallback((role) => {
    if (role === 'gold') {
      setGoldFile(null);
      setGoldPreview(null);
    } else {
      setTargetFile(null);
      setTargetPreview(null);
    }
    
    // If both files are removed, reset columns and mapping
    if (!goldFile && !targetFile) {
      setColumns([]);
      setMapping({
        keyColumns: [],
        valueColumns: []
      });
    }
  }, [goldFile, targetFile]);

  return {
    // State
    goldFile,
    targetFile,
    goldPreview,
    targetPreview,
    columns,
    isUploading,
    isProcessing,
    error,
    mapping,
    options,
    results,

    // Actions
    uploadFile,
    compareAndCorrect,
    downloadFile,
    reset,
    removeFile,
    setMapping,
    setOptions,
    setError
  };
};

export default useDataAccuracy;
