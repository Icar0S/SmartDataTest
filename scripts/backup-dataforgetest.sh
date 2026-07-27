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
# Este projeto não usa banco: todo o estado vive em arquivos.
#   storage/  vectorstore (base de conhecimento do RAG), sessões de accuracy,
#             gold, synth, metrics e as runs do checklist
#   uploads/  arquivos enviados pelos usuários
#
# Segue o mesmo padrão de ~/srv/bin/backup-db.sh: lê de dentro do container e
# redireciona para fora, carimbo de data, aborta se o resultado sair vazio,
# retenção por dias, log próprio.
#
# Por que via container e não `tar` direto no diretório:
# o projeto vive em ~/Documents, que é protegido pelo TCC do macOS. Um processo
# lançado pelo launchd não tem essa permissão e falha com
# "Operation not permitted" — testado. O OrbStack já tem acesso ao diretório
# (é ele quem monta o volume), então a leitura acontece dentro do container e
# só a escrita do arquivo final acontece no host, em ~/srv, que não é protegido.

APP_DIR="$HOME/Documents/SmartDataTest"
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
