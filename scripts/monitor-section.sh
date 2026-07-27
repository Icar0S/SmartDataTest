#!/usr/bin/env bash
# Seção de monitoramento do DataForgeTest.
#
# PROPOSTA para ~/srv/bin/monitor.sh — aquele script não foi alterado.
# Rode este arquivo direto para ver o resultado:
#
#     ./scripts/monitor-section.sh
#
# Para integrar ao dashboard: copie a função sec_dataforgetest() para
# ~/srv/bin/monitor.sh e acrescente a chamada dentro de frame(), depois de
# sec_app. Os helpers usados (rule, ok, warn, bad, hb, hdur, pad) já existem lá.
#
# Por que uma seção separada em vez de reconfigurar as existentes:
# sec_app() e sec_backup() são fixas no meu-app — APP_DIR=~/srv/meu-app,
# HEALTH_URL na porta 8080, BACKUP_DIR=.../postgres e BACKUP_LABEL=backup-db.
# Apontá-las para cá esconderia o meu-app. Duas seções mostram os dois.

set -uo pipefail

DFT_DIR="${DFT_DIR:-$HOME/Documents/SmartDataTest}"
DFT_LOCAL="${DFT_LOCAL:-http://127.0.0.1:5000/}"
DFT_PUBLIC="${DFT_PUBLIC:-https://api.smartdatatest.com/}"
DFT_BACKUP_DIR="${DFT_BACKUP_DIR:-$HOME/srv/backups/dataforgetest}"
DFT_BACKUP_LABEL="com.icaro.backup-dataforgetest"
DFT_TUNNEL_LABEL="com.icaro.cloudflared"
DFT_CONTAINER="dataforgetest-backend"

# ── helpers (versões mínimas; monitor.sh já tem as suas) ─────────────────────
if ! declare -f rule >/dev/null 2>&1; then
  R=$'\033[0m'; GRN=$'\033[32m'; YEL=$'\033[33m'; RED=$'\033[31m'; GRY=$'\033[90m'
  [ -t 1 ] || { R=; GRN=; YEL=; RED=; GRY=; }
  ok()   { printf '%s%s%s' "$GRN" "$1" "$R"; }
  warn() { printf '%s%s%s' "$YEL" "$1" "$R"; }
  bad()  { printf '%s%s%s' "$RED" "$1" "$R"; }
  rule() { printf '┌─ %s ' "$1"; printf '─%.0s' $(seq 1 $((90 - ${#1}))); printf '\n'; }
  hb()   { awk -v b="$1" 'BEGIN{s="B KB MB GB";split(s,u," ");i=1;while(b>=1024&&i<4){b/=1024;i++}printf "%.1f %s",b,u[i]}'; }
  hdur() { local s=$1; if [ "$s" -lt 3600 ]; then printf '%dm' $((s/60));
           elif [ "$s" -lt 86400 ]; then printf '%dh %dm' $((s/3600)) $(((s%3600)/60));
           else printf '%dd %dh' $((s/86400)) $(((s%86400)/3600)); fi; }
fi

sec_dataforgetest() {
  rule "DATAFORGETEST"

  # ── container ─────────────────────────────────────────────────────────────
  local st
  st=$(docker inspect -f '{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{else}}-{{end}}' \
       "$DFT_CONTAINER" 2>/dev/null || echo "ausente/-")
  case "$st" in
    running/healthy) printf ' %-11s %s  ·  %s\n' "container" "$(ok '✓ healthy')" "$DFT_CONTAINER" ;;
    running/*)       printf ' %-11s %s  ·  %s (%s)\n' "container" "$(warn '~ sem healthy')" "$DFT_CONTAINER" "${st#*/}" ;;
    *)               printf ' %-11s %s  ·  %s\n' "container" "$(bad '✗ fora')" "$st" ;;
  esac

  # ── health local e público ────────────────────────────────────────────────
  # Os dois juntos separam "app caiu" de "túnel caiu": local 200 + público
  # 502 aponta para o cloudflared, não para a aplicação.
  local lc lt pc pt
  read -r lc lt <<<"$(curl -s -o /dev/null -w '%{http_code} %{time_total}' --max-time 5 "$DFT_LOCAL" 2>/dev/null || echo '000 0')"
  read -r pc pt <<<"$(curl -s -o /dev/null -w '%{http_code} %{time_total}' --max-time 8 "$DFT_PUBLIC" 2>/dev/null || echo '000 0')"
  local lms pms
  lms=$(awk -v x="$lt" 'BEGIN{printf "%.0f", x*1000}')
  pms=$(awk -v x="$pt" 'BEGIN{printf "%.0f", x*1000}')
  printf ' %-11s %s  ·  público %s\n' "health" \
    "$([ "$lc" = 200 ] && ok "✓ local ${lms}ms" || bad "✗ local HTTP $lc")" \
    "$([ "$pc" = 200 ] && ok "✓ ${pms}ms" || bad "✗ HTTP $pc")"

  # ── túnel ─────────────────────────────────────────────────────────────────
  if launchctl print "gui/$(id -u)/$DFT_TUNNEL_LABEL" >/dev/null 2>&1; then
    local conns
    conns=$(grep -c "Registered tunnel connection" "$HOME/.cloudflared/cloudflared.err.log" 2>/dev/null || echo 0)
    printf ' %-11s %s  ·  api.smartdatatest.com  ·  %s registros de conexão\n' \
      "túnel" "$(ok '✓ carregado')" "$conns"
  else
    printf ' %-11s %s não carregado no launchd\n' "túnel" "$(bad '✗')"
  fi

  # ── dados persistentes ────────────────────────────────────────────────────
  local sf uf sz
  sf=$(find "$DFT_DIR/storage" -type f 2>/dev/null | wc -l | tr -d ' ')
  uf=$(find "$DFT_DIR/uploads" -type f 2>/dev/null | wc -l | tr -d ' ')
  sz=$(du -sk "$DFT_DIR/storage" "$DFT_DIR/uploads" 2>/dev/null | awk '{s+=$1} END{print s*1024}')
  printf ' %-11s %s arquivos em storage  ·  %s em uploads  ·  %s\n' "dados" "$sf" "$uf" "$(hb "${sz:-0}")"

  # ── backup ────────────────────────────────────────────────────────────────
  local last n age
  last=$(ls -t "$DFT_BACKUP_DIR"/dataforgetest-*.tar.gz 2>/dev/null | head -1)
  n=$(ls -1 "$DFT_BACKUP_DIR"/dataforgetest-*.tar.gz 2>/dev/null | wc -l | tr -d ' ')
  if [ -z "$last" ]; then
    printf ' %-11s %s nenhum backup em %s\n' "backup" "$(bad '✗')" "$DFT_BACKUP_DIR"
  else
    age=$(( $(date +%s) - $(stat -f %m "$last" 2>/dev/null || echo 0) ))
    local agetxt
    if   [ "$age" -lt 90000 ];  then agetxt=$(ok "há $(hdur $age)")
    elif [ "$age" -lt 172800 ]; then agetxt=$(warn "há $(hdur $age)")
    else agetxt=$(bad "há $(hdur $age)"); fi
    printf ' %-11s %s  ·  %s arquivos  ·  %s\n' "backup" "$agetxt" "$n" \
      "$(hb "$(stat -f %z "$last" 2>/dev/null || echo 0)")"
  fi
  if launchctl list 2>/dev/null | grep -q "$DFT_BACKUP_LABEL"; then
    printf ' %-11s %s  ·  diário às 03:45\n' "agendamento" "$(ok '✓ carregado')"
  else
    printf ' %-11s %s não carregado no launchd\n' "agendamento" "$(bad '✗')"
  fi

  # ── exposição ─────────────────────────────────────────────────────────────
  # O invariante do projeto: nada escuta fora do loopback. Se este número
  # deixar de ser zero, alguma coisa foi publicada sem querer.
  local ext
  ext=$(lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | grep -v '127.0.0.1\|\[::1\]' | grep -vc '^COMMAND')
  printf ' %-11s %s\n' "exposição" \
    "$([ "$ext" = 0 ] && ok '✓ nenhuma porta fora do loopback' || bad "✗ $ext porta(s) em interface externa")"
}

sec_dataforgetest
