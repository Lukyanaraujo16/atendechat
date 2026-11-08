#!/usr/bin/env bash
###############################################################################
# StreamHub Chat (AtendeChat / CoreFlow) — instalador guiado
#
#   sudo bash install.sh                 menu (detecta instalação existente)
#   sudo bash install.sh --nova          instalação nova em VPS limpa
#   sudo bash install.sh --atualizar     atualização após "git pull"
#   sudo bash install.sh --reconfigurar  domínio/HTTPS, Evolution, segredos, firewall
#   sudo bash install.sh --diagnostico   verificação somente leitura
#   sudo bash install.sh --verificar     só pré-requisitos (nada é alterado)
#   sudo bash install.sh --superadmin    cria o primeiro Super Admin (se não houver)
#   sudo bash install.sh --redefinir-senha  nova senha para um Super Admin
#   sudo bash install.sh --ajuda
#
# Documentação completa: docs/MANUAL_INSTALACAO.md
#
# Garantias:
#   • Nunca trata uma instalação existente como nova; nunca apaga bancos ou volumes.
#   • .env existente: cópia de segurança antes de qualquer alteração; segredos existentes
#     não são substituídos sem confirmação; valores de segredos nunca são impressos.
#   • PostgreSQL, Redis e Evolution escutam só em 127.0.0.1.
#   • Pode ser executado de novo após uma falha: cada etapa é idempotente.
#
# Execução não interativa (automação/testes): defina as respostas por variáveis
# (veja "Variáveis de resposta" no manual) e ASSUME_YES=1.
# Compatibilidade: MINIMAL_UPDATE=1 equivale a --atualizar sem perguntas.
###############################################################################
set -Eeuo pipefail
export DEBIAN_FRONTEND=noninteractive

INSTALLER_VERSION="2.0.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJETO_DIR="${PROJETO_DIR:-$SCRIPT_DIR}"

# shellcheck source=scripts/installer/lib.sh
source "${SCRIPT_DIR}/scripts/installer/lib.sh"
# shellcheck source=scripts/installer/evolution.sh
source "${SCRIPT_DIR}/scripts/installer/evolution.sh"
# shellcheck source=scripts/ensure-postgres-app-ownership.sh
source "${SCRIPT_DIR}/scripts/ensure-postgres-app-ownership.sh"

BACKEND_DIR="${PROJETO_DIR}/backend"
FRONTEND_DIR="${PROJETO_DIR}/frontend"
BACKEND_ENV="${BACKEND_DIR}/.env"
FRONTEND_ENV="${FRONTEND_DIR}/.env"
STATE_DIR="/etc/streamhub"
STATE_FILE="${STATE_DIR}/install.conf"
LOG_DIR="/var/log/streamhub"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/streamhub}"
SERVICE_NAME="atendechat-backend"
API_PORT="${API_PORT:-8080}"
NODE_MAJOR=20
MIN_RAM_MB=1800
REC_RAM_MB=3800
MIN_DISK_GB=10
REC_DISK_GB=25

ACTION=""
case "${1:-}" in
  --nova) ACTION=nova ;;
  --atualizar) ACTION=atualizar ;;
  --reconfigurar) ACTION=reconfigurar ;;
  --diagnostico) ACTION=diagnostico ;;
  --verificar) ACTION=verificar ;;
  --superadmin) ACTION=superadmin ;;
  --redefinir-senha) ACTION=redefinir-senha ;;
  --ajuda | -h | --help) sed -n '2,28p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  "") ;;
  *) echo "Opção desconhecida: $1 (use --ajuda)"; exit 2 ;;
esac
if [[ -z "$ACTION" && "${MINIMAL_UPDATE:-0}" == "1" ]]; then
  ACTION=atualizar
  ASSUME_YES=1
fi

###############################################################################
# Log, trava e tratamento de erro
###############################################################################
start_logging() {
  mkdir -p "$LOG_DIR"
  chmod 700 "$LOG_DIR"
  LOG_FILE="${LOG_DIR}/install-$(date +%Y%m%d-%H%M%S).log"
  (umask 077 && : >"$LOG_FILE")
  exec > >(tee -a "$LOG_FILE") 2>&1
  echo "Log desta execução: ${LOG_FILE}"
}

acquire_lock() {
  exec 9>/run/streamhub-install.lock
  flock -n 9 || ui_fail "Outra execução do instalador está em andamento." \
    "Aguarde terminar. Se não houver outra execução, apague /run/streamhub-install.lock."
}

on_error() {
  local code=$? line="$1" cmd="$2"
  trap - ERR
  echo ""
  ui_err "Falha na etapa \"${STEP_NAME:-preparação}\" (código ${code})."
  # BASH_COMMAND é o texto do script, sem variáveis expandidas: não vaza segredos.
  echo "  Comando: ${cmd} (${BASH_SOURCE[1]:-install.sh}:${line})"
  echo "  Nada foi apagado. O que já foi feito continua válido."
  echo "  1. Veja o erro acima e o log completo: ${LOG_FILE:-(sem log)}"
  echo "  2. Corrija a causa (rede, espaço em disco, DNS, credenciais)."
  echo "  3. Execute de novo o mesmo comando — as etapas são seguras para repetir."
  echo "  Diagnóstico: sudo bash install.sh --diagnostico"
  exit "$code"
}
trap 'on_error "$LINENO" "$BASH_COMMAND"' ERR

###############################################################################
# Estado da instalação
###############################################################################
# Sinais de instalação existente. Imprime um por linha.
existing_install_signals() {
  [[ -f "$BACKEND_ENV" ]] && echo "arquivo ${BACKEND_ENV}"
  [[ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]] && echo "serviço systemd ${SERVICE_NAME}"
  [[ -f "$STATE_FILE" ]] && echo "registro ${STATE_FILE}"
  [[ -f "${EVOLUTION_DIR}/docker-compose.yml" ]] && echo "Evolution em ${EVOLUTION_DIR}"
  if command -v psql >/dev/null 2>&1 && id postgres >/dev/null 2>&1; then
    local dbs
    dbs="$(sudo -u postgres psql -Atqc "SELECT datname FROM pg_database WHERE datname NOT IN ('postgres','template0','template1')" 2>/dev/null || true)"
    [[ -n "$dbs" ]] && echo "bancos PostgreSQL: $(echo "$dbs" | tr '\n' ' ')"
  fi
  return 0
}

state_save() {
  mkdir -p "$STATE_DIR"
  chmod 700 "$STATE_DIR"
  [[ -f "$STATE_FILE" ]] || (umask 077 && : >"$STATE_FILE")
  local k
  for k in "$@"; do env_set "$STATE_FILE" "$k" "${!k:-}"; done
  env_set "$STATE_FILE" INSTALLER_VERSION "$INSTALLER_VERSION"
  env_set "$STATE_FILE" UPDATED_AT "$(date -Iseconds)"
}

state_get() { env_get "$STATE_FILE" "$1" 2>/dev/null || true; }

# Recupera modo/domínios de uma instalação existente (registro ou .env).
load_existing_config() {
  INSTALL_MODE="${INSTALL_MODE:-$(state_get INSTALL_MODE)}"
  DOMAIN="${DOMAIN:-$(state_get DOMAIN)}"
  API_DOMAIN="${API_DOMAIN:-$(state_get API_DOMAIN)}"
  SERVER_IP="${SERVER_IP:-$(state_get SERVER_IP)}"
  is_valid_ipv4 "${SERVER_IP:-}" || SERVER_IP=""
  EVOLUTION_MODE="${EVOLUTION_MODE:-$(state_get EVOLUTION_MODE)}"
  local burl furl
  burl="$(env_get "$BACKEND_ENV" BACKEND_URL || true)"
  furl="$(env_get "$BACKEND_ENV" FRONTEND_URL || true)"
  if [[ -z "$INSTALL_MODE" ]]; then
    if [[ "$burl" == https://* ]]; then INSTALL_MODE=domain; else INSTALL_MODE=ip; fi
  fi
  if [[ "$INSTALL_MODE" == "domain" ]]; then
    [[ -z "$DOMAIN" ]] && DOMAIN="$(normalize_host "${furl%%,*}")"
    [[ -z "$API_DOMAIN" ]] && API_DOMAIN="$(normalize_host "$burl")"
  elif [[ -z "$SERVER_IP" ]]; then
    # Modo IP: BACKEND_URL é http://IP:PORTA.
    local h; h="$(normalize_host "$burl")"; h="${h%%:*}"
    is_valid_ipv4 "$h" && SERVER_IP="$h"
  fi
  [[ -n "$SERVER_IP" ]] || SERVER_IP="$(detect_public_ip)"
  if [[ -z "$EVOLUTION_MODE" ]]; then
    if [[ -f "${EVOLUTION_DIR}/docker-compose.yml" ]]; then EVOLUTION_MODE=local
    elif [[ -n "$(env_get "$BACKEND_ENV" EVOLUTION_CENTRAL_BASE_URL || true)" ]]; then EVOLUTION_MODE=externa
    else EVOLUTION_MODE=nenhuma; fi
  fi
}

compute_urls() {
  if [[ "$INSTALL_MODE" == "domain" ]]; then
    FRONTEND_URL_VALUE="https://${DOMAIN}"
    BACKEND_URL_VALUE="https://${API_DOMAIN}"
  else
    FRONTEND_URL_VALUE="http://${SERVER_IP}"
    BACKEND_URL_VALUE="http://${SERVER_IP}:${API_PORT}"
  fi
}

###############################################################################
# Pré-requisitos
###############################################################################
detect_public_ip() {
  local ip=""
  ip="$(curl -4 -fsS --max-time 5 https://ifconfig.me 2>/dev/null || true)"
  is_valid_ipv4 "$ip" || ip="$(curl -4 -fsS --max-time 5 https://icanhazip.com 2>/dev/null | tr -d '[:space:]' || true)"
  is_valid_ipv4 "$ip" || ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  printf '%s' "$ip"
}

port_listener() { ss -Hltnp "sport = :$1" 2>/dev/null | head -1; }

# check_prereqs nova|existente → retorna 1 se algo bloqueia.
check_prereqs() {
  local kind="$1" blocked=0 level mem_mb disk_gb cores
  echo ""
  echo "${C_BOLD}Verificação de pré-requisitos${C_RESET}"

  if [[ $EUID -ne 0 ]]; then ui_err "Execute como root: sudo bash install.sh"; blocked=1; else ui_ok "Permissão de root"; fi

  if detect_os; then
    level="$(os_support_level "$OS_ID" "$OS_VERSION")"
    case "$level" in
      ok) ui_ok "Sistema: ${OS_ID} ${OS_VERSION}" ;;
      aviso) ui_warn "Ubuntu ${OS_VERSION} está sem suporte padrão do fabricante. Recomendado: Ubuntu 22.04 ou 24.04 LTS." ;;
      *) ui_err "Sistema não suportado: ${OS_ID} ${OS_VERSION}. Use Ubuntu Server 22.04 ou 24.04 LTS."; blocked=1 ;;
    esac
  else
    ui_err "Não foi possível identificar o sistema (/etc/os-release)."; blocked=1
  fi

  if arch_supported "$(uname -m)"; then ui_ok "Arquitetura: $(uname -m)"; else ui_err "Arquitetura não suportada: $(uname -m) (use x86_64 ou arm64)."; blocked=1; fi

  if [[ -d /run/systemd/system ]]; then ui_ok "systemd ativo"; else ui_err "systemd não está ativo (contêineres sem systemd não são suportados)."; blocked=1; fi

  cores="$(nproc 2>/dev/null || echo 1)"
  if ((cores >= 2)); then ui_ok "CPU: ${cores} núcleos"; else ui_warn "CPU: ${cores} núcleo. Recomendado: 2 ou mais."; fi

  mem_mb="$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo 2>/dev/null || echo 0)"
  if ((mem_mb < MIN_RAM_MB)); then ui_err "RAM: ${mem_mb} MB. Mínimo: 2 GB (recomendado 4 GB)."; blocked=1
  elif ((mem_mb < REC_RAM_MB)); then ui_warn "RAM: ${mem_mb} MB. Recomendado: 4 GB (com Evolution na mesma VPS). O instalador oferece criar swap."
  else ui_ok "RAM: ${mem_mb} MB"; fi

  disk_gb="$(df -Pk "$PROJETO_DIR" | awk 'NR==2 {printf "%d", $4/1024/1024}')"
  if ((disk_gb < MIN_DISK_GB)); then ui_err "Disco livre: ${disk_gb} GB. Mínimo: ${MIN_DISK_GB} GB."; blocked=1
  elif ((disk_gb < REC_DISK_GB)); then ui_warn "Disco livre: ${disk_gb} GB. Recomendado: ${REC_DISK_GB} GB ou mais (mídias e backups crescem)."
  else ui_ok "Disco livre: ${disk_gb} GB"; fi

  if [[ -d "$BACKEND_DIR" && -d "$FRONTEND_DIR" && -d "${PROJETO_DIR}/.git" ]]; then
    ui_ok "Repositório: ${PROJETO_DIR}"
  else
    ui_err "${PROJETO_DIR} não é um clone completo do repositório (faltam backend/, frontend/ ou .git)."; blocked=1
  fi
  if path_traversable_by_others "$PROJETO_DIR"; then
    ui_ok "Nginx consegue ler o diretório do projeto"
  else
    ui_err "O Nginx (usuário www-data) não consegue acessar ${PROJETO_DIR}. Clone o repositório em /var/www/atendechat (veja o manual)."; blocked=1
  fi

  local url
  for url in https://registry.npmjs.org/ https://deb.nodesource.com/ http://archive.ubuntu.com/; do
    if curl -fsS -o /dev/null --max-time 10 "$url" 2>/dev/null || curl -sS -o /dev/null --max-time 10 -w '' "$url" 2>/dev/null; then
      ui_ok "Acesso a ${url}"
    else
      ui_warn "Sem acesso a ${url} (verifique DNS/firewall de saída)."
    fi
  done

  # Na retomada as portas podem estar ocupadas pelos serviços que a própria instalação já subiu.
  if [[ "$kind" == "nova" ]] && command -v ss >/dev/null 2>&1; then
    local p l
    for p in 80 443 "$API_PORT" "$EVOLUTION_HOST_PORT"; do
      l="$(port_listener "$p")"
      [[ -z "$l" ]] && continue
      if [[ "$p" =~ ^(80|443)$ && "$l" == *nginx* ]]; then continue; fi
      ui_err "Porta ${p} já está em uso: ${l##* }"; blocked=1
    done
    for p in 5432 6379; do
      l="$(port_listener "$p")"
      [[ -n "$l" ]] && ui_warn "Porta ${p} já em uso (${l##* }). O instalador reutilizará o serviço local se for PostgreSQL/Redis do sistema."
    done
    [[ $blocked -eq 0 ]] && ui_ok "Portas necessárias livres"
  fi
  return "$blocked"
}

###############################################################################
# Perguntas da instalação nova
###############################################################################
collect_answers_nova() {
  echo ""
  echo "${C_BOLD}Configuração da instalação${C_RESET} (Enter aceita o valor entre colchetes)"

  local detected
  detected="$(detect_public_ip)"
  ask SERVER_IP "IP público desta VPS" "$detected" is_valid_ipv4

  echo ""
  echo "  Modo de acesso:"
  echo "    1) Domínio com HTTPS (recomendado para produção): app.SEUDOMINIO e api.SEUDOMINIO"
  echo "    2) Somente IP, sem HTTPS (apenas para testes)"
  if [[ -z "${INSTALL_MODE:-}" ]]; then
    local m
    ask m "Escolha 1 ou 2" "1" _valid_mode_choice
    [[ "$m" == "1" ]] && INSTALL_MODE=domain || INSTALL_MODE=ip
  fi
  [[ "$INSTALL_MODE" =~ ^(domain|ip)$ ]] || ui_fail "INSTALL_MODE deve ser domain ou ip."

  if [[ "$INSTALL_MODE" == "domain" ]]; then
    if [[ -z "${DOMAIN:-}" || -z "${API_DOMAIN:-}" ]]; then
      ask BASE_DOMAIN "Domínio principal (ex.: empresa.com.br)" "" _valid_host_input
      BASE_DOMAIN="$(normalize_host "$BASE_DOMAIN")"
      ask DOMAIN "Endereço do painel" "app.${BASE_DOMAIN}" _valid_host_input
      ask API_DOMAIN "Endereço da API" "api.${BASE_DOMAIN}" _valid_host_input
    fi
    DOMAIN="$(normalize_host "$DOMAIN")"; API_DOMAIN="$(normalize_host "$API_DOMAIN")"
    is_valid_hostname "$DOMAIN" && is_valid_hostname "$API_DOMAIN" || ui_fail "Domínio inválido."
    [[ "$DOMAIN" != "$API_DOMAIN" ]] || ui_fail "Painel e API precisam de nomes diferentes (ex.: app. e api.)."
    ask SSL_EMAIL "E-mail para o certificado HTTPS (Let's Encrypt)" "" is_valid_email
  fi

  echo ""
  echo "  Evolution API (WhatsApp via Evolution, opcional — conexões Baileys funcionam sem ela):"
  echo "    1) Instalar nesta VPS em Docker (recomendado)"
  echo "    2) Usar um servidor Evolution externo já existente (informar URL e API key)"
  echo "    3) Não configurar agora"
  if [[ -z "${EVOLUTION_MODE:-}" ]]; then
    local e
    ask e "Escolha 1, 2 ou 3" "1" _valid_evo_choice
    case "$e" in 1) EVOLUTION_MODE=local ;; 2) EVOLUTION_MODE=externa ;; *) EVOLUTION_MODE=nenhuma ;; esac
  fi
  [[ "$EVOLUTION_MODE" =~ ^(local|externa|nenhuma)$ ]] || ui_fail "EVOLUTION_MODE deve ser local, externa ou nenhuma."
  if [[ "$EVOLUTION_MODE" == "externa" ]]; then
    ask EVOLUTION_EXTERNAL_URL "URL do servidor Evolution (ex.: https://evo.empresa.com.br)" "" _valid_http_url
    EVOLUTION_EXTERNAL_URL="${EVOLUTION_EXTERNAL_URL%/}"
    ask_secret EVOLUTION_EXTERNAL_KEY "API key global da Evolution (AUTHENTICATION_API_KEY)" _nonempty
  fi

  if [[ "${SKIP_SUPERADMIN:-0}" != "1" ]]; then
    echo ""
    echo "  Primeiro Super Admin (acesso total à plataforma). A senha não é exibida nem gravada em log."
    ask SUPERADMIN_NAME "Nome" "" _valid_name
    ask SUPERADMIN_EMAIL "E-mail de login" "" is_valid_email
    ask_secret SUPERADMIN_PASSWORD "Senha (8+ caracteres, maiúscula, minúscula e número)" is_strong_password
  fi

  echo ""
  echo "${C_BOLD}Resumo${C_RESET}"
  compute_urls
  echo "  Painel:     ${FRONTEND_URL_VALUE}"
  echo "  API:        ${BACKEND_URL_VALUE}"
  echo "  Evolution:  ${EVOLUTION_MODE}"
  [[ -n "${SUPERADMIN_EMAIL:-}" ]] && echo "  Super Admin: ${SUPERADMIN_NAME} <${SUPERADMIN_EMAIL}>"
  echo "  Diretório:  ${PROJETO_DIR}"
  ask_yes_no "Confirmar e iniciar a instalação?" s || { echo "Instalação cancelada."; exit 0; }
}

_valid_mode_choice() { [[ "$1" =~ ^[12]$ ]]; }
_valid_evo_choice() { [[ "$1" =~ ^[123]$ ]]; }
_valid_host_input() { is_valid_hostname "$(normalize_host "$1")"; }
_valid_http_url() { [[ "$1" =~ ^https?://[^[:space:]/]+(:[0-9]+)?/?$ ]]; }
_valid_name() { [[ ${#1} -ge 2 && ${#1} -le 120 ]]; }
_nonempty() { [[ -n "$1" ]]; }

###############################################################################
# DNS
###############################################################################
dns_a_record() {
  local r=""
  if command -v dig >/dev/null 2>&1; then
    r="$(dig +short "$1" A @1.1.1.1 2>/dev/null | grep -E '^[0-9.]+$' | head -1 || true)"
  fi
  [[ -z "$r" ]] && r="$(getent ahostsv4 "$1" 2>/dev/null | awk '{print $1; exit}' || true)"
  printf '%s' "$r"
}

validate_dns() {
  [[ "$INSTALL_MODE" == "domain" ]] || return 0
  [[ "${SKIP_DNS_CHECK:-0}" == "1" ]] && { ui_warn "Validação de DNS ignorada (SKIP_DNS_CHECK=1)."; return 0; }
  while true; do
    local a b ok=1
    a="$(dns_a_record "$DOMAIN")"; b="$(dns_a_record "$API_DOMAIN")"
    echo "  ${DOMAIN} → ${a:-sem registro}   (esperado ${SERVER_IP})"
    echo "  ${API_DOMAIN} → ${b:-sem registro}   (esperado ${SERVER_IP})"
    [[ "$a" == "$SERVER_IP" && "$b" == "$SERVER_IP" ]] || ok=0
    if ((ok)); then
      ui_ok "DNS aponta para esta VPS"
      if command -v dig >/dev/null 2>&1 && [[ -n "$(dig +short "$DOMAIN" AAAA @1.1.1.1 2>/dev/null)$(dig +short "$API_DOMAIN" AAAA @1.1.1.1 2>/dev/null)" ]]; then
        ui_warn "Há registro AAAA (IPv6). Ele precisa apontar para o IPv6 desta VPS, ou remova-o, senão o certificado falha."
      fi
      return 0
    fi
    ui_warn "Crie registros DNS do tipo A para ${DOMAIN} e ${API_DOMAIN} apontando para ${SERVER_IP} (sem proxy/CDN durante a emissão do certificado)."
    if [[ "${ASSUME_YES:-0}" == "1" || ! -t 0 ]]; then
      ui_warn "Continuando sem DNS válido: o HTTPS não será emitido agora. Depois execute: sudo bash install.sh --reconfigurar"
      DNS_OK=0; return 0
    fi
    local c
    read -r -p "  [T]entar de novo, [C]ontinuar sem HTTPS por enquanto, [S]air: " c
    case "${c,,}" in
      c) DNS_OK=0; return 0 ;;
      s) exit 0 ;;
      *) sleep 5 ;;
    esac
  done
}

###############################################################################
# Etapas de instalação (idempotentes)
###############################################################################
install_base_packages() {
  apt-get update -y
  local pkgs=(git curl ca-certificates gnupg tzdata openssl dnsutils iproute2 ufw nginx
    postgresql postgresql-contrib redis-server
    libxshmfence1 libgbm1 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libpango-1.0-0
    libcairo2 fonts-liberation)
  # libasound2 foi renomeada no Ubuntu 24.04.
  if apt-cache show libasound2t64 >/dev/null 2>&1; then pkgs+=(libasound2t64); else pkgs+=(libasound2); fi
  [[ "$INSTALL_MODE" == "domain" ]] && pkgs+=(certbot python3-certbot-nginx)
  apt-get install -y --no-install-recommends "${pkgs[@]}"
  ui_ok "Pacotes do sistema instalados"
}

ensure_swap() {
  local mem_mb swap_mb
  mem_mb="$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo)"
  swap_mb="$(awk '/SwapTotal/ {printf "%d", $2/1024}' /proc/meminfo)"
  # O build do painel (CRA 3) usa ~1,8 GB; com PostgreSQL/Redis/Evolution ativos, 4 GB de RAM
  # sem swap suficiente termina em OOM (medido na homologação).
  ((mem_mb < 6000 && swap_mb < 2000)) || return 0
  [[ -f /swapfile ]] && swapon --show=NAME --noheadings | grep -qx /swapfile && return 0
  if ask_yes_no "A VPS tem ${mem_mb} MB de RAM e ${swap_mb} MB de swap. Criar /swapfile de 2 GB (evita falta de memória no build do painel)?" s; then
    if [[ ! -f /swapfile ]]; then
      fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
      chmod 600 /swapfile
      mkswap /swapfile
    fi
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
    if swapon /swapfile 2>/dev/null || swapon --show=NAME --noheadings | grep -qx /swapfile; then
      ui_ok "Swap de 2 GB ativo"
    else
      ui_warn "Não foi possível ativar /swapfile (o build do painel pode falhar por falta de memória)."
    fi
  fi
}

install_node() {
  local cur=""
  command -v node >/dev/null 2>&1 && cur="$(node -v)"
  if [[ -n "$cur" ]] && version_ge "$cur" "$NODE_MAJOR" && ! version_ge "$cur" "$((NODE_MAJOR + 1))"; then
    ui_ok "Node.js ${cur} já instalado"; return 0
  fi
  if [[ -n "$cur" ]] && version_ge "$cur" "$((NODE_MAJOR + 1))"; then
    ui_warn "Node.js ${cur} é mais novo que o homologado (${NODE_MAJOR}.x). Mantido; em caso de erro de build instale o ${NODE_MAJOR}.x."
    return 0
  fi
  # Repositório oficial NodeSource (chave assinada), linha ${NODE_MAJOR}.x.
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" >/etc/apt/sources.list.d/nodesource.list
  apt-get update -y
  apt-get install -y nodejs build-essential
  ui_ok "Node.js $(node -v) instalado"
}

setup_postgres() {
  systemctl enable --now postgresql
  DB_NAME="${DB_NAME:-atendechat}"; DB_USER="${DB_USER:-atendechat}"
  is_safe_pg_ident "$DB_NAME" && is_safe_pg_ident "$DB_USER" || ui_fail "DB_NAME/DB_USER inválidos (use letras minúsculas, números e _)."
  local role_exists db_exists
  role_exists="$(sudo -u postgres psql -Atqc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")"
  db_exists="$(sudo -u postgres psql -Atqc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")"
  if [[ -z "$role_exists" ]]; then
    DB_PASS="$(gen_secret 24)"
    sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<<"CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';"
    ui_ok "Usuário PostgreSQL ${DB_USER} criado (senha gerada, gravada só em backend/.env)"
  else
    DB_PASS="$(env_get "$BACKEND_ENV" DB_PASS || true)"
    if [[ -z "$DB_PASS" ]] || is_insecure_secret "$DB_PASS"; then
      DB_PASS="$(gen_secret 24)"
      sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<<"ALTER ROLE ${DB_USER} PASSWORD '${DB_PASS}';"
      ui_ok "Senha do usuário PostgreSQL ${DB_USER} redefinida (valor anterior ausente ou inseguro)"
    else
      ui_ok "Usuário PostgreSQL ${DB_USER} já existe (senha preservada)"
    fi
  fi
  if [[ -z "$db_exists" ]]; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER} ENCODING 'UTF8' TEMPLATE template0;"
    ui_ok "Banco ${DB_NAME} criado"
  else
    ui_ok "Banco ${DB_NAME} já existe (preservado)"
  fi
  sudo -u postgres psql -d "$DB_NAME" -q -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
  sudo -u postgres psql -d "$DB_NAME" -q -c 'CREATE EXTENSION IF NOT EXISTS "pgcrypto";' || true

  # Restauração de backup pelo painel usa psql como superusuário (DB_IMPORT_*).
  DB_IMPORT_USER=postgres
  DB_IMPORT_PASS="$(env_get "$BACKEND_ENV" DB_IMPORT_PASS || true)"
  [[ -z "$DB_IMPORT_PASS" ]] && DB_IMPORT_PASS="$(gen_secret 24)"
  # Segredos via stdin (nunca em argv, que aparece em ps).
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<<"ALTER USER postgres WITH PASSWORD '${DB_IMPORT_PASS}';" >/dev/null

  local listen
  listen="$(sudo -u postgres psql -Atqc 'SHOW listen_addresses')"
  if [[ "$listen" == "localhost" || "$listen" == "127.0.0.1" ]]; then
    ui_ok "PostgreSQL escuta só em localhost"
  else
    ui_warn "PostgreSQL listen_addresses='${listen}'. Recomendado: 'localhost' (não exponha o banco)."
  fi
}

setup_redis() {
  local conf=/etc/redis/redis.conf cur
  [[ -f "$conf" ]] || ui_fail "Arquivo ${conf} não encontrado." "Reinstale o pacote redis-server."
  cur="$(env_get "$BACKEND_ENV" REDIS_URI || true)"
  if [[ "$cur" =~ ^redis://:([^@]+)@ ]]; then
    REDIS_PASS="${BASH_REMATCH[1]}"
  else
    REDIS_PASS="$(awk '$1=="requirepass" {print $2; exit}' "$conf")"
  fi
  if [[ -z "$REDIS_PASS" ]] || is_insecure_secret "$REDIS_PASS"; then
    REDIS_PASS="$(gen_secret 24)"
  fi
  # Senha comparada via ambiente (nunca em argv); temporário criado com 600.
  if ! P="$REDIS_PASS" awk '$1=="requirepass" && $2==ENVIRON["P"] {f=1} END {exit !f}' "$conf"; then
    cp -p "$conf" "${conf}.bak-$(date +%Y%m%d-%H%M%S)"
    local tmp; tmp="$(mktemp)"
    grep -vE '^[[:space:]]*requirepass[[:space:]]' "$conf" >"$tmp" || true
    printf 'requirepass %s\n' "$REDIS_PASS" >>"$tmp"
    cat "$tmp" >"$conf"; rm -f "$tmp"
  fi
  grep -qE '^supervised no' "$conf" && sed -i 's/^supervised no/supervised systemd/' "$conf"
  grep -qE '^bind 127\.0\.0\.1' "$conf" || ui_warn "Redis sem 'bind 127.0.0.1' em ${conf}: confirme que não está exposto."
  systemctl enable redis-server >/dev/null 2>&1 || true
  systemctl restart redis-server
  REDIS_URI_VALUE="redis://:${REDIS_PASS}@127.0.0.1:6379"
  if REDISCLI_AUTH="$REDIS_PASS" redis-cli ping | grep -q PONG; then ui_ok "Redis com senha, ouvindo em localhost"; else ui_fail "Redis não respondeu." "Veja: journalctl -u redis-server -n 50"; fi
}

# Gera/atualiza backend/.env. Instalação nova: parte do .env.example e gera segredos.
write_backend_env_nova() {
  if [[ -f "$BACKEND_ENV" ]]; then
    local bk; bk="$(backup_file "$BACKEND_ENV")"
    ui_info "Cópia de segurança do .env: ${bk}"
  else
    (umask 077 && cp "${BACKEND_DIR}/.env.example" "$BACKEND_ENV")
  fi
  chmod 600 "$BACKEND_ENV"
  local f="$BACKEND_ENV"
  env_set "$f" NODE_ENV production
  env_set "$f" BACKEND_URL "$BACKEND_URL_VALUE"
  env_set "$f" FRONTEND_URL "$FRONTEND_URL_VALUE"
  env_set "$f" PROXY_PORT ""
  env_set "$f" PORT "$API_PORT"
  env_set "$f" DB_DIALECT postgres
  env_set "$f" DB_HOST 127.0.0.1
  env_set "$f" DB_PORT 5432
  env_set "$f" DB_NAME "$DB_NAME"
  env_set "$f" DB_USER "$DB_USER"
  env_set "$f" DB_PASS "$DB_PASS"
  env_set "$f" DB_IMPORT_USER "$DB_IMPORT_USER"
  env_set "$f" DB_IMPORT_PASS "$DB_IMPORT_PASS"
  env_set "$f" REDIS_URI "$REDIS_URI_VALUE"
  # Instalação nova é produção (isola credenciais Efí de homologação). Altere só se for VPS de testes.
  env_set "$f" STREAMHUB_RUNTIME_ENV "${STREAMHUB_RUNTIME_ENV:-production}"
  # Segredos: gerados quando ausentes ou iguais a valores públicos de exemplo.
  local k
  [[ -n "$(jwt_secret_problems "$f")" ]] && { env_set "$f" JWT_SECRET "$(gen_secret 32)"; env_set "$f" JWT_REFRESH_SECRET "$(gen_secret 32)"; }
  for k in ENV_TOKEN WEBHOOK_SUBSCRIPTION_SECRET \
    EFI_CREDENTIAL_ENCRYPTION_KEY META_TOKEN_ENCRYPTION_KEY \
    AI_PROVIDER_CREDENTIAL_ENCRYPTION_KEY EVOLUTION_CREDENTIAL_ENCRYPTION_KEY; do
    if is_insecure_secret "$(env_get "$f" "$k" || true)"; then env_set "$f" "$k" "$(gen_secret 32)"; fi
  done
  # Exemplos que apontam para o domínio do proprietário original ou credenciais fictícias.
  env_set "$f" META_OAUTH_REDIRECT_URI "$([[ "$INSTALL_MODE" == domain ]] && echo "https://${API_DOMAIN}/instagram/oauth/callback")"
  for k in MAIL_HOST MAIL_USER MAIL_PASS MAIL_FROM MAIL_PORT; do env_set "$f" "$k" ""; done
  chmod 600 "$f"
  ui_ok "backend/.env gerado (permissão 600; segredos não exibidos)"
}

write_frontend_env() {
  [[ -f "$FRONTEND_ENV" ]] || (umask 022 && : >"$FRONTEND_ENV")
  env_set "$FRONTEND_ENV" REACT_APP_BACKEND_URL "$BACKEND_URL_VALUE"
  env_set "$FRONTEND_ENV" REACT_APP_BACKEND_PORT "$API_PORT"
  chmod 644 "$FRONTEND_ENV"
}

# npm ci quando o lockfile está versionado (versões exatas); senão npm install.
npm_deps() {
  local dir="$1" ylock=""
  # npm 7+ reescreve um yarn.lock presente; frontend/yarn.lock versionado ficaria "modificado"
  # e o publish-frontend.sh recusaria publicar. Preserva o arquivo como estava.
  if [[ -f "$dir/yarn.lock" ]]; then ylock="$(mktemp)"; cp -p "$dir/yarn.lock" "$ylock"; fi
  local rc=0
  if git -C "$PROJETO_DIR" ls-files --error-unmatch "${dir#"$PROJETO_DIR"/}/package-lock.json" >/dev/null 2>&1; then
    (cd "$dir" && npm ci --no-audit --no-fund) || rc=$?
  else
    (cd "$dir" && npm install --production=false --no-audit --no-fund) || rc=$?
  fi
  if [[ -n "$ylock" ]]; then cp -p "$ylock" "$dir/yarn.lock"; rm -f "$ylock"; fi
  return "$rc"
}

build_backend_and_migrate() {
  ui_info "Dependências do backend"
  npm_deps "$BACKEND_DIR"
  ui_info "Compilando backend"
  (cd "$BACKEND_DIR" && npm run build)
  [[ -f "${BACKEND_DIR}/dist/server.js" ]] || ui_fail "Build do backend não gerou dist/server.js."
  mkdir -p "${BACKEND_DIR}/backups/incoming" "${BACKEND_DIR}/public"
  chmod 750 "${BACKEND_DIR}/backups"
  ensure_postgres_app_ownership
  ui_info "Migrations do banco (Sequelize)"
  (cd "$BACKEND_DIR" && npx sequelize db:migrate)
  ui_ok "Backend compilado e banco atualizado"
}

bootstrap_superadmin() {
  local mode="${1:-}"
  # shellcheck disable=SC2086 # $mode vazio = nenhum argumento
  (cd "$BACKEND_DIR" && SUPERADMIN_NAME="${SUPERADMIN_NAME:-}" SUPERADMIN_EMAIL="${SUPERADMIN_EMAIL:-}" \
    SUPERADMIN_PASSWORD="${SUPERADMIN_PASSWORD:-}" node dist/scripts/bootstrapSuperAdmin.js $mode)
}

# Número de Super Admins (o backend também imprime logs no stdout; lê só a linha JSON).
superadmin_count() {
  (cd "$BACKEND_DIR" && node dist/scripts/bootstrapSuperAdmin.js --status 2>/dev/null) |
    sed -nE 's/^\{"superAdmins":([0-9]+)\}$/\1/p' | tail -1 | grep . || echo 0
}

publish_frontend() {
  write_frontend_env
  ui_info "Dependências do frontend"
  npm_deps "$FRONTEND_DIR"
  ui_info "Build e publicação atômica (scripts/publish-frontend.sh)"
  bash "${PROJETO_DIR}/scripts/publish-frontend.sh"
  [[ -f "${FRONTEND_DIR}/build/index.html" ]] || ui_fail "frontend/build/index.html não encontrado após a publicação."
  ui_ok "Frontend publicado"
}

###############################################################################
# Usuário de serviço do backend
# Instalação nova: usuário dedicado sem login (SERVICE_USER, padrão atendechat).
# Instalação existente: mantém o User= da unit até a migração explícita
# (--reconfigurar, opção 5). O atualizador do painel precisa: ser dono do repositório e da
# pasta de releases do frontend, e sudo só para "systemctl restart <serviço>".
###############################################################################
SERVICE_USER_DEFAULT="atendechat"
SUDOERS_FILE="/etc/sudoers.d/${SERVICE_NAME}"

# Usuário atual da unit (root se a unit não existir ou não definir User=).
current_service_user() {
  local u
  u="$(awk -F= '/^User=/ {print $2; exit}' "/etc/systemd/system/${SERVICE_NAME}.service" 2>/dev/null || true)"
  printf '%s' "${u:-root}"
}

releases_dir() { printf '%s' "${FRONTEND_RELEASES_DIR:-$(dirname "$PROJETO_DIR")/atendechat-frontend-releases}"; }

ensure_service_user() {
  local u="$1"
  [[ "$u" == "root" ]] && return 0
  [[ "$u" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]] || ui_fail "Nome de usuário de serviço inválido: ${u}"
  if ! id -u "$u" >/dev/null 2>&1; then
    useradd --system --user-group --home-dir "/var/lib/${u}" --create-home --shell /usr/sbin/nologin "$u"
    ui_ok "Usuário de serviço ${u} criado (sem login)"
  fi
  # Permissão mínima: só reiniciar o próprio serviço (botão de atualização do painel).
  local tmp; tmp="$(mktemp)"
  printf '%s ALL=(root) NOPASSWD: /usr/bin/systemctl restart %s, /bin/systemctl restart %s\n' "$u" "$SERVICE_NAME" "$SERVICE_NAME" >"$tmp"
  if visudo -cf "$tmp" >/dev/null; then
    install -m 0440 -o root -g root "$tmp" "$SUDOERS_FILE"
  else
    rm -f "$tmp"; ui_fail "Regra sudo inválida para ${u}." "Verifique o pacote sudo (visudo)."
  fi
  rm -f "$tmp"
}

# Arquivos gerados pelo instalador (root) passam ao usuário de serviço.
apply_service_ownership() {
  local u="$1" rel
  [[ "$u" == "root" ]] && return 0
  rel="$(releases_dir)"
  chown -R "${u}:${u}" "$PROJETO_DIR"
  [[ -d "$rel" ]] && chown -R "${u}:${u}" "$rel"
  chmod 600 "$BACKEND_ENV"
  # git como root no repositório do usuário de serviço (atualizações via install.sh).
  git config --global --get-all safe.directory 2>/dev/null | grep -qxF "$PROJETO_DIR" ||
    git config --global --add safe.directory "$PROJETO_DIR"
}

write_systemd_unit() {
  local unit="/etc/systemd/system/${SERVICE_NAME}.service" user="${1:-}"
  # Sem argumento: preserva o usuário da unit existente.
  [[ -z "$user" ]] && user="$(current_service_user)"
  cat >"$unit" <<EOF
[Unit]
Description=StreamHub Chat Backend
After=network-online.target postgresql.service redis-server.service
Wants=network-online.target

[Service]
Type=simple
User=${user}
WorkingDirectory=${BACKEND_DIR}
ExecStart=$(command -v node) dist/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME" >/dev/null 2>&1
  systemctl restart "$SERVICE_NAME"
  wait_backend
}

wait_backend() {
  local i
  for ((i = 0; i < 90; i += 3)); do
    if curl -fsS -o /dev/null --max-time 3 "http://127.0.0.1:${API_PORT}/system-settings/branding-bootstrap.js"; then
      ui_ok "Backend respondendo em 127.0.0.1:${API_PORT}"; return 0
    fi
    sleep 3
  done
  ui_fail "O backend não respondeu em 90 s." "Veja: journalctl -u ${SERVICE_NAME} -n 100 --no-pager"
}

nginx_spa_locations() {
  cat <<EOF
    root ${FRONTEND_DIR}/build;
    index index.html;
    location = /index.html { add_header Cache-Control "no-cache, no-store, must-revalidate" always; try_files \$uri =404; }
    location = /version.json { add_header Cache-Control "no-cache, no-store, must-revalidate" always; try_files \$uri =404; }
    location = /service-worker.js { add_header Cache-Control "no-cache, no-store, must-revalidate" always; try_files \$uri =404; }
    location /static/ { add_header Cache-Control "public, max-age=31536000, immutable" always; try_files \$uri =404; }
    location / { try_files \$uri \$uri/ @spa; }
    location @spa { add_header Cache-Control "no-cache, no-store, must-revalidate" always; try_files /index.html =404; }
EOF
}

NGINX_BACKUPS=()
# Volta os vhosts do StreamHub ao estado anterior a write_nginx (inclui blocos 443 do certbot).
restore_nginx_backups() {
  local avail=/etc/nginx/sites-available en=/etc/nginx/sites-enabled entry f b
  rm -f "$en/atendechat" "$en/atendechat-frontend" "$en/atendechat-backend"
  for entry in "${NGINX_BACKUPS[@]}"; do
    f="${entry%%=*}"; b="${entry#*=}"
    cp -p "$b" "$avail/$f"; ln -sf "$avail/$f" "$en/$f"
  done
  nginx -t && systemctl reload nginx
  ui_warn "Configuração anterior do Nginx restaurada."
}

write_nginx() {
  local avail=/etc/nginx/sites-available en=/etc/nginx/sites-enabled f b v6=""
  NGINX_BACKUPS=()
  for f in atendechat atendechat-frontend atendechat-backend; do
    if [[ -L "$en/$f" && -f "$avail/$f" ]]; then
      b="/root/nginx-${f}.bak-$(date +%Y%m%d-%H%M%S)"
      cp -p "$avail/$f" "$b"; NGINX_BACKUPS+=("${f}=${b}")
    fi
  done
  # IPv6: se o domínio tiver AAAA, o desafio do Let's Encrypt chega por IPv6.
  [[ -f /proc/net/if_inet6 ]] && v6="    listen [::]:80;"
  printf '%s\n' 'client_max_body_size 4G;' 'server_tokens off;' >/etc/nginx/conf.d/atendechat-limits.conf
  rm -f "$en/default"
  if [[ "$INSTALL_MODE" == "domain" ]]; then
    rm -f "$en/atendechat"
    { echo "server {"; echo "    listen 80;"; [[ -n "$v6" ]] && echo "$v6"; echo "    server_name ${DOMAIN};"; nginx_spa_locations; echo "}"; } >"$avail/atendechat-frontend"
    cat >"$avail/atendechat-backend" <<EOF
server {
    listen 80;
${v6}
    server_name ${API_DOMAIN};
    location / {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
}
EOF
    ln -sf "$avail/atendechat-frontend" "$en/atendechat-frontend"
    ln -sf "$avail/atendechat-backend" "$en/atendechat-backend"
  else
    rm -f "$en/atendechat-frontend" "$en/atendechat-backend"
    { echo "server {"; echo "    listen 80 default_server;"; [[ -n "$v6" ]] && echo "    listen [::]:80 default_server;"; echo "    server_name _;"; nginx_spa_locations; echo "}"; } >"$avail/atendechat"
    ln -sf "$avail/atendechat" "$en/atendechat"
  fi
  nginx -t || ui_fail "Configuração do Nginx inválida." "Veja a saída de nginx -t acima."
  systemctl enable nginx >/dev/null 2>&1
  systemctl reload nginx || systemctl restart nginx
  ui_ok "Nginx configurado (${INSTALL_MODE})"
}

issue_certificate() {
  [[ "$INSTALL_MODE" == "domain" ]] || return 0
  if [[ "${DNS_OK:-1}" == "0" ]]; then
    ui_warn "HTTPS não emitido: o DNS ainda não aponta para esta VPS. Depois: sudo bash install.sh --reconfigurar"
    SSL_STATUS="pendente (DNS)"; return 0
  fi
  # --expand/--cert-name: reaproveita um certificado antigo que cobria só parte dos nomes.
  if certbot --nginx -d "$DOMAIN" -d "$API_DOMAIN" -m "$SSL_EMAIL" --agree-tos --no-eff-email \
    --non-interactive --redirect --keep-until-expiring --expand --cert-name "$DOMAIN"; then
    systemctl reload nginx
    SSL_STATUS="ativo"
    ui_ok "Certificado HTTPS emitido (renovação automática pelo timer do certbot)"
  else
    SSL_STATUS="falhou"
    ui_warn "O certbot não emitiu o certificado. Causas comuns: DNS ainda propagando, porta 80 bloqueada no provedor, proxy/CDN ativo. Corrija e execute: sudo bash install.sh --reconfigurar"
  fi
}

install_docker() {
  if docker compose version >/dev/null 2>&1; then ui_ok "Docker e Compose já instalados"; return 0; fi
  apt-get install -y docker.io docker-compose-v2 ||
    ui_fail "Não foi possível instalar docker.io/docker-compose-v2." "No Ubuntu 22.04/24.04 os pacotes ficam no repositório universe: add-apt-repository universe && apt-get update"
  systemctl enable --now docker
  docker compose version >/dev/null 2>&1 || ui_fail "docker compose indisponível após instalar."
  ui_ok "Docker instalado"
}

# Aplica a configuração Evolution no backend/.env (e reinicia o backend se mudou).
apply_evolution_backend_env() {
  local url="$1" key="$2" f="$BACKEND_ENV" before after
  before="$(env_get "$f" EVOLUTION_CENTRAL_BASE_URL || true)|$(env_get "$f" EVOLUTION_CENTRAL_API_KEY || true)"
  env_set "$f" EVOLUTION_CENTRAL_BASE_URL "$url"
  env_set "$f" EVOLUTION_CENTRAL_API_KEY "$key"
  env_set_if_empty "$f" EVOLUTION_CREDENTIAL_ENCRYPTION_KEY "$(gen_secret 32)" || true
  env_set "$f" EVOLUTION_WEBHOOK_PUBLIC_BASE_URL "$BACKEND_URL_VALUE"
  after="${url}|${key}"
  [[ "$before" == "$after" ]] && return 1
  return 0
}

setup_evolution() {
  case "${EVOLUTION_MODE:-nenhuma}" in
    local)
      install_docker
      evolution_render "$EVOLUTION_DIR"
      ui_info "Baixando imagens (${EVOLUTION_IMAGE})"
      evolution_compose pull
      evolution_compose up -d
      local key ver
      key="$(env_get "${EVOLUTION_DIR}/.env" AUTHENTICATION_API_KEY)"
      ver="$(evolution_wait_healthy "$EVOLUTION_LOCAL_URL" "$key" 240)" ||
        ui_fail "A Evolution não respondeu em ${EVOLUTION_LOCAL_URL}." "Veja: docker logs evolution-api --tail 100"
      ui_ok "Evolution ${ver} ativa em ${EVOLUTION_LOCAL_URL} (somente local)"
      evolution_check_key "$EVOLUTION_LOCAL_URL" "$key" || ui_fail "A Evolution recusou a API key gerada." "Veja: docker logs evolution-api --tail 100"
      if apply_evolution_backend_env "$EVOLUTION_LOCAL_URL" "$key"; then systemctl restart "$SERVICE_NAME"; wait_backend; fi
      check_webhook_reachability
      ;;
    externa)
      evolution_check_key "$EVOLUTION_EXTERNAL_URL" "$EVOLUTION_EXTERNAL_KEY" ||
        ui_fail "Evolution externa não respondeu ou recusou a API key (${EVOLUTION_EXTERNAL_URL}/instance/fetchInstances)." \
          "Confira a URL, a key (AUTHENTICATION_API_KEY do servidor Evolution) e se esta VPS tem acesso a ele."
      ui_ok "Evolution externa acessível e key aceita"
      if apply_evolution_backend_env "$EVOLUTION_EXTERNAL_URL" "$EVOLUTION_EXTERNAL_KEY"; then systemctl restart "$SERVICE_NAME"; wait_backend; fi
      ui_info "O servidor Evolution externo precisa alcançar ${BACKEND_URL_VALUE}/webhooks/evolution/<id> (webhooks)."
      ;;
    *) ui_info "Evolution não configurada (conexões Baileys continuam disponíveis)." ;;
  esac
}

# A Evolution envia webhooks para BACKEND_URL. Testa de dentro do contêiner.
check_webhook_reachability() {
  local url="${BACKEND_URL_VALUE}/system-settings/branding-bootstrap.js"
  if docker exec evolution-api sh -c "wget -q -O /dev/null -T 10 '${url}' || curl -fsS -o /dev/null --max-time 10 '${url}'" >/dev/null 2>&1; then
    ui_ok "Evolution alcança o backend em ${BACKEND_URL_VALUE} (webhooks)"
    WEBHOOK_STATUS="ok"
  else
    WEBHOOK_STATUS="sem acesso"
    ui_warn "A Evolution ainda não alcança ${BACKEND_URL_VALUE}. Sem isso, QR Code e mensagens recebidas não chegam."
    ui_warn "Se o HTTPS ainda não foi emitido, conclua-o (--reconfigurar). Veja 'Webhook da Evolution' no manual."
  fi
}

# Portas SSH: sshd -T (todas), sockets em escuta do sshd/ssh.socket e a porta da sessão atual.
ssh_ports() {
  {
    sshd -T 2>/dev/null | awk '$1=="port" {print $2}' || true
    ss -Hltnp 2>/dev/null | awk '/"sshd"|"systemd"/ && /ssh/ {n=split($4,a,":"); print a[n]}' || true
    [[ -n "${SSH_CONNECTION:-}" ]] && awk '{print $4}' <<<"$SSH_CONNECTION"
    echo 22
  } | grep -E '^[0-9]+$' | sort -un | tr '\n' ' ' | sed 's/ $//'
}

setup_firewall() {
  command -v ufw >/dev/null 2>&1 || { ui_warn "ufw não instalado; firewall não configurado."; return 0; }
  local sp p; sp="$(ssh_ports)"
  for p in $sp; do ufw allow "${p}/tcp" >/dev/null; done
  ufw allow 80/tcp >/dev/null
  if [[ "$INSTALL_MODE" == "domain" ]]; then
    ufw allow 443/tcp >/dev/null
    # A API passa pelo Nginx; a porta do Node não precisa ficar pública.
    ufw status | grep -qE "^${API_PORT}/tcp +ALLOW" && ufw delete allow "${API_PORT}/tcp" >/dev/null || true
  else
    ufw allow "${API_PORT}/tcp" >/dev/null
  fi
  if ufw status | grep -q "Status: active"; then
    ui_ok "Firewall ativo (SSH ${sp}, 80$([[ "$INSTALL_MODE" == domain ]] && echo ', 443' || echo ", ${API_PORT}"))"
  elif ask_yes_no "Ativar o firewall (ufw) liberando apenas SSH (${sp}), HTTP/HTTPS$([[ "$INSTALL_MODE" == ip ]] && echo " e ${API_PORT}")? Confirme que sua conexão SSH usa uma dessas portas." s; then
    ufw --force enable >/dev/null
    ui_ok "Firewall ativado"
  else
    ui_warn "Firewall não ativado."
  fi
}

###############################################################################
# Verificação final / diagnóstico (somente leitura)
###############################################################################
check_line() { if eval "$2" >/dev/null 2>&1; then ui_ok "$1"; else ui_err "$1"; DIAG_FAIL=$((DIAG_FAIL + 1)); fi; }

run_diagnostics() {
  DIAG_FAIL=0
  load_existing_config
  compute_urls
  echo ""
  echo "${C_BOLD}Diagnóstico${C_RESET} (somente leitura)"
  echo "  Modo: ${INSTALL_MODE} | Painel: ${FRONTEND_URL_VALUE} | API: ${BACKEND_URL_VALUE} | Evolution: ${EVOLUTION_MODE}"
  echo "  Commit: $(git -C "$PROJETO_DIR" rev-parse --short HEAD 2>/dev/null || echo '?') | Node: $(node -v 2>/dev/null || echo ausente)"
  check_line "Serviço PostgreSQL ativo" "systemctl is-active --quiet postgresql"
  check_line "Serviço Redis ativo" "systemctl is-active --quiet redis-server"
  check_line "Serviço Nginx ativo" "systemctl is-active --quiet nginx"
  check_line "Serviço ${SERVICE_NAME} ativo" "systemctl is-active --quiet ${SERVICE_NAME}"
  # Até 30 s: logo após um restart o backend ainda está subindo.
  check_line "Backend responde em 127.0.0.1:${API_PORT}" "(for _ in 1 2 3 4 5 6; do curl -fsS -o /dev/null --max-time 5 http://127.0.0.1:${API_PORT}/system-settings/branding-bootstrap.js && exit 0; sleep 5; done; exit 1)"
  check_line "Frontend publicado (frontend/build/index.html)" "test -f '${FRONTEND_DIR}/build/index.html'"
  check_line "Nginx serve o painel localmente" "curl -fsS -o /dev/null --max-time 5 -H 'Host: ${DOMAIN:-localhost}' http://127.0.0.1/"
  check_line "Configuração do Nginx válida" "nginx -t"
  check_line "backend/.env com permissão 600" "[[ \$(stat -c %a '$BACKEND_ENV') == 600 ]]"
  check_line "Segredos JWT válidos (32+ caracteres, distintos, não públicos)" "[[ -z \"\$(jwt_secret_problems '$BACKEND_ENV')\" ]]"
  local su; su="$(current_service_user)"
  if [[ "$su" == "root" ]]; then ui_warn "Backend roda como root (migrar: --reconfigurar, opção 5)"; else ui_ok "Backend roda como usuário dedicado (${su})"; fi
  check_line "ENV_TOKEN definido (bloqueia /auth/signup anônimo)" "[[ -n \"\$(env_get '$BACKEND_ENV' ENV_TOKEN)\" ]]"
  check_line "PostgreSQL não exposto (só localhost)" "! ss -Hltn 'sport = :5432' | grep -vE '127\.0\.0\.1|\[::1\]' | grep -q ."
  check_line "Redis não exposto (só localhost)" "! ss -Hltn 'sport = :6379' | grep -vE '127\.0\.0\.1|\[::1\]' | grep -q ."
  local supers
  supers="$(superadmin_count)"
  check_line "Existe ao menos um Super Admin (${supers})" "[[ ${supers:-0} -ge 1 ]]"
  if [[ "$INSTALL_MODE" == "domain" ]]; then
    check_line "HTTPS do painel (https://${DOMAIN})" "curl -fsS -o /dev/null --max-time 10 https://${DOMAIN}/"
    check_line "HTTPS da API (https://${API_DOMAIN})" "curl -fsS -o /dev/null --max-time 10 https://${API_DOMAIN}/system-settings/branding-bootstrap.js"
    check_line "Renovação automática de certificados (certbot.timer)" "systemctl is-enabled --quiet certbot.timer || systemctl list-timers | grep -q certbot"
  fi
  local evo_url
  evo_url="$(env_get "$BACKEND_ENV" EVOLUTION_CENTRAL_BASE_URL || true)"
  if [[ -n "$evo_url" ]]; then
    check_line "Evolution responde e aceita a API key (${evo_url})" "evolution_check_key '$evo_url' \"\$(env_get '$BACKEND_ENV' EVOLUTION_CENTRAL_API_KEY)\""
    if [[ -f "${EVOLUTION_DIR}/docker-compose.yml" ]]; then
      check_line "Contêineres Evolution ativos" "[[ \$(docker ps --filter name='^evolution-' --filter status=running -q | wc -l) -ge 3 ]]"
      check_line "Evolution publicada só em 127.0.0.1" "! docker port evolution-api | grep -v '127.0.0.1' | grep -q ."
    fi
    check_line "EVOLUTION_CREDENTIAL_ENCRYPTION_KEY definida" "[[ -n \"\$(env_get '$BACKEND_ENV' EVOLUTION_CREDENTIAL_ENCRYPTION_KEY)\" ]]"
  fi
  echo ""
  if ((DIAG_FAIL == 0)); then ui_ok "Nenhum problema encontrado."; else ui_warn "${DIAG_FAIL} verificação(ões) falharam. Consulte 'Solução de problemas' no manual."; fi
  ((DIAG_FAIL == 0))
}

###############################################################################
# Fluxos
###############################################################################
flow_nova() {
  local signals
  signals="$(existing_install_signals)"
  # Instalação nova interrompida por falha: pode ser retomada (etapas idempotentes).
  local kind=nova
  if [[ -n "$signals" && "$(state_get INSTALL_STATUS)" == "em_andamento" && "$(state_get PROJETO_DIR)" == "$PROJETO_DIR" ]]; then
    ui_warn "Uma instalação nova anterior não terminou. Ela será retomada; dados e segredos já gerados são preservados."
    ask_yes_no "Retomar a instalação?" s || exit 0
    signals=""
    kind=retomada
  fi
  if [[ -n "$signals" ]]; then
    ui_err "Foi encontrada uma instalação existente nesta VPS:"
    echo "$signals" | sed 's/^/      - /'
    ui_fail "A instalação nova foi bloqueada para não sobrescrever dados." \
      "Use --atualizar (nova versão do código) ou --reconfigurar (domínio, Evolution, firewall). Para reinstalar do zero, use uma VPS limpa."
  fi
  check_prereqs "$kind" || ui_fail "Pré-requisitos não atendidos." "Corrija os itens [ERRO] acima e execute de novo."
  if [[ "$kind" == "retomada" ]]; then
    local k
    for k in INSTALL_MODE DOMAIN API_DOMAIN SERVER_IP EVOLUTION_MODE; do
      [[ -z "${!k:-}" ]] && printf -v "$k" '%s' "$(state_get "$k")"
    done
    if [[ -f "${BACKEND_DIR}/dist/scripts/bootstrapSuperAdmin.js" ]] && (( $(superadmin_count) >= 1 )); then
      SKIP_SUPERADMIN=1
      ui_info "Super Admin já criado na execução anterior (não será perguntado de novo)."
    fi
  fi
  collect_answers_nova
  INSTALL_STATUS=em_andamento
  state_save INSTALL_STATUS PROJETO_DIR
  STEP_TOTAL=12
  ui_step "Validando DNS"; DNS_OK=1; validate_dns
  ui_step "Instalando pacotes do sistema"; ensure_swap; install_base_packages
  timedatectl set-timezone America/Sao_Paulo 2>/dev/null || true
  ui_step "Instalando Node.js ${NODE_MAJOR}"; install_node
  ui_step "Configurando PostgreSQL"; setup_postgres
  ui_step "Configurando Redis"; setup_redis
  ui_step "Gerando configuração do backend"; write_backend_env_nova
  state_save INSTALL_MODE DOMAIN API_DOMAIN SERVER_IP EVOLUTION_MODE PROJETO_DIR
  ui_step "Backend: dependências, build e migrations"; build_backend_and_migrate
  ui_step "Criando o primeiro Super Admin"; bootstrap_superadmin; unset SUPERADMIN_PASSWORD
  ui_step "Frontend: build e publicação"; publish_frontend
  ui_step "Serviço do backend e Nginx"
  SERVICE_USER="${SERVICE_USER:-$(if [[ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]]; then current_service_user; else echo "$SERVICE_USER_DEFAULT"; fi)}"
  ensure_service_user "$SERVICE_USER"; apply_service_ownership "$SERVICE_USER"
  write_systemd_unit "$SERVICE_USER"; write_nginx; SSL_STATUS="n/a"; issue_certificate
  ui_step "Evolution API"; setup_evolution
  ui_step "Firewall e verificação final"; setup_firewall
  # shellcheck disable=SC2034 # lido por state_save via ${!k}
  INSTALL_STATUS=concluida
  state_save INSTALL_STATUS
  run_diagnostics || true
  print_summary
}

flow_atualizar() {
  [[ -n "$(existing_install_signals)" && -f "$BACKEND_ENV" ]] ||
    ui_fail "Nenhuma instalação encontrada em ${PROJETO_DIR}." "Para uma VPS nova use: sudo bash install.sh --nova"
  check_prereqs existente || ui_fail "Pré-requisitos não atendidos."
  load_existing_config
  compute_urls
  echo "  Commit atual: $(git -C "$PROJETO_DIR" log -1 --format='%h %s')"
  STEP_TOTAL=6
  ui_step "Cópia de segurança do banco"
  if ask_yes_no "Fazer backup do banco antes de atualizar (recomendado)?" s; then
    bash "${PROJETO_DIR}/scripts/streamhub-backup.sh" --somente-banco
  fi
  ui_step "Verificando configuração"
  local envbk; envbk="$(backup_file "$BACKEND_ENV")"; ui_info "Cópia de segurança do .env: ${envbk}"
  # O backend não inicia com JWT ausente/curto/público/repetido (config/jwtSecrets.ts).
  local jp; jp="$(jwt_secret_problems "$BACKEND_ENV")"
  if [[ -n "$jp" ]]; then
    ui_warn "Configuração JWT recusada pela nova versão: $(echo "$jp" | tr '\n' ';' | sed 's/;$//')."
    if ask_yes_no "Gerar novos JWT_SECRET e JWT_REFRESH_SECRET agora? Sem isso o backend não inicia (usuários precisarão entrar de novo)." s; then
      env_set "$BACKEND_ENV" JWT_SECRET "$(gen_secret 32)"
      env_set "$BACKEND_ENV" JWT_REFRESH_SECRET "$(gen_secret 32)"
      ui_ok "Novos segredos JWT gerados (cópia anterior do .env em backups do instalador)."
    else
      ui_fail "Atualização interrompida antes de alterar o sistema." "Defina JWT_SECRET e JWT_REFRESH_SECRET (32+ caracteres, distintos; openssl rand -hex 32) em ${BACKEND_ENV}."
    fi
  fi
  if env_set_if_empty "$BACKEND_ENV" ENV_TOKEN "$(gen_secret 32)"; then ui_info "ENV_TOKEN adicionado (fecha /auth/signup anônimo)"; fi
  ui_step "Backend: dependências, build e migrations"; ensure_swap; build_backend_and_migrate
  ui_step "Frontend: build e publicação"; publish_frontend
  ui_step "Reiniciando serviços"
  apply_service_ownership "$(current_service_user)"
  [[ "$(current_service_user)" == "root" ]] && ui_info "Backend roda como root. Para usar um usuário dedicado: sudo bash install.sh --reconfigurar (opção 5)."
  systemctl restart "$SERVICE_NAME"; wait_backend
  nginx -t && systemctl reload nginx
  if [[ -f "${EVOLUTION_DIR}/docker-compose.yml" ]]; then
    if ! grep -q "image: ${EVOLUTION_IMAGE}\$" "${EVOLUTION_DIR}/docker-compose.yml"; then
      ui_warn "A Evolution instalada difere da versão homologada (${EVOLUTION_IMAGE})."
      if ask_yes_no "Atualizar a Evolution para ${EVOLUTION_IMAGE} (sessões e dados são preservados nos volumes)?" n; then
        evolution_render "$EVOLUTION_DIR"; evolution_compose pull; evolution_compose up -d
      fi
    fi
  fi
  state_save INSTALL_MODE DOMAIN API_DOMAIN SERVER_IP EVOLUTION_MODE PROJETO_DIR
  ui_step "Verificação final"; run_diagnostics || true
  echo ""
  ui_ok "Atualização concluída. Reverter só o frontend: bash scripts/publish-frontend.sh --rollback"
}

flow_reconfigurar() {
  [[ -f "$BACKEND_ENV" ]] || ui_fail "Nenhuma instalação encontrada." "Use --nova em uma VPS limpa."
  load_existing_config
  echo ""
  echo "  O que deseja reconfigurar?"
  echo "    1) Domínio / HTTPS (ou mudar entre IP e domínio)"
  echo "    2) Evolution API"
  echo "    3) Gerar novos segredos JWT (desconecta todos os usuários)"
  echo "    4) Firewall"
  echo "    5) Executar o backend com usuário dedicado (em vez de root)"
  local o; ask o "Opção" "${RECONF_OPTION:-}" _valid_reconf
  local bk; bk="$(backup_file "$BACKEND_ENV")"; ui_info "Cópia de segurança do .env: ${bk}"
  STEP_TOTAL=1
  case "$o" in
    1)
      INSTALL_MODE=""; DOMAIN=""; API_DOMAIN=""
      collect_domain_only
      compute_urls
      ui_step "Aplicando domínio/HTTPS"
      if [[ "$INSTALL_MODE" == "domain" ]]; then
        DNS_OK=1; validate_dns
        # Sem DNS válido nada é alterado: reescrever o Nginx removeria o HTTPS atual.
        [[ "$DNS_OK" == "1" ]] || ui_fail "DNS ainda não aponta para esta VPS. Nada foi alterado." "Corrija os registros A e execute de novo."
        apt-get install -y certbot python3-certbot-nginx >/dev/null
      fi
      write_nginx
      if [[ "$INSTALL_MODE" == "domain" ]]; then
        issue_certificate
        if [[ "$SSL_STATUS" != "ativo" ]]; then
          restore_nginx_backups
          cp -p "$bk" "$BACKEND_ENV"
          ui_fail "Certificado não emitido; configuração anterior do Nginx e do .env restaurada." "Veja a saída do certbot acima, corrija e execute de novo."
        fi
      fi
      env_set "$BACKEND_ENV" BACKEND_URL "$BACKEND_URL_VALUE"
      env_set "$BACKEND_ENV" FRONTEND_URL "$FRONTEND_URL_VALUE"
      [[ -n "$(env_get "$BACKEND_ENV" EVOLUTION_CENTRAL_BASE_URL || true)" ]] && env_set "$BACKEND_ENV" EVOLUTION_WEBHOOK_PUBLIC_BASE_URL "$BACKEND_URL_VALUE"
      [[ "$INSTALL_MODE" == "domain" ]] && env_set "$BACKEND_ENV" META_OAUTH_REDIRECT_URI "https://${API_DOMAIN}/instagram/oauth/callback"
      publish_frontend
      apply_service_ownership "$(current_service_user)"
      systemctl restart "$SERVICE_NAME"; wait_backend
      setup_firewall
      ui_warn "Conexões Evolution já criadas guardam a URL de webhook antiga: reconecte-as pelo painel para atualizar."
      ;;
    2)
      compute_urls
      EVOLUTION_MODE=""
      collect_evolution_only
      ui_step "Aplicando Evolution"; setup_evolution
      ui_warn "Conexões Evolution existentes guardam a URL/key anteriores (tabela WhatsappEvolutionCredentials); recrie-as se trocou de servidor."
      ;;
    3)
      ask_yes_no "Gerar novos JWT_SECRET e JWT_REFRESH_SECRET? Todos os usuários precisarão entrar de novo." n || exit 0
      ui_step "Gerando segredos"
      env_set "$BACKEND_ENV" JWT_SECRET "$(gen_secret 32)"
      env_set "$BACKEND_ENV" JWT_REFRESH_SECRET "$(gen_secret 32)"
      systemctl restart "$SERVICE_NAME"; wait_backend
      ;;
    4) compute_urls; ui_step "Firewall"; setup_firewall ;;
    5) ui_step "Backend com usuário dedicado"; migrate_service_user ;;
  esac
  local ch; ch="$(env_changed_keys "$bk" "$BACKEND_ENV" | tr '\n' ' ')"
  ui_info "Chaves alteradas no .env: ${ch:-nenhuma}"
  state_save INSTALL_MODE DOMAIN API_DOMAIN SERVER_IP EVOLUTION_MODE PROJETO_DIR
  ui_ok "Reconfiguração concluída."
}
_valid_reconf() { [[ "$1" =~ ^[1-5]$ ]]; }

# Migra uma instalação existente de root para o usuário dedicado; volta a root se o backend não subir.
migrate_service_user() {
  local u="${SERVICE_USER:-$SERVICE_USER_DEFAULT}" prev
  prev="$(current_service_user)"
  if [[ "$prev" == "$u" ]]; then ui_ok "O backend já roda como ${u}."; return 0; fi
  ask_yes_no "Mudar o backend de ${prev} para ${u}? O serviço reinicia (alguns segundos fora do ar)." s || exit 0
  ensure_service_user "$u"
  apply_service_ownership "$u"
  # Subshell: um timeout em wait_backend não pode impedir a reversão.
  ( write_systemd_unit "$u" ) || true
  if systemctl is-active --quiet "$SERVICE_NAME" &&
    curl -fsS -o /dev/null --max-time 5 "http://127.0.0.1:${API_PORT}/system-settings/branding-bootstrap.js"; then
    ui_ok "Backend rodando como ${u}."
  else
    ui_warn "O backend não respondeu como ${u}. Voltando para ${prev}."
    write_systemd_unit "$prev"
    ui_fail "Migração revertida." "Veja: journalctl -u ${SERVICE_NAME} -n 100 --no-pager"
  fi
}

collect_domain_only() {
  # Não interativo: RECONF_MODO=domain|ip.
  local m; ask m "1) Domínio com HTTPS  2) Somente IP" "$([[ "${RECONF_MODO:-}" == ip ]] && echo 2 || echo 1)" _valid_mode_choice
  if [[ "$m" == "1" ]]; then
    INSTALL_MODE=domain
    ask BASE_DOMAIN "Domínio principal (ex.: empresa.com.br)" "" _valid_host_input
    BASE_DOMAIN="$(normalize_host "$BASE_DOMAIN")"
    ask DOMAIN "Endereço do painel" "app.${BASE_DOMAIN}" _valid_host_input
    ask API_DOMAIN "Endereço da API" "api.${BASE_DOMAIN}" _valid_host_input
    DOMAIN="$(normalize_host "$DOMAIN")"; API_DOMAIN="$(normalize_host "$API_DOMAIN")"
    ask SSL_EMAIL "E-mail para o certificado HTTPS" "" is_valid_email
  else
    INSTALL_MODE=ip
    local ip=""
    ask ip "IP público desta VPS" "${SERVER_IP:-$(detect_public_ip)}" is_valid_ipv4
    SERVER_IP="$ip"
  fi
}

collect_evolution_only() {
  local e; ask e "1) Instalar nesta VPS  2) Servidor externo  3) Cancelar" "1" _valid_evo_choice
  case "$e" in
    1) EVOLUTION_MODE=local ;;
    2) EVOLUTION_MODE=externa
       ask EVOLUTION_EXTERNAL_URL "URL do servidor Evolution" "" _valid_http_url
       EVOLUTION_EXTERNAL_URL="${EVOLUTION_EXTERNAL_URL%/}"
       ask_secret EVOLUTION_EXTERNAL_KEY "API key global da Evolution" _nonempty ;;
    *) exit 0 ;;
  esac
}

flow_superadmin() {
  [[ -f "${BACKEND_DIR}/dist/scripts/bootstrapSuperAdmin.js" ]] || ui_fail "Backend não compilado." "Execute: sudo bash install.sh --atualizar"
  if [[ "$ACTION" == "redefinir-senha" ]]; then
    ask SUPERADMIN_EMAIL "E-mail do Super Admin" "" is_valid_email
    ask_secret SUPERADMIN_PASSWORD "Nova senha" is_strong_password
    bootstrap_superadmin --reset-password
  else
    local n; n="$(superadmin_count)"
    if [[ "${n:-0}" -ge 1 ]]; then
      ui_ok "Já existe ${n} Super Admin. Novos Super Admins são criados pelo painel (Plataforma → Super Admins)."
      ui_info "Esqueceu a senha? sudo bash install.sh --redefinir-senha"
      return 0
    fi
    ask SUPERADMIN_NAME "Nome" "" _valid_name
    ask SUPERADMIN_EMAIL "E-mail de login" "" is_valid_email
    ask_secret SUPERADMIN_PASSWORD "Senha (8+ caracteres, maiúscula, minúscula e número)" is_strong_password
    bootstrap_superadmin
  fi
  unset SUPERADMIN_PASSWORD
}

print_summary() {
  echo ""
  echo "============================================================"
  echo " StreamHub Chat — instalação concluída"
  echo "============================================================"
  echo "  Painel:        ${FRONTEND_URL_VALUE}"
  echo "  API:           ${BACKEND_URL_VALUE}"
  [[ "$INSTALL_MODE" == "domain" ]] && echo "  HTTPS:         ${SSL_STATUS:-n/a}"
  echo "  Evolution:     ${EVOLUTION_MODE}${WEBHOOK_STATUS:+ (webhook: ${WEBHOOK_STATUS})}"
  echo "  Login:         ${SUPERADMIN_EMAIL:-(Super Admin existente)} — senha definida por você"
  echo ""
  echo "  Segredos gerados ficam somente em (permissão 600):"
  echo "    ${BACKEND_ENV}"
  [[ "$EVOLUTION_MODE" == "local" ]] && echo "    ${EVOLUTION_DIR}/.env"
  echo "  Faça uma cópia segura desses arquivos fora da VPS."
  echo ""
  echo "  Próximos passos: docs/GUIA_INSTALACAO_INICIANTES.md, seção 'Primeiro acesso'."
  echo "  Diagnóstico:     sudo bash install.sh --diagnostico"
  echo "  Log:             ${LOG_FILE}"
  echo "============================================================"
}

choose_action() {
  local signals; signals="$(existing_install_signals)"
  echo ""
  echo "${C_BOLD}StreamHub Chat — instalador ${INSTALLER_VERSION}${C_RESET}"
  if [[ -z "$signals" ]]; then
    echo "  Nenhuma instalação encontrada nesta VPS."
    echo "    1) Instalação nova"
    echo "    2) Só verificar pré-requisitos"
    local o; ask o "Opção" "1" _valid_mode_choice
    [[ "$o" == "1" ]] && ACTION=nova || ACTION=verificar
  elif [[ "$(state_get INSTALL_STATUS)" == "em_andamento" && "$(state_get PROJETO_DIR)" == "$PROJETO_DIR" ]]; then
    # Instalação nova interrompida: o mesmo comando retoma (flow_nova pergunta antes).
    ACTION=nova
  else
    echo "  Instalação existente detectada:"
    echo "$signals" | sed 's/^/    - /'
    echo "    1) Atualizar (após git pull)"
    echo "    2) Reconfigurar (domínio, Evolution, segredos, firewall)"
    echo "    3) Diagnóstico"
    echo "    4) Criar primeiro Super Admin / 5) Redefinir senha de Super Admin"
    local o; ask o "Opção" "3" _valid_menu5
    case "$o" in 1) ACTION=atualizar ;; 2) ACTION=reconfigurar ;; 3) ACTION=diagnostico ;; 4) ACTION=superadmin ;; 5) ACTION=redefinir-senha ;; esac
  fi
}
_valid_menu5() { [[ "$1" =~ ^[1-5]$ ]]; }

###############################################################################
main() {
  [[ $EUID -eq 0 ]] || ui_fail "Execute como root." "sudo bash install.sh"
  [[ -z "$ACTION" ]] && choose_action
  case "$ACTION" in
    verificar) local rc=0; check_prereqs "$([[ -z "$(existing_install_signals)" ]] && echo nova || echo existente)" || rc=$?; exit "$rc" ;;
    diagnostico) local rc=0; run_diagnostics || rc=$?; exit "$rc" ;;
  esac
  start_logging
  acquire_lock
  # Repositório clonado por outro usuário: evita "dubious ownership" do git (root).
  git -C "$PROJETO_DIR" status >/dev/null 2>&1 || git config --global --add safe.directory "$PROJETO_DIR"
  case "$ACTION" in
    nova) flow_nova ;;
    atualizar) flow_atualizar ;;
    reconfigurar) flow_reconfigurar ;;
    superadmin | redefinir-senha) flow_superadmin ;;
  esac
}

# Permite carregar as funções em testes sem executar (INSTALLER_SOURCE_ONLY=1).
[[ "${INSTALLER_SOURCE_ONLY:-0}" == "1" ]] || main "$@"
