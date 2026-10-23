import fs from 'node:fs';
import path from 'node:path';
import { test, type BrowserContext, type Page } from '@playwright/test';
import * as chapters from './demo/chapters';
import type { ChapterScript, Tour } from './demo/chapters';
import { prepareDatasets } from './demo/datasets';
import { Director } from './demo/director';
import { demoLlm } from './demo/llm';
import { installOverlay } from './demo/overlay';
import { ScreencastRecorder } from './demo/recorder';
import { CLOSING, OPENING } from './demo/storyboard';

/**
 * End-to-end tour of SmartDataTest, recorded as a presentation video.
 *
 *   npm run apresentacao   full tour of every screen  -> output/smartdatatest-apresentacao.mp4
 *   npm run pitch          3-minute cut for the pitch -> output/smartdatatest-pitch.mp4
 *
 * Each run also writes a chapter list and the figures measured along the way
 * (rows, rules, script size, API times, quality score, accuracy) next to the video.
 */

const OUTPUT_DIR = path.join(__dirname, 'output');

// Session for the short cut, which skips the login screen. Mirrors what the
// login page stores for the demo engineer account (frontend/src/utils/authStorage.js).
const DEMO_SESSION = {
  userId: 'user-eng-002',
  name: 'Engineer DataForge',
  email: 'engineer@smartdatatest.com',
  role: 'data_eng',
  avatar: null,
  profile: { role: 'data_eng', setAt: '2026-01-01T00:00:00.000Z' },
};

type Plan = {
  name: string;
  chapters: ChapterScript[];
  /** Reach screens through the home page menus instead of opening them directly. */
  viaHome: boolean;
  /** Start already logged in. */
  signedIn: boolean;
};

test('apresentação completa da plataforma @apresentacao', async ({ page, context }) => {
  await recordTour(page, context, {
    name: 'smartdatatest-apresentacao',
    viaHome: true,
    signedIn: false,
    chapters: [
      chapters.login,
      chapters.home,
      chapters.methodology,
      chapters.pysparkAdvanced,
      chapters.qaChecklist,
      chapters.datasetMetrics,
      chapters.goldCleaning,
      chapters.dataAccuracy,
      chapters.syntheticData,
      chapters.evidenceChecklist,
      chapters.ragAssistant,
    ],
  });
});

test('corte de 3 minutos para o pitch @pitch', async ({ page, context }) => {
  await recordTour(page, context, {
    name: 'smartdatatest-pitch',
    viaHome: false,
    signedIn: true,
    chapters: [chapters.pysparkAdvanced, chapters.datasetMetrics],
  });
});

async function recordTour(page: Page, context: BrowserContext, plan: Plan): Promise<void> {
  const data = prepareDatasets(path.join(OUTPUT_DIR, 'dados'));
  const artifactsDir = path.join(OUTPUT_DIR, 'artefatos', plan.name);
  fs.mkdirSync(artifactsDir, { recursive: true });

  await installOverlay(context);
  await context.addInitScript(
    ({ session }) => {
      try {
        localStorage.setItem('smartdatatest_language', 'pt-BR');
        if (session) {
          const now = Date.now();
          localStorage.setItem(
            'smartdatatest_session',
            JSON.stringify({ ...session, loginAt: now, expiresAt: now + 8 * 60 * 60 * 1000 }),
          );
        }
      } catch {
        // about:blank has no storage.
      }
    },
    { session: plan.signedIn ? DEMO_SESSION : null },
  );

  const viewport = page.viewportSize() ?? { width: 1600, height: 900 };
  const scale = test.info().project.use.deviceScaleFactor ?? 1;
  const evenPixels = (value: number): number => Math.round((value * scale) / 2) * 2;
  const videoFile = path.join(OUTPUT_DIR, `${plan.name}.mp4`);
  const recorder = new ScreencastRecorder(page, {
    outputFile: videoFile,
    width: evenPixels(viewport.width),
    height: evenPixels(viewport.height),
    fps: Number(process.env.DEMO_FPS ?? 30),
    crf: Number(process.env.DEMO_CRF ?? 18),
  });
  const d = new Director(page, recorder, Number(process.env.DEMO_PACE ?? 1));
  const tour: Tour = { page, d, data, artifactsDir, metrics: {}, viaHome: plan.viaHome };

  // Dark backdrop for the opening card, before the app loads.
  await page.setContent('<html><body style="margin:0;background:#1a1a2e"></body></html>');
  await recorder.start();
  let failure: unknown = null;
  try {
    d.mark('Abertura');
    await d.card(OPENING, 5000);
    await d.hideCard();
    for (const [index, chapter] of plan.chapters.entries()) {
      d.setChapter(index + 1, plan.chapters.length);
      await test.step(`capítulo ${index + 1}: ${chapter.name}`, () => chapter(tour));
    }
    await d.hideCaption();
    d.mark('Encerramento');
    await d.card(CLOSING, 5500);
  } catch (error) {
    failure = error;
  }
  // Save the video even when a chapter failed: it shows where the tour broke.
  try {
    await saveOutputs(plan, recorder, d, tour, videoFile);
  } catch (error) {
    if (!failure) failure = error;
    else console.error('Também falhou ao salvar a gravação:', error);
  }
  if (failure) throw failure;
}

async function saveOutputs(
  plan: Plan,
  recorder: ScreencastRecorder,
  d: Director,
  tour: Tour,
  videoFile: string,
): Promise<void> {
  const duration = recorder.videoTime;
  await recorder.stop();
  const chaptersFile = path.join(OUTPUT_DIR, `${plan.name}.capitulos.txt`);
  const metricsFile = path.join(OUTPUT_DIR, `${plan.name}.metricas.json`);
  fs.writeFileSync(chaptersFile, d.chapterList(), 'utf8');
  const summary = {
    gerado_em: new Date().toISOString(),
    duracao_do_video_s: Math.round(duration),
    // What the tour asked of the API it started; a reused server keeps its own setting.
    llm: demoLlm(),
    ...tour.metrics,
  };
  fs.writeFileSync(metricsFile, JSON.stringify(summary, null, 2), 'utf8');

  const minutes = Math.floor(duration / 60);
  const seconds = Math.round(duration % 60);
  console.log(
    [
      '',
      `Vídeo:     ${videoFile} (${minutes} min ${seconds} s)`,
      `Capítulos: ${chaptersFile}`,
      `Métricas:  ${metricsFile}`,
      `Arquivos:  ${tour.artifactsDir}`,
      '',
    ].join('\n'),
  );
  test.info().annotations.push({ type: 'vídeo', description: videoFile });
}
