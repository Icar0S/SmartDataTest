/**
 * Everything the home page says, in both languages. The components only lay
 * it out. Class and field names stay in English in both: they are what the
 * code and the generated PySpark call them.
 *
 * A description with code in it is a list of parts, where { code } marks a
 * name to set in monospace.
 */

const ptBR = {
  nav: {
    home: 'Início',
    modules: 'Módulos',
    methodology: 'Metodologia',
    checklist: 'Checklist QA',
    generate: 'Gerar Dataset',
    openMenu: 'Abrir menu',
    closeMenu: 'Fechar menu',
    main: 'Navegação principal',
  },
  logout: 'Sair',
  admin: 'Usuários e acessos',
  hero: {
    badge: 'Plataforma de QA para Big Data · LLM + RAG',
    title: 'Testes de Qualidade para Big Data',
    subtitle:
      'Testes avançados de qualidade com métricas, suporte LLM + RAG e geração automatizada de código PySpark.',
    primary: 'Gerar código PySpark',
    secondary: 'Explorar módulos',
    tertiary: 'Ver a metodologia',
    scroll: 'Role',
    scrollAria: 'Ir para os módulos',
    console: {
      file: 'quality_checks.py',
      running: 'executando',
      passed: 'checagens aprovadas',
      anomalies: 'anomalias detectadas',
      precision: 'precisão',
      recall: 'recall',
    },
  },
  stats: {
    label: 'A plataforma em números',
    tests: 'Testes automatizados',
    datasets: 'Datasets processados',
    coverage: 'Cobertura de testes',
    response: 'Tempo de resposta',
  },
  marqueeLabel: 'Tecnologias do ecossistema de dados',
  modules: {
    eyebrow: 'Módulos',
    title: 'Tudo para testar seus dados, em um só lugar',
    subtitle:
      'Da primeira validação ao relatório final: gere código, compare com o GOLD, crie dados de teste e tire dúvidas sem sair da plataforma.',
    items: {
      pyspark: {
        title: 'Geração de código PySpark',
        description:
          'Responda a um questionário guiado ou envie um dataset: a plataforma entende o schema e escreve validações PySpark prontas para rodar.',
        links: ['Questionário guiado', 'A partir de um dataset'],
      },
      accuracy: {
        title: 'Acurácia de dados',
        description:
          'Compare um dataset com o seu GOLD, limpe e valide um arquivo isolado ou meça a qualidade de cada coluna.',
        links: ['Comparar datasets', 'Dataset GOLD', 'Métricas'],
      },
      checklist: {
        title: 'Checklist Support QA',
        description:
          'Marque os itens de cada dimensão de qualidade, receba recomendações da IA e exporte o relatório.',
        links: ['Abrir o checklist'],
      },
      synthetic: {
        title: 'Datasets sintéticos',
        description:
          'Gere até 1 milhão de linhas realistas com LLM, com anomalias plantadas para pôr seus validadores à prova.',
        links: ['Gerar um dataset'],
      },
      rag: {
        title: 'Assistente com RAG',
        description:
          'Pergunte sobre qualidade de dados a um assistente que responde consultando a base de conhecimento.',
        links: ['Conversar'],
      },
      methodology: {
        title: 'Metodologia',
        description:
          'O framework por trás de cada teste: as fases do processo, as dimensões de qualidade e a camada de IA que apoia todas elas.',
        links: ['Conhecer o framework'],
        phases: ['Planejamento', 'Mapeamento de fontes', 'Geração e execução', 'Análise e monitoramento'],
        layer: 'Camada de IA transversal',
      },
    },
  },
  workflow: {
    eyebrow: 'Como funciona',
    title: 'Dois LLMs e uma régua honesta',
    subtitle:
      'Um modelo planta os problemas, outro escreve o código que deve encontrá-los, e as métricas dizem o quanto ele acertou.',
    steps: [
      {
        title: 'LLM 1 · Geração do dataset',
        parts: ['Cria um ', { code: 'SyntheticDataset' }, ' e registra cada anomalia plantada em ', { code: 'ExpectedProblems' }, '.'],
      },
      {
        title: 'LLM 2 · Geração do código',
        parts: ['Analisa o dataset e escreve o ', { code: 'GeneratedPySparkCode' }, ' que vai procurar os problemas.'],
      },
      {
        title: 'Execução e análise',
        parts: ['Roda o PySpark e registra no ', { code: 'ValidationLog' }, ' cada ', { code: 'DetectedIssue' }, ' encontrado.'],
      },
      {
        title: 'Avaliação e métricas',
        parts: ['Confronta o esperado com o detectado e produz um ', { code: 'ComparisonResult' }, ' com precisão, recall e F1.'],
      },
    ],
  },
  structures: {
    eyebrow: 'Modelo de dados',
    title: 'As estruturas por trás de cada teste',
    subtitle: 'Oito entidades levam um dataset da geração à nota final. Escolha uma para ver o schema.',
    listLabel: 'Estruturas de dados',
    field: 'Campo',
    type: 'Tipo',
    description: 'Descrição',
    fields: 'campos',
  },
  scenarios: {
    eyebrow: 'Cenários',
    title: 'Os problemas que a plataforma ensina a encontrar',
    subtitle: 'Cada tipo de anomalia vira um caso de teste: plantado pelo primeiro LLM, caçado pelo código gerado.',
    groups: ['Anomalias de dados', 'Problemas de integridade'],
  },
  tips: {
    eyebrow: 'Boas práticas',
    title: 'Diretrizes de implementação',
  },
  roadmap: {
    eyebrow: 'Roadmap',
    title: 'O que vem por aí',
    subtitle: 'Funcionalidades planejadas para levar o SmartDataTest adiante.',
    listLabel: 'Áreas do roadmap',
    planned: 'planejado',
  },
  cta: {
    title: 'Pronto para validar seus dados?',
    subtitle: 'Comece pelo questionário guiado e tenha validações PySpark em poucos minutos.',
    primary: 'Gerar código PySpark',
    secondary: 'Criar um dataset sintético',
  },
  footer: {
    tagline: 'Qualidade de dados para Big Data, com LLM, RAG e PySpark.',
    product: 'Produto',
    resources: 'Recursos',
    copyright: '© 2026 SmartDataTest. Todos os direitos reservados.',
    rights: 'Plataforma de Automação de Qualidade de Dados para Big Data com LLM + RAG.',
    builtWith: 'Desenvolvido com',
    tech: 'React · Python · PySpark · LLM · RAG',
  },
};

const enUS = {
  nav: {
    home: 'Home',
    modules: 'Modules',
    methodology: 'Methodology',
    checklist: 'QA Checklist',
    generate: 'Generate Dataset',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    main: 'Main navigation',
  },
  logout: 'Logout',
  admin: 'Users and access',
  hero: {
    badge: 'Big Data QA platform · LLM + RAG',
    title: 'Big Data Quality Testing',
    subtitle:
      'Advanced data quality testing with metrics, LLM + RAG support, and automated PySpark code generation.',
    primary: 'Generate PySpark code',
    secondary: 'Explore modules',
    tertiary: 'See the methodology',
    scroll: 'Scroll',
    scrollAria: 'Go to the modules',
    console: {
      file: 'quality_checks.py',
      running: 'running',
      passed: 'checks passed',
      anomalies: 'anomalies detected',
      precision: 'precision',
      recall: 'recall',
    },
  },
  stats: {
    label: 'The platform in numbers',
    tests: 'Automated tests',
    datasets: 'Datasets processed',
    coverage: 'Test coverage',
    response: 'Response time',
  },
  marqueeLabel: 'Data ecosystem technologies',
  modules: {
    eyebrow: 'Modules',
    title: 'Everything to test your data, in one place',
    subtitle:
      'From the first validation to the final report: generate code, compare against GOLD, create test data and get answers without leaving the platform.',
    items: {
      pyspark: {
        title: 'PySpark code generation',
        description:
          'Answer a guided questionnaire or upload a dataset: the platform reads the schema and writes PySpark validations ready to run.',
        links: ['Guided questionnaire', 'From a dataset'],
      },
      accuracy: {
        title: 'Data accuracy',
        description:
          'Compare a dataset against its GOLD, clean and validate a single file, or measure the quality of every column.',
        links: ['Compare datasets', 'GOLD dataset', 'Metrics'],
      },
      checklist: {
        title: 'Checklist Support QA',
        description:
          'Tick the items of each quality dimension, get AI recommendations and export the report.',
        links: ['Open the checklist'],
      },
      synthetic: {
        title: 'Synthetic datasets',
        description:
          'Generate up to 1 million realistic rows with an LLM, with anomalies planted to put your validators to the test.',
        links: ['Generate a dataset'],
      },
      rag: {
        title: 'RAG assistant',
        description: 'Ask about data quality and get answers grounded in the knowledge base.',
        links: ['Start a conversation'],
      },
      methodology: {
        title: 'Methodology',
        description:
          'The framework behind every test: the process phases, the quality dimensions and the AI layer that supports them all.',
        links: ['Explore the framework'],
        phases: ['Planning', 'Source mapping', 'Generation & execution', 'Analysis & monitoring'],
        layer: 'Transversal AI layer',
      },
    },
  },
  workflow: {
    eyebrow: 'How it works',
    title: 'Two LLMs and an honest yardstick',
    subtitle:
      'One model plants the problems, another writes the code that should find them, and the metrics say how well it did.',
    steps: [
      {
        title: 'LLM 1 · Dataset generation',
        parts: ['Generates a ', { code: 'SyntheticDataset' }, ' with ', { code: 'ExpectedProblems' }, ' documenting each injected anomaly.'],
      },
      {
        title: 'LLM 2 · Code generation',
        parts: ['Analyzes the dataset and writes the ', { code: 'GeneratedPySparkCode' }, ' that will look for the problems.'],
      },
      {
        title: 'Execution & analytics',
        parts: ['Runs PySpark and records in the ', { code: 'ValidationLog' }, ' each ', { code: 'DetectedIssue' }, ' it finds.'],
      },
      {
        title: 'Evaluation & metrics',
        parts: ['Matches expected against detected and produces a ', { code: 'ComparisonResult' }, ' with precision, recall and F1.'],
      },
    ],
  },
  structures: {
    eyebrow: 'Data model',
    title: 'The structures behind every test',
    subtitle: 'Eight entities take a dataset from generation to its final score. Pick one to see its schema.',
    listLabel: 'Data structures',
    field: 'Field',
    type: 'Type',
    description: 'Description',
    fields: 'fields',
  },
  scenarios: {
    eyebrow: 'Scenarios',
    title: 'The problems the platform teaches you to find',
    subtitle: 'Each anomaly type becomes a test case: planted by the first LLM, hunted down by the generated code.',
    groups: ['Data anomalies', 'Integrity issues'],
  },
  tips: {
    eyebrow: 'Good practice',
    title: 'Implementation guidelines',
  },
  roadmap: {
    eyebrow: 'Roadmap',
    title: 'What comes next',
    subtitle: 'Innovative features planned to take SmartDataTest further.',
    listLabel: 'Roadmap areas',
    planned: 'planned',
  },
  cta: {
    title: 'Ready to validate your data?',
    subtitle: 'Start with the guided questionnaire and have PySpark validations in a few minutes.',
    primary: 'Generate PySpark code',
    secondary: 'Create a synthetic dataset',
  },
  footer: {
    tagline: 'Data quality for Big Data, with LLMs, RAG and PySpark.',
    product: 'Product',
    resources: 'Resources',
    copyright: '© 2026 SmartDataTest. All rights reserved.',
    rights: 'Data Quality Automation Platform for Big Data with LLM + RAG.',
    builtWith: 'Built with',
    tech: 'React · Python · PySpark · LLM · RAG',
  },
};

export const copy = { 'pt-BR': ptBR, 'en-US': enUS };

/** Picks the text for the current language from a { pt, en } pair. English
 * for any language without its own text, as for the page copy. */
export const pick = (value, language) => (language === 'pt-BR' ? value.pt : value.en);

export const TECHNOLOGIES = [
  'PySpark',
  'Delta Lake',
  'Parquet',
  'pytest',
  'Airflow',
  'dbt',
  'Kafka',
  'BigQuery',
  'Pandas',
  'HDFS',
  'SQL',
  'LLM',
  'RAG',
];

/** Module cards: where each one leads. Text lives in copy.modules.items. */
export const MODULES = [
  { id: 'pyspark', icon: 'Code2', routes: ['/qa-checklist', '/pyspark/advanced'] },
  { id: 'accuracy', icon: 'Target', routes: ['/data-accuracy', '/data-accuracy/test-gold', '/data-accuracy/metrics'] },
  { id: 'checklist', icon: 'ListChecks', routes: ['/checklist'] },
  { id: 'synthetic', icon: 'Sparkles', routes: ['/generate-dataset'] },
  { id: 'rag', icon: 'Bot', routes: ['/support-rag'] },
  { id: 'methodology', icon: 'Workflow', routes: ['/methodology'] },
];

const f = (name, type, pt, en) => ({ name, type, desc: { pt, en } });

export const STRUCTURES = [
  {
    id: 'synthetic',
    title: 'SyntheticDataset',
    icon: 'Zap',
    tone: 'violet',
    description: {
      pt: 'Dataset sintético gerado por LLM, com anomalias plantadas de propósito',
      en: 'Synthetic dataset generated by LLM with deliberate anomalies',
    },
    fields: [
      f('dataset_id', 'UUID', 'Identificador único do dataset', 'Unique dataset identifier'),
      f('schema', 'Map<String, DataType>', 'Schema dos dados (campo → tipo)', 'Data schema (field_name → type)'),
      f('data', 'List<Map<String, Any>>', 'Registros do dataset (JSON/Dict)', 'Dataset records (JSON/Dict format)'),
      f('row_count', 'Integer', 'Total de linhas geradas', 'Total generated rows'),
      f('generation_prompt', 'String', 'Prompt usado para gerar o dataset', 'Prompt used to generate the dataset'),
      f('created_at', 'Timestamp', 'Quando foi gerado', 'When it was generated'),
    ],
  },
  {
    id: 'problems',
    title: 'ExpectedProblems',
    icon: 'Bug',
    tone: 'rose',
    description: {
      pt: 'Documentação dos problemas de qualidade plantados pelo LLM',
      en: 'Documentation of LLM-injected data quality issues',
    },
    fields: [
      f('dataset_id', 'UUID', 'Referência ao dataset', 'Dataset reference'),
      f('problems', 'List<Problem>', 'Lista dos problemas plantados', 'List of injected problems'),
      f('total_issues', 'Integer', 'Total de problemas', 'Total problem count'),
      f('issue_distribution', 'Map<ProblemType, Integer>', 'Quantidade por tipo', 'Count by type'),
      f('description', 'String', 'Descrição geral dos problemas', 'General problem description'),
    ],
  },
  {
    id: 'problem',
    title: 'Problem',
    icon: 'AlertTriangle',
    tone: 'amber',
    description: {
      pt: 'Detalhes de um problema de qualidade plantado',
      en: 'Details of a specific injected data quality issue',
    },
    fields: [
      f('problem_id', 'UUID', 'ID do problema', 'Problem ID'),
      f(
        'problem_type',
        'Enum',
        'NULL_VALUE, DUPLICATE, OUT_OF_RANGE, INVALID_FORMAT, INCONSISTENT, MISSING_FK, WRONG_TYPE',
        'NULL_VALUE, DUPLICATE, OUT_OF_RANGE, INVALID_FORMAT, INCONSISTENT, MISSING_FK, WRONG_TYPE'
      ),
      f('field_name', 'String', 'Campo afetado', 'Affected field'),
      f('affected_rows', 'List<Integer>', 'Índices das linhas com o problema', 'Row indices with problem'),
      f('description', 'String', 'Descrição do problema', 'Problem description'),
      f('severity', 'Enum', 'CRITICAL, HIGH, MEDIUM, LOW', 'CRITICAL, HIGH, MEDIUM, LOW'),
      f('expected_detection', 'String', 'Como deveria ser detectado', 'How it should be detected'),
    ],
  },
  {
    id: 'pysparkcode',
    title: 'GeneratedPySparkCode',
    icon: 'Code',
    tone: 'sky',
    description: {
      pt: 'Código PySpark escrito pelo segundo LLM para a validação',
      en: 'PySpark code generated by second LLM for validation',
    },
    fields: [
      f('code_id', 'UUID', 'ID do código gerado', 'Generated code ID'),
      f('dataset_id', 'UUID', 'Dataset alvo', 'Target dataset'),
      f('source_code', 'String', 'Código PySpark completo', 'Complete PySpark code'),
      f('validation_functions', 'List<String>', 'Funções de validação criadas', 'Created validation functions'),
      f('generation_prompt', 'String', 'Prompt usado para gerar o código', 'Prompt used to generate the code'),
      f('created_at', 'Timestamp', 'Quando foi gerado', 'When it was generated'),
      f('dependencies', 'List<String>', 'Bibliotecas necessárias', 'Required libraries'),
    ],
  },
  {
    id: 'validationlog',
    title: 'ValidationLog',
    icon: 'FileText',
    tone: 'emerald',
    description: {
      pt: 'Registros da execução da validação PySpark',
      en: 'Execution logs from PySpark validation',
    },
    fields: [
      f('execution_id', 'UUID', 'ID da execução', 'Execution ID'),
      f('dataset_id', 'UUID', 'Dataset validado', 'Validated dataset'),
      f('code_id', 'UUID', 'Código executado', 'Executed code'),
      f('detected_issues', 'List<DetectedIssue>', 'Problemas detectados', 'Detected problems'),
      f('execution_time_ms', 'Long', 'Tempo de execução', 'Execution time'),
      f('total_rows_processed', 'Long', 'Linhas processadas', 'Processed rows'),
      f('status', 'Enum', 'SUCCESS, FAILED, PARTIAL', 'SUCCESS, FAILED, PARTIAL'),
      f('raw_logs', 'String', 'Logs completos da execução', 'Complete execution logs'),
    ],
  },
  {
    id: 'detectedissue',
    title: 'DetectedIssue',
    icon: 'ScanSearch',
    tone: 'yellow',
    description: {
      pt: 'Problema encontrado pelo código de validação PySpark',
      en: 'Issue detected by PySpark validation code',
    },
    fields: [
      f('issue_id', 'UUID', 'ID do problema detectado', 'Detected problem ID'),
      f('issue_type', 'String', 'Tipo identificado pelo código', 'Type identified by code'),
      f('field_name', 'String', 'Campo problemático', 'Problematic field'),
      f('affected_rows', 'List<Integer>', 'Linhas afetadas encontradas', 'Found affected rows'),
      f('description', 'String', 'Descrição gerada pelo código', 'Description generated by code'),
      f('severity', 'String', 'Severidade detectada', 'Detected severity'),
      f('detection_method', 'String', 'Método usado na detecção', 'Method used to detect'),
    ],
  },
  {
    id: 'comparison',
    title: 'ComparisonResult',
    icon: 'GitCompare',
    tone: 'teal',
    description: {
      pt: 'Análise: problemas esperados contra detectados',
      en: 'Analysis: expected vs detected issues',
    },
    fields: [
      f('comparison_id', 'UUID', 'ID da comparação', 'Comparison ID'),
      f('dataset_id', 'UUID', 'Dataset testado', 'Tested dataset'),
      f('true_positives', 'Integer', 'Problemas detectados corretamente', 'Correctly detected problems'),
      f('false_positives', 'Integer', 'Alarmes falsos', 'False alarms'),
      f('false_negatives', 'Integer', 'Problemas não detectados', 'Undetected problems'),
      f('precision', 'Float', 'TP / (TP + FP)', 'TP / (TP + FP)'),
      f('recall', 'Float', 'TP / (TP + FN)', 'TP / (TP + FN)'),
      f('f1_score', 'Float', 'Média harmônica', 'Harmonic metric'),
      f('matching_details', 'List<Match>', 'Detalhes de cada correspondência', 'Details of each match'),
    ],
  },
  {
    id: 'match',
    title: 'Match',
    icon: 'CheckCircle',
    tone: 'green',
    description: {
      pt: 'Correspondência entre um problema esperado e um detectado',
      en: 'Match between expected and detected issues',
    },
    fields: [
      f('expected_problem_id', 'UUID', 'ID do problema esperado', 'Expected problem ID'),
      f('detected_issue_id', 'UUID', 'ID do problema detectado', 'Detected issue ID'),
      f('match_type', 'Enum', 'EXACT, PARTIAL, NONE', 'EXACT, PARTIAL, NONE'),
      f('field_match', 'Boolean', 'O campo coincide?', 'Field matched?'),
      f('type_match', 'Boolean', 'O tipo coincide?', 'Type matched?'),
      f('rows_overlap', 'Float', '% de sobreposição das linhas', '% row overlap'),
      f('confidence_score', 'Float', 'Confiança da correspondência (0-1)', 'Match confidence (0-1)'),
    ],
  },
];

const s = (code, pt, en) => ({ code, desc: { pt, en } });

export const SCENARIOS = [
  [
    s('NULL_VALUE', 'Valores ausentes em campos obrigatórios', 'Missing values in required fields'),
    s('DUPLICATE', 'Registros duplicados, inteiros ou em parte', 'Complete or partial record duplication'),
    s('OUT_OF_RANGE', 'Valores fora dos limites esperados', 'Values outside expected bounds'),
    s('INVALID_FORMAT', 'Formato incorreto (e-mail, ID, data)', 'Incorrect format (email, ID, date)'),
  ],
  [
    s('INCONSISTENT', 'Campos que se contradizem', 'Contradictory field values'),
    s('MISSING_FK', 'Chave estrangeira sem correspondência', 'Invalid foreign key reference'),
    s('WRONG_TYPE', 'Tipo de dado incorreto', 'Incorrect data type'),
    s('OUTLIER', 'Valores estatisticamente anômalos', 'Statistically anomalous values'),
  ],
];

export const TIPS = [
  {
    pt: 'Use correspondência aproximada para comparar descrições esperadas e detectadas',
    en: 'Implement fuzzy matching for expected vs detected descriptions',
  },
  {
    pt: 'Aceite uma tolerância nos índices de linha (±N linhas)',
    en: 'Apply line index tolerance (±N lines acceptable)',
  },
  {
    pt: 'Guarde os prompts dos LLMs para poder reproduzir cada resultado',
    en: 'Store LLM prompts for reproducibility',
  },
  {
    pt: 'Monte uma suíte de benchmark com datasets de complexidades diferentes',
    en: 'Create comprehensive benchmark suite with varying dataset complexities',
  },
  {
    pt: 'Use embeddings para comparar tipos de problema pelo significado',
    en: 'Utilize embeddings for semantic comparison of issue types',
  },
  {
    pt: 'Versione os datasets e o código gerado',
    en: 'Maintain version control for datasets and generated code',
  },
];

const r = (pt, en) => ({ pt, en });

export const ROADMAP = [
  {
    id: 'dataQuality',
    icon: 'Shield',
    title: r('Qualidade e validação de dados', 'Data Quality & Validation'),
    description: r(
      'Validação avançada, com evolução de schema inteligente e notas semânticas de qualidade',
      'Advanced data quality validation with intelligent schema evolution and semantic scoring'
    ),
    features: [
      {
        name: r('Detecção inteligente de evolução de schema', 'Intelligent Schema Evolution Detection'),
        desc: r(
          'LLMs detectam quando um schema muda ao longo do tempo e sugerem as adaptações',
          'Use LLMs to automatically detect and suggest adaptations when data schemas evolve over time'
        ),
      },
      {
        name: r('Nota semântica de qualidade', 'Semantic Data Quality Scoring'),
        desc: r(
          'Uma nota que vai além da sintaxe e aponta inconsistências semânticas com o conhecimento de domínio guardado no RAG',
          'Implement a comprehensive scoring system that evaluates data beyond syntactic checks, detecting semantic inconsistencies using domain knowledge embedded in your RAG system'
        ),
      },
      {
        name: r('Dados de teste gerados automaticamente', 'Auto-Generated Test Data'),
        desc: r(
          'Datasets sintéticos realistas a partir dos padrões de produção, preservando a privacidade',
          'Create realistic synthetic test datasets based on production data patterns while preserving privacy constraints'
        ),
      },
    ],
  },
  {
    id: 'performance',
    icon: 'TrendingUp',
    title: r('Testes de desempenho e escala', 'Performance & Scale Testing'),
    description: r(
      'Simulação de carga distribuída e otimização de recursos para sistemas de Big Data',
      'Distributed load simulation and resource optimization for big data systems'
    ),
    features: [
      {
        name: r('Simulação de carga distribuída', 'Distributed Load Simulation'),
        desc: r(
          'Cenários automáticos com cargas variáveis entre nós e padrões de falha configuráveis',
          'Build automated test scenarios that simulate variable workloads across distributed nodes with configurable failure patterns'
        ),
      },
      {
        name: r('Previsão de uso de recursos', 'Resource Utilization Predictor'),
        desc: r(
          'O histórico de testes prevê os recursos de um pipeline novo antes do deploy',
          'Use historical test results to predict resource needs for new data pipelines before deployment'
        ),
      },
      {
        name: r('Testes de escala elástica', 'Elastic Scaling Test Harness'),
        desc: r(
          'Como o sistema reage quando recursos são alocados e liberados na nuvem',
          'Test how systems respond to dynamic resource allocation and deallocation in cloud environments'
        ),
      },
    ],
  },
  {
    id: 'mlAnalytics',
    icon: 'Brain',
    title: r('Testes de ML e analytics', 'ML & Analytics Testing'),
    description: r(
      'Validação de modelos com detecção de drift e resultados explicáveis',
      'Machine learning model validation with drift detection and explainable results'
    ),
    features: [
      {
        name: r('Alerta antecipado de drift', 'Model Drift Early Warning System'),
        desc: r(
          'Compara os dados de produção com os de treino para prever quedas de desempenho antes que aconteçam',
          'Continuously monitor production data against training data distributions to predict model performance issues before they occur'
        ),
      },
      {
        name: r('Resultados explicáveis', 'Explainable Test Results'),
        desc: r(
          'LLMs explicam em linguagem natural por que um teste falhou e o que fazer',
          'Use LLMs to generate natural language explanations of why certain tests failed, with recommended actions'
        ),
      },
      {
        name: r('Repositório de datasets GOLD', 'Golden Dataset Repository'),
        desc: r(
          'Datasets de referência versionados para regressão, atualizados quando uma mudança é aprovada',
          'Maintain versioned reference datasets for regression testing with automatic updates when approved data changes occur'
        ),
      },
    ],
  },
  {
    id: 'streaming',
    icon: 'Clock',
    title: r('Streaming e tempo real', 'Streaming & Real-time'),
    description: r(
      'Validação de processamento em tempo real, com testes temporais e engenharia do caos',
      'Real-time data processing validation with temporal testing and chaos engineering'
    ),
    features: [
      {
        name: r('Testes temporais', 'Temporal Testing Framework'),
        desc: r(
          'Janelas de tempo testadas com o relógio acelerado ou desacelerado para achar casos de borda',
          'Test time-windowed operations with artificially accelerated or decelerated time flows to identify edge cases'
        ),
      },
      {
        name: r('Engenharia do caos', 'Chaos Engineering Module'),
        desc: r(
          'Falhas, partições de rede e latência injetadas no streaming para verificar a resiliência',
          'Inject failures, network partitions, and latency into streaming systems to verify resilience'
        ),
      },
      {
        name: r('Validação da ordem dos eventos', 'Event Ordering Validator'),
        desc: r(
          'Garante que o processamento respeita a causalidade e trata eventos fora de ordem',
          'Verify that event processing maintains causal relationships and correctly handles out-of-order events'
        ),
      },
    ],
  },
  {
    id: 'integration',
    icon: 'Globe',
    title: r('Integração e heterogeneidade', 'Integration & Heterogeneity'),
    description: r(
      'Consistência entre sistemas e testes de contrato automatizados',
      'Cross-system consistency checking and automated contract testing'
    ),
    features: [
      {
        name: r('Testes de contrato automatizados', 'Contract Testing Automation'),
        desc: r(
          'Contratos de API gerados a partir dos fluxos observados, com alerta de violações',
          'Automatically generate and maintain API contracts from observed data flows, flagging violations'
        ),
      },
      {
        name: r('Validação de conversão de formatos', 'Format Conversion Validator'),
        desc: r(
          'Integridade preservada entre formatos, com atenção a fusos horários, decimais e outros casos de borda',
          'Verify data integrity across format conversions with special attention to edge cases like timezone handling, decimals, etc.'
        ),
      },
      {
        name: r('Consistência entre sistemas', 'Cross-system Consistency Checker'),
        desc: r(
          'Linhagem dos dados acompanhada entre sistemas diferentes, do começo ao fim do ciclo de vida',
          'Track data lineage across heterogeneous systems to ensure consistency throughout the data lifecycle'
        ),
      },
    ],
  },
  {
    id: 'dashboard',
    icon: 'BarChart3',
    title: r('Dashboards e visualização', 'Dashboard & Visualization'),
    description: r(
      'Dashboards interativos com limites adaptativos e a saúde dos pipelines',
      'Interactive dashboards with adaptive thresholds and pipeline health monitoring'
    ),
    features: [
      {
        name: r('Limites de teste adaptativos', 'Adaptive Test Threshold Dashboard'),
        desc: r(
          'Histórico de resultados com ajustes de limite sugeridos por LLM',
          'Interactive dashboards showing historical test results with LLM-suggested threshold adjustments'
        ),
      },
      {
        name: r('Mapa de saúde do pipeline', 'Data Pipeline Health Map'),
        desc: r(
          'A saúde do pipeline de ponta a ponta, com detalhamento até o ponto do problema',
          'Visual representation of end-to-end pipeline health with drill-down capabilities to pinpoint issues'
        ),
      },
      {
        name: r('Análise de cobertura de testes', 'Test Coverage Analyzer'),
        desc: r(
          'Os componentes menos testados do pipeline, ponderados por complexidade e importância',
          'Visually identify undertested components of your data pipeline based on complexity and importance metrics'
        ),
      },
    ],
  },
  {
    id: 'llmRag',
    icon: 'MessageSquare',
    title: r('Recursos de LLM e RAG', 'LLM & RAG Features'),
    description: r(
      'Testes guiados pelo contexto, especificação em linguagem natural e explicação de anomalias',
      'Context-aware testing with natural language specifications and anomaly explanations'
    ),
    features: [
      {
        name: r('Testes gerados pelo contexto', 'Context-Aware Test Generation'),
        desc: r(
          'O RAG gera casos de teste a partir do contexto de negócio e do histórico de problemas',
          'Leverage your RAG system to automatically generate test cases based on business context and historical issues'
        ),
      },
      {
        name: r('Testes em linguagem natural', 'Natural Language Test Specification'),
        desc: r(
          'Testes descritos em linguagem natural e traduzidos em código executável',
          'Allow users to define tests in natural language, which your system translates into executable test code'
        ),
      },
      {
        name: r('Explicação de anomalias', 'Anomaly Explanation Generator'),
        desc: r(
          'Quando algo foge do padrão, LLMs explicam em linguagem simples as causas prováveis',
          'When anomalies are detected, use LLMs to generate human-readable explanations of potential causes'
        ),
      },
    ],
  },
  {
    id: 'monitoring',
    icon: 'Eye',
    title: r('Monitoramento avançado', 'Advanced Monitoring'),
    description: r(
      'Monitoramento inteligente, com análise preditiva e alertas automáticos',
      'Intelligent monitoring with predictive analytics and automated alerting'
    ),
    features: [
      {
        name: r('Detecção preditiva de falhas', 'Predictive Failure Detection'),
        desc: r(
          'Machine learning prevê falhas a partir dos padrões históricos, antes que aconteçam',
          'Use machine learning to predict system failures before they occur based on historical patterns'
        ),
      },
      {
        name: r('Correlação de alertas', 'Smart Alert Correlation'),
        desc: r(
          'Alertas relacionados agrupados para chegar à causa raiz com menos ruído',
          'Correlate multiple alerts to identify root causes and reduce notification noise'
        ),
      },
      {
        name: r('Sugestões de correção', 'Automated Remediation Suggestions'),
        desc: r(
          'Passos de correção sugeridos a partir de incidentes parecidos',
          'Provide actionable remediation steps based on similar historical incidents'
        ),
      },
    ],
  },
];
