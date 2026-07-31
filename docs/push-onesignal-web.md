# OneSignal Web Push (SDK v16)

## Versão e carregamento

- SDK: **OneSignal Web SDK v16** via CDN
  (`https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js`)
- Carregamento dinâmico + `OneSignalDeferred` + `initPromise` (singleton).
- App ID público via `GET /system-settings/public/push-config` (sem REST API Key).
- Init com `autoRegister: false` — inscrição só no fluxo explícito do utilizador.

## Arquitetura de service workers (Fase 2.13B)

| Papel | URL | Scope |
|-------|-----|-------|
| PWA / Workbox | `/service-worker.js` | `/` |
| OneSignal | `/push/onesignal/OneSignalSDKWorker.js` | `/push/onesignal/` |
| OneSignal updater | `/push/onesignal/OneSignalSDKUpdaterWorker.js` | `/push/onesignal/` |

Motivo da separação: o build `react-scripts` publica Workbox real em `/service-worker.js`.
Registrar OneSignal também no scope `/` disputava o mesmo controlador e podia
criar inscrição no painel sem exibir a notificação no browser.

Arquivos legados na raiz (`/OneSignalSDKWorker.js`, updater) permanecem **temporariamente**
como compatibilidade; na inicialização o cliente desregistra **somente** esses scripts
raiz (nunca o Workbox) e passa a usar o scope isolado.

Nota: o ficheiro em `public/service-worker.js` é mínimo; o artefacto de **produção**
gerado pelo CRA/Workbox é diferente e é o que o nginx serve.

## Permissão ≠ inscrição

| Conceito | Fonte | Significa push ativo? |
|----------|--------|------------------------|
| `Notification.permission` | Browser | Não |
| `User.PushSubscription.optedIn` | SDK v16 | Parcial |
| `User.PushSubscription.id` / `token` | SDK v16 | Canal necessário |
| **Efetivo** | `optedIn` **e** (`id` ou `token`) | **Sim** |

Estados de domínio: `unsupported`, `not_configured`, `sdk_loading`, `permission_default`,
`permission_denied`, `permission_granted_unsubscribed`, `subscribing`, `subscribed`, `error`.

## Fluxo de ativação

1. Transição: unregister seletivo de OneSignal legado na raiz.
2. Validar config (enabled + App ID).
3. Inicializar SDK uma vez (`initPromise`) com path/scope isolados.
4. Se já inscrito → associar identidade e sucesso.
5. Se `denied` → orientar bloqueio do browser.
6. `User.PushSubscription.optIn()`.
7. Aguardar confirmação (`optedIn` + id/token).
8. `OneSignal.login(userId)` + tags.
9. Banner some **só** em `subscribed`.

## Identidade por navegador

- Cada browser/dispositivo gera **Subscription ID** próprio (Chrome ≠ Firefox).
- Todos usam o mesmo external ID: `String(user.id)`.
- Backend envia com `include_external_user_ids` — um user pode receber em vários browsers.
- Logout: `OneSignal.logout()` (limpa identidade); **não** faz `optOut` físico.

## Diagnóstico técnico

Em desenvolvimento: `window.__atendechatOneSignalDiagnostics()` (sem secrets).
Retorna browser, permissões, optedIn, id mascarado, workers (scriptURL/scope/state).

## Teste dirigido (pós-deploy)

1. Abrir no **Firefox** (e depois repetir no Chrome).
2. Ativar push; confirmar `optedIn` + Subscription ID.
3. No painel OneSignal → Audience → Subscriptions, localizar **esse** ID.
4. Confirmar Browser = Firefox (não validar só "Web Push (Chrome)").
5. Marcar Test Subscription e enviar **só** para ela.
6. Conferir relatório Sent/Delivered/Failed.
7. Repetir com aba aberta, Firefox em background, e no Chrome separadamente.

## Validação de workers em produção

```bash
curl -i https://app.streamhubchat.com.br/push/onesignal/OneSignalSDKWorker.js
curl -i https://app.streamhubchat.com.br/push/onesignal/OneSignalSDKUpdaterWorker.js
curl -i https://app.streamhubchat.com.br/service-worker.js
```

Esperado: HTTP 200, `Content-Type` JavaScript, corpo `importScripts` OneSignal v16
nos paths `/push/onesignal/*`; Workbox em `/service-worker.js`.

DevTools → Application → Service Workers: scopes distintos (`/` e `/push/onesignal/`).

## Troubleshooting

| Sintoma | Verificação |
|---------|-------------|
| Teste chega só no Chrome | Confirmar Subscription ID do Firefox no painel |
| Permissão OK, sem display | Workers concorrentes no mesmo scope; limpar legado OneSignal raiz |
| Worker 404 / HTML | Nginx: servir `/push/onesignal/*.js` sem fallback SPA |
| App ID incorreto | Super Admin → Push settings |
| Domínio incompatível | Site URL OneSignal = `https://app.streamhubchat.com.br` |

## Limpeza manual controlada (dispositivo de teste)

1. Anotar Subscription ID atual.
2. Remover permissão do site (opcional).
3. Em Application → Service Workers, unregister **apenas** OneSignal legado na raiz se ainda existir.
4. Não remover Workbox a menos que esteja a depurar PWA.
5. Recarregar, ativar push, confirmar novo ID sob scope `/push/onesignal/`.

## Segurança

- REST API Key **apenas** no backend.
- Frontend: só App ID público.
- Sem JWT no OneSignal; logs mascaram subscription/token.

## Arquitetura de envio (inalterada nesta fase)

Backend: `SendOneSignalPushNotificationService` → `include_external_user_ids`.
Sem tabela local de device subscriptions. Push individual por utilizador continua possível
via external ID partilhado entre as subscriptions ativas desse user.
