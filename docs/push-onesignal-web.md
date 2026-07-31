# OneSignal Web Push (SDK v16)

## Versão e carregamento

- SDK: **OneSignal Web SDK v16** via CDN
  (`https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js`)
- Service workers públicos:
  - `/OneSignalSDKWorker.js`
  - `/OneSignalSDKUpdaterWorker.js`
  - Ambos fazem `importScripts` do SW oficial v16.
- App ID público vem de `GET /system-settings/public/push-config` (sem REST API Key).
- Init com `autoRegister: false` — inscrição só no fluxo explícito do utilizador.

## Permissão ≠ inscrição

| Conceito | Fonte | Significa push ativo? |
|----------|--------|------------------------|
| `Notification.permission` | Browser | Não |
| `User.PushSubscription.optedIn` | SDK v16 | Parcial |
| `User.PushSubscription.id` / `token` | SDK v16 | Canal necessário |
| **Efetivo** | `optedIn` **e** (`id` ou `token`) | **Sim** |

Estados de domínio: `unsupported`, `not_configured`, `sdk_loading`, `permission_default`, `permission_denied`, `permission_granted_unsubscribed`, `subscribing`, `subscribed`, `error`.

## Fluxo de ativação

1. Validar config (enabled + App ID).
2. Inicializar SDK uma vez (`initPromise`).
3. Se já inscrito → associar identidade e sucesso.
4. Se `denied` → orientar bloqueio do browser.
5. `User.PushSubscription.optIn()` (pede permissão se preciso **e** cria subscription).
6. Aguardar confirmação via snapshot/listener `change` (timeout limitado).
7. `OneSignal.login(userId)` + tags (`user_id`, `company_id`, `profile`, `queue_ids`).
8. Atualizar estado React — o banner some **só** em `subscribed`.

## Identidade e logout

- External ID = ID interno do utilizador (opaco).
- Backend envia com `include_external_user_ids`.
- Logout chama `OneSignal.logout()` (limpa identidade); **não** faz `optOut` da subscription física.
- Próximo login reassocia com `login`.

## Banner

- Visível em `permission_default`, `permission_granted_unsubscribed` e `error`.
- Ajuda específica em `permission_denied`.
- Não some no clique: some após confirmação de subscription (ou dismiss manual na sessão).

## Troubleshooting

| Sintoma | Verificação |
|---------|-------------|
| Permissão OK, utilizador não aparece no painel | Confirmar `optIn` + `id`/`token`; domínio do site no OneSignal |
| Worker 404 / HTML no lugar de JS | Nginx deve servir `/OneSignalSDKWorker.js` sem fallback SPA |
| App ID incorreto | Super Admin → Push settings |
| Domínio incompatível | Origem HTTPS deve coincidir com Site URL do OneSignal (`app.streamhubchat.com.br`) |
| Banner só some após F5 (legado) | Corrigido: estado reativo + opt-in confirmado |
| Teste do painel não chega | Subscription + external id do user logado |

## Segurança

- REST API Key **apenas** no backend (`SystemSettings`).
- Frontend nunca recebe a REST key no endpoint público.
- Não enviar JWT ao OneSignal.

## Arquitetura de envio

Backend usa a REST API OneSignal (`SendOneSignalPushNotificationService`). Não há tabela local de device subscriptions — a identidade no OneSignal é suficiente.
