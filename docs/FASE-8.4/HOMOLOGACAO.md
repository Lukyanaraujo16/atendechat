# Fase 8.4 — Deploy em TESTE, homologação e promoção para PRODUÇÃO

Nada deste documento foi executado em TESTE ou PRODUÇÃO pela execução autônoma. Produção **não** está corrigida até
deploy + homologação reais.

## 1. Deploy — auditoria do procedimento real e sequência segura (TESTE e depois PRODUÇÃO)

### 1.1 O que o procedimento atual faz (auditado no repositório, não executado)
- Processo do backend: unit systemd `atendechat-backend` criada por `install.sh` —
  `ExecStart=/usr/bin/node dist/server.js`, `Restart=always`, `RestartSec=10`. **Não** usa nodemon/pm2 em produção
  (o script `npm start` = `nodemon dist/server.js` é só para uso manual; com nodemon, qualquer rebuild do `dist/`
  reiniciaria o processo automaticamente — não usar `npm start` no servidor).
- Atualização documentada: `git pull` → `MINIMAL_UPDATE=1 ./install.sh`, que executa, **com o backend antigo rodando**:
  `npm install` → `npm run build` (apaga `dist/` e recompila) → ownership PostgreSQL → `npx sequelize db:migrate` →
  build do frontend → `systemctl restart atendechat-backend` → reload do Nginx. `update-server-ip.sh` segue a mesma ordem.
- `npm run db:migrate` (package.json) **recompila antes de migrar**; `npx sequelize db:migrate` só migra (usa `dist/`).
  Nenhum comando de build/migration reinicia o serviço diretamente.
- Ferramentas instaladas pelo `install.sh` (pm2 global) não gerenciam o backend nesta instalação; o instalador antigo
  `instalador-main/` usa pm2 (`pm2 stop` → build → migrate → `pm2 start`) — confirmar qual dos dois está em uso em cada VPS.

### 1.2 Risco identificado
Entre `npm run build` e `db:migrate` o processo antigo continua ativo com `dist/` sendo apagado e recompilado.
O backend tem ~259 `await import(...)` em runtime (inclusive crons a cada 15 min). Se o processo falhar nessa janela
(import de módulo ausente, OOM durante o `tsc`), o systemd o reinicia em 10 s **com o código novo e o schema antigo**:
toda leitura de `Company` falha (`column "tradeName" does not exist`, reproduzido em banco isolado) até a migration rodar.
Também pode haver mistura de versões em módulos carregados tardiamente.

### 1.3 Sequência operacional recomendada (manual, com parada curta)
Executar como o usuário da aplicação na VPS (TESTE primeiro). Não usar `MINIMAL_UPDATE` nesta release.
1. Pré-checagens (somente leitura): `systemctl status atendechat-backend`; espaço em disco; anotar `git rev-parse HEAD`;
   confirmar em `SequelizeMeta` que `20261013120000-saas-finance-foundation`, `20261015120000-platform-efi-configs` e
   `20261015140000-platform-efi-admin-flags` já constam (se não constarem, elas rodarão junto — revisar antes).
2. Backup: `pg_dump -Fc` do banco da aplicação, guardado fora do diretório do projeto. Conferir o tamanho do arquivo.
3. Código: `git fetch` + checkout do commit homologado (nunca `git pull` às cegas em produção).
4. Dependências: `cd backend && npm install --production=false` (com o serviço ainda no ar — não toca em `dist/`).
5. **Parar o backend**: `sudo systemctl stop atendechat-backend` (início da janela de indisponibilidade da API).
6. Build: `npm run build`; conferir `dist/server.js`, `dist/database/migrations/20261017120000-company-registration-fields.js`
   `dist/database/migrations/20261018120000-saas-historical-review.js` (Fase 8.4-F) e
   `dist/database/migrations/20261019120000-notifications-nullable-company-scope.js` (fechamento final).
7. Migration: `npx sequelize db:migrate` (não `npm run db:migrate`, que recompila de novo).
   Conferir: `SELECT name FROM "SequelizeMeta" WHERE name LIKE '2026101%';` — devem constar **as três**:
   `20261017120000-company-registration-fields`, `20261018120000-saas-historical-review`,
   `20261019120000-notifications-nullable-company-scope`. E: 11 colunas novas em `Companies`, tabela
   `SaaSInvoiceHistoricalReviews`, `SaaSPayments.paidAt` aceitando NULL, `UserNotifications.companyId` e
   `UserNotificationPreferences.companyId` aceitando NULL (`information_schema.columns.is_nullable = 'YES'`).
   Se falhar: **não** iniciar o backend novo — ver rollback.
8. **Iniciar o backend**: `sudo systemctl start atendechat-backend`; `journalctl -u atendechat-backend -n 100` sem
   `does not exist`/`ERR_INTERNAL`; `curl` no health/rota pública habitual.
9. Frontend: `cd frontend && npm install && npm run build`; `sudo nginx -t && sudo systemctl reload nginx`.
   (Frontend novo exige backend novo: `POST /companies/:id/renew` passou a exigir `reason`; rotas novas de faturas/usuários.)
10. Smoke test Super Admin (sem alterar dados): abrir Empresas → uma empresa → guias; abrir prévia de renovação e cancelar;
    listar faturas. Monitorar logs por 24 h (`ERR_INTERNAL_SERVER_ERROR`, `[webhook] processing_failed`, `renewal_`).

Variáveis: nenhuma nova obrigatória. Manter `SAAS_BILLING_AUTO_INVOICE` como está (OFF). **Não definir**
`BILLING_AUTOMATION_NORMALIZED_DATES` (ausente = job de bloqueio com o comportamento atual). Opcional:
`SAAS_HISTORICAL_REFERENCE_DATE` (padrão 2026-10-17). Não alterar credenciais Efí.
Nada no deploy altera, cancela ou ajusta faturas e vencimentos existentes (a migration só adiciona colunas nullable).

### 1.4 Rollback
- Falha antes do passo 7: `git checkout <commit anterior>`, `npm run build`, `systemctl start`.
- Falha após a migration: as migrations são aditivas e compatíveis com o código anterior (o model antigo não lê as colunas
  novas; `paidAt` aceitar NULL não afeta quem sempre grava data) → reverter só o código (`git checkout` anterior, build,
  start). Não rodar `db:migrate:undo` em produção. Observação: o undo de `20261018120000` é **recusado por desenho** se já
  existir pagamento histórico com data desconhecida (evita perder dados) — mais um motivo para reverter só o código.
- Se o código anterior for reativado depois de Alex registrar pagamentos sem data, telas antigas podem exibir data
  inválida nesses pagamentos (somente exibição; nenhum dado é perdido).
- Restaurar o `pg_dump` apenas em caso de corrupção comprovada, com decisão do responsável.

## 2. Checklist de homologação em TESTE (dados fictícios)

Preparar empresas fictícias:
- A: vencida há ~10 dias, `status=false`, com fatura aberta do ciclo.
- B: vencida há ~70 dias, sem fatura aberta.
- C: ativa, vencimento futuro.
- D: com 3+ faturas antigas abertas (legado, `cycleKey` nulo).
- E: bloqueada manualmente pelo Super Admin (log `block`).

| # | Cenário | Esperado |
|---|---|---|
| 1 | Renovar A pela listagem e pela página | Diálogo mostra vencimento atual, período e novo vencimento; exige justificativa; A fica em dia, `status=true`; acesso do tenant volta (sem banner de inadimplência; envio de mensagens liberado) |
| 2 | Clique duplo / duas abas na renovação | Uma única extensão; segunda tentativa recebe aviso "vencimento já foi alterado" |
| 3 | Baixa manual integral da fatura de A | Fatura paga, pagamento em "Pagamentos", evento no ledger, vencimento estendido preservando o dia contratual |
| 4 | Baixa com valor menor/maior | Recusada com mensagem clara; nada gravado |
| 5 | Repetir a baixa da mesma fatura | Recusada ("já está paga"), sem nova renovação |
| 6 | Renovar A administrativamente e depois pagar a fatura do mesmo ciclo | Pagamento registrado, aviso "período já coberto", vencimento **não** estendido de novo |
| 7 | Cortesia | Não aparece como receita nos totais; aparece em cortesias |
| 8 | B: gerar fatura manual, pagar | Fatura criada sem cobrança Efí; segunda geração do mesmo ciclo recusada (duplicidade) |
| 9 | D: identificar legado, cancelar uma com justificativa | Chip "Legado"; cancelamento auditado; nada cancelado automaticamente |
| 10 | Editar fatura aberta sem pagamento; tentar editar paga | Edição auditada (antes/depois); paga recusada |
| 11 | E: registrar pagamento | Pagamento ok; empresa **continua** bloqueada (bloqueio não financeiro) |
| 12 | Pix sandbox: pagar, reenviar o mesmo webhook | 1 pagamento, 1 renovação; segundo webhook idempotente |
| 13 | Webhook com falha forçada (ex.: banco indisponível) | Resposta 500 (Efí reenvia) — não 200 |
| 14 | Usuário comum chamando rotas `/saas/...`, `/companies/:id/renew`, `/saas/companies/:id/users` | 403 |
| 15 | Página Empresas | Listagem → página individual por guias; Voltar; alerta de alterações não salvas; URL antiga `?focus=ID&section=finance` redireciona |
| 16 | Cadastro: CPF/CNPJ inválido, CEP via ViaCEP, empresa antiga incompleta | Validação clara; endereço preenchido; empresa antiga salva sem exigir novos campos |
| 17 | Usuários: criar, editar, desativar último admin, trocar senha | Último admin protegido (409); senha nunca exibida; usuário obrigado a trocar a senha |
| 18 | Funcionalidades | Recurso bloqueado pelo plano não é habilitado automaticamente |
| 19 | Mobile (≤ 400px) | Guias roláveis; tabelas viram cartões/rolam; diálogos utilizáveis |
| 20 | Regressão | Checkout Pix do tenant, página Financeiro do tenant, Estoque/Vendas, atendimento intactos |

## 3. Promoção segura para PRODUÇÃO

1. Homologação do item 2 aprovada pelo responsável, com evidências (prints/logs).
2. Janela de baixo uso; backup; migrations; deploy backend+frontend; smoke test com conta Super Admin:
   abrir uma empresa, abrir a prévia de renovação (sem confirmar), listar faturas.
3. Monitorar logs por 24 h: `ERR_INTERNAL_SERVER_ERROR`, `[webhook] processing_failed`, `renewal_`.
4. Só então executar a recuperação dos clientes (seção 4), uma empresa por vez.

## 4. Recuperação dos clientes afetados (após deploy em produção)

Somente pela interface, com justificativa — nunca UPDATE direto.
1. Levantar (somente leitura) empresas vencidas/bloqueadas e quais têm fatura aberta.
2. Cliente que **pagou**: abrir a fatura do ciclo (ou gerar, se não houver) → Registrar pagamento com data e forma reais.
3. Cliente com **acordo comercial sem pagamento**: Renovar assinatura (justificativa) — não gera receita nem quita fatura.
4. **Pix confirmados na Efí e não registrados** (o webhook respondia 200 em falha desde o deploy de `b2a3f30`) —
   procedimento documentado, **não executado** nesta fase:
   a. Data de corte: data/hora real do deploy de `b2a3f30` em produção (confirmar no histórico da VPS).
   b. Levantamento no sistema (somente leitura): faturas com `externalTxid` preenchido e `status <> 'paid'` criadas desde o
      corte; logs `[webhook] processing_failed` com `txid` no mesmo período.
   c. Para cada `txid`, consultar a cobrança na Efí (painel ou consulta de cobrança Pix, conta de produção, por pessoa
      autorizada) e registrar: status, valor pago, data/hora, `endToEndId`. Só seguir se status `CONCLUIDA` e valor = valor da fatura.
   d. Registrar no sistema, **pela interface**, a baixa manual da fatura correspondente: método Pix, data real do
      pagamento, valor exato, justificativa "Pix confirmado na Efí — txid final XXXX / E2E final YYYY".
      O pagamento manual herda o `txid` da fatura; um webhook posterior desse `txid` é reconhecido como já aplicado
      (testado: sem segundo pagamento nem segunda renovação). O item de conciliação "Pix sem baixa na Efí" gerado
      automaticamente deve ser resolvido com a referência da consulta.
   e. Alternativa: se a Efí oferecer reenvio de notificação para o `txid`, reenviar **após** o deploy da correção —
      o processamento é idempotente por `txid` e por fatura. Escolher um caminho por `txid` e registrar qual.
   f. Divergências (valor diferente, fatura cancelada, fatura inexistente): não dar baixa; registrar para decisão do responsável.
5. Faturas antigas abertas: decisão comercial caso a caso (cobrar ou cancelar com justificativa).
   Nenhum cancelamento, ajuste em massa de vencimentos ou alteração automática de faturas é feito no deploy.


---

## 5. Homologação da Fase 8.4-F (em TESTE, dados fictícios)

Preparar, além das empresas da seção 2: F) empresa com 3 faturas antigas abertas (criadas antes de 17/10/2026), já renovada
administrativamente além desses ciclos; G) empresa com fatura antiga que teve Pix gerado na Efí sandbox e não foi paga.

| # | Cenário | Esperado |
|---|---|---|
| F1 | Abrir empresa → Financeiro | Central de assinatura com 3 status separados; empresa ativa e vencida aparece como "Operação: Ativa / Assinatura: Vencida" |
| F2 | Linha do tempo | Eventos em ordem, com responsável e fatura; aviso de "sem histórico detalhado" antes do primeiro evento; "Carregar mais" |
| F3 | Revisão de históricas (menu) | Faturas de F listadas com indícios; regularizar 1 como pagamento histórico com data real, 1 com "Não sei a data", 1 como indevida |
| F4 | Conferir após F3 | Vencimento e status de F **inalterados** (nenhuma renovação); receita aumentou só pelos pagamentos históricos; pendências caíram |
| F5 | Regularizar a mesma fatura de novo / duas abas | Recusado ("já revisada"); um único efeito |
| F6 | G: regularizar | Exige confirmar que o Pix não foi pago na Efí; depois simular pagamento do Pix no sandbox → item de conciliação "possível pagamento em duplicidade", sem renovar nem duplicar receita |
| F7 | Registrar pagamento atual com prévia | Prévia mostra vencimento anterior/novo, receita, desbloqueio; alterar o vencimento em outra aba antes de confirmar → "os dados mudaram", nada gravado |
| F8 | Pagamento de fatura antiga pelo fluxo atual | Prévia alerta "fatura antiga" e oferece "Regularizar como histórica" |
| F9 | Renovação com bloqueio manual | Prévia indica se desbloqueia; pagamento não desbloqueia bloqueio manual |
| F10 | Listagem: filtros Em dia / Vencido / Em carência / Bloqueado financeiramente / manualmente / Históricas | Contagens coerentes com as empresas de teste; ações "Financeiro" e "Regularizar históricas" levam às telas certas; "Cobrar" só abre o lembrete |
| F11 | Automação de cobrança → Simulação | Resumo e tabela coerentes; aviso de somente leitura; nenhum botão de execução; banco inalterado após abrir a tela |
| F12 | Usuário comum nos endpoints novos | 401 "Acesso não permitido" |
| F13 | Alex executa o GUIA-ALEX-FINANCEIRO.md de ponta a ponta sem ajuda | Aceite registrado no CHECKLIST-TRANSFERENCIA-ALEX.md |

Separação obrigatória: a implantação técnica **não** regulariza nada. A regularização das faturas reais é feita pelo
Alex, em produção, depois do deploy homologado, uma fatura por vez.


---

## 6. Fechamento final — configuração e checklist adicional

### Migrations obrigatórias (todas ANTES de iniciar o backend novo)
| Ordem | Migration | Efeito | Reversão |
|---|---|---|---|
| 1 | `20261017120000-company-registration-fields` | 11 colunas cadastrais nullable em `Companies` | não reverter em produção (reverter só código) |
| 2 | `20261018120000-saas-historical-review` | tabela de revisões históricas; `SaaSPayments.paidAt` nullable | undo recusado se houver pagamento sem data |
| 3 | `20261019120000-notifications-nullable-company-scope` | `companyId` nullable em notificações/preferências (âmbito plataforma) | no-op (estado pretendido) |
`npx sequelize db:migrate` aplica as três em ordem, no passo 7 de §1.3. Todas são idempotentes e compatíveis com o código anterior.

### Flag de bloqueios automáticos
- `BILLING_AUTOMATION_NORMALIZED_DATES`: **não definir** no `.env` de TESTE nem de PRODUÇÃO (ausente = `false`).
- Conferência: em Automação de cobrança → Simulação, o "Modo do job" deve aparecer como **legado**.
- Ativação futura somente após decisão comercial, medindo antes o impacto em `summary.wouldBlock` da simulação.

### Rollback de código (resumo operacional)
1. `sudo systemctl stop atendechat-backend`
2. `git checkout <commit anterior anotado no passo 1 de §1.3>`
3. `cd backend && npm install --production=false && npm run build`
4. `sudo systemctl start atendechat-backend` e conferir logs
5. Frontend: `cd frontend && npm install && npm run build && sudo nginx -t && sudo systemctl reload nginx`
Não executar `db:migrate:undo`. As três migrations permanecem (compatíveis com o código anterior).

### Checklist adicional de homologação (fechamento)
| # | Cenário | Esperado |
|---|---|---|
| H1 | Renovar empresa de teste (logado como Super Admin) | Aparece notificação "renovação" no sino do Super Admin; usuário comum da empresa **não** vê |
| H2 | Super Admin altera preferências de notificação (âmbito plataforma) | Salva sem erro |
| H3 | Notificações de ticket/mensagem para usuário comum | Continuam chegando como antes |
| H4 | Empresa de teste com fuso America/Manaus: renovar 2× | Dia do vencimento preservado (ex.: 05 → 05) |
| H5 | Página da empresa | Cabeçalho mostra o plano correto; aba Usuários mostra o admin principal |
| H6 | Fila "Revisão de históricas" e contadores (menu, Financeiro, listagem) | Números iguais à quantidade de itens da fila "Não resolvidas" |
| H7 | Simulação de bloqueios | Modo **legado**; banco inalterado após abrir a tela |
| H8 | Logs do backend após 24 h | Sem `violates not-null` em `UserNotifications`, sem `ERR_INTERNAL_SERVER_ERROR` novos |
