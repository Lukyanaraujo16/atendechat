#!/usr/bin/env bash
# Biblioteca do instalador StreamHub Chat (funções puras e de interface).
# Carregada por install.sh e pelos testes em scripts/installer/tests/.
# Regra: nenhuma função aqui imprime valores de segredos.
# shellcheck disable=SC2034

###############################################################################
# Interface
###############################################################################
if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_BLUE=$'\033[34m'
else
  C_RESET=""; C_BOLD=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_BLUE=""
fi

STEP_CURRENT=0
STEP_TOTAL=0
STEP_NAME=""

ui_step() {
  STEP_CURRENT=$((STEP_CURRENT + 1))
  STEP_NAME="$1"
  echo ""
  echo "${C_BOLD}${C_BLUE}[${STEP_CURRENT}/${STEP_TOTAL}] $1${C_RESET}"
}
ui_info() { echo "  • $*"; }
ui_ok() { echo "  ${C_GREEN}[OK]${C_RESET} $*"; }
ui_warn() { echo "  ${C_YELLOW}[AVISO]${C_RESET} $*" >&2; }
ui_err() { echo "  ${C_RED}[ERRO]${C_RESET} $*" >&2; }

# ui_fail "o que falhou" "como resolver" — encerra com código 1.
ui_fail() {
  ui_err "$1"
  [[ -n "${2:-}" ]] && echo "  ${C_BOLD}Como resolver:${C_RESET} $2" >&2
  exit 1
}

###############################################################################
# Validação de entradas
###############################################################################
# Remove esquema, barra final, espaços e converte para minúsculas.
normalize_host() {
  local h="$1"
  h="$(printf '%s' "$h" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
  h="${h#http://}"; h="${h#https://}"; h="${h%%/*}"; h="${h%.}"
  printf '%s' "$h"
}

is_valid_hostname() {
  local h="$1"
  [[ ${#h} -le 253 ]] || return 1
  [[ "$h" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$ ]]
}

is_valid_ipv4() {
  local ip="$1" o
  [[ "$ip" =~ ^([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$ ]] || return 1
  for o in "${BASH_REMATCH[@]:1}"; do
    [[ "$o" =~ ^0[0-9] ]] && return 1
    ((o <= 255)) || return 1
  done
}

is_valid_email() {
  [[ "$1" =~ ^[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$ ]]
}

# Mesma política do backend (utils/passwordPolicy.ts): 8–128, maiúscula, minúscula, número.
is_strong_password() {
  local p="$1"
  [[ ${#p} -ge 8 && ${#p} -le 128 ]] || return 1
  [[ "$p" =~ [a-z] && "$p" =~ [A-Z] && "$p" =~ [0-9] ]]
}

is_valid_port() {
  [[ "$1" =~ ^[0-9]{1,5}$ ]] && (( $1 >= 1 && $1 <= 65535 ))
}

# Identificador PostgreSQL simples (sem aspas): evita injeção nos comandos psql do instalador.
is_safe_pg_ident() {
  [[ "$1" =~ ^[a-z_][a-z0-9_]{0,62}$ ]]
}

# version_ge 20.11.0 20 → verdadeiro se $1 >= $2 (componentes numéricos).
version_ge() {
  local IFS=.
  local -a a b
  read -r -a a <<<"${1#v}"
  read -r -a b <<<"${2#v}"
  local i x y
  for ((i = 0; i < 3; i++)); do
    x="${a[i]:-0}"; y="${b[i]:-0}"
    x="${x//[^0-9]/}"; y="${y//[^0-9]/}"
    x="${x:-0}"; y="${y:-0}"
    ((10#$x > 10#$y)) && return 0
    ((10#$x < 10#$y)) && return 1
  done
  return 0
}

###############################################################################
# Segredos
###############################################################################
# Hex aleatório (sem caracteres que quebrem URLs, .env ou SQL).
gen_secret() {
  local bytes="${1:-32}" out=""
  if command -v openssl >/dev/null 2>&1; then
    out="$(openssl rand -hex "$bytes" 2>/dev/null || true)"
  fi
  if [[ -z "$out" ]]; then
    out="$(head -c "$bytes" /dev/urandom | od -An -tx1 | tr -d ' \n')"
  fi
  [[ ${#out} -eq $((bytes * 2)) ]] || return 1
  printf '%s' "$out"
}

# Valores que nunca devem ser usados como segredo (exemplos versionados e padrões antigos).
KNOWN_INSECURE_VALUES=(
  "kZaOTd+YZpjRUyyuQUpigJaEMk4vcW4YOymKPZX0Ts8="
  "dBSXqFg9TaNUEDXVp6fhMTRLBysP+j2DSqf7+raxD3A="
  "mysecret" "myanothersecret" "CoreFlowDB2024!" "123456" "senha"
  "429683C4C977415CAAFCCE10F7D57E11"
)

is_insecure_secret() {
  local v="$1" k
  [[ -z "$v" ]] && return 0
  for k in "${KNOWN_INSECURE_VALUES[@]}"; do
    [[ "$v" == "$k" ]] && return 0
  done
  return 1
}

# Mesmas regras de backend/src/config/jwtSecrets.ts. Imprime um problema por linha (sem valores).
JWT_MIN_LENGTH=32
jwt_secret_problems() {
  local file="$1" a b k v
  a="$(env_get "$file" JWT_SECRET || true)"; b="$(env_get "$file" JWT_REFRESH_SECRET || true)"
  for k in JWT_SECRET JWT_REFRESH_SECRET; do
    [[ "$k" == JWT_SECRET ]] && v="$a" || v="$b"
    v="$(printf '%s' "$v" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
    if [[ -z "$v" ]]; then echo "${k} ausente ou vazio"
    elif is_insecure_secret "$v" || [[ "$v" == "secret" || "$v" == "changeme" ]]; then echo "${k} usa um valor público conhecido"
    elif ((${#v} < JWT_MIN_LENGTH)); then echo "${k} tem menos de ${JWT_MIN_LENGTH} caracteres"
    fi
  done
  [[ -n "$a" && "$a" == "$b" ]] && echo "JWT_SECRET e JWT_REFRESH_SECRET são iguais"
  return 0
}

###############################################################################
# Arquivos .env (KEY=VALUE). Não usa sed -i: funciona em Linux e macOS (testes).
###############################################################################
# env_get ARQUIVO CHAVE → imprime o valor (sem aspas externas). Retorna 1 se ausente.
env_get() {
  local file="$1" key="$2" line raw
  [[ -f "$file" ]] || return 1
  line="$(grep -m1 -E "^[[:space:]]*${key}=" "$file" 2>/dev/null || true)"
  [[ -n "$line" ]] || return 1
  raw="${line#*=}"
  raw="${raw%$'\r'}"
  if [[ "$raw" =~ ^\"(.*)\"$ ]] || [[ "$raw" =~ ^\'(.*)\'$ ]]; then
    raw="${BASH_REMATCH[1]}"
  fi
  printf '%s' "$raw"
}

# env_set ARQUIVO CHAVE VALOR → substitui a primeira ocorrência, remove duplicadas
# e acrescenta no fim se não existir. Mantém permissões (cria com 600).
env_set() {
  local file="$1" key="$2" value="$3" tmp
  if [[ ! -f "$file" ]]; then
    (umask 077 && : >"$file")
  fi
  tmp="$(mktemp "${file}.tmp.XXXXXX")"
  ENV_SET_VALUE="$value" awk -v key="$key" '
    BEGIN { done = 0; v = ENVIRON["ENV_SET_VALUE"] }
    {
      line = $0
      sub(/^[ \t]+/, "", line)
      if (index(line, key "=") == 1) {
        if (!done) { print key "=" v; done = 1 }
        next
      }
      print $0
    }
    END { if (!done) print key "=" v }
  ' "$file" >"$tmp"
  chmod --reference="$file" "$tmp" 2>/dev/null || chmod 600 "$tmp"
  # mv troca o inode: sem isto o .env passaria a ser do root e o usuário de serviço perderia a leitura.
  chown --reference="$file" "$tmp" 2>/dev/null || true
  mv -f "$tmp" "$file"
}

# Define CHAVE só se estiver ausente ou vazia. Retorna 0 se escreveu, 1 se manteve.
env_set_if_empty() {
  local file="$1" key="$2" value="$3" cur
  cur="$(env_get "$file" "$key" || true)"
  [[ -n "$cur" ]] && return 1
  env_set "$file" "$key" "$value"
}

# Cópia de segurança com carimbo de data (600). Imprime o caminho.
backup_file() {
  local file="$1" dest
  [[ -f "$file" ]] || return 0
  dest="${file}.bak-$(date +%Y%m%d-%H%M%S)"
  cp -p "$file" "$dest"
  chmod 600 "$dest"
  printf '%s' "$dest"
}

# Lista as chaves (não os valores) que diferem entre dois .env.
env_changed_keys() {
  local old="$1" new="$2"
  # diff/grep retornam 1 quando há (ou não há) diferença: não é erro (set -e/pipefail).
  { diff <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$old" 2>/dev/null | sort) \
      <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$new" 2>/dev/null | sort) || true; } |
    { grep -E '^[<>]' || true; } | sed -E 's/^[<>] ([^=]*)=.*/\1/' | sort -u
}

###############################################################################
# Perguntas (todas aceitam resposta pré-definida por variável de ambiente
# para execução não interativa; ASSUME_YES=1 aceita os padrões).
###############################################################################
# ask VAR "Pergunta" "padrão" [validador]
ask() {
  local __var="$1" prompt="$2" def="${3:-}" validator="${4:-}" ans
  if [[ -n "${!__var:-}" ]]; then
    if [[ -z "$validator" ]] || "$validator" "${!__var}"; then return 0; fi
    ui_fail "Valor inválido em ${__var}." "Corrija a variável ${__var} e execute de novo."
  fi
  if [[ "${ASSUME_YES:-0}" == "1" || ! -t 0 ]]; then
    [[ -n "$def" ]] || ui_fail "Resposta obrigatória ausente: ${prompt}" "Defina a variável ${__var} ou execute em um terminal interativo."
    printf -v "$__var" '%s' "$def"
    return 0
  fi
  while true; do
    if [[ -n "$def" ]]; then
      read -r -p "  ${prompt} [${def}]: " ans
      ans="${ans:-$def}"
    else
      read -r -p "  ${prompt}: " ans
    fi
    ans="$(printf '%s' "$ans" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
    if [[ -z "$ans" ]]; then echo "    Resposta obrigatória."; continue; fi
    if [[ -n "$validator" ]] && ! "$validator" "$ans"; then
      echo "    Valor inválido. Tente novamente."
      continue
    fi
    printf -v "$__var" '%s' "$ans"
    return 0
  done
}

# ask_yes_no "Pergunta" s|n → retorna 0 para sim.
ask_yes_no() {
  local prompt="$1" def="${2:-n}" ans
  if [[ "${ASSUME_YES:-0}" == "1" || ! -t 0 ]]; then
    [[ "$def" == "s" ]]
    return
  fi
  while true; do
    if [[ "$def" == "s" ]]; then
      read -r -p "  ${prompt} [S/n]: " ans
    else
      read -r -p "  ${prompt} [s/N]: " ans
    fi
    ans="$(printf '%s' "${ans:-$def}" | tr '[:upper:]' '[:lower:]')"
    case "$ans" in
      s | sim | y | yes) return 0 ;;
      n | nao | não | no) return 1 ;;
      *) echo "    Responda s ou n." ;;
    esac
  done
}

# ask_secret VAR "Pergunta" validador → lê sem eco e pede confirmação.
ask_secret() {
  local __var="$1" prompt="$2" validator="${3:-}" a b
  if [[ -n "${!__var:-}" ]]; then
    if [[ -z "$validator" ]] || "$validator" "${!__var}"; then return 0; fi
    ui_fail "Valor de ${__var} não atende à política." "Use 8+ caracteres com maiúscula, minúscula e número."
  fi
  [[ -t 0 ]] || ui_fail "Senha ausente: ${prompt}" "Defina a variável ${__var} ou execute em um terminal interativo."
  while true; do
    read -r -s -p "  ${prompt}: " a; echo ""
    if [[ -n "$validator" ]] && ! "$validator" "$a"; then
      echo "    Senha fraca: mínimo 8 caracteres, com letra maiúscula, minúscula e número."
      continue
    fi
    read -r -s -p "  Confirme: " b; echo ""
    [[ "$a" == "$b" ]] && break
    echo "    As senhas não coincidem."
  done
  printf -v "$__var" '%s' "$a"
}

###############################################################################
# Sistema
###############################################################################
# Lê /etc/os-release (ou OS_RELEASE_FILE nos testes) → define OS_ID e OS_VERSION.
detect_os() {
  local f="${OS_RELEASE_FILE:-/etc/os-release}"
  OS_ID=""; OS_VERSION=""
  [[ -f "$f" ]] || return 1
  # shellcheck source=/dev/null
  OS_ID="$(. "$f" && printf '%s' "${ID:-}")"
  # shellcheck source=/dev/null
  OS_VERSION="$(. "$f" && printf '%s' "${VERSION_ID:-}")"
}

# Classifica o sistema: ok | aviso | bloqueado
os_support_level() {
  local id="$1" ver="$2"
  [[ "$id" == "ubuntu" ]] || { echo bloqueado; return; }
  case "$ver" in
    22.04 | 24.04) echo ok ;;
    20.04) echo aviso ;;
    *) echo bloqueado ;;
  esac
}

arch_supported() {
  case "$1" in x86_64 | amd64 | aarch64 | arm64) return 0 ;; *) return 1 ;; esac
}

# Todos os diretórios do caminho precisam ser atravessáveis por "outros" (nginx/www-data).
path_traversable_by_others() {
  local p="$1"
  while [[ -n "$p" && "$p" != "/" ]]; do
    [[ -d "$p" ]] || return 1
    local mode
    mode="$(stat -c '%a' "$p" 2>/dev/null || stat -f '%Lp' "$p")"
    (( (8#$mode & 1) == 1 )) || return 1
    p="$(dirname "$p")"
  done
}
