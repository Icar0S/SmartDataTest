import React, { useEffect, useRef } from 'react';

// Particles: left %, top %, float duration (s), delay (s).
const PARTICLES = [
  [12, 22, 5, 0],
  [28, 68, 6.4, 0.4],
  [44, 14, 5.6, 0.8],
  [61, 74, 7, 1.2],
  [76, 30, 6, 1.6],
  [88, 60, 5.2, 2],
  [20, 88, 6.8, 2.4],
  [68, 46, 5.9, 2.8],
  [8, 52, 7.4, 3.2],
  [52, 38, 6.2, 3.6],
  [92, 12, 5.4, 4],
  [36, 52, 7.2, 4.4],
];

const finePointer = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: fine)').matches;

/**
 * The layers behind a landing page: ambient light, a masked grid, drifting
 * auroras, floating particles, film grain and a glow that follows the mouse.
 * Fixed to the viewport and invisible to assistive technology.
 */
export default function AuroraBackground({ testId, className = '' }) {
  const spotlight = useRef(null);

  useEffect(() => {
    const node = spotlight.current;
    if (!node || !finePointer()) return undefined;
    let frame = 0;
    const onMove = (event) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        node.style.setProperty('--x', `${event.clientX}px`);
        node.style.setProperty('--y', `${event.clientY}px`);
        node.style.opacity = '1';
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <div
      data-testid={testId}
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${className}`}
    >
      <div className="sdt-ambient absolute inset-0" />
      <div className="bg-grid mask-radial absolute inset-0 opacity-70" />
      <div className="absolute -top-48 left-[6%] h-[44rem] w-[44rem] animate-aurora rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.20),transparent_65%)] blur-2xl" />
      <div
        className="absolute right-[-12%] top-1/3 h-[38rem] w-[38rem] animate-aurora rounded-full bg-[radial-gradient(circle,rgba(244,114,182,0.12),transparent_65%)] blur-2xl"
        style={{ animationDelay: '-6s' }}
      />
      <div
        className="absolute bottom-[-18%] left-1/3 h-[34rem] w-[34rem] animate-aurora rounded-full bg-[radial-gradient(circle,rgba(103,232,249,0.08),transparent_65%)] blur-2xl"
        style={{ animationDelay: '-11s' }}
      />
      <div ref={spotlight} className="cursor-spot absolute inset-0 opacity-0 transition-opacity duration-700" />
      {PARTICLES.map(([left, top, duration, delay]) => (
        <span
          key={`${left}-${top}`}
          className="absolute h-1 w-1 animate-floaty rounded-full bg-sdt-violet/50"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            animationDuration: `${duration}s`,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
      <div className="sdt-grain absolute inset-0" />
    </div>
  );
}
