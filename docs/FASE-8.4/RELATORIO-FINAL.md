# Fase 8.4 — Relatório final

Execução autônoma local em 2026-10-17. **Nada foi publicado**: sem commit, push, deploy, acesso a TESTE/PRODUÇÃO
ou a bancos compartilhados. Produção **não está corrigida** até deploy e homologação reais (HOMOLOGACAO.md).

## 1. Resumo executivo
- Causa raiz do incidente **confirmada em Postgres real** e corrigida; o mesmo conjunto de testes de integração que
  falha 23 vezes no código anterior passa no código novo.
- Baixa manual, cortesia, renovação administrativa, ajuste de vencimento e confirmação Pix voltam a funcionar, com
  idempotência por fatura, proteção contra clique duplo/concorrência no backend e webhook que não confirma falhas.
- Gestão de Empresas reestruturada: listagem + página individual com guias Cadastro, Plano e operação, Financeiro,
  Funcionalidades e Usuários.

## 2. Causa raiz
`Companies.dueDate` é `timestamptz` → `Date` em runtime → gravado em `SaaSSubscriptionRenewals.previousDueDate`
(`STRING(16)`) → `SequelizeValidationError: string violation: previousDueDate cannot be an array or an object` → HTTP 500
e rollback. Introduzido em `b2a3f30` (motor único de renovação). Testes unitários existentes mockavam o motor.
Agravantes: webhook Pix respondia 200 em falha (pagamentos podem ter sido perdidos); geração automática de faturas
desligada por flag (empresas sem fatura aberta não conseguiam baixa).

## 3. Correções financeiras
Ver DECISOES.md D1–D11: normalização de datas (`helpers/saasDueDate.ts`); vencimento que preserva o dia contratual e
nunca fica no passado; chave `renew-invoice:<id>`; lock antes da idempotência; "período já coberto"; justificativa e
`expectedCurrentDueDate` na renovação administrativa; valor exato no pagamento; desbloqueio que respeita bloqueio manual;
auditoria pós-commit; webhook 500 em falha; geração/edição/cancelamento auditados de faturas; resumo com totais.

## 4. Nova navegação
`/saas/companies` (listagem) → `/saas/companies/:id/:tab` (`cadastro`, `plano`, `financeiro`, `funcionalidades`, `usuarios`),
Voltar, Cancelar alterações, alerta de alterações não salvas, redirecionamento dos links antigos.

## 5. Funcionalidades administrativas
Cadastro completo com máscaras, CPF/CNPJ, ViaCEP; plano e operação em seções compactas (todos os controles anteriores
preservados — inventário no relatório do Agente 3); financeiro por empresa (visão geral, cobranças, pagamentos,
renovações, auditoria, conciliação, "Situação na Efí", legado, gerar/editar/cancelar fatura, pagamento com confirmação,
cortesia separada, renovação com prévia); funcionalidades por categoria; usuários (listar, buscar, criar, editar,
ativar/desativar, perfil, senha, último admin protegido).

## 6. Migrations
- `20261017120000-company-registration-fields` (aditiva, 11 colunas nullable, idempotente; up/undo/re-up testados).
- **Deve rodar antes do novo backend** (o model seleciona as colunas novas).

## 7. Testes (resultado final do fechamento — ver TESTES.md)
TypeScript e builds OK; unitários backend 320/320; integração em Postgres isolado **46/46**; frontend 39/39.

## 8. Riscos remanescentes
- `isSuper` mantém 401 por decisão do proprietário (D14) — contrato global inalterado.
- `BillingAutomationJob` provavelmente não bloqueia/avisa em produção (`dueDate` não é string) — **adiado para fase posterior** por decisão do proprietário (D15).
- Ciclos pulados ao renovar empresa muito vencida não são cobrados automaticamente (D2).
- Cancelar fatura com Pix Efí ativo não cancela a cobrança na Efí (D11).
- `UserNotifications.companyId` pode estar `NOT NULL` em bancos migrados do zero → notificações de cobrança ao Super
  Admin falham silenciosamente (não afeta a renovação). Verificar em produção.
- Migration legada `20231220192536` é instável em banco novo (falha intermitente); não afeta bancos existentes.
- UI sem validação visual em navegador real; ViaCEP depende de rede/CORS do cliente.
- Pagamentos Pix possivelmente perdidos desde o deploy de `b2a3f30` — precisam de conciliação manual.

## 9–12. Deploy em TESTE, homologação, promoção e recuperação — ver HOMOLOGACAO.md.

## Equipe
| Agente | Responsabilidade | Entrega |
|---|---|---|
| Líder | Arquitetura, contratos, P0, integração, validação | Correção P0, testes de regressão, docs, ajustes de integração |
| Agente 1 | Financeiro backend (Marco C) | Faturas manuais, edição, cancelamento, resumo, renewal-preview, ajuste |
| Agente 2 | Backend administrativo | Migration cadastral, validações BR, API de usuários, auditoria |
| Agente 3 | Frontend páginas | Navegação, página individual, abas Cadastro/Plano/Funcionalidades/Usuários |
| Agente 5 | Frontend financeiro | Guia Financeiro, diálogos de pagamento/fatura/renovação |
| Agente 4 | QA | Harness de integração em Postgres isolado, 46 cenários, revisão de contratos |

Paralelismo: Agentes 1, 2, 3, 4 e 5 trabalharam simultaneamente com propriedade exclusiva de arquivos; o Líder fez o P0 em paralelo.
Problemas encontrados na integração e corrigidos pelo Líder: `manual-payment` respondia 500 em validação (agora 400);
hook `renewDueDate` convertia `undefined` em `null` (anulava a proteção por tempo); auditoria de edição direta do vencimento
(pedida ao Agente 2); processos de teste órfãos encerrados.

## Fechamento técnico (2026-10-17)
- 401 do `isSuper` mantido; testes ajustados e mais estritos → integração 46/46.
- Automação de bloqueios adiada (D15); nenhum dado financeiro alterado no deploy (D16).
- Webhook 500 em falha preservado; idempotência confirmada; procedimento de recuperação Pix em HOMOLOGACAO.md §4 (D17).
- Deploy auditado: systemd `Restart=always` + build com o serviço no ar é arriscado → sequência com parada curta
  (HOMOLOGACAO.md §1.3) (D18).
- Nada foi implantado; produção segue sem a correção até o deploy homologado.

---

# Fase 8.4-F — Gestão operacional de assinaturas e regularização histórica

Execução local, validada; **sem commit, push, deploy, acesso a VPS ou dados reais**. Nenhuma fatura real foi regularizada.

## Entregas
- **F1 Central de assinatura** (`GET /saas/companies/:id/subscription`): plano, recorrência, valor, vencimento atual e
  próximo ciclo, três status separados (operação/financeiro/assinatura), último pagamento, próxima cobrança, pendências,
  ações rápidas (registrar pagamento, gerar fatura, renovar, ajustar vencimento, cortesia).
- **F2 Linha do tempo** (`GET /saas/companies/:id/timeline`): ledger + logs + faturas legadas, sem duplicar, por cursor,
  com aviso de ausência de histórico anterior.
- **F3 Regularização histórica**: fila global "Revisão de históricas" e ação por fatura; quatro decisões auditadas,
  sem renovação, sem data/valor inventados (data desconhecida explícita), bloqueio de conflito Efí, idempotência.
- **F4 Prévias** com a mesma regra da execução e revalidação (409 se o estado mudou) para pagamento, renovação e regularização.
- **F5 Listagem operacional**: filtros em dia, vencido, carência, bloqueio financeiro/manual, históricas a revisar;
  ações contextuais sem envio/cobrança automáticos; status em lote (sem N+1).
- **F6** Distinção pagamento atual × histórico × cortesia × renovação; pagamento Efí em fatura já quitada vira
  conciliação (sem receita/renovação duplicada).
- **F7 Simulação de bloqueios** somente leitura + motor puro; job real inalterado (flag desligada por padrão).
- **F8** `GUIA-ALEX-FINANCEIRO.md` e `CHECKLIST-TRANSFERENCIA-ALEX.md`.

## Migration nova
`20261018120000-saas-historical-review` — tabela `SaaSInvoiceHistoricalReviews` (índice único parcial para decisões
terminais) e `SaaSPayments.paidAt` passa a aceitar NULL. Up/undo/re-up/idempotência testados em banco isolado; o undo é
recusado se já houver pagamento sem data. Aplicar **antes** do backend novo, junto com `20261017120000` (HOMOLOGACAO §1.3).

## Testes (reais)
Integração 90/90 · unitários backend 483/483 · frontend 78/78 · tsc e builds OK. Detalhes: TESTES.md.

## Fechamento da 8.4 confirmado
401 do `isSuper` mantido (testes ajustados e estritos); correção P0 intacta (todos os testes de regressão P0 passam);
simulação não aciona o job real (provado em integração); migration de cadastro antes do backend no procedimento.

## Riscos remanescentes
- Validação visual em navegador ainda não feita (obrigatória em TESTE).
- `UserNotifications.companyId` NOT NULL derruba notificações de cobrança ao Super Admin (confirmado de novo em banco
  isolado; não afeta renovação). Verificar em produção e tratar em fase própria.
- Ativar `BILLING_AUTOMATION_NORMALIZED_DATES` bloquearia empresas vencidas de imediato — decisão comercial pendente.
- Heurística de deduplicação de logs de renovação na linha do tempo (±10 min).
- Fila histórica classificada em memória (ok para o volume atual).
- Não existe perfil "financeiro" com menos poderes: Alex precisa ser Super Admin.

## Separação implantação × operação
O deploy não altera faturas, vencimentos nem pagamentos. A recuperação dos clientes e a regularização histórica são
feitas pelo Alex, pela interface, uma fatura por vez, após o deploy homologado (HOMOLOGACAO §4 e §5; GUIA-ALEX).

## Equipe 8.4-F
| Agente | Entrega |
|---|---|
| Líder | Contratos, decisões, integração (rotas, controller, menu, mock de teste), docs, guia e checklist do Alex, validação final |
| Automação | Motor `billingEvaluation`, simulação somente leitura, status em lote, job com flag (61 testes) |
| Assinaturas | Planner único, prévia de pagamento, central, linha do tempo, gateway em fatura quitada (63 testes novos) |
| Financeiro | Migration + model + serviço/rotas de regularização, indicadores, consumidores de `paidAt` nulo (74 testes) |
| Frontend Empresa | Central, linha do tempo, diálogo de regularização, prévias, ajuste de vencimento (50 testes) |
| Frontend Operação | Filtros da listagem, fila histórica, painel de simulação (25 testes) |
| QA | 44 cenários novos de integração em Postgres real; encontrou o defeito do `expectedCurrentDueDate` |

---

# Fechamento final pré-homologação (8.4 + 8.4-F)

- **Notificações do Super Admin (causa raiz confirmada):** `changeColumn` com `references` no Sequelize 5/Postgres gera só
  `ADD FOREIGN KEY` e ignora `DROP NOT NULL` → `UserNotifications.companyId`/`UserNotificationPreferences.companyId`
  permaneceram NOT NULL e as notificações de plataforma falhavam em silêncio. Corrigido pela migration aditiva
  `20261019120000-notifications-nullable-company-scope` (sem tocar no código de notificações; isolamento preservado).
- **Revisão de integração (2 revisores em paralelo) — corrigidos:** vencimento perdendo 1 dia em fusos a oeste de Brasília;
  Pix pago após baixa manual sem alerta; recorrência inválida travando webhook; risco de deadlock em faturas manuais;
  CPF/CNPJ completo na auditoria; página da empresa sem plano/admin; contadores de históricas divergentes; rótulos técnicos;
  "Invalid date"; erros sem mensagem; descrição de fatura que não limpava.
- **Testes:** integração 102/102 · unitários 491/491 · frontend 91/91 · tsc e builds OK (TESTES.md).
- **Bloqueios automáticos:** flag `BILLING_AUTOMATION_NORMALIZED_DATES` ausente/false; simulação somente leitura comprovada.
- **Pendências não impeditivas:** DECISOES.md FF-D4.
- **Pronto para homologação em TESTE**, seguindo HOMOLOGACAO.md §1.3 e §6. Produção não alterada.
