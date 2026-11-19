import type { BrowserContext, Page } from '@playwright/test';

export type Caption = { label: string; title: string; text: string };
export type Card = { kicker: string; title: string; subtitle: string; lines: string[] };
export type Box = { x: number; y: number; width: number; height: number };

/** Installs the presentation layer on every document the context loads. */
export async function installOverlay(context: BrowserContext): Promise<void> {
  await context.addInitScript(overlayRuntime);
}

/** Installs it on the current document when the init script did not run (setContent, about:blank). */
export async function ensureOverlay(page: Page): Promise<void> {
  await page.evaluate(overlayRuntime);
}

/**
 * Runs inside the page and draws the presentation layer over the app: a visible
 * cursor with click ripples, the chapter caption, title cards, the time-lapse
 * badge, toasts and element highlights. Nothing in it takes pointer events, so
 * the app underneath is driven exactly as it would be without it.
 *
 * Playwright serialises this function into the page, so it must stay
 * self-contained: no imports, no references to anything outside its body.
 */
export function overlayRuntime(): void {
  const host = window as unknown as { __sdt?: unknown };
  if (host.__sdt) return;

  const STYLE = `
    #__sdt-overlay { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;
      font-family: Inter, "Segoe UI", system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
    #__sdt-overlay * { box-sizing: border-box; pointer-events: none; }
    #__sdt-overlay .sdt-highlight { position: fixed; z-index: 1; border-radius: 12px; border: 3px solid #f472b6;
      box-shadow: 0 0 0 5px rgba(244, 114, 182, 0.22), 0 0 26px rgba(244, 114, 182, 0.55);
      opacity: 0; transition: opacity 0.18s ease; }
    #__sdt-overlay .sdt-highlight.on { opacity: 1; }
    #__sdt-overlay .sdt-caption { position: fixed; z-index: 2; left: 28px; bottom: 28px;
      width: min(600px, calc(100vw - 56px)); padding: 14px 20px 16px 24px; border-radius: 14px;
      background: rgba(14, 15, 32, 0.93); border: 1px solid rgba(192, 132, 252, 0.38);
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.5); color: #f5f5f7;
      opacity: 0; transform: translateY(14px); transition: opacity 0.35s ease, transform 0.35s ease; }
    #__sdt-overlay .sdt-caption.on { opacity: 1; transform: none; }
    #__sdt-overlay .sdt-caption.top { bottom: auto; top: 28px; }
    #__sdt-overlay .sdt-caption::before { content: ""; position: absolute; left: 0; top: 14px; bottom: 14px;
      width: 4px; border-radius: 0 4px 4px 0; background: linear-gradient(180deg, #c084fc, #ec4899); }
    #__sdt-overlay .sdt-caption .lbl { font-size: 12px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: #c4b5fd; }
    #__sdt-overlay .sdt-caption .ttl { margin-top: 3px; font-size: 21px; font-weight: 700; line-height: 1.25; }
    #__sdt-overlay .sdt-caption .txt { margin-top: 5px; font-size: 15.5px; line-height: 1.45; color: #d6d7e6;
      transition: opacity 0.2s ease; }
    #__sdt-overlay .sdt-caption .txt.swap { opacity: 0; }
    #__sdt-overlay .sdt-card { position: fixed; z-index: 3; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 16px; padding: 48px; text-align: center; color: #f5f5f7;
      background: radial-gradient(1200px 700px at 30% 20%, #2b2050 0%, #1a1a2e 50%, #101120 100%);
      opacity: 0; transition: opacity 0.6s ease; }
    #__sdt-overlay .sdt-card.on { opacity: 1; }
    #__sdt-overlay .sdt-card .k { font-size: 15px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase;
      color: #c4b5fd; }
    #__sdt-overlay .sdt-card .t { padding-bottom: 6px; font-size: 86px; font-weight: 800; line-height: 1.05;
      letter-spacing: -0.02em; background: linear-gradient(90deg, #c084fc, #ec4899);
      -webkit-background-clip: text; background-clip: text; color: transparent; }
    #__sdt-overlay .sdt-card .s { max-width: 1050px; font-size: 27px; line-height: 1.35; color: #e6e6f2; }
    #__sdt-overlay .sdt-card .l { margin-top: 18px; display: flex; flex-direction: column; gap: 6px;
      font-size: 18px; color: #a6abc9; }
    #__sdt-overlay .sdt-badge { position: fixed; z-index: 4; top: 22px; right: 26px; padding: 8px 14px;
      border-radius: 999px; background: rgba(28, 22, 8, 0.92); border: 1px solid rgba(251, 191, 36, 0.6);
      color: #fcd34d; font-size: 15px; font-weight: 600; opacity: 0; transition: opacity 0.25s ease; }
    #__sdt-overlay .sdt-badge.on { opacity: 1; }
    #__sdt-overlay .sdt-toast { position: fixed; z-index: 4; top: 22px; left: 50%; padding: 10px 16px;
      border-radius: 10px; background: rgba(14, 15, 32, 0.94); border: 1px solid rgba(74, 222, 128, 0.55);
      color: #bbf7d0; font-size: 16px; font-weight: 600; opacity: 0; transform: translate(-50%, -8px);
      transition: opacity 0.25s ease, transform 0.25s ease; }
    #__sdt-overlay .sdt-toast.on { opacity: 1; transform: translate(-50%, 0); }
    #__sdt-overlay .sdt-cursor { position: fixed; z-index: 5; left: -5px; top: -3px; width: 30px; height: 30px;
      opacity: 0; transition: opacity 0.2s ease; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.55)); }
    #__sdt-overlay .sdt-cursor.on { opacity: 1; }
    #__sdt-overlay.card-on .sdt-cursor, #__sdt-overlay.card-on .sdt-caption { opacity: 0; }
    #__sdt-overlay .sdt-ripple { position: fixed; z-index: 5; width: 46px; height: 46px; margin: -23px 0 0 -23px;
      border-radius: 50%; border: 3px solid #f472b6; animation: sdt-ripple 0.55s ease-out forwards; }
    @keyframes sdt-ripple { from { transform: scale(0.25); opacity: 1; } to { transform: scale(1.35); opacity: 0; } }
  `;
  const CURSOR =
    '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">' +
    '<path d="M4 2.5v17l4.6-4.3 3.3 7.3 3.2-1.4-3.3-7.2h6.4z" fill="#fff" stroke="#14162a" ' +
    'stroke-width="1.5" stroke-linejoin="round"/></svg>';

  const root = (): HTMLElement => {
    let element = document.getElementById('__sdt-overlay');
    if (!element) {
      const style = document.createElement('style');
      style.textContent = STYLE;
      (document.head ?? document.documentElement).appendChild(style);
      element = document.createElement('div');
      element.id = '__sdt-overlay';
      // Keeps the layer out of role and label queries made against the app.
      element.setAttribute('aria-hidden', 'true');
      document.documentElement.appendChild(element);
    }
    return element;
  };

  const part = (className: string, html = ''): HTMLElement => {
    const container = root();
    let element = container.querySelector<HTMLElement>(`:scope > .${className}`);
    if (!element) {
      element = document.createElement('div');
      element.className = className;
      element.innerHTML = html;
      container.appendChild(element);
    }
    return element;
  };

  const field = (element: HTMLElement, selector: string): HTMLElement =>
    element.querySelector<HTMLElement>(selector) as HTMLElement;

  // Restart the CSS transition when the class is added in the same frame the element appeared.
  const turnOn = (element: HTMLElement): void => {
    void element.offsetWidth;
    element.classList.add('on');
  };

  let toastTimer = 0;
  let highlightTimer = 0;

  window.addEventListener(
    'mousemove',
    (event) => {
      const cursor = part('sdt-cursor', CURSOR);
      cursor.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
      cursor.classList.add('on');
    },
    { capture: true, passive: true },
  );
  window.addEventListener(
    'mousedown',
    (event) => {
      const ripple = document.createElement('div');
      ripple.className = 'sdt-ripple';
      ripple.style.left = `${event.clientX}px`;
      ripple.style.top = `${event.clientY}px`;
      root().appendChild(ripple);
      window.setTimeout(() => ripple.remove(), 700);
    },
    { capture: true, passive: true },
  );

  host.__sdt = {
    caption(caption: { label: string; title: string; text: string }): void {
      const element = part('sdt-caption', '<div class="lbl"></div><div class="ttl"></div><div class="txt"></div>');
      const text = field(element, '.txt');
      const showing = element.classList.contains('on');
      if (showing && field(element, '.ttl').textContent === caption.title) {
        if (text.textContent === caption.text) return;
        text.classList.add('swap');
        window.setTimeout(() => {
          text.textContent = caption.text;
          text.classList.remove('swap');
        }, 200);
        return;
      }
      const show = (): void => {
        field(element, '.lbl').textContent = caption.label;
        field(element, '.ttl').textContent = caption.title;
        text.textContent = caption.text;
        element.classList.remove('top');
        turnOn(element);
      };
      if (showing) {
        element.classList.remove('on');
        window.setTimeout(show, 300);
      } else {
        show();
      }
    },
    hideCaption(): void {
      root().querySelector('.sdt-caption')?.classList.remove('on');
    },
    card(card: { kicker: string; title: string; subtitle: string; lines: string[] }): void {
      const element = part('sdt-card', '<div class="k"></div><div class="t"></div><div class="s"></div><div class="l"></div>');
      field(element, '.k').textContent = card.kicker;
      field(element, '.t').textContent = card.title;
      field(element, '.s').textContent = card.subtitle;
      field(element, '.l').replaceChildren(
        ...card.lines.map((line) => {
          const row = document.createElement('div');
          row.textContent = line;
          return row;
        }),
      );
      root().classList.add('card-on');
      turnOn(element);
    },
    hideCard(): void {
      root().querySelector('.sdt-card')?.classList.remove('on');
      root().classList.remove('card-on');
    },
    badge(text: string): void {
      const element = part('sdt-badge');
      element.textContent = text;
      turnOn(element);
    },
    hideBadge(): void {
      root().querySelector('.sdt-badge')?.classList.remove('on');
    },
    toast(text: string, durationMs: number): void {
      const element = part('sdt-toast');
      element.textContent = text;
      turnOn(element);
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => element.classList.remove('on'), durationMs);
    },
    /** Moves the caption to the other edge of the screen when it would cover `box`. */
    dodge(box: { x: number; y: number; width: number; height: number }): void {
      const caption = root().querySelector<HTMLElement>('.sdt-caption');
      if (!caption || !caption.classList.contains('on')) return;
      const area = caption.getBoundingClientRect();
      const gap = 16;
      const covers =
        box.x < area.right + gap &&
        box.x + box.width > area.left - gap &&
        box.y < area.bottom + gap &&
        box.y + box.height > area.top - gap;
      if (covers) caption.classList.toggle('top');
    },
    highlight(box: { x: number; y: number; width: number; height: number }, durationMs: number): void {
      const element = part('sdt-highlight');
      element.style.left = `${box.x - 6}px`;
      element.style.top = `${box.y - 6}px`;
      element.style.width = `${box.width + 12}px`;
      element.style.height = `${box.height + 12}px`;
      element.classList.remove('on');
      turnOn(element);
      window.clearTimeout(highlightTimer);
      highlightTimer = window.setTimeout(() => element.classList.remove('on'), durationMs);
    },
  };
}
