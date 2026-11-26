import React, { useEffect, useRef } from 'react';

/**
 * A surface lit by a soft glow that follows the pointer, with an optional
 * rotating border and a slight 3D tilt. Only CSS variables change while the
 * pointer moves: React does not re-render.
 */
export default function SpotlightCard({
  as: Tag = 'div',
  children,
  className = '',
  border = true,
  tilt = false,
  size = 520,
  alpha = 0.1,
  style,
  ...rest
}) {
  const ref = useRef(null);
  const frame = useRef(0);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const onPointerMove = (event) => {
    // Touch and pen leave the light where it is.
    if (event.pointerType && event.pointerType !== 'mouse') return;
    const node = ref.current;
    if (!node) return;
    const { clientX, clientY } = event;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const rect = node.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      node.style.setProperty('--x', `${x}px`);
      node.style.setProperty('--y', `${y}px`);
      if (tilt && rect.width && rect.height) {
        node.style.setProperty('--rx', `${((y / rect.height - 0.5) * -4).toFixed(2)}deg`);
        node.style.setProperty('--ry', `${((x / rect.width - 0.5) * 4).toFixed(2)}deg`);
      }
    });
  };

  const onPointerLeave = () => {
    if (!tilt || !ref.current) return;
    ref.current.style.setProperty('--rx', '0deg');
    ref.current.style.setProperty('--ry', '0deg');
  };

  const classes = ['spotlight relative', border && 'card-border', tilt && 'tilt', className]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={classes}
      style={{ '--spotlight-size': `${size}px`, '--spotlight-alpha': alpha, ...style }}
      {...rest}
    >
      <span className="spotlight-layer" aria-hidden="true" />
      {children}
    </Tag>
  );
}
