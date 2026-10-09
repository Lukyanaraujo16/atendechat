# AtendeChat — Roadmap de Clientes, Crédito da Loja e Contas a Receber

**Status:** especificação funcional para implementação  
**Módulo:** Estoque e Vendas / PDV  
**Objetivo:** criar o domínio comercial de clientes do PDV, permitir vendas em Crédito da Loja com limite e condições de pagamento, gerar contas a receber reais e oferecer operação completa de consulta e baixa dos recebíveis.

---

## 1. Princípios e decisões fechadas

1. **Não usar “fiado” na interface.** O nome funcional será **Crédito da Loja**.
2. `Contact` continua sendo a entidade de atendimento do AtendeChat/WhatsApp. Ele **não é** o cadastro comercial do PDV.
3. Criar entidade própria de **Cliente** do módulo Estoque e Vendas, multiempresa e independente de `Contact`.
4. Um Cliente pode ter `contactId` opcional para relacionar uma pessoa já conhecida pelo AtendeChat.
5. Cliente presencial pode ser cadastrado diretamente no PDV, inclusive sem WhatsApp.
6. Venda comum continua podendo ser feita sem cliente identificado quando a forma de pagamento não exigir cadastro.
7. **Crédito da Loja exige Cliente cadastrado.** Não é permitido Crédito da Loja para walk-in anônimo.
8. Cada Cliente pode ter **limite de crédito** configurado.
9. Crédito disponível é calculado: `limite concedido - saldo devedor que consome limite`. Não armazenar crédito disponível como valor independente.
10. O sistema deve bloquear Crédito da Loja acima do limite disponível, salvo autorização explícita por usuário com permissão específica. Toda autorização excepcional deve ser auditável.
11. A arquitetura de contas a receber deve ser genérica. Embora a primeira origem seja Crédito da Loja, os recebíveis não devem ficar estruturalmente presos a essa forma de pagamento.
12. `InventorySalePayment` continua representando pagamentos da venda. Não deve ser deformado para se tornar a carteira de contas a receber.
13. Contas a receber terão títulos/parcelas e baixas próprias, incluindo baixa parcial.
14. Pagamentos de recebíveis liberam limite de crédito proporcionalmente ao principal liquidado.
15. Cancelamentos/estornos devem recompor dívida e limite de forma consistente e auditável.
16. Estoque, comissão, relatórios existentes, recibos e pagamentos atuais não podem sofrer regressão.
17. Toda nova estrutura deve respeitar isolamento por `companyId` e permissões existentes da plataforma.
18. Valores monetários devem seguir a estratégia de precisão já adotada pelo módulo; nunca usar aritmética financeira insegura de ponto flutuante.
19. Datas de vencimento devem ser tratadas como data civil da empresa, evitando deslocamento por timezone.
20. O backend é a autoridade para limite, saldo, vencimentos, baixas e estados financeiros. O frontend não pode ser a única camada de validação.

---

## 2. Terminologia de produto

### Interface
- **Clientes** — cadastro comercial do PDV.
- **Crédito da Loja** — modalidade de venda em que a loja financia o cliente.
- **Limite de crédito** — valor máximo concedido ao cliente.
- **Crédito utilizado** — saldo atual que consome limite.
- **Crédito disponível** — limite menos crédito utilizado.
- **Contas a Receber** — carteira de títulos/parcelas gerados pelas vendas a prazo.
- **Recebimento** — baixa total ou parcial de um título.
- **Em aberto / Parcial / Pago / Vencido / Cancelado** — estados apresentados ao usuário.

### Não usar na UI
- Fiado
- Pendura
- Caderneta

---

## 3. Domínios e responsabilidades

### 3.1 Contact
Permanece responsável por atendimento/canais. Pode ser relacionado a um Cliente, mas não deve carregar limite de crédito, dívida ou regras financeiras do PDV.

### 3.2 Cliente do PDV
Cadastro comercial persistente e reutilizável. Deve ser pesquisável durante uma venda e possuir histórico comercial/financeiro.

### 3.3 Venda
`InventorySale` continua sendo o documento comercial da venda. Deve passar a poder referenciar o novo Cliente, preservando compatibilidade com vendas antigas e vínculo com `Contact` quando aplicável.

### 3.4 Entrega
`InventorySaleDelivery` continua sendo snapshot da entrega. Alterar endereço de entrega de uma venda não deve modificar silenciosamente o endereço cadastral do Cliente.

### 3.5 Contas a Receber
Domínio próprio para obrigações futuras, parcelas, vencimentos, saldo e recebimentos.

---

## 4. Modelo de dados conceitual

Os nomes finais devem seguir os padrões reais do repositório, mas a implementação precisa representar no mínimo os conceitos abaixo.

### 4.1 `InventoryCustomer`
Campos mínimos:
- `id`
- `companyId`
- `contactId` nullable
- `type`: `individual | company`
- `name`
- `tradeName`/nome fantasia quando PJ, se aplicável
- `document` nullable (CPF/CNPJ normalizado somente em dígitos)
- `phone` nullable
- `email` nullable
- `postalCode`
- `street`
- `addressNumber`
- `addressComplement`
- `district`
- `city`
- `state`
- `notes`
- `creditLimit`
- `isActive`
- timestamps

Regras:
- `companyId` obrigatório em todas as consultas.
- Documento, quando informado, deve ser validado/normalizado e não pode duplicar dentro da mesma empresa.
- `contactId`, quando informado, deve pertencer à mesma empresa e não deve ser vinculado a dois Clientes da mesma empresa sem regra explícita.
- Cliente pode existir sem documento e sem Contact.
- Definir regra mínima de identificação para cadastro (ex.: nome obrigatório e pelo menos telefone ou documento quando adequado), sem impedir casos reais de balcão desnecessariamente.
- Não excluir fisicamente Cliente com histórico financeiro/comercial; usar inativação.

### 4.2 Vínculo da venda
Adicionar referência de Cliente em `InventorySale` (ex.: `customerId` nullable), preservando `contactId` existente por compatibilidade.

Novas vendas devem usar `customerId` como identidade comercial quando houver Cliente selecionado. O vínculo opcional com Contact vem do cadastro do Cliente e/ou do contexto da venda.

### 4.3 `InventoryReceivable`
Representa o compromisso financeiro originado por uma venda/condição a prazo.

Campos conceituais:
- `id`
- `companyId`
- `customerId`
- `saleId`
- `originType` (inicialmente `store_credit`; extensível)
- `originalAmount`
- `openAmount`
- `status`
- `createdByUserId`
- timestamps

### 4.4 `InventoryReceivableInstallment`
- `id`
- `companyId`
- `receivableId`
- `sequence`
- `dueDate`
- `originalAmount`
- `paidAmount`
- `openAmount`
- `status`
- timestamps

Status persistido ou derivado de forma consistente: `open`, `partial`, `paid`, `cancelled`; **vencido pode ser derivado** por `dueDate < hoje` quando ainda houver saldo, evitando cron jobs apenas para trocar status.

### 4.5 `InventoryReceivablePayment`
Cada baixa financeira:
- `id`
- `companyId`
- `receivableId`
- `installmentId`
- `amount`
- `paymentMethod`
- `paidAt`
- `notes`
- `createdByUserId`
- referência de estorno/cancelamento quando necessário
- timestamps

Não apagar histórico de baixa. Correções devem ser reversões/estornos auditáveis.

### 4.6 Autorização de excesso de limite
Persistir evidência de exceção, no mínimo:
- venda/recebível relacionado
- limite e crédito disponível no momento
- valor excedido
- usuário autorizador
- data/hora
- justificativa opcional/obrigatória conforme UX final

Pode ser tabela própria ou trilha de auditoria compatível com a arquitetura existente, desde que consultável e não silenciosa.

---

## 5. Regras financeiras fechadas

### 5.1 Crédito disponível
`creditAvailable = max(creditLimit - creditUsed, 0)` para exibição normal.

`creditUsed` deve vir do saldo aberto das obrigações que consomem Crédito da Loja, excluindo canceladas e valores já liquidados.

O cálculo deve ser feito no backend e ser seguro contra concorrência.

### 5.2 Venda em Crédito da Loja
Para concluir:
- Cliente ativo obrigatório.
- Limite de crédito configurado e suficiente, salvo override autorizado.
- Condição de pagamento válida.
- Soma das parcelas = valor efetivamente financiado.
- A criação da venda/recebível/parcelas deve ser transacional.

### 5.3 Pagamento misto
Preservar split atual. Uma venda pode, por exemplo, ter parte em Pix e parte em Crédito da Loja. Apenas o valor destinado ao Crédito da Loja consome limite e gera recebível.

### 5.4 Condições
Suportar inicialmente:
- **Data única**
- **Semanal** — intervalos de 7 dias
- **Quinzenal** — intervalos de 15 dias
- **Mensal** — mesma referência de dia nos meses seguintes, com ajuste determinístico para o último dia quando o dia não existir

Campos de UX:
- primeiro vencimento
- número de parcelas
- valor financiado
- preview das parcelas antes de concluir

Distribuição de centavos deve garantir soma exata. Diferença residual de arredondamento vai para a última parcela (ou regra equivalente determinística).

### 5.5 Débito vencido
Configuração da empresa para política de Crédito da Loja:
- padrão recomendado: **bloquear nova compra em Crédito da Loja quando houver saldo vencido**;
- permitir configuração para não bloquear;
- quando bloqueado, usuário com permissão de override pode autorizar excepcionalmente, com auditoria.

Se a infraestrutura atual de settings permitir, implementar a configuração. Se não houver padrão adequado, criar setting do módulo sem hardcode por empresa.

### 5.6 Baixa parcial
Uma parcela pode receber múltiplas baixas até zerar.

Exemplo: parcela R$ 500; recebe R$ 200 → fica parcial com R$ 300 em aberto. Nova baixa de R$ 300 → paga.

Não aceitar baixa maior que o saldo da parcela sem fluxo explícito de alocação.

### 5.7 Recebimento de múltiplas parcelas
Na Conta do Cliente/Contas a Receber, permitir selecionar títulos/parcelas e receber valor. Quando houver alocação automática, usar ordem determinística: vencidos mais antigos → vencimentos mais próximos → demais, sempre exibindo ao operador a alocação antes da confirmação.

### 5.8 Cancelamento de venda
Se uma venda com Crédito da Loja for cancelada:
- cancelar saldo aberto correspondente;
- liberar o limite consumido pelo saldo cancelado;
- preservar histórico;
- se já houve recebimentos, não apagar dinheiro recebido. O fluxo deve exigir tratamento financeiro coerente (estorno/crédito/reembolso conforme capacidades existentes) e impedir cancelamento destrutivo silencioso.

### 5.9 Alteração de venda concluída
Não permitir mutação que reescreva recebíveis já movimentados sem uma operação financeira explícita. Mudanças devem respeitar trilha e consistência.

### 5.10 Concorrência
Duas vendas simultâneas não podem consumir o mesmo limite disponível. A validação final e reserva/geração do débito devem ocorrer sob transação/locking ou estratégia equivalente suportada pelo stack atual.

---

## 6. Página Clientes

Adicionar item **Clientes** dentro de Estoque e Vendas conforme padrão de navegação/permissões do módulo.

### 6.1 Listagem
Exibir de forma responsiva:
- nome
- CPF/CNPJ quando houver
- telefone
- limite
- utilizado
- disponível
- saldo vencido
- status

Busca por:
- nome
- CPF/CNPJ
- telefone

Filtros mínimos:
- ativo/inativo
- com saldo em aberto
- com saldo vencido
- com/sem crédito disponível, se útil sem poluir UX

### 6.2 Cadastro/edição
PF/PJ, dados cadastrais, endereço e CEP usando o helper/hook de CEP já homologado, observações, vínculo opcional com Contact e limite de crédito.

Não duplicar lógica do ViaCEP.

### 6.3 Conversão/vínculo de Contact
Ao selecionar um Contact durante uma venda ou a partir do cadastro:
- permitir criar Cliente usando dados existentes como prefill;
- não alterar Contact silenciosamente;
- evitar duplicidade por documento e alertar possíveis duplicidades por telefone/Contact.

### 6.4 Conta do Cliente
Detalhe do Cliente com:
- limite concedido
- crédito utilizado
- crédito disponível
- saldo total em aberto
- saldo vencido
- saldo a vencer
- próximas parcelas
- histórico de vendas relacionadas
- histórico de recebíveis
- histórico de baixas
- autorizações excepcionais de limite quando aplicável

Ações conforme permissão:
- editar cadastro
- alterar limite
- registrar recebimento
- consultar venda originadora
- inativar/reativar

---

## 7. Integração com o PDV / Wizard de venda

### 7.1 Etapa Cliente
Substituir/estender a busca atual para trabalhar com Cliente comercial.

Fluxos:
1. pesquisar Cliente existente por nome/documento/telefone;
2. selecionar Cliente;
3. cadastrar **Novo cliente** sem sair da venda;
4. se houver Contact do atendimento sem Cliente relacionado, oferecer criação/vínculo com prefill;
5. permitir **Venda sem cliente** apenas quando as condições escolhidas permitirem.

### 7.2 Novo cliente inline
Cadastro compacto, mas suficiente. Deve persistir o Cliente e selecioná-lo na venda.

### 7.3 Endereço/entrega
Ao selecionar Cliente, seu endereço pode servir como prefill de entrega. O endereço da venda permanece snapshot e editável sem alterar cadastro automaticamente.

### 7.4 Pagamento
Adicionar **Crédito da Loja** às opções.

Ao escolher:
- exibir limite, utilizado e disponível;
- informar valor que será financiado;
- configurar condição e primeiro vencimento;
- gerar preview das parcelas;
- avisar/bloquear insuficiência de limite;
- avisar/bloquear débito vencido conforme setting;
- permitir fluxo de autorização apenas para usuário/permissão adequada.

### 7.5 Resumo antes de concluir
Mostrar claramente:
- cliente
- total da venda
- valor pago imediatamente
- valor em Crédito da Loja
- condição
- parcelas e vencimentos
- crédito disponível antes/depois
- override, se houver

---

## 8. Página Contas a Receber

Adicionar página própria **Contas a Receber** no módulo Estoque e Vendas.

### 8.1 Indicadores
No mínimo:
- total em aberto
- total vencido
- vence hoje
- próximos 7 dias

Os cards devem respeitar filtros e regras de escopo da empresa quando apropriado.

### 8.2 Listagem
Colunas/conteúdo essenciais:
- cliente
- venda/origem
- parcela
- vencimento
- valor original
- recebido
- saldo
- situação

Busca:
- cliente
- CPF/CNPJ
- telefone
- identificador/número da venda quando existir

Filtros:
- status: aberto, parcial, vencido, pago, cancelado
- período de vencimento
- cliente
- vendedor/origem quando tecnicamente coerente
- vencidos / hoje / próximos

### 8.3 Detalhe
Exibir:
- cliente
- venda originadora
- condição
- parcelas
- baixas realizadas
- usuário que recebeu
- método de recebimento
- datas e observações
- saldo atual

### 8.4 Registrar recebimento
Permitir baixa total ou parcial.

Métodos de recebimento devem reutilizar métodos adequados já existentes (dinheiro, Pix, cartão, transferência etc.), sem tratar **Crédito da Loja** como método de baixa da própria dívida.

Após confirmar:
- atualizar parcela/recebível;
- atualizar saldo do Cliente por cálculo consistente;
- liberar limite correspondente;
- registrar usuário/data/método;
- refletir imediatamente nos cards/listagens.

### 8.5 Estorno/correção
Usuários autorizados devem poder estornar uma baixa sem apagar histórico. O estorno recompõe saldo e crédito utilizado.

---

## 9. Permissões

Integrar ao sistema atual de permissões, seguindo nomenclatura real do projeto. Conceitos necessários:

- visualizar Clientes
- criar/editar Clientes
- visualizar dados financeiros do Cliente
- gerenciar limite de crédito
- usar Crédito da Loja na venda
- autorizar excesso de limite / bloqueio por atraso
- visualizar Contas a Receber
- registrar recebimentos
- estornar/corrigir recebimentos

Admin deve receber comportamento compatível com a política atual de permissões. Supervisor/vendedor devem obedecer grants reais; não hardcodar papel se o projeto usa permissões granulares.

Também integrar com feature flag/plano `inventory.sales` conforme padrão atual.

---

## 10. Relatórios e recibos

### 10.1 Relatórios
Adicionar/estender relatórios para permitir no mínimo:
- saldo em aberto por Cliente
- saldo vencido por Cliente
- carteira por período de vencimento
- recebimentos por período
- Crédito da Loja originado por período

Não quebrar `GetInventoryReportCustomersService` atual; migrar/estender com compatibilidade quando necessário.

### 10.2 Comprovante de recebimento
Quando houver padrão de recibo/comprovante no projeto, permitir comprovante da baixa contendo cliente, valor, método, data e referência das parcelas/vendas liquidadas. Preservar A4/80/58 existentes quando não fizer sentido alterá-los.

---

## 11. Compatibilidade e migração

1. Vendas antigas com apenas `contactId` continuam válidas.
2. Não converter automaticamente todos os Contacts em Clientes.
3. Não gerar recebíveis retroativos automaticamente para vendas antigas `unpaid/partial` sem regra explícita. Evitar inventar dívida histórica.
4. Permitir evolução futura/migração assistida, mas fora deste escopo salvo necessidade técnica.
5. Nenhuma migration pode apagar ou reinterpretar pagamentos históricos existentes.

---

## 12. API e segurança

Criar serviços/rotas seguindo padrões atuais do backend, com validação de empresa e permissão em todas as operações.

Grupos conceituais:
- customers: list/search/create/get/update/activate/deactivate
- customer credit summary
- receivables: list/get
- receivable payments: create/reverse
- store-credit quote/validation/preview, se necessário
- company credit settings

Requisitos:
- nunca aceitar `companyId` arbitrário do frontend como autoridade;
- validar ownership de customer/contact/sale/receivable/installment;
- transações nas operações financeiras;
- idempotência ou proteção contra duplo submit em conclusão/baixa quando compatível com arquitetura atual;
- não permitir valor negativo/zero indevido;
- não permitir recebimento acima do saldo sem fluxo explícito;
- logs/auditoria para operações sensíveis.

---

## 13. UX e i18n

- Manter padrão visual do InventorySales existente.
- Mobile funcional, não apenas desktop.
- Textos em pt-BR, inglês e espanhol conforme padrão atual.
- Linguagem simples para operador de loja.
- Estados de loading, vazio, erro e retry.
- Confirmações claras para estorno, override de limite e operações irreversíveis.
- Valores sempre formatados em moeda.
- Datas no padrão local da interface.
- Não expor nomes técnicos de models/status.

---

## 14. Roadmap de implementação

O agente pode executar o roadmap completo autonomamente, mas deve respeitar a ordem abaixo e validar cada fase antes de avançar.

### Fase 1 — Fundação e contrato
- auditar padrões atuais de models, migrations, permissões, routes, services e frontend InventorySales;
- criar migrations/models do Cliente e relacionamento com venda;
- criar receivable/installment/payment e estrutura de settings/auditoria necessária;
- índices, constraints, FKs e isolamento multi-tenant;
- não alterar comportamento existente ainda;
- testes de models/regras fundamentais.

**Gate:** migrations coerentes, models carregando, testes verdes, sem regressão.

### Fase 2 — Clientes backend
- CRUD/search;
- CPF/CNPJ normalização/validação/duplicidade;
- vínculo opcional com Contact;
- resumo financeiro calculado;
- permissões.

**Gate:** testes de isolamento, duplicidade, vínculo e cálculo.

### Fase 3 — Página Clientes
- navegação/permissão;
- listagem/busca/filtros;
- cadastro/edição;
- CEP compartilhado;
- Conta do Cliente inicial;
- responsividade/i18n.

**Gate:** testes de UI essenciais e build.

### Fase 4 — Integração Cliente ↔ PDV
- busca de Clientes no wizard;
- novo cliente inline;
- Contact → Cliente com prefill/vínculo;
- compatibilidade com vendas antigas/contactId;
- prefill de entrega sem mutar cadastro.

**Gate:** venda normal com/sem Cliente continua funcionando.

### Fase 5 — Motor de Crédito da Loja
- adicionar modalidade;
- quote/preview;
- limite/used/available;
- data única/semanal/quinzenal/mensal;
- geração exata de parcelas;
- pagamento misto;
- bloqueio de limite e atraso;
- override auditável;
- concorrência/transação.

**Gate:** matriz de testes financeiros completa antes de UI final.

### Fase 6 — Conclusão da venda e geração de recebíveis
- gerar receivable/installments atomicamente;
- associar Cliente/venda;
- refletir crédito utilizado;
- tratar cancelamento/alterações com segurança;
- garantir que estoque/comissão atuais continuem corretos.

**Gate:** testes de integração incluindo rollback de transação.

### Fase 7 — Contas a Receber backend
- listagem/filtros/resumos;
- detalhe;
- baixa parcial/total;
- múltiplas baixas;
- alocação determinística;
- estorno auditável;
- recomposição/liberação de limite.

**Gate:** invariantes financeiras e concorrência testadas.

### Fase 8 — Página Contas a Receber
- cards;
- busca/filtros;
- listagem/detalhe;
- modal/fluxo Receber;
- baixa parcial;
- estorno conforme permissão;
- links Cliente/Venda;
- mobile/i18n.

**Gate:** testes de UI e build.

### Fase 9 — Conta do Cliente completa
- histórico de vendas;
- recebíveis;
- baixas;
- vencidos/a vencer;
- limite/utilizado/disponível;
- ações permitidas.

### Fase 10 — Relatórios e comprovantes
- carteira por Cliente/período;
- recebimentos;
- Crédito da Loja;
- comprovante quando compatível;
- preservar relatórios/recibos atuais.

### Fase 11 — Hardening e regressão
- multi-tenant;
- permissões;
- concorrência;
- arredondamento;
- datas mensais/fevereiro/fim do mês;
- duplicidade;
- duplo submit;
- cancelamento/estorno;
- mobile;
- i18n;
- testes InventorySales completos;
- frontend build;
- backend build/testes relevantes.

---

## 15. Matriz mínima de testes obrigatórios

Cobrir no mínimo:

1. Cliente PF e PJ.
2. Cliente sem Contact.
3. Cliente criado a partir de Contact.
4. Documento duplicado na mesma empresa bloqueado.
5. Mesmo documento em empresas distintas respeita isolamento conforme política definida.
6. Busca nome/documento/telefone.
7. Venda walk-in normal continua funcionando.
8. Crédito da Loja sem Cliente bloqueado.
9. Cliente inativo bloqueado para novo crédito.
10. Limite zero/insuficiente bloqueado.
11. Override permitido apenas com permissão e auditado.
12. Duas vendas concorrentes não ultrapassam limite sem autorização.
13. Data única.
14. Semanal.
15. Quinzenal.
16. Mensal incluindo dia 29/30/31 e fevereiro.
17. Centavos fecham exatamente.
18. Pagamento misto gera recebível apenas do valor financiado.
19. Recebível nasce com parcelas corretas.
20. Parcela aberta vira vencida por data sem corromper estado.
21. Baixa parcial.
22. Múltiplas baixas.
23. Baixa total.
24. Limite é liberado proporcionalmente.
25. Estorno recompõe saldo/limite.
26. Não receber acima do saldo.
27. Bloqueio por vencido conforme setting.
28. Override de atraso auditado.
29. Cancelamento sem recebimentos.
30. Cancelamento com recebimentos não apaga histórico nem dinheiro silenciosamente.
31. Venda antiga com `contactId` continua abrindo.
32. Nenhum recebível retroativo indevido.
33. Estoque sem regressão.
34. Comissão sem regressão.
35. Pagamentos atuais sem regressão.
36. Relatórios existentes sem regressão.
37. Recibos existentes sem regressão.
38. Permissões por empresa/usuário.
39. Contas a Receber não vaza dados entre empresas.
40. Frontend build e suíte InventorySales verdes.

---

## 16. Critérios de aceite funcionais

A fase só pode ser considerada concluída quando for possível homologar de ponta a ponta:

### Cenário A — cliente presencial
1. Abrir nova venda.
2. Cadastrar Cliente sem sair do PDV.
3. Informar endereço por CEP.
4. Salvar e reutilizar o Cliente em venda futura.

### Cenário B — Contact vira Cliente
1. Venda originada de atendimento/Contact.
2. Criar/vincular Cliente com prefill.
3. Preservar Contact.
4. Cliente passa a ser reutilizável no PDV.

### Cenário C — Crédito da Loja
1. Cliente com limite de R$ 2.000.
2. Fazer venda de R$ 1.000 em Crédito da Loja.
3. Gerar 4 parcelas.
4. Crédito utilizado = R$ 1.000; disponível = R$ 1.000.
5. Parcelas aparecem em Contas a Receber e Conta do Cliente.

### Cenário D — pagamento misto
1. Venda R$ 1.000.
2. R$ 300 Pix + R$ 700 Crédito da Loja.
3. Apenas R$ 700 entram na carteira/limite.

### Cenário E — baixa
1. Receber parcialmente uma parcela.
2. Saldo reduz corretamente.
3. Limite é liberado na mesma proporção.
4. Histórico registra operador, data, valor e método.

### Cenário F — atraso
1. Parcela vence.
2. Aparece como vencida na carteira.
3. Política da empresa bloqueia novo Crédito da Loja.
4. Override, quando autorizado, funciona e fica registrado.

### Cenário G — visão administrativa
Administrador/usuário autorizado abre **Contas a Receber** e consegue enxergar total em aberto, vencido, vencendo hoje, próximos vencimentos, clientes devedores, parcelas e registrar recebimentos.

---

## 17. Fora de escopo desta fase

Não implementar sem necessidade explícita:
- cobrança automática por WhatsApp;
- régua automática de cobrança;
- juros/multa automáticos;
- SPC/Serasa;
- score externo;
- carnê bancário/PIX automático por PSP;
- conciliação bancária;
- fiscal/NF por causa desta fase;
- conversão automática em massa de Contacts para Clientes;
- importação histórica de dívidas antigas.

A arquitetura pode permitir evolução futura, mas não ampliar o escopo agora.

---

## 18. Instruções para execução autônoma pelo agente de código

Ao receber este documento como contrato:

1. Ler este roadmap e inspecionar apenas o código necessário para mapear os padrões reais do repositório.
2. Antes de implementar, registrar um checkpoint curto com branch/HEAD/status e eventuais leftovers conhecidos; **não alterar leftovers alheios**.
3. Implementar **todas as Fases 1–11 em sequência**, sem aguardar confirmação humana entre elas, desde que o gate da fase anterior esteja verde.
4. Se um gate falhar, corrigir antes de prosseguir.
5. Pode adaptar nomes técnicos ao padrão existente, mas **não pode mudar as regras funcionais deste documento silenciosamente**.
6. Se encontrar ambiguidade que realmente impeça implementação segura, escolher a alternativa mais conservadora e registrar claramente no relatório final; não inventar regra financeira arriscada.
7. Reutilizar helpers/componentes/serviços existentes sempre que apropriado; evitar duplicação.
8. Não fazer refatorações amplas fora do escopo.
9. Não usar SSH/VPS.
10. Não fazer deploy.
11. Não fazer push.
12. Não mexer em arquivos não relacionados/leftovers.
13. Executar migrations apenas em ambiente local/de teste disponível e seguro, nunca produção.
14. Rodar testes focados ao longo das fases e, ao final, regressão completa relevante + builds.
15. Se houver falha preexistente não causada pela implementação, provar/registrar sem mascarar.
16. Ao final, deixar alterações implementadas e validadas localmente, prontas para revisão humana, commit/push/deploy conforme política do projeto.
17. Não gastar contexto com operações mecânicas repetitivas além do necessário para validar a implementação.

---

## 19. Relatório final obrigatório do agente

Entregar ao final:

1. HEAD inicial e branch.
2. Arquivos criados/alterados por domínio.
3. Migrations criadas e ordem.
4. Models/tabelas/relacionamentos finais.
5. Rotas/services/backend criados.
6. Páginas/componentes/frontend criados.
7. Permissões adicionadas.
8. Settings adicionados.
9. Como Contact ↔ Cliente funciona.
10. Como venda ↔ Cliente funciona.
11. Como limite é calculado e protegido contra concorrência.
12. Como Crédito da Loja e pagamento misto funcionam.
13. Como parcelas/vencimentos são gerados.
14. Como baixa parcial/total funciona.
15. Como estorno/cancelamento afeta saldo e limite.
16. Como Contas a Receber funciona.
17. Como Conta do Cliente funciona.
18. Compatibilidade com vendas antigas.
19. Testes criados/alterados e resultados.
20. Resultado da regressão InventorySales.
21. Resultado de backend/frontend build.
22. Riscos/decisões conservadoras adotadas.
23. `git diff --stat` e status final.
24. Confirmar explicitamente: sem push, sem deploy, sem VPS.
25. Fornecer checklist objetivo de homologação manual em produção.

---

## 20. Definição de pronto

**Clientes + Crédito da Loja + Contas a Receber só está concluído quando:**

- Cliente comercial independente existe e é reutilizável;
- Contact pode virar/vincular Cliente sem ser confundido com ele;
- Cliente tem limite de crédito;
- PDV consegue cadastrar/selecionar Cliente;
- Crédito da Loja respeita limite, atraso e permissões;
- pagamento misto funciona;
- parcelas e vencimentos reais são gerados;
- existe página administrativa/operacional de Contas a Receber;
- existem baixas parciais/totais e estornos auditáveis;
- Conta do Cliente mostra dívida e histórico;
- limite é consumido/liberado corretamente;
- isolamento multiempresa e permissões estão cobertos;
- funcionalidades existentes de estoque/vendas/pagamentos/comissões/relatórios/recibos permanecem verdes;
- testes e builds passam;
- homologação manual dos cenários A–G é aprovada.

