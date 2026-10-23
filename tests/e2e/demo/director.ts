import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { ensureOverlay, type Box, type Caption, type Card } from './overlay';
import type { ScreencastRecorder } from './recorder';
import type { Chapter } from './storyboard';

type Mark = { at: number; title: string };

/**
 * `pace` scales reading time: caption holds and pauses on results.
 * `motion` scales doing: cursor travel, clicks, typing. A tour can move fast
 * and still leave the captions on screen long enough to read.
 */
export type Tempo = { pace?: number; motion?: number };

/**
 * Drives the page at presentation pace: the cursor glides to each target and
 * highlights it before acting, every chapter gets a caption, and waits longer
 * than a few seconds play in time-lapse with an on-screen notice.
 *
 * See Tempo for the two speed controls.
 */
export class Director {
  private mouse: { x: number; y: number };
  private caption: Caption | null = null;
  private chapterNumber = 0;
  private chapterTotal = 0;
  private readonly marks: Mark[] = [];
  private readonly pace: number;
  private readonly motion: number;

  constructor(
    private readonly page: Page,
    private readonly recorder: ScreencastRecorder,
    tempo: Tempo = {},
  ) {
    const viewport = page.viewportSize() ?? { width: 1600, height: 900 };
    this.mouse = { x: viewport.width / 2, y: viewport.height / 2 };
    this.pace = tempo.pace ?? 1;
    this.motion = tempo.motion ?? 1;
  }

  /** Holds so the viewer can read; scaled by `pace`. */
  async pause(ms: number): Promise<void> {
    await this.page.waitForTimeout(Math.round(ms * this.pace));
  }

  /** Gap between actions; scaled by `pace` and `motion`. */
  private async beat(ms: number): Promise<void> {
    await this.page.waitForTimeout(Math.round(ms * this.pace * this.motion));
  }

  async goto(url: string): Promise<void> {
    await this.page.goto(url);
    await this.afterNavigation();
  }

  /** Restores the overlay state after a full page load replaced the document. */
  async afterNavigation(): Promise<void> {
    await ensureOverlay(this.page);
    // A new document draws no cursor until the mouse moves.
    await this.page.mouse.move(this.mouse.x + 1, this.mouse.y);
    await this.page.mouse.move(this.mouse.x, this.mouse.y);
    if (this.caption) await this.call('caption', this.caption);
  }

  /** Adds an entry to the chapter list written next to the video. */
  mark(title: string): void {
    this.marks.push({ at: this.recorder.videoTime, title });
  }

  setChapter(number: number, total: number): void {
    this.chapterNumber = number;
    this.chapterTotal = total;
  }

  /** Shows the chapter caption, with its own text or `text`; marks it once. */
  async chapter(chapter: Chapter, text = chapter.text): Promise<void> {
    const title = `${this.chapterNumber}. ${chapter.title}`;
    if (this.marks.at(-1)?.title !== title) this.mark(title);
    await this.showCaption({
      label: `Capítulo ${this.chapterNumber} de ${this.chapterTotal}`,
      title: chapter.title,
      text,
    });
    await this.pause(this.readingTime(text));
  }

  /** Replaces the caption text and holds long enough to read it. */
  async say(text: string, holdMs = this.readingTime(text)): Promise<void> {
    if (this.caption) await this.showCaption({ ...this.caption, text });
    await this.pause(holdMs);
  }

  async hideCaption(): Promise<void> {
    this.caption = null;
    await this.call('hideCaption');
  }

  async card(card: Card, holdMs: number): Promise<void> {
    await this.call('card', card);
    await this.pause(holdMs);
  }

  async hideCard(): Promise<void> {
    await this.call('hideCard');
    await this.pause(700);
  }

  /** Glides the cursor to the target, optionally outlining it. */
  async point(target: Locator, highlight = false): Promise<Box | null> {
    await target.waitFor({ state: 'visible' });
    await this.bringIntoView(target);
    const box = await target.boundingBox();
    if (!box) return null;
    await this.call('dodge', box);
    const aim = this.aimAt(box);
    await this.glideTo(aim.x, aim.y);
    if (highlight) await this.call('highlight', box, Math.max(450, 900 * this.motion));
    return box;
  }

  async click(target: Locator, options: { after?: number; highlight?: boolean } = {}): Promise<void> {
    const box = await this.point(target, options.highlight ?? true);
    await this.beat(220);
    if (box) {
      const aim = this.aimAt(box);
      await target.click({ position: { x: aim.x - box.x, y: aim.y - box.y } });
    } else {
      await target.click();
    }
    await this.beat(options.after ?? 700);
  }

  async type(target: Locator, text: string, delay = 45): Promise<void> {
    await this.click(target, { after: 150, highlight: false });
    await target.pressSequentially(text, { delay: Math.round(delay * this.pace * this.motion) });
    await this.beat(400);
  }

  /**
   * Types by growing the value with fill(). For inputs that the app remounts on
   * every keystroke, where per-key typing would lose focus after one character.
   */
  async typeByFill(target: Locator, text: string, delay = 55): Promise<void> {
    await this.point(target);
    for (let length = 1; length <= text.length; length++) {
      await target.fill(text.slice(0, length));
      await this.page.waitForTimeout(Math.round(delay * this.pace * this.motion));
    }
    await this.beat(300);
  }

  async fill(target: Locator, value: string): Promise<void> {
    await this.point(target, true);
    await this.beat(200);
    await target.fill(value);
    await this.beat(500);
  }

  async choose(target: Locator, value: string): Promise<void> {
    await this.point(target, true);
    await this.beat(250);
    await target.selectOption(value);
    await this.beat(500);
  }

  /** Points at the drop zone and attaches the file, without the OS file picker. */
  async upload(input: Locator, file: string, dropZone: Locator): Promise<void> {
    await this.point(dropZone, true);
    await this.beat(300);
    await this.call('toast', `📎 ${path.basename(file)}`, 2600);
    await input.setInputFiles(file);
    await this.beat(900);
  }

  /** Clicks a download control and saves the file into `directory`. */
  async download(trigger: Locator, directory: string): Promise<string> {
    const pending = this.page.waitForEvent('download');
    await this.click(trigger, { after: 200 });
    const download = await pending;
    const target = path.join(directory, download.suggestedFilename());
    await download.saveAs(target);
    await this.call('toast', `⬇ ${download.suggestedFilename()}`, 2600);
    await this.beat(1200);
    return target;
  }

  async scrollPage(deltaY: number, holdMs = 1500): Promise<void> {
    await this.page.evaluate((dy) => window.scrollBy({ top: dy, behavior: 'smooth' }), deltaY);
    await this.pause(holdMs);
  }

  async scrollToTop(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await this.pause(1100);
  }

  /** Scrolls the content of a scrollable element under the cursor. */
  async scrollInside(target: Locator, deltaY: number, durationMs = 2500): Promise<void> {
    await this.point(target);
    const steps = Math.max(10, Math.round(durationMs / 40));
    for (let step = 0; step < steps; step++) {
      await this.page.mouse.wheel(0, deltaY / steps);
      await this.page.waitForTimeout(Math.round((durationMs / steps) * this.pace));
    }
  }

  /** Scrolls the page until `target` sits near the top, then holds. */
  async reveal(target: Locator, holdMs = 1800): Promise<void> {
    await target.waitFor({ state: 'visible' });
    await target.evaluate((element) => {
      (element as HTMLElement).style.scrollMarginTop = '96px';
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    await this.pause(holdMs);
  }

  /**
   * Awaits slow work. If it outlasts `after` ms, the video switches to
   * time-lapse with a badge saying so, and back to real time when it ends.
   */
  async wait<T>(work: Promise<T>, label: string, options: { after?: number; factor?: number } = {}): Promise<T> {
    const after = options.after ?? 3500;
    const factor = options.factor ?? 6;
    const settled = work.then(
      () => true,
      () => true,
    );
    const quick = await Promise.race([settled, this.page.waitForTimeout(after).then(() => false)]);
    if (quick) return work;
    await this.call('badge', `⏩ ${label} · vídeo acelerado ${factor}×`);
    this.recorder.setSpeed(factor);
    try {
      return await work;
    } finally {
      this.recorder.setSpeed(1);
      await this.call('hideBadge');
    }
  }

  /** Chapter list in YouTube's "mm:ss Title" format. */
  chapterList(): string {
    return this.marks.map((mark) => `${formatTime(mark.at)} ${mark.title}`).join('\n') + '\n';
  }

  private readingTime(text: string): number {
    return Math.min(6500, 1200 + text.length * 38);
  }

  private async showCaption(caption: Caption): Promise<void> {
    this.caption = caption;
    await this.call('caption', caption);
  }

  /** Aims at the centre, or near the top of tall elements such as text areas. */
  private aimAt(box: Box): { x: number; y: number } {
    return { x: box.x + box.width / 2, y: box.y + (box.height > 80 ? 30 : box.height / 2) };
  }

  private async glideTo(x: number, y: number): Promise<void> {
    const from = { ...this.mouse };
    const distance = Math.hypot(x - from.x, y - from.y);
    if (distance < 2) return;
    const duration = Math.min(900, 250 + distance * 0.45) * this.pace * this.motion;
    const steps = Math.max(8, Math.round(duration / 16));
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      await this.page.mouse.move(from.x + (x - from.x) * eased, from.y + (y - from.y) * eased);
      await this.page.waitForTimeout(16);
    }
    this.mouse = { x, y };
  }

  /**
   * Scrolls smoothly when the target is off screen. Only then: scrolling moves
   * the page under a still cursor, which closes hover menus. The caption gets
   * out of the way on its own (see dodge in overlay.ts).
   */
  private async bringIntoView(target: Locator): Promise<void> {
    const viewport = this.page.viewportSize() ?? { width: 1600, height: 900 };
    const box = await target.boundingBox();
    const fits = box && box.y >= 8 && box.y + Math.min(box.height, 160) <= viewport.height - 8;
    if (fits) return;
    await target.evaluate((element) => element.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await this.page.waitForTimeout(900);
  }

  /** Calls a method of the in-page overlay. The overlay never fails the tour. */
  private async call(method: string, ...args: unknown[]): Promise<void> {
    try {
      await ensureOverlay(this.page);
      await this.page.evaluate(
        ({ name, values }) => {
          const api = (window as unknown as { __sdt?: Record<string, (...input: unknown[]) => void> }).__sdt;
          api?.[name]?.(...values);
        },
        { name: method, values: args },
      );
    } catch {
      // A navigation can destroy the context mid-call; the next call redraws.
    }
  }
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, '0');
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${rest}`
    : `${String(minutes).padStart(2, '0')}:${rest}`;
}
