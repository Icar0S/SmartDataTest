import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Brain } from 'lucide-react';
import Reveal from '../landing/Reveal';
import SectionHeading from '../landing/SectionHeading';
import SpotlightCard from '../landing/SpotlightCard';
import { MODULES } from './content';
import { ICONS, TONES } from './icons';

// Bento layout: two columns from md, six from lg.
const LAYOUT = {
  pyspark: 'md:col-span-2 lg:col-span-4 lg:row-span-2',
  accuracy: 'lg:col-span-2 lg:row-span-2',
  checklist: 'lg:col-span-2',
  synthetic: 'lg:col-span-2',
  rag: 'lg:col-span-2',
  methodology: 'md:col-span-2 lg:col-span-6',
};

const TONE = {
  pyspark: 'violet',
  accuracy: 'cyan',
  checklist: 'emerald',
  synthetic: 'pink',
  rag: 'amber',
  methodology: 'indigo',
};

/** What the questionnaire turns into: a peek at generated validation code. */
function CodePeek() {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.06] bg-black/30" aria-hidden="true">
      <div className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-sdt-violet/60" />
        <span className="font-code text-[11px] text-sdt-muted">validations.py</span>
      </div>
      <pre className="overflow-x-auto px-4 py-4 font-code text-[11.5px] leading-[1.8] sm:text-[12px]">
        <code>
          <span className="text-fuchsia-300">def</span> <span className="text-sky-300">check_email_not_null</span>
          <span className="text-sdt-fg/90">(df):</span>
          {'\n'}
          <span className="text-sdt-fg/90">{'    '}</span>
          <span className="text-fuchsia-300">return</span>
          <span className="text-sdt-fg/90"> df.filter(F.col(</span>
          <span className="text-emerald-300">"email"</span>
          <span className="text-sdt-fg/90">).isNull())</span>
          {'\n\n'}
          <span className="text-fuchsia-300">def</span> <span className="text-sky-300">check_unique_order_id</span>
          <span className="text-sdt-fg/90">(df):</span>
          {'\n'}
          <span className="text-sdt-fg/90">{'    '}</span>
          <span className="text-fuchsia-300">return</span>
          <span className="text-sdt-fg/90"> df.groupBy(</span>
          <span className="text-emerald-300">"order_id"</span>
          <span className="text-sdt-fg/90">).count().filter(</span>
          <span className="text-emerald-300">"count &gt; 1"</span>
          <span className="text-sdt-fg/90">)</span>
        </code>
      </pre>
    </div>
  );
}

/** GOLD against TARGET, column by column. */
function AccuracyPeek() {
  const columns = [
    ['customer_id', 100],
    ['email', 97],
    ['amount', 92],
    ['created_at', 88],
  ];
  return (
    <div className="mt-6 space-y-3 rounded-2xl border border-white/[0.06] bg-black/25 p-4" aria-hidden="true">
      <div className="flex items-center justify-between font-code text-[11px] uppercase tracking-wider text-sdt-muted">
        <span>GOLD ↔ TARGET</span>
        <span className="text-cyan-300">94.3%</span>
      </div>
      {columns.map(([name, value]) => (
        <div key={name} className="flex items-center gap-3">
          <span className="w-24 truncate font-code text-[11px] text-sdt-muted-strong">{name}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-400"
              style={{ width: `${value}%` }}
            />
          </span>
          <span className="w-9 text-right font-code text-[11px] text-sdt-fg">{value}%</span>
        </div>
      ))}
    </div>
  );
}

/** The four phases of the method, carried by the AI layer. */
function PhasesPeek({ phases, layer }) {
  return (
    <div className="mt-6 lg:mt-0" aria-hidden="true">
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {phases.map((phase, index) => (
          <li
            key={phase}
            className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
          >
            <span className="font-code text-xs text-indigo-300">0{index + 1}</span>
            <span className="text-sm text-sdt-muted-strong">{phase}</span>
          </li>
        ))}
      </ol>
      <div className="mt-2 flex items-center justify-center gap-2 rounded-2xl border border-indigo-400/20 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-fuchsia-500/10 px-4 py-2.5 text-xs text-indigo-200">
        <Brain className="h-3.5 w-3.5" aria-hidden="true" />
        {layer}
      </div>
    </div>
  );
}

function ModuleCard({ module, item, index }) {
  const Icon = ICONS[module.icon];
  const tone = TONES[TONE[module.id]];
  const wide = module.id === 'methodology';

  return (
    <Reveal delay={Math.min(index, 4) * 0.07} className={LAYOUT[module.id]}>
      <SpotlightCard
        as="article"
        aria-labelledby={`module-${module.id}`}
        className="h-full rounded-3xl glass p-6 transition-colors duration-500 hover:border-sdt-violet/25 sm:p-7"
      >
        <div className={`relative z-[3] flex h-full flex-col ${wide ? 'lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)] lg:items-center lg:gap-10' : ''}`}>
          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <span className={`grid h-12 w-12 place-items-center rounded-2xl border ${tone.tile}`}>
                <Icon className={`h-6 w-6 ${tone.icon}`} aria-hidden="true" />
              </span>
              <span className="font-code text-xs text-sdt-muted/60" aria-hidden="true">
                0{index + 1}
              </span>
            </div>
            <h3
              id={`module-${module.id}`}
              className="mt-6 font-display text-xl font-bold tracking-tight text-sdt-fg sm:text-2xl"
            >
              {item.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-sdt-muted sm:text-[15px]">{item.description}</p>
            {wide && <Links module={module} item={item} />}
          </div>

          {module.id === 'pyspark' && <CodePeek />}
          {module.id === 'accuracy' && <AccuracyPeek />}
          {wide && <PhasesPeek phases={item.phases} layer={item.layer} />}
          {!wide && <Links module={module} item={item} />}
        </div>
      </SpotlightCard>
    </Reveal>
  );
}

function Links({ module, item }) {
  return (
    <div className="mt-auto flex flex-wrap gap-2 pt-6">
      {module.routes.map((to, index) => (
        <Link
          key={to}
          to={to}
          className="group/link inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-sdt-fg transition-all duration-300 hover:border-sdt-violet/40 hover:bg-sdt-violet/10"
        >
          {item.links[index]}
          <ArrowUpRight
            className="h-3.5 w-3.5 text-sdt-violet transition-transform duration-300 group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      ))}
    </div>
  );
}

export default function ModulesSection({ t }) {
  return (
    <section id="modulos" aria-labelledby="modulos-title" className="relative scroll-mt-20 py-24 md:py-32">
      <div className="section-container">
        <SectionHeading
          id="modulos-title"
          eyebrow={t.modules.eyebrow}
          title={t.modules.title}
          subtitle={t.modules.subtitle}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:auto-rows-[minmax(12.5rem,auto)] lg:grid-cols-6">
          {MODULES.map((module, index) => (
            <ModuleCard key={module.id} module={module} item={t.modules.items[module.id]} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
