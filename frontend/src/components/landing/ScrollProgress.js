import React, { useEffect, useRef } from 'react';

/** A 2px line along the top edge, as long as the share of the page read. */
export default function ScrollProgress() {
  const bar = useRef(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const node = bar.current;
        if (!node) return;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        node.style.setProperty('--progress', progress.toFixed(4));
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div
      ref={bar}
      data-testid="scroll-progress"
      aria-hidden="true"
      className="sdt-scroll-progress fixed inset-x-0 top-0 z-[60] h-[2px] bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400"
    />
  );
}
