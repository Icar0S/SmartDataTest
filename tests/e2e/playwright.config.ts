import path from 'node:path';
import { defineConfig } from '@playwright/test';
import { demoLlmEnv } from './demo/llm';
import { baseURL, isLocal } from './demo/target';

/**
 * Recorded platform tour.
 *
 * Runs against production (https://smart-data-test.vercel.app) by default and
 * starts nothing. With DEMO_BASE_URL=http://localhost:3000 it starts the Flask
 * API (port 5000) and the React dev server from this repository instead,
 * reusing them if they are already running.
 */
const repoRoot = path.resolve(__dirname, '..', '..');
const python =
  process.env.DEMO_PYTHON ??
  path.join(repoRoot, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');

// Layout size in CSS pixels; the device scale factor sets the video resolution.
// 1440x810 at 4/3 renders 1920x1080 frames with the interface a third larger
// than native, which reads well on a projector.
const [viewportWidth, viewportHeight] = (process.env.DEMO_VIEWPORT ?? '1440x810').split('x').map(Number);
const deviceScaleFactor = Number(process.env.DEMO_SCALE ?? 4 / 3);

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  outputDir: 'output/test-results',
  timeout: 45 * 60_000,
  expect: { timeout: 30_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'output/relatorio', open: 'never' }]],
  use: {
    baseURL,
    browserName: 'chromium',
    viewport: { width: viewportWidth, height: viewportHeight },
    deviceScaleFactor,
    locale: 'pt-BR',
    timezoneId: 'America/Fortaleza',
    acceptDownloads: true,
    actionTimeout: 30_000,
    trace: 'retain-on-failure',
  },
  webServer: isLocal
    ? [
        {
          command: `"${python}" api.py`,
          cwd: path.join(repoRoot, 'src'),
          url: 'http://127.0.0.1:5000/',
          reuseExistingServer: true,
          timeout: 120_000,
          stdout: 'ignore',
          stderr: 'pipe',
          env: {
            // The repository .env sets FLASK_ENV=production, which demands API
            // tokens and a CORS allow-list. A local tour runs behind the React
            // dev proxy and needs neither. Process variables win over .env.
            FLASK_ENV: 'development',
            PYTHONUTF8: '1',
            PYTHONIOENCODING: 'utf-8',
            // One tour makes more requests than the hourly defaults allow: the
            // GOLD screen alone polls its status twice a second while cleaning.
            RATELIMIT_DEFAULT: '10000 per hour',
            RATELIMIT_UPLOAD: '1000 per hour',
            RATELIMIT_HEAVY: '1000 per hour',
            RATELIMIT_LLM: '1000 per hour',
            RATELIMIT_GENERATE: '1000 per hour',
            ...demoLlmEnv(),
          },
        },
        {
          command: 'npm start',
          cwd: path.join(repoRoot, 'frontend'),
          url: baseURL,
          reuseExistingServer: true,
          timeout: 300_000,
          stdout: 'ignore',
          stderr: 'pipe',
          env: {
            BROWSER: 'none',
            PORT: new URL(baseURL).port || '3000',
            // Outside CI mode, CRA shuts down when stdin closes, which it does
            // under Playwright.
            CI: 'true',
          },
        },
      ]
    : undefined,
});
