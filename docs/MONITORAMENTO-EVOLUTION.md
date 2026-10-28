# Monitoramento Evolution — infraestrutura

Página Super Admin `/saas/evolution-monitor`. Além das conexões WhatsApp (já existentes), mostra
métricas **reais** da VPS onde a Evolution roda, o estado dos contêineres e o histórico de 7 dias.

## Arquitetura

```
VPS Evolution                                         Backend AtendeChat
┌──────────────────────────────────────┐             ┌───────────────────────────────────────┐
│ evolution-metrics-collector (systemd) │  POST /60s  │ POST /system/evolution-metrics        │
│  lê /proc, cgroup v2,                 │ ──────────► │  Bearer EVOLUTION_METRICS_INGEST_TOKEN │
│  /var/lib/docker/containers/*/        │  rede       │  validação estrita → EvolutionMetric- │
│  config.v2.json (somente leitura)     │  privada    │  Samples (retenção 7 dias)            │
└──────────────────────────────────────┘             │ GET /system/evolution-monitor (+infra) │
                                                      │ GET /system/evolution-monitor/history │
                                                      │  isAuth + isSuper                     │
                                                      └───────────────────────────────────────┘
```

- **Coletor** (`deploy/evolution-metrics-collector/`): Python 3, só biblioteca padrão, sem dependências.
  Não usa o socket do Docker nem executa comandos. Roda como root **sem capabilities**
  (`CapabilityBoundingSet=` vazio) apenas para ler os arquivos `0600` do Docker; sistema de arquivos
  somente leitura (`ProtectSystem=strict`), socket do Docker inacessível, limite de 64 MB/10% CPU.
  Envia uma amostra a cada 60 s; se o backend estiver fora, guarda até 1440 amostras (24 h) em memória
  e reenvia em lote. Reenvio é idempotente (índice único `source + collectedAt`).
- **Backend**: a ingestão tem autenticação própria (token ≥ 32 caracteres, comparação SHA-256 +
  `timingSafeEqual`) e não aceita sessão/JWT de usuário. Sem token configurado responde 503.
  Campos fora do contrato são descartados; valores fora de faixa recusam o lote (400).
- **Desatualização**: sem amostra há mais de 180 s o coletor aparece como "Desatualizado"; os valores
  ficam como última leitura conhecida e os uptimes não são extrapolados (aparecem "—").
- **Histórico**: médias de 5 min (24 h) e 30 min (7 dias). A série começa na primeira amostra real;
  janelas sem amostra ficam vazias no gráfico (sem interpolação). Retenção: job de hora em hora
  apaga amostras com mais de 7 dias.

## Métricas

| Grupo | Métrica | Origem |
|---|---|---|
| VPS | CPU % (delta de `/proc/stat` em 60 s), núcleos, load 1/5/15 | `/proc/stat`, `/proc/loadavg` |
| VPS | RAM total/usada/disponível (`MemAvailable`) | `/proc/meminfo` |
| VPS | Disco total/usado/livre de `COLLECTOR_DISK_PATH` | `statvfs` |
| VPS | Último boot e uptime | `btime` de `/proc/stat` |
| Contêiner | Estado, início (`StartedAt`), reinícios (`RestartCount`), OOM, imagem | `config.v2.json` |
| Contêiner | CPU % da VPS (delta `usage_usec`), RAM (`memory.current − inactive_file`, como `docker stats`) | cgroup v2 |
| Evolution | Versão | `GET /` da Evolution central (backend) |

O health check do Docker **não** é reportado: o Docker não grava o resultado em `config.v2.json`
(o arquivo fica com `starting`) e o coletor não usa o socket. PostgreSQL/Redis aparecem como
"Em execução" (estado real do contêiner); a Evolution API só aparece "Operacional" quando o contêiner
está em execução **e** a API respondeu ao backend.

`RestartCount` é o contador do Docker para o contêiner atual: reinícios pela política de restart
(falhas). `docker restart` manual e recriação do contêiner não somam — o "Uptime da Evolution" mostra
o início real do processo atual.

## Instalação do coletor (por VPS)

Pré-requisitos: Linux com cgroup v2 (`stat -fc %T /sys/fs/cgroup` = `cgroup2fs`), Docker com
`/var/lib/docker` e `python3` ≥ 3.6.

1. Backend: definir `EVOLUTION_METRICS_INGEST_TOKEN` (gerar com `openssl rand -hex 32`) e reiniciar.
2. VPS Evolution:
   ```bash
   install -d -m 0755 /opt/evolution-metrics-collector
   install -m 0644 deploy/evolution-metrics-collector/evolution_metrics_collector.py /opt/evolution-metrics-collector/
   install -d -m 0700 /etc/evolution-metrics-collector
   install -m 0600 deploy/evolution-metrics-collector/collector.env.example /etc/evolution-metrics-collector/collector.env
   # editar collector.env: COLLECTOR_INGEST_URL, COLLECTOR_INGEST_TOKEN, COLLECTOR_CONTAINERS
   install -m 0644 deploy/evolution-metrics-collector/evolution-metrics-collector.service /etc/systemd/system/
   systemctl daemon-reload && systemctl enable --now evolution-metrics-collector
   journalctl -u evolution-metrics-collector -n 20
   ```
3. Em ~1 minuto o painel mostra "Coletor de métricas: Operacional".

Remoção: `systemctl disable --now evolution-metrics-collector` e apagar `/opt/evolution-metrics-collector`,
`/etc/evolution-metrics-collector` e o unit. Nada no Docker ou na Evolution é alterado pela instalação.

### TESTE (AtendeChat e Evolution Pilot na mesma VPS)

- `COLLECTOR_INGEST_URL=http://127.0.0.1:8080/system/evolution-metrics` (loopback, sem exposição).
- `COLLECTOR_CONTAINERS=api=evolution-pilot-api,postgres=evolution-pilot-postgres,redis=evolution-pilot-redis`

### PRODUÇÃO (VPS Evolution dedicada 209.145.57.127 → AtendeChat 216.106.178.90 por WireGuard)

- Instalar o coletor na VPS Evolution; `COLLECTOR_INGEST_URL` deve usar o **IP do backend dentro do
  túnel** (ex.: `http://<ip-wg-do-atendechat>:8080/system/evolution-metrics`), nunca a URL pública.
- Conferir antes: o backend escuta na interface WireGuard e o firewall do AtendeChat permite a porta
  apenas a partir do IP WireGuard da VPS Evolution (`curl` de teste a partir da VPS Evolution deve
  receber 401 sem token).
- `COLLECTOR_CONTAINERS` com os nomes reais dos contêineres (`docker ps --format '{{.Names}}'`).
- Rodar a migration `20261027120000-evolution-metric-samples` (aditiva, só cria tabela/índices).

## Publicação do frontend sem indisponibilidade

`scripts/publish-frontend.sh` substitui o `npm run build` direto em `frontend/build`:

1. copia o frontend para um staging (`../atendechat-frontend-releases/.stage-*`, 0700) e compila lá;
2. valida `index.html`, `version.json` = commit e todos os scripts/estilos referenciados;
3. move para `releases/<data>-<commit>` e preserva os chunks da versão anterior;
4. troca `frontend/build` (symlink) atomicamente (`ln -s` + `mv -T`); o nginx não muda;
5. mantém as 5 últimas releases.

Na primeira execução o diretório `frontend/build` vira a release `<data>-legacy`.

```bash
cd /var/www/atendechat && git fetch && git merge --ff-only <commit>
scripts/publish-frontend.sh             # publica
scripts/publish-frontend.sh --status    # release atual e disponíveis
scripts/publish-frontend.sh --rollback  # volta para a release anterior (instantâneo)
```

Não rodar mais `npm run build` dentro de `frontend/` no servidor: com `frontend/build` como symlink,
o CRA esvaziaria a release publicada durante a compilação (mesmo comportamento antigo).
