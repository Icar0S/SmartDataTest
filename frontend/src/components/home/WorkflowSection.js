import React from 'react';
import Reveal from '../landing/Reveal';
import SectionHeading from '../landing/SectionHeading';
import SpotlightCard from '../landing/SpotlightCard';
import { RichParts } from './icons';

const STEP_TONES = [
  'from-violet-500 to-fuchsia-500 shadow-[0_0_30px_-8px_rgba(167,139,250,0.9)]',
  'from-sky-500 to-indigo-500 shadow-[0_0_30px_-8px_rgba(56,189,248,0.8)]',
  'from-emerald-500 to-teal-500 shadow-[0_0_30px_-8px_rgba(52,211,153,0.8)]',
  'from-pink-500 to-rose-500 shadow-[0_0_30px_-8px_rgba(244,114,182,0.85)]',
];

/** The LLM workflow, as four steps joined by a line. */
export default function WorkflowSection({ t }) {
  return (
    <section aria-labelledby="fluxo-title" className="relative py-24 md:py-32">
      <div className="section-container">
        <SectionHeading
          id="fluxo-title"
          eyebrow={t.workflow.eyebrow}
          title={t.workflow.title}
          subtitle={t.workflow.subtitle}
        />
        <div className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-[12%] top-[3.25rem] hidden h-px bg-gradient-to-r from-violet-400/0 via-fuchsia-400/50 to-pink-400/0 lg:block"
          />
          <ol className="relative grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {t.workflow.steps.map((step, index) => (
              <Reveal as="li" key={step.title} delay={index * 0.1}>
                <SpotlightCard className="h-full rounded-3xl glass p-6 sm:p-7">
                  <div className="relative z-[3]">
                    <span
                      className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br font-display text-xl font-bold text-white ${STEP_TONES[index]}`}
                    >
                      {index + 1}
                    </span>
                    <h3 className="mt-6 font-display text-lg font-bold leading-snug tracking-tight text-sdt-fg">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-sdt-muted">
                      <RichParts parts={step.parts} />
                    </p>
                  </div>
                </SpotlightCard>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
