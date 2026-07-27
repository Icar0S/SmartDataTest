import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  CheckCircle, 
  Circle, 
  HelpCircle, 
  Save, 
  Sparkles, 
  X,
  FileText,
  FileDown,
  ClipboardEdit
} from 'lucide-react';
import { apiFetch } from '../config/api';

/* eslint-disable no-undef */

const ChecklistPage = () => {
  const [template, setTemplate] = useState(null);
  const [selectedDimensionId, setSelectedDimensionId] = useState(null);
  const [marks, setMarks] = useState({});
  const [runId, setRunId] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showMetadataForm, setShowMetadataForm] = useState(false);
  const [metadata, setMetadata] = useState({
    tester_name: '',
    test_environment: '',
    browser_platform: '',
    test_duration: '',
    additional_notes: ''
  });

  // Load template on mount
  useEffect(() => {
    loadTemplate();
    createRun();
  }, []);

  const loadTemplate = async () => {
    try {
      const response = await apiFetch('/api/checklist/template');
      if (!response.ok) throw new Error('Failed to load template');
      
      const data = await response.json();
      setTemplate(data);
      
      // Select first dimension by default
      if (data.dimensions && data.dimensions.length > 0) {
        setSelectedDimensionId(data.dimensions[0].id);
      }
    } catch (err) {
      setError('Erro ao carregar checklist: ' + err.message);
    }
  };

  const createRun = async () => {
    try {
      const response = await apiFetch('/api/checklist/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'default_user', // In production, get from auth
          project_id: null
        })
      });
      
      if (!response.ok) throw new Error('Failed to create run');
      
      const data = await response.json();
      setRunId(data.id);
      
      // Load existing marks if any
      if (data.marks) {
        setMarks(data.marks);
      }
      
      // Load existing metadata if any
      if (data.metadata) {
        setMetadata(data.metadata);
      }
    } catch (err) {
      setError('Erro ao criar sessão: ' + err.message);
    }
  };

  const handleMarkToggle = (itemId, currentStatus) => {
    const newStatus = currentStatus === 'DONE' ? 'NOT_DONE' : 'DONE';
    setMarks(prev => ({
      ...prev,
      [itemId]: newStatus
    }));
  };

  const handleSaveProgress = async () => {
    if (!runId) return;
    
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const marksArray = Object.entries(marks).map(([itemId, status]) => ({
        itemId,
        status
      }));
      
      const response = await apiFetch(`/api/checklist/runs/${runId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          marks: marksArray,
          metadata: metadata
        })
      });
      
      if (!response.ok) throw new Error('Failed to save progress');
      
      setSuccessMessage('Progresso salvo com sucesso!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError('Erro ao salvar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateRecommendations = async () => {
    if (!runId || !template) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Find missing items
      const allItemIds = template.dimensions.flatMap(dim => 
        dim.items.map(item => item.id)
      );
      const missingItemIds = allItemIds.filter(id => marks[id] !== 'DONE');
      
      const response = await apiFetch(`/api/checklist/runs/${runId}/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missingItemIds })
      });
      
      if (!response.ok) throw new Error('Failed to generate recommendations');
      
      const data = await response.json();
      setRecommendations(data.recommendations);
    } catch (err) {
      setError('Erro ao gerar recomendações: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadReport = async (format) => {
    if (!runId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await apiFetch(`/api/checklist/runs/${runId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          format,
          recommendations: recommendations || []
        })
      });
      
      if (!response.ok) throw new Error('Failed to generate report');
      
      // Download file
      const blob = await response.blob();
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `checklist_report.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      globalThis.URL.revokeObjectURL(url);
      
      setSuccessMessage(`Relatório ${format.toUpperCase()} baixado com sucesso!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError('Erro ao baixar relatório: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const openManualModal = (item) => {
    setSelectedItem(item);
    setShowManualModal(true);
  };

  const closeManualModal = () => {
    setShowManualModal(false);
    setSelectedItem(null);
  };

  const openMetadataForm = () => {
    setShowMetadataForm(true);
  };

  const closeMetadataForm = () => {
    setShowMetadataForm(false);
  };

  const handleMetadataChange = (field, value) => {
    setMetadata(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveMetadata = async () => {
    await handleSaveProgress();
    setShowMetadataForm(false);
    setSuccessMessage('Informações do teste salvas com sucesso!');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const getSelectedDimension = () => {
    if (!template || !selectedDimensionId) return null;
    return template.dimensions.find(d => d.id === selectedDimensionId);
  };

  const calculateProgress = () => {
    if (!template) return 0;
    
    const totalItems = template.dimensions.reduce((sum, dim) => 
      sum + dim.items.length, 0
    );
    const doneItems = Object.values(marks).filter(status => status === 'DONE').length;
    
    return totalItems > 0 ? (doneItems / totalItems) * 100 : 0;
  };

  if (!template) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#1a1a2e]">
        <div className="text-white text-xl">Carregando checklist...</div>
      </div>
    );
  }

  const selectedDimension = getSelectedDimension();
  const progress = calculateProgress();

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#1a1a2e]">
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
        
        <h1 className="text-xl font-semibold text-white">Checklist Support QA</h1>
        
        <div className="w-24"></div>
      </header>

      {/* Progress Bar */}
      <div className="px-6 py-3 bg-gray-900/30 border-b border-gray-700/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">
            Progresso: {Math.round(progress)}%
          </span>
          <span className="text-sm text-gray-400">
            {Object.values(marks).filter(s => s === 'DONE').length} / {
              template.dimensions.reduce((sum, dim) => sum + dim.items.length, 0)
            } itens
          </span>
        </div>
        <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {successMessage && (
        <div className="mx-6 mt-4 p-3 bg-green-900/30 border border-green-700/50 rounded-lg text-green-300 flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-green-400 hover:text-green-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Panel - Dimensions */}
        <div className="w-80 border-r border-gray-700/50 bg-gray-900/20 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-white mb-4">Dimensões</h2>
            <div className="space-y-2">
              {template.dimensions.map(dimension => {
                const dimDone = dimension.items.filter(item => marks[item.id] === 'DONE').length;
                const dimTotal = dimension.items.length;
                const dimProgress = dimTotal > 0 ? (dimDone / dimTotal) * 100 : 0;
                
                return (
                  <button
                    key={dimension.id}
                    onClick={() => setSelectedDimensionId(dimension.id)}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      selectedDimensionId === dimension.id
                        ? 'bg-purple-900/30 border-purple-500/50 shadow-lg'
                        : 'bg-gray-800/30 border-gray-700/50 hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="font-medium text-white mb-2">{dimension.name}</div>
                    <div className="text-sm text-gray-400 mb-2">
                      {dimDone}/{dimTotal} concluídos
                    </div>
                    <div className="h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all"
                        style={{ width: `${dimProgress}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Panel - Items */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {selectedDimension && (
              <>
                <h2 className="text-2xl font-bold text-white mb-6">
                  {selectedDimension.name}
                </h2>
                
                <div className="space-y-3">
                  {selectedDimension.items.map(item => {
                    const status = marks[item.id];
                    const isDone = status === 'DONE';
                    
                    return (
                      <div
                        key={item.id}
                        className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-4 hover:bg-gray-800/50 transition-all min-h-[140px] flex"
                      >
                        <div className="flex items-start gap-4 w-full">
                          <button
                            onClick={() => handleMarkToggle(item.id, status)}
                            className="flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded mt-1"
                            aria-label={isDone ? 'Marcar como não feito' : 'Marcar como feito'}
                          >
                            {isDone ? (
                              <CheckCircle className="w-6 h-6 text-green-400" />
                            ) : (
                              <Circle className="w-6 h-6 text-gray-400" />
                            )}
                          </button>
                          
                          <div className="flex-1 flex flex-col justify-between min-h-full">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="text-sm text-purple-400 font-mono mb-1">
                                  {item.code}
                                </div>
                                <div className={`text-white leading-relaxed ${isDone ? 'line-through opacity-60' : ''}`}>
                                  {item.title}
                                </div>
                              </div>
                              
                              <button
                                onClick={() => openManualModal(item)}
                                className="flex-shrink-0 p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
                                aria-label="Ver manual do item"
                              >
                                <HelpCircle className="w-5 h-5" />
                              </button>
                            </div>
                            
                            <div className="text-xs text-gray-500 mt-2">
                              Prioridade: {item.priority_weight}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recommendations Panel */}
      {recommendations && recommendations.length > 0 && (
        <div className="border-t border-gray-700/50 bg-gray-900/50 p-6 max-h-80 overflow-y-auto">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Recomendações
          </h3>
          <div className="space-y-4">
            {recommendations.map((rec, idx) => (
              <div key={rec.title + idx} className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">{rec.title}</h4>
                <p className="text-gray-300 text-sm mb-2">{rec.content}</p>
                {rec.sources && rec.sources.length > 0 && (
                  <div className="text-xs text-gray-500">
                    Fontes: {rec.sources.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="border-t border-gray-700/50 bg-gray-900/50 p-4">
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={handleSaveProgress}
            disabled={isSaving || !runId}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            {isSaving ? 'Salvando...' : 'Salvar Progresso'}
          </button>
          
          <button
            onClick={openMetadataForm}
            disabled={!runId}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ClipboardEdit className="w-5 h-5" />
            Informações do Teste
          </button>
          
          <button
            onClick={handleGenerateRecommendations}
            disabled={isLoading || !runId}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-5 h-5" />
            {isLoading ? 'Gerando...' : 'Gerar Recomendações'}
          </button>
          
          <button
            onClick={() => handleDownloadReport('pdf')}
            disabled={isLoading || !runId}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="w-5 h-5" />
            Download PDF
          </button>
          
          <button
            onClick={() => handleDownloadReport('md')}
            disabled={isLoading || !runId}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="w-5 h-5" />
            Download MD
          </button>
        </div>
      </div>

      {/* Manual Modal */}
      {showManualModal && selectedItem && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          onClick={closeManualModal}
        >
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div 
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className="bg-gray-900 border border-gray-700/50 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-sm text-purple-400 font-mono mb-1">
                    {selectedItem.code}
                  </div>
                  <h3 id="modal-title" className="text-xl font-bold text-white">
                    {selectedItem.title}
                  </h3>
                </div>
                <button
                  onClick={closeManualModal}
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Fechar modal"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Manual</h4>
                  <p className="text-gray-300">{selectedItem.manual}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Referências</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.references.map((ref, idx) => (
                      <span 
                        key={ref + idx}
                        className="px-3 py-1 bg-gray-800/50 border border-gray-700/50 rounded-full text-sm text-gray-300"
                      >
                        {ref}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Prioridade</h4>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {new Array(5).fill(0).map((_, i) => (
                        <div
                          key={`priority-${selectedItem.priority_weight}-${i}`}
                          className={`w-3 h-3 rounded-full ${
                            i < selectedItem.priority_weight
                              ? 'bg-purple-500'
                              : 'bg-gray-700'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-gray-300">{selectedItem.priority_weight}/5</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metadata Form Modal */}
      {showMetadataForm && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          onClick={closeMetadataForm}
        >
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div 
            role="dialog"
            aria-modal="true"
            aria-labelledby="metadata-modal-title"
            className="bg-gray-900 border border-gray-700/50 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 id="metadata-modal-title" className="text-2xl font-bold text-white">
                    Informações do Teste
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">
                    Preencha as informações adicionais sobre a execução do teste
                  </p>
                </div>
                <button
                  onClick={closeMetadataForm}
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Fechar modal"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="tester_name" className="block text-sm font-medium text-gray-300 mb-2">
                    Nome do Testador *
                  </label>
                  <input
                    id="tester_name"
                    type="text"
                    value={metadata.tester_name}
                    onChange={(e) => handleMetadataChange('tester_name', e.target.value)}
                    placeholder="Ex: João Silva"
                    className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="test_environment" className="block text-sm font-medium text-gray-300 mb-2">
                    Ambiente de Teste *
                  </label>
                  <input
                    id="test_environment"
                    type="text"
                    value={metadata.test_environment}
                    onChange={(e) => handleMetadataChange('test_environment', e.target.value)}
                    placeholder="Ex: Produção, Homologação, Desenvolvimento"
                    className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="browser_platform" className="block text-sm font-medium text-gray-300 mb-2">
                    Navegador/Plataforma
                  </label>
                  <input
                    id="browser_platform"
                    type="text"
                    value={metadata.browser_platform}
                    onChange={(e) => handleMetadataChange('browser_platform', e.target.value)}
                    placeholder="Ex: Chrome 120 / Windows 11, Safari / macOS"
                    className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="test_duration" className="block text-sm font-medium text-gray-300 mb-2">
                    Duração do Teste
                  </label>
                  <input
                    id="test_duration"
                    type="text"
                    value={metadata.test_duration}
                    onChange={(e) => handleMetadataChange('test_duration', e.target.value)}
                    placeholder="Ex: 2 horas, 45 minutos"
                    className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="additional_notes" className="block text-sm font-medium text-gray-300 mb-2">
                    Observações Adicionais
                  </label>
                  <textarea
                    id="additional_notes"
                    value={metadata.additional_notes}
                    onChange={(e) => handleMetadataChange('additional_notes', e.target.value)}
                    placeholder="Adicione observações, problemas encontrados, ou informações relevantes sobre o teste..."
                    rows="4"
                    className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={closeMetadataForm}
                  className="px-6 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveMetadata}
                  disabled={!metadata.tester_name || !metadata.test_environment}
                  className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-5 h-5" />
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChecklistPage;
