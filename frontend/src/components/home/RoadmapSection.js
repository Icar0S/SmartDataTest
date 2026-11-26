import React, { useState } from 'react';
import Reveal from '../landing/Reveal';
import SectionHeading from '../landing/SectionHeading';
import { pick, ROADMAP } from './content';
import { ICONS } from './icons';
import useTabKeys from './Tabs';

const IDS = ROADMAP.map((area) => area.id);

/** Planned work, one area at a time. */
export default function RoadmapSection({ t, language }) {
  const [active, setActive] = useState(IDS[0]);
  const { register, onKeyDown } = useTabKeys(IDS, setActive);
  const current = ROADMAP.find((area) => area.id === active);
  const CurrentIcon = ICONS[current.icon];

  return (
    <section aria-labelledby="roadmap-title" className="relative py-24 md:py-32">
      <div className="section-container">
        <SectionHeading
          id="roadmap-title"
          eyebrow={t.roadmap.eyebrow}
          title={t.roadmap.title}
          subtitle={t.roadmap.subtitle}
        />

        <Reveal>
          <div role="tablist" aria-label={t.roadmap.listLabel} className="flex flex-wrap justify-center gap-2">
            {ROADMAP.map((area, index) => {
              const Icon = ICONS[area.icon];
              const selected = area.id === active;
              return (
                <button
                  key={area.id}
                  ref={register(area.id)}
                  id={`roadmap-tab-${area.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="roadmap-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(area.id)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all duration-300 ${
                    selected
                      ? 'border-transparent bg-gradient-to-r from-violet-500 to-fuchsia-500 font-medium text-white shadow-[0_0_28px_-8px_rgba(192,132,252,0.9)]'
                      : 'border-white/[0.08] bg-white/[0.02] text-sdt-muted hover:border-white/[0.16] hover:text-sdt-fg'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {pick(area.title, language)}
                </button>
              );
            })}
          </div>
        </Reveal>

        <Reveal className="mt-8">
          <div
            id="roadmap-panel"
            role="tabpanel"
            aria-labelledby={`roadmap-tab-${current.id}`}
            tabIndex={0}
            className="glass rounded-3xl p-6 sm:p-9"
          >
            <div key={current.id} className="grid animate-fade-up gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] lg:gap-12">
              <div>
                <div className="flex items-center gap-3">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/30 via-fuchsia-500/20 to-pink-500/20 ring-1 ring-sdt-violet/30">
                    <CurrentIcon className="h-7 w-7 text-sdt-violet-strong" aria-hidden="true" />
                  </span>
                  <span className="rounded-full border border-sdt-signal/20 bg-sdt-signal/10 px-2.5 py-1 font-code text-[10px] uppercase tracking-wider text-sdt-signal">
                    {t.roadmap.planned}
                  </span>
                </div>
                <h3 className="mt-6 font-display text-2xl font-bold tracking-tight text-sdt-fg sm:text-3xl">
                  {pick(current.title, language)}
                </h3>
                <p className="mt-3 leading-relaxed text-sdt-muted">{pick(current.description, language)}</p>
              </div>
              <ol className="space-y-3">
                {current.features.map((feature, index) => (
                  <li
                    key={feature.name.en}
                    className="flex gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors duration-300 hover:border-sdt-violet/25"
                  >
                    <span className="font-code text-sm text-sdt-violet" aria-hidden="true">
                      0{index + 1}
                    </span>
                    <div>
                      <h4 className="font-semibold text-sdt-fg">{pick(feature.name, language)}</h4>
                      <p className="mt-1.5 text-sm leading-relaxed text-sdt-muted">{pick(feature.desc, language)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
