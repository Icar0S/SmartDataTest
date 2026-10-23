# Apresentação automatizada do SmartDataTest (Playwright → MP4)

Testes end-to-end que percorrem a plataforma como uma apresentação e gravam o percurso em vídeo MP4 (H.264, 1920×1080). Cada tela é exercitada de verdade: a rotina faz upload de arquivos, confere as respostas da API, valida os resultados na tela e salva os arquivos baixados. Se algo quebrar, o teste falha e o vídeo parcial mostra onde.

Há dois roteiros:

| Comando | Vídeo | Conteúdo |
|---|---|---|
| `npm run apresentacao` | `output/smartdatatest-apresentacao.mp4` | Percurso completo: login, visão geral, metodologia, gerador PySpark, checklist conversacional, métricas, limpeza GOLD, acurácia GOLD × TARGET, dados sintéticos, checklist de evidências e assistente RAG |
| `npm run pitch` | `output/smartdatatest-pitch.mp4` | Corte curto para narrar ao vivo: gerador PySpark com dados reais de arrecadação e métricas de qualidade |

## Pré-requisitos

- Node.js 18 ou superior.
- **ffmpeg** no PATH (ou `FFMPEG_PATH` apontando para o executável). Windows: `winget install Gyan.FFmpeg`; macOS: `brew install ffmpeg`; Linux: `sudo apt install ffmpeg`.
- Backend pronto para rodar: ambiente virtual em `.venv` na raiz do repositório, com `requirements.txt` instalado, e o `.env` da raiz.
- Frontend com dependências instaladas (`cd frontend && npm install`).
- Ollama aberto com `qwen2.5-coder:7b`, o LLM padrão da gravação (veja a seção [LLM](#llm)).

## Instalação

```bash
cd tests/e2e
npm install
npm run setup        # baixa o Chromium do Playwright
```

## Como gerar os vídeos

```bash
npm run apresentacao      # percurso completo
npm run pitch             # corte curto
npx playwright test --grep @pitch --headed   # mesmo corte, com a janela do navegador visível
```

A rotina sobe sozinha a API Flask (porta 5000) e o servidor de desenvolvimento do React (porta 3000). Se eles já estiverem rodando, são reaproveitados.

## O que sai em `output/`

| Arquivo | Conteúdo |
|---|---|
| `<roteiro>.mp4` | O vídeo |
| `<roteiro>.capitulos.txt` | Capítulos no formato `mm:ss Título`, úteis para narrar ou para a descrição do vídeo |
| `<roteiro>.metricas.json` | Números medidos durante a gravação: linhas e colunas detectadas, encoding, número de regras, linhas do script PySpark, tempos da API, score de qualidade, resultado da acurácia |
| `artefatos/<roteiro>/` | Arquivos baixados na tela: script `.py`, CSV limpo, dataset corrigido, dados sintéticos, relatório PDF |
| `dados/` | Datasets derivados usados na gravação |
| `relatorio/` | Relatório HTML do Playwright (`npx playwright show-report output/relatorio`) |

## Dados usados

- `fixtures/arrecadacao-estado.csv`: arrecadação federal por estado, dado aberto da Receita Federal (ISO-8859-1, separado por `;`).
- A partir dele, `demo/datasets.ts` gera a cada execução:
  - `acuracia-gold.csv` e `acuracia-target.csv`: o último ano completo, em duas versões. A TARGET imita um sistema legado, com UF em minúsculas e com espaços, "Marco" sem cedilha e vírgula decimal (diferenças que a normalização precisa absorver), além de 8 valores alterados, 2 linhas ausentes e 1 linha extra (que a comparação precisa apontar). O teste confere esses números.
  - `gold-exportacao-suja.csv`: exportação com coluna vazia, cabeçalhos irregulares, espaços invisíveis, números no formato `1.234,56`, datas em três formatos e 12 linhas duplicadas.

## Ajustes

| Variável | Padrão | Efeito |
|---|---|---|
| `DEMO_PACE` | `1` | Multiplica todas as pausas. `1.3` deixa o vídeo mais lento para narração; `0.7` o encurta |
| `DEMO_BASE_URL` | `http://localhost:3000` | Grava contra outro endereço (ex.: produção). Fora de localhost, nenhum servidor é iniciado |
| `DEMO_VIEWPORT` | `1440x810` | Tamanho da página em pixels CSS |
| `DEMO_SCALE` | `1.3333` (4/3) | Fator de escala; com o viewport padrão gera 1920×1080 com a interface um terço maior, para projetor |
| `DEMO_FPS` | `30` | Quadros por segundo do vídeo |
| `DEMO_CRF` | `18` | Qualidade do x264 (menor = mais nítido e maior) |
| `DEMO_LLM_PROVIDER` | `ollama` | LLM da API iniciada pela rotina: `ollama`, `gemini`, `anthropic` ou `env` (mantém o que está no `.env`) |
| `DEMO_LLM_MODEL` | `qwen2.5-coder:7b` no Ollama | Modelo do provedor escolhido |
| `DEMO_PYTHON` | `.venv` da raiz | Python usado para subir a API |
| `DEMO_ARRECADACAO_CSV` | `fixtures/arrecadacao-estado.csv` | Outro arquivo de arrecadação |
| `FFMPEG_PATH` | `ffmpeg` | Caminho do ffmpeg |

Os textos que aparecem no vídeo (cartões, legendas, respostas digitadas, colunas dos dados sintéticos) ficam em `demo/storyboard.ts`. A sequência de ações de cada tela fica em `demo/chapters.ts`.

## LLM

Por padrão, a API iniciada pela rotina usa o **Ollama local** com `qwen2.5-coder:7b`, a mesma configuração da produção: nenhum dado sai da máquina. Deixe o Ollama aberto com o modelo baixado (`ollama pull qwen2.5-coder:7b`).

Para usar outro provedor só na gravação:

```bash
DEMO_LLM_PROVIDER=gemini npm run apresentacao          # usa GEMINI_API_KEY do .env
DEMO_LLM_PROVIDER=env npm run apresentacao             # mantém LLM_PROVIDER/LLM_MODEL do .env
```

Sem LLM disponível, o módulo de dados sintéticos devolve linhas de mentira ("mock_uf_0") sem avisar na tela. A rotina detecta isso e falha com uma mensagem, em vez de gravar dados falsos. Hoje o `.env` da raiz tem `LLM_PROVIDER=gemini` com `LLM_MODEL=qwen2.5-coder:7b`, uma combinação que esse módulo rejeita, por isso o padrão da rotina não depende dele.

## Observações

- Esperas longas (LLM, limpeza, comparação) entram no vídeo aceleradas, sempre com o selo "vídeo acelerado N×" na tela. Os tempos reais ficam em `metricas.json`.
- A API iniciada pela rotina roda com `FLASK_ENV=development` e limites de taxa folgados, porque o `.env` da raiz está em modo produção e um percurso completo passa dos limites por hora. Isso vale só para o servidor que a própria rotina sobe.
- O servidor do React é iniciado só em `127.0.0.1` e sem checagem de host. Com `proxy` no `package.json`, o Create React App só aceita o IP privado de LAN da máquina e não sobe quando ela não tem um (erro `allowedHosts[0] should be a non-empty string`).
- Como funciona a gravação: `demo/recorder.ts` captura os quadros do Chromium pelo protocolo de depuração (CDP screencast) e os envia ao ffmpeg, que codifica em H.264. O vídeo nativo do Playwright (VP8 a ~1 Mbit/s) deixa código e tabelas borrados.
