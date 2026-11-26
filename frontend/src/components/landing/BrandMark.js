import React from 'react';
import { Zap } from 'lucide-react';

/** The SmartDataTest mark: a lit tile and the wordmark. */
export default function BrandMark({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 shadow-[0_0_28px_-6px_rgba(192,132,252,0.75)]">
        <Zap className="h-[18px] w-[18px] text-white" aria-hidden="true" />
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-sdt-fg">
        Smart<span className="gradient-text">DataTest</span>
      </span>
    </span>
  );
}
