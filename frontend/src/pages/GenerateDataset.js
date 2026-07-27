import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trash2, Eye, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { fadeIn, staggerContainer } from '../styles/animations';
import { apiFetch, apiFetchUrl, getApiUrl } from '../config/api';

const COLUMN_TYPES = [
  'string', 'integer', 'float', 'boolean', 'date', 'datetime',
  'category', 'email', 'phone', 'address', 'product_name', 
  'price', 'uuid', 'custom_pattern'
];

const FILE_TYPES = ['csv', 'xlsx', 'json', 'parquet'];

const GenerateDataset = () => {
  const [numColumns, setNumColumns] = useState(3);
  const [columns, setColumns] = useState([
    { name: 'id', type: 'integer', options: { min: 1, max: 1000000, unique: true } },
    { name: 'name', type: 'string', options: { length: 50 } },
    { name: 'created_at', type: 'datetime', options: { start: '2020-01-01', end: '2025-12-31' } }
  ]);
  const [fileType, setFileType] = useState('csv');
  const [numRows, setNumRows] = useState(1000);
  const [previewData, setPreviewData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [logs, setLogs] = useState([]);
  const [generationSummary, setGenerationSummary] = useState(null);

  const firstInputRef = useRef(null);

  useEffect(() => {
    // Focus first input on mount
    if (firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    // Adjust columns array when numColumns changes
    if (numColumns > columns.length) {
      const newColumns = [...columns];
      for (let i = columns.length; i < numColumns; i++) {
        newColumns.push({ 
          name: `column_${i + 1}`, 
          type: 'string', 
          options: {} 
        });
      }
      setColumns(newColumns);
    } else if (numColumns < columns.length) {
      setColumns(columns.slice(0, numColumns));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numColumns]);

  const handleColumnChange = (index, field, value) => {
    const newColumns = [...columns];
    if (field === 'type') {
      // Reset options when type changes
      newColumns[index] = { ...newColumns[index], type: value, options: {} };
    } else if (field.startsWith('options.')) {
      const optionKey = field.split('.')[1];
      newColumns[index] = {
        ...newColumns[index],
        options: { ...newColumns[index].options, [optionKey]: value }
      };
    } else {
      newColumns[index] = { ...newColumns[index], [field]: value };
    }
    setColumns(newColumns);
  };

  const buildSchema = () => {
    return {
      columns: columns.map(col => ({
        name: col.name,
        type: col.type,
        options: col.options || {}
      }))
    };
  };

  const validateForm = () => {
    const errors = [];
    
    // Check for empty column names
    columns.forEach((col, i) => {
      if (!col.name?.trim()) {
        errors.push(`Column ${i + 1} needs a name`);
      }
    });

    // Check for duplicate names
    const names = columns.map(c => c.name);
    const duplicates = names.filter((name, i) => names.indexOf(name) !== i);
    if (duplicates.length > 0) {
      errors.push(`Duplicate column names: ${duplicates.join(', ')}`);
    }

    // Check rows
    if (numRows < 1 || numRows > 1000000) {
      errors.push('Number of rows must be between 1 and 1,000,000');
    }

    return errors;
  };

  const handlePreview = async () => {
    setError(null);
    setSuccess(null);
    
    const errors = validateForm();
    if (errors.length > 0) {
      setError(errors.join('; '));
      return;
    }

    setIsPreviewing(true);
    setPreviewData(null);

    try {
      const response = await apiFetch('/api/synth/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema: buildSchema(),
          rows: 50,
          locale: 'pt_BR'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details?.join('; ') || errorData.error || 'Preview failed');
      }

      const data = await response.json();
      setPreviewData(data);
      setSuccess(`Preview generated: ${data.rows_generated} rows`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleGenerate = async () => {
    setError(null);
    setSuccess(null);
    setDownloadUrl(null);
    setLogs([]);
    setGenerationSummary(null);
    
    const errors = validateForm();
    if (errors.length > 0) {
      setError(errors.join('; '));
      return;
    }

    setIsGenerating(true);

    try {
      const response = await apiFetch('/api/synth/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema: buildSchema(),
          rows: numRows,
          fileType: fileType,
          llmMode: 'batched',
          batchSize: 1000,
          locale: 'pt_BR'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details?.join('; ') || errorData.error || 'Generation failed');
      }

      const data = await response.json();
      // Check if download URL is already absolute (starts with http/https)
      const downloadUrlToUse = data.downloadUrl.startsWith('http') 
        ? data.downloadUrl 
        : getApiUrl(data.downloadUrl);
      setDownloadUrl(downloadUrlToUse);
      setLogs(data.logs || []);
      setGenerationSummary(data.summary);
      setSuccess(`Dataset generated successfully! ${data.summary.rows} rows, ${data.summary.cols} columns`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClear = () => {
    setNumColumns(3);
    setColumns([
      { name: 'id', type: 'integer', options: { min: 1, max: 1000000, unique: true } },
      { name: 'name', type: 'string', options: { length: 50 } },
      { name: 'created_at', type: 'datetime', options: { start: '2020-01-01', end: '2025-12-31' } }
    ]);
    setFileType('csv');
    setNumRows(1000);
    setPreviewData(null);
    setError(null);
    setSuccess(null);
    setDownloadUrl(null);
    setLogs([]);
    setGenerationSummary(null);
  };

  const handleKeyDown = (e) => {
    // Submit on Enter, but not Shift+Enter (which creates new line in textareas)
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA') {
      // Don't interfere with select dropdowns
      if (e.target.tagName === 'SELECT') {
        return;
      }
      e.preventDefault();
      if (!isPreviewing && !isGenerating) {
        handlePreview();
      }
    }
  };

  // Downloads go through fetch, not a plain <a href>. The download route needs
  // the API token and an anchor cannot send an Authorization header, so it
  // would simply 401. Fetch the blob, then hand it to a temporary link.
  const handleDownload = async () => {
    try {
      const response = await apiFetchUrl(downloadUrl);
      if (!response.ok) throw new Error(`Download failed (${response.status})`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = downloadUrl.split('/').pop() || 'dataset';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err.message);
    }
  };

  const renderColumnOptions = (column, index) => {
    const type = column.type;
    const options = column.options || {};

    if (type === 'integer' || type === 'float' || type === 'price') {
      return (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="Min"
            value={options.min || ''}
            onChange={(e) => handleColumnChange(index, 'options.min', Number.parseFloat(e.target.value) || 0)}
            onKeyDown={handleKeyDown}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
            aria-label={`Min value for ${column.name}`}
          />
          <input
            type="number"
            placeholder="Max"
            value={options.max || ''}
            onChange={(e) => handleColumnChange(index, 'options.max', Number.parseFloat(e.target.value) || 100)}
            onKeyDown={handleKeyDown}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
            aria-label={`Max value for ${column.name}`}
          />
          {(type === 'float' || type === 'price') && (
            <input
              type="number"
              placeholder="Decimals"
              value={options.decimals || ''}
              onChange={(e) => handleColumnChange(index, 'options.decimals', Number.parseInt(e.target.value, 10) || 2)}
              onKeyDown={handleKeyDown}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
              aria-label={`Decimal places for ${column.name}`}
            />
          )}
          <label className="flex items-center gap-2 text-gray-300">
            <input
              type="checkbox"
              checked={options.unique || false}
              onChange={(e) => handleColumnChange(index, 'options.unique', e.target.checked)}
              className="w-4 h-4"
            />
            <span>Unique</span>
          </label>
        </div>
      );
    } else if (type === 'date' || type === 'datetime') {
      return (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            placeholder="Start"
            value={options.start || ''}
            onChange={(e) => handleColumnChange(index, 'options.start', e.target.value)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
            aria-label={`Start date for ${column.name}`}
          />
          <input
            type="date"
            placeholder="End"
            value={options.end || ''}
            onChange={(e) => handleColumnChange(index, 'options.end', e.target.value)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
            aria-label={`End date for ${column.name}`}
          />
        </div>
      );
    } else if (type === 'category') {
      return (
        <input
          type="text"
          placeholder="Categories (comma-separated)"
          value={Array.isArray(options.categories) ? options.categories.join(', ') : ''}
          onChange={(e) => handleColumnChange(index, 'options.categories', e.target.value.split(',').map(s => s.trim()))}
          onKeyDown={handleKeyDown}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
          aria-label={`Categories for ${column.name}`}
        />
      );
    } else if (type === 'string') {
      return (
        <input
          type="number"
          placeholder="Avg length"
          value={options.length || ''}
          onChange={(e) => handleColumnChange(index, 'options.length', Number.parseInt(e.target.value, 10) || 50)}
          onKeyDown={handleKeyDown}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
          aria-label={`Average length for ${column.name}`}
        />
      );
    } else if (type === 'custom_pattern') {
      return (
        <input
          type="text"
          placeholder="Pattern/Description"
          value={options.description || ''}
          onChange={(e) => handleColumnChange(index, 'options.description', e.target.value)}
          onKeyDown={handleKeyDown}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
          aria-label={`Pattern description for ${column.name}`}
        />
      );
    }
    
    return null;
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={staggerContainer}
      className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#1a1a2e] text-white py-12 px-6"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div variants={fadeIn} className="mb-8">
          {/* Header */}
          <header className="flex items-center justify-between p-4 border-b border-gray-700/50 bg-gray-900/50 backdrop-blur-sm mb-8">
            <Link
              to="/"
              className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-gray-800/50"
              aria-label="Back to Home"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Home</span>
            </Link>
            <h1 className="text-xl font-semibold text-white">Generate Synthetic Dataset</h1>
            <div className="w-32" /> {/* Spacer for centering */}
          </header>

          <p className="text-gray-300 text-lg mb-8">
            Create realistic synthetic data using AI-powered generation
          </p>
        </motion.div>

        {/* Error/Success Messages */}
        {error && (
          <motion.div
            variants={fadeIn}
            className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-200">{error}</p>
          </motion.div>
        )}

        {success && (
          <motion.div
            variants={fadeIn}
            className="mb-6 p-4 bg-green-900/50 border border-green-700 rounded-lg flex items-start gap-3"
          >
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-green-200">{success}</p>
          </motion.div>
        )}

        {/* Schema Configuration */}
        <motion.div
          variants={fadeIn}
          className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 mb-6"
        >
          <h2 className="text-2xl font-bold mb-6">Dataset Schema</h2>
          
          {/* Number of Columns */}
          <div className="mb-6">
            <label htmlFor="numColumns" className="block text-gray-300 mb-2">Number of Columns</label>
            <select
              id="numColumns"
              value={numColumns}
              onChange={(e) => setNumColumns(Number.parseInt(e.target.value, 10))}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
              aria-label="Number of columns"
            >
              {Array.from({ length: 50 }, (_, i) => (
                <option key={`col-count-${i + 1}`} value={i + 1}>{i + 1}</option>
              ))}
            </select>
          </div>

          {/* Column Configuration */}
          <div className="space-y-4">
            {columns.map((col, index) => (
              <div
                key={`col-config-${col.name}-${index}`}
                className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor={`col-name-${index}`} className="block text-gray-400 text-sm mb-1">Column Name</label>
                    <input
                      id={`col-name-${index}`}
                      ref={index === 0 ? firstInputRef : null}
                      type="text"
                      value={col.name}
                      onChange={(e) => handleColumnChange(index, 'name', e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      aria-label={`Name for column ${index + 1}`}
                    />
                  </div>
                  <div>
                    <label htmlFor={`col-type-${index}`} className="block text-gray-400 text-sm mb-1">Type</label>
                    <select
                      id={`col-type-${index}`}
                      value={col.type}
                      onChange={(e) => handleColumnChange(index, 'type', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      aria-label={`Type for column ${index + 1}`}
                    >
                      {COLUMN_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`col-options-${index}`} className="block text-gray-400 text-sm mb-1">Options</label>
                    {renderColumnOptions(col, index)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Output Configuration */}
        <motion.div
          variants={fadeIn}
          className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 mb-6"
        >
          <h2 className="text-2xl font-bold mb-6">Output Configuration</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="fileType" className="block text-gray-300 mb-2">File Type</label>
              <select
                id="fileType"
                value={fileType}
                onChange={(e) => setFileType(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                aria-label="Output file type"
              >
                {FILE_TYPES.map(type => (
                  <option key={type} value={type}>{type.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="numRows" className="block text-gray-300 mb-2">Number of Rows</label>
              <input
                id="numRows"
                type="number"
                value={numRows}
                onChange={(e) => setNumRows(Number.parseInt(e.target.value, 10) || 0)}
                onKeyDown={handleKeyDown}
                min="1"
                max="1000000"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                aria-label="Number of rows to generate"
              />
              <p className="text-gray-400 text-sm mt-1">Max: 1,000,000 rows</p>
            </div>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div variants={fadeIn} className="flex gap-4 mb-6">
          <button
            onClick={handlePreview}
            disabled={isPreviewing || isGenerating}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl font-semibold text-lg shadow-lg hover:shadow-blue-500/30 transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Preview 50 rows"
          >
            {isPreviewing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Generating Preview...
              </>
            ) : (
              <>
                <Eye className="w-5 h-5" />
                Preview (50 rows)
              </>
            )}
          </button>
          
          <button
            onClick={handleGenerate}
            disabled={isGenerating || isPreviewing}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold text-lg shadow-lg hover:shadow-purple-500/30 transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Generate full dataset"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Generating...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Generate Dataset
              </>
            )}
          </button>
          
          <button
            onClick={handleClear}
            disabled={isGenerating || isPreviewing}
            className="px-8 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Clear form"
          >
            <Trash2 className="w-5 h-5" />
            Clear
          </button>
        </motion.div>

        {/* Preview Table */}
        {previewData?.preview?.length > 0 && (
          <motion.div
            variants={fadeIn}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 mb-6"
          >
            <h2 className="text-2xl font-bold mb-4">Preview</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    {previewData.columns.map((col) => (
                      <th key={`preview-header-${col}`} className="px-4 py-2 text-left text-purple-400 font-semibold">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.preview.slice(0, 50).map((row, i) => (
                    <tr key={`preview-row-${i}-${JSON.stringify(row).substring(0, 30)}`} className="border-b border-gray-700/50">
                      {previewData.columns.map((col) => (
                        <td key={`preview-cell-${i}-${col}`} className="px-4 py-2 text-gray-300">
                          {row[col] !== null && row[col] !== undefined ? String(row[col]) : <span className="text-gray-500 italic">null</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Download Section */}
        {downloadUrl && (
          <motion.div
            variants={fadeIn}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 mb-6"
          >
            <h2 className="text-2xl font-bold mb-4">Download Ready</h2>
            {generationSummary && (
              <div className="mb-4 text-gray-300">
                <p>Rows: {generationSummary.rows.toLocaleString()}</p>
                <p>Columns: {generationSummary.cols}</p>
                <p>Format: {generationSummary.fileType.toUpperCase()}</p>
                <p>Duration: {generationSummary.durationSec}s</p>
              </div>
            )}
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl font-semibold shadow-lg hover:shadow-green-500/30 transition-all duration-300"
            >
              <Download className="w-5 h-5" />
              Download Dataset
            </button>
          </motion.div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <motion.div
            variants={fadeIn}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50"
          >
            <h2 className="text-2xl font-bold mb-4">Generation Logs</h2>
            <div className="bg-gray-900/50 rounded-lg p-4 max-h-64 overflow-y-auto">
              {logs.map((log, i) => (
                <p key={`log-${i}-${log.substring(0, 20)}`} className="text-gray-300 text-sm font-mono mb-1">
                  {log}
                </p>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default GenerateDataset;
