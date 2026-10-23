import fs from 'node:fs';
import path from 'node:path';

/**
 * Datasets for the tour. The tour runs on the public "arrecadação por estado"
 * file published by the Receita Federal, and derives two scenarios from it:
 *
 * - GOLD × TARGET for the accuracy screen: the official figures against a
 *   "legacy system" copy with cosmetic differences the normalisation must
 *   absorb (case, accents, decimal comma) and real ones it must report.
 * - A dirty export for the GOLD cleaning screen.
 *
 * The derived files are rebuilt on every run, so their expected outcomes are
 * known exactly and the test can assert them.
 */

export type DemoData = {
  arrecadacao: string;
  /** For each column of the arrecadação file, the first and last year with values. */
  coverage: Record<string, { from: number; to: number }>;
  firstYear: number;
  accuracyGold: string;
  accuracyTarget: string;
  goldDirty: string;
  expected: {
    arrecadacao: { rows: number; columns: number };
    accuracy: { missing: number; extra: number; mismatches: number };
    gold: { rows: number; duplicates: number; columns: number; emptyColumns: number };
  };
};

type Collection = { ano: number; mes: string; uf: string; irpf: number; cofins: number };

const FIXTURE = path.join(__dirname, '..', 'fixtures', 'arrecadacao-estado.csv');
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const ROWS_PER_YEAR = 27 * MONTHS.length;

// Deterministic edits applied to the TARGET copy, by row index within the year.
const CHANGED_IRPF = [7, 58, 133, 201, 290];
const CHANGED_COFINS = [12, 99, 247];
const MISSING_ROWS = [150, 311];
const DUPLICATED_ROWS = 12;

export function prepareDatasets(outputDir: string): DemoData {
  const source = process.env.DEMO_ARRECADACAO_CSV ?? FIXTURE;
  if (!fs.existsSync(source)) {
    throw new Error(
      `Arquivo de arrecadação não encontrado: ${source}\n` +
        'Coloque o "arrecadacao-estado.csv" (Receita Federal, Portal de Dados Abertos) em tests/e2e/fixtures/ ' +
        'ou aponte DEMO_ARRECADACAO_CSV para ele.',
    );
  }
  fs.mkdirSync(outputDir, { recursive: true });

  const profile = profileFile(source);
  const year = readCollections(source);
  const accuracyGold = path.join(outputDir, 'acuracia-gold.csv');
  const accuracyTarget = path.join(outputDir, 'acuracia-target.csv');
  const goldDirty = path.join(outputDir, 'gold-exportacao-suja.csv');

  writeCsv(
    accuracyGold,
    ['ano', 'mes', 'uf', 'irpf', 'cofins_demais'],
    year.map((row) => [String(row.ano), row.mes, row.uf, row.irpf.toFixed(2), row.cofins.toFixed(2)]),
    ',',
  );

  let mismatches = 0;
  const target = year.flatMap((row, index) => {
    if (MISSING_ROWS.includes(index)) return [];
    let { irpf, cofins } = row;
    if (CHANGED_IRPF.includes(index)) irpf = round2(irpf * 1.025);
    if (CHANGED_COFINS.includes(index)) cofins = round2(cofins * 0.97);
    mismatches += Number(Math.abs(irpf - row.irpf) >= 0.01) + Number(Math.abs(cofins - row.cofins) >= 0.01);
    return [[
      String(row.ano),
      stripAccents(row.mes), // "Março" becomes "Marco"
      index % 9 === 0 ? ` ${row.uf.toLowerCase()} ` : row.uf,
      decimalComma(irpf),
      decimalComma(cofins),
    ]];
  });
  target.push([String(year[0].ano), 'Dezembro', 'XX', decimalComma(0), decimalComma(0)]);
  writeCsv(accuracyTarget, ['Ano', 'Mês', 'UF', 'IRPF', 'COFINS - DEMAIS'], target, ',');

  const brl = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dirty = year.map((row, index) => [
    String(row.ano),
    row.mes,
    index % 7 === 0 ? `${row.uf}​ ` : index % 5 === 0 ? `  ${row.uf}` : row.uf,
    brl.format(row.irpf),
    brl.format(row.cofins),
    referenceDate(row, index),
    '',
  ]);
  dirty.push(...dirty.slice(0, DUPLICATED_ROWS).map((row) => [...row]));
  const dirtyHeader = [' Ano ', 'Mês de Referência', 'UF', 'IRPF (R$)', 'COFINS Demais (R$)', 'Data de Atualização', 'Observação'];
  writeCsv(goldDirty, dirtyHeader, dirty, ';');

  return {
    arrecadacao: source,
    coverage: profile.coverage,
    firstYear: profile.firstYear,
    accuracyGold,
    accuracyTarget,
    goldDirty,
    expected: {
      arrecadacao: { rows: profile.rows, columns: profile.columns },
      accuracy: { missing: MISSING_ROWS.length, extra: 1, mismatches },
      gold: { rows: dirty.length, duplicates: DUPLICATED_ROWS, columns: dirtyHeader.length, emptyColumns: 1 },
    },
  };
}

/**
 * Shape of the file as any correct reader must see it: every non-empty line
 * after the header is a row (including one made only of separators), and
 * every field of the header is a column (including two unnamed ones).
 */
function profileFile(file: string): {
  rows: number;
  columns: number;
  firstYear: number;
  coverage: Record<string, { from: number; to: number }>;
} {
  const lines = fs.readFileSync(file).toString('latin1').split(/\r?\n/);
  const header = lines[0].split(';');
  const records = lines.slice(1).filter((line) => line.length > 0).map((line) => line.split(';'));
  const coverage: Record<string, { from: number; to: number }> = {};
  let firstYear = Number.POSITIVE_INFINITY;
  for (const cells of records) {
    const year = Number(cells[0]);
    if (!Number.isFinite(year) || year === 0) continue;
    firstYear = Math.min(firstYear, year);
    header.forEach((name, index) => {
      if (!name || !(cells[index] ?? '').trim()) return;
      const span = coverage[name] ?? { from: year, to: year };
      coverage[name] = { from: Math.min(span.from, year), to: Math.max(span.to, year) };
    });
  }
  return { rows: records.length, columns: header.length, firstYear, coverage };
}

/**
 * Rows of the latest year with all 27 states in all 12 months. COFINS comes
 * from "COFINS - DEMAIS": the plain "COFINS" column is empty in recent years,
 * after the Receita Federal split it into "FINANCEIRAS" and "DEMAIS".
 */
function readCollections(file: string): Collection[] {
  const lines = fs.readFileSync(file).toString('latin1').split(/\r?\n/);
  const header = lines[0].split(';');
  const column = (name: string): number => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error(`Coluna "${name}" não encontrada em ${file}`);
    return index;
  };
  const [ano, mes, uf, irpf, cofins] = ['Ano', 'Mês', 'UF', 'IRPF', 'COFINS - DEMAIS'].map(column);

  const rows = lines
    .slice(1)
    .map((line) => line.split(';'))
    .filter((cells) => cells[ano]?.trim())
    .map((cells) => ({
      ano: Number(cells[ano]),
      mes: cells[mes].trim(),
      uf: cells[uf].trim(),
      irpf: parseBrazilianNumber(cells[irpf]),
      cofins: parseBrazilianNumber(cells[cofins]),
    }))
    .filter((row): row is Collection => row.irpf !== null && row.cofins !== null);

  const years = [...new Set(rows.map((row) => row.ano))].sort((a, b) => b - a);
  const complete = years.find((year) => rows.filter((row) => row.ano === year).length === ROWS_PER_YEAR);
  if (complete === undefined) throw new Error(`Nenhum ano completo (27 UFs × 12 meses) em ${file}`);
  return rows.filter((row) => row.ano === complete);
}

function parseBrazilianNumber(value: string | undefined): number | null {
  const text = (value ?? '').trim();
  if (!text) return null;
  const parsed = Number(text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The 15th of the reference month, in one of three common spellings. */
function referenceDate(row: Collection, index: number): string {
  const month = String(MONTHS.indexOf(row.mes) + 1).padStart(2, '0');
  const formats = [`${row.ano}-${month}-15`, `15/${month}/${row.ano}`, `15.${month}.${row.ano}`];
  return formats[index % formats.length];
}

function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function decimalComma(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function writeCsv(file: string, header: string[], rows: string[][], separator: string): void {
  const quote = (value: string): string =>
    value.includes(separator) || value.includes('"') || value.includes('\n') ? `"${value.replace(/"/g, '""')}"` : value;
  const body = [header, ...rows].map((row) => row.map(quote).join(separator)).join('\r\n');
  fs.writeFileSync(file, `${body}\r\n`, 'utf8');
}
