import React, { useEffect, useMemo, useState } from 'react';
import { useInView, useReducedMotion } from './motion';

// "970+", "86%", "<2s", "<800ms": what comes before the number, the number,
// and what comes after.
const PARTS = /^(\D*)(\d+)(.*)$/;

const canAnimate = () =>
  typeof window !== 'undefined' &&
  typeof window.IntersectionObserver === 'function' &&
  typeof window.requestAnimationFrame === 'function';

/**
 * A stat that counts up from zero the first time it is seen. The final value
 * is rendered from the start, so it is right without JavaScript, in tests and
 * for people who prefer reduced motion.
 */
export default function Counter({ value, locale = 'pt-BR', duration = 1600, className = '' }) {
  const [ref, inView] = useInView({ rootMargin: '0px 0px -40px 0px' });
  const reduced = useReducedMotion();
  const parts = PARTS.exec(String(value ?? ''));
  const target = parts ? Number(parts[2]) : null;
  const [shown, setShown] = useState(target);
  const format = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  useEffect(() => {
    setShown(target);
    if (target === null || !inView || reduced || !canAnimate()) return undefined;
    let frame = 0;
    const start = window.performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      setShown(Math.round(target * (1 - (1 - progress) ** 4)));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    setShown(0);
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target, inView, reduced, duration]);

  if (!parts) {
    return (
      <span ref={ref} className={className}>
        {value}
      </span>
    );
  }

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {parts[1]}
      {format.format(shown)}
      {parts[3]}
    </span>
  );
}
