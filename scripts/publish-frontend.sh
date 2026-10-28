#!/usr/bin/env bash
# Publica o frontend sem deixar o site incompleto durante a compilação.
#
# O CRA (react-scripts 3.x) sempre esvazia e reescreve frontend/build. Por isso:
#   1. copia o código do frontend (sem node_modules/build) para um diretório de staging;
#   2. compila no staging (node_modules por symlink) — o build publicado não é tocado;
#   3. valida os artefatos (index.html, version.json = commit, scripts referenciados);
#   4. move o resultado para releases/<data>-<commit> e mantém os assets antigos
#      (clientes com a aba aberta continuam achando os chunks da versão anterior);
#   5. troca frontend/build (symlink) de forma atômica: ln -s + mv -T (rename(2)).
# O nginx continua servindo /var/www/atendechat/frontend/build — sem mudar configuração.
#
# Uso (no servidor, a partir do repositório já atualizado):
#   scripts/publish-frontend.sh             compila e publica o commit atual
#   scripts/publish-frontend.sh --rollback  volta para a release anterior
#   scripts/publish-frontend.sh --status    mostra a release publicada e as disponíveis
# Env: FRONTEND_RELEASES_DIR (padrão: <repo>/../atendechat-frontend-releases), FRONTEND_RELEASES_KEEP (5)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONT="$ROOT/frontend"
LIVE="$FRONT/build"
RELEASES="${FRONTEND_RELEASES_DIR:-$(dirname "$ROOT")/atendechat-frontend-releases}"
KEEP="${FRONTEND_RELEASES_KEEP:-5}"

log() { echo "[publish-frontend] $*"; }
die() { echo "[publish-frontend] ERRO: $*" >&2; exit 1; }

current_release() { [ -L "$LIVE" ] && readlink -f "$LIVE" || true; }

releases_sorted() { find "$RELEASES" -mindepth 1 -maxdepth 1 -type d ! -name '.stage-*' | sort; }

# Troca atômica: o symlink novo substitui frontend/build num único rename(2).
switch_to() {
  local target="$1"
  [ -f "$target/index.html" ] || die "release inválida: $target"
  if [ -e "$LIVE" ] && [ ! -L "$LIVE" ]; then
    # Primeira execução: frontend/build ainda é diretório comum. Ele vira a release mais
    # antiga (rename no mesmo filesystem) e o symlink entra logo em seguida (microssegundos).
    local legacy="$RELEASES/00000000000000-legacy"
    [ -e "$legacy" ] && die "$legacy já existe"
    mv "$LIVE" "$legacy"
    log "build anterior preservado como release: $legacy"
  fi
  ln -sfn "$target" "$FRONT/.build-next"
  mv -T "$FRONT/.build-next" "$LIVE"
  log "publicado: $LIVE -> $target"
}

prune() {
  local current previous
  current="$(current_release)"
  mapfile -t all < <(releases_sorted)
  local count=${#all[@]}
  (( count > KEEP )) || return 0
  for dir in "${all[@]:0:count-KEEP}"; do
    [ "$dir" = "$current" ] && continue
    rm -rf -- "$dir"
    log "release antiga removida: $(basename "$dir")"
  done
}

validate() {
  local build="$1" sha="$2"
  [ -s "$build/index.html" ] || die "index.html ausente/vazio"
  grep -q 'id="root"' "$build/index.html" || die "index.html sem #root"
  grep -q "\"version\": *\"$sha\"" "$build/version.json" || die "version.json não corresponde a $sha"
  local ref missing=0
  # Todo script/estilo referenciado pelo index.html precisa existir na release.
  while read -r ref; do
    [ -f "$build/${ref#/}" ] || { log "referência ausente: $ref"; missing=1; }
  done < <(grep -oE '(src|href)="/static/[^"]+"' "$build/index.html" | sed -E 's/^(src|href)="//; s/"$//')
  [ "$missing" = 0 ] || die "artefatos referenciados ausentes"
  ls "$build"/static/js/main.*.js > /dev/null 2>&1 || die "bundle principal ausente"
}

case "${1:-}" in
  --status)
    log "publicado: $(current_release || echo "(diretório comum, ainda não migrado)")"
    releases_sorted
    exit 0
    ;;
  --rollback)
    current="$(current_release)"
    [ -n "$current" ] || die "frontend/build não é symlink de release; nada para reverter"
    previous="$(releases_sorted | grep -vxF "$current" | awk -v cur="$current" '$0 < cur' | tail -1)"
    [ -n "$previous" ] || die "não há release anterior a $(basename "$current")"
    switch_to "$previous"
    exit 0
    ;;
  "") ;;
  *) die "opção desconhecida: $1" ;;
esac

if [ -n "$(git -C "$ROOT" status --porcelain --untracked-files=no -- frontend)" ]; then
  die "há alterações locais em frontend/ — publique somente commits"
fi
SHA="$(git -C "$ROOT" rev-parse --short=12 HEAD)"
STAMP="$(date +%Y%m%d%H%M%S)"
RELEASE="$RELEASES/$STAMP-$SHA"
STAGE="$RELEASES/.stage-$STAMP"

mkdir -p "$RELEASES"
chmod 755 "$RELEASES"
(umask 077 && mkdir "$STAGE")
trap 'rm -rf -- "$STAGE"' EXIT

log "staging $STAGE (commit $SHA)"
# Inclui .env do frontend (variáveis REACT_APP_* de build); o staging é 0700 e apagado ao final.
tar -C "$FRONT" --exclude=./node_modules --exclude=./build --exclude='./build-*' \
  --exclude=./.build-next -cf - . | tar -C "$STAGE" -xf -
ln -s "$FRONT/node_modules" "$STAGE/node_modules"

log "compilando (o site publicado não é alterado durante esta etapa)"
started=$(date +%s)
(cd "$STAGE" && REACT_APP_BUILD_ID="$SHA" npm run build > "$STAGE/build.log" 2>&1) \
  || { tail -40 "$STAGE/build.log"; die "build falhou"; }
log "build concluído em $(( $(date +%s) - started ))s"

validate "$STAGE/build" "$SHA"
log "artefatos validados"

mv "$STAGE/build" "$RELEASE"
chmod 755 "$RELEASE"
previous="$(current_release)"
[ -z "$previous" ] && [ -d "$LIVE" ] && previous="$LIVE"
if [ -n "$previous" ] && [ -d "$previous/static" ]; then
  # Mantém chunks antigos (sem sobrescrever os novos) para abas abertas na versão anterior.
  tar -C "$previous/static" -cf - . | tar -C "$RELEASE/static" --skip-old-files -xf -
fi

switch_to "$RELEASE"
prune
log "rollback: scripts/publish-frontend.sh --rollback"
