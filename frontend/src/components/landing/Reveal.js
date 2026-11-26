import React from 'react';
import { useInView } from './motion';

/**
 * Fades and lifts its content in the first time it enters the viewport.
 * The motion itself is CSS (.reveal in index.css), which also turns it off
 * for people who prefer reduced motion.
 */
export default function Reveal({
  as: Tag = 'div',
  children,
  className = '',
  delay = 0,
  y = 28,
  blur = false,
  style,
  ...rest
}) {
  const [ref, visible] = useInView();
  const classes = ['reveal', blur && 'reveal-blur', visible && 'is-visible', className]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag
      ref={ref}
      className={classes}
      style={{ '--reveal-delay': `${delay}s`, '--reveal-y': `${y}px`, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
