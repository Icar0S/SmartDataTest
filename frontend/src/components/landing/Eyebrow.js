import React from 'react';

/** Section label: a thin line and small monospaced capitals. */
export default function Eyebrow({ children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-3 font-code text-[11px] uppercase tracking-[0.25em] text-sdt-violet sm:text-xs ${className}`}
    >
      <span className="h-px w-8 bg-gradient-to-r from-sdt-violet/0 to-sdt-violet/70" aria-hidden="true" />
      {children}
    </span>
  );
}
