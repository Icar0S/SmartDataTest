import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle,
  Clock,
  Code,
  Database,
  Fingerprint,
  GraduationCap,
  Heart,
  Hourglass,
  KeyRound,
  Loader,
  Lock,
  Settings,
  Shield,
  ShieldCheck,
  TestTube,
  User,
  Zap,
} from 'lucide-react';
import { useAuthContext } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import GoogleLogo from '../components/GoogleLogo';
import LanguageToggle from '../components/LanguageToggle';
import AuroraBackground from '../components/landing/AuroraBackground';
import BrandMark from '../components/landing/BrandMark';
import Counter from '../components/landing/Counter';
import Eyebrow from '../components/landing/Eyebrow';
import SpotlightCard from '../components/landing/SpotlightCard';
import { versionLabel } from '../config/version';
import useAuth from '../hooks/useAuth';
import useStats from '../hooks/useStats';
import { discardPendingLogin, readLoginReturn, safeReturnPath } from '../utils/sso';

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------
const translations = {
  'pt-BR': {
    platformName: 'SmartDataTest',
    secureAccess: 'Acesso seguro',
    loginTitle: 'Bem-vindo de volta',
    loginSubtitle: 'Faça login para acessar a plataforma de QA em Big Data',
    rememberMe: 'Lembrar-me por 7 dias',
    loginButton: 'Entrar com Google',
    loginButtonLoading: 'Autenticando...',
    accessNote:
      'O acesso é liberado pelo administrador. Se ainda não tem, entre com sua conta Google e peça a liberação a ele.',
    privacyNote: 'Usamos apenas seu nome e e-mail, para identificar quem tem acesso.',
    trust: ['Google + PKCE', 'Nenhuma senha armazenada', 'Aprovação do operador'],
    pendingTitle: 'Aguardando liberação',
    pendingSubtitle: 'Sua conta foi reconhecida, mas ainda não tem acesso.',
    pendingBody:
      'Peça a liberação ao administrador da plataforma, informando o e-mail abaixo. Esta página avança sozinha assim que o acesso for liberado.',
    pendingContact: 'Contato',
    pendingRetry: 'Verificar agora',
    pendingSwitch: 'Entrar com outra conta',
    pendingWatching: 'Pendente',
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
    showcaseEyebrow: 'Plataforma de QA para Big Data',
    showcaseTitle: 'Dados confiáveis,',
    showcaseTitleAccent: 'testados de ponta a ponta.',
    showcaseBody:
      'Gere validações PySpark, compare datasets com um GOLD, crie dados sintéticos e tire dúvidas com um assistente que conhece qualidade de dados.',
    rightPanelTitle: 'Pipeline de Qualidade',
    rightPanelSubtitle: 'Monitoramento em tempo real',
    live: 'ao vivo',
    pipeline: [
      'Ingestão de dados',
      'Validação de schema',
      'Checagens de qualidade',
      'Geração do dataset GOLD',
      'Exportação do relatório',
    ],
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
    secureAccess: 'Secure access',
    loginTitle: 'Welcome back',
    loginSubtitle: 'Sign in to access the Big Data QA platform',
    rememberMe: 'Remember me for 7 days',
    loginButton: 'Sign in with Google',
    loginButtonLoading: 'Authenticating...',
    accessNote:
      'Access is granted by the administrator. If you do not have it yet, sign in with your Google account and ask for it.',
    privacyNote: 'We only use your name and e-mail, to identify who has access.',
    trust: ['Google + PKCE', 'No passwords stored', 'Operator approval'],
    pendingTitle: 'Waiting for approval',
    pendingSubtitle: 'Your account was recognised, but has no access yet.',
    pendingBody:
      'Ask the platform administrator for access, giving the e-mail below. This page moves on by itself once access is granted.',
    pendingContact: 'Contact',
    pendingRetry: 'Check now',
    pendingSwitch: 'Use another account',
    pendingWatching: 'Pending',
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
    showcaseEyebrow: 'Big Data QA platform',
    showcaseTitle: 'Reliable data,',
    showcaseTitleAccent: 'tested end to end.',
    showcaseBody:
      'Generate PySpark validations, compare datasets against a GOLD one, create synthetic data and ask an assistant that knows data quality.',
    rightPanelTitle: 'Quality Pipeline',
    rightPanelSubtitle: 'Real-time monitoring',
    live: 'live',
    pipeline: [
      'Data ingestion',
      'Schema validation',
      'Quality checks',
      'GOLD dataset generation',
      'Report export',
    ],
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

const TRUST_ICONS = [KeyRound, Fingerprint, ShieldCheck];

const easeOut = [0.22, 1, 0.36, 1];

// One step of the sign-in flow replacing another.
const stepMotion = {
  initial: { opacity: 0, y: 18, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: easeOut } },
  exit: { opacity: 0, y: -12, filter: 'blur(6px)', transition: { duration: 0.25 } },
};

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** The glass card every step of the flow sits on. */
function AuthCard({ children, testId }) {
  return (
    <SpotlightCard
      data-testid={testId}
      className="rounded-[28px] glass-strong p-7 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] sm:p-9"
      alpha={0.08}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 -top-px h-px bg-gradient-to-r from-transparent via-sdt-violet/70 to-transparent"
      />
      <div className="relative z-[3]">{children}</div>
    </SpotlightCard>
  );
}

function CardHeader({ icon: Icon, tone = 'brand', eyebrow, title, subtitle, as: Heading = 'h2' }) {
  const tones = {
    brand: 'from-violet-500 via-fuchsia-500 to-pink-500 shadow-[0_0_36px_-6px_rgba(192,132,252,0.8)]',
    waiting: 'from-amber-400 to-orange-500 shadow-[0_0_36px_-8px_rgba(251,191,36,0.7)]',
    success: 'from-emerald-400 to-teal-500 shadow-[0_0_36px_-8px_rgba(52,211,153,0.7)]',
  };
  return (
    <div className="mb-7">
      <div className="mb-6 flex items-center gap-3">
        <span className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${tones[tone]}`}>
          <Icon className="h-6 w-6 text-white" aria-hidden="true" />
        </span>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      </div>
      <Heading className="font-display text-3xl font-bold leading-tight tracking-tight text-sdt-fg sm:text-[2.15rem]">
        {title}
      </Heading>
      <p className="mt-2.5 text-[15px] leading-relaxed text-sdt-muted">{subtitle}</p>
    </div>
  );
}

const primaryButton =
  'group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 px-5 py-3.5 font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_40px_-8px_rgba(217,70,239,0.8)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none';

const quietButton =
  'mt-3 w-full rounded-xl py-2.5 text-sm text-sdt-muted transition-colors hover:bg-white/[0.03] hover:text-sdt-fg';

// ---------------------------------------------------------------------------
// Right side — what the platform does
// ---------------------------------------------------------------------------

const PIPELINE = [
  { status: 'done', progress: 100 },
  { status: 'done', progress: 100 },
  { status: 'running', progress: 72 },
  { status: 'pending', progress: 0 },
  { status: 'pending', progress: 0 },
];

// On the panel's top and bottom edges, clear of its text.
const CHIPS = [
  { label: 'PySpark', className: '-top-4 left-8', duration: 6.2 },
  { label: 'Delta Lake', className: '-top-4 right-24', duration: 7.1 },
  { label: 'LLM + RAG', className: '-bottom-5 left-16', duration: 6.6 },
  { label: 'pytest', className: '-bottom-5 right-10', duration: 5.8 },
];

function PipelinePanel({ t }) {
  return (
    <SpotlightCard tilt className="overflow-hidden rounded-3xl glass p-6" alpha={0.09}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-24 animate-scan bg-gradient-to-b from-transparent via-sdt-violet/[0.07] to-transparent"
      />
      <div className="relative z-[3]">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-sdt-violet/20 bg-sdt-violet/10">
              <Activity className="h-5 w-5 text-sdt-violet-strong" aria-hidden="true" />
            </span>
            <div>
              <h3 className="font-display text-base font-semibold text-sdt-fg">{t.rightPanelTitle}</h3>
              <p className="text-xs text-sdt-muted">{t.rightPanelSubtitle}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-sdt-signal/20 bg-sdt-signal/10 px-2.5 py-1 font-code text-[10px] uppercase tracking-wider text-sdt-signal">
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sdt-signal opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sdt-signal" />
            </span>
            {t.live}
          </span>
        </div>

        <ol className="space-y-3">
          {PIPELINE.map((step, index) => (
            <li key={t.pipeline[index]} className="flex items-center gap-3">
              <span className="flex-shrink-0">
                {step.status === 'done' && <CheckCircle className="h-4 w-4 text-emerald-400" aria-hidden="true" />}
                {step.status === 'running' && (
                  <Loader className="h-4 w-4 animate-spin text-sdt-violet-strong" aria-hidden="true" />
                )}
                {step.status === 'pending' && <Clock className="h-4 w-4 text-sdt-muted/60" aria-hidden="true" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className={step.status === 'pending' ? 'text-sdt-muted' : 'text-sdt-muted-strong'}>
                    {t.pipeline[index]}
                  </span>
                  <span className="font-code text-sdt-muted">{step.progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  {step.status !== 'pending' && (
                    <div
                      className={`h-full rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 ${
                        step.status === 'running'
                          ? 'animate-shimmer bg-[length:200%_100%] [background-image:linear-gradient(90deg,#a78bfa,#e879f9,#f472b6,#e879f9,#a78bfa)]'
                          : ''
                      }`}
                      style={{ width: `${step.progress}%` }}
                    />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </SpotlightCard>
  );
}

function StatTile({ icon: Icon, label, value, tone, locale }) {
  return (
    <div className="glass rounded-2xl p-4 transition-colors duration-300 hover:border-sdt-violet/30">
      <Icon className={`mb-3 h-4 w-4 ${tone}`} aria-hidden="true" />
      <div className="font-display text-2xl font-bold tracking-tight text-sdt-fg">
        <Counter value={value} locale={locale} />
      </div>
      <div className="mt-0.5 text-xs text-sdt-muted">{label}</div>
    </div>
  );
}

function Showcase({ t, language }) {
  const { tests, datasets, coverage, responseSla } = useStats();

  return (
    <div className="relative hidden lg:block">
      <Eyebrow>{t.showcaseEyebrow}</Eyebrow>
      <h2 className="mt-4 font-display text-[2.6rem] font-bold leading-[1.04] tracking-tight text-sdt-fg xl:text-[3.1rem]">
        {t.showcaseTitle}{' '}
        <span className="gradient-text animate-gradient-pan">{t.showcaseTitleAccent}</span>
      </h2>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-sdt-muted xl:text-lg">{t.showcaseBody}</p>

      <div className="relative mt-9 max-w-xl">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 animate-pulse-glow rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.22),transparent_62%)] blur-2xl"
        />
        <PipelinePanel t={t} />
        {CHIPS.map((chip) => (
          <span
            key={chip.label}
            aria-hidden="true"
            className={`absolute z-20 animate-floaty-sm whitespace-nowrap rounded-full px-3.5 py-1.5 font-code text-xs font-medium text-sdt-violet-strong shadow-lg glass-strong ${chip.className}`}
            style={{ animationDuration: `${chip.duration}s` }}
          >
            {chip.label}
          </span>
        ))}
      </div>

      <div className="mt-9 grid max-w-xl grid-cols-4 gap-3">
        <StatTile icon={TestTube} label={t.statsLabels.tests} value={tests} tone="text-sdt-violet" locale={language} />
        <StatTile icon={Database} label={t.statsLabels.datasets} value={datasets} tone="text-sdt-signal" locale={language} />
        <StatTile icon={BarChart3} label={t.statsLabels.coverage} value={coverage} tone="text-emerald-400" locale={language} />
        <StatTile icon={Zap} label={t.statsLabels.response} value={responseSla} tone="text-amber-300" locale={language} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------
function LoginFooter({ t }) {
  return (
    <footer className="relative z-10 border-t border-white/[0.06]">
      <div className="section-container py-6">
        <div className="flex flex-col items-center justify-between gap-3 text-xs text-sdt-muted md:flex-row">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-sdt-violet" aria-hidden="true" />
            <span className="font-semibold text-sdt-muted-strong">{t.platformName}</span>
            <span className="text-sdt-muted/50">·</span>
            <span>{t.footerCopyright}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>{t.footerBuiltWith}</span>
            <Heart className="h-3 w-3 fill-pink-500 text-pink-500" aria-hidden="true" />
            <span className="font-code">{t.footerTech}</span>
          </div>
          <span className="font-code">{versionLabel()} · 2026</span>
        </div>
        <p className="mt-2 text-center text-xs text-sdt-muted/70">{t.footerRights}</p>
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

  const t = translations[language] ?? translations['pt-BR'];

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
    <div className="sdt-landing flex min-h-screen flex-col">
      <AuroraBackground testId="animated-bg" />

      <header className="relative z-20">
        <div className="section-container flex h-20 items-center justify-between">
          <BrandMark />
          <LanguageToggle size="sm" variant="glass" />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center">
        <div className="section-container grid grid-cols-1 items-center gap-14 py-10 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] lg:gap-16 lg:py-6 xl:gap-24">
          <div className="mx-auto w-full max-w-md lg:mx-0">
            <AnimatePresence mode="wait">
              {step === 'login' && (
                <motion.div key="login" {...stepMotion}>
                  <AuthCard>
                    <CardHeader
                      as="h1"
                      icon={Database}
                      eyebrow={t.secureAccess}
                      title={t.loginTitle}
                      subtitle={t.loginSubtitle}
                    />

                    <div className="flex flex-col gap-5">
                      <AnimatePresence>
                        {error && (
                          <motion.div
                            key="error"
                            role="alert"
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm leading-relaxed text-rose-200"
                          >
                            {error[language]}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <button
                        type="button"
                        onClick={() => handleLogin(rememberMe, returnTo.current)}
                        disabled={isLoading}
                        className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-white px-5 py-3.5 font-semibold text-gray-900 shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_44px_-6px_rgba(196,181,253,0.75)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span aria-hidden="true" className="shine" />
                        {isLoading ? (
                          <>
                            <Loader className="h-5 w-5 animate-spin" aria-hidden="true" />
                            {t.loginButtonLoading}
                          </>
                        ) : (
                          <>
                            <GoogleLogo className="h-5 w-5" />
                            {t.loginButton}
                          </>
                        )}
                      </button>

                      <label className="group flex w-fit cursor-pointer select-none items-center gap-3 text-sm text-sdt-muted-strong">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="peer sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className={`grid h-5 w-5 place-items-center rounded-md border transition-all duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-sdt-violet peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-sdt-bg ${
                            rememberMe
                              ? 'border-transparent bg-gradient-to-br from-violet-500 to-pink-500'
                              : 'border-white/15 bg-white/[0.04] group-hover:border-sdt-violet/50'
                          }`}
                        >
                          {rememberMe && <Check className="h-3.5 w-3.5 text-white" aria-hidden="true" />}
                        </span>
                        {t.rememberMe}
                      </label>

                      <div className="mt-1 flex gap-3 border-t border-white/[0.06] pt-5 text-xs leading-relaxed text-sdt-muted">
                        <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-sdt-violet" aria-hidden="true" />
                        <div className="flex flex-col gap-2">
                          <p>{t.accessNote}</p>
                          <p className="text-sdt-muted/75">{t.privacyNote}</p>
                        </div>
                      </div>
                    </div>
                  </AuthCard>

                  <ul className="mt-5 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                    {t.trust.map((item, index) => {
                      const Icon = TRUST_ICONS[index];
                      return (
                        <li
                          key={item}
                          className="inline-flex items-center gap-1.5 rounded-full border border-sdt-violet/15 bg-sdt-violet/[0.06] px-3 py-1 text-[11px] font-medium text-sdt-muted-strong"
                        >
                          <Icon className="h-3.5 w-3.5 text-sdt-violet" aria-hidden="true" />
                          {item}
                        </li>
                      );
                    })}
                  </ul>
                </motion.div>
              )}

              {step === 'pending' && (
                <motion.div key="pending" {...stepMotion}>
                  <AuthCard testId="pending-step">
                    <CardHeader
                      icon={Hourglass}
                      tone="waiting"
                      eyebrow={t.pendingWatching}
                      title={t.pendingTitle}
                      subtitle={t.pendingSubtitle}
                    />
                    <p className="mb-5 text-sm leading-relaxed text-sdt-muted-strong">{t.pendingBody}</p>
                    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 text-sm">
                      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 font-semibold text-white">
                        <User className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-sdt-fg">{user?.name}</p>
                        <p className="break-all text-sdt-muted">{user?.email}</p>
                        {user?.contact && (
                          <p className="mt-2 text-sdt-muted">
                            {t.pendingContact}: <span className="text-sdt-fg">{user.contact}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <button type="button" onClick={handleRefresh} className={primaryButton}>
                      <span aria-hidden="true" className="shine" />
                      {t.pendingRetry}
                    </button>
                    <button type="button" onClick={handleLogout} className={quietButton}>
                      {t.pendingSwitch}
                    </button>
                  </AuthCard>
                </motion.div>
              )}

              {step === 'profile' && (
                <motion.div key="profile" {...stepMotion}>
                  <AuthCard>
                    <CardHeader
                      icon={CheckCircle}
                      tone="success"
                      title={t.profileTitle}
                      subtitle={t.profileSubtitle}
                    />

                    <p className="mb-4 text-sm font-medium text-sdt-violet-strong">{t.profileQuestion}</p>

                    <form onSubmit={onSubmitProfile} className="flex flex-col gap-4">
                      <div className="grid grid-cols-2 gap-2.5">
                        {t.profileRoles.map((role) => {
                          const Icon = ROLE_ICONS[role.icon] || User;
                          const isSelected = selectedRole === role.id;
                          return (
                            <button
                              key={role.id}
                              data-testid={`role-card-${role.id}`}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => {
                                setSelectedRole(role.id);
                                clearError();
                              }}
                              className={`flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-all duration-200 ${
                                isSelected
                                  ? 'border-sdt-violet/60 bg-sdt-violet/[0.12] shadow-[0_0_24px_-10px_rgba(167,139,250,0.9)]'
                                  : 'border-white/[0.07] bg-white/[0.02] hover:-translate-y-0.5 hover:border-sdt-violet/30'
                              }`}
                            >
                              <span className="flex w-full items-center justify-between">
                                <Icon
                                  className={`h-4 w-4 ${isSelected ? 'text-sdt-violet-strong' : 'text-sdt-muted'}`}
                                  aria-hidden="true"
                                />
                                {isSelected && <Check className="h-3.5 w-3.5 text-sdt-violet-strong" aria-hidden="true" />}
                              </span>
                              <span className="text-xs font-semibold text-sdt-fg">{role.label}</span>
                              <span className="text-[10px] leading-snug text-sdt-muted">{role.desc}</span>
                            </button>
                          );
                        })}
                      </div>

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
                              aria-label={t.profileOtherPlaceholder}
                              rows={2}
                              className="w-full resize-none rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-sdt-fg placeholder:text-sdt-muted/70 focus:border-sdt-violet/50 focus:outline-none focus:ring-2 focus:ring-sdt-violet/30"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <button
                        type="submit"
                        disabled={!selectedRole || (selectedRole === 'other' && !customRole.trim())}
                        className={primaryButton}
                      >
                        <span aria-hidden="true" className="shine" />
                        {t.profileButton}
                      </button>
                    </form>

                    <button type="button" onClick={onSkipProfile} className={quietButton}>
                      {t.profileSkip}
                    </button>
                  </AuthCard>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Showcase t={t} language={language} />
        </div>
      </main>

      <LoginFooter t={t} />
    </div>
  );
}
