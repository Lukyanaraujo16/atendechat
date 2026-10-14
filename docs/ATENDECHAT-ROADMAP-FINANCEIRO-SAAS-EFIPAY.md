# ROADMAP — Financeiro SaaS + Efí Pay | StreamHUB Chat

**Data:** 13/10/2026. **Base:** auditoria somente leitura do repositório (`f9d51f15`). **Status:** aprovado para implementação local/TESTE; produção requer homologação.

## Objetivo

Entregar central financeira do Super Admin (`/saas/finance`), financeiro individual no cadastro da empresa, reformulação do `/financeiro` do cliente e integração Efí Pay para Pix, boleto e cartão, preservando o funcionamento existente. Não misturar com financeiro do Estoque/Vendas nem com integrações Asaas/MK-Auth/IXC dos clientes.

## Regras comerciais aprovadas

1. Periodicidades mensal (padrão), trimestral, semestral e anual, por meses-calendário, sem somar 30 dias fixos.
2. Renovação automática **apenas** após confirmação verificável de pagamento, uma vez por fatura/ciclo, com idempotência e transação.
3. Baixa manual restrita ao Super Admin, com motivo obrigatório, data, valor, método, ator e trilha auditável. Separar pagamento externo comprovado, cortesia, ajuste de vencimento e renovação administrativa.
4. Tolerância de inadimplência padrão de 3 dias, configurável; unificar regra de UI, jobs e bloqueio sem regressões inesperadas.
5. Pix, boleto e cartão, com recorrência quando suportada pela modalidade e conta Efí. StreamHUB Chat é dono do ciclo contratual.
6. **Baixa manual sincronizada com Efí:** quando o Super Admin registrar pagamento manual comprovado, o sistema deverá refletir a baixa na cobrança Efí correspondente **se e somente se** a API da modalidade possuir operação oficial documentada de marcação de pagamento manual. Verificar por produto (Pix, boleto, cartão) antes de implementar. **Não inventar endpoint nem simular Pix pago.** Quando indisponível, registrar `paid_offline` local, preservar status externo verdadeiro, mostrar pendência/divergência, permitir tratamento externo apropriado (p.ex. cancelamento somente quando correto e suportado) e conciliação. Falha de sincronização nunca deve aparecer como sucesso; retries idempotentes e auditados.
7. Cortesia e renovação administrativa não contam como dinheiro recebido. Histórico legado sem comprovante não deve ganhar `paidAt`, método ou txid inventados.
8. MRR/ARR são valores recorrentes contratados normalizados; faturamento são faturas emitidas; recebimento são pagamentos confirmados; inadimplência é saldo vencido. Evitar dupla contagem.

## Arquitetura conceitual

Preservar `Company`, `Plan`, `Invoices` e `CompanyLogs`. Evoluir gradualmente com entidades equivalentes a `SaaSSubscription`/estado comercial, `Invoice` enriquecida (competência, snapshots, status), `PaymentAttempt`/`GatewayCharge` (IDs externos), `Payment` (confirmação), `FinancialEvent` append-only (auditoria), `SubscriptionRenewal` (idempotência) e inbox/outbox de webhooks/conciliação. Nomes reais seguem convenções do projeto. **Não ativar cegamente a tabela `Subscriptions` órfã.** Migrações aditivas, sem backfill especulativo; legados `legacy_unknown`.

## Marcos de implementação e aceite

### Marco 0 — Contratos Efí e desenho técnico
- Verificar na documentação oficial vigente: autenticação, ambientes, Pix, boleto, cartão, recorrência, webhooks, cancelamento, estorno e **baixa manual externa**.
- Matriz por modalidade: emitir, consultar, notificar, marcar pago manualmente, cancelar, estornar, recorrência; classificar suportado/não suportado/não confirmado, com links oficiais.
- Definir estratégia de divergência local/externa para modalidades sem baixa manual. Não inventar APIs. Não usar credenciais reais.
- **Aceite:** contratos e limites documentados.

### Marco 1 — Segurança crítica
- Restringir `PUT /invoices/:id` para impedir usuário tenant de marcar `paid`; criar operações autorizadas específicas.
- Proteger `POST /subscription/create/webhook` de configuração aberta; validar notificações por mecanismo oficial, sem aceitar payload isolado como prova.
- Remover `sandbox:false` fixo e separar ambientes/credenciais com defaults seguros.
- Testar spoof, replay, duplicidade, cross-tenant e `super`/`superadmin`.
- Flags de emissão/renovação automática desligadas até homologação.
- **Aceite:** nenhuma baixa arbitrária ou renovação dupla; checkout atual preservado.

### Marco 2 — Fundação financeira
- Migrações aditivas, snapshots de fatura, competência, pagamentos, tentativas, eventos, referências Efí, datas e origens.
- Gerador de faturas sem duplicidade por empresa/ciclo, com constraints/locks quando viável.
- Preservar todas as faturas, datas e logs existentes; não inferir pagamento por renovação manual.
- **Aceite:** histórico preservado, testes de migração e dados novos completos.

### Marco 3 — Motor único de renovação e baixa
- Unificar cálculo de renovação por recorrência (mensal/trimestral/semestral/anual) com meses-calendário.
- Comandos separados: confirmar pagamento gateway, registrar pagamento manual, conceder cortesia, ajustar vencimento, cancelar fatura, estornar quando aplicável.
- Baixa manual com confirmação, motivo, valor, meio, data e ator; tentativa de baixa Efí **apenas se suportada oficialmente**, status de sincronização, erro visível, retry seguro e reconciliação.
- Renovação idempotente vinculada ao ciclo/fatura, sem estender duas vezes.
- **Aceite:** pagamentos Pix/manual confirmados renovam uma vez; cortesia não é receita; falha externa visível.

### Marco 4 — Financeiro individual no cadastro de empresa
- Seção `Financeiro` no `CompaniesManager`/`CompanyForm` existente; deep-link `?focus=<id>&section=finance`.
- Resumo (plano, contratado, vencimento, emitido, recebido, aberto, vencido), faturas, pagamentos, timeline, renovações, baixa manual e status externo Efí.
- Endpoints Super por companyId sem depender do companyId da sessão tenant; filtros e paginação.
- **Aceite:** histórico por empresa e isolamento seguro.

### Marco 5 — Central `/saas/finance`
- KPIs MRR/ARR, faturamento, recebido, a receber, inadimplência, vencimentos, evolução e distribuição por planos.
- Faturas/pagamentos paginados, filtros por período/empresa/plano/status/método/competência; detalhes e link para empresa; exportação segura quando viável.
- **Aceite:** números conciliam com base real; cortesia e renovação manual não viram recebimento.

### Marco 6 — Financeiro do cliente
- Reformular `/financeiro`: resumo assinatura, próximo vencimento, faturas pagas/pendentes/vencidas, detalhes, pagamentos, comprovantes quando disponíveis, checkout por meios habilitados.
- Mobile cards, estados vazios/loading/erro, acessibilidade, permissões `finance.subscription`/`finance.invoices`.
- **Aceite:** UX responsiva, dados apenas da própria empresa, sem comandos de baixa.

### Marco 7 — Integração Efí expandida
- Fortalecer Pix atual; integrar boleto e cartão com contratos separados da API de Cobranças; credenciais/ambientes isolados.
- Persistir txid/chargeId, status, notificações autenticadas, consulta de confirmação, tratamento de pagamento tardio e duplicado.
- Recorrência nativa ou Pix Automático apenas se habilitados/documentados; caso contrário, emissão por ciclo interna.
- **Baixa manual externa:** operação oficial por modalidade se existir; se não, manter baixa local transparente, status externo real e pendência de conciliação, sem falsificar pagamento.
- **Aceite:** testes de homologação por modalidade; sem cobrança real involuntária.

### Marco 8 — Conciliação, relatórios e hardening
- Jobs idempotentes, retries limitados, fila de pendências, alertas, auditoria sem segredos.
- Testes de concorrência, webhook repetido/fora de ordem, cross-tenant, baixa manual, estorno, cancelamento, atraso, período, timezone, arredondamento, falha Efí.
- Performance/índices, exportação, checklist de migrações, backup, rollback, flags e observabilidade.
- **Aceite:** TESTE homologado antes de qualquer promoção à produção.

## Regras de execução Cursor

- Implementar sequencialmente de forma autônoma, sem pedir autorização a cada arquivo; parar apenas em bloqueios reais de negócio, credenciais ou efeitos financeiros externos.
- Não realizar SSH, deploy, cobranças reais, alterações financeiras em produção, commit ou push. Usuário faz GitHub Desktop e deploy pelo Super Admin.
- Testes e builds direcionados, sem auditorias repetitivas; subagentes se úteis, sem sobreposição.
- Se contrato Efí não confirmado, documentar, manter funcionalidade desativada e seguir com os demais marcos. Nunca supor endpoint.
- Entregar relatório consolidado por marco e final, arquivos, migrations, testes, pendências e instruções de homologação.
- Fluxo obrigatório: implementação local → deploy TESTE autorizado pelo usuário → homologação integral → deploy PRODUÇÃO autorizado.

## Riscos conhecidos da auditoria

- `Invoices` possui apenas `id/detail/status/value/dueDate/companyId` e timestamps.
- `PUT /invoices/:id` com autenticação insuficiente; webhook de configuração aberto; secret opcional; replay de webhook pode somar +30 dias.
- `Companies.dueDate` é fonte operacional; renovação admin, Pix e edição manual têm semânticas divergentes.
- Tabela `Subscriptions` não opera no fluxo atual; checkout Pix Efí já existe via SDK Gerencianet.
- Cron pode duplicar faturas; histórico de pagamentos antigos não permite reconstrução confiável.

**Regra de ouro:** jamais declarar cobrança Efí como paga manualmente sem operação oficial confirmada; jamais declarar sincronização bem-sucedida se houve apenas baixa local.
