# Apresentação automatizada do SmartDataTest (Playwright → MP4)

Testes end-to-end que percorrem a plataforma **em produção** (<https://smart-data-test.vercel.app>) como uma apresentação e gravam o percurso em vídeo MP4 (H.264, 1920×1080). Cada tela é exercitada de verdade: a rotina faz upload de arquivos, confere as respostas da API, valida os resultados na tela e salva os arquivos baixados. Se algo quebrar, o teste falha e o vídeo parcial mostra onde.

Há dois roteiros:

| Comando | Vídeo | Conteúdo |
|---|---|---|
| `npm run apresentacao` | `output/smartdatatest-apresentacao.mp4` | Percurso completo, em ritmo ágil: login, visão geral, metodologia, gerador PySpark, checklist conversacional, métricas, limpeza GOLD, acurácia GOLD × TARGET, dados sintéticos, checklist de evidências e assistente RAG |
| `npm run pitch` | `output/smartdatatest-pitch.mp4` | Corte curto para narrar ao vivo, em ritmo calmo: parte da página inicial, mostra o caminho pelos menus e abre o gerador PySpark (dados reais de arrecadação) e as métricas de qualidade |

Nos dois, cada tela é aberta pela página inicial, com uma legenda mostrando o caminho (ex.: *Menu "Data Accuracy" → "Dataset Metrics"*).

## Pré-requisitos

- Node.js 18 ou superior.
- **ffmpeg** no PATH (ou `FFMPEG_PATH` apontando para o executável). Windows: `winget install Gyan.FFmpeg`; macOS: `brew install ffmpeg`; Linux: `sudo apt install ffmpeg`.

Nada precisa estar rodando na máquina: a rotina usa o frontend da Vercel e a API em `api.smartdatatest.com`.

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

### Contra o ambiente local

Para testar código que ainda não foi para produção:

```bash
DEMO_BASE_URL=http://localhost:3000 npm run apresentacao
```

Nesse modo a rotina sobe sozinha a API Flask (porta 5000) e o servidor de desenvolvimento do React (porta 3000), ou reaproveita os que já estiverem rodando. Precisa do `.venv` na raiz com o `requirements.txt` instalado, do `cd frontend && npm install` e de um LLM (seção [LLM](#llm)).

## O que sai em `output/`

| Arquivo | Conteúdo |
|---|---|
| `<roteiro>.mp4` | O vídeo |
| `<roteiro>.capitulos.txt` | Capítulos no formato `mm:ss Título`, úteis para narrar ou para a descrição do vídeo |
| `<roteiro>.metricas.json` | Alvo da gravação, LLM em uso no servidor e os números medidos: linhas e colunas detectadas, encoding, número de regras, linhas do script PySpark, tempos da API, score de qualidade, resultado da acurácia |
| `artefatos/<roteiro>/` | Arquivos baixados na tela: script `.py`, CSV limpo, dataset corrigido, dados sintéticos, relatório PDF |
| `dados/` | Datasets derivados usados na gravação |
| `relatorio/` | Relatório HTML do Playwright (`npx playwright show-report output/relatorio`) |

## Dados usados

- `fixtures/arrecadacao-estado.csv`: arrecadação federal por estado, dado aberto da Receita Federal (ISO-8859-1, separado por `;`).
- A partir dele, `demo/datasets.ts` gera a cada execução:
  - `acuracia-gold.csv` e `acuracia-target.csv`: o último ano completo, em duas versões. A TARGET imita um sistema legado, com UF em minúsculas e com espaços, "Marco" sem cedilha e vírgula decimal (diferenças que a normalização precisa absorver), além de 8 valores alterados, 2 linhas ausentes e 1 linha extra (que a comparação precisa apontar). O teste confere esses números.
  - `gold-exportacao-suja.csv`: exportação com coluna vazia, cabeçalhos irregulares, espaços invisíveis, números no formato `1.234,56`, datas em três formatos e 12 linhas duplicadas.

São dados públicos ou derivados deles; os uploads ficam nas sessões do servidor em que a rotina roda.

## Ajustes

| Variável | Padrão | Efeito |
|---|---|---|
| `DEMO_BASE_URL` | `https://smart-data-test.vercel.app` | Endereço gravado. Com `http://localhost:3000`, a rotina sobe a API e o frontend locais |
| `DEMO_API_URL` | `https://api.smartdatatest.com` (ou `http://127.0.0.1:5000` no modo local) | API consultada só para registrar qual LLM ela usa |
| `DEMO_PACE` | `1` | Multiplica o tempo de leitura de legendas e resultados. `1.3` deixa o vídeo mais lento para narração; `0.7` o encurta |
| `DEMO_VIEWPORT` | `1440x810` | Tamanho da página em pixels CSS |
| `DEMO_SCALE` | `1.3333` (4/3) | Fator de escala; com o viewport padrão gera 1920×1080 com a interface um terço maior, para projetor |
| `DEMO_FPS` | `30` | Quadros por segundo do vídeo |
| `DEMO_CRF` | `18` | Qualidade do x264 (menor = mais nítido e maior) |
| `DEMO_LLM_PROVIDER` | `ollama` | Só no modo local: LLM da API iniciada pela rotina (`ollama`, `smartdatatest`, `gemini`, `anthropic` ou `env`, que mantém o `.env`) |
| `DEMO_LLM_MODEL` | `qwen2.5-coder:7b` | Só no modo local: modelo do provedor escolhido |
| `DEMO_PYTHON` | `.venv` da raiz | Só no modo local: Python usado para subir a API |
| `DEMO_ARRECADACAO_CSV` | `fixtures/arrecadacao-estado.csv` | Outro arquivo de arrecadação |
| `FFMPEG_PATH` | `ffmpeg` | Caminho do ffmpeg |

O ritmo de cada roteiro fica em `platform-tour.spec.ts` (`tempo`): `pace` controla quanto tempo as legendas e os resultados ficam na tela; `motion`, a velocidade do cursor, dos cliques e da digitação. A apresentação usa `motion: 0.45` (ágil); o pitch, o ritmo padrão.

Os textos que aparecem no vídeo (cartões, legendas, caminhos, respostas digitadas, colunas dos dados sintéticos) ficam em `demo/storyboard.ts`. A sequência de ações de cada tela fica em `demo/chapters.ts`.

## LLM

Em produção, o LLM é o que o servidor usa; a rotina só registra qual é em `metricas.json`.

No modo local, a API iniciada pela rotina usa por padrão o **Ollama local** com `qwen2.5-coder:7b`, a mesma configuração da produção. Para usar outro provedor só na gravação:

```bash
DEMO_BASE_URL=http://localhost:3000 DEMO_LLM_PROVIDER=smartdatatest npm run apresentacao   # API de LLMs (llm.smartdatatest.com), usa LLM_API_KEY do .env
DEMO_BASE_URL=http://localhost:3000 DEMO_LLM_PROVIDER=env npm run apresentacao             # mantém LLM_PROVIDER/LLM_MODEL do .env
```

Sem LLM disponível, o módulo de dados sintéticos devolve linhas de mentira ("mock_uf_0"). A tela avisa, e a rotina falha com uma mensagem em vez de gravar dados falsos.

## Observações

- A rotina testa o que está **publicado**. Uma correção que ainda não chegou ao servidor de produção faz o teste falhar ali, de propósito; use o modo local para gravar antes do deploy.
- Em produção valem os limites de taxa do servidor. Rodar os dois roteiros várias vezes seguidas pode receber HTTP 429; espere alguns minutos.
- Esperas longas (LLM, limpeza, comparação) entram no vídeo aceleradas, sempre com o selo "vídeo acelerado N×" na tela. Os tempos reais ficam em `metricas.json`.
- No modo local, a API roda com `FLASK_ENV=development` e limites de taxa folgados, porque o `.env` da raiz está em modo produção e um percurso completo passa dos limites por hora.
- Como funciona a gravação: `demo/recorder.ts` captura os quadros do Chromium pelo protocolo de depuração (CDP screencast) e os envia ao ffmpeg, que codifica em H.264. O vídeo nativo do Playwright (VP8 a ~1 Mbit/s) deixa código e tabelas borrados.
