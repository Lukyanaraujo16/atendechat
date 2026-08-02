# OneSignal Web Push (SDK v16)

## Versão e carregamento

- SDK: **OneSignal Web SDK v16** via CDN
  (`https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js`)
- Carregamento dinâmico + `OneSignalDeferred` + `initPromise` (singleton).
- App ID público via `GET /system-settings/public/push-config` (sem REST API Key).
- Init com `autoRegister: false` — inscrição só no fluxo explícito do utilizador.

## Arquitetura de service workers (Fase 2.13C)

| Papel | URL | Scope |
|-------|-----|-------|
| PWA / Workbox | `/service-worker.js` | `/` |
| OneSignal | `/OneSignalSDKWorker.js` | `/push/onesignal/` |
| OneSignal updater | `/OneSignalSDKUpdaterWorker.js` | `/push/onesignal/` |

Conteúdo do worker (igual ao ficheiro do painel OneSignal):

```js
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
```

### Por que a 2.13B foi ajustada

A 2.13B moveu o **path** do worker para `/push/onesignal/` **e** alterou o scope,
além de `unregister` automático do worker histórico na raiz. Isso quebrou a criação
visível da Push Subscription no painel (regressão pós-deploy).

A documentação OneSignal recomenda, para migração segura: **alterar somente o scope**
e **manter a URL histórica** do worker. A 2.13C restaura:

- URL canónica = raiz (`/OneSignalSDKWorker.js`);
- scope OneSignal = `/push/onesignal/` (isolado do Workbox);
- **sem** unregister automático do OneSignal;
- Workbox permanece em `/service-worker.js` / scope `/`.

O script na raiz pode pedir um scope **mais restrito** (`/push/onesignal/`).

Nota: o ficheiro em `public/service-worker.js` é mínimo; o artefacto de **produção**
gerado pelo CRA/Workbox é diferente e é o que o nginx serve.

## Permissão ≠ inscrição

| Conceito | Fonte | Significa push ativo? |
|----------|--------|------------------------|
| `Notification.permission` | Browser | Não |
| `User.PushSubscription.optedIn` | SDK v16 | Parcial |
| `User.PushSubscription.id` / `token` | SDK v16 | Canal necessário |
| **Efetivo** | `optedIn` **e** (`id` ou `token`) | **Sim** |

Após cada `init`, o estado é **relido do SDK** (não se usa id/token em cache da sessão
anterior como sucesso).

Estados: `unsupported`, `not_configured`, `sdk_loading`, `permission_default`,
`permission_denied`, `permission_granted_unsubscribed`, `subscribing`, `subscribed`, `error`.

## Fluxo de ativação

1. Validar config (enabled + App ID).
2. `init` com path raiz + scope `/push/onesignal/`.
3. Relê `optedIn` / id / token do SDK.
4. Se já inscrito → `login(externalId)` e sucesso.
5. Se `denied` → orientar bloqueio.
6. `optIn()` → aguardar confirmação (`optedIn` + id/token).
7. `login(externalId)` (aguardar) → depois tags.
8. Banner some **só** em `subscribed`.

## Identidade individual (Fase 2.13E)

| Camada | Identificador | Valor |
|--------|---------------|-------|
| Frontend `OneSignal.login` | External ID | `String(user.id)` |
| Backend envio | `include_external_user_ids` | `String(userId)` dos destinatários |
| Tags | metadados | `user_id`, `company_id`, `profile`, `queue_ids` |
| Logout | — | `OneSignal.logout()` sem `optOut` |

**Contrato:** External ID = utilizador, **nunca** `companyId`.

Exemplos:

- user `id=25`, `companyId=1` → login/envio `"25"`; tag `company_id="1"`
- user `id=26`, `companyId=1` → login/envio `"26"` (entrega individual na mesma empresa)

`companyId`, `profile` e filas são **só tags**, não identidade.

### Ordem e deduplicação

1. subscription confirmada
2. `login(externalId)` (single-flight)
3. `addTags` só após login
4. sync idêntico reutiliza Promise / cache (evita HTTP 409 por PATCH repetido)
5. falha limpa o in-flight para retry; logout invalida o cache

### Chrome + Firefox

Mesmo External ID (`"25"`); Subscription IDs distintos; OneSignal mantém
múltiplas subscriptions por utilizador. O frontend **não** remove a do Chrome
ao ligar o Firefox.

### SupportMode

External ID = utilizador autenticado da sessão (ex.: Super Admin), **não** o
`companyId` do tenant visitado. O tenant entra só como tag `company_id`.

### Troubleshooting 400 / 409

| Erro | Causa típica | Mitigação 2.13E |
|------|--------------|-----------------|
| HTTP 400 login `externalId` = companyId | identidade trocada / corrida | resolver só `user.id` + single-flight |
| HTTP 409 tags | vários `addTags` simultâneos | serializar login→tags + dedupe |

Diagnóstico: `identity_sync_*`, `identity_login_*`, `tags_sync_*`,
`identity_sync_deduplicated` (sem JWT/token/ID completos).

## Identidade por navegador

- Cada browser gera **Subscription ID** próprio (Chrome ≠ Firefox).
- External ID partilhado: `String(user.id)` (igual ao backend).
- Logout: `OneSignal.logout()`; **sem** `optOut` físico.

## Diagnóstico

Em development: `window.__atendechatOneSignalDiagnostics()`.

Em produção (somente suporte):
- Super Admin com `supportMode`, **ou**
- `localStorage.setItem('atendechat_onesignal_diag', '1')` e recarregar.

Inclui browser (Firefox/Chrome), permissões, optedIn, id mascarado, tokenLength
(sem token completo), workers/scopes, PushManager nativo (host mascarado),
timeline do fluxo e `waitMeta` (elapsedMs / resolvedBy).

## Diagnóstico Firefox

Quando o Chrome recebe push e o Firefox (mesmo utilizador) recebe a boas-vindas
mas **não** aparece em Audience → Subscriptions:

1. Abrir o **Console** do Firefox na app autenticada.
2. Executar: `await window.__atendechatOneSignalDiagnostics()`
   (se undefined em produção: confirmar Super Admin em supportMode ou a flag acima).
3. Copiar **apenas** o objeto sanitizado (já sem token/ID completos).
4. Verificar `about:serviceworkers` (registros do domínio).
5. Verificar `about:debugging#/runtime/this-firefox` → Service Workers.
6. Confirmar workers e scopes:
   - `/OneSignalSDKWorker.js` → scope `/push/onesignal/`
   - `/service-worker.js` → scope `/`
7. Confirmar `workers[].hasNativePushSubscription` (PushManager nativo, leitura).
8. Confirmar `optedIn`, `hasSubscriptionId`, `hasToken`, `tokenLength`, `lifecycleStage`.
9. Comparar com OneSignal → Audience → Subscriptions (Browser = Firefox).
10. **Não** executar `unregister` automático nem limpar storage em massa.

Matriz rápida:

| Estado | Chrome | Firefox |
|--------|--------|---------|
| Notification.permission | (manual) | (manual) |
| OneSignal permission | diag | diag |
| optedIn | diag | diag |
| Subscription ID | mascarado | mascarado |
| token | só length | só length |
| PushManager subscription | workers[] | workers[] |
| worker URL / scope | raiz + isolado | raiz + isolado |
| login concluído | externalIdApplied | externalIdApplied |
| aparece no painel | manual | manual |

Chrome e Firefox usam **Subscription IDs distintos** com o **mesmo external ID**
(`OneSignal.login(String(user.id))`). O backend envia por
`include_external_user_ids` e **não** guarda uma tabela local de device
subscriptions — não há sobrescrita de um browser pelo outro no servidor da app.

Timeouts atuais (instrumentados em `timeouts` / `waitMeta`):
- confirmação de subscription: **15000 ms** (listener `change` + microtask; poll
  de diagnóstico a cada 1s **sem** alterar o critério de sucesso);
- `optIn` / `requestPermission`: **120000 ms**.

Não aumentar timeouts sem evidência da timeline no Firefox.


## Teste dirigido (pós-deploy)

1. Abrir no **Firefox**; ativar push; copiar Subscription ID.
2. Painel → Audience → Subscriptions → confirmar Browser = Firefox.
3. Enviar teste **só** para esse ID (não validar apenas “Web Push (Chrome)”).
4. Repetir no Chrome com o ID do Chrome.

## Clientes afetados pela 2.13B (limpeza **manual** no dispositivo de teste)

Não há limpeza automática em massa.

1. Remover permissão/dados do site no Firefox (só teste).
2. Fechar abas do domínio.
3. DevTools → Application → Service Workers: rever registros do domínio.
4. Reabrir, conceder permissão, ativar push.
5. Confirmar novo Subscription ID no painel.

## Validação de workers em produção

```bash
curl -i https://app.streamhubchat.com.br/OneSignalSDKWorker.js
curl -i https://app.streamhubchat.com.br/OneSignalSDKUpdaterWorker.js
curl -i https://app.streamhubchat.com.br/service-worker.js
```

Esperado: HTTP 200, JavaScript; OneSignal com `importScripts` v16; Workbox em
`/service-worker.js`. DevTools: scopes `/` (Workbox) e `/push/onesignal/` (OneSignal).

## Troubleshooting

| Sintoma | Verificação |
|---------|-------------|
| Subscription não aparece no painel | optIn + id/token atuais; worker raiz + scope isolado |
| Teste só no Chrome | Confirmar Subscription ID do Firefox |
| Worker 404 / HTML | Nginx sem fallback SPA nos `.js` da raiz |
| Banner some sem id | Bug; sucesso exige optedIn + id/token |

## Segurança

- REST API Key só no backend; frontend só App ID.
- Sem JWT no OneSignal; logs mascaram subscription/token.
- Sem unregister global / limpeza automática de storage.

## Envio (inalterado)

`SendOneSignalPushNotificationService` → `include_external_user_ids`.
Sem tabela local de device subscriptions.
