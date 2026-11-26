import { useRef } from 'react';

/**
 * Keyboard support for a tab list, as the ARIA authoring practices describe:
 * arrows move and select, Home and End jump to the ends. Both arrow axes work,
 * because the list is vertical on large screens and horizontal on small ones.
 *
 * @returns {{ register: (id: string) => (node: HTMLElement) => void,
 *             onKeyDown: (event: KeyboardEvent, index: number) => void }}
 */
export default function useTabKeys(ids, onSelect) {
  const nodes = useRef({});

  const register = (id) => (node) => {
    nodes.current[id] = node;
  };

  const onKeyDown = (event, index) => {
    const steps = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next = null;
    if (event.key in steps) next = (index + steps[event.key] + ids.length) % ids.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = ids.length - 1;
    if (next === null) return;
    event.preventDefault();
    onSelect(ids[next]);
    nodes.current[ids[next]]?.focus();
  };

  return { register, onKeyDown };
}
