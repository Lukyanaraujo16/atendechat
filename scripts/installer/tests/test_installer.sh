#!/usr/bin/env bash
# Testes do instalador (sem root, sem rede, sem alterar o sistema).
# Requer bash 4+ e utilitários GNU (Ubuntu). Em macOS rode no contêiner:
#   docker run --rm -v "$PWD":/repo -w /repo ubuntu:24.04 bash scripts/installer/tests/test_installer.sh
# ok() avalia expressões em aspas simples via eval: SC2016/SC2034 são falsos positivos aqui.
# shellcheck disable=SC2016,SC2034
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
# shellcheck source=../lib.sh
source "$REPO/scripts/installer/lib.sh"
# shellcheck source=../evolution.sh
source "$REPO/scripts/installer/evolution.sh"

PASS=0; FAIL=0
ok() { if eval "$2"; then PASS=$((PASS + 1)); else FAIL=$((FAIL + 1)); echo "FALHOU: $1"; fi; }
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

echo "== Validação de entradas"
ok "hostname válido" 'is_valid_hostname app.empresa.com.br'
ok "hostname sem TLD inválido" '! is_valid_hostname localhost'
ok "hostname com espaço inválido" '! is_valid_hostname "app empresa.com"'
ok "hostname com underscore inválido" '! is_valid_hostname "a_b.com"'
ok "normalize_host remove esquema/barra/maiúsculas" '[[ $(normalize_host " HTTPS://App.Empresa.com/painel ") == app.empresa.com ]]'
ok "IPv4 válido" 'is_valid_ipv4 203.0.113.10'
ok "IPv4 octeto > 255" '! is_valid_ipv4 256.1.1.1'
ok "IPv4 incompleto" '! is_valid_ipv4 10.0.0'
ok "IPv4 zero à esquerda" '! is_valid_ipv4 010.0.0.1'
ok "e-mail válido" 'is_valid_email alex@empresa.com.br'
ok "e-mail inválido" '! is_valid_email alex@empresa'
ok "senha forte" 'is_strong_password "Abcdef12"'
ok "senha sem maiúscula" '! is_strong_password "abcdef12"'
ok "senha curta" '! is_strong_password "Ab1"'
ok "senha sem número" '! is_strong_password "Abcdefgh"'
ok "identificador PG seguro" 'is_safe_pg_ident atendechat'
ok "identificador PG com injeção" '! is_safe_pg_ident "x; DROP DATABASE y"'
ok "porta válida" 'is_valid_port 8080'
ok "porta inválida" '! is_valid_port 70000'

echo "== Versões e sistema"
ok "version_ge 20.11.1 >= 20" 'version_ge v20.11.1 20'
ok "version_ge 18 < 20" '! version_ge v18.19.0 20'
ok "version_ge 21 >= 21" 'version_ge 21.0.0 21'
ok "Ubuntu 24.04 suportado" '[[ $(os_support_level ubuntu 24.04) == ok ]]'
ok "Ubuntu 22.04 suportado" '[[ $(os_support_level ubuntu 22.04) == ok ]]'
ok "Ubuntu 20.04 com aviso" '[[ $(os_support_level ubuntu 20.04) == aviso ]]'
ok "Debian bloqueado" '[[ $(os_support_level debian 12) == bloqueado ]]'
printf 'ID=ubuntu\nVERSION_ID="24.04"\n' >"$TMP/os"
ok "detect_os lê os-release" 'OS_RELEASE_FILE=$TMP/os detect_os && [[ $OS_ID == ubuntu && $OS_VERSION == 24.04 ]]'
ok "arquitetura arm64" 'arch_supported aarch64'
ok "arquitetura i686 bloqueada" '! arch_supported i686'
mkdir -p "$TMP/pub/a" "$TMP/priv/a"; chmod 755 "$TMP" "$TMP/pub" "$TMP/pub/a"; chmod 700 "$TMP/priv"
ok "caminho legível pelo nginx" 'path_traversable_by_others "$TMP/pub/a"'
ok "caminho privado detectado" '! path_traversable_by_others "$TMP/priv/a"'

echo "== Segredos"
s1="$(gen_secret 32)"; s2="$(gen_secret 32)"
ok "gen_secret tem 64 hex" '[[ $s1 =~ ^[0-9a-f]{64}$ ]]'
ok "gen_secret não repete" '[[ $s1 != "$s2" ]]'
ok "JWT de exemplo é inseguro" 'is_insecure_secret "kZaOTd+YZpjRUyyuQUpigJaEMk4vcW4YOymKPZX0Ts8="'
ok "senha antiga padrão é insegura" 'is_insecure_secret "CoreFlowDB2024!"'
ok "vazio é inseguro" 'is_insecure_secret ""'
ok "segredo gerado é aceito" '! is_insecure_secret "$s1"'

echo "== Arquivos .env"
E="$TMP/test.env"
printf 'A=1\n MAIL_HOST="smtp.x"\nB=\nA=duplicada\n# C=comentario\n' >"$E"; chmod 640 "$E"
env_set "$E" A 2
ok "env_set substitui e remove duplicada" '[[ $(grep -c "^A=" "$E") == 1 && $(env_get "$E" A) == 2 ]]'
ok "env_get remove aspas e espaço inicial" '[[ $(env_get "$E" MAIL_HOST) == smtp.x ]]'
env_set "$E" MAIL_HOST ""
ok "env_set trata chave com espaço inicial" '[[ $(grep -c "MAIL_HOST=" "$E") == 1 && -z $(env_get "$E" MAIL_HOST) ]]'
ok "comentário preservado" 'grep -q "^# C=comentario" "$E"'
env_set "$E" URI 'postgresql://u:p@h:5432/db?schema=x&a=b|c\1'
ok "valor com caracteres especiais intacto" '[[ $(env_get "$E" URI) == "postgresql://u:p@h:5432/db?schema=x&a=b|c\1" ]]'
ok "permissão preservada" '[[ $(stat -c %a "$E") == 640 ]]'
ok "env_set_if_empty preenche vazio" 'env_set_if_empty "$E" B novo && [[ $(env_get "$E" B) == novo ]]'
ok "env_set_if_empty não sobrescreve" '! env_set_if_empty "$E" B outro && [[ $(env_get "$E" B) == novo ]]'
ok "env_get de chave ausente falha" '! env_get "$E" NAO_EXISTE'
env_set "$TMP/novo.env" X 1
ok "arquivo novo criado com 600" '[[ $(stat -c %a "$TMP/novo.env") == 600 ]]'
if [[ $EUID -eq 0 ]]; then
  chown nobody "$TMP/novo.env"; env_set "$TMP/novo.env" X 2
  ok "env_set preserva o dono (usuário de serviço)" '[[ $(stat -c %U "$TMP/novo.env") == nobody && $(stat -c %a "$TMP/novo.env") == 600 ]]'
fi
bk="$(backup_file "$E")"
ok "backup_file cria cópia 600" '[[ -f $bk && $(stat -c %a "$bk") == 600 ]]'
env_set "$E" A 3
ok "env_changed_keys lista só nomes" '[[ $(env_changed_keys "$bk" "$E") == A ]]'
ok "env_changed_keys não falha sob set -e/pipefail" '( set -Eeo pipefail; trap "exit 9" ERR; x="$(env_changed_keys "$bk" "$E")"; y="$(env_changed_keys "$E" "$E")"; [[ $x == A && -z $y ]] )'

echo "== Regras JWT (iguais a backend/src/config/jwtSecrets.ts)"
J="$TMP/jwt.env"
printf 'JWT_SECRET=%s\nJWT_REFRESH_SECRET=%s\n' "$(gen_secret 32)" "$(gen_secret 32)" >"$J"
ok "JWT válidos sem problemas" '[[ -z $(jwt_secret_problems "$J") ]]'
printf 'JWT_SECRET=Q2hhdmVBbnRpZ2FEb0luc3RhbGFkb3JCYXNlNjQ0NA==\nJWT_REFRESH_SECRET=%s\n' "$(gen_secret 32)" >"$J"
ok "JWT base64 do instalador antigo aceito" '[[ -z $(jwt_secret_problems "$J") ]]'
printf 'JWT_REFRESH_SECRET=%s\n' "$(gen_secret 32)" >"$J"
ok "JWT ausente detectado" '[[ $(jwt_secret_problems "$J") == "JWT_SECRET ausente ou vazio" ]]'
printf 'JWT_SECRET=mysecret\nJWT_REFRESH_SECRET=dBSXqFg9TaNUEDXVp6fhMTRLBysP+j2DSqf7+raxD3A=\n' >"$J"
ok "JWT públicos detectados" '[[ $(jwt_secret_problems "$J" | grep -c "valor público") == 2 ]]'
printf 'JWT_SECRET=curto123\nJWT_REFRESH_SECRET=%s\n' "$(gen_secret 32)" >"$J"
ok "JWT curto detectado" '[[ $(jwt_secret_problems "$J") == *"menos de 32"* ]]'
x="$(gen_secret 32)"; printf 'JWT_SECRET=%s\nJWT_REFRESH_SECRET=%s\n' "$x" "$x" >"$J"
ok "JWT iguais detectados" '[[ $(jwt_secret_problems "$J") == *"são iguais"* ]]'
ok "problemas JWT não expõem valores" '! jwt_secret_problems "$J" | grep -qF "$x"'

echo "== Perguntas não interativas"
ok "ask usa variável pré-definida" 'X1=abc; ask X1 "p" "" && [[ $X1 == abc ]]'
ok "ask usa padrão com ASSUME_YES" 'unset X2; ASSUME_YES=1 ask X2 "p" "def" && [[ $X2 == def ]]'
ok "ask rejeita valor pré-definido inválido" '! ( X3=foo; ask X3 "p" "" is_valid_email ) 2>/dev/null'
ok "ask sem resposta e sem padrão falha" '! ( unset X4; ASSUME_YES=1 ask X4 "p" "" ) 2>/dev/null'
ok "ask_yes_no padrão s" 'ASSUME_YES=1 ask_yes_no "p" s'
ok "ask_yes_no padrão n" '! ASSUME_YES=1 ask_yes_no "p" n'
ok "ask_secret rejeita senha fraca pré-definida" '! ( P=fraca; ask_secret P "p" is_strong_password ) 2>/dev/null'

echo "== Evolution (geração de arquivos)"
D="$TMP/evo"
evolution_render "$D"
k1="$(env_get "$D/.env" AUTHENTICATION_API_KEY)"; p1="$(env_get "$D/.env" POSTGRES_PASSWORD)"
ok ".env da Evolution com 600" '[[ $(stat -c %a "$D/.env") == 600 ]]'
ok "diretório da Evolution com 700" '[[ $(stat -c %a "$D") == 700 ]]'
ok "API key gerada forte" '[[ $k1 =~ ^[0-9a-f]{64}$ ]]'
ok "compose publica só em 127.0.0.1" 'grep -q "\"127.0.0.1:${EVOLUTION_HOST_PORT}:8080\"" "$D/docker-compose.yml" && ! grep -qE "^\s+- \"?[0-9]+:[0-9]+" "$D/docker-compose.yml"'
ok "compose sem segredos em texto" '! grep -qF "$k1" "$D/docker-compose.yml" && ! grep -qF "$p1" "$D/docker-compose.yml"'
ok "imagem fixada na v2.3.7" 'grep -q "image: evoapicloud/evolution-api:v2.3.7" "$D/docker-compose.yml"'
ok "URI do banco usa a senha gerada" '[[ $(env_get "$D/.env" DATABASE_CONNECTION_URI) == *":${p1}@evolution-postgres:5432/"* ]]'
ok "webhook global desligado" '[[ $(env_get "$D/.env" WEBHOOK_GLOBAL_ENABLED) == false ]]'
evolution_render "$D"
ok "reexecução preserva a API key" '[[ $(env_get "$D/.env" AUTHENTICATION_API_KEY) == "$k1" ]]'
ok "reexecução preserva a senha do banco" '[[ $(env_get "$D/.env" POSTGRES_PASSWORD) == "$p1" ]]'
ok "reexecução não duplica chaves" '[[ $(grep -c "^AUTHENTICATION_API_KEY=" "$D/.env") == 1 ]]'
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  ok "docker compose config válido" 'docker compose --project-directory "$D" -f "$D/docker-compose.yml" config -q'
fi
env_set "$D/.env" AUTHENTICATION_API_KEY 429683C4C977415CAAFCCE10F7D57E11
ok "key pública de exemplo é recusada" '! ( evolution_render "$D" ) >/dev/null 2>&1'

echo "== install.sh (funções, sem executar)"
P="$TMP/proj"; mkdir -p "$P/backend" "$P/frontend"
cp "$REPO/backend/.env.example" "$P/backend/.env.example"
load_installer() {
  # shellcheck disable=SC1091
  INSTALLER_SOURCE_ONLY=1; PROJETO_DIR="$P"; EVOLUTION_DIR="$TMP/sem-evo"
  source "$REPO/install.sh"
  set +eE; trap - ERR
  STATE_FILE="$TMP/state/install.conf"; STATE_DIR="$TMP/state"
}
load_installer
# Só sinais do projeto temporário (o host pode ter uma instalação real).
ok "sem sinais em projeto limpo" '[[ -z $(existing_install_signals | grep -F "$P") ]]'
INSTALL_MODE=domain DOMAIN=app.exemplo.com API_DOMAIN=api.exemplo.com SERVER_IP=203.0.113.10 compute_urls
ok "URLs modo domínio" '[[ $FRONTEND_URL_VALUE == https://app.exemplo.com && $BACKEND_URL_VALUE == https://api.exemplo.com ]]'
DB_NAME=atendechat DB_USER=atendechat DB_PASS=dbpass123 DB_IMPORT_USER=postgres DB_IMPORT_PASS=imp123 \
  REDIS_URI_VALUE="redis://:r@127.0.0.1:6379" INSTALL_MODE=domain API_DOMAIN=api.exemplo.com \
  write_backend_env_nova >/dev/null
F="$P/backend/.env"
j1="$(env_get "$F" JWT_SECRET)"; e1="$(env_get "$F" EVOLUTION_CREDENTIAL_ENCRYPTION_KEY)"
ok ".env gerado com 600" '[[ $(stat -c %a "$F") == 600 ]]'
ok "JWT de exemplo substituído" '! is_insecure_secret "$j1" && [[ $j1 =~ ^[0-9a-f]{64}$ ]]'
ok "JWT_REFRESH diferente do JWT" '[[ $(env_get "$F" JWT_REFRESH_SECRET) != "$j1" ]]'
ok "ENV_TOKEN gerado" '[[ -n $(env_get "$F" ENV_TOKEN) ]]'
ok "chaves de criptografia geradas" '[[ -n $e1 && -n $(env_get "$F" EFI_CREDENTIAL_ENCRYPTION_KEY) && -n $(env_get "$F" AI_PROVIDER_CREDENTIAL_ENCRYPTION_KEY) ]]'
ok "STREAMHUB_RUNTIME_ENV=production" '[[ $(env_get "$F" STREAMHUB_RUNTIME_ENV) == production ]]'
ok "redirect Meta aponta para a nova API" '[[ $(env_get "$F" META_OAUTH_REDIRECT_URI) == https://api.exemplo.com/instagram/oauth/callback ]]'
ok "SMTP de exemplo removido" '[[ -z $(env_get "$F" MAIL_HOST) ]]'
ok "BACKEND_URL correto" '[[ $(env_get "$F" BACKEND_URL) == https://api.exemplo.com ]]'
ok "sem chaves duplicadas" '[[ -z $(grep -oE "^[A-Z_]+=" "$F" | sort | uniq -d) ]]'
DB_NAME=atendechat DB_USER=atendechat DB_PASS=dbpass123 DB_IMPORT_USER=postgres DB_IMPORT_PASS=imp123 \
  REDIS_URI_VALUE="redis://:r@127.0.0.1:6379" INSTALL_MODE=domain API_DOMAIN=api.exemplo.com \
  write_backend_env_nova >/dev/null
ok "reexecução preserva JWT" '[[ $(env_get "$F" JWT_SECRET) == "$j1" ]]'
ok "reexecução preserva chave Evolution" '[[ $(env_get "$F" EVOLUTION_CREDENTIAL_ENCRYPTION_KEY) == "$e1" ]]'
ok "reexecução fez backup do .env" '[[ $(ls "$P"/backend/.env.bak-* | wc -l) -ge 1 ]]'
ok "instalação existente detectada" '[[ $(existing_install_signals) == *"arquivo $F"* ]]'
out="$( (flow_nova) 2>&1 )"; rc=$?
ok "--nova recusa instalação existente" '[[ $rc -ne 0 && $out == *"instalação nova foi bloqueada"* ]]'
ok "--nova não alterou o .env" '[[ $(env_get "$F" JWT_SECRET) == "$j1" ]]'
mkdir -p "$TMP/state"; INSTALL_STATUS=em_andamento PROJETO_DIR="$P" state_save INSTALL_STATUS PROJETO_DIR
ok "registro de estado com 600" '[[ $(stat -c %a "$TMP/state/install.conf") == 600 ]]'
out="$( (ASSUME_YES=1; check_prereqs() { return 1; }; flow_nova) 2>&1 )"
ok "instalação interrompida é retomada (não bloqueada)" '[[ $out == *"será retomada"* && $out != *"foi bloqueada"* ]]'
ok "menu sem argumentos leva à retomada" '( ACTION=""; choose_action >/dev/null; [[ $ACTION == nova ]] )'
ok "apply_evolution_backend_env grava URL e webhook" 'BACKEND_URL_VALUE=https://api.exemplo.com apply_evolution_backend_env http://127.0.0.1:8085 kkk; [[ $(env_get "$F" EVOLUTION_CENTRAL_BASE_URL) == http://127.0.0.1:8085 && $(env_get "$F" EVOLUTION_WEBHOOK_PUBLIC_BASE_URL) == https://api.exemplo.com ]]'
ok "apply_evolution_backend_env sem mudança retorna 1" '! BACKEND_URL_VALUE=https://api.exemplo.com apply_evolution_backend_env http://127.0.0.1:8085 kkk'
ok "chave de criptografia Evolution preservada" '[[ $(env_get "$F" EVOLUTION_CREDENTIAL_ENCRYPTION_KEY) == "$e1" ]]'

echo "== Correções da revisão"
sshd() { printf 'port 22\nport 2222\n'; }
ok "ssh_ports inclui todas as portas do sshd e a da sessão" '[[ $(SSH_CONNECTION="10.0.0.1 5555 10.0.0.2 4422" ssh_ports) == "22 2222 4422" ]]'
unset -f sshd
detect_public_ip() { echo 198.51.100.7; }
rm -f "$TMP/state/install.conf"
env_set "$F" BACKEND_URL https://api.antiga.com.br; env_set "$F" FRONTEND_URL https://app.antiga.com.br
ok "instalação antiga com domínio não usa hostname como IP" '( unset INSTALL_MODE DOMAIN API_DOMAIN SERVER_IP EVOLUTION_MODE; load_existing_config; [[ $INSTALL_MODE == domain && $API_DOMAIN == api.antiga.com.br && $SERVER_IP == 198.51.100.7 ]] )'
env_set "$F" BACKEND_URL http://203.0.113.9:8080
ok "instalação antiga em modo IP deriva o IP da URL" '( unset INSTALL_MODE DOMAIN API_DOMAIN SERVER_IP EVOLUTION_MODE; load_existing_config; [[ $INSTALL_MODE == ip && $SERVER_IP == 203.0.113.9 ]] )'
ok "SERVER_IP inválido no registro é descartado" '( unset INSTALL_MODE DOMAIN API_DOMAIN EVOLUTION_MODE; SERVER_IP=api.x.com; load_existing_config; [[ $SERVER_IP == 203.0.113.9 ]] )'
ok "BACKUP_KEEP=0 é recusado antes de apagar algo" '[[ $(BACKUP_KEEP=0 bash "$REPO/scripts/streamhub-backup.sh" 2>&1) == *"BACKUP_KEEP deve ser"* ]]'

ok "releases_dir ao lado do repositório" '[[ $(PROJETO_DIR=/var/www/atendechat releases_dir) == /var/www/atendechat-frontend-releases ]]'
ok "ensure_service_user recusa nome inválido" '! ( ensure_service_user "x;rm" ) 2>/dev/null'
ok "apply_service_ownership não faz nada para root" 'apply_service_ownership root'

echo "== Saída sem segredos"
ok "nenhum segredo do .env aparece na saída de write_backend_env_nova" '! (DB_NAME=a DB_USER=a DB_PASS=x DB_IMPORT_USER=p DB_IMPORT_PASS=y REDIS_URI_VALUE=z INSTALL_MODE=ip write_backend_env_nova 2>&1 | grep -qF "$j1")'

echo ""
echo "Resultado: ${PASS} ok, ${FAIL} falha(s)"
((FAIL == 0))
