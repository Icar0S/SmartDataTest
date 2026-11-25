# GitHub Actions CI/CD — DataForgeTest

## Workflows

| Arquivo | Trigger | Descrição |
|---|---|---|
| `ci.yml` | push/PR para main | Pipeline completa de CI: lint, testes, docker, security scan |
| `deploy.yml` | Após CI passar em main | Cria a versão (tag + Release) e publica o frontend na Vercel |
| `pr-checks.yml` | Pull Request aberto/atualizado | Quality gates e validação do PR |

## Estrutura de Jobs

```
Push/PR para main
       │
       ▼
┌─────────────────────┐
│  lint-and-quality   │  (flake8, black, isort, eslint)
└──────────┬──────────┘
           │
     ┌─────┴──────┐
     ▼            ▼
┌─────────┐  ┌──────────┐
│backend  │  │frontend  │  ← Paralelo
│ tests   │  │  tests   │
└────┬────┘  └────┬─────┘
     └─────┬──────┘
           ▼
    ┌─────────────┐
    │docker-build │  (build + smoke test)
    └──────┬──────┘
           ▼
    ┌─────────────┐
    │security-scan│  (Trivy + pip-audit + npm audit)
    └──────┬──────┘
           │ (apenas em push main, via deploy.yml)
           ▼
     ┌──────────┐     ┌──────────┐
     │ release  │────►│  deploy  │
     │  tag +   │     │ frontend │
     │ Release  │     │  Vercel  │
     └──────────┘     └──────────┘
```

Como a versão é calculada, e como voltar atrás: [docs/VERSIONAMENTO.md](../../docs/VERSIONAMENTO.md).

A integração Git da Vercel está desligada para a `main` (`frontend/vercel.json`):
ela publicava cada merge em cerca de um minuto, sem esperar a CI.

O `deploy` só publica se `api.smartdatatest.com` aceitar login com Google
(`/api/auth/config`). O frontend não tem outro login; publicado contra um backend
sem ele, ninguém entraria. Se o job ficar vermelho nessa checagem, o frontend
anterior continua no ar: atualize o backend e rode o job de novo.

O backend não passa pelo CD: ele roda self-hosted no Mac mini (`compose.prod.yaml`,
atrás do Cloudflare Tunnel em `api.smartdatatest.com`) e é atualizado lá, à mão:

```bash
~/srv/bin/deploy.sh            # a versão mais recente
~/srv/bin/deploy.sh v1.5.0     # uma versão específica
```

## Secrets Necessários (configurar em Settings → Secrets → Actions)

| Secret | Descrição | Obrigatório |
|---|---|---|
| `GEMINI_API_KEY` | API key do Google Gemini | Sim |
| `ANTHROPIC_API_KEY` | API key do Anthropic Claude | Opcional |
| `VERCEL_TOKEN` | Token de acesso da CLI do Vercel | Sim (CD) |
| `VERCEL_ORG_ID` | ID da organização no Vercel | Sim (CD) |
| `VERCEL_PROJECT_ID` | ID do projeto no Vercel | Sim (CD) |

## Como obter os Secrets

### VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
1. `npx vercel login`
2. `npx vercel link` (dentro da pasta `frontend/`)
3. Os IDs aparecem em `.vercel/project.json`
4. Token: https://vercel.com/account/tokens

## Comportamento dos Jobs

### Jobs que falham o CI (bloqueantes)
- Backend unit, API, security e integration tests
- Frontend tests com cobertura (threshold mínimo configurado em `package.json`)

### Jobs não-bloqueantes (`continue-on-error: true`)
- Backend E2E tests (dependem de servidor externo)
- Performance benchmarks (sem SLA de produção no CI)
- Black e isort (avisos de estilo, não erros críticos)
- ESLint do frontend

### Timeouts
| Job | Timeout |
|---|---|
| `backend-tests` | 20 min |
| `frontend-tests` | 15 min |
| `docker-build` | 30 min |
| `deploy-frontend` | 10 min |

## Artefatos Gerados

Todos retidos por **30 dias**:
- `backend-test-results/` — XMLs JUnit de todos os suítes de backend
- `frontend-coverage-report/` — Relatório de cobertura HTML + LCOV + Cobertura XML
- `security-audit-results/` — Resultados do pip-audit e npm audit (apenas em push para main)
