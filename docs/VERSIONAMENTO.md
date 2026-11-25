# Versões

Cada versão da plataforma é uma **tag** no Git e uma página em
[Releases](https://github.com/Icar0S/SmartDataTest/releases), com as notas e o
código-fonte daquele momento para baixar. As tags são a fonte da verdade: não há
número de versão para lembrar de atualizar em arquivo nenhum.

## O que acontece sozinho

```
PR develop → main  ──merge──►  CI  ──passou──►  CD
                                                 ├─ 1. calcula a versão e cria a tag
                                                 ├─ 2. publica a página em Releases
                                                 └─ 3. publica o frontend, carimbado com a versão
```

O tamanho do passo vem do **título do PR** (que o `pr-checks.yml` já obriga a
seguir Conventional Commits) e dos commits. O maior vence: um PR chamado
`fix: develop into main` que traz um commit `feat:` gera uma versão *minor*.

| Título do PR ou do commit | Exemplo | Versão |
|---|---|---|
| `feat!:` ou `fix!:` (quebra compatibilidade) | `feat!: login com Google` | 1.5.0 → **2**.0.0 |
| `feat:` (novidade) | `feat: exportar para Excel` | 1.5.0 → 1.**6**.0 |
| qualquer outro | `fix: erro no upload` | 1.5.0 → 1.5.**1** |

As notas saem do `CHANGELOG.md`, se houver uma seção `## [X.Y.Z]` escrita para a
versão; senão, da lista de commits. Rodar o pipeline de novo não cria versão
nova.

Para ver que versão sairia agora:

```bash
git fetch --tags && python3 scripts/release/release.py next
```

## O que está rodando

| Onde | Como ver |
|---|---|
| Backend | `curl https://api.smartdatatest.com/api/version` |
| Frontend | rodapé das páginas de login e inicial |
| Os dois, lado a lado | `/admin` → "Versões em execução" |

O frontend é publicado pelo CD. **O backend não**: ele é atualizado no servidor,
com `deploy.sh`. Os dois podem, portanto, estar em versões diferentes, e é para
isso que existe o `/api/version`.

## Publicar e voltar atrás no backend

```bash
~/srv/bin/deploy.sh              # a versão mais recente
~/srv/bin/deploy.sh v1.5.0       # uma versão específica — inclusive para voltar atrás
~/srv/bin/deploy.sh --listar     # versões existentes e quais imagens estão guardadas
```

O script constrói a partir da tag, numa cópia limpa do repositório, e não do que
estiver na pasta de trabalho. Cada versão publicada deixa uma imagem Docker
guardada no servidor; voltar para ela não reconstrói nada e leva segundos.

Ao voltar para antes da 2.0.0, o backend volta a aceitar só `API_TOKENS`: o
frontend atual deixa de conseguir entrar até o backend voltar para a 2.x.

## Voltar atrás no frontend

Na Vercel: **Deployments** → a publicação desejada → **Promote to Production**.

## Criar uma tag à mão

Só para marcar algo que o pipeline não marca (um experimento, um histórico):

```bash
git tag -a v1.5.1 <commit> -m "SmartDataTest v1.5.1"
git push origin v1.5.1
```

A página em Releases é criada na próxima execução do CD, que publica todas as
que faltarem.

As versões de 1.0.0 a 1.5.0 foram marcadas assim, em 25/11/2026, sobre os
commits da `main` que correspondiam a cada entrega. As datas no changelog são as
dos commits, não a da marcação.

## Proteger as tags (uma vez, no GitHub)

Para que uma versão não possa ser movida nem apagada por engano: **Settings →
Rules → Rulesets → New tag ruleset**, alvo `v*`, marcando *Restrict updates* e
*Restrict deletions*.
