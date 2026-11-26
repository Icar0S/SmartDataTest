import React from 'react';
import { Check } from 'lucide-react';
import Reveal from '../landing/Reveal';
import SectionHeading from '../landing/SectionHeading';
import SpotlightCard from '../landing/SpotlightCard';
import { pick, SCENARIOS, TIPS } from './content';

const GROUP_TONES = [
  { code: 'text-sdt-violet-strong', dot: 'bg-sdt-violet' },
  { code: 'text-pink-300', dot: 'bg-pink-400' },
];

/** The anomaly types, and the practices that make the comparison fair. */
export default function ScenariosSection({ t, language }) {
  return (
    <section aria-labelledby="cenarios-title" className="relative py-24 md:py-32">
      <div className="section-container">
        <SectionHeading
          id="cenarios-title"
          eyebrow={t.scenarios.eyebrow}
          title={t.scenarios.title}
          subtitle={t.scenarios.subtitle}
        />

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-6">
          {SCENARIOS.map((group, groupIndex) => (
            <div key={t.scenarios.groups[groupIndex]}>
              <Reveal>
                <h3 className="mb-4 flex items-center gap-3 font-display text-lg font-bold text-sdt-fg">
                  <span className={`h-2 w-2 rounded-full ${GROUP_TONES[groupIndex].dot}`} aria-hidden="true" />
                  {t.scenarios.groups[groupIndex]}
                </h3>
              </Reveal>
              <ul className="grid gap-3 sm:grid-cols-2">
                {group.map((scenario, index) => (
                  <Reveal as="li" key={scenario.code} delay={index * 0.06}>
                    <SpotlightCard className="h-full rounded-2xl glass p-5" size={360}>
                      <div className="relative z-[3]">
                        <code className={`font-code text-sm font-semibold ${GROUP_TONES[groupIndex].code}`}>
                          {scenario.code}
                        </code>
                        <p className="mt-2 text-sm leading-relaxed text-sdt-muted">{pick(scenario.desc, language)}</p>
                      </div>
                    </SpotlightCard>
                  </Reveal>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Reveal className="mt-16">
          <div className="glass rounded-3xl p-6 sm:p-9">
            <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="font-code text-[11px] uppercase tracking-[0.25em] text-sdt-violet">{t.tips.eyebrow}</span>
                <h3 className="mt-2 font-display text-2xl font-bold tracking-tight text-sdt-fg sm:text-3xl">
                  {t.tips.title}
                </h3>
              </div>
            </div>
            <ul className="grid gap-x-8 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
              {TIPS.map((tip) => (
                <li key={tip.en} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-500/30 to-pink-500/20 ring-1 ring-sdt-violet/30">
                    <Check className="h-3.5 w-3.5 text-sdt-violet-strong" aria-hidden="true" />
                  </span>
                  <span className="text-sm leading-relaxed text-sdt-muted-strong">{pick(tip, language)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
