import { useEffect, useRef, useState } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

const canMatchMedia = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function';

const canObserve = () =>
  typeof window !== 'undefined' && typeof window.IntersectionObserver === 'function';

/** Whether the person asked the system for less motion. Follows changes. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => canMatchMedia() && window.matchMedia(REDUCED_MOTION).matches
  );

  useEffect(() => {
    if (!canMatchMedia()) return undefined;
    const list = window.matchMedia(REDUCED_MOTION);
    const onChange = () => setReduced(list.matches);
    if (typeof list.addEventListener !== 'function') return undefined;
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/**
 * Whether an element has entered the viewport, once. Where there is no
 * IntersectionObserver everything counts as already seen, so no content can
 * stay hidden waiting for an event that never comes.
 *
 * @returns {[import('react').RefObject, boolean]}
 */
export function useInView({ rootMargin = '0px 0px -60px 0px' } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(() => !canObserve());

  useEffect(() => {
    const node = ref.current;
    if (!node || !canObserve()) return undefined;
    const observer = new window.IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin]);

  return [ref, inView];
}

/** Whether the page has been scrolled past `offset` pixels. */
export function useScrolled(offset = 12) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [offset]);

  return scrolled;
}
