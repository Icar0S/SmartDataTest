import React, { useState } from 'react';
import { Zap, Code, Bug, CheckCircle, AlertTriangle, FileText, GitCompare, Sparkles, Brain, TrendingUp, Shield, Clock, Globe, BarChart3, MessageSquare, Eye, GitBranch, LogOut, Heart } from 'lucide-react';
import RAGButton from './RAGButton';
import DataAccuracyDropdown from './DataAccuracyDropdown';
import PySparkDropdown from './PySparkDropdown';
import LanguageToggle from './LanguageToggle';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeIn, staggerContainer, slideIn, scaleIn } from '../styles/animations';
import { useAuthContext } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import useAuth from '../hooks/useAuth';

const DataQualityLLMSystem = () => {
  const [selectedStructure, setSelectedStructure] = useState('synthetic');
  const [selectedFeature, setSelectedFeature] = useState('dataQuality');

  const { user } = useAuthContext();
  const { language } = useLanguage();
  const { handleLogout } = useAuth();

  // ---------------------------------------------------------------------------
  // Translations
  // ---------------------------------------------------------------------------
  const translations = {
    'pt-BR': {
      navHome: 'Home',
      navMethodology: 'Metodologia',
      navChecklist: 'Checklist QA',
      logout: 'Sair',
      heroTitle: 'DataForgeTest\nTestes de Qualidade para Big Data',
      heroSubtitle: 'Testes avançados de qualidade com métricas, suporte LLM + RAG e\ngeração automatizada de código PySpark',
      btnChecklist: 'Checklist Support QA',
      btnGenerate: 'Gerar Dataset',
      btnMethodology: 'Metodologia',
      sectionStructures: 'Estruturas de Dados',
      sectionWorkflow: 'Fluxo de Trabalho LLM',
      sectionProblems: 'Cenários de Qualidade de Dados',
      sectionTips: 'Diretrizes de Implementação',
      sectionFuture: 'Roadmap de Funcionalidades Futuras',
      footerCopyright: '© 2026 DataForgeTest. Todos os direitos reservados.',
      footerRights: 'Plataforma de Automação de Qualidade de Dados para Big Data com LLM + RAG.',
      footerBuiltWith: 'Desenvolvido com',
      footerTech: 'React · Python · PySpark · LLM · RAG',
    },
    'en-US': {
      navHome: 'Home',
      navMethodology: 'Methodology',
      navChecklist: 'QA Checklist',
      logout: 'Logout',
      heroTitle: 'DataForgeTest\nBig Data Quality Testing',
      heroSubtitle: 'Advanced data quality testing with metrics, LLM + RAG support, and\nautomated PySpark code generation',
      btnChecklist: 'Checklist Support QA',
      btnGenerate: 'Generate Dataset',
      btnMethodology: 'Methodology',
      sectionStructures: 'Data Structures',
      sectionWorkflow: 'LLM Workflow',
      sectionProblems: 'Data Quality Scenarios',
      sectionTips: 'Implementation Guidelines',
      sectionFuture: 'Future Features Roadmap',
      footerCopyright: '© 2026 DataForgeTest. All rights reserved.',
      footerRights: 'Data Quality Automation Platform for Big Data with LLM + RAG.',
      footerBuiltWith: 'Built with',
      footerTech: 'React · Python · PySpark · LLM · RAG',
    },
  };
  const t = translations[language] ?? translations['en-US'];

  // ---------------------------------------------------------------------------
  // HomeHeader — internal component
  // ---------------------------------------------------------------------------
  const HomeHeader = () => (
    <header className="sticky top-0 z-50 w-full border-b border-gray-700/50 bg-gray-900/80 backdrop-blur-md">
      <div className="flex items-center justify-between px-6 py-3 max-w-7xl mx-auto">
        {/* Left — Logo */}
        <span className="text-lg font-bold">
          <span className="text-white">⚡ </span>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">
            DataForgeTest
          </span>
        </span>

        {/* Centre — Nav links (visible md+) */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <span className="text-purple-400 font-medium">{t.navHome}</span>
          <Link to="/methodology" className="text-gray-400 hover:text-white transition-colors">
            {t.navMethodology}
          </Link>
          <Link to="/checklist" className="text-gray-400 hover:text-white transition-colors">
            {t.navChecklist}
          </Link>
          <Link to="/generate-dataset" className="text-gray-400 hover:text-white transition-colors">
            {t.navGenerate}
          </Link>
        </nav>

        {/* Right — User area */}
        <div className="flex items-center gap-3">
          <LanguageToggle size="sm" />
          <div className="w-px h-6 bg-gray-700" />
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.avatar || '?'}
          </div>
          <span className="text-sm font-medium text-white hidden md:block">{user?.name}</span>
          <button
            onClick={handleLogout}
            title={t.logout}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );

  // ---------------------------------------------------------------------------
  // HomeFooter — internal component
  // ---------------------------------------------------------------------------
  const HomeFooter = () => (
    <footer className="mt-12 border-t border-gray-700/50 bg-gray-900/70 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Shield className="w-4 h-4 text-purple-500" />
            <span className="font-semibold text-gray-300">DataForgeTest</span>
            <span className="text-gray-600">·</span>
            <span>{t.footerCopyright}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <span>{t.footerBuiltWith}</span>
            <Heart className="w-3 h-3 text-pink-600 fill-pink-600" />
            <span className="font-mono text-gray-500">{t.footerTech}</span>
          </div>
          <span className="text-xs text-gray-600 font-mono">v1.0.0 · 2026</span>
        </div>
        <p className="mt-2 text-center text-xs text-gray-600">{t.footerRights}</p>
      </div>
    </footer>
  );

  const structures = {
    synthetic: {
      title: 'SyntheticDataset',
      icon: Zap,
      color: 'bg-purple-500',
      description: 'Synthetic dataset generated by LLM with deliberate anomalies',
      fields: [
        { name: 'dataset_id', type: 'UUID', desc: 'Unique dataset identifier' },
        { name: 'schema', type: 'Map<String, DataType>', desc: 'Data schema (field_name → type)' },
        { name: 'data', type: 'List<Map<String, Any>>', desc: 'Dataset records (JSON/Dict format)' },
        { name: 'row_count', type: 'Integer', desc: 'Total generated rows' },
        { name: 'generation_prompt', type: 'String', desc: 'Prompt used to generate the dataset' },
        { name: 'created_at', type: 'Timestamp', desc: 'When it was generated' }
      ]
    },
    problems: {
      title: 'ExpectedProblems',
      icon: Bug,
      color: 'bg-red-500',
      description: 'Documentation of LLM-injected data quality issues',
      fields: [
        { name: 'dataset_id', type: 'UUID', desc: 'Dataset reference' },
        { name: 'problems', type: 'List<Problem>', desc: 'List of injected problems' },
        { name: 'total_issues', type: 'Integer', desc: 'Total problem count' },
        { name: 'issue_distribution', type: 'Map<ProblemType, Integer>', desc: 'Count by type' },
        { name: 'description', type: 'String', desc: 'General problem description' }
      ]
    },
    problem: {
      title: 'Problem',
      icon: AlertTriangle,
      color: 'bg-orange-500',
      description: 'Details of a specific injected data quality issue',
      fields: [
        { name: 'problem_id', type: 'UUID', desc: 'Problem ID' },
        { name: 'problem_type', type: 'Enum', desc: 'NULL_VALUE, DUPLICATE, OUT_OF_RANGE, INVALID_FORMAT, INCONSISTENT, MISSING_FK, WRONG_TYPE' },
        { name: 'field_name', type: 'String', desc: 'Affected field' },
        { name: 'affected_rows', type: 'List<Integer>', desc: 'Row indices with problem' },
        { name: 'description', type: 'String', desc: 'Problem description' },
        { name: 'severity', type: 'Enum', desc: 'CRITICAL, HIGH, MEDIUM, LOW' },
        { name: 'expected_detection', type: 'String', desc: 'How it should be detected' }
      ]
    },
    pysparkcode: {
      title: 'GeneratedPySparkCode',
      icon: Code,
      color: 'bg-blue-500',
      description: 'PySpark code generated by second LLM for validation',
      fields: [
        { name: 'code_id', type: 'UUID', desc: 'Generated code ID' },
        { name: 'dataset_id', type: 'UUID', desc: 'Target dataset' },
        { name: 'source_code', type: 'String', desc: 'Complete PySpark code' },
        { name: 'validation_functions', type: 'List<String>', desc: 'Created validation functions' },
        { name: 'generation_prompt', type: 'String', desc: 'Prompt used to generate the code' },
        { name: 'created_at', type: 'Timestamp', desc: 'When it was generated' },
        { name: 'dependencies', type: 'List<String>', desc: 'Required libraries' }
      ]
    },
    validationlog: {
      title: 'ValidationLog',
      icon: FileText,
      color: 'bg-green-500',
      description: 'Execution logs from PySpark validation',
      fields: [
        { name: 'execution_id', type: 'UUID', desc: 'Execution ID' },
        { name: 'dataset_id', type: 'UUID', desc: 'Validated dataset' },
        { name: 'code_id', type: 'UUID', desc: 'Executed code' },
        { name: 'detected_issues', type: 'List<DetectedIssue>', desc: 'Detected problems' },
        { name: 'execution_time_ms', type: 'Long', desc: 'Execution time' },
        { name: 'total_rows_processed', type: 'Long', desc: 'Processed rows' },
        { name: 'status', type: 'Enum', desc: 'SUCCESS, FAILED, PARTIAL' },
        { name: 'raw_logs', type: 'String', desc: 'Complete execution logs' }
      ]
    },
    detectedissue: {
      title: 'DetectedIssue',
      icon: AlertTriangle,
      color: 'bg-yellow-500',
      description: 'Issue detected by PySpark validation code',
      fields: [
        { name: 'issue_id', type: 'UUID', desc: 'Detected problem ID' },
        { name: 'issue_type', type: 'String', desc: 'Type identified by code' },
        { name: 'field_name', type: 'String', desc: 'Problematic field' },
        { name: 'affected_rows', type: 'List<Integer>', desc: 'Found affected rows' },
        { name: 'description', type: 'String', desc: 'Description generated by code' },
        { name: 'severity', type: 'String', desc: 'Detected severity' },
        { name: 'detection_method', type: 'String', desc: 'Method used to detect' }
      ]
    },
    comparison: {
      title: 'ComparisonResult',
      icon: GitCompare,
      color: 'bg-teal-500',
      description: 'Analysis: expected vs detected issues',
      fields: [
        { name: 'comparison_id', type: 'UUID', desc: 'Comparison ID' },
        { name: 'dataset_id', type: 'UUID', desc: 'Tested dataset' },
        { name: 'true_positives', type: 'Integer', desc: 'Correctly detected problems' },
        { name: 'false_positives', type: 'Integer', desc: 'False alarms' },
        { name: 'false_negatives', type: 'Integer', desc: 'Undetected problems' },
        { name: 'precision', type: 'Float', desc: 'TP / (TP + FP)' },
        { name: 'recall', type: 'Float', desc: 'TP / (TP + FN)' },
        { name: 'f1_score', type: 'Float', desc: 'Harmonic metric' },
        { name: 'matching_details', type: 'List<Match>', desc: 'Details of each match' }
      ]
    },
    match: {
      title: 'Match',
      icon: CheckCircle,
      color: 'bg-emerald-500',
      description: 'Match between expected and detected issues',
      fields: [
        { name: 'expected_problem_id', type: 'UUID', desc: 'Expected problem ID' },
        { name: 'detected_issue_id', type: 'UUID', desc: 'Detected issue ID' },
        { name: 'match_type', type: 'Enum', desc: 'EXACT, PARTIAL, NONE' },
        { name: 'field_match', type: 'Boolean', desc: 'Field matched?' },
        { name: 'type_match', type: 'Boolean', desc: 'Type matched?' },
        { name: 'rows_overlap', type: 'Float', desc: '% row overlap' },
        { name: 'confidence_score', type: 'Float', desc: 'Match confidence (0-1)' }
      ]
    }
  };

  const futureFeatures = {
    dataQuality: {
      title: 'Data Quality & Validation',
      icon: Shield,
      color: 'bg-blue-600',
      description: 'Advanced data quality validation with intelligent schema evolution and semantic scoring',
      features: [
        { name: 'Intelligent Schema Evolution Detection', desc: 'Use LLMs to automatically detect and suggest adaptations when data schemas evolve over time' },
        { name: 'Semantic Data Quality Scoring', desc: 'Implement a comprehensive scoring system that evaluates data beyond syntactic checks, detecting semantic inconsistencies using domain knowledge embedded in your RAG system' },
        { name: 'Auto-Generated Test Data', desc: 'Create realistic synthetic test datasets based on production data patterns while preserving privacy constraints' }
      ]
    },
    performance: {
      title: 'Performance & Scale Testing',
      icon: TrendingUp,
      color: 'bg-green-600',
      description: 'Distributed load simulation and resource optimization for big data systems',
      features: [
        { name: 'Distributed Load Simulation', desc: 'Build automated test scenarios that simulate variable workloads across distributed nodes with configurable failure patterns' },
        { name: 'Resource Utilization Predictor', desc: 'Use historical test results to predict resource needs for new data pipelines before deployment' },
        { name: 'Elastic Scaling Test Harness', desc: 'Test how systems respond to dynamic resource allocation and deallocation in cloud environments' }
      ]
    },
    mlAnalytics: {
      title: 'ML & Analytics Testing',
      icon: Brain,
      color: 'bg-purple-600',
      description: 'Machine learning model validation with drift detection and explainable results',
      features: [
        { name: 'Model Drift Early Warning System', desc: 'Continuously monitor production data against training data distributions to predict model performance issues before they occur' },
        { name: 'Explainable Test Results', desc: 'Use LLMs to generate natural language explanations of why certain tests failed, with recommended actions' },
        { name: 'Golden Dataset Repository', desc: 'Maintain versioned reference datasets for regression testing with automatic updates when approved data changes occur' }
      ]
    },
    streaming: {
      title: 'Streaming & Real-time',
      icon: Clock,
      color: 'bg-orange-600',
      description: 'Real-time data processing validation with temporal testing and chaos engineering',
      features: [
        { name: 'Temporal Testing Framework', desc: 'Test time-windowed operations with artificially accelerated or decelerated time flows to identify edge cases' },
        { name: 'Chaos Engineering Module', desc: 'Inject failures, network partitions, and latency into streaming systems to verify resilience' },
        { name: 'Event Ordering Validator', desc: 'Verify that event processing maintains causal relationships and correctly handles out-of-order events' }
      ]
    },
    integration: {
      title: 'Integration & Heterogeneity',
      icon: Globe,
      color: 'bg-teal-600',
      description: 'Cross-system consistency checking and automated contract testing',
      features: [
        { name: 'Contract Testing Automation', desc: 'Automatically generate and maintain API contracts from observed data flows, flagging violations' },
        { name: 'Format Conversion Validator', desc: 'Verify data integrity across format conversions with special attention to edge cases like timezone handling, decimals, etc.' },
        { name: 'Cross-system Consistency Checker', desc: 'Track data lineage across heterogeneous systems to ensure consistency throughout the data lifecycle' }
      ]
    },
    dashboard: {
      title: 'Dashboard & Visualization',
      icon: BarChart3,
      color: 'bg-pink-600',
      description: 'Interactive dashboards with adaptive thresholds and pipeline health monitoring',
      features: [
        { name: 'Adaptive Test Threshold Dashboard', desc: 'Interactive dashboards showing historical test results with LLM-suggested threshold adjustments' },
        { name: 'Data Pipeline Health Map', desc: 'Visual representation of end-to-end pipeline health with drill-down capabilities to pinpoint issues' },
        { name: 'Test Coverage Analyzer', desc: 'Visually identify undertested components of your data pipeline based on complexity and importance metrics' }
      ]
    },
    llmRag: {
      title: 'LLM & RAG Features',
      icon: MessageSquare,
      color: 'bg-indigo-600',
      description: 'Context-aware testing with natural language specifications and anomaly explanations',
      features: [
        { name: 'Context-Aware Test Generation', desc: 'Leverage your RAG system to automatically generate test cases based on business context and historical issues' },
        { name: 'Natural Language Test Specification', desc: 'Allow users to define tests in natural language, which your system translates into executable test code' },
        { name: 'Anomaly Explanation Generator', desc: 'When anomalies are detected, use LLMs to generate human-readable explanations of potential causes' }
      ]
    },
    monitoring: {
      title: 'Advanced Monitoring',
      icon: Eye,
      color: 'bg-red-600',
      description: 'Intelligent monitoring with predictive analytics and automated alerting',
      features: [
        { name: 'Predictive Failure Detection', desc: 'Use machine learning to predict system failures before they occur based on historical patterns' },
        { name: 'Smart Alert Correlation', desc: 'Correlate multiple alerts to identify root causes and reduce notification noise' },
        { name: 'Automated Remediation Suggestions', desc: 'Provide actionable remediation steps based on similar historical incidents' }
      ]
    }
  };

  const StructureIcon = structures[selectedStructure].icon;
  const FeatureIcon = futureFeatures[selectedFeature].icon;

  return (
    <motion.div 
      initial="initial"
      animate="animate"
      className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#1a1a2e] text-white overflow-x-hidden"
    >
      {/* Header */}
      <HomeHeader />

      {/* Hero Section */}
      <motion.div 
        variants={fadeIn}
        className="relative pt-20 pb-32 px-6"
      >
        <div className="max-w-7xl mx-auto text-center">
          <motion.h1 
            variants={slideIn}
            className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 whitespace-pre-line"
          >
            {t.heroTitle}
          </motion.h1>
          <motion.p 
            variants={fadeIn}
            className="text-xl md:text-2xl text-purple-300 mb-8 whitespace-pre-line"
          >
            {t.heroSubtitle}
          </motion.p>
          <div className="flex gap-4 justify-center flex-wrap">
            <motion.div
              variants={scaleIn}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <PySparkDropdown />
            </motion.div>
            <motion.div
              variants={scaleIn}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                to="/checklist"
                className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl font-semibold text-lg shadow-lg hover:shadow-indigo-500/30 transition-all duration-300 flex items-center gap-2"
                aria-label="Checklist Support QA"
              >
                <CheckCircle className="w-5 h-5" />
                {t.btnChecklist}
              </Link>
            </motion.div>
            <motion.div
              variants={scaleIn}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <DataAccuracyDropdown />
            </motion.div>
            <motion.div
              variants={scaleIn}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                to="/generate-dataset"
                className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl font-semibold text-lg shadow-lg hover:shadow-emerald-500/30 transition-all duration-300 flex items-center gap-2"
                aria-label="Generate Synthetic Dataset"
              >
                <Sparkles className="w-5 h-5" />
                {t.btnGenerate}
              </Link>
            </motion.div>
            <motion.div
              variants={scaleIn}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                to="/methodology"
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl font-semibold text-lg shadow-lg hover:shadow-blue-500/30 transition-all duration-300 flex items-center gap-2"
                aria-label="Methodology Framework"
              >
                <GitBranch className="w-5 h-5" />
                {t.btnMethodology}
              </Link>
            </motion.div>
            <RAGButton />
          </div>
        </div>

        {/* Floating Badges */}
        <div className="absolute top-40 left-10 animate-float-slow">
          <div className="bg-purple-900/30 backdrop-blur-sm p-3 rounded-lg border border-purple-700/30">
            <Bug className="w-6 h-6 text-purple-400" />
          </div>
        </div>
        <div className="absolute top-60 right-20 animate-float-slower">
          <div className="bg-pink-900/30 backdrop-blur-sm p-3 rounded-lg border border-pink-700/30">
            <Code className="w-6 h-6 text-pink-400" />
          </div>
        </div>
      </motion.div>

      {/* Navigation */}
      <motion.div 
        variants={staggerContainer}
        className="max-w-7xl mx-auto px-6 mb-12"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(structures).map(([key, struct]) => {
            const Icon = struct.icon;
            return (
              <motion.button
                key={key}
                variants={fadeIn}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setSelectedStructure(key)}
                className={`p-6 rounded-xl transition-all ${
                  selectedStructure === key
                    ? `${struct.color} shadow-lg shadow-purple-500/20`
                    : 'bg-gray-800/50 hover:bg-gray-800 border border-gray-700'
                }`}
              >
                <Icon className="w-8 h-8 text-white mx-auto mb-3" />
                <div className="text-sm font-medium text-center">
                  {struct.title}
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Selected Structure Details */}
      <motion.div 
        variants={fadeIn}
        className="max-w-7xl mx-auto px-6"
      >
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-gray-700/50">
          <div className="flex items-start gap-6 mb-8">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className={`p-4 rounded-xl ${structures[selectedStructure].color}`}
            >
              <StructureIcon className="w-12 h-12 text-white" />
            </motion.div>
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">
                {structures[selectedStructure].title}
              </h2>
              <p className="text-purple-300 text-lg">
                {structures[selectedStructure].description}
              </p>
            </div>
          </div>

          <motion.div 
            variants={staggerContainer}
            className="space-y-4"
          >
            {structures[selectedStructure].fields.map((field, idx) => (
              <motion.div
                key={field.name}
                variants={fadeIn}
                whileHover={{ scale: 1.01 }}
                className="bg-gray-900/50 rounded-xl p-6 hover:bg-gray-900/70 transition-colors border border-gray-700/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <code className="text-purple-400 font-mono font-semibold text-lg">
                        {field.name}
                      </code>
                      <span className="px-3 py-1 bg-gray-800 rounded-full text-xs font-medium text-emerald-400 border border-emerald-900/30">
                        {field.type}
                      </span>
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      {field.desc}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Workflow Section */}
        <motion.div 
          variants={fadeIn}
          className="mt-12 bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50"
        >
          <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
            <Zap className="text-yellow-400" />
            {t.sectionWorkflow}
          </h3>
          <div className="space-y-8">
            <motion.div 
              variants={slideIn}
              className="flex items-start gap-6"
            >
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl w-14 h-14 flex items-center justify-center flex-shrink-0 text-white font-bold text-xl shadow-lg shadow-purple-500/20">
                1
              </div>
              <div className="flex-1">
                <h4 className="text-xl font-bold text-white mb-2">LLM 1: Dataset Generation</h4>
                <p className="text-gray-300">
                  Generates <code className="text-purple-400 font-mono">SyntheticDataset</code> with{' '}
                  <code className="text-red-400 font-mono ml-1">ExpectedProblems</code> documenting each injected anomaly
                </p>
              </div>
            </motion.div>

            <motion.div 
              variants={slideIn}
              className="flex items-start gap-6"
            >
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl w-14 h-14 flex items-center justify-center flex-shrink-0 text-white font-bold text-xl shadow-lg shadow-blue-500/20">
                2
              </div>
              <div className="flex-1">
                <h4 className="text-xl font-bold text-white mb-2">LLM 2: Code Generation</h4>
                <p className="text-gray-300">
                  Analyzes dataset and generates <code className="text-blue-400 font-mono">GeneratedPySparkCode</code> for comprehensive data quality validation
                </p>
              </div>
            </motion.div>

            <motion.div 
              variants={slideIn}
              className="flex items-start gap-6"
            >
              <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl w-14 h-14 flex items-center justify-center flex-shrink-0 text-white font-bold text-xl shadow-lg shadow-green-500/20">
                3
              </div>
              <div className="flex-1">
                <h4 className="text-xl font-bold text-white mb-2">Execution & Analytics</h4>
                <p className="text-gray-300">
                  Executes PySpark analysis, generating <code className="text-green-400 font-mono">ValidationLog</code> with{' '}
                  <code className="text-yellow-400 font-mono ml-1">DetectedIssue</code> for each identified anomaly
                </p>
              </div>
            </motion.div>

            <motion.div 
              variants={slideIn}
              className="flex items-start gap-6"
            >
              <div className="bg-gradient-to-r from-teal-500 to-teal-600 rounded-xl w-14 h-14 flex items-center justify-center flex-shrink-0 text-white font-bold text-xl shadow-lg shadow-teal-500/20">
                4
              </div>
              <div className="flex-1">
                <h4 className="text-xl font-bold text-white mb-2">Evaluation & Metrics</h4>
                <p className="text-gray-300">
                  Evaluates <code className="text-red-400 font-mono">ExpectedProblems</code> against{' '}
                  <code className="text-yellow-400 font-mono ml-1">DetectedIssues</code>, producing{' '}
                  <code className="text-teal-400 font-mono ml-1">ComparisonResult</code> with precision/recall metrics
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Problem Types Section */}
        <motion.div 
          variants={fadeIn}
          className="mt-12 bg-gradient-to-r from-purple-900/50 to-pink-900/50 backdrop-blur-sm rounded-2xl p-8 border border-purple-700/50"
        >
          <h3 className="text-2xl font-bold text-white mb-6">🎯 {t.sectionProblems}</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <motion.div 
              variants={slideIn}
              className="bg-black/20 backdrop-blur-sm rounded-xl p-6 border border-purple-700/30"
            >
              <h4 className="text-xl font-bold text-purple-300 mb-4">Data Anomalies</h4>
              <ul className="space-y-3 text-gray-200">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                  <strong>NULL_VALUE:</strong> Missing values in required fields
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                  <strong>DUPLICATE:</strong> Complete or partial record duplication
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                  <strong>OUT_OF_RANGE:</strong> Values outside expected bounds
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                  <strong>INVALID_FORMAT:</strong> Incorrect format (email, ID, date)
                </li>
              </ul>
            </motion.div>

            <motion.div 
              variants={slideIn}
              className="bg-black/20 backdrop-blur-sm rounded-xl p-6 border border-pink-700/30"
            >
              <h4 className="text-xl font-bold text-pink-300 mb-4">Integrity Issues</h4>
              <ul className="space-y-3 text-gray-200">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-pink-400 rounded-full"></span>
                  <strong>INCONSISTENT:</strong> Contradictory field values
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-pink-400 rounded-full"></span>
                  <strong>MISSING_FK:</strong> Invalid foreign key reference
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-pink-400 rounded-full"></span>
                  <strong>WRONG_TYPE:</strong> Incorrect data type
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-pink-400 rounded-full"></span>
                  <strong>OUTLIER:</strong> Statistically anomalous values
                </li>
              </ul>
            </motion.div>
          </div>
        </motion.div>

        {/* Implementation Tips */}
        <motion.div 
          variants={fadeIn}
          className="mt-12 bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50"
        >
          <h3 className="text-2xl font-bold text-white mb-6">💡 {t.sectionTips}</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <motion.div 
              variants={slideIn}
              className="space-y-4"
            >
              {/*
                "Use fuzzy matching para comparar descrições esperadas vs detectadas",
                "Implemente tolerance para índices de linhas (±N linhas é aceitável)",
                "Armazene os prompts usados para reprodutibilidade"
              */}
              {[
                { id: 'tip1', text: "Implement fuzzy matching for expected vs detected descriptions" },
                { id: 'tip2', text: "Apply line index tolerance (±N lines acceptable)" },
                { id: 'tip3', text: "Store LLM prompts for reproducibility" }
              ].map((tip) => (
                <div key={tip.id} className="flex items-start gap-3 bg-gray-900/30 p-4 rounded-lg border border-gray-700/30">
                  <div className="w-8 h-8 bg-purple-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-purple-400" />
                  </div>
                  <p className="text-gray-300">{tip.text}</p>
                </div>
              ))}
            </motion.div>
            <motion.div 
              variants={slideIn}
              className="space-y-4"
            >
              {/*
                "Crie um benchmark suite com datasets de diferentes complexidades",
                "Use embeddings para comparar semanticamente os tipos de problemas",
                "Mantenha versionamento dos datasets e códigos gerados"
              */}
              {[
                { id: 'tip4', text: "Create comprehensive benchmark suite with varying dataset complexities" },
                { id: 'tip5', text: "Utilize embeddings for semantic comparison of issue types" },
                { id: 'tip6', text: "Maintain version control for datasets and generated code" }
              ].map((tip) => (
                <div key={tip.id} className="flex items-start gap-3 bg-gray-900/30 p-4 rounded-lg border border-gray-700/30">
                  <div className="w-8 h-8 bg-pink-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-pink-400" />
                  </div>
                  <p className="text-gray-300">{tip.text}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>

        {/* Future Features Section */}
        <motion.div 
          variants={fadeIn}
          className="mt-12 bg-gradient-to-r from-indigo-900/50 to-blue-900/50 backdrop-blur-sm rounded-2xl p-8 border border-indigo-700/50"
        >
          <h3 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Sparkles className="text-blue-400" />
            {t.sectionFuture}
          </h3>
          <p className="text-blue-300 text-lg mb-8">
            Innovative features planned to enhance your DataForgeTest platform
          </p>

          {/* Feature Navigation */}
          <motion.div 
            variants={staggerContainer}
            className="mb-8"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(futureFeatures).map(([key, feature]) => {
                const Icon = feature.icon;
                return (
                  <motion.button
                    key={key}
                    variants={fadeIn}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSelectedFeature(key)}
                    className={`p-4 rounded-xl transition-all ${
                      selectedFeature === key
                        ? `${feature.color} shadow-lg shadow-blue-500/20`
                        : 'bg-gray-800/50 hover:bg-gray-800 border border-gray-700'
                    }`}
                  >
                    <Icon className="w-6 h-6 text-white mx-auto mb-2" />
                    <div className="text-xs font-medium text-center leading-tight">
                      {feature.title}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* Selected Feature Details */}
          <motion.div 
            key={selectedFeature}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50"
          >
            <div className="flex items-start gap-4 mb-6">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className={`p-3 rounded-xl ${futureFeatures[selectedFeature].color}`}
              >
                <FeatureIcon className="w-8 h-8 text-white" />
              </motion.div>
              <div>
                <h4 className="text-2xl font-bold text-white mb-2">
                  {futureFeatures[selectedFeature].title}
                </h4>
                <p className="text-blue-300 text-lg">
                  {futureFeatures[selectedFeature].description}
                </p>
              </div>
            </div>

            <motion.div 
              variants={staggerContainer}
              className="space-y-4"
            >
              {futureFeatures[selectedFeature].features.map((feature, idx) => (
                <motion.div
                  key={feature.name}
                  variants={fadeIn}
                  whileHover={{ scale: 1.01 }}
                  className="bg-gray-800/50 rounded-xl p-5 hover:bg-gray-800/70 transition-colors border border-gray-700/50"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div className="flex-1">
                      <h5 className="text-blue-200 font-semibold text-lg mb-2">
                        {feature.name}
                      </h5>
                      <p className="text-gray-300 text-sm leading-relaxed">
                        {feature.desc}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>

        <HomeFooter />
      </motion.div>
    </motion.div>
  );
};

export default DataQualityLLMSystem;
