/**
 * Tests for the building blocks of the login and home pages
 * (frontend/src/components/landing): what they show without any browser
 * API, and what they do when IntersectionObserver, matchMedia and
 * requestAnimationFrame are there.
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AuroraBackground from '../../../frontend/src/components/landing/AuroraBackground';
import BrandMark from '../../../frontend/src/components/landing/BrandMark';
import Counter from '../../../frontend/src/components/landing/Counter';
import Eyebrow from '../../../frontend/src/components/landing/Eyebrow';
import Marquee from '../../../frontend/src/components/landing/Marquee';
import Reveal from '../../../frontend/src/components/landing/Reveal';
import ScrollProgress from '../../../frontend/src/components/landing/ScrollProgress';
import SectionHeading from '../../../frontend/src/components/landing/SectionHeading';
import SpotlightCard from '../../../frontend/src/components/landing/SpotlightCard';
import { useReducedMotion } from '../../../frontend/src/components/landing/motion';

jest.mock('lucide-react', () => new Proxy({}, { get: () => () => <span /> }));

// ── fakes for the browser APIs jsdom does not have ──────────────────────────

class FakeObserver {
  static instances = [];

  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    this.observe = jest.fn();
    this.disconnect = jest.fn();
    FakeObserver.instances.push(this);
  }

  enter(isIntersecting = true) {
    act(() => this.callback([{ isIntersecting }]));
  }
}

function installObserver() {
  FakeObserver.instances = [];
  window.IntersectionObserver = FakeObserver;
}

function installMatchMedia(matching = {}) {
  const lists = {};
  window.matchMedia = jest.fn((query) => {
    if (!lists[query]) {
      const listeners = new Set();
      lists[query] = {
        matches: Boolean(matching[query]),
        addEventListener: (_type, listener) => listeners.add(listener),
        removeEventListener: (_type, listener) => listeners.delete(listener),
        set(value) {
          this.matches = value;
          act(() => listeners.forEach((listener) => listener()));
        },
      };
    }
    return lists[query];
  });
  return lists;
}

// Frames run when the test says so, at the time it gives.
function installFrames() {
  let queue = [];
  window.requestAnimationFrame = jest.fn((callback) => {
    queue.push(callback);
    return queue.length;
  });
  window.cancelAnimationFrame = jest.fn();
  return {
    run(now = 0) {
      const pending = queue;
      queue = [];
      act(() => pending.forEach((callback) => callback(now)));
    },
  };
}

// jsdom has no PointerEvent: a MouseEvent of the same name carries the
// coordinates, and has no pointerType, like a plain mouse.
const pointer = (target, init) =>
  act(() => {
    target.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, ...init }));
  });

const original = {
  IntersectionObserver: window.IntersectionObserver,
  matchMedia: window.matchMedia,
  requestAnimationFrame: window.requestAnimationFrame,
  cancelAnimationFrame: window.cancelAnimationFrame,
};

afterEach(() => {
  Object.assign(window, original);
  if (!original.IntersectionObserver) delete window.IntersectionObserver;
  if (!original.matchMedia) delete window.matchMedia;
});

// ── Reveal ──────────────────────────────────────────────────────────────────

describe('Reveal', () => {
  test('shows its content at once where nothing can observe it', () => {
    render(<Reveal>hello</Reveal>);
    expect(screen.getByText('hello')).toHaveClass('reveal', 'is-visible');
  });

  test('waits for the viewport, then stops watching', () => {
    installObserver();
    render(
      <Reveal as="section" delay={0.2} y={10} blur className="extra">
        hello
      </Reveal>
    );
    const node = screen.getByText('hello');
    expect(node.tagName).toBe('SECTION');
    expect(node).toHaveClass('reveal', 'reveal-blur', 'extra');
    expect(node).not.toHaveClass('is-visible');
    expect(node.style.getPropertyValue('--reveal-delay')).toBe('0.2s');
    expect(node.style.getPropertyValue('--reveal-y')).toBe('10px');

    const [observer] = FakeObserver.instances;
    expect(observer.observe).toHaveBeenCalledWith(node);
    observer.enter(false);
    expect(node).not.toHaveClass('is-visible');
    observer.enter(true);
    expect(node).toHaveClass('is-visible');
    expect(observer.disconnect).toHaveBeenCalled();
  });

  test('lets go of the observer when it goes away', () => {
    installObserver();
    const { unmount } = render(<Reveal>bye</Reveal>);
    const [observer] = FakeObserver.instances;
    unmount();
    expect(observer.disconnect).toHaveBeenCalled();
  });
});

// ── Counter ─────────────────────────────────────────────────────────────────

describe('Counter', () => {
  test('renders the final value when it cannot animate', () => {
    render(<Counter value="1180+" />);
    expect(screen.getByText('1.180+')).toBeInTheDocument();
  });

  test('formats for the language', () => {
    render(<Counter value="1180+" locale="en-US" />);
    expect(screen.getByText('1,180+')).toBeInTheDocument();
  });

  test('keeps what comes before and after the number', () => {
    render(<Counter value="<800ms" />);
    expect(screen.getByText('<800ms')).toBeInTheDocument();
  });

  test('shows text without a number as it is', () => {
    render(<Counter value="n/a" />);
    expect(screen.getByText('n/a')).toBeInTheDocument();
  });

  test('counts up from zero once it is seen', () => {
    installObserver();
    const frames = installFrames();
    const now = jest.spyOn(window.performance, 'now').mockReturnValue(0);
    render(<Counter value="86%" duration={1000} />);

    // Not seen yet: the final value, as without JavaScript.
    expect(screen.getByText('86%')).toBeInTheDocument();

    FakeObserver.instances[0].enter();
    expect(screen.getByText('0%')).toBeInTheDocument();

    frames.run(500);
    const halfway = Number(screen.getByText(/%$/).textContent.replace('%', ''));
    expect(halfway).toBeGreaterThan(0);
    expect(halfway).toBeLessThan(86);

    frames.run(1000);
    expect(screen.getByText('86%')).toBeInTheDocument();
    now.mockRestore();
  });

  test('does not move for people who prefer reduced motion', () => {
    installObserver();
    installMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    installFrames();
    render(<Counter value="970+" />);
    FakeObserver.instances[0].enter();
    expect(screen.getByText('970+')).toBeInTheDocument();
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });
});

// ── useReducedMotion ────────────────────────────────────────────────────────

describe('useReducedMotion', () => {
  function Probe() {
    return <span>{useReducedMotion() ? 'still' : 'moving'}</span>;
  }

  test('is off where the browser cannot tell', () => {
    render(<Probe />);
    expect(screen.getByText('moving')).toBeInTheDocument();
  });

  test('follows the system setting as it changes', () => {
    const lists = installMatchMedia();
    render(<Probe />);
    expect(screen.getByText('moving')).toBeInTheDocument();
    lists['(prefers-reduced-motion: reduce)'].set(true);
    expect(screen.getByText('still')).toBeInTheDocument();
  });
});

// ── SpotlightCard ───────────────────────────────────────────────────────────

describe('SpotlightCard', () => {
  const box = { left: 100, top: 50, width: 200, height: 100, right: 300, bottom: 150, x: 100, y: 50 };

  test('moves its light to the pointer, and tilts towards it', () => {
    const frames = installFrames();
    render(
      <SpotlightCard tilt data-testid="card" className="mine" size={300} alpha={0.2}>
        content
      </SpotlightCard>
    );
    const card = screen.getByTestId('card');
    card.getBoundingClientRect = () => box;
    expect(card).toHaveClass('spotlight', 'card-border', 'tilt', 'mine');
    expect(card.style.getPropertyValue('--spotlight-size')).toBe('300px');

    pointer(card, { clientX: 250, clientY: 75 });
    frames.run();
    expect(card.style.getPropertyValue('--x')).toBe('150px');
    expect(card.style.getPropertyValue('--y')).toBe('25px');
    expect(card.style.getPropertyValue('--rx')).toBe('1.00deg');
    expect(card.style.getPropertyValue('--ry')).toBe('1.00deg');

    fireEvent.pointerLeave(card);
    expect(card.style.getPropertyValue('--rx')).toBe('0deg');
    expect(card.style.getPropertyValue('--ry')).toBe('0deg');
  });

  test('ignores touch, and can go without border or tilt', () => {
    const frames = installFrames();
    render(
      <SpotlightCard border={false} data-testid="card">
        content
      </SpotlightCard>
    );
    const card = screen.getByTestId('card');
    expect(card).not.toHaveClass('card-border');
    expect(card).not.toHaveClass('tilt');

    const touch = new Event('pointermove', { bubbles: true });
    touch.pointerType = 'touch';
    fireEvent(card, touch);
    frames.run();
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();

    fireEvent.pointerLeave(card);
    expect(card.style.getPropertyValue('--rx')).toBe('');
  });
});

// ── ScrollProgress ──────────────────────────────────────────────────────────

describe('ScrollProgress', () => {
  test('is as long as the share of the page scrolled', () => {
    const frames = installFrames();
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 3000, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true, writable: true });
    Object.defineProperty(window, 'scrollY', { value: 500, configurable: true, writable: true });

    const { unmount } = render(<ScrollProgress />);
    const bar = screen.getByTestId('scroll-progress');
    frames.run();
    expect(bar.style.getPropertyValue('--progress')).toBe('0.2500');

    Object.defineProperty(window, 'scrollY', { value: 2500, configurable: true, writable: true });
    fireEvent.scroll(window);
    frames.run();
    expect(bar.style.getPropertyValue('--progress')).toBe('1.0000');

    unmount();
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
  });

  test('stays empty on a page that does not scroll', () => {
    const frames = installFrames();
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 800, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true, writable: true });
    render(<ScrollProgress />);
    frames.run();
    expect(screen.getByTestId('scroll-progress').style.getPropertyValue('--progress')).toBe('0.0000');
  });
});

// ── AuroraBackground ────────────────────────────────────────────────────────

describe('AuroraBackground', () => {
  test('is decoration only', () => {
    render(<AuroraBackground testId="bg" />);
    expect(screen.getByTestId('bg')).toHaveAttribute('aria-hidden', 'true');
  });

  test('follows a mouse with its glow, and stops when it goes away', () => {
    installMatchMedia({ '(pointer: fine)': true });
    const frames = installFrames();
    const { unmount } = render(<AuroraBackground testId="bg" />);
    const glow = screen.getByTestId('bg').querySelector('.cursor-spot');

    pointer(window, { clientX: 40, clientY: 60 });
    frames.run();
    expect(glow.style.getPropertyValue('--x')).toBe('40px');
    expect(glow.style.getPropertyValue('--y')).toBe('60px');
    expect(glow.style.opacity).toBe('1');

    unmount();
    window.requestAnimationFrame.mockClear();
    pointer(window, { clientX: 1, clientY: 1 });
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  test('leaves the glow alone on touch screens', () => {
    installMatchMedia({ '(pointer: fine)': false });
    installFrames();
    render(<AuroraBackground testId="bg" />);
    pointer(window, { clientX: 40, clientY: 60 });
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });
});

// ── Text pieces ─────────────────────────────────────────────────────────────

describe('text pieces', () => {
  test('SectionHeading reads as one title, with its eyebrow and subtitle', () => {
    render(<SectionHeading id="x" eyebrow="Módulos" title="Tudo em um só lugar" subtitle="Sub" align="left" />);
    const heading = screen.getByRole('heading', { level: 2, name: 'Tudo em um só lugar' });
    expect(heading).toHaveAttribute('id', 'x');
    expect(screen.getByText('Módulos')).toBeInTheDocument();
    expect(screen.getByText('Sub')).toBeInTheDocument();
    // Each word rises on its own, hidden from screen readers.
    expect(heading.querySelectorAll('[aria-hidden="true"] .rise')).toHaveLength(5);
  });

  test('SectionHeading without a subtitle', () => {
    render(<SectionHeading id="y" eyebrow="E" title="Só título" />);
    expect(screen.getByRole('heading', { name: 'Só título' })).toBeInTheDocument();
    expect(document.querySelectorAll('p')).toHaveLength(0);
  });

  test('Marquee lists each item once for assistive technology', () => {
    render(<Marquee items={['PySpark', 'dbt']} label="Tecnologias" duration={20} />);
    const list = screen.getByRole('list', { name: 'Tecnologias' });
    expect(list.querySelectorAll('li')).toHaveLength(2);
    // The copy that makes the loop seamless is hidden.
    expect(screen.getAllByText('PySpark')).toHaveLength(2);
    expect(document.querySelectorAll('ul[aria-hidden="true"]')).toHaveLength(1);
  });

  test('Eyebrow and BrandMark', () => {
    render(
      <>
        <Eyebrow className="x">Label</Eyebrow>
        <BrandMark />
      </>
    );
    expect(screen.getByText('Label')).toHaveClass('x');
    expect(screen.getByText('DataTest')).toHaveClass('gradient-text');
  });
});
