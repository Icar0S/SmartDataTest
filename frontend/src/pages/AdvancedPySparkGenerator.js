import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, CheckCircle, Code, Copy, Download, ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion } from 'framer-motion';
import { getApiUrl } from '../config/api';

const AdvancedPySparkGenerator = () => {
  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Step 1: Upload
  const [file, setFile] = useState(null);
  const [uploadOptions, setUploadOptions] = useState({
    delimiter: 'auto',
    encoding: 'auto',
    header: true,
    sample_size: 10000
  });
  const fileInputRef = useRef(null);
  
  // Step 2: Metadata
  const [metadata, setMetadata] = useState(null);
  const [editedMetadata, setEditedMetadata] = useState({});
  
  // Step 3: DSL
  const [dsl, setDsl] = useState(null);
  const [dslText, setDslText] = useState('');
  
  // Step 4: PySpark Code
  const [pysparkCode, setPysparkCode] = useState('');
  const [filename, setFilename] = useState('generated_code.py');

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUploadAndInspect = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      // Only send delimiter and encoding if they're not auto-detect
      if (uploadOptions.delimiter !== 'auto') {
        formData.append('delimiter', uploadOptions.delimiter);
      }
      if (uploadOptions.encoding !== 'auto') {
        formData.append('encoding', uploadOptions.encoding);
      }
      formData.append('header', uploadOptions.header.toString());
      formData.append('sample_size', uploadOptions.sample_size.toString());

      const response = await fetch(getApiUrl('/api/datasets/inspect'), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Failed to inspect dataset';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = `Server error (${response.status}): ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setMetadata(data);
      setCurrentStep(2);
    } catch (err) {
      // Provide more detailed error messages
      if (err.message.includes('Failed to fetch') || err.name === 'NetworkError') {
        setError('Network error: Unable to connect to server. Please check your connection and try again.');
      } else if (err.message.includes('timeout')) {
        setError('Request timeout: The file is taking too long to process. Try with a smaller file.');
      } else {
        setError(err.message);
      }
      console.error('Inspect error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateDSL = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl('/api/datasets/generate-dsl'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metadata: metadata,
          user_edits: editedMetadata,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate JSON';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `Server error (${response.status}): ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setDsl(data.dsl);
      setDslText(JSON.stringify(data.dsl, null, 2));
      setCurrentStep(3);
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.name === 'NetworkError') {
        setError('Network error: Unable to connect to server. Please check your connection.');
      } else {
        setError(err.message);
      }
      console.error('Generate DSL error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePySpark = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // If DSL was edited, parse it
      let finalDsl = dsl;
      if (dslText !== JSON.stringify(dsl, null, 2)) {
        try {
          finalDsl = JSON.parse(dslText);
        } catch (e) {
          throw new Error('Invalid JSON: ' + e.message);
        }
      }

      const response = await fetch(getApiUrl('/api/datasets/generate-pyspark'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dsl: finalDsl,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate PySpark code';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `Server error (${response.status}): ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setPysparkCode(data.pyspark_code);
      setFilename(data.filename);
      setCurrentStep(4);
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.name === 'NetworkError') {
        setError('Network error: Unable to connect to server. Please check your connection.');
      } else {
        setError(err.message);
      }
      console.error('Generate PySpark error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pysparkCode);
    // You could add a toast notification here
  };

  const handleDownloadCode = () => {
    const blob = new Blob([pysparkCode], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setCurrentStep(1);
    setFile(null);
    setMetadata(null);
    setEditedMetadata({});
    setDsl(null);
    setDslText('');
    setPysparkCode('');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleColumnEdit = (columnName, field, value) => {
    setEditedMetadata(prev => ({
      ...prev,
      columns: {
        ...(prev.columns || {}),
        [columnName]: {
          ...(prev.columns?.[columnName] || {}),
          [field]: value
        }
      }
    }));
  };

  const renderStep1 = () => (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50">
      <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
        <Upload className="text-purple-400" />
        Step 1: Upload Dataset
      </h2>
      
      <div className="space-y-6">
        {/* File Upload */}
        <div>
          <label className="block text-gray-300 mb-2 font-medium">
            Select Dataset File
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,.jsonl,.parquet"
            onChange={handleFileSelect}
            className="block w-full text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer bg-gray-900/50 rounded-lg border border-gray-700"
          />
          {file && (
            <p className="mt-2 text-sm text-green-400">
              Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
          <p className="mt-2 text-sm text-gray-400">
            Supported formats: CSV, JSON, JSONL, Parquet (Max: 100MB)
          </p>
        </div>

        {/* CSV Options */}
        {file && file.name.toLowerCase().endsWith('.csv') && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
            <div>
              <label className="block text-gray-300 mb-2 text-sm">Delimiter</label>
              <select
                value={uploadOptions.delimiter}
                onChange={(e) => setUploadOptions({...uploadOptions, delimiter: e.target.value})}
                className="w-full px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
              >
                <option value="auto">Auto-detect (Recommended)</option>
                <option value=",">Comma (,)</option>
                <option value=";">Semicolon (;)</option>
                <option value="\t">Tab</option>
                <option value="|">Pipe (|)</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-300 mb-2 text-sm">Encoding</label>
              <select
                value={uploadOptions.encoding}
                onChange={(e) => setUploadOptions({...uploadOptions, encoding: e.target.value})}
                className="w-full px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
              >
                <option value="auto">Auto-detect (Recommended)</option>
                <option value="utf-8">UTF-8</option>
                <option value="latin-1">Latin-1</option>
                <option value="cp1252">Windows-1252</option>
                <option value="iso-8859-1">ISO-8859-1</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-gray-300">
                <input
                  type="checkbox"
                  checked={uploadOptions.header}
                  onChange={(e) => setUploadOptions({...uploadOptions, header: e.target.checked})}
                  className="w-4 h-4 rounded border-gray-700 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm">File has header row</span>
              </label>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300">{error}</p>
          </div>
        )}

        <button
          onClick={handleUploadAndInspect}
          disabled={!file || isLoading}
          className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>Processing...</>
          ) : (
            <>
              Inspect Dataset
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50">
      <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
        <FileText className="text-purple-400" />
        Step 2: Review Dataset Metadata
      </h2>
      
      <div className="space-y-6">
        {/* Dataset Info */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
          <div>
            <p className="text-sm text-gray-400">Format</p>
            <p className="text-lg font-semibold text-white">{metadata?.format?.toUpperCase()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Rows</p>
            <p className="text-lg font-semibold text-white">{metadata?.row_count?.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Columns</p>
            <p className="text-lg font-semibold text-white">{metadata?.column_count}</p>
          </div>
        </div>

        {/* Detected Options */}
        {metadata?.detected_options && (
          <div className="p-4 bg-green-900/20 border border-green-700/50 rounded-lg">
            <h4 className="text-sm font-semibold text-green-300 mb-2">Auto-detected Settings</h4>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
              {metadata.detected_options.encoding && (
                <div>
                  <span className="text-gray-400">Encoding:</span>{' '}
                  <span className="font-medium">{metadata.detected_options.encoding}</span>
                </div>
              )}
              {metadata.detected_options.delimiter && (
                <div>
                  <span className="text-gray-400">Delimiter:</span>{' '}
                  <span className="font-medium">
                    {metadata.detected_options.delimiter === '\t' ? 'Tab' : metadata.detected_options.delimiter}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview */}
        <div>
          <h3 className="text-xl font-semibold text-white mb-3">Data Preview</h3>
          <div className="overflow-x-auto bg-gray-900/50 rounded-lg border border-gray-700">
            <table className="w-full text-sm min-w-max">
              <thead>
                <tr className="border-b border-gray-700">
                  {metadata?.columns?.map((col, idx) => (
                    <th 
                      key={idx} 
                      className="px-4 py-2 text-left text-gray-300 font-medium whitespace-nowrap min-w-[120px] max-w-[200px]"
                    >
                      <div className="truncate" title={col.name}>
                        {col.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metadata?.preview?.slice(0, 5).map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-700/50">
                    {metadata?.columns?.map((col, colIdx) => (
                      <td key={colIdx} className="px-4 py-2 text-gray-400 whitespace-nowrap">
                        {String(row[col.name] ?? 'null')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Column Statistics */}
        <div>
          <h3 className="text-xl font-semibold text-white mb-3">Column Statistics</h3>
          <div className="space-y-3">
            {metadata?.columns?.map((col, idx) => (
              <div key={idx} className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-lg font-semibold text-purple-300">{col.name}</h4>
                    <p className="text-sm text-gray-400">
                      Type: {col.type} | Nulls: {(col.null_ratio * 100).toFixed(1)}% | 
                      Unique: {(col.unique_ratio * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
                
                {col.min !== undefined && col.max !== undefined && (
                  <p className="text-sm text-gray-400">
                    Range: [{col.min?.toFixed(2)}, {col.max?.toFixed(2)}]
                    {col.mean !== undefined && ` | Mean: ${col.mean.toFixed(2)}`}
                  </p>
                )}
                
                {col.sample_values && col.sample_values.length > 0 && (
                  <p className="text-sm text-gray-400">
                    Sample values: {col.sample_values.slice(0, 3).join(', ')}
                  </p>
                )}
                
                {/* Edit options */}
                <div className="mt-3 pt-3 border-t border-gray-700 grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editedMetadata.columns?.[col.name]?.required || col.null_ratio < 0.05}
                      onChange={(e) => handleColumnEdit(col.name, 'required', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-700 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-gray-300">Required (not null)</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editedMetadata.columns?.[col.name]?.unique || col.unique_ratio > 0.95}
                      onChange={(e) => handleColumnEdit(col.name, 'unique', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-700 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-gray-300">Unique values</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dataset Name */}
        <div>
          <label className="block text-gray-300 mb-2 font-medium">
            Dataset Name (for generated code)
          </label>
          <input
            type="text"
            value={editedMetadata.dataset_name || metadata?.filename?.replace(/\.[^/.]+$/, '') || 'dataset'}
            onChange={(e) => setEditedMetadata({...editedMetadata, dataset_name: e.target.value})}
            className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300">{error}</p>
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={() => setCurrentStep(1)}
            className="px-6 py-3 bg-gray-700 text-white rounded-xl font-semibold hover:bg-gray-600 transition-all duration-300 flex items-center gap-2"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          <button
            onClick={handleGenerateDSL}
            disabled={isLoading}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>Generating JSON...</>
            ) : (
              <>
                Generate JSON
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50">
      <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
        <FileText className="text-purple-400" />
        Step 3: Review and Edit JSON
      </h2>
      
      <div className="space-y-6">
        <p className="text-gray-300">
          Review the generated JSON. You can edit it directly if needed.
        </p>

        <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
          <textarea
            value={dslText}
            onChange={(e) => setDslText(e.target.value)}
            className="w-full h-96 px-4 py-3 bg-gray-900 text-gray-300 font-mono text-sm focus:outline-none resize-none"
            spellCheck={false}
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300">{error}</p>
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={() => setCurrentStep(2)}
            className="px-6 py-3 bg-gray-700 text-white rounded-xl font-semibold hover:bg-gray-600 transition-all duration-300 flex items-center gap-2"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          <button
            onClick={handleGeneratePySpark}
            disabled={isLoading}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>Generating PySpark Code...</>
            ) : (
              <>
                Generate PySpark Code
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50">
      <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
        <Code className="text-purple-400" />
        Step 4: PySpark Code
      </h2>
      
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-green-900/20 border border-green-700/50 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <p className="text-green-300 font-medium">PySpark code generated successfully!</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopyCode}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Copy
            </button>
            <button
              onClick={handleDownloadCode}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download .py
            </button>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
          <div className="max-h-[600px] overflow-y-auto">
            <SyntaxHighlighter
              language="python"
              style={materialDark}
              customStyle={{
                margin: 0,
                background: 'transparent',
                fontSize: '14px',
              }}
            >
              {pysparkCode}
            </SyntaxHighlighter>
          </div>
        </div>

        <button
          onClick={handleReset}
          className="w-full px-6 py-3 bg-gray-700 text-white rounded-xl font-semibold hover:bg-gray-600 transition-all duration-300"
        >
          Generate Another Dataset
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#1a1a2e] text-white">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-gray-700/50 bg-gray-900/50 backdrop-blur-sm">
        <Link
          to="/"
          className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-gray-800/50"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back to Home</span>
        </Link>
        <h1 className="text-xl font-semibold text-white">Advanced PySpark Code Generator</h1>
        <div className="w-32" /> {/* Spacer for centering */}
      </header>

      {/* Progress Steps */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center mb-12">
          {[1, 2, 3, 4].map((step) => (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-colors ${
                  currentStep >= step 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-700 text-gray-400'
                }`}>
                  {step}
                </div>
                <p className="mt-2 text-sm text-gray-400">
                  {step === 1 && 'Upload'}
                  {step === 2 && 'Review'}
                  {step === 3 && 'JSON'}
                  {step === 4 && 'Code'}
                </p>
              </div>
              {step < 4 && (
                <div className={`w-24 h-1 mx-4 transition-colors ${
                  currentStep > step ? 'bg-purple-600' : 'bg-gray-700'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Current Step Content */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </motion.div>
      </div>
    </div>
  );
};

export default AdvancedPySparkGenerator;
