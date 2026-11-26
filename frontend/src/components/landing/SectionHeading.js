import React from 'react';
import Eyebrow from './Eyebrow';
import Reveal from './Reveal';
import { useInView } from './motion';

/**
 * Eyebrow, a title whose words rise one after another, and an optional
 * subtitle. Screen readers get the title once, as plain text.
 */
export default function SectionHeading({
  id,
  eyebrow,
  title,
  subtitle,
  align = 'center',
  className = '',
}) {
  const [ref, visible] = useInView({ rootMargin: '0px 0px -40px 0px' });
  const words = title.split(' ');
  const centered = align === 'center';

  return (
    <div className={`mb-12 md:mb-16 ${centered ? 'text-center' : 'text-left'} ${className}`}>
      <Reveal>
        <Eyebrow>{eyebrow}</Eyebrow>
      </Reveal>
      <h2
        ref={ref}
        id={id}
        className={`mt-4 font-display text-[2.1rem] font-bold leading-[1.05] tracking-tight text-sdt-fg sm:text-4xl md:text-5xl ${
          centered ? 'mx-auto max-w-4xl' : 'max-w-3xl'
        } ${visible ? 'is-visible' : ''}`}
      >
        <span className="sr-only">{title}</span>
        <span aria-hidden="true">
          {words.map((word, index) => (
            <span
              // eslint-disable-next-line react/no-array-index-key
              key={`${word}-${index}`}
              className={`rise-mask ${index < words.length - 1 ? 'mr-[0.25em]' : ''}`}
            >
              <span className="rise" style={{ transitionDelay: `${0.08 + index * 0.06}s` }}>
                {word}
              </span>
            </span>
          ))}
        </span>
      </h2>
      {subtitle ? (
        <Reveal delay={0.1}>
          <p
            className={`mt-5 max-w-2xl text-base leading-relaxed text-sdt-muted md:text-lg ${
              centered ? 'mx-auto' : ''
            }`}
          >
            {subtitle}
          </p>
        </Reveal>
      ) : null}
    </div>
  );
}
