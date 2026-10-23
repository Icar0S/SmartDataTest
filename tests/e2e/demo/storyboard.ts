/**
 * Everything the video says: title cards, chapter captions and the inputs typed
 * during the tour. Edit this file to change the presentation's wording without
 * touching the automation in chapters.ts.
 */
import type { Card } from './overlay';

export type Chapter = { title: string; text: string };

const number = new Intl.NumberFormat('pt-BR');
const percent = (value: number): string => `${number.format(Math.round(value * 10) / 10)}%`;

export const OPENING: Card = {
  kicker: 'Demonstração da plataforma',
  title: 'SmartDataTest',
  subtitle: 'Testes de qualidade de dados assistidos por LLM + RAG para sistemas Big Data',
  lines: ['Percurso gravado automaticamente com Playwright na aplicação real', 'UECE · código aberto (MIT)'],
};

export const CLOSING: Card = {
  kicker: 'SmartDataTest',
  title: 'Obrigado',
  subtitle: 'Do dataset ao código de validação: IA onde ajuda, determinismo onde é crítico.',
  lines: ['smart-data-test.vercel.app', 'github.com/Icar0S/SmartDataTest'],
};

export const STORY = {
  login: {
    title: 'Acesso à plataforma',
    text: 'Login com usuário de demonstração e escolha do perfil profissional.',
  },
  home: {
    title: 'Visão geral',
    text: 'A página inicial dá acesso a todos os fluxos: PySpark, checklists de QA, acurácia, métricas, dados sintéticos e o assistente RAG.',
  },
  methodology: {
    title: 'Framework metodológico',
    text: 'Quatro fases de QA para Big Data, com uma camada transversal de IA (LLM + RAG) e seis dimensões de qualidade de dados.',
  },
  pyspark: {
    title: 'Gerador avançado de PySpark',
    text: 'Dados abertos reais: arrecadação federal por estado, em ISO-8859-1 e separada por ponto e vírgula.',
    autoDetect: 'Encoding e separador ficam em detecção automática.',
    waiting: 'Processando o dataset',
    detected: (rows: number, columns: number, encoding: string, delimiter: string): string =>
      `${number.format(rows)} linhas × ${columns} colunas. Detectados automaticamente: encoding ${encoding} e separador "${delimiter}".`,
    stats: 'Tipos, nulos, unicidade, faixas e amostras de cada coluna, inferidos do próprio dado.',
    /** Column made mandatory during the review step; any column with nulls works. */
    requiredColumn: 'COFINS - DEMAIS',
    adjust: (column: string, nullPercent: number, gap?: { from: number; to: number }): string =>
      `Revisão humana: "${column}" (${percent(nullPercent)} de nulos) passa a ser obrigatória. ` +
      (gap
        ? `O script vai apontar as linhas de ${gap.from} a ${gap.to}, anteriores ao registro dessa coluna na base.`
        : 'O script vai apontar cada linha sem valor.'),
    json: (rules: number): string => `${number.format(rules)} regras numa especificação JSON revisável e versionável.`,
    code: (lines: number): string =>
      `Script PySpark de ${number.format(lines)} linhas, gerado de forma determinística, sem LLM: legível, auditável e pronto para o Spark.`,
    download: 'O script sai como .py, pronto para rodar no cluster ou no Colab.',
  },
  qaChat: {
    title: 'Checklist QA conversacional',
    text: 'Perguntas guiadas sobre schema, integridade, restrições de valor e relações entre colunas.',
    waiting: 'Gerando a especificação',
    result: 'As respostas viram a mesma especificação JSON e um script PySpark de validação.',
  },
  metrics: {
    title: 'Métricas de qualidade',
    text: 'O mesmo arquivo de arrecadação, avaliado em completude, unicidade, validade e consistência.',
    waiting: 'Analisando o dataset',
    score: (score: number): string =>
      `Score geral de ${percent(score)}. Completude e validade pesam 30% cada; unicidade e consistência, 20% cada.`,
    problems: 'Colunas problemáticas e recomendações por severidade mostram onde agir primeiro.',
  },
  gold: {
    title: 'Dataset GOLD: limpeza automatizada',
    text: 'Recorte da arrecadação com defeitos típicos de exportação: coluna vazia, cabeçalhos irregulares, espaços invisíveis, números no formato brasileiro, datas mistas e duplicatas.',
    preview: 'Formato e colunas detectados; a amostra já mostra os defeitos.',
    options: 'O usuário escolhe as operações de limpeza. Aqui também removemos as linhas duplicadas.',
    waiting: 'Limpando o dataset',
    report: (report: { rowsRead: number; rowsWritten: number; columnsBefore: number; columnsAfter: number }): string =>
      `${number.format(report.rowsRead)} linhas lidas e ${number.format(report.rowsWritten)} gravadas; ` +
      `colunas: ${report.columnsBefore} → ${report.columnsAfter}.`,
    download: 'O dataset limpo sai em CSV, pronto para servir de referência.',
  },
  accuracy: {
    title: 'Acurácia: GOLD × TARGET',
    text: 'Referência oficial (GOLD) contra a cópia de um sistema legado (TARGET), com formatos diferentes e divergências reais.',
    mapping: 'Chaves: ano, mês e UF. Valores: IRPF e COFINS (demais). A normalização ignora caixa, acentos e vírgula decimal.',
    waiting: 'Comparando os datasets',
    result: (summary: {
      common_keys: number;
      missing_in_target: number;
      extra_in_target: number;
      mismatches_total: number;
      accuracy: number;
    }): string =>
      `${number.format(summary.common_keys)} chaves comuns, ${summary.missing_in_target} ausentes, ` +
      `${summary.extra_in_target} extra e ${summary.mismatches_total} divergências. Acurácia de ${percent(summary.accuracy * 100)}.`,
    download: 'Saem o dataset corrigido e o relatório de diferenças.',
  },
  synthetic: {
    title: 'Dados sintéticos com LLM',
    text: 'Dados de teste realistas em pt-BR, para homologar sem expor dados pessoais.',
    schema: 'O schema define nomes, tipos e restrições: faixas, categorias, datas e unicidade.',
    waitingPreview: 'Gerando a prévia com o LLM',
    preview: 'Prévia de 50 linhas gerada pelo LLM e conferida contra o schema.',
    waitingFull: 'Gerando o dataset com o LLM',
    generated: (rows: number): string => `${number.format(rows)} linhas prontas para download em CSV.`,
  },
  checklist: {
    title: 'Checklist de QA baseado em evidências',
    text: '14 práticas em 7 dimensões, cada uma com referência da literatura.',
    manual: 'Cada prática traz manual de aplicação, referências e prioridade.',
    waiting: 'Gerando recomendações',
    recommendations: 'As recomendações vêm do RAG, a partir das práticas ainda pendentes.',
    report: 'O progresso vira relatório em PDF.',
  },
  rag: {
    title: 'Assistente RAG',
    text: 'Respostas fundamentadas numa base curada de revisões sistemáticas, revisão multivocal e guias técnicos.',
    question:
      'Quais testes de qualidade de dados devo aplicar em um pipeline Spark que consolida a arrecadação federal por estado?',
    waiting: 'Gerando a resposta',
    answer: 'A resposta é construída a partir dos trechos recuperados, com as fontes citadas.',
  },
};

/** Answers for the conversational checklist, one per question, in order. Empty skips the question. */
export const QA_ANSWERS: string[] = [
  'arrecadacao_estado',
  '/dados/receita/arrecadacao-estado.csv',
  'CSV',
  'yes',
  'ano, mes, uf, irpf, cofins_demais',
  'integer, string, string, float, float',
  'ano, mes, uf',
  '',
  '',
  'ano:2000:2026, irpf:0:, cofins_demais:0:',
  'uf:[AC,AL,AM,AP,BA,CE,DF,ES,GO,MA,MG,MS,MT,PA,PB,PE,PI,PR,RJ,RN,RO,RR,RS,SC,SE,SP,TO]',
  'uf:^[A-Z]{2}$',
  '',
  '',
];

export type SyntheticColumn = {
  name: string;
  type: string;
  min?: string;
  max?: string;
  start?: string;
  end?: string;
  categories?: string;
};

export const SYNTHETIC_COLUMNS: SyntheticColumn[] = [
  { name: 'id_registro', type: 'integer' },
  { name: 'razao_social', type: 'string' },
  { name: 'data_abertura', type: 'date', start: '2010-01-01', end: '2025-12-31' },
  { name: 'uf', type: 'category', categories: 'CE, SP, RJ, MG, BA, PE, RS' },
  { name: 'email_contato', type: 'email' },
  { name: 'faturamento_anual', type: 'price', min: '10000', max: '5000000' },
];

export const SYNTHETIC_ROWS = 100;
