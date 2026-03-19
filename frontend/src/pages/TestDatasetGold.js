import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload, Download, FileCheck, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { fadeIn, staggerContainer } from '../styles/animations';
import { getApiUrl } from '../config/api';

/* eslint-disable no-undef */

const TestDatasetGold = () => {
  // State
  const [file, setFile] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [report, setReport] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Cleaning options
  const [options, setOptions] = useState({
    dropEmptyColumns: true,
    normalizeHeaders: true,
    trimStrings: true,
    coerceNumeric: true,
    parseDates: true,
    dropDuplicates: false,
    chunksize: 200000,
  });

  // Refs
  const fileInputRef = useRef(null);
  const pollingRef = useRef(null);

  // Focus management
  useEffect(() => {
    document.title = 'Test Dataset GOLD - SmartDataTest';
  }, []);

  // Polling for status
  useEffect(() => {
    if (isProcessing && sessionId) {
      pollingRef.current = setInterval(async () => {
        try {
          const response = await fetch(getApiUrl(`/api/gold/status?sessionId=${sessionId}`));
          if (response.ok) {
            const data = await response.json();
            setStatus(data);

            if (data.state === 'completed') {
              setIsProcessing(false);
              setReport(data.report);
              setStatus(data);
              clearInterval(pollingRef.current);
            } else if (data.state === 'failed') {
              setIsProcessing(false);
              setError(data.error || 'Processing failed');
              setStatus(data);
              clearInterval(pollingRef.current);
            }
          }
        } catch (err) {
          console.error('Failed to fetch status:', err);
        }
      }, 1000); // Poll every second

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      };
    }
  }, [isProcessing, sessionId]);

  // Handle file selection
  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;

    // Validate file type
    const validTypes = ['.csv', '.xlsx', '.xls', '.parquet'];
    const fileExt = '.' + selectedFile.name.split('.').pop().toLowerCase();
    
    if (!validTypes.includes(fileExt)) {
      setError(`Invalid file type. Allowed types: ${validTypes.join(', ')}`);
      return;
    }

    setFile(selectedFile);
    setError(null);
    setMetadata(null);
    setReport(null);
    setStatus(null);
  };

  // Handle file input change
  const handleInputChange = (e) => {
    const selectedFile = e.target.files[0];
    handleFileChange(selectedFile);
  };

  // Handle drag and drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files?.[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Upload file
  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(getApiUrl('/api/gold/upload'), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      setMetadata(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Trigger upload on file selection
  useEffect(() => {
    if (file && !metadata) {
      handleUpload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // Process dataset
  const handleProcess = async () => {
    if (!sessionId) return;

    setIsProcessing(true);
    setError(null);
    setStatus({ state: 'running', progress: { current: 0, total: 100, phase: 'initializing' } });

    try {
      const response = await fetch(getApiUrl('/api/gold/clean'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          datasetId: metadata.datasetId,
          options,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Processing failed');
      }

      const data = await response.json();
      if (data.status === 'completed') {
        // Get the detailed report from the status endpoint
        try {
          const statusResponse = await fetch(getApiUrl(`/api/gold/status?sessionId=${sessionId}`));
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            setReport(statusData.report);
            setStatus(statusData);
          }
        } catch (error_) {
          console.error('Failed to fetch report:', error_);
        }
        setIsProcessing(false);
      }
    } catch (err) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  // Download file
  const handleDownload = async (filename) => {
    if (!sessionId) return;

    try {
      const response = await fetch(getApiUrl(`/api/gold/download/${sessionId}/${filename}`));
      
      if (!response.ok) {
        throw new Error('Download failed');
      }

      // Get the blob from the response
      const blob = await response.blob();
      
      // Create a temporary URL for the blob
      const url = globalThis.URL.createObjectURL(blob);
      
      // Create a temporary anchor element and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      a.remove();
      globalThis.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      setError(`Download failed: ${err.message}`);
    }
  };

  // Reset
  const handleReset = () => {
    setFile(null);
    setSessionId(null);
    setMetadata(null);
    setError(null);
    setStatus(null);
    setReport(null);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 text-white"
    >
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-gray-700/50 bg-gray-900/50 backdrop-blur-sm">
        <Link
          to="/"
          className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-gray-800/50"
          aria-label="Back to Home"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back to Home</span>
        </Link>
        <h1 className="text-xl font-semibold text-white">Test Dataset GOLD</h1>
        <div className="w-32" /> {/* Spacer for centering */}
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <motion.div variants={fadeIn} className="mb-8">
          <p className="text-gray-300 text-lg">
            Upload and clean your dataset with automated data quality improvements
          </p>
        </motion.div>

        <div className="space-y-6">{/* Error Display */}
        {error && (
          <motion.div
            variants={fadeIn}
            className="bg-red-900/20 border border-red-500/50 rounded-xl p-4 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-red-300">Error</div>
              <div className="text-red-200">{error}</div>
            </div>
          </motion.div>
        )}

        {/* Upload Section */}
        {!metadata && (
          <motion.div
            variants={fadeIn}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50"
          >
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Upload className="w-6 h-6" />
              Upload Dataset
            </h2>

            {/* Drag and Drop Area */}
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role, jsx-a11y/prefer-tag-over-role */}
            <div
              role="button"
              tabIndex={0}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                dragActive
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-gray-600 hover:border-gray-500'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader className="w-12 h-12 text-purple-400 animate-spin" />
                  <p className="text-gray-300">Uploading...</p>
                </div>
              ) : (
                <>
                  <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-xl font-semibold mb-2">
                    Drop your dataset here or click to browse
                  </p>
                  <p className="text-gray-400 mb-4">
                    Supported formats: CSV, XLSX, XLS, Parquet (max 50MB)
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
                  >
                    Select File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,.parquet"
                    onChange={handleInputChange}
                    className="hidden"
                  />
                  {file && (
                    <p className="mt-4 text-purple-300">
                      Selected: {file.name}
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Metadata Display */}
        {metadata && !report && (
          <motion.div
            variants={fadeIn}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50"
          >
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <FileCheck className="w-6 h-6" />
              Dataset Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Format</div>
                <div className="text-xl font-semibold">{metadata.format.toUpperCase()}</div>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Columns Detected</div>
                <div className="text-xl font-semibold">{metadata.columns.length}</div>
              </div>
            </div>

            {/* Sample Preview */}
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Sample Data (first 20 rows)</h3>
              <div className="overflow-x-auto bg-gray-900/50 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800">
                    <tr>
                      {metadata.columns.map((col) => (
                        <th key={col} className="px-4 py-2 text-left font-semibold">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metadata.sample.slice(0, 5).map((row, idx) => {
                      const rowKey = metadata.columns.map(col => String(row[col] || '')).join('-').substring(0, 50) + `-${idx}`;
                      return (
                        <tr key={rowKey} className="border-t border-gray-700">
                          {metadata.columns.map((col) => (
                            <td key={`${rowKey}-${col}`} className="px-4 py-2">
                              {row[col] !== null && row[col] !== undefined
                                ? String(row[col])
                                : '-'}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cleaning Options */}
            <h3 className="font-semibold mb-4">Cleaning Options</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              {[
                { key: 'dropEmptyColumns', label: 'Remove empty columns (100% null)' },
                { key: 'normalizeHeaders', label: 'Normalize column names' },
                { key: 'trimStrings', label: 'Trim strings and remove invisible chars' },
                { key: 'coerceNumeric', label: 'Coerce numeric values' },
                { key: 'parseDates', label: 'Parse dates (best-effort)' },
                { key: 'dropDuplicates', label: 'Remove duplicate rows' },
              ].map((option) => (
                <label
                  key={option.key}
                  className="flex items-center gap-2 p-3 bg-gray-900/50 rounded-lg hover:bg-gray-900/70 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={options[option.key]}
                    onChange={(e) =>
                      setOptions({ ...options, [option.key]: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleProcess}
                disabled={isProcessing}
                className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <FileCheck className="w-5 h-5" />
                    Generate GOLD Dataset
                  </>
                )}
              </button>
              <button
                onClick={handleReset}
                disabled={isProcessing}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
              >
                Reset
              </button>
            </div>
          </motion.div>
        )}

        {/* Progress Display */}
        {isProcessing && status && (
          <motion.div
            variants={fadeIn}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50"
          >
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Loader className="w-6 h-6 animate-spin" />
              Processing
            </h2>

            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">
                  Phase: {status.progress?.phase || 'unknown'}
                </span>
                <span className="text-gray-400">
                  {status.progress?.current || 0} / {status.progress?.total || 100}
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-purple-600 h-full transition-all duration-300"
                  style={{
                    width: `${
                      ((status.progress?.current || 0) /
                        (status.progress?.total || 100)) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Report Display */}
        {report && (
          <motion.div
            variants={fadeIn}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50"
          >
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-400" />
              Cleaning Report
            </h2>

            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Rows Read</div>
                <div className="text-2xl font-bold">{report.rowsRead?.toLocaleString()}</div>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Rows Written</div>
                <div className="text-2xl font-bold">{report.rowsWritten?.toLocaleString()}</div>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Columns Before</div>
                <div className="text-2xl font-bold">{report.columnsBefore}</div>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Columns After</div>
                <div className="text-2xl font-bold">{report.columnsAfter}</div>
              </div>
            </div>

            {/* Removed Columns */}
            {report.removedColumns && report.removedColumns.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-2">Removed Columns</h3>
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <div className="flex flex-wrap gap-2">
                    {report.removedColumns.map((col) => (
                      <span
                        key={col}
                        className="px-3 py-1 bg-red-900/30 text-red-300 rounded-full text-sm"
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Changes Summary */}
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Changes Applied</h3>
              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-gray-400 text-sm">Trimmed Strings</div>
                    <div className="text-xl font-semibold">
                      {report.changedRows?.trimStrings?.toLocaleString() || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-sm">Coerced Numeric</div>
                    <div className="text-xl font-semibold">
                      {report.changedRows?.coerceNumeric?.toLocaleString() || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-sm">Parsed Dates</div>
                    <div className="text-xl font-semibold">
                      {report.changedRows?.parseDates?.toLocaleString() || 0}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Nulls Comparison */}
            {report.nullsPerColumn && (
              <div className="mb-6">
                <h3 className="font-semibold mb-2">Null Values (Top 20 Columns)</h3>
                <div className="overflow-x-auto bg-gray-900/50 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="px-4 py-2 text-left">Column</th>
                        <th className="px-4 py-2 text-right">Before</th>
                        <th className="px-4 py-2 text-right">After</th>
                        <th className="px-4 py-2 text-right">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(report.nullsPerColumn.before || {})
                        .slice(0, 20)
                        .map(([col, beforeCount]) => {
                          const afterCount = report.nullsPerColumn.after?.[col] || 0;
                          const change = beforeCount - afterCount;
                          return (
                            <tr key={col} className="border-t border-gray-700">
                              <td className="px-4 py-2 font-mono text-xs">{col}</td>
                              <td className="px-4 py-2 text-right">{beforeCount}</td>
                              <td className="px-4 py-2 text-right">{afterCount}</td>
                              <td
                                className={`px-4 py-2 text-right font-semibold ${
                                  change > 0 ? 'text-green-400' : 'text-gray-400'
                                }`}
                              >
                                {change > 0 ? '-' : ''}{Math.abs(change)}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sample Preview */}
            {report.samplePreview && report.samplePreview.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-2">
                  Cleaned Dataset Preview (first 50 rows)
                </h3>
                <div className="overflow-x-auto bg-gray-900/50 rounded-lg max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800 sticky top-0">
                      <tr>
                        {Object.keys(report.samplePreview[0] || {}).map((col) => (
                          <th key={col} className="px-4 py-2 text-left font-semibold">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.samplePreview.slice(0, 10).map((row, idx) => {
                        const rowKey = Object.values(row).map(v => String(v || '')).join('-').substring(0, 50) + `-${idx}`;
                        return (
                          <tr key={rowKey} className="border-t border-gray-700">
                            {Object.entries(row).map(([col, val]) => (
                              <td key={`${rowKey}-${col}`} className="px-4 py-2">
                                {val !== null && val !== undefined ? String(val) : '-'}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Download Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => handleDownload('gold_clean.csv')}
                className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download CSV
              </button>
              {metadata?.format !== 'csv' && (
                <button
                  onClick={() =>
                    handleDownload(`gold_clean.${metadata.format}`)
                  }
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download {metadata.format.toUpperCase()}
                </button>
              )}
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
              >
                Process Another
              </button>
            </div>
          </motion.div>
        )}
        </div>
      </div>
    </motion.div>
  );
};

export default TestDatasetGold;
