import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Play, RotateCcw, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import UploadCard from '../components/accuracy/UploadCard';
import ColumnMapping from '../components/accuracy/ColumnMapping';
import ResultsPanel from '../components/accuracy/ResultsPanel';
import useDataAccuracy from '../hooks/useDataAccuracy';
import { fadeIn, staggerContainer } from '../styles/animations';

const DataAccuracy = () => {
  const {
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
    uploadFile,
    compareAndCorrect,
    downloadFile,
    reset,
    removeFile,
    setMapping,
    setOptions,
    setError
  } = useDataAccuracy();

  // Focus on page load
  useEffect(() => {
    document.title = 'Acurácia de Dados - SmartDataTest';
  }, []);

  const handleGoldFileSelect = async (file) => {
    try {
      await uploadFile(file, 'gold');
    } catch (err) {
      console.error('Error uploading GOLD file:', err);
    }
  };

  const handleTargetFileSelect = async (file) => {
    try {
      await uploadFile(file, 'target');
    } catch (err) {
      console.error('Error uploading TARGET file:', err);
    }
  };

  const handleCompare = async () => {
    try {
      await compareAndCorrect();
    } catch (err) {
      console.error('Error comparing datasets:', err);
    }
  };

  const canCompare = goldFile && targetFile && 
                     mapping.keyColumns.length > 0 && 
                     mapping.valueColumns.length > 0 &&
                     !isProcessing;

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
            <h1 className="text-xl font-semibold text-white">Acurácia de Dados (Datasets)</h1>
            <div className="w-32" /> {/* Spacer for centering */}
          </header>

          <p className="text-gray-300 text-lg mb-8">
            Compare e corrija datasets usando um dataset GOLD como referência
          </p>
        </motion.div>

        {/* Error Alert */}
        {error && (
          <motion.div
            variants={fadeIn}
            className="mb-6 bg-red-900/50 border border-red-700 rounded-xl p-4 flex items-start gap-3"
            role="alert"
          >
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-300 mb-1">Erro</h3>
              <p className="text-red-200">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-2 text-sm text-red-300 hover:text-red-200 underline"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        )}

        {/* Upload Cards */}
        <motion.div variants={fadeIn} className="grid md:grid-cols-2 gap-6 mb-6">
          <UploadCard
            role="gold"
            title="Dataset GOLD (Referência)"
            file={goldFile}
            onFileSelect={handleGoldFileSelect}
            onRemove={() => removeFile('gold')}
            preview={goldPreview}
            isLoading={isUploading}
          />
          <UploadCard
            role="target"
            title="Dataset a Validar"
            file={targetFile}
            onFileSelect={handleTargetFileSelect}
            onRemove={() => removeFile('target')}
            preview={targetPreview}
            isLoading={isUploading}
          />
        </motion.div>

        {/* Column Mapping */}
        {columns.length > 0 && (
          <motion.div variants={fadeIn} className="mb-6">
            <ColumnMapping
              columns={columns}
              mapping={mapping}
              onMappingChange={setMapping}
              options={options}
              onOptionsChange={setOptions}
            />
          </motion.div>
        )}

        {/* Action Buttons */}
        {columns.length > 0 && (
          <motion.div variants={fadeIn} className="flex gap-4 mb-8">
            <button
              onClick={handleCompare}
              disabled={!canCompare}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold text-lg shadow-lg hover:shadow-purple-500/30 transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Comparar e corrigir datasets"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Processando...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Comparar & Corrigir
                </>
              )}
            </button>
            <button
              onClick={reset}
              className="px-8 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center gap-2"
              aria-label="Limpar e reiniciar"
            >
              <RotateCcw className="w-5 h-5" />
              Limpar
            </button>
          </motion.div>
        )}

        {/* Results */}
        {results && (
          <motion.div variants={fadeIn}>
            <ResultsPanel
              summary={results.summary}
              differences={results.diffSample || []}
              downloadLinks={results.download}
              onDownload={downloadFile}
            />
          </motion.div>
        )}

        {/* Instructions */}
        {!goldFile && !targetFile && (
          <motion.div
            variants={fadeIn}
            className="mt-12 bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50"
          >
            <h3 className="text-2xl font-bold text-white mb-6">💡 Como usar</h3>
            <div className="space-y-4 text-gray-300">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center font-bold">
                  1
                </span>
                <div>
                  <strong className="text-white">Upload dos Datasets:</strong> Faça o upload do dataset GOLD (referência confiável) e do dataset a validar.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center font-bold">
                  2
                </span>
                <div>
                  <strong className="text-white">Mapeamento:</strong> Selecione as colunas chave (identificadores) e as colunas de valor (dados a comparar).
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center font-bold">
                  3
                </span>
                <div>
                  <strong className="text-white">Configuração:</strong> Ajuste as opções de normalização, tolerância numérica e política de duplicatas.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center font-bold">
                  4
                </span>
                <div>
                  <strong className="text-white">Comparação:</strong> Clique em "Comparar & Corrigir" para processar os dados.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center font-bold">
                  5
                </span>
                <div>
                  <strong className="text-white">Download:</strong> Baixe o dataset corrigido e os relatórios de diferenças.
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default DataAccuracy;
