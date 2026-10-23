import path from 'node:path';
import { expect, type Locator, type Page, type Response } from '@playwright/test';
import type { DemoData } from './datasets';
import type { Director } from './director';
import { QA_ANSWERS, STORY, SYNTHETIC_COLUMNS, SYNTHETIC_ROWS } from './storyboard';

/**
 * One function per screen of the platform. Each one presents the screen and,
 * as an end-to-end test, asserts that it really worked: responses, rendered
 * results and downloaded files. Measured figures go into `tour.metrics`.
 */

export type Tour = {
  page: Page;
  d: Director;
  data: DemoData;
  artifactsDir: string;
  metrics: Record<string, unknown>;
  /** Full tour: reach each screen through the home page menus. Short cut: jump straight to it. */
  viaHome: boolean;
};

export type ChapterScript = (tour: Tour) => Promise<void>;

const SLOW = 5 * 60_000;
const SLOWEST = 15 * 60_000;

const isPost = (response: Response, fragment: string): boolean =>
  response.url().includes(fragment) && response.request().method() === 'POST';

/** Request start to last byte, in ms, as measured by the browser. */
const elapsedMs = (response: Response): number => Math.round(response.request().timing().responseEnd);

const normalize = (text: string): string =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const countBy = (values: string[]): Record<string, number> =>
  values.reduce<Record<string, number>>((counts, value) => ({ ...counts, [value]: (counts[value] ?? 0) + 1 }), {});

async function goHome(tour: Tour): Promise<void> {
  const { page, d } = tour;
  const back = page.locator('a[href="/"]').first();
  if (await back.isVisible().catch(() => false)) {
    await d.click(back, { after: 500 });
    await page.waitForURL((url) => url.pathname === '/');
  } else {
    await d.goto('/');
  }
  // The router keeps the previous page's scroll position.
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** Opens a screen through the home page menus, or directly in the short cut. */
async function open(
  tour: Tour,
  route: string,
  via: (page: Page) => { menu?: Locator; link: Locator },
): Promise<void> {
  const { page, d } = tour;
  // The previous chapter's caption would otherwise ride along to the next screen.
  await d.hideCaption();
  if (!tour.viaHome) {
    await d.goto(route);
    return;
  }
  if (new URL(page.url()).pathname !== '/') await goHome(tour);
  const { menu, link } = via(page);
  if (menu) {
    // The home menus open on hover, and clicking their button toggles them shut.
    await d.point(menu, true);
    await d.pause(600);
  }
  await d.click(link.first(), { after: 300 });
  await page.waitForURL((url) => url.pathname === route);
  await page.evaluate(() => window.scrollTo(0, 0));
}

const pysparkMenu = (page: Page): Locator => page.getByRole('button', { name: 'Generate PySpark Code Menu' });
const accuracyMenu = (page: Page): Locator => page.getByRole('button', { name: 'Data Accuracy Menu' });

export const login: ChapterScript = async (tour) => {
  const { page, d } = tour;
  await d.goto('/login');
  await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible();
  await d.chapter(STORY.login);
  await d.type(page.locator('input[type="email"]'), 'engineer@smartdatatest.com');
  await d.type(page.locator('input[type="password"]'), 'engineer123');
  await d.click(page.getByRole('button', { name: 'Entrar', exact: true }));

  const role = page.getByTestId('role-card-data_eng');
  await expect(role).toBeVisible({ timeout: 15_000 });
  await d.pause(700);
  await d.click(role);
  await d.click(page.getByRole('button', { name: 'Acessar plataforma' }));
  await page.waitForURL((url) => url.pathname === '/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('SmartDataTest');
};

export const home: ChapterScript = async (tour) => {
  const { page, d } = tour;
  if (new URL(page.url()).pathname !== '/') await d.goto('/');
  await d.chapter(STORY.home);
  const entries = [
    pysparkMenu(page),
    page.getByRole('link', { name: 'Checklist Support QA' }),
    accuracyMenu(page),
    page.getByRole('link', { name: 'Generate Synthetic Dataset' }),
    page.getByRole('link', { name: 'Methodology Framework' }),
    page.getByRole('link', { name: 'Support RAG' }),
  ];
  for (const entry of entries) {
    await d.point(entry, true);
    await d.pause(450);
  }
  for (let screen = 0; screen < 3; screen++) await d.scrollPage(820, 1900);
  await d.scrollToTop();
};

export const methodology: ChapterScript = async (tour) => {
  const { page, d } = tour;
  await open(tour, '/methodology', (p) => ({ link: p.getByRole('link', { name: 'Methodology Framework' }) }));
  await expect(page.getByText('Framework Metodológico para QA em Big Data com Suporte de IA')).toBeVisible();
  await d.chapter(STORY.methodology);
  for (let screen = 0; screen < 3; screen++) await d.scrollPage(700, 2200);
  await d.scrollToTop();
};

export const pysparkAdvanced: ChapterScript = async (tour) => {
  const { page, d } = tour;
  await open(tour, '/pyspark/advanced', (p) => ({
    menu: pysparkMenu(p),
    link: p.locator('a[href="/pyspark/advanced"]'),
  }));
  await expect(page.getByRole('heading', { name: 'Step 1: Upload Dataset' })).toBeVisible();
  await d.chapter(STORY.pyspark);

  const fileInput = page.locator('input[type="file"]');
  await d.upload(fileInput, tour.data.arrecadacao, fileInput);
  await expect(page.getByText(/Selected: arrecadacao-estado\.csv/)).toBeVisible();
  await d.point(page.getByText('Delimiter', { exact: true }), true);
  await d.say(STORY.pyspark.autoDetect);

  const inspected = page.waitForResponse((r) => isPost(r, '/api/datasets/inspect'), { timeout: SLOW });
  await d.click(page.getByRole('button', { name: 'Inspect Dataset' }));
  const inspection = await d.wait(inspected, STORY.pyspark.waiting);
  expect(inspection.ok()).toBe(true);
  const metadata = await inspection.json();
  await expect(page.getByRole('heading', { name: 'Step 2: Review Dataset Metadata' })).toBeVisible();
  // The whole file, not a misparsed fragment of it.
  expect(metadata.row_count).toBe(tour.data.expected.arrecadacao.rows);
  expect(metadata.column_count).toBe(tour.data.expected.arrecadacao.columns);

  const encoding = String(metadata.detected_options?.encoding ?? 'não informado');
  const delimiter = String(metadata.detected_options?.delimiter ?? 'não informado');
  await d.point(page.getByText('Auto-detected Settings'), true);
  await d.say(STORY.pyspark.detected(metadata.row_count, metadata.column_count, encoding, delimiter));
  await d.reveal(page.getByRole('heading', { name: 'Data Preview' }), 2200);
  await d.reveal(page.getByRole('heading', { name: 'Column Statistics' }), 600);
  await d.say(STORY.pyspark.stats);
  await d.scrollPage(600, 1600);

  // Human in the loop: make a partially filled column mandatory. Columns under
  // 5% nulls are already required by default.
  const columns: Array<{ name: string; null_ratio: number }> = metadata.columns ?? [];
  const withNulls = columns.filter((column) => column.null_ratio >= 0.05 && column.null_ratio <= 0.6);
  const partial =
    withNulls.find((column) => column.name === STORY.pyspark.requiredColumn) ??
    withNulls.sort((a, b) => a.null_ratio - b.null_ratio)[0];
  let adjustedColumn: string | null = null;
  if (partial) {
    const card = page
      .locator('div.p-4')
      .filter({ has: page.getByRole('heading', { name: partial.name, exact: true }) });
    const required = card.getByLabel('Required (not null)');
    const coverage = tour.data.coverage[partial.name];
    const gap = coverage && coverage.from > tour.data.firstYear ? { from: tour.data.firstYear, to: coverage.from - 1 } : undefined;
    await d.reveal(card, 500);
    await d.say(STORY.pyspark.adjust(partial.name, partial.null_ratio * 100, gap), 900);
    await d.click(required);
    await expect(required).toBeChecked();
    adjustedColumn = partial.name;
  }

  const specified = page.waitForResponse((r) => isPost(r, '/api/datasets/generate-dsl'), { timeout: SLOW });
  await d.click(page.getByRole('button', { name: 'Generate JSON' }));
  const specification = await d.wait(specified, STORY.pyspark.waiting);
  const rules: Array<{ type: string }> = (await specification.json()).dsl?.rules ?? [];
  await expect(page.getByRole('heading', { name: 'Step 3: Review and Edit JSON' })).toBeVisible();
  expect(rules.length).toBeGreaterThan(0);
  await d.say(STORY.pyspark.json(rules.length), 1200);
  await d.scrollInside(page.locator('textarea'), 1400, 3200);

  const generated = page.waitForResponse((r) => isPost(r, '/api/datasets/generate-pyspark'), { timeout: SLOW });
  await d.click(page.getByRole('button', { name: 'Generate PySpark Code' }));
  const generation = await d.wait(generated, STORY.pyspark.waiting);
  const code: string = (await generation.json()).pyspark_code ?? '';
  await expect(page.getByText('PySpark code generated successfully!')).toBeVisible();
  expect(code).toContain('SparkSession');
  const codeLines = code.split('\n').length;
  await d.say(STORY.pyspark.code(codeLines), 1500);
  await d.scrollInside(page.locator('div[class*="max-h-[600px]"]'), 2600, 4200);
  await d.say(STORY.pyspark.download, 600);
  const script = await d.download(page.getByRole('button', { name: 'Download .py' }), tour.artifactsDir);

  const timings = {
    inspecao: elapsedMs(inspection),
    especificacao: elapsedMs(specification),
    codigo: elapsedMs(generation),
  };
  tour.metrics.gerador_pyspark = {
    arquivo: path.basename(tour.data.arrecadacao),
    linhas: metadata.row_count,
    colunas: metadata.column_count,
    encoding_detectado: encoding,
    separador_detectado: delimiter,
    coluna_ajustada_para_obrigatoria: adjustedColumn,
    regras: rules.length,
    regras_por_tipo: countBy(rules.map((rule) => rule.type)),
    linhas_do_script: codeLines,
    script: path.basename(script),
    tempo_da_api_ms: { ...timings, total: timings.inspecao + timings.especificacao + timings.codigo },
  };
};

export const qaChecklist: ChapterScript = async (tour) => {
  const { page, d } = tour;
  await open(tour, '/qa-checklist', (p) => ({ menu: pysparkMenu(p), link: p.locator('a[href="/qa-checklist"]') }));
  await expect(page.getByRole('heading', { name: 'Checklist de Testes QA' })).toBeVisible();
  await d.chapter(STORY.qaChat);

  const answer = page.getByLabel('Campo de mensagem');
  for (const [index, text] of QA_ANSWERS.entries()) {
    await d.pause(600);
    if (text) await d.type(answer, text, 22);
    if (index < QA_ANSWERS.length - 1) {
      await d.click(page.getByRole('button', { name: 'Próxima' }), { after: 300, highlight: false });
      continue;
    }
    const asked = page.waitForResponse((r) => isPost(r, '/ask'), { timeout: SLOW });
    await d.click(page.getByRole('button', { name: 'Gerar JSON e PySpark' }));
    expect((await d.wait(asked, STORY.qaChat.waiting)).ok()).toBe(true);
  }

  const codeHeading = page.getByRole('heading', { name: 'Código PySpark' });
  await expect(codeHeading).toBeVisible();
  await d.say(STORY.qaChat.result);
  await d.reveal(page.getByRole('heading', { name: 'JSON', exact: true }), 2200);
  await d.reveal(codeHeading, 2600);
  await expect(page.getByText(/SparkSession/).first()).toBeVisible();
};

export const datasetMetrics: ChapterScript = async (tour) => {
  const { page, d } = tour;
  await open(tour, '/data-accuracy/metrics', (p) => ({
    menu: accuracyMenu(p),
    link: p.locator('a[href="/data-accuracy/metrics"]'),
  }));
  await expect(page.getByRole('heading', { name: 'Upload do Dataset' })).toBeVisible();
  await d.chapter(STORY.metrics);

  await d.upload(
    page.getByLabel('Selecionar arquivo', { exact: true }),
    tour.data.arrecadacao,
    page.getByRole('button', { name: /Arraste seu dataset aqui/ }),
  );
  await expect(page.getByText('arrecadacao-estado.csv', { exact: true })).toBeVisible();
  const analyzed = page.waitForResponse((r) => isPost(r, '/api/metrics/analyze'), { timeout: SLOW });
  await d.click(page.getByRole('button', { name: 'Analisar Dataset' }));
  const analysis = await d.wait(analyzed, STORY.metrics.waiting);
  expect(analysis.ok()).toBe(true);
  const report = await analysis.json();
  // A ';' Latin-1 file once came back as 2,674 rows × 2 columns here, with a
  // plausible score computed on the wrong data.
  expect(report.metrics?.dataset_info?.rows).toBe(tour.data.expected.arrecadacao.rows);
  expect(report.metrics?.dataset_info?.columns).toBe(tour.data.expected.arrecadacao.columns);

  const score = page.getByRole('heading', { name: 'Score Geral de Qualidade' });
  await expect(score).toBeVisible();
  await d.point(score, true);
  await d.say(STORY.metrics.score(report.overall_quality_score));
  await d.reveal(page.getByRole('heading', { name: 'Completude', exact: true, level: 3 }), 2600);
  await d.reveal(page.getByRole('heading', { name: 'Informações do Dataset', level: 3 }), 1800);
  const problems = page.getByRole('heading', { name: 'Colunas Problemáticas', level: 3 });
  if (await problems.isVisible()) {
    await d.reveal(problems, 500);
    await d.say(STORY.metrics.problems);
  }
  const recommendations = page.getByRole('heading', { name: 'Recomendações', level: 3 });
  if (await recommendations.isVisible()) await d.reveal(recommendations, 3200);

  tour.metrics.metricas_de_qualidade = {
    arquivo: path.basename(tour.data.arrecadacao),
    score_geral: report.overall_quality_score,
    completude: report.metrics?.completeness?.overall_completeness,
    unicidade: report.metrics?.uniqueness?.overall_uniqueness,
    validade: report.metrics?.validity?.overall_validity,
    consistencia: report.metrics?.consistency?.overall_consistency,
    recomendacoes: report.recommendations?.length ?? 0,
    tempo_da_api_ms: elapsedMs(analysis),
  };
};

export const goldCleaning: ChapterScript = async (tour) => {
  const { page, d } = tour;
  await open(tour, '/data-accuracy/test-gold', (p) => ({
    menu: accuracyMenu(p),
    link: p.locator('a[href="/data-accuracy/test-gold"]'),
  }));
  await expect(page.getByRole('heading', { name: 'Upload Dataset' })).toBeVisible();
  await d.chapter(STORY.gold);

  await d.upload(
    page.locator('input[type="file"]'),
    tour.data.goldDirty,
    page.getByRole('button', { name: /Drop your dataset here/ }),
  );
  await expect(page.getByRole('heading', { name: 'Dataset Information' })).toBeVisible({ timeout: 60_000 });
  await d.say(STORY.gold.preview, 600);
  await d.reveal(page.getByRole('heading', { name: 'Sample Data (first 20 rows)' }), 2600);
  await d.reveal(page.getByRole('heading', { name: 'Cleaning Options' }), 500);
  await d.say(STORY.gold.options, 900);
  const dropDuplicates = page.getByLabel('Remove duplicate rows');
  if (!(await dropDuplicates.isChecked())) await d.click(dropDuplicates);

  const completed = page.waitForResponse(
    async (r) =>
      r.url().includes('/api/gold/status') && (await r.json().catch(() => null))?.state === 'completed',
    { timeout: SLOW },
  );
  await d.click(page.getByRole('button', { name: 'Generate GOLD Dataset' }));
  const status = await d.wait(completed, STORY.gold.waiting);
  const report = (await status.json()).report;
  const reportHeading = page.getByRole('heading', { name: 'Cleaning Report' });
  await expect(reportHeading).toBeVisible();
  await d.reveal(reportHeading, 500);
  await d.say(STORY.gold.report(report));

  expect.soft(report.rowsRead).toBe(tour.data.expected.gold.rows);
  expect.soft(report.rowsWritten).toBe(tour.data.expected.gold.rows - tour.data.expected.gold.duplicates);
  expect.soft(report.columnsAfter).toBe(tour.data.expected.gold.columns - tour.data.expected.gold.emptyColumns);

  await d.reveal(page.getByRole('heading', { name: 'Changes Applied' }), 2400);
  await d.reveal(page.getByRole('heading', { name: 'Null Values (Top 20 Columns)' }), 2200);
  await d.reveal(page.getByRole('heading', { name: /Cleaned Dataset Preview/ }), 2400);
  await d.say(STORY.gold.download, 600);
  const cleaned = await d.download(page.getByRole('button', { name: 'Download CSV' }), tour.artifactsDir);

  tour.metrics.limpeza_gold = {
    arquivo: path.basename(tour.data.goldDirty),
    linhas_lidas: report.rowsRead,
    linhas_gravadas: report.rowsWritten,
    colunas_antes: report.columnsBefore,
    colunas_depois: report.columnsAfter,
    colunas_removidas: report.removedColumns,
    alteracoes: report.changedRows,
    arquivo_limpo: path.basename(cleaned),
  };
};

export const dataAccuracy: ChapterScript = async (tour) => {
  const { page, d } = tour;
  await open(tour, '/data-accuracy', (p) => ({ menu: accuracyMenu(p), link: p.locator('a[href="/data-accuracy"]') }));
  await expect(page.getByRole('heading', { name: 'Acurácia de Dados (Datasets)' })).toBeVisible();
  await d.chapter(STORY.accuracy);

  const goldTitle = 'Dataset GOLD (Referência)';
  const targetTitle = 'Dataset a Validar';
  const goldUploaded = page.waitForResponse((r) => isPost(r, '/api/accuracy/upload'), { timeout: SLOW });
  await d.upload(page.getByLabel(`Select file for ${goldTitle}`), tour.data.accuracyGold, page.getByRole('heading', { name: goldTitle }));
  const gold = await (await goldUploaded).json();
  const targetUploaded = page.waitForResponse((r) => isPost(r, '/api/accuracy/upload'), { timeout: SLOW });
  await d.upload(
    page.getByLabel(`Select file for ${targetTitle}`),
    tour.data.accuracyTarget,
    page.getByRole('heading', { name: targetTitle }),
  );
  expect((await targetUploaded).ok()).toBe(true);
  await expect(page.getByRole('heading', { name: 'Mapeamento de Colunas' })).toBeVisible();

  const columns: string[] = gold.columns ?? [];
  const column = (name: string): string => {
    const found = columns.find((candidate) => normalize(candidate) === name);
    if (!found) throw new Error(`Coluna "${name}" não veio no upload do GOLD: ${columns.join(', ')}`);
    return found;
  };
  const keyArea = page.locator('xpath=//label[normalize-space()="Colunas Chave (Identificadores)"]/../..');
  const valueArea = page.locator('xpath=//label[normalize-space()="Colunas de Valor (Comparação)"]/../..');
  for (const key of ['ano', 'mes', 'uf']) await d.click(keyArea.getByLabel(column(key), { exact: true }), { after: 250 });
  for (const value of ['irpf', 'cofins_demais']) await d.click(valueArea.getByLabel(column(value), { exact: true }), { after: 250 });
  await d.say(STORY.accuracy.mapping, 900);
  await d.reveal(page.getByText('Normalização de Chaves'), 2400);

  const compared = page.waitForResponse((r) => isPost(r, '/api/accuracy/compare-correct'), { timeout: SLOW });
  await d.click(page.getByRole('button', { name: 'Comparar e corrigir datasets' }));
  const comparison = await d.wait(compared, STORY.accuracy.waiting);
  expect(comparison.ok()).toBe(true);
  const summary = (await comparison.json()).summary;

  const summaryHeading = page.getByRole('heading', { name: 'Resumo da Comparação' });
  await expect(summaryHeading).toBeVisible();
  await d.reveal(summaryHeading, 500);
  await d.say(STORY.accuracy.result(summary));
  expect.soft(summary.missing_in_target).toBe(tour.data.expected.accuracy.missing);
  expect.soft(summary.extra_in_target).toBe(tour.data.expected.accuracy.extra);
  expect.soft(summary.mismatches_total).toBe(tour.data.expected.accuracy.mismatches);

  await d.reveal(page.getByRole('heading', { name: /Diferenças Detectadas/ }), 3200);
  await d.reveal(page.getByRole('heading', { name: 'Downloads' }), 500);
  await d.say(STORY.accuracy.download, 600);
  const corrected = await d.download(page.getByRole('button', { name: 'Baixar dataset corrigido' }), tour.artifactsDir);

  tour.metrics.acuracia = {
    gold: path.basename(tour.data.accuracyGold),
    target: path.basename(tour.data.accuracyTarget),
    resumo: summary,
    esperado: tour.data.expected.accuracy,
    arquivo_corrigido: path.basename(corrected),
    tempo_da_api_ms: elapsedMs(comparison),
  };
};

export const syntheticData: ChapterScript = async (tour) => {
  const { page, d } = tour;
  await open(tour, '/generate-dataset', (p) => ({ link: p.getByRole('link', { name: 'Generate Synthetic Dataset' }) }));
  await expect(page.getByRole('heading', { name: 'Dataset Schema' })).toBeVisible();
  await d.chapter(STORY.synthetic);

  await d.choose(page.getByLabel('Number of columns'), String(SYNTHETIC_COLUMNS.length));
  await d.say(STORY.synthetic.schema, 900);
  for (const [index, spec] of SYNTHETIC_COLUMNS.entries()) {
    const position = index + 1;
    // Each column block is keyed by its name, so the name input remounts on every keystroke.
    await d.typeByFill(page.getByLabel(`Name for column ${position}`, { exact: true }), spec.name);
    await d.choose(page.getByLabel(`Type for column ${position}`, { exact: true }), spec.type);
    if (spec.min) await d.typeByFill(page.getByLabel(`Min value for ${spec.name}`, { exact: true }), spec.min, 35);
    if (spec.max) await d.typeByFill(page.getByLabel(`Max value for ${spec.name}`, { exact: true }), spec.max, 35);
    if (spec.start) await d.fill(page.getByLabel(`Start date for ${spec.name}`, { exact: true }), spec.start);
    if (spec.end) await d.fill(page.getByLabel(`End date for ${spec.name}`, { exact: true }), spec.end);
    if (spec.categories) await d.fill(page.getByLabel(`Categories for ${spec.name}`, { exact: true }), spec.categories);
  }
  await d.typeByFill(page.getByLabel('Number of rows to generate'), String(SYNTHETIC_ROWS));

  const previewed = page.waitForResponse((r) => isPost(r, '/api/synth/preview'), { timeout: SLOW });
  await d.click(page.getByRole('button', { name: 'Preview 50 rows' }));
  const preview = await d.wait(previewed, STORY.synthetic.waitingPreview);
  expect(preview.ok()).toBe(true);
  // Without a working LLM the API quietly returns placeholder rows ("mock_uf_0").
  const fallback = ((await preview.json()).logs ?? []).find((line: string) => /mock data/i.test(line));
  expect(
    fallback,
    `A prévia veio do gerador mock, não do LLM ("${fallback}"). Verifique o LLM da API (README, seção "LLM").`,
  ).toBeUndefined();
  const previewHeading = page.getByRole('heading', { name: 'Preview', exact: true });
  await expect(previewHeading).toBeVisible();
  await d.reveal(previewHeading, 500);
  await d.say(STORY.synthetic.preview, 3600);
  await expect(page.locator('table tbody tr').first()).toBeVisible();

  const generated = page.waitForResponse((r) => isPost(r, '/api/synth/generate'), { timeout: SLOWEST });
  await d.click(page.getByRole('button', { name: 'Generate full dataset' }));
  const generation = await d.wait(generated, STORY.synthetic.waitingFull);
  expect(generation.ok()).toBe(true);
  const ready = page.getByRole('heading', { name: 'Download Ready' });
  await expect(ready).toBeVisible();
  await d.reveal(ready, 500);
  await d.say(STORY.synthetic.generated(SYNTHETIC_ROWS), 1500);
  const dataset = await d.download(page.getByRole('button', { name: 'Download Dataset' }), tour.artifactsDir);

  tour.metrics.dados_sinteticos = {
    colunas: SYNTHETIC_COLUMNS.map((spec) => `${spec.name}:${spec.type}`),
    linhas: SYNTHETIC_ROWS,
    arquivo: path.basename(dataset),
    tempo_da_api_ms: { previa: elapsedMs(preview), geracao: elapsedMs(generation) },
  };
};

export const evidenceChecklist: ChapterScript = async (tour) => {
  const { page, d } = tour;
  await open(tour, '/checklist', (p) => ({ link: p.getByRole('link', { name: 'Checklist Support QA' }) }));
  await expect(page.getByRole('heading', { name: 'Dimensões' })).toBeVisible();
  await d.chapter(STORY.checklist);

  const markDone = (): Locator => page.getByRole('button', { name: 'Marcar como feito', exact: true }).first();
  await d.click(page.getByRole('button', { name: /Data Quality & ETL/ }));
  await d.click(markDone());
  await d.click(page.getByRole('button', { name: 'Ver manual do item' }).first());
  await expect(page.getByRole('dialog')).toBeVisible();
  await d.say(STORY.checklist.manual, 3600);
  await d.click(page.getByRole('button', { name: 'Fechar modal' }));
  for (const dimension of [/Security & Privacy/, /CI\/CD & Automation/]) {
    await d.click(page.getByRole('button', { name: dimension }));
    await d.click(markDone());
  }

  const recommended = page.waitForResponse((r) => isPost(r, '/recommendations'), { timeout: SLOW });
  await d.click(page.getByRole('button', { name: 'Gerar Recomendações' }));
  expect((await d.wait(recommended, STORY.checklist.waiting)).ok()).toBe(true);
  const recommendations = page.getByRole('heading', { name: 'Recomendações' });
  await expect(recommendations).toBeVisible();
  await d.reveal(recommendations, 500);
  await d.say(STORY.checklist.recommendations, 4200);
  await d.say(STORY.checklist.report, 600);
  const pdf = await d.download(page.getByRole('button', { name: /Download PDF/ }), tour.artifactsDir);
  tour.metrics.checklist = { relatorio: path.basename(pdf) };
};

export const ragAssistant: ChapterScript = async (tour) => {
  const { page, d } = tour;
  await open(tour, '/support-rag', (p) => ({ link: p.getByRole('link', { name: 'Support RAG' }) }));
  await expect(page.getByRole('heading', { name: 'AI Documentation Assistant' })).toBeVisible();
  await d.chapter(STORY.rag);

  const input = page.getByPlaceholder('Type your message...');
  await d.type(input, STORY.rag.question, 22);
  const replied = page.waitForResponse((r) => isPost(r, '/api/rag/chat-stream'), { timeout: SLOW });
  await d.click(page.getByRole('button', { name: 'Send message' }));
  await d.wait(
    (async () => {
      expect((await replied).ok()).toBe(true);
      // The input is disabled while the answer streams in.
      await expect(input).toBeEnabled({ timeout: SLOW });
    })(),
    STORY.rag.waiting,
  );
  const answer = page.locator('div.justify-start').last();
  await expect(answer).not.toBeEmpty();
  // The API composes the whole answer before streaming it, so it lands at once
  // and the chat jumps to the citations below it. Go back and read it first.
  await d.reveal(answer, 600);
  await d.say(STORY.rag.answer, 3500);
  const messages = answer.locator('xpath=ancestor::div[contains(@class, "overflow-y-auto")][1]');
  await d.scrollInside(messages, 700, 6000);
  const sources = page.getByRole('heading', { name: 'Sources:' });
  if (await sources.isVisible()) await d.reveal(sources, 3000);
  else await d.pause(3000);
  tour.metrics.assistente_rag = {
    pergunta: STORY.rag.question,
    caracteres_da_resposta: (await answer.innerText()).length,
    fontes_citadas: await page.locator('h3:has-text("Sources:") + ul > li').count(),
  };
};
