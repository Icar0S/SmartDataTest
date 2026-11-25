# Acesso à plataforma

Entra quem tem conta Google **e** foi liberado pelo operador. São duas coisas
separadas: o Google diz *quem* a pessoa é; se ela *pode* usar a plataforma é
decisão do operador. Qualquer pessoa no mundo tem conta Google, então toda conta
nova nasce **pendente** — a menos que o e-mail tenha sido liberado antes.

## Liberar alguém

| Situação | Pelo painel (`/admin`) | No servidor |
|---|---|---|
| A pessoa pediu acesso e ainda não entrou | *Liberar e-mails* | `usuarios-plataforma.sh convidar fulano@gmail.com` |
| A pessoa já entrou e está esperando | *aprovar* | `usuarios-plataforma.sh aprovar fulano@gmail.com` |
| Tirar o acesso | *bloquear* | `usuarios-plataforma.sh bloquear fulano@gmail.com` |
| Tornar administrador | — (de propósito) | `usuarios-plataforma.sh promover fulano@gmail.com` |

- Bloquear vale na **próxima requisição** da pessoa e encerra as sessões abertas.
- Quem está esperando não precisa fazer nada: a página avança sozinha.
- Nenhuma rota da API concede administração. Uma rota que faz isso é uma rota
  que pode ser abusada para isso; a credencial para promover é ter um shell no
  servidor.
- Um e-mail liberado que **não** é do Google (um Yahoo usado como conta Google,
  por exemplo) não entra direto: aparece no painel com um aviso, para o operador
  confirmar com a pessoa. O Google só garante de quem é a caixa quando ela é
  dele — `@gmail.com` ou um domínio Workspace.

## Colocar no ar pela primeira vez

**A ordem importa: o backend antes do frontend.** O backend novo aceita tanto o
login com Google quanto o token do frontend antigo, então publicá-lo primeiro não
tira ninguém do ar. O contrário tiraria: o frontend novo não tem outro login. O
CD confere isso e se recusa a publicar, mas a ordem certa nem chega a depender
dele.

1. **Google Cloud Console** → *APIs e serviços* → *Credenciais* → *Criar
   credenciais* → *ID do cliente OAuth* → *Aplicativo da Web*.
   - URI de redirecionamento autorizado, exatamente:
     `https://api.smartdatatest.com/api/auth/google/callback`
   - Em *Público-alvo* (tela de consentimento), o app precisa estar **Em
     produção**. Em *Teste*, só entra quem for cadastrado também lá no Google.
     Os escopos usados (`openid email profile`) não exigem verificação.
2. **No servidor**, `~/srv/bin/configurar-sso-plataforma.sh`. Pede o ID e o
   segredo sem eco e grava no `.env`.
3. **No servidor**, `~/srv/bin/deploy.sh develop`. Confira:
   `curl https://api.smartdatatest.com/api/auth/config` deve responder
   `"sso":true`. O frontend antigo continua funcionando.
4. **Merge** do PR na `main`. O CD marca a versão e publica o frontend novo.
5. Entrar uma vez com a própria conta Google e, no servidor,
   `~/srv/bin/usuarios-plataforma.sh promover seu@email.com`.
6. **No servidor**, `~/srv/bin/deploy.sh`, para o backend ficar exatamente na
   versão que acabou de ser marcada, e `~/srv/bin/fechar-token-antigo.sh`.
   **Até este passo a API continua aberta**: o token que ia embutido no frontend
   antigo é público e ainda é aceito.

## Como funciona

```
 navegador                          backend                         Google
    │  inventa um verifier (segredo)   │                               │
    │─ /google/login?challenge=hash ──►│                               │
    │                                  │── state, nonce, PKCE ────────►│
    │                                  │◄──────── código ──────────────│
    │                                  │── troca por ID token ────────►│
    │◄── /login#code=… (1 uso, 60 s) ──│   confere assinatura, emissor,│
    │─ POST /exchange code+verifier ──►│   destinatário, nonce, e-mail │
    │◄──────── token de sessão ────────│                               │
```

- O código que volta na URL não vale nada sem o *verifier*, que nunca saiu do
  navegador que começou o login. Um link preparado por outra pessoa não loga
  ninguém na conta errada.
- O código fica no **fragmento** da URL (`#`), que não vai para nenhum servidor
  nem para o cabeçalho Referer, e é apagado da barra de endereço na chegada.
- O token de sessão é aleatório e opaco. No banco fica só o SHA-256 dele: uma
  cópia do banco não serve para entrar como ninguém.
- A situação da conta é lida do banco **a cada requisição**.

| | |
|---|---|
| Sessão | 8 horas; 7 dias com "Lembrar-me" |
| Onde fica no navegador | `sessionStorage` (some ao fechar a aba) ou, com "Lembrar-me", `localStorage` |
| Identidade | o `sub` do Google, nunca o e-mail: e-mail muda de dono |
| O que guardamos | nome, e-mail, perfil profissional e datas. Nenhuma senha |

### Por que token, e não cookie

O frontend está em `vercel.app` e a API em `smartdatatest.com`: para o navegador
são sites diferentes, e um cookie de sessão da API seria um cookie de terceiros —
que o Safari bloqueia sempre e os demais, cada vez mais. Com o token no cabeçalho
`Authorization` o login funciona em qualquer navegador, e não existe CSRF: nada é
enviado automaticamente.

O preço é que o token fica ao alcance do JavaScript da página, então o risco a
conter é XSS. Para isso o frontend é servido com uma Content-Security-Policy
(`frontend/vercel.json`) que impede script de fora, script *inline* e envio de
dados para qualquer lugar que não seja a API.

Se um dia o frontend passar para um subdomínio (`app.smartdatatest.com`), os dois
passam a ser o mesmo site e dá para trocar o token por um cookie `HttpOnly`.

## Credenciais aceitas pela API

| Credencial | Para quem | Abre |
|---|---|---|
| Sessão (`sdt_…`) | pessoas aprovadas | rotas da plataforma; `/api/auth/admin/*` se for administrador |
| `API_TOKENS` | scripts | rotas da plataforma. **Nunca** em um build de frontend |
| `ADMIN_TOKENS` | manutenção | só as operações destrutivas do RAG |

Públicas: `/`, `/api/version`, `/api/stats`, `/api/auth/config`,
`/api/auth/google/*`, `/api/auth/exchange` e os `/health`. Qualquer outra rota,
inclusive as que forem criadas amanhã, nasce fechada.

## Endpoints

| Rota | |
|---|---|
| `GET /api/auth/config` | o backend tem login configurado? |
| `GET /api/auth/google/login` | começa o login (`challenge`, `remember`) |
| `GET /api/auth/google/callback` | retorno do Google |
| `POST /api/auth/exchange` | código + verifier → sessão |
| `GET /api/auth/me` | quem sou, e em que situação |
| `POST /api/auth/logout` | encerra a sessão |
| `POST /api/auth/profile` | perfil profissional |
| `GET /api/auth/admin/users` | contas, convites e auditoria |
| `POST /api/auth/admin/users/<id>/status` | aprovar, bloquear, suspender |
| `POST /api/auth/admin/invites` e `/invites/revoke` | liberar e-mails |

## Configuração

| Variável | |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` | as três juntas ligam o login. Nenhuma: sem login. Só algumas: o app se recusa a subir |
| `FRONTEND_URL` | para onde o navegador volta. Precisa estar em `CORS_ALLOWED_ORIGINS` |
| `OIDC_REDIRECT_URI` | o endereço cadastrado no Google |
| `AUTH_DB_PATH` | banco SQLite. Fora de `storage/`, que é servido para download |
| `AUTH_CONTACT` | opcional: contato mostrado a quem está esperando. É público |

## Banco e backup

`auth-data/auth.sqlite3`, modo 600, fora do Git. **Nunca abra esse arquivo pelo
macOS com o contêiner rodando**: as travas do SQLite não atravessam a fronteira da
máquina virtual. Use `python -m auth.cli`, que roda dentro do contêiner. O backup
diário (`scripts/backup-dataforgetest.sh`) faz isso.

## Desenvolvimento, sem conta no Google

`tests/support/mock_oidc.py` é um provedor que fala o protocolo de verdade:

```bash
python -m tests.support.mock_oidc --port 5200 --email fulano@gmail.com

export OIDC_DISCOVERY_URL=http://localhost:5200/.well-known/openid-configuration
export GOOGLE_CLIENT_ID=dev GOOGLE_CLIENT_SECRET=dev SESSION_SECRET=$(openssl rand -hex 32)
cd src && python -m auth.cli convidar fulano@gmail.com && python api.py
```

Sem nada disso configurado, o backend em desenvolvimento roda aberto, como
sempre, mas a tela de login não tem por onde entrar.

## Se der errado

| Sintoma | Causa provável |
|---|---|
| "O login com Google ainda não está ativo neste servidor" | backend sem as credenciais, ou anterior à 2.0.0 (`curl …/api/version`) |
| `redirect_uri_mismatch` na página do Google | o URI cadastrado difere do `OIDC_REDIRECT_URI`, nem que seja numa barra |
| `access_denied`, "app em teste" | a tela de consentimento não está *Em produção* |
| "Não foi possível confirmar sua identidade" ou "O Google não respondeu agora" | o log diz o motivo: veja abaixo |
| O backend não sobe | `SSO is only partially configured`: falta uma das três variáveis |
| Fiquei trancado para fora | `usuarios-plataforma.sh promover seu@email.com` no servidor |

Todo login que termina numa dessas duas mensagens deixa uma linha no log do
backend. O `2>&1` é necessário: essas linhas saem pelo stderr, e sem ele o
`grep` não as vê.

```bash
docker logs --since 1h dataforgetest-backend 2>&1 | grep OIDC
```

| A linha diz | Causa |
|---|---|
| `invalid_client` | o segredo no servidor não é desse cliente. Gere outro no cliente OAuth do Console, grave com `configurar-sso-plataforma.sh` e rode `deploy.sh` para o contêiner ler o `.env` novo |
| `the login cookie did not come back` | o navegador não devolveu o cookie do login: bloqueio de cookies para `api.smartdatatest.com`, mais de 10 minutos nas telas do Google, ou o link aberto em outro navegador |
| `the login cookie could not be read` | o login passou de 10 minutos, ou o `SESSION_SECRET` mudou no meio dele |
| `opened directly` | alguém abriu o endereço de retorno sem vir do Google, quase sempre um robô. Nada a corrigir |
| `state does not match` | outro login começou no mesmo navegador depois deste (duas abas, por exemplo) |
| `the provider returned error=…` | o Google recusou o login; o código diz o porquê |
| `ExpiredTokenError` ou `issued in the future` | o relógio da VM do OrbStack está fora: compare `date -u` no Mac e no contêiner |
| `not started, could not reach the identity provider` | o backend não alcança o Google (rede ou DNS) |

Cancelar na tela do Google não é falha e não aparece nesse log.
