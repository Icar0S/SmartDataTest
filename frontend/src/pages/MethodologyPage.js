import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Lightbulb, 
  FileText, 
  Database, 
  Target, 
  BarChart3,
  Brain,
  BookOpen,
  CheckCircle,
  Languages,
  ArrowDown
} from 'lucide-react';
import { fadeIn, slideIn, staggerContainer } from '../styles/animations';
import { useLanguage } from '../context/LanguageContext';

const MethodologyPage = () => {
  const { language, changeLanguage } = useLanguage();

  const translations = {
    'pt-BR': {
      backToHome: 'Voltar para Home',
      pageTitle: 'Framework Metodológico para QA em Big Data com Suporte de IA',
      pageSubtitle: 'Modelo de Processo com Camada de Suporte Inteligente Transversal',
      aiSupportTitle: 'Inteligência e Suporte à Decisão',
      knowledgeBaseTitle: 'Base de Conhecimento Aprimorada',
      knowledgeBaseDesc: 'Repositório dinâmico com documentação técnica, histórico de testes e revisão multivocal da literatura (Knowledge Retrieval / RAG)',
      llmSystemTitle: 'Sistema de Suporte Baseado em LLMs',
      llmSystemDesc: 'Interface conversacional para consulta de checklists, interpretação de regras e análise de causa raiz de falhas',
      mainWorkflowTitle: 'Fluxo Principal - Ciclo de Vida de QA',
      phase: 'Fase',
      input: 'Entrada',
      processA: 'Processo A',
      processB: 'Processo B',
      output: 'Saída',
      aiSupport: 'Suporte IA',
      qualityDimensionsTitle: 'Dimensões de Qualidade de Dados',
      frameworkNote: 'Framework aplicável a dados estruturados e semi-estruturados em ambientes de processamento distribuído',
      footerText: '© 2024-2026 - Framework de Pesquisa Acadêmica. Todos os direitos reservados aos pesquisadores.',
      phases: [
        {
          title: 'Planejamento e Definição Estratégica',
          entrada: 'Requisitos de Negócio e Governança',
          processoA: 'Definição de Metas e Critérios de Aceite',
          processoB: 'Modelagem do Cenário de Teste',
          saida: 'Plano de Testes, Regras de Validação e Checklist de QA',
          suporteIA: 'Sugestão de regras de validação baseadas em histórico ou padrões da indústria'
        },
        {
          title: 'Mapeamento e Preparação de Fontes',
          entrada: 'Plano de Testes aprovado',
          processoA: 'Inventário e Mapeamento de Metadados',
          processoB: 'Definição de Políticas de Tratamento (LGPD)',
          saida: 'Catálogos de Dados Mapeados e Matriz De-Para',
          suporteIA: 'Identificação automática de padrões e anomalias nos metadados'
        },
        {
          title: 'Geração e Execução de Cenários',
          entrada: 'Fontes de Dados Mapeadas',
          processoA: 'Geração de Dados Sintéticos Realistas',
          processoB: 'Execução do Motor de Validação em Big Data',
          saida: 'Logs de Execução e Datasets Validados',
          suporteIA: 'Auxílio na criação de prompts para gerar dados sintéticos complexos'
        },
        {
          title: 'Análise de Resultados e Monitoramento',
          entrada: 'Datasets Processados',
          processoA: 'Cálculo de Indicadores de Qualidade',
          processoB: 'Análise Comparativa (Gold vs. Target)',
          saida: 'Relatórios Analíticos, Dashboards e Recomendações',
          suporteIA: 'Interpretação de relatórios e sugestão de correções para falhas detectadas'
        }
      ],
      qualityDimensions: [
        { name: 'Completude', description: 'Presença de todos os dados necessários' },
        { name: 'Unicidade', description: 'Ausência de duplicações indevidas' },
        { name: 'Consistência', description: 'Uniformidade entre sistemas' },
        { name: 'Validade', description: 'Conformidade com regras de negócio' },
        { name: 'Integridade', description: 'Manutenção de relacionamentos' },
        { name: 'Acurácia', description: 'Precisão e correção dos valores' }
      ]
    },
    'en-US': {
      backToHome: 'Back to Home',
      pageTitle: 'Methodological Framework for QA in Big Data with AI Support',
      pageSubtitle: 'Process Model with Transversal Intelligent Support Layer',
      aiSupportTitle: 'Intelligence and Decision Support',
      knowledgeBaseTitle: 'Enhanced Knowledge Base',
      knowledgeBaseDesc: 'Dynamic repository with technical documentation, test history, and multivocal literature review (Knowledge Retrieval / RAG)',
      llmSystemTitle: 'LLM-Based Support System',
      llmSystemDesc: 'Conversational interface for checklist queries, rule interpretation, and root cause analysis of failures',
      mainWorkflowTitle: 'Main Workflow - QA Lifecycle',
      phase: 'Phase',
      input: 'Input',
      processA: 'Process A',
      processB: 'Process B',
      output: 'Output',
      aiSupport: 'AI Support',
      qualityDimensionsTitle: 'Data Quality Dimensions',
      frameworkNote: 'Framework applicable to structured and semi-structured data in distributed processing environments',
      footerText: '© 2024-2026 - Academic Research Framework. All rights reserved to the researchers.',
      phases: [
        {
          title: 'Planning and Strategic Definition',
          entrada: 'Business Requirements and Governance',
          processoA: 'Definition of Goals and Acceptance Criteria',
          processoB: 'Test Scenario Modeling',
          saida: 'Test Plan, Validation Rules and QA Checklist',
          suporteIA: 'Suggestion of validation rules based on history or industry standards'
        },
        {
          title: 'Source Mapping and Preparation',
          entrada: 'Approved Test Plan',
          processoA: 'Metadata Inventory and Mapping',
          processoB: 'Definition of Treatment Policies (GDPR)',
          saida: 'Mapped Data Catalogs and Mapping Matrix',
          suporteIA: 'Automatic identification of patterns and anomalies in metadata'
        },
        {
          title: 'Scenario Generation and Execution',
          entrada: 'Mapped Data Sources',
          processoA: 'Realistic Synthetic Data Generation',
          processoB: 'Execution of Big Data Validation Engine',
          saida: 'Execution Logs and Validated Datasets',
          suporteIA: 'Assistance in creating prompts to generate complex synthetic data'
        },
        {
          title: 'Results Analysis and Monitoring',
          entrada: 'Processed Datasets',
          processoA: 'Quality Indicators Calculation',
          processoB: 'Comparative Analysis (Gold vs. Target)',
          saida: 'Analytical Reports, Dashboards and Recommendations',
          suporteIA: 'Report interpretation and suggestion of corrections for detected failures'
        }
      ],
      qualityDimensions: [
        { name: 'Completeness', description: 'Presence of all necessary data' },
        { name: 'Uniqueness', description: 'Absence of improper duplications' },
        { name: 'Consistency', description: 'Uniformity across systems' },
        { name: 'Validity', description: 'Compliance with business rules' },
        { name: 'Integrity', description: 'Maintenance of relationships' },
        { name: 'Accuracy', description: 'Precision and correctness of values' }
      ]
    }
  };

  const t = translations[language];

  const phasesWithIcons = [
    {
      number: 1,
      icon: FileText,
      iconColor: 'text-blue-400'
    },
    {
      number: 2,
      icon: Database,
      iconColor: 'text-green-400'
    },
    {
      number: 3,
      icon: Target,
      iconColor: 'text-purple-400'
    },
    {
      number: 4,
      icon: BarChart3,
      iconColor: 'text-orange-400'
    }
  ];

  return (
    <motion.div
      initial="initial"
      animate="animate"
      className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#1a1a2e] text-white overflow-x-hidden"
    >
      {/* Header */}
      <motion.div
        variants={fadeIn}
        className="relative pt-8 pb-6 px-6"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-start mb-6">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-purple-300 hover:text-purple-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              {t.backToHome}
            </Link>

            {/* Language Toggle Button */}
            <div className="flex items-center gap-2 bg-gray-800/50 backdrop-blur-sm rounded-lg p-1 border border-gray-700/50">
              <button
                onClick={() => changeLanguage('pt-BR')}
                className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 ${
                  language === 'pt-BR'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Languages className="w-4 h-4" />
                PT-BR
              </button>
              <button
                onClick={() => changeLanguage('en-US')}
                className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 ${
                  language === 'en-US'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Languages className="w-4 h-4" />
                EN-US
              </button>
            </div>
          </div>

          <motion.h1
            variants={slideIn}
            className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600"
          >
            {t.pageTitle}
          </motion.h1>
          <motion.p
            variants={fadeIn}
            className="text-lg md:text-xl text-purple-300"
          >
            {t.pageSubtitle}
          </motion.p>
        </div>
      </motion.div>

      {/* AI Support Layer */}
      <motion.div
        variants={fadeIn}
        className="max-w-7xl mx-auto px-6 mb-8"
      >
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 shadow-2xl border border-blue-500/30">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-white/20 p-3 rounded-lg">
              <Lightbulb className="w-8 h-8 text-yellow-300" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold">
              {t.aiSupportTitle}
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Base de Conhecimento */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="flex items-center gap-3 mb-4">
                <BookOpen className="w-6 h-6 text-blue-200" />
                <h3 className="text-xl font-semibold text-center">{t.knowledgeBaseTitle}</h3>
              </div>
              <p className="text-blue-100 text-sm leading-relaxed text-center">
                {t.knowledgeBaseDesc}
              </p>
            </div>

            {/* Sistema LLM */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="flex items-center gap-3 mb-4">
                <Brain className="w-6 h-6 text-purple-200" />
                <h3 className="text-xl font-semibold text-center">{t.llmSystemTitle}</h3>
              </div>
              <p className="text-blue-100 text-sm leading-relaxed text-center">
                {t.llmSystemDesc}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Workflow - 4 Phases */}
      <motion.div
        variants={staggerContainer}
        className="max-w-7xl mx-auto px-6 mb-8"
      >
        <h2 className="text-3xl font-bold mb-8 text-center">
          {t.mainWorkflowTitle}
        </h2>

        <div className="space-y-6">
          {t.phases.map((phase, index) => {
            const phaseIcon = phasesWithIcons[index];
            const PhaseIcon = phaseIcon.icon;
            return (
              <motion.div
                key={`phase-${phaseIcon.number}-${phase.title}`}
                variants={fadeIn}
                className="relative"
              >
                {/* Phase Card */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-700/50">
                  {/* Phase Header */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-full px-4 py-2 text-sm font-bold">
                      {t.phase} {phaseIcon.number}
                    </div>
                    <div className={`${phaseIcon.iconColor}`}>
                      <PhaseIcon className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-bold flex-1">{phase.title}</h3>
                  </div>

                  {/* Phase Content */}
                  <div className="grid md:grid-cols-3 gap-4">
                    {/* Entrada */}
                    <div className="bg-white/5 rounded-xl p-4 border border-gray-600">
                      <div className="text-xs font-semibold text-gray-400 uppercase mb-2 text-center">
                        {t.input}
                      </div>
                      <p className="text-sm text-gray-200 text-center">{phase.entrada}</p>
                    </div>

                    {/* Processos */}
                    <div className="space-y-3">
                      <div className="bg-blue-500/20 rounded-xl p-4 border border-blue-500/30">
                        <div className="text-xs font-semibold text-blue-300 uppercase mb-2 text-center">
                          {t.processA}
                        </div>
                        <p className="text-sm text-gray-200 text-center">{phase.processoA}</p>
                      </div>
                      <div className="bg-blue-500/20 rounded-xl p-4 border border-blue-500/30">
                        <div className="text-xs font-semibold text-blue-300 uppercase mb-2 text-center">
                          {t.processB}
                        </div>
                        <p className="text-sm text-gray-200 text-center">{phase.processoB}</p>
                      </div>
                    </div>

                    {/* Saída */}
                    <div className="bg-white/5 rounded-xl p-4 border-2 border-green-500/50">
                      <div className="text-xs font-semibold text-green-400 uppercase mb-2 flex items-center justify-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        {t.output}
                      </div>
                      <p className="text-sm text-gray-200 text-center">{phase.saida}</p>
                    </div>
                  </div>

                  {/* AI Support Box */}
                  <div className="mt-4 bg-blue-500/10 rounded-xl p-4 border border-blue-500/30">
                    <div className="flex items-start gap-3">
                      <Brain className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-blue-400 uppercase mb-1 text-center">
                          {t.aiSupport}
                        </div>
                        <p className="text-sm text-blue-200 text-center">{phase.suporteIA}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrow to next phase */}
                {index < t.phases.length - 1 && (
                  <div className="flex justify-center my-4">
                    <ArrowDown className="w-6 h-6 text-purple-400" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Quality Dimensions */}
      <motion.div
        variants={fadeIn}
        className="max-w-7xl mx-auto px-6 mb-8"
      >
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-gray-700/50">
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">
            {t.qualityDimensionsTitle}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {t.qualityDimensions.map((dimension) => (
              <motion.div
                key={`dimension-${dimension.name}`}
                variants={fadeIn}
                className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl p-6 border border-purple-500/30 hover:border-purple-400/50 transition-all"
              >
                <h3 className="text-lg font-bold mb-2 text-purple-300 text-center">
                  {dimension.name}
                </h3>
                <p className="text-sm text-gray-300 text-center">
                  {dimension.description}
                </p>
              </motion.div>
            ))}
          </div>

          <div className="mt-6 text-center text-sm text-gray-400 italic">
            {t.frameworkNote}
          </div>
        </div>
      </motion.div>

      {/* Footer */}
      <motion.div
        variants={fadeIn}
        className="max-w-7xl mx-auto px-6 pb-12"
      >
        <div className="text-center text-gray-400 text-sm">
          <p className="font-semibold">
            {t.footerText}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MethodologyPage;
