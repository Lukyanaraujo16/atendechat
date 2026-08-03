# Frontend — Cache, Service Worker e detecção de versão

| Campo | Valor |
|-------|-------|
| **Produto** | StreamHUB Chat |
| **Status** | Correção implementada (local — aguardando revisão) |
| **Ambiente auditado** | https://app.streamhubchat.com.br |

## 1. Causa raiz

Três fatores combinados:

1. **Service Worker Workbox (CRA)** registrado em produção (`/service-worker.js`) com:
   - `precacheAndRoute` dos assets;
   - `registerNavigationRoute` para `/index.html`;
   - `clientsClaim()` sem fluxo de `SKIP_WAITING` na app.
   Resultado: o shell HTML/JS antigo permanece ativo por dias enquanto a aba (ou o SW controlador) existir. Ctrl+Shift+R contorna o SW.

2. **Nginx de produção sem `Cache-Control`** em `/`, `/index.html`, JS e CSS (apenas `ETag`/`Last-Modified`). O browser aplica cache heurístico e a SPA nunca rebaixa o `index.html` sozinha.

3. **Sem mecanismo de versão** (`version.json` inexistente — a URL devolvia o HTML do SPA). Usuário com aba aberta não era notificado após deploy.

Não há Cloudflare (headers `Server: nginx/1.18.0`, sem `cf-*`).

## 2. Headers observados (antes)

| URL | Status | Cache-Control | ETag | Last-Modified | Observação |
|-----|--------|---------------|------|---------------|------------|
| `/` | 200 | **ausente** | sim | 2026-08-02 | HTML |
| `/index.html` | 200 | **ausente** | sim | 2026-08-02 | HTML |
| `/asset-manifest.json` | 200 | **ausente** | sim | 2026-08-02 | JSON |
| `/service-worker.js` | 200 | **ausente** | sim | 2026-08-02 | **Workbox 4.3.1** |
| `/manifest.json` | 200 | **ausente** | sim | — | JSON |
| `/version.json` | 200 | **ausente** | = index | — | **HTML (SPA fallback)** |
| `/static/js/main.*.js` | 200 | **ausente** | sim | — | hash ok, sem immutable |
| `/static/css/main.*.css` | 200 | **ausente** | sim | — | idem |

## 3. Correção aplicada no código

- Build gera `version.json` (`write-version-json.js`).
- Build substitui Workbox por **kill-switch SW** e remove `precache-manifest.*`.
- Cliente **desregistra** Workbox/PWA e limpa caches do app (não toca OneSignal).
- `AppVersionGate`: polling ~90s + focus + visibilitychange; modal “Nova versão disponível”.
- Reload só com clique em “Atualizar agora”; guard contra loop; hint se há edição ativa.
- Tratamento de `ChunkLoadError` com reload controlado (máx. 2 tentativas).
- Exemplo Nginx: `deploy/nginx-frontend-cache.example.conf`.

## 4. Política final

| Recurso | Cache-Control |
|---------|---------------|
| `index.html`, `/`, `version.json`, `asset-manifest.json`, `service-worker.js` | `no-cache, no-store, must-revalidate` |
| `/static/**` (hashes CRA) | `public, max-age=31536000, immutable` |

## 5. Deploy atômico (recomendado)

Publicar build em diretório novo → trocar symlink/root → manter build anterior por curto período → remover depois. Evita janela index↔chunks inconsistente.

## Limitação — trabalho não salvo

A detecção de “edição ativa” é **heurística**:

- `document.activeElement` em `textarea` / `input` de texto / `contentEditable`;
- ou ancestral com `data-unsaved-work="true"`.

**Não** há tracking global de dirty state de todos os formulários.
Por isso o reload **nunca** é automático: o usuário precisa clicar em “Atualizar agora”.
