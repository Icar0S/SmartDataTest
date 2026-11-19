import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import type { CDPSession, Page } from '@playwright/test';

export type RecorderOptions = {
  outputFile: string;
  /** Output size in pixels: the viewport multiplied by the device scale factor. */
  width: number;
  height: number;
  fps?: number;
  /** x264 constant rate factor. Lower is sharper and larger; 18 keeps code legible. */
  crf?: number;
};

/** Seconds on a monotonic clock, unaffected by wall-clock adjustments. */
const now = (): number => performance.now() / 1000;

export function resolveFfmpeg(): string {
  const binary = process.env.FFMPEG_PATH || 'ffmpeg';
  const probe = spawnSync(binary, ['-hide_banner', '-version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    throw new Error(
      `ffmpeg não encontrado ("${binary}"). Instale o ffmpeg no PATH ou aponte FFMPEG_PATH para o executável.\n` +
        'Windows: winget install Gyan.FFmpeg · macOS: brew install ffmpeg · Linux: sudo apt install ffmpeg',
    );
  }
  return binary;
}

/**
 * Records a Chromium page straight to MP4 (H.264) by piping CDP screencast
 * frames into ffmpeg.
 *
 * Playwright's built-in video is VP8 at about 1 Mbit/s, which smears code and
 * tables. Here frames stay at JPEG quality 92 and are encoded with x264, so the
 * result is sharp and plays in PowerPoint without conversion.
 *
 * Frames only arrive when the page repaints, so each one is repeated until the
 * next arrives, at a constant frame rate. setSpeed() compresses video time for
 * long waits; the director labels those stretches on screen.
 */
export class ScreencastRecorder {
  private readonly fps: number;
  private ffmpeg?: ChildProcessWithoutNullStreams;
  private closed?: Promise<unknown[]>;
  private exited = false;
  private ffmpegLog = '';
  private cdp?: CDPSession;
  private pending?: Buffer;
  private framesWritten = 0;
  private anchorReal = 0;
  private anchorVideo = 0;
  private speed = 1;
  private writes: Promise<void> = Promise.resolve();
  private stopped = false;

  constructor(
    private readonly page: Page,
    private readonly options: RecorderOptions,
  ) {
    this.fps = options.fps ?? 30;
  }

  /** Current position in the output video, in seconds. */
  get videoTime(): number {
    return this.anchorVideo + (now() - this.anchorReal) / this.speed;
  }

  async start(): Promise<void> {
    const { width, height, outputFile } = this.options;
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });

    const ffmpeg = spawn(resolveFfmpeg(), [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(this.fps), '-i', 'pipe:0',
      // JPEG frames are full-range; convert to limited-range BT.709, which every
      // player (PowerPoint included) reads without washed-out or crushed colours.
      '-vf',
      `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos:` +
        'in_range=pc:out_range=tv:out_color_matrix=bt709,' +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x1a1a2e,format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(this.options.crf ?? 18),
      '-pix_fmt', 'yuv420p', '-color_range', 'tv',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
      '-r', String(this.fps), '-movflags', '+faststart',
      outputFile,
    ]);
    ffmpeg.stderr.on('data', (chunk: Buffer) => {
      this.ffmpegLog += chunk.toString();
    });
    // A broken pipe surfaces through the exit code checked in stop().
    ffmpeg.stdin.on('error', () => undefined);
    this.closed = once(ffmpeg, 'close').catch((error: unknown) => {
      this.ffmpegLog += String(error);
      return [-1];
    });
    void this.closed.then(() => {
      this.exited = true;
    });
    this.ffmpeg = ffmpeg;

    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on('Page.screencastFrame', (frame) => this.onFrame(frame.data, frame.sessionId));
    this.anchorReal = now();
    this.anchorVideo = 0;
    await this.cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 92,
      maxWidth: width,
      maxHeight: height,
      everyNthFrame: 1,
    });
  }

  /** Plays the following stretch `speed` times faster in the video (1 = real time). */
  setSpeed(speed: number): void {
    this.anchorVideo = this.videoTime;
    this.anchorReal = now();
    this.speed = speed;
  }

  async stop(): Promise<string> {
    if (!this.ffmpeg || !this.closed) throw new Error('A gravação não foi iniciada.');
    if (this.stopped) return this.options.outputFile;
    this.stopped = true;

    await this.cdp?.send('Page.stopScreencast').catch(() => undefined);
    // Hold the last frame up to now, plus one frame so a still page ends cleanly.
    this.writeUntil(this.videoTime + 1 / this.fps);
    await this.writes;
    this.ffmpeg.stdin.end();
    const [code] = (await this.closed) as [number | null];
    await this.cdp?.detach().catch(() => undefined);
    if (code !== 0) {
      throw new Error(`ffmpeg terminou com código ${code}: ${this.ffmpegLog.trim() || 'sem detalhes'}`);
    }
    return this.options.outputFile;
  }

  private onFrame(data: string, sessionId: number): void {
    this.cdp?.send('Page.screencastFrameAck', { sessionId }).catch(() => undefined);
    if (this.stopped) return;
    // The previous frame stays on screen until this one arrived.
    this.writeUntil(this.videoTime);
    this.pending = Buffer.from(data, 'base64');
  }

  /** Repeats the pending frame for every output tick before `videoSeconds`. */
  private writeUntil(videoSeconds: number): void {
    const frame = this.pending;
    const stdin = this.ffmpeg?.stdin;
    const closed = this.closed;
    if (!frame || !stdin || !closed) return;
    const target = Math.floor(videoSeconds * this.fps);
    const count = target - this.framesWritten;
    if (count <= 0) return;
    this.framesWritten = target;
    this.writes = this.writes.then(async () => {
      for (let i = 0; i < count && !this.exited; i++) {
        if (!stdin.write(frame)) await Promise.race([once(stdin, 'drain'), closed]);
      }
    });
  }
}
