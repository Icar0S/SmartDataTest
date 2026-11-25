#!/usr/bin/env bash
set -euo pipefail

# Backup dos dados persistentes do DataForgeTest.
#
# INSTALAÇÃO: este arquivo é a fonte da verdade (versionada), mas o launchd NÃO
# consegue executá-lo daqui — ~/Documents é protegido pelo TCC do macOS e um
# processo do launchd recebe "Operation not permitted" ao tentar ler o script.
# Instale uma cópia fora do diretório protegido e é ela que o agendamento roda:
#
#     cp scripts/backup-dataforgetest.sh ~/srv/dataforgetest/backup.sh
#     chmod +x ~/srv/dataforgetest/backup.sh
#
# Ao alterar este arquivo, repita o cp. Agendado por
# ~/Library/LaunchAgents/com.icaro.backup-dataforgetest.plist (03:45 diário).
#
# O estado vive em arquivos e num SQLite:
#   storage/    vectorstore (base de conhecimento do RAG), sessões de accuracy,
#               gold, synth, metrics e as runs do checklist
#   uploads/    arquivos enviados pelos usuários
#   auth-data/  usuários, sessões e auditoria (SQLite; ver docs/AUTH.md)
#
# Segue o mesmo padrão de ~/srv/bin/backup-db.sh: lê de dentro do container e
# redireciona para fora, carimbo de data, aborta se o resultado sair vazio,
# retenção por dias, log próprio.
#
# Por que via container e não `tar` direto no diretório:
#
# HISTÓRICO: a decisão nasceu porque o projeto vivia em ~/Documents, protegido
# pelo TCC do macOS — um processo do launchd falhava com "Operation not
# permitted". Em 2026-08-04 o projeto foi movido para ~/srv/dataforgetest-app,
# onde o TCC não se aplica, então essa restrição DEIXOU DE EXISTIR.
#
# Mantido assim por outro motivo, que continua válido: ler de dentro do
# container garante que o backup enxerga exatamente o mesmo conteúdo que a
# aplicação enxerga, inclusive o que estiver em volume montado.

APP_DIR="${APP_DIR:-$HOME/srv/dataforgetest-app}"
COMPOSE_FILE="$APP_DIR/compose.prod.yaml"
DEST="$HOME/srv/backups/dataforgetest"
STAMP="$(date +%Y%m%d-%H%M%S)"
RETENCAO_DIAS=14

# garante que o docker do OrbStack está no PATH mesmo rodando via launchd
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.orbstack/bin:$PATH"

mkdir -p "$DEST"

OUT="$DEST/dataforgetest-$STAMP.tar.gz"

# O container precisa estar de pé. Se não estiver, é melhor falhar alto do que
# gravar um arquivo vazio e disparar a retenção em cima de backups bons.
if ! docker compose -f "$COMPOSE_FILE" ps --status running --quiet backend | grep -q .; then
  echo "ERRO: container backend não está rodando, abortando" >&2
  exit 1
fi

in_backend() { docker compose -f "$COMPOSE_FILE" exec -T backend "$@"; }

# ── Banco de usuários ────────────────────────────────────────────────────────
# A cópia é feita pela própria aplicação, de dentro do contêiner (auth.cli usa a
# API de backup do SQLite e confere o resultado). Um tar do arquivo em uso
# poderia pegá-lo no meio de uma gravação, e abri-lo daqui corromperia o banco:
# as travas do SQLite não atravessam a fronteira da máquina virtual.
backup_users() {
  # Sem login configurado não há banco: é um estado legítimo, não um erro.
  in_backend test -s /app/auth-data/auth.sqlite3 2>/dev/null || return 0
  local out="$DEST/usuarios-$STAMP.sqlite3"
  in_backend python -m auth.cli backup /tmp/usuarios.sqlite3 >/dev/null || return 1
  # Contém nomes e e-mails: mesma cautela do original (modo 600).
  ( umask 077 && in_backend cat /tmp/usuarios.sqlite3 > "$out" ) || { rm -f "$out"; return 1; }
  in_backend rm -f /tmp/usuarios.sqlite3 || true
  # Confere o que CHEGOU aqui, não só o que saiu de lá.
  if [ "$(sqlite3 "$out" 'PRAGMA integrity_check; SELECT COUNT(*) >= 0 FROM users' 2>&1)" != $'ok\n1' ]; then
    echo "ERRO: cópia do banco de usuários falhou na verificação" >&2
    rm -f "$out"
    return 1
  fi
  gzip -f "$out"
  find "$DEST" -name 'usuarios-*.sqlite3.gz' -mtime +$RETENCAO_DIAS -delete
  echo "[$(date '+%F %T')] backup ok: $out.gz ($(du -h "$out.gz" | cut -f1))"
}

# Uma falha não cancela a outra: o banco de usuários e os arquivos se perdem por
# motivos diferentes. Mas ela aparece no código de saída.
users_ok=1
backup_users || { users_ok=0; echo "ERRO: backup do banco de usuários falhou; seguindo" >&2; }

# Arquivos .tmp são gravações em curso (sessões usam temp + rename atômico) e
# não têm valor num backup.
docker compose -f "$COMPOSE_FILE" exec -T backend \
  tar --exclude='*.tmp' --exclude='*.json.tmp' \
      -czf - -C /app storage uploads \
  > "$OUT"

# aborta se o arquivo saiu vazio (evita apagar backups bons por causa de um ruim)
if [ ! -s "$OUT" ]; then
  echo "ERRO: backup vazio, abortando sem aplicar retenção" >&2
  rm -f "$OUT"
  exit 1
fi

if ! gzip -t "$OUT" 2>/dev/null; then
  echo "ERRO: backup corrompido (gzip -t falhou), abortando sem aplicar retenção" >&2
  rm -f "$OUT"
  exit 1
fi

# a base de conhecimento do RAG é o item mais caro de reconstruir; se ela não
# entrou no arquivo, algo está errado e não vale aplicar retenção
if ! tar -tzf "$OUT" | grep -q 'storage/vectorstore/documents.json'; then
  echo "ERRO: documents.json ausente do backup, abortando sem aplicar retenção" >&2
  rm -f "$OUT"
  exit 1
fi

# remove backups mais antigos que a retenção
find "$DEST" -name 'dataforgetest-*.tar.gz' -mtime +$RETENCAO_DIAS -delete

echo "[$(date '+%F %T')] backup ok: $OUT ($(du -h "$OUT" | cut -f1), $(tar -tzf "$OUT" | wc -l | tr -d ' ') arquivos)"

# ── Cópia offsite — descomente após configurar o rclone ─────────────────────
# Sem isto, um incêndio ou roubo leva junto os backups. Mesmo padrão do
# backup-db.sh, que também tem esta seção pendente.
# rclone copy "$OUT" r2:meus-backups/dataforgetest/

[ "$users_ok" -eq 1 ] || exit 1
