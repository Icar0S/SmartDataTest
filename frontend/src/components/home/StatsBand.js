import React from 'react';
import Counter from '../landing/Counter';
import Marquee from '../landing/Marquee';
import Reveal from '../landing/Reveal';
import useStats from '../../hooks/useStats';
import { TECHNOLOGIES } from './content';

// Dividers for a 2 x 2 grid that becomes a single row from md up.
const CELL_BORDERS = ['', 'border-l', 'border-t md:border-l md:border-t-0', 'border-l border-t md:border-t-0'];

/** The live numbers from /api/stats, and the technologies around the platform. */
export default function StatsBand({ t, language }) {
  const { tests, datasets, coverage, responseSla } = useStats();
  const items = [
    { value: tests, label: t.stats.tests },
    { value: datasets, label: t.stats.datasets },
    { value: coverage, label: t.stats.coverage },
    { value: responseSla, label: t.stats.response },
  ];

  return (
    <section aria-label={t.stats.label} className="relative pb-6">
      <div className="section-container">
        <Reveal>
          <dl className="glass grid grid-cols-2 overflow-hidden rounded-3xl md:grid-cols-4">
            {items.map((item, index) => (
              <div
                key={item.label}
                className={`relative flex flex-col-reverse items-center px-4 py-7 text-center md:py-9 ${CELL_BORDERS[index]} border-white/[0.06]`}
              >
                <dt className="mt-2 text-xs text-sdt-muted sm:text-sm">{item.label}</dt>
                <dd className="font-display text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                  <span className="gradient-text">
                    <Counter value={item.value} locale={language} />
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
      <div className="mt-14">
        <Marquee items={TECHNOLOGIES} label={t.marqueeLabel} />
      </div>
    </section>
  );
}
