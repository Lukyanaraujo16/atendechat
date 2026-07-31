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
4. Se já inscrito → `login(userId)` e sucesso.
5. Se `denied` → orientar bloqueio.
6. `optIn()` → aguardar confirmação.
7. `login(userId)` + tags.
8. Banner some **só** em `subscribed`.

## Identidade por navegador

- Cada browser gera **Subscription ID** próprio (Chrome ≠ Firefox).
- External ID partilhado: `String(user.id)`.
- Backend: `include_external_user_ids` (inalterado nesta fase).
- Logout: `OneSignal.logout()`; **sem** `optOut` físico.

## Diagnóstico

Em desenvolvimento: `window.__atendechatOneSignalDiagnostics()`.
Inclui browser (Firefox/Chrome), permissões, optedIn, id mascarado, lista de workers.

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
