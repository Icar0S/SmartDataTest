import React, { useState } from 'react';
import Reveal from '../landing/Reveal';
import SectionHeading from '../landing/SectionHeading';
import { pick, STRUCTURES } from './content';
import { ICONS, TONES } from './icons';
import useTabKeys from './Tabs';

const IDS = STRUCTURES.map((structure) => structure.id);

/** The data model as a schema browser: pick an entity, read its fields. */
export default function StructuresSection({ t, language }) {
  const [active, setActive] = useState(IDS[0]);
  const { register, onKeyDown } = useTabKeys(IDS, setActive);
  const current = STRUCTURES.find((structure) => structure.id === active);
  const CurrentIcon = ICONS[current.icon];
  const tone = TONES[current.tone];

  return (
    <section aria-labelledby="estruturas-title" className="relative py-24 md:py-32">
      <div className="section-container">
        <SectionHeading
          id="estruturas-title"
          eyebrow={t.structures.eyebrow}
          title={t.structures.title}
          subtitle={t.structures.subtitle}
        />

        <Reveal className="grid grid-cols-1 gap-4 lg:grid-cols-[17.5rem_minmax(0,1fr)]">
          <div
            role="tablist"
            aria-label={t.structures.listLabel}
            aria-orientation="vertical"
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
          >
            {STRUCTURES.map((structure, index) => {
              const Icon = ICONS[structure.icon];
              const selected = structure.id === active;
              const colours = TONES[structure.tone];
              return (
                <button
                  key={structure.id}
                  ref={register(structure.id)}
                  id={`structure-tab-${structure.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="structure-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(structure.id)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  className={`flex shrink-0 items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all duration-300 ${
                    selected
                      ? 'border-sdt-violet/40 bg-sdt-violet/[0.12] shadow-[0_0_30px_-14px_rgba(167,139,250,0.9)]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'
                  }`}
                >
                  <span className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl border ${colours.tile}`}>
                    <Icon className={`h-4 w-4 ${colours.icon}`} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className={`block font-code text-[13px] font-medium ${selected ? 'text-sdt-fg' : 'text-sdt-muted-strong'}`}>
                      {structure.title}
                    </span>
                    <span className="block text-[11px] text-sdt-muted">
                      {structure.fields.length} {t.structures.fields}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div
            id="structure-panel"
            role="tabpanel"
            aria-labelledby={`structure-tab-${current.id}`}
            tabIndex={0}
            className="glass min-w-0 rounded-3xl p-5 sm:p-8"
          >
            <div key={current.id} className="animate-fade-up">
              <div className="flex items-start gap-4">
                <span className={`grid h-14 w-14 flex-shrink-0 place-items-center rounded-2xl border ${tone.tile}`}>
                  <CurrentIcon className={`h-7 w-7 ${tone.icon}`} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="break-words font-code text-xl font-semibold text-sdt-fg sm:text-2xl">{current.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-sdt-muted sm:text-base">
                    {pick(current.description, language)}
                  </p>
                </div>
              </div>

              <table className="mt-7 w-full table-fixed border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="font-code text-[10px] uppercase tracking-[0.18em] text-sdt-muted">
                    <th scope="col" className="w-[44%] border-b border-white/[0.06] pb-3 font-medium md:w-[28%]">
                      {t.structures.field}
                    </th>
                    <th scope="col" className="border-b border-white/[0.06] pb-3 font-medium md:w-[30%]">
                      {t.structures.type}
                    </th>
                    <th scope="col" className="hidden border-b border-white/[0.06] pb-3 font-medium md:table-cell">
                      {t.structures.description}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {current.fields.map((field) => (
                    <tr key={field.name} className="group align-top">
                      <td className="border-b border-white/[0.04] py-3.5 pr-3 transition-colors group-hover:bg-white/[0.02]">
                        <span className="block break-words font-code text-[13px] text-sdt-violet-strong">{field.name}</span>
                        <span className="mt-1 block text-xs leading-snug text-sdt-muted md:hidden">
                          {pick(field.desc, language)}
                        </span>
                      </td>
                      <td className="border-b border-white/[0.04] py-3.5 pr-3 transition-colors group-hover:bg-white/[0.02]">
                        <span className="inline-block max-w-full break-words rounded-lg border border-emerald-400/20 bg-emerald-400/[0.08] px-2 py-0.5 font-code text-[11px] text-emerald-300">
                          {field.type}
                        </span>
                      </td>
                      <td className="hidden border-b border-white/[0.04] py-3.5 leading-relaxed text-sdt-muted transition-colors group-hover:bg-white/[0.02] md:table-cell">
                        {pick(field.desc, language)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
