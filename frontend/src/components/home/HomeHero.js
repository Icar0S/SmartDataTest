import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowDown, CheckCircle, Code2, Workflow } from 'lucide-react';
import Counter from '../landing/Counter';
import Reveal from '../landing/Reveal';
import { useInView, useReducedMotion } from '../landing/motion';
import { scrollToSection } from './icons';

const BRAND = 'SmartDataTest';

// A validation the platform could have written: (kind, text) tokens per line.
const CODE = [
  [['kw', 'from'], ['', ' pyspark.sql '], ['kw', 'import'], ['', ' functions '], ['kw', 'as'], ['', ' F']],
  [],
  [['cm', '# NULL_VALUE · required fields']],
  [['', 'nulls = df.filter(F.col('], ['str', '"email"'], ['', ').isNull())']],
  [['cm', '# DUPLICATE · primary key']],
  [['', 'dups = df.groupBy('], ['str', '"order_id"'], ['', ').count()'], ['', '.filter('], ['str', '"count > 1"'], ['', ')']],
  [['cm', '# OUT_OF_RANGE · amounts']],
  [['', 'bad = df.filter(F.col('], ['str', '"amount"'], ['', ') < '], ['num', '0'], ['', ')']],
];

const TOKEN = {
  kw: 'text-fuchsia-300',
  str: 'text-emerald-300',
  num: 'text-amber-300',
  cm: 'text-sdt-muted/80 italic',
  '': 'text-sdt-fg/90',
};

// On the panel's top and bottom edges, clear of the code and the results.
const CHIPS = [
  { label: 'PySpark', className: '-top-5 left-6 sm:left-10', depth: 18, duration: 5.2 },
  { label: 'Delta Lake', className: '-top-5 right-8 sm:right-28', depth: -14, duration: 6.1 },
  { label: 'LLM + RAG', className: '-bottom-6 left-8 sm:left-16', depth: -20, duration: 5.6 },
  { label: 'GOLD', className: '-bottom-6 right-10 sm:right-20', depth: 12, duration: 6.6 },
];

function HeroConsole({ t, visible, language }) {
  return (
    <div className="relative mx-auto w-full min-w-0 max-w-xl lg:max-w-none">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 scale-95 rounded-[2rem] bg-[radial-gradient(circle_at_50%_30%,rgba(167,139,250,0.35),transparent_65%)] blur-2xl"
      />
      <div
        className="overflow-hidden rounded-[1.75rem] glass-strong shadow-[0_40px_120px_-40px_rgba(0,0,0,0.95)]"
        style={{ transform: 'translate3d(calc(var(--mx, 0) * -10px), calc(var(--my, 0) * -10px), 0)' }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex gap-1.5" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
            </span>
            <span className="font-code text-xs text-sdt-muted-strong">{t.hero.console.file}</span>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-sdt-signal/20 bg-sdt-signal/10 px-2.5 py-1 font-code text-[10px] uppercase tracking-wider text-sdt-signal">
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sdt-signal opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sdt-signal" />
            </span>
            {t.hero.console.running}
          </span>
        </div>

        <pre
          className={`overflow-x-auto px-5 py-5 font-code text-[12px] leading-[1.75] sm:text-[12.5px] ${visible ? 'is-visible' : ''}`}
          aria-label={t.hero.console.file}
        >
          <code>
            {CODE.map((line, index) => (
              <span
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                className={`reveal flex ${visible ? 'is-visible' : ''}`}
                style={{ '--reveal-delay': `${0.6 + index * 0.08}s`, '--reveal-y': '6px' }}
              >
                <span className="mr-4 inline-block w-4 shrink-0 select-none text-right text-sdt-muted/40" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="shrink-0 whitespace-pre">
                  {line.map(([kind, text], tokenIndex) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <span key={tokenIndex} className={TOKEN[kind]}>
                      {text}
                    </span>
                  ))}
                  {index === CODE.length - 1 && (
                    <span className="ml-0.5 inline-block h-[1.1em] w-[7px] translate-y-[3px] animate-caret bg-sdt-violet" aria-hidden="true" />
                  )}
                </span>
              </span>
            ))}
          </code>
        </pre>

        <div className="grid gap-3 border-t border-white/[0.06] bg-black/20 px-5 py-4 sm:grid-cols-2">
          <div className="flex items-center gap-2.5 text-sm">
            <CheckCircle className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            <span className="font-display font-bold text-sdt-fg">
              <Counter value="12" locale={language} />
            </span>
            <span className="text-sdt-muted">{t.hero.console.passed}</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-300" aria-hidden="true" />
            <span className="font-display font-bold text-sdt-fg">
              <Counter value="3" locale={language} />
            </span>
            <span className="text-sdt-muted">{t.hero.console.anomalies}</span>
          </div>
          {[
            [t.hero.console.precision, 94],
            [t.hero.console.recall, 91],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center gap-3">
              <span className="w-16 font-code text-[11px] uppercase tracking-wider text-sdt-muted">{label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <span
                  className="block h-full origin-left rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 transition-transform delay-700 duration-[1400ms] ease-out"
                  style={{ transform: `scaleX(${visible ? value / 100 : 0})` }}
                />
              </span>
              <span className="w-9 text-right font-code text-xs text-sdt-fg">0.{value}</span>
            </div>
          ))}
        </div>
      </div>

      {CHIPS.map((chip, index) => (
        <span
          key={chip.label}
          aria-hidden="true"
          className={`absolute z-20 ${chip.className}`}
          style={{
            transform: `translate3d(calc(var(--mx, 0) * ${chip.depth}px), calc(var(--my, 0) * ${chip.depth}px), 0)`,
          }}
        >
          <span
            className={`reveal block ${visible ? 'is-visible' : ''}`}
            style={{ '--reveal-delay': `${0.9 + index * 0.12}s`, '--reveal-y': '10px' }}
          >
            <span
              className="block animate-floaty-sm whitespace-nowrap rounded-full px-3 py-1.5 font-code text-[11px] font-medium text-sdt-violet-strong shadow-lg glass-strong sm:px-3.5 sm:py-2 sm:text-xs"
              style={{ animationDuration: `${chip.duration}s` }}
            >
              {chip.label}
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}

export default function HomeHero({ t, language }) {
  const [ref, visible] = useInView({ rootMargin: '0px' });
  const reduced = useReducedMotion();
  const frame = useRef(0);

  // A little parallax: the console and the chips drift against the mouse.
  const onPointerMove = (event) => {
    if (reduced || (event.pointerType && event.pointerType !== 'mouse')) return;
    const node = event.currentTarget;
    const { clientX, clientY } = event;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      node.style.setProperty('--mx', ((clientX - rect.left) / rect.width - 0.5).toFixed(3));
      node.style.setProperty('--my', ((clientY - rect.top) / rect.height - 0.5).toFixed(3));
    });
  };

  return (
    <section
      id="inicio"
      ref={ref}
      aria-labelledby="hero-title"
      onPointerMove={onPointerMove}
      className={`relative flex min-h-[calc(100svh-4.5rem)] scroll-mt-24 items-center overflow-hidden pb-24 pt-12 lg:pb-20 ${
        visible ? 'is-visible' : ''
      }`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/3 h-[36rem] w-[36rem] -translate-x-1/2 animate-pulse-glow rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.16),transparent_60%)] blur-2xl"
      />

      <div className="section-container relative z-10">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-12">
          <div className="min-w-0 text-center lg:text-left">
            <Reveal
              y={16}
              delay={0.05}
              className="mb-7 inline-flex items-center gap-2 rounded-full px-4 py-2 glass"
            >
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sdt-signal opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sdt-signal" />
              </span>
              <span className="font-code text-[10px] uppercase tracking-[0.06em] text-sdt-muted-strong sm:text-xs sm:tracking-wider">
                {t.hero.badge}
              </span>
            </Reveal>

            <h1 id="hero-title" className="font-display font-bold tracking-tight">
              <span className="sr-only">{BRAND}</span>
              <span
                aria-hidden="true"
                className="block whitespace-nowrap text-[clamp(2.1rem,10.4vw,4.3rem)] leading-[0.95] text-sdt-fg lg:text-[3.55rem] xl:text-[4.2rem]"
              >
                <span className="rise-mask">
                  {Array.from(BRAND).map((letter, index) => (
                    <span
                      // eslint-disable-next-line react/no-array-index-key
                      key={index}
                      className="rise"
                      style={{ transitionDelay: `${0.1 + index * 0.035}s` }}
                    >
                      {letter}
                    </span>
                  ))}
                </span>
              </span>
              <span className="mt-4 block text-[clamp(1.55rem,6.2vw,2.3rem)] leading-[1.12] sm:text-[2.6rem] lg:text-[2.5rem] xl:text-[3rem]">
                <span
                  className={`reveal reveal-blur inline-block pb-1 gradient-text animate-gradient-pan ${visible ? 'is-visible' : ''}`}
                  style={{ '--reveal-delay': '0.55s', '--reveal-y': '18px' }}
                >
                  {t.hero.title}
                </span>
              </span>
            </h1>

            <Reveal delay={0.7}>
              <p className="mx-auto mt-7 max-w-xl text-base leading-relaxed text-sdt-muted md:text-lg lg:mx-0">
                {t.hero.subtitle}
              </p>
            </Reveal>

            <Reveal
              delay={0.85}
              className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap lg:justify-start"
            >
              <Link
                to="/qa-checklist"
                className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-12px_rgba(217,70,239,0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_40px_-6px_rgba(217,70,239,0.85)]"
              >
                <span aria-hidden="true" className="shine" />
                <Code2 className="relative h-4 w-4" aria-hidden="true" />
                <span className="relative">{t.hero.primary}</span>
              </Link>
              <a
                href="#modulos"
                onClick={(event) => scrollToSection(event, 'modulos')}
                className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-sdt-fg glass transition-all duration-300 hover:-translate-y-0.5 hover:border-sdt-violet/40 hover:bg-sdt-violet/[0.06]"
              >
                {t.hero.secondary}
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </a>
              <Link
                to="/methodology"
                className="inline-flex items-center gap-2 px-3 py-3 text-sm font-medium text-sdt-muted-strong transition-colors hover:text-sdt-violet-strong"
              >
                <Workflow className="h-4 w-4" aria-hidden="true" />
                {t.hero.tertiary}
              </Link>
            </Reveal>
          </div>

          <HeroConsole t={t} visible={visible} language={language} />
        </div>
      </div>

      <div className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 md:block">
        <a
          href="#modulos"
          onClick={(event) => scrollToSection(event, 'modulos')}
          className={`reveal flex flex-col items-center gap-2 text-sdt-muted transition-colors hover:text-sdt-violet ${
            visible ? 'is-visible' : ''
          }`}
          style={{ '--reveal-delay': '1.3s', '--reveal-y': '0px' }}
        >
          <span className="font-code text-[10px] uppercase tracking-[0.3em]">{t.hero.scroll}</span>
          <span className="sr-only">{t.hero.scrollAria}</span>
          <span className="flex h-9 w-5 justify-center rounded-full border border-white/15 p-1" aria-hidden="true">
            <span className="h-1.5 w-1 animate-scroll-dot rounded-full bg-sdt-violet" />
          </span>
        </a>
      </div>
    </section>
  );
}
