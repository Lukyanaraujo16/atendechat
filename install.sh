#!/usr/bin/env bash
###############################################################################
# CoreFlow — install.sh (Ubuntu Server 20.04+)
#
# Fluxo: git pull → ./install.sh → sistema funcional (sem editar .env na mão)
#
# O que este script garante:
#   • Backend Node na porta API_PORT (8080), acessível em 0.0.0.0 (rede)
#   • Frontend build com REACT_APP_BACKEND_URL = http(s)://host:8080 (API real)
#   • FRONTEND_URL / CORS = origem onde o utilizador abre o browser (ex. :80)
#   • Nginx na :80 serve o SPA (estático). Modo IP: a API é directa na API_PORT.
#     Com DOMAIN+API_DOMAIN: Nginx faz proxy da API no subdomínio (upload grande suportado).
#   • Pastas runtime: backend/backups, backend/backups/incoming, backend/public
#     (permissões alinhadas ao User= do systemd quando LINUX_USER≠root)
#   • Backup/restauro (Super Admin): requer no servidor pg_dump e psql (PostgreSQL;
#     este script instala postgresql + cliente). Se mudar DB_DIALECT para mysql,
#     instale mysqldump/mysql à parte.
#   • PostgreSQL: antes de sequelize db:migrate, scripts/ensure-postgres-app-ownership.sh
#     alinha o dono da base/schema/tabelas ao DB_USER (evita "must be owner of table").
#   • Firewall: portas 22, 80, API_PORT abertas (ufw)
#
# Variáveis opcionais (antes de executar):
#   SERVER_IP=1.2.3.4     — IP público (senão pergunta ou detecta)
#   PROJETO_DIR=/caminho  — raiz do repo (senão = pasta onde está este install.sh)
#   MINIMAL_UPDATE=1      — só dependências + build + restart (sem apt upgrade)
#   DOMAIN + API_DOMAIN   — hostnames completos (legado); ex.: app.exemplo.com + api.exemplo.com
#   INSTALL_MODE=ip|domain — força modo sem/com domínio (não-interativo)
#   BASE_DOMAIN=exemplo.com — com modo domínio interativo gera app. e api.
#   SSL_EMAIL=...           — e-mail Let's Encrypt (modo domínio)
#   SKIP_DNS_CHECK=1      — não validar DNS antes de continuar (CI / legado)
#   DB_NAME / DB_USER / DB_PASS — exportadas no shell têm prioridade sobre backend/.env
#   DB_IMPORT_USER / DB_IMPORT_PASS — opcional; sem export, o script lê backend/.env ou gera
#     palavra-passe aleatória para postgres e grava em .env (restauro de backup via psql).
#   Atualização na VPS: com backend/.env existente, DB_* e DB_IMPORT_* são lidos desse ficheiro.
#   Instalação nova (sem .env): defaults atendechat + CoreFlowDB2024!
#
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

# Saída por etapas (instalação completa; MINIMAL_UPDATE não usa contador longo)
INST_TOTAL=8
_inst_step() {
  echo ""
  echo "[$1/${INST_TOTAL}] $2"
}
_inst_item() { echo "  • $*"; }
_inst_ok() { echo "  [OK] $*"; }
# Uso: _inst_warn "linha única"  ou  _inst_warn "linha1" "linha2" (várias linhas [AVISO])
_inst_warn() {
  local a
  for a in "$@"; do
    echo "  [AVISO] ${a}"
  done
}
# etapa: número 1–8 | "" = pré-instalação | "-" = MINIMAL_UPDATE
# _inst_error_block ETAPA "Ação" "Detalhe" "Próximo passo"
_inst_error_block() {
  local etapa="${1:-}"
  local acao="${2:-}"
  local detalhe="${3:-}"
  local proximo="${4:-}"
  echo ""
  case "${etapa}" in
    "")
      echo "  [ERRO] Etapa: Pré-instalação"
      ;;
    "-")
      echo "  [ERRO] Etapa: MINIMAL_UPDATE"
      ;;
    *)
      echo "  [ERRO] Etapa: [${etapa}/${INST_TOTAL}]"
      ;;
  esac
  echo "  [ERRO] Ação: ${acao}"
  echo "  [ERRO] Detalhe: ${detalhe}"
  echo "  [ERRO] Próximo passo: ${proximo}"
}

# Nomes alternativos (documentação / consistência com outras ferramentas)
print_step() { _inst_step "$@"; }
print_ok() { _inst_ok "$@"; }
print_warn() { _inst_warn "$@"; }
print_error_block() { _inst_error_block "$@"; }

###############################################################################
# Raiz do projeto (pasta que contém backend/ e frontend/)
###############################################################################
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -z "${PROJETO_DIR:-}" ]]; then
  PROJETO_DIR="$SCRIPT_DIR"
fi

API_PORT="${API_PORT:-8080}"
LINUX_USER="${LINUX_USER:-root}"

###############################################################################
# Credenciais PostgreSQL: instalação nova vs. atualização (git pull na VPS)
# - Se backend/.env já existir, reutiliza DB_NAME / DB_USER / DB_PASS de lá
#   (não sobrepõe o que o utilizador definiu no shell: DB_* exportado ganha).
# - Só os defaults (atendechat / CoreFlowDB2024!) aplicam quando não há .env
#   ou a chave está em falta no ficheiro.
###############################################################################
read_env_value_from_file() {
  local file="$1" key="$2"
  local line raw
  line=$(grep -m1 "^${key}=" "$file" 2>/dev/null || true)
  [[ -n "$line" ]] || return 1
  raw="${line#*=}"
  raw="${raw%$'\r'}"
  if [[ "$raw" =~ ^\".*\"$ ]]; then
    raw="${raw#\"}"
    raw="${raw%\"}"
  elif [[ "$raw" =~ ^\'.*\'$ ]]; then
    raw="${raw#\'}"
    raw="${raw%\'}"
  fi
  printf '%s' "$raw"
}

merge_postgres_from_existing_env() {
  local env_file="${PROJETO_DIR}/backend/.env"
  [[ -f "$env_file" ]] || return 0
  local v
  if ! [[ -v DB_NAME ]]; then
    v=$(read_env_value_from_file "$env_file" DB_NAME || true)
    if [[ -n "$v" ]]; then
      DB_NAME="$v"
      echo ">> Preservando DB_NAME do .env existente (${DB_NAME})"
    fi
  fi
  if ! [[ -v DB_USER ]]; then
    v=$(read_env_value_from_file "$env_file" DB_USER || true)
    if [[ -n "$v" ]]; then
      DB_USER="$v"
      echo ">> Preservando DB_USER do .env existente (${DB_USER})"
    fi
  fi
  if ! [[ -v DB_PASS ]]; then
    v=$(read_env_value_from_file "$env_file" DB_PASS || true)
    if [[ -n "$v" ]]; then
      DB_PASS="$v"
      echo ">> Preservando DB_PASS do .env existente (definido)"
    fi
  fi
}

# Restauro de backups (psql como superuser). Lido do .env existente ou gerado pelo install.sh.
merge_db_import_from_existing_env() {
  local env_file="${PROJETO_DIR}/backend/.env"
  [[ -f "$env_file" ]] || return 0
  local v
  if ! [[ -v DB_IMPORT_USER ]]; then
    v=$(read_env_value_from_file "$env_file" DB_IMPORT_USER || true)
    if [[ -n "$v" ]]; then
      DB_IMPORT_USER="$v"
    fi
  fi
  if ! [[ -v DB_IMPORT_PASS ]]; then
    v=$(read_env_value_from_file "$env_file" DB_IMPORT_PASS || true)
    if [[ -n "$v" ]]; then
      DB_IMPORT_PASS="$v"
    fi
  fi
  return 0
}

# Define a palavra-passe do utilizador de import (postgres) no cluster, para o Node poder correr psql no restauro.
sync_postgres_import_password() {
  [[ -z "${DB_IMPORT_PASS:-}" ]] && return 0
  command -v psql >/dev/null 2>&1 || return 0
  local u esc
  u="${DB_IMPORT_USER:-postgres}"
  esc=$(printf '%s' "${DB_IMPORT_PASS}" | sed "s/'/''/g")
  if sudo -u postgres psql -c "ALTER USER ${u} WITH PASSWORD '${esc}';" 2>/dev/null; then
    echo ">> DB_IMPORT_* : utilizador \"${u}\" pronto para importar restauros de backup (palavra-passe gravada no .env)."
  else
    echo ">> [AVISO] Não foi possível executar ALTER USER ${u} (restauro de backup pode pedir DB_IMPORT_* manual)."
  fi
}

REDIS_PASS="${REDIS_PASS:-}"
DOMAIN="${DOMAIN:-}"
API_DOMAIN="${API_DOMAIN:-}"
BASE_DOMAIN="${BASE_DOMAIN:-}"
SSL_EMAIL="${SSL_EMAIL:-}"
SKIP_DNS_CHECK="${SKIP_DNS_CHECK:-0}"
INSTALL_MODE="${INSTALL_MODE:-}"
# Preenchido no modo domínio interactivo (resumo final)
DNS_SUMMARY_NOTE=""

MINIMAL_UPDATE="${MINIMAL_UPDATE:-0}"

echo ""
echo "=============================================="
echo "  CoreFlow — instalação / atualização"
echo "=============================================="
echo ""
echo ">>> Diretório do projeto: ${PROJETO_DIR}"

if [[ ! -d "${PROJETO_DIR}/backend" || ! -d "${PROJETO_DIR}/frontend" ]]; then
  _inst_error_block "" "Validar estrutura do repositório" "Esperadas as pastas ${PROJETO_DIR}/backend e ${PROJETO_DIR}/frontend." "Defina PROJETO_DIR para a raiz do clone Git ou execute install.sh a partir da raiz do projecto."
  exit 1
fi

if [[ -f "${PROJETO_DIR}/scripts/ensure-postgres-app-ownership.sh" ]]; then
  # shellcheck source=/dev/null
  source "${PROJETO_DIR}/scripts/ensure-postgres-app-ownership.sh"
else
  ensure_postgres_app_ownership() { return 0; }
fi

merge_postgres_from_existing_env
merge_db_import_from_existing_env
DB_NAME="${DB_NAME:-atendechat}"
DB_USER="${DB_USER:-atendechat}"
DB_PASS="${DB_PASS:-CoreFlowDB2024!}"
DB_IMPORT_USER="${DB_IMPORT_USER:-postgres}"
if [[ -z "${DB_IMPORT_PASS:-}" ]]; then
  # Não depender só de openssl (em falta ou pipeline com pipefail) — evita saída silenciosa com set -e
  DB_IMPORT_PASS=""
  if command -v openssl >/dev/null 2>&1; then
    DB_IMPORT_PASS=$(openssl rand -base64 24 2>/dev/null | tr -d '\n' | tr "'" "_") || DB_IMPORT_PASS=""
  fi
  if [[ -z "${DB_IMPORT_PASS}" ]]; then
    DB_IMPORT_PASS=$(head -c 24 /dev/urandom 2>/dev/null | base64 2>/dev/null | tr -d '\n' | tr "'" "_") || true
  fi
  if [[ -z "${DB_IMPORT_PASS}" ]]; then
    echo "  [ERRO] Não foi possível gerar DB_IMPORT_PASS (openssl/base64). Instale openssl ou defina DB_IMPORT_PASS no ambiente." >&2
    exit 1
  fi
fi

###############################################################################
# IP público + modo instalação (só IP vs domínio + SSL)
###############################################################################
detect_public_ip() {
  local ip=""
  ip=$(curl -fsS --max-time 4 ifconfig.me 2>/dev/null || true)
  if [[ -z "$ip" ]]; then
    ip=$(curl -fsS --max-time 4 icanhazip.com 2>/dev/null || true)
  fi
  if [[ -z "$ip" ]]; then
    ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  fi
  if [[ -z "$ip" ]]; then
    ip=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
  fi
  printf '%s' "$ip"
}

dns_a_record_for() {
  local host="$1"
  local r=""
  if command -v dig >/dev/null 2>&1; then
    r=$(dig +short "$host" @1.1.1.1 2>/dev/null | grep -E '^[0-9.]+$' | head -n1)
    [[ -z "$r" ]] && r=$(dig +short "$host" @8.8.8.8 2>/dev/null | grep -E '^[0-9.]+$' | head -n1)
  fi
  if [[ -z "$r" ]]; then
    r=$(getent ahostsv4 "$host" 2>/dev/null | awk '{print $1; exit}')
  fi
  printf '%s' "$r"
}

validate_domain_dns() {
  local expected_ip="$1"
  local app_host="$2"
  local api_host="$3"
  local a_app a_api
  a_app=$(dns_a_record_for "$app_host")
  a_api=$(dns_a_record_for "$api_host")

  echo ""
  echo "  Verificação DNS (registo A IPv4 público):"
  echo "  ─────────────────────────────────────────────────────────────"
  printf '  • %s\n' "${app_host}"
  echo "      esperado (IP deste servidor): ${expected_ip}"
  echo "      encontrado (resolução atual):  ${a_app:-não encontrado}"
  printf '  • %s\n' "${api_host}"
  echo "      esperado (IP deste servidor): ${expected_ip}"
  echo "      encontrado (resolução atual):  ${a_api:-não encontrado}"
  echo "  ─────────────────────────────────────────────────────────────"

  if [[ -z "$a_app" || -z "$a_api" ]]; then
    echo ""
    _inst_warn "Não foi possível obter endereço IPv4 para app ou api (ou ambos)." "Causas frequentes: propagação DNS (TTL), registo A em falta ou nome incorrecto no painel do domínio."
    return 1
  fi
  if [[ "$a_app" != "$expected_ip" ]] || [[ "$a_api" != "$expected_ip" ]]; then
    echo ""
    _inst_warn "O IP devolvido pelo DNS não coincide com o IP público deste servidor (${expected_ip})." "Confirme no painel que os registos A de app e api apontam para este IP; após alterações, aguarde a propagação."
    return 1
  fi
  return 0
}

apply_url_vars_from_mode() {
  if [[ "${INSTALL_MODE}" == "domain" ]] && [[ -n "${DOMAIN:-}" && -n "${API_DOMAIN:-}" ]]; then
    FRONTEND_URL_VALUE="https://${DOMAIN}"
    API_PUBLIC_URL="https://${API_DOMAIN}"
    BACKEND_URL_VALUE="${API_PUBLIC_URL}"
  else
    INSTALL_MODE="ip"
    FRONTEND_URL_VALUE="http://${SERVER_IP}"
    API_PUBLIC_URL="http://${SERVER_IP}:${API_PORT}"
    BACKEND_URL_VALUE="${API_PUBLIC_URL}"
  fi
}

echo ">> A configurar IP / modo de instalação (pode demorar alguns segundos se detetar IP pela rede)..."
echo "   (Se ficar parado aqui: modo interactivo — responda ao prompt de IP abaixo; ou use SERVER_IP=1.2.3.4 ./install.sh)"

# --- MINIMAL_UPDATE: sem perguntas; usar env ---
if [[ "${MINIMAL_UPDATE}" == "1" ]]; then
  if [[ -z "${SERVER_IP:-}" ]]; then
    SERVER_IP=$(detect_public_ip)
  else
    SERVER_IP=$(echo "$SERVER_IP" | xargs)
  fi
  if [[ -z "${SERVER_IP:-}" ]]; then
    _inst_error_block "-" "Determinar IP do servidor (MINIMAL_UPDATE)" "SERVER_IP vazio e a deteção automática de IP falhou." "Exporte SERVER_IP com o IP público da VPS ou corrija conectividade (curl/ifconfig) e volte a executar."
    exit 1
  fi
  if [[ -n "${DOMAIN:-}" && -n "${API_DOMAIN:-}" ]]; then
    INSTALL_MODE="domain"
  else
    INSTALL_MODE="ip"
  fi
  apply_url_vars_from_mode
  echo ""
  echo ">>> [MINIMAL_UPDATE] Modo: ${INSTALL_MODE}"
  echo ">>> Frontend: ${FRONTEND_URL_VALUE} | API: ${API_PUBLIC_URL}"
  echo ""

# --- Legado: DOMAIN e API_DOMAIN já exportados (hostnames completos) ---
elif [[ -n "${DOMAIN:-}" && -n "${API_DOMAIN:-}" ]] && [[ -z "${INSTALL_MODE:-}" || "${INSTALL_MODE}" == "domain" ]]; then
  INSTALL_MODE="domain"
  if [[ -z "${SERVER_IP:-}" ]]; then
    SERVER_IP=$(detect_public_ip)
  else
    SERVER_IP=$(echo "$SERVER_IP" | xargs)
  fi
  if [[ -z "${SERVER_IP:-}" ]]; then
    _inst_error_block "" "Modo domínio: IP do servidor" "SERVER_IP não definido e a deteção automática não devolveu IP." "Defina SERVER_IP no ambiente ou corrija a deteção para validação DNS/firewall."
    exit 1
  fi
  echo ">> Modo domínio (DOMAIN + API_DOMAIN no ambiente)."
  apply_url_vars_from_mode
  echo ""
  echo ">>> Frontend: ${FRONTEND_URL_VALUE} | API: ${API_PUBLIC_URL}"
  echo ""

# --- INSTALL_MODE explícito (não-interativo) ---
elif [[ -n "${INSTALL_MODE:-}" ]]; then
  if [[ -z "${SERVER_IP:-}" ]]; then
    SERVER_IP=$(detect_public_ip)
  else
    SERVER_IP=$(echo "$SERVER_IP" | xargs)
  fi
  if [[ "${INSTALL_MODE}" == "domain" ]]; then
    if [[ -z "${DOMAIN:-}" || -z "${API_DOMAIN:-}" ]]; then
      if [[ -z "${BASE_DOMAIN:-}" ]]; then
        _inst_error_block "" "INSTALL_MODE=domain (não-interactivo)" "Faltam DOMAIN e API_DOMAIN e BASE_DOMAIN não foi definido." "Exporte DOMAIN e API_DOMAIN (hostnames completos) ou BASE_DOMAIN (ex.: empresa.com) antes de executar."
        exit 1
      fi
      DOMAIN="app.${BASE_DOMAIN}"
      API_DOMAIN="api.${BASE_DOMAIN}"
    fi
  fi
  apply_url_vars_from_mode
  echo ""
  echo ">>> Modo (${INSTALL_MODE}): Frontend ${FRONTEND_URL_VALUE} | API ${API_PUBLIC_URL}"
  echo ""

# --- Interactivo ---
elif [[ -t 0 ]]; then
  echo "-------------------------------------------------------------------"
  echo "  IP público do servidor (usado em firewall, DNS e modo sem domínio)"
  echo "-------------------------------------------------------------------"
  read -r -p "IP público [Enter = detetar automaticamente]: " SERVER_IP
  SERVER_IP=$(echo "${SERVER_IP:-}" | xargs)
  if [[ -z "${SERVER_IP:-}" ]]; then
    echo "==> A detetar IP público..."
    SERVER_IP=$(detect_public_ip)
    if [[ -z "${SERVER_IP:-}" ]]; then
      _inst_error_block "" "Deteção do IP público" "curl/hostname/route não devolveram um IP utilizável." "Execute manualmente: SERVER_IP=x.x.x.x ./install.sh (substitua pelo IP público da VPS)."
      exit 1
    fi
    echo "    IP detetado: ${SERVER_IP}"
  else
    echo "    IP informado: ${SERVER_IP}"
  fi

  echo ""
  read -r -p "Vai configurar domínio com SSL agora? (s/N): " _want_domain
  _want_domain=$(echo "${_want_domain:-n}" | tr '[:upper:]' '[:lower:]')

  if [[ "${_want_domain}" == "s" || "${_want_domain}" == "sim" || "${_want_domain}" == "y" || "${_want_domain}" == "yes" ]]; then
    INSTALL_MODE="domain"
    echo ""
    read -r -p "Domínio principal (ex.: empresa.com, sem http): " BASE_DOMAIN
    BASE_DOMAIN=$(echo "$BASE_DOMAIN" | xargs | sed 's|^https\?://||' | sed 's|/$||')
    if [[ -z "${BASE_DOMAIN}" ]]; then
      _inst_error_block "" "Domínio principal (modo interactivo)" "O domínio informado ficou vazio após normalização." "Indique um domínio válido (ex.: empresa.com, sem http://) e volte a correr o instalador."
      exit 1
    fi
    DOMAIN="app.${BASE_DOMAIN}"
    API_DOMAIN="api.${BASE_DOMAIN}"
    echo ""
    read -r -p "E-mail para registo Let's Encrypt (SSL): " SSL_EMAIL
    SSL_EMAIL=$(echo "${SSL_EMAIL:-}" | xargs)
    if [[ -z "${SSL_EMAIL}" ]]; then
      _inst_error_block "" "E-mail Let's Encrypt (modo interactivo)" "SSL em modo domínio requer um e-mail para o registo ACME." "Indique um e-mail válido ou reinicie o instalador e escolha modo sem domínio (IP)."
      exit 1
    fi

    echo ""
    echo "================================================================"
    echo "  DNS: crie estes registos (tipo A) a apontar para: ${SERVER_IP}"
    echo "================================================================"
    echo "    ${DOMAIN}   ->  ${SERVER_IP}"
    echo "    ${API_DOMAIN}  ->  ${SERVER_IP}"
    echo ""
    read -r -p "Registos criados? Prima Enter para validar o DNS... " _

    while true; do
      if [[ "${SKIP_DNS_CHECK}" == "1" ]]; then
        _inst_warn "SKIP_DNS_CHECK=1 — validação DNS omitida (variável de ambiente)." "O Let's Encrypt pode falhar se os registos A ainda não apontarem para este servidor."
        DNS_SUMMARY_NOTE="validacao_DNS=omitida (SKIP_DNS_CHECK=1)"
        break
      fi
      echo ""
      echo "==> Validação DNS"
      if validate_domain_dns "${SERVER_IP}" "${DOMAIN}" "${API_DOMAIN}"; then
        echo ""
        _inst_ok "Validação DNS: ambos os nomes resolvem para o IP deste servidor."
        DNS_SUMMARY_NOTE="validacao_DNS=concluída"
        break
      fi
      echo ""
      echo "----------------------------------------------------------------------"
      echo "  Escolha uma opção:"
      echo "    T — Tentar novamente (depois de corrigir DNS ou aguardar propagação)"
      echo "    I — Ignorar validação e continuar (Certbot pode falhar se DNS estiver incorreto)"
      echo "    S — Sair do instalador"
      echo "----------------------------------------------------------------------"
      read -r -p "Opção [T/i/s]: " _dns_choice
      _dns_choice=$(echo "${_dns_choice:-T}" | tr '[:upper:]' '[:lower:]')
      case "${_dns_choice}" in
        t | "")
          echo ">> A repetir validação..."
          ;;
        i | ignorar)
          _inst_warn "A continuar sem validação DNS (opção I — escolha do utilizador)." "O SSL (Let's Encrypt) pode falhar até os registos A estarem correctos e propagados."
          DNS_SUMMARY_NOTE="validacao_DNS=ignorada pelo utilizador (opção I)"
          break
          ;;
        s | sair)
          echo ">> Instalação cancelada pelo utilizador."
          exit 1
          ;;
        *)
          echo ">> Opção não reconhecida. Indique T, I ou S."
          ;;
      esac
    done

    apply_url_vars_from_mode
  else
    INSTALL_MODE="ip"
    apply_url_vars_from_mode
  fi

  echo ""
  echo ">>> Modo: ${INSTALL_MODE}"
  echo ">>> Frontend (browser):  ${FRONTEND_URL_VALUE}"
  echo ">>> API Node (axios):     ${API_PUBLIC_URL}"
  echo ">>> Porta interna Node:   ${API_PORT}"
  echo ""

# --- Não-interactivo (cron, pipe): modo IP por defeito ---
else
  if [[ -z "${SERVER_IP:-}" ]]; then
    SERVER_IP=$(detect_public_ip)
  else
    SERVER_IP=$(echo "$SERVER_IP" | xargs)
  fi
  if [[ -z "${SERVER_IP:-}" ]]; then
    _inst_error_block "" "Modo não-interactivo (stdin não disponível)" "SERVER_IP não está definido — obrigatório sem prompts." "Exporte SERVER_IP=x.x.x.x antes de executar ./install.sh."
    exit 1
  fi
  INSTALL_MODE="ip"
  apply_url_vars_from_mode
  echo ""
  echo ">>> [não-interactivo] Modo IP | Frontend ${FRONTEND_URL_VALUE} | API ${API_PUBLIC_URL}"
  echo ""
fi

if [[ "${MINIMAL_UPDATE}" != "1" ]]; then
  _inst_step 1 "Coletando informações da instalação"
  _inst_item "Modo: ${INSTALL_MODE:-ip}"
  _inst_item "APP_URL: ${FRONTEND_URL_VALUE}"
  _inst_item "API_URL: ${API_PUBLIC_URL}"
  _inst_ok "Parâmetros da instalação definidos"
  _inst_step 2 "Validando DNS"
  if [[ "${INSTALL_MODE:-}" == "ip" ]]; then
    _inst_item "Modo IP — sem registos DNS app/api a validar"
    _inst_ok "Etapa não aplicável"
  elif [[ -n "${DNS_SUMMARY_NOTE:-}" ]]; then
    _inst_item "${DNS_SUMMARY_NOTE}"
    _inst_ok "Estado DNS registado"
  else
    _inst_item "Domínio via ambiente — validação interactiva de DNS não executada nesta execução"
    _inst_ok "Continuação"
  fi
fi

if [[ "${MINIMAL_UPDATE}" != "1" ]] && [[ -t 0 ]]; then
  echo ""
  echo "A continuar em 3 s... (Ctrl+C para cancelar)"
  sleep 3
fi
echo ""

###############################################################################
# Função: escrever .env do backend (idempotente)
###############################################################################
write_backend_env() {
  local env_file="${PROJETO_DIR}/backend/.env"
  if [[ ! -f "$env_file" ]]; then
    cp "${PROJETO_DIR}/backend/.env.example" "$env_file"
  fi
  # Remover chaves que vamos recalcular
  local keys=(
    NODE_ENV BACKEND_URL FRONTEND_URL PROXY_PORT PORT
    DB_DIALECT DB_HOST DB_PORT DB_USER DB_PASS DB_NAME
    DB_IMPORT_USER DB_IMPORT_PASS
    REDIS_URI REDIS_OPT_LIMITER_MAX REDIS_OPT_LIMITER_DURATION
  )
  for key in "${keys[@]}"; do
    sed -i "/^${key}=/d" "$env_file" 2>/dev/null || true
  done

  cat >> "$env_file" << EOF

# --- gerado/atualizado por install.sh ---
NODE_ENV=production
BACKEND_URL=${BACKEND_URL_VALUE}
FRONTEND_URL=${FRONTEND_URL_VALUE}
# PROXY_PORT vazio: URLs em models usam só BACKEND_URL (ver QuickMessage.ts)
PROXY_PORT=
PORT=${API_PORT}

DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}
DB_NAME=${DB_NAME}
# Restauro de backup: import psql (extensões uuid-ossp, etc.) — gerado/atualizado por install.sh
DB_IMPORT_USER=${DB_IMPORT_USER}
DB_IMPORT_PASS=${DB_IMPORT_PASS}

REDIS_URI=${REDIS_URI_EFFECTIVE}
REDIS_OPT_LIMITER_MAX=1
REDIS_OPT_LIMITER_DURATION=3000
EOF
}

###############################################################################
# Pastas usadas pelo backup/restore e ficheiros públicos (idempotente)
###############################################################################
ensure_runtime_dirs() {
  mkdir -p "${PROJETO_DIR}/backend/backups/incoming" "${PROJETO_DIR}/backend/public"
  if [[ "${LINUX_USER}" != "root" ]]; then
    chown -R "${LINUX_USER}:${LINUX_USER}" "${PROJETO_DIR}/backend/backups" "${PROJETO_DIR}/backend/public" 2>/dev/null || true
  fi
}

###############################################################################
# Função: build frontend com env correto (obrigatório CRA: variáveis na altura do build)
###############################################################################
build_frontend() {
  cd "${PROJETO_DIR}/frontend"
  export REACT_APP_BACKEND_URL="${API_PUBLIC_URL}"
  export REACT_APP_BACKEND_PORT="${API_PORT}"
  export REACT_APP_HOURS_CLOSE_TICKETS_AUTO="${REACT_APP_HOURS_CLOSE_TICKETS_AUTO:-24}"
  export GENERATE_SOURCEMAP="${GENERATE_SOURCEMAP:-false}"

  touch .env
  sed -i '/^REACT_APP_BACKEND_URL=/d' .env 2>/dev/null || true
  sed -i '/^REACT_APP_BACKEND_PORT=/d' .env 2>/dev/null || true
  sed -i '/^REACT_APP_HOURS_CLOSE_TICKETS_AUTO=/d' .env 2>/dev/null || true
  {
    echo "REACT_APP_BACKEND_URL=${API_PUBLIC_URL}"
    echo "REACT_APP_BACKEND_PORT=${API_PORT}"
    echo "REACT_APP_HOURS_CLOSE_TICKETS_AUTO=${REACT_APP_HOURS_CLOSE_TICKETS_AUTO:-24}"
  } >> .env

  npm install
  npm run build
}

###############################################################################
# MINIMAL_UPDATE: só rebuild + serviços
###############################################################################
if [[ "${MINIMAL_UPDATE}" == "1" ]]; then
  echo ""
  echo "──────── Atualização mínima (MINIMAL_UPDATE=1) ────────"
  _inst_item "Sem apt / PostgreSQL / Redis / instalação base do Nginx"
  if [[ -n "$REDIS_PASS" ]]; then
    REDIS_URI_EFFECTIVE="redis://:${REDIS_PASS}@127.0.0.1:6379"
  else
    REDIS_URI_EFFECTIVE="redis://127.0.0.1:6379"
  fi
  _inst_item "Sincronizar utilizador PostgreSQL para restauro de backups (DB_IMPORT_*)"
  sync_postgres_import_password
  _inst_item "Atualizando .env e pastas runtime"
  write_backend_env
  ensure_runtime_dirs
  cd "${PROJETO_DIR}/backend"
  _inst_item "Backend: npm install e build"
  npm install --production=false || { _inst_error_block "-" "npm install no backend (MINIMAL_UPDATE)" "O comando npm terminou com código de erro (ver saída acima)." "Verifique rede, espaço em disco e permissões em ${PROJETO_DIR}/backend; corrija e execute MINIMAL_UPDATE=1 ./install.sh de novo."; exit 1; }
  npm run build || { _inst_error_block "-" "Build do backend — npm run build (MINIMAL_UPDATE)" "Compilação TypeScript/webpack falhou." "Corrija os erros npm/TypeScript indicados acima e volte a executar MINIMAL_UPDATE=1 ./install.sh."; exit 1; }
  _inst_item "PostgreSQL: ownership da base/schema (utilizador da app = dono das tabelas)"
  ensure_postgres_app_ownership || { _inst_error_block "-" "PostgreSQL — ownership (MINIMAL_UPDATE)" "Não foi possível alinhar o dono da base/tabelas ao DB_USER (ALTER DATABASE / REASSIGN OWNED)." "Execute como root com PostgreSQL local; confira sudo -u postgres psql e DB_* em backend/.env."; exit 1; }
  _inst_item "Migrations (Sequelize)"
  npx sequelize db:migrate || { _inst_error_block "-" "Migrations Sequelize (MINIMAL_UPDATE)" "db:migrate retornou erro (PostgreSQL ou schema)." "Confirme que o PostgreSQL está activo e que DB_* em backend/.env estão correctos; volte a executar."; exit 1; }
  _inst_item "Frontend: build"
  build_frontend || { _inst_error_block "-" "Build do frontend (MINIMAL_UPDATE)" "npm run build no frontend falhou." "Verifique o directório frontend, variáveis REACT_APP_* e a saída npm acima; corrija e reexecute MINIMAL_UPDATE=1 ./install.sh."; exit 1; }
  _inst_item "Reiniciar backend e recarregar Nginx"
  systemctl restart atendechat-backend 2>/dev/null || true
  if nginx -t && systemctl reload nginx 2>/dev/null; then
    _inst_ok "Serviços atualizados"
  else
    _inst_warn "Nginx não foi recarregado após MINIMAL_UPDATE." "Analise a saída de nginx -t acima e execute: systemctl status nginx --no-pager"
  fi
  echo ""
  _inst_ok "MINIMAL_UPDATE concluído"
  exit 0
fi

###############################################################################
# Etapa 3 — sistema, dados, firewall e backend (app)
###############################################################################
_inst_step 3 "Preparando ambiente do backend"
_inst_item "Atualização de pacotes (apt)"
apt-get update -y
apt-get upgrade -y

_inst_item "Pacotes base (git, curl, timezone, libs Puppeteer)"
apt-get install -y git curl ca-certificates gnupg tzdata \
  libxshmfence-dev libgbm-dev libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libasound2 libpango-1.0-0 libcairo2 fonts-liberation || true

if timedatectl list-timezones 2>/dev/null | grep -q "America/Sao_Paulo"; then
  timedatectl set-timezone America/Sao_Paulo 2>/dev/null || true
fi

_inst_item "Node.js 20 (LTS)"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs build-essential
fi

_inst_item "PM2 global (opcional)"
npm install -g pm2@latest || true

_inst_item "PostgreSQL e extensões"
apt-get install -y postgresql postgresql-contrib
if ! command -v pg_dump >/dev/null 2>&1 || ! command -v psql >/dev/null 2>&1; then
  apt-get install -y postgresql-client || true
fi
systemctl enable postgresql
systemctl start postgresql

_inst_item "Utilizador PostgreSQL para import de restauro (DB_IMPORT_*)"
sync_postgres_import_password

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null || true

sudo -u postgres psql -d "${DB_NAME}" -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
sudo -u postgres psql -d "${DB_NAME}" -c 'CREATE EXTENSION IF NOT EXISTS "pgcrypto";' 2>/dev/null || true

_inst_item "Redis"
apt-get install -y redis-server
if [[ -f /etc/redis/redis.conf ]] && grep -q '^supervised no' /etc/redis/redis.conf; then
  sed -i 's/^supervised no/supervised systemd/' /etc/redis/redis.conf
fi
systemctl enable redis-server
systemctl start redis-server

if [[ -n "$REDIS_PASS" ]]; then
  sed -i "s/^# *requirepass .*/requirepass ${REDIS_PASS}/" /etc/redis/redis.conf
  systemctl restart redis-server
  REDIS_URI_EFFECTIVE="redis://:${REDIS_PASS}@127.0.0.1:6379"
else
  REDIS_URI_EFFECTIVE="redis://127.0.0.1:6379"
fi

_inst_item "Nginx (pacote base, limite de upload 4G para API/restauro)"
apt-get install -y nginx
mkdir -p /etc/nginx/conf.d
printf '%s\n' 'client_max_body_size 4G;' > /etc/nginx/conf.d/atendechat-limits.conf
systemctl enable nginx
systemctl start nginx

if command -v ufw >/dev/null 2>&1; then
  _inst_item "Firewall (ufw: 22, 80, ${API_PORT}$([[ "${INSTALL_MODE:-}" == "domain" ]] && echo ', 443'))"
  ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow "${API_PORT}/tcp" >/dev/null 2>&1 || true
  if [[ "${INSTALL_MODE:-}" == "domain" ]]; then
    ufw allow 443/tcp >/dev/null 2>&1 || true
  fi
fi

_inst_item "Ficheiro .env do backend e pastas runtime"
write_backend_env
ensure_runtime_dirs

_inst_item "Backend: npm install e build"
cd "${PROJETO_DIR}/backend"
npm install --production=false || { _inst_error_block "3" "npm install no backend" "O comando npm terminou com código de erro." "Verifique rede, espaço em disco e permissões em ${PROJETO_DIR}/backend; corrija e execute ./install.sh novamente."; exit 1; }
npm run build || { _inst_error_block "3" "Build do backend — npm run build" "A compilação do backend falhou (TypeScript ou dependências)." "Corrija os erros indicados na saída npm acima e volte a executar o instalador."; exit 1; }

if [[ ! -f dist/server.js ]]; then
  _inst_error_block "3" "Verificar artefacto do build backend" "Não existe dist/server.js após npm run build." "Confirme que o build terminou sem erros; em caso de dúvida, execute npm run build manualmente em backend/ e analise o log."
  exit 1
fi

_inst_item "PostgreSQL: ownership da base/schema (utilizador da app = dono das tabelas)"
ensure_postgres_app_ownership || { _inst_error_block "3" "PostgreSQL — ownership" "Não foi possível alinhar o dono da base/tabelas ao DB_USER (ALTER DATABASE / REASSIGN OWNED)." "Execute o instalador como root; confira PostgreSQL activo e DB_* em backend/.env."; exit 1; }
_inst_item "Migrations e seeds (Sequelize)"
npx sequelize db:migrate || { _inst_error_block "3" "Migrations Sequelize (db:migrate)" "O comando sequelize db:migrate falhou." "Garanta PostgreSQL activo, base e utilizador criados, e credenciais DB_* correctas em backend/.env."; exit 1; }
if npx sequelize db:seed:all; then
  :
else
  _inst_warn "Seeds ignorados ou duplicados — situação normal se a base já tinha dados."
fi

_inst_ok "Backend preparado com sucesso"

###############################################################################
# Etapa 4 — frontend
###############################################################################
_inst_step 4 "Preparando ambiente do frontend"
_inst_item "Build React (REACT_APP_BACKEND_URL=${API_PUBLIC_URL})"
build_frontend || { _inst_error_block "4" "Build do frontend — npm run build" "A compilação React falhou (ver saída npm acima)." "Verifique ${PROJETO_DIR}/frontend, variáveis REACT_APP_* e corrija erros de build antes de repetir o instalador."; exit 1; }

if [[ ! -f "${PROJETO_DIR}/frontend/build/index.html" ]]; then
  _inst_error_block "4" "Verificar artefacto do build frontend" "Não foi encontrado frontend/build/index.html." "Confirme que npm run build no frontend concluiu com sucesso e que não há erros na pasta build/."
  exit 1
fi

_inst_ok "Frontend preparado com sucesso"

###############################################################################
# Etapa 5 — serviço backend (systemd)
###############################################################################
_inst_step 5 "Iniciando serviços"
_inst_item "Criar e activar unit systemd atendechat-backend"
cat > /etc/systemd/system/atendechat-backend.service << EOF
[Unit]
Description=CoreFlow Backend
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=${LINUX_USER}
WorkingDirectory=${PROJETO_DIR}/backend
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable atendechat-backend
systemctl restart atendechat-backend

BACKEND_SERVICE_STATE="desconhecido"
if systemctl is-active --quiet atendechat-backend 2>/dev/null; then
  BACKEND_SERVICE_STATE="em execução (systemd: active)"
  _inst_ok "Backend em execução (systemd)"
else
  BACKEND_SERVICE_STATE="não ativo — investigue: systemctl status atendechat-backend"
  _inst_warn "O serviço systemd atendechat-backend não ficou activo após o arranque." "Verifique: systemctl status atendechat-backend — journalctl -u atendechat-backend -n 80 --no-pager"
fi

###############################################################################
# Etapa 6 — Nginx (SPA; proxy API em modo domínio)
# A API fica em API_PORT; o axios/socket apontam para API_PUBLIC_URL (com :8080).
###############################################################################
_inst_step 6 "Configurando Nginx"
_inst_item "Virtual hosts (ficheiros estáticos do frontend e, se aplicável, proxy da API)"

if [[ -n "$DOMAIN" && -n "$API_DOMAIN" ]]; then
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  cat > /etc/nginx/sites-available/atendechat-frontend << EOF
server {
    listen 80;
    server_name ${DOMAIN};
    root ${PROJETO_DIR}/frontend/build;
    index index.html;
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
  cat > /etc/nginx/sites-available/atendechat-backend << EOF
server {
    listen 80;
    server_name ${API_DOMAIN};
    location / {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
}
EOF
  ln -sf /etc/nginx/sites-available/atendechat-frontend /etc/nginx/sites-enabled/
  ln -sf /etc/nginx/sites-available/atendechat-backend /etc/nginx/sites-enabled/
else
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  cat > /etc/nginx/sites-available/atendechat << EOF
server {
    listen 80 default_server;
    server_name _;
    root ${PROJETO_DIR}/frontend/build;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
  ln -sf /etc/nginx/sites-available/atendechat /etc/nginx/sites-enabled/
fi

_inst_item "Validar configuração e reiniciar Nginx"
nginx -t || { _inst_error_block "6" "Validar configuração Nginx (nginx -t)" "A sintaxe ou os caminhos dos ficheiros de configuração são inválidos." "Revise /etc/nginx/sites-enabled/, os root/proxy_pass e caminhos para ${PROJETO_DIR}; corrija e execute nginx -t antes de voltar ao instalador."; exit 1; }
systemctl restart nginx

NGINX_SERVICE_STATE="desconhecido"
if systemctl is-active --quiet nginx 2>/dev/null; then
  NGINX_SERVICE_STATE="em execução (configuração aplicada)"
  _inst_ok "Nginx configurado e em execução"
else
  NGINX_SERVICE_STATE="não ativo — investigue: systemctl status nginx"
  _inst_warn "O serviço nginx não ficou activo após restart." "Verifique: systemctl status nginx — nginx -t"
fi

SSL_LINE="SSL=não aplicável"
SSL_ISSUED_LINE="Certificado SSL: n/a"
if [[ "${INSTALL_MODE:-}" == "domain" ]] && [[ "${MINIMAL_UPDATE:-}" != "1" ]]; then
  _inst_step 7 "Emitindo certificado SSL"
  if [[ -z "${SSL_EMAIL:-}" ]]; then
    SSL_LINE="SSL=não emitido (falta SSL_EMAIL no ambiente)"
    SSL_ISSUED_LINE="Certificado SSL: não executado"
    _inst_warn "SSL_EMAIL não definido no ambiente — Certbot não foi executado." "A instalação base em HTTP pode estar concluída; HTTPS ficará para emissão manual." "Quando tiver e-mail e DNS estáveis: certbot --nginx -d ${DOMAIN} -d ${API_DOMAIN}"
  else
    _inst_item "Certbot (Let's Encrypt) para ${DOMAIN} e ${API_DOMAIN}"
    apt-get install -y certbot python3-certbot-nginx
    if certbot --nginx -d "${DOMAIN}" -d "${API_DOMAIN}" -m "${SSL_EMAIL}" \
        --agree-tos --no-eff-email --non-interactive --redirect 2>&1; then
      SSL_LINE="SSL=ativo"
      SSL_ISSUED_LINE="Certificado SSL: emitido com sucesso (Let's Encrypt)"
      systemctl reload nginx 2>/dev/null || true
      _inst_ok "Certificado emitido — HTTPS com redireccionamento HTTP→HTTPS"
    else
      SSL_LINE="SSL=falhou"
      SSL_ISSUED_LINE="Certificado SSL: emissão falhou"
      _inst_warn "Certbot não emitiu o certificado Let's Encrypt (Node/PostgreSQL/Nginx HTTP podem estar OK)." "Causas frequentes: DNS a propagar, registos A incorrectos, porta 80 bloqueada externamente." "Corrija DNS/firewall e execute: certbot --nginx -d ${DOMAIN} -d ${API_DOMAIN}"
    fi
  fi
elif [[ "${INSTALL_MODE:-}" == "ip" ]]; then
  _inst_step 7 "Emitindo certificado SSL"
  _inst_item "Modo IP — Let's Encrypt não aplicável (use domínio e DNS para HTTPS)"
  SSL_LINE="SSL=não configurado"
  SSL_ISSUED_LINE="Certificado SSL: não aplicável (modo IP)"
  _inst_ok "Etapa concluída (sem Certbot)"
else
  _inst_step 7 "Emitindo certificado SSL"
  _inst_item "Certbot não executado (modo: ${INSTALL_MODE:-não definido})"
fi

_inst_step 8 "Finalizando instalação"
_inst_ok "Pronto para o resumo"

BACKEND_UNIT=$(systemctl is-active atendechat-backend 2>/dev/null || echo "unknown")
NGINX_UNIT=$(systemctl is-active nginx 2>/dev/null || echo "unknown")

###############################################################################
# Resumo final (apresentação — não altera lógica de instalação)
###############################################################################
echo ""
echo "============================================================"
echo " CoreFlow Installer — Instalação concluída"
echo "============================================================"
echo ""
echo "Modo de instalação"
echo "  modo=${INSTALL_MODE:-ip}"
echo ""
echo "URLs finais"
echo "  APP_URL=${FRONTEND_URL_VALUE}"
echo "  API_URL=${API_PUBLIC_URL}"
echo ""
echo "SSL / DNS"
if [[ "${INSTALL_MODE:-}" == "domain" ]]; then
  echo "  ${SSL_LINE}"
  [[ -n "${DNS_SUMMARY_NOTE:-}" ]] && echo "  ${DNS_SUMMARY_NOTE}"
  echo "  ${SSL_ISSUED_LINE}"
else
  echo "  ${SSL_LINE}"
  echo "  ${SSL_ISSUED_LINE}"
fi
echo ""
echo "Estado dos serviços"
echo "  Backend (systemd): ${BACKEND_UNIT}"
echo "  Nginx:             ${NGINX_UNIT}"
echo ""
echo "Acesso rápido"
echo "  Painel:  ${FRONTEND_URL_VALUE}"
echo "  API:     ${API_PUBLIC_URL}"
echo ""
echo "Próximos passos"
if [[ "${INSTALL_MODE:-}" == "domain" ]] && [[ "${SSL_LINE}" == "SSL=ativo" ]]; then
  echo "  1. Abrir o painel (URL acima) e iniciar sessão."
  echo "  2. Login inicial (se o seed correu): admin@admin.com / 123456 — alterar de seguida."
  echo "  3. Rever backups e branding em Super Admin, se aplicável."
elif [[ "${INSTALL_MODE:-}" == "ip" ]]; then
  echo "  1. Abrir o painel em ${FRONTEND_URL_VALUE} (API: ${API_PUBLIC_URL})."
  echo "  2. Login inicial (se o seed correu): admin@admin.com / 123456 — alterar de seguida."
  echo "  3. Para HTTPS e domínio: executar de novo ./install.sh em modo interactivo (DNS app/api)."
else
  # domínio sem SSL emitido (falha Certbot ou SSL_EMAIL em falta)
  echo "  1. A aplicação responde em HTTP; confirme DNS (app/api) e porta 80 aberta."
  echo "  2. Emitir SSL: certbot --nginx -d ${DOMAIN} -d ${API_DOMAIN}"
  echo "     (ou correr de novo o instalador após corrigir DNS/firewall)."
  echo "  3. Login inicial (se o seed correu): admin@admin.com / 123456"
fi
echo ""
echo "Manutenção"
echo "  Atualização após git pull:  MINIMAL_UPDATE=1 ./install.sh"
echo "  Logs do backend:            journalctl -u atendechat-backend -f --no-pager"
echo "  Backup / restauro:          Super Admin (backend/backups/)"
echo ""
echo "============================================================"
echo ""
