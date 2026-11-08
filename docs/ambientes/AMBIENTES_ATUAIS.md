# Ambientes atuais (TESTE e PRODUÇÃO) — informação específica

Este arquivo concentra dados **dos ambientes que já existem** (IPs, hostnames, topologia).
A documentação genérica (`docs/MANUAL_INSTALACAO.md`, `docs/MANUTENCAO_TECNICA.md`,
`docs/MONITORAMENTO-EVOLUTION.md`) usa apenas exemplos/placeholders.

> Não use estes servidores para homologar o instalador nem para testes destrutivos.
> Confira sempre `hostname` antes de executar qualquer comando em um deles.
> Os valores abaixo refletem os registros do projeto até 2026-11 e podem estar desatualizados:
> confirme com o proprietário antes de agir.

## TESTE

| Item | Valor |
|---|---|
| Hostname | `vmi3163669` |
| IP público | `89.117.79.221` |
| API | `https://api.teste.streamhubchat.com.br` |
| Repositório | `/var/www/atendechat` |
| `STREAMHUB_RUNTIME_ENV` | `test` (slot Efí `homologation`) |
| Evolution | na mesma VPS (“Evolution Pilot”), contêineres `evolution-pilot-api`, `evolution-pilot-postgres`, `evolution-pilot-redis` |
| Coletor de métricas | `COLLECTOR_INGEST_URL=http://127.0.0.1:8080/system/evolution-metrics` (loopback) |

## PRODUÇÃO

| Item | Valor |
|---|---|
| Hostname (app) | `chi-sm5039mp-h8tnr-4-3` |
| IP público (app) | `216.106.178.90` |
| Painel / API | `https://app.streamhubchat.com.br` / `https://api.streamhubchat.com.br` |
| Evolution | VPS dedicada `209.145.57.127`, ligada ao app por **WireGuard** |
| Coletor de métricas | na VPS Evolution; `COLLECTOR_INGEST_URL` usa o IP do backend **dentro do túnel** (nunca a URL pública); firewall do app libera a porta só para o IP WireGuard da VPS Evolution (`curl` sem token deve retornar 401) |
| Site institucional | `streamhubchat.com.br` resolvia em 2026-11-02 para o mesmo IP do app (sem HTTPS; `www` sem registro) |

Observação: a produção atual **não** foi instalada pelo `install.sh` novo; a Evolution de produção
roda em VPS separada (equivale à opção “servidor Evolution externo” do instalador).

## Documentos específicos destes ambientes

| Documento | Conteúdo |
|---|---|
| `docs/FASE-8.3-B3-EFI/IMPLANTACAO-TESTE.md`, `IMPLANTACAO-PRODUCAO.md`, `RELATORIO-HOMOLOGACAO.md` | roteiros e registros da implantação Efí nos ambientes atuais (usam o hostname como trava de segurança) |
| `docs/FRONTEND_CACHE_AND_VERSION.md` | auditoria de cache feita em `app.streamhubchat.com.br` |
| `site/README.md` | publicação do site institucional |
