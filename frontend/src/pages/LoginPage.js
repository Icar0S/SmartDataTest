import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  BookOpen,
  CheckCircle,
  Clock,
  Code,
  Database,
  GraduationCap,
  Heart,
  Loader,
  Lock,
  Settings,
  Shield,
  TestTube,
  User,
  Zap,
} from 'lucide-react';
import { useAuthContext } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import GoogleLogo from '../components/GoogleLogo';
import LanguageToggle from '../components/LanguageToggle';
import { versionLabel } from '../config/version';
import useAuth from '../hooks/useAuth';
import useStats from '../hooks/useStats';
import { discardPendingLogin, readLoginReturn, safeReturnPath } from '../utils/sso';
import {
  floatingNode,
  popIn,
  profileCardIn,
  scaleIn,
  slideDown,
  slideInFromLeft,
  slideInFromRight,
} from '../styles/animations';

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------
const translations = {
  'pt-BR': {
    platformName: 'SmartDataTest',
    loginTitle: 'Bem-vindo de volta',
    loginSubtitle: 'Faça login para acessar a plataforma de QA em Big Data',
    rememberMe: 'Lembrar-me por 7 dias',
    loginButton: 'Entrar com Google',
    loginButtonLoading: 'Autenticando...',
    accessNote:
      'O acesso é liberado pelo administrador. Se ainda não tem, entre com sua conta Google e peça a liberação a ele.',
    privacyNote: 'Usamos apenas seu nome e e-mail, para identificar quem tem acesso.',
    pendingTitle: 'Aguardando liberação',
    pendingSubtitle: 'Sua conta foi reconhecida, mas ainda não tem acesso.',
    pendingBody:
      'Peça a liberação ao administrador da plataforma, informando o e-mail abaixo. Esta página avança sozinha assim que o acesso for liberado.',
    pendingContact: 'Contato',
    pendingRetry: 'Verificar agora',
    pendingSwitch: 'Entrar com outra conta',
    profileTitle: 'Quase lá!',
    profileSubtitle: 'Personalize sua experiência na plataforma',
    profileQuestion: 'Qual é o seu perfil profissional?',
    profileRoles: [
      { id: 'tester', label: 'QA / Tester', icon: 'TestTube', desc: 'Teste e validação de dados' },
      { id: 'data_eng', label: 'Engenheiro de Dados', icon: 'Database', desc: 'Pipelines e ETL' },
      { id: 'dev', label: 'Desenvolvedor', icon: 'Code', desc: 'Desenvolvimento de software' },
      { id: 'student', label: 'Estudante', icon: 'GraduationCap', desc: 'Aprendizado e pesquisa' },
      { id: 'teacher', label: 'Professor / Pesquisador', icon: 'BookOpen', desc: 'Ensino e academia' },
      { id: 'analyst', label: 'Analista de Dados', icon: 'BarChart3', desc: 'Análise e BI' },
      { id: 'devops', label: 'DevOps / SRE', icon: 'Settings', desc: 'Infraestrutura e CI/CD' },
      { id: 'other', label: 'Outra área', icon: 'User', desc: 'Outro perfil profissional' },
    ],
    profileOtherPlaceholder: 'Descreva sua área de atuação...',
    profileButton: 'Acessar plataforma',
    profileSkip: 'Pular por agora',
    rightPanelTitle: 'Pipeline de Qualidade',
    rightPanelSubtitle: 'Monitoramento em tempo real',
    statsLabels: {
      tests: 'Testes',
      datasets: 'Datasets',
      coverage: 'Cobertura',
      response: 'Resposta',
    },
    footerCopyright: '© 2026 SmartDataTest. Todos os direitos reservados.',
    footerRights: 'Plataforma de qualidade de dados com suporte de IA — Uso educacional e profissional.',
    footerBuiltWith: 'Desenvolvido com',
    footerTech: 'React + Flask + Python 3.12',
    loading: 'Carregando...',
  },
  'en-US': {
    platformName: 'SmartDataTest',
    loginTitle: 'Welcome back',
    loginSubtitle: 'Sign in to access the Big Data QA platform',
    rememberMe: 'Remember me for 7 days',
    loginButton: 'Sign in with Google',
    loginButtonLoading: 'Authenticating...',
    accessNote:
      'Access is granted by the administrator. If you do not have it yet, sign in with your Google account and ask for it.',
    privacyNote: 'We only use your name and e-mail, to identify who has access.',
    pendingTitle: 'Waiting for approval',
    pendingSubtitle: 'Your account was recognised, but has no access yet.',
    pendingBody:
      'Ask the platform administrator for access, giving the e-mail below. This page moves on by itself once access is granted.',
    pendingContact: 'Contact',
    pendingRetry: 'Check now',
    pendingSwitch: 'Use another account',
    profileTitle: 'Almost there!',
    profileSubtitle: 'Personalize your platform experience',
    profileQuestion: 'What is your professional profile?',
    profileRoles: [
      { id: 'tester', label: 'QA / Tester', icon: 'TestTube', desc: 'Data testing and validation' },
      { id: 'data_eng', label: 'Data Engineer', icon: 'Database', desc: 'Pipelines and ETL' },
      { id: 'dev', label: 'Developer', icon: 'Code', desc: 'Software development' },
      { id: 'student', label: 'Student', icon: 'GraduationCap', desc: 'Learning and research' },
      { id: 'teacher', label: 'Teacher / Researcher', icon: 'BookOpen', desc: 'Teaching and academia' },
      { id: 'analyst', label: 'Data Analyst', icon: 'BarChart3', desc: 'Analytics and BI' },
      { id: 'devops', label: 'DevOps / SRE', icon: 'Settings', desc: 'Infrastructure and CI/CD' },
      { id: 'other', label: 'Other', icon: 'User', desc: 'Other professional profile' },
    ],
    profileOtherPlaceholder: 'Describe your area of work...',
    profileButton: 'Access platform',
    profileSkip: 'Skip for now',
    rightPanelTitle: 'Quality Pipeline',
    rightPanelSubtitle: 'Real-time monitoring',
    statsLabels: {
      tests: 'Tests',
      datasets: 'Datasets',
      coverage: 'Coverage',
      response: 'Response',
    },
    footerCopyright: '© 2026 SmartDataTest. All rights reserved.',
    footerRights: 'AI-powered data quality platform — Educational and professional use.',
    footerBuiltWith: 'Built with',
    footerTech: 'React + Flask + Python 3.12',
    loading: 'Loading...',
  },
};

// ---------------------------------------------------------------------------
// Icon map for role cards
// ---------------------------------------------------------------------------
const ROLE_ICONS = {
  TestTube,
  Database,
  Code,
  GraduationCap,
  BookOpen,
  BarChart3,
  Settings,
  User,
};

// ---------------------------------------------------------------------------
// AnimatedBackground
// ---------------------------------------------------------------------------
const BG_LABELS = [
  'Parquet', 'PySpark', 'Delta Lake', 'pytest', 'JSON', 'CSV',
  'LLM', 'RAG', 'ETL', 'SQL', 'HDFS', 'Kafka', 'Airflow', 'dbt',
  'BigQuery', 'Spark', 'Schema', 'NULL Check', 'Assertion', 'Coverage',
  'PEP-8', 'pytest-cov', 'Locust', 'Pandas', 'dbt',
];

function AnimatedBackground() {
  const nodes = useMemo(
    () =>
      BG_LABELS.map((label, i) => ({
        label,
        size: 60 + Math.floor(((i * 37) % 61)),
        top: `${5 + ((i * 17) % 85)}%`,
        left: `${3 + ((i * 23) % 91)}%`,
        opacity: 0.1 + ((i % 5) * 0.04),
        duration: 10 + (i % 8) * 2,
        delay: (i % 6) * 0.5,
      })),
    []
  );

  return (
    <div
      data-testid="animated-bg"
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {nodes.map((node) => (
        <motion.div
          key={node.label + node.top}
          variants={floatingNode(node.duration, node.delay)}
          animate="animate"
          className="absolute rounded-full flex items-center justify-center"
          style={{
            width: node.size,
            height: node.size,
            top: node.top,
            left: node.left,
            opacity: node.opacity,
            background: 'rgba(139,92,246,0.12)',
          }}
        >
          <span className="text-white text-[10px] font-mono select-none text-center leading-tight px-1">
            {node.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TopBar
// ---------------------------------------------------------------------------
function TopBar() {
  return (
    <header className="relative z-10 bg-gray-900/70 backdrop-blur-md border-b border-gray-700/50 px-6 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">
            <span className="text-white">⚡ </span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">
              SmartDataTest
            </span>
          </span>
        </div>
        <LanguageToggle size="sm" />
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Right Panel — Pipeline steps
// ---------------------------------------------------------------------------
const PIPELINE_STEPS = [
  { name: 'Data Ingestion', status: 'done', progress: 100 },
  { name: 'Schema Validation', status: 'done', progress: 100 },
  { name: 'Quality Checks', status: 'running', progress: 72 },
  { name: 'Gold Generation', status: 'pending', progress: 0 },
  { name: 'Report Export', status: 'pending', progress: 0 },
];

function StatCard({ icon: Icon, label, value, color }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const target = parseInt(value.replace(/\D/g, ''), 10) || 0;
    if (target === 0) return;
    let current = 0;
    const step = Math.ceil(target / 60);
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      setCount(current);
      if (current >= target) clearInterval(timer);
    }, 20);
    return () => clearInterval(timer);
  }, [value]);

  const displayValue = value.includes('%')
    ? `${count}%`
    : value.includes('<')
    ? value
    : `${count}+`;

  return (
    <motion.div
      variants={popIn}
      className="bg-gray-800/50 border border-purple-700/30 rounded-xl p-4 flex flex-col items-center gap-2"
    >
      <Icon className={`w-6 h-6 ${color}`} />
      <span className={`text-xl font-bold ${color}`}>{displayValue}</span>
      <span className="text-xs text-gray-400 text-center">{label}</span>
    </motion.div>
  );
}

function RightPanel({ t }) {
  const { tests, datasets, coverage, responseSla } = useStats();

  return (
    <div className="hidden md:flex flex-col flex-1 gap-5 p-8 overflow-y-auto">
      {/* Section A — Pipeline */}
      <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/30 rounded-2xl p-5">
        <div className="mb-4">
          <h3 className="text-white font-semibold">{t.rightPanelTitle}</h3>
          <p className="text-xs text-gray-400">{t.rightPanelSubtitle}</p>
        </div>
        <motion.div
          initial="initial"
          animate="animate"
          variants={{ animate: { transition: { staggerChildren: 0.2 } } }}
          className="flex flex-col gap-3"
        >
          {PIPELINE_STEPS.map((step) => (
            <motion.div
              key={step.name}
              variants={{ initial: { opacity: 0, x: -10 }, animate: { opacity: 1, x: 0 } }}
              className="flex items-center gap-3"
            >
              <div className="flex-shrink-0">
                {step.status === 'done' && <CheckCircle className="w-4 h-4 text-green-400" />}
                {step.status === 'running' && <Loader className="w-4 h-4 text-blue-400 animate-spin" />}
                {step.status === 'pending' && <Clock className="w-4 h-4 text-gray-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-300 truncate">{step.name}</span>
                  <span className="text-gray-500 ml-2">{step.progress}%</span>
                </div>
                <div className="bg-gray-700 rounded-full h-1.5">
                  {step.status === 'running' ? (
                    <motion.div
                      className="h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                      animate={{ width: ['72%', '78%', '72%'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  ) : (
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                      style={{ width: `${step.progress}%` }}
                    />
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Section B — Stats (flex-1 to fill remaining space) */}
      <motion.div
        initial="initial"
        animate="animate"
        variants={{ animate: { transition: { staggerChildren: 0.1 } } }}
        className="grid grid-cols-2 gap-3 flex-1"
      >
        <StatCard icon={TestTube} label={t.statsLabels.tests} value={tests} color="text-purple-400" />
        <StatCard icon={Database} label={t.statsLabels.datasets} value={datasets} color="text-blue-400" />
        <StatCard icon={BarChart3} label={t.statsLabels.coverage} value={coverage} color="text-green-400" />
        <StatCard icon={Zap} label={t.statsLabels.response} value={responseSla} color="text-yellow-400" />
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------
function LoginFooter({ t }) {
  return (
    <footer className="relative z-10 border-t border-gray-700/50 bg-gray-900/70 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 py-5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Shield className="w-4 h-4 text-purple-500" />
            <span className="font-semibold text-gray-300">{t.platformName}</span>
            <span className="text-gray-600">·</span>
            <span>{t.footerCopyright}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <span>{t.footerBuiltWith}</span>
            <Heart className="w-3 h-3 text-pink-600 fill-pink-600" />
            <span className="font-mono text-gray-500">{t.footerTech}</span>
          </div>
          <span className="text-xs text-gray-600 font-mono">{versionLabel()} · 2026</span>
        </div>
        <p className="mt-2 text-center text-xs text-gray-600">{t.footerRights}</p>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// LoginPage
// ---------------------------------------------------------------------------

// While an account waits for approval the page asks again by itself, so being
// let in does not require knowing to reload.
const PENDING_POLL_MS = 20000;

export default function LoginPage() {
  const { user, isAuthenticated, isPending, hasProfile, sessionExpired } = useAuthContext();
  const { language } = useLanguage();
  const {
    handleLogin,
    handleLoginReturn,
    handleLogout,
    handleRefresh,
    handleSaveProfile,
    showError,
    clearError,
    error,
    isLoading,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [rememberMe, setRememberMe] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [customRole, setCustomRole] = useState('');

  const returnHandled = useRef(false);
  const returnTo = useRef(safeReturnPath(location.state?.from?.pathname));

  const t = translations[language];

  // Back from Google: the URL fragment carries a one-time code, or the reason
  // there is none.
  useEffect(() => {
    const loginReturn = readLoginReturn(location.hash);
    // The ref, because a code works once and effects may run twice.
    if (!loginReturn || returnHandled.current) return;
    returnHandled.current = true;
    // Out of the address bar and the history before anything else.
    navigate('/login', { replace: true });
    if (loginReturn.error) {
      discardPendingLogin();
      showError(loginReturn.error);
      return;
    }
    handleLoginReturn(loginReturn.code, (path) => {
      returnTo.current = path;
    });
  }, [location.hash, navigate, showError, handleLoginReturn]);

  useEffect(() => {
    if (sessionExpired) showError('session_expired');
  }, [sessionExpired, showError]);

  useEffect(() => {
    if (isAuthenticated && hasProfile && !isLoading) {
      navigate(returnTo.current, { replace: true });
    }
  }, [isAuthenticated, hasProfile, isLoading, navigate]);

  useEffect(() => {
    if (!isPending) return undefined;
    const timer = setInterval(handleRefresh, PENDING_POLL_MS);
    return () => clearInterval(timer);
  }, [isPending, handleRefresh]);

  const step = isPending ? 'pending' : isAuthenticated ? 'profile' : 'login';

  const onSubmitProfile = (e) => {
    e.preventDefault();
    const role = selectedRole === 'other' ? customRole.trim() : selectedRole;
    if (!role) return;
    handleSaveProfile(role);
  };

  const onSkipProfile = () => {
    handleSaveProfile('unset');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#1a1a2e] text-white">
      <AnimatedBackground />
      <TopBar />

      <main className="flex-1 flex relative z-10">
        {/* Left panel */}
        <div className="flex items-center justify-center p-8 w-full md:w-auto md:min-w-[480px] lg:min-w-[520px]">
          <AnimatePresence mode="wait">
            {step === 'login' && (
              <motion.div
                key="login"
                {...slideInFromLeft}
                className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-8 max-w-md w-full"
              >
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 rounded-xl">
                    <Database className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-white">{t.loginTitle}</h1>
                    <p className="text-sm text-gray-400 mt-1">{t.loginSubtitle}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-5">
                  {/* Error */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        key="error"
                        role="alert"
                        variants={slideDown}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="bg-red-900/30 border border-red-700/50 rounded-lg px-4 py-3 text-sm text-red-300"
                      >
                        {error[language]}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    type="button"
                    onClick={() => handleLogin(rememberMe, returnTo.current)}
                    disabled={isLoading}
                    className="w-full bg-white hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed text-gray-800 font-semibold py-2.5 rounded-lg flex items-center justify-center gap-3 transition-all focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {isLoading ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        {t.loginButtonLoading}
                      </>
                    ) : (
                      <>
                        <GoogleLogo className="w-5 h-5" />
                        {t.loginButton}
                      </>
                    )}
                  </button>

                  {/* Remember me */}
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
                    />
                    {t.rememberMe}
                  </label>

                  <div className="border-t border-gray-700/50 pt-4 flex gap-3 text-xs text-left text-gray-400">
                    <Lock className="w-4 h-4 flex-shrink-0 text-purple-400" />
                    <div className="flex flex-col gap-2">
                      <p>{t.accessNote}</p>
                      <p className="text-gray-500">{t.privacyNote}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 'pending' && (
              <motion.div
                key="pending"
                {...slideInFromRight}
                data-testid="pending-step"
                className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-8 max-w-md w-full"
              >
                <div className="flex items-center gap-4 mb-6">
                  <Clock className="w-10 h-10 text-yellow-400" />
                  <div>
                    <h2 className="text-2xl font-bold text-white">{t.pendingTitle}</h2>
                    <p className="text-sm text-gray-400 mt-1">{t.pendingSubtitle}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-300 mb-4">{t.pendingBody}</p>
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 mb-6 text-sm">
                  <p className="font-medium text-white">{user?.name}</p>
                  <p className="text-gray-400 break-all">{user?.email}</p>
                  {user?.contact && (
                    <p className="text-gray-400 mt-3">
                      {t.pendingContact}: <span className="text-gray-200">{user.contact}</span>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold py-2.5 rounded-lg transition-all"
                >
                  {t.pendingRetry}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full mt-3 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                >
                  {t.pendingSwitch}
                </button>
              </motion.div>
            )}

            {step === 'profile' && (
              <motion.div
                key="profile"
                {...slideInFromRight}
                className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-8 max-w-md w-full"
              >
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                  <motion.div variants={scaleIn} initial="initial" animate="animate">
                    <CheckCircle className="w-10 h-10 text-green-400" />
                  </motion.div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{t.profileTitle}</h2>
                    <p className="text-sm text-gray-400 mt-1">{t.profileSubtitle}</p>
                  </div>
                </div>

                <p className="text-sm text-purple-300 mb-4">{t.profileQuestion}</p>

                <form onSubmit={onSubmitProfile} className="flex flex-col gap-4">
                  {/* Role cards grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {t.profileRoles.map((role) => {
                      const Icon = ROLE_ICONS[role.icon] || User;
                      const isSelected = selectedRole === role.id;
                      return (
                        <motion.button
                          key={role.id}
                          data-testid={`role-card-${role.id}`}
                          type="button"
                          variants={profileCardIn}
                          onClick={() => {
                            setSelectedRole(role.id);
                            clearError();
                          }}
                          className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'border-purple-500 bg-purple-900/30'
                              : 'border-gray-700/50 bg-gray-800/30 hover:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-purple-400' : 'text-gray-400'}`} />
                            {isSelected && <CheckCircle className="w-3.5 h-3.5 text-purple-400" />}
                          </div>
                          <span className="text-xs font-medium text-white">{role.label}</span>
                          <span className="text-[10px] text-gray-500">{role.desc}</span>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Other role textarea */}
                  <AnimatePresence>
                    {selectedRole === 'other' && (
                      <motion.div
                        key="other-input"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1, transition: { duration: 0.3 } }}
                        exit={{ height: 0, opacity: 0, transition: { duration: 0.2 } }}
                        className="overflow-hidden"
                      >
                        <textarea
                          value={customRole}
                          onChange={(e) => setCustomRole(e.target.value)}
                          placeholder={t.profileOtherPlaceholder}
                          rows={2}
                          className="w-full bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={!selectedRole || (selectedRole === 'other' && !customRole.trim())}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-all"
                  >
                    {t.profileButton}
                  </button>
                </form>

                <button
                  type="button"
                  onClick={onSkipProfile}
                  className="w-full mt-3 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                >
                  {t.profileSkip}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right panel */}
        <RightPanel t={t} />
      </main>

      <LoginFooter t={t} />
    </div>
  );
}
