import React from 'react';

/**
 * An endless, slowly scrolling row. The list is rendered twice so the loop
 * has no seam; the copy is hidden from assistive technology. Hovering pauses
 * it, and reduced motion stops it.
 */
export default function Marquee({ items, label, duration = 40, className = '' }) {
  return (
    <div className={`marquee mask-fade-edges overflow-hidden ${className}`}>
      <div
        className="marquee-track animate-marquee"
        style={{ '--marquee-duration': `${duration}s` }}
      >
        {[0, 1].map((copy) => (
          <ul
            key={copy}
            aria-label={copy === 0 ? label : undefined}
            aria-hidden={copy === 1 ? 'true' : undefined}
            className="flex shrink-0 items-center gap-10 pr-10"
          >
            {items.map((item) => (
              <li
                key={`${copy}-${item}`}
                className="flex items-center gap-10 whitespace-nowrap font-display text-xl font-semibold text-sdt-muted/70 sm:text-2xl"
              >
                {item}
                <span className="h-1.5 w-1.5 rounded-full bg-sdt-violet/40" aria-hidden="true" />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
