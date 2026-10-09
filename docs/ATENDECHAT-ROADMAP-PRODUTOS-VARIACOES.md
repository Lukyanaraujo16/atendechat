# ATENDECHAT — ROADMAP DE PRODUTOS COM VARIAÇÕES

**Módulo:** Estoque e Vendas  
**Status:** Planejado — aguardando implementação  
**Origem:** Auditoria técnica somente leitura (HEAD `e25c3d2c90c630a827e2f2a600657e87d0645fd1`)  
**Destino no repositório:** `docs/ATENDECHAT-ROADMAP-PRODUTOS-VARIACOES.md`  
**Estratégia:** implementação autônoma em uma rodada, fases internas sequenciais, testes por fase, homologação na VPS de TESTE antes de qualquer promoção para produção.

---

## 1. Objetivo e escopo

Permitir cadastrar **um produto principal** com **variações comercializáveis** (por exemplo, `iPhone 17 Pro Max` → Azul / Laranja / Cinza), cada uma com **preço de custo, preço de venda, SKU, código de barras, estoque atual e estoque mínimo próprios**. Permitir atributos configuráveis e combinações, como Cor × Tamanho, sem obrigar a gerar todas as combinações possíveis.

A solução deve ser genérica e multiempresa, sem configurações específicas para uma loja ou categoria. Produtos simples continuam funcionando sem qualquer conversão obrigatória; vendas, movimentos e documentos históricos permanecem íntegros.

**Fora do escopo:** reserva de estoque em rascunhos, rastreabilidade de unidades em um cadastro central de IMEI, unicidade global de IMEI, compras/fornecedores, integração com marketplaces, alteração do motor de descontos/pagamentos/comissões, conversão automática de produtos antigos em variantes e mudança da política atual de estoque negativo. Não introduzir novos módulos ou permissões sem necessidade comprovada.

## 2. Base comprovada pela auditoria

- `InventoryProduct` reúne hoje catálogo, SKU/barcode, preços e `currentQuantity`.
- Estoque é atualizado em três caminhos transacionais: movimento manual, conclusão e cancelamento de venda; há locks `FOR UPDATE`.
- `InventorySaleItem` guarda snapshots comerciais e `productId`; identificadores ficam em `InventorySaleItemIdentifiers`, por item vendido.
- Barcode é único em banco por `(companyId, barcode)` entre produtos; SKU tem verificação apenas na aplicação.
- PDV usa `SaleItemsEditor` e busca com limite 20; existe também `SaleDrawer` legado/ticket.
- Draft não reserva estoque; conclusão valida disponibilidade. Produtos inativos não podem ser concluídos.
- Relatório de produtos agrupa `productId`, nome e SKU históricos; existem recibos A4/térmicos e CSV.
- Permissões existentes incluem `inventory.sales.manageProducts`, `manageStock`, `createSale` e `viewReports`; isolamento por `companyId`.

**Nota:** nomes exatos de métodos, colunas adicionais e assinaturas devem ser conferidos no código durante implementação. Este roadmap não afirma detalhes não demonstrados pela auditoria.

## 3. Decisões arquiteturais obrigatórias

### 3.1 Produto simples versus produto com variações

- `InventoryProduct` continua sendo a entidade principal, com `companyId`, nome, categoria, descrição, imagem, status e metadados comuns.
- Introduzir discriminação explícita de tipo (`simple` / `variable`, nome técnico a escolher conforme convenção do repositório); **não** inferir tipo apenas pela presença de filhos.
- **Simples:** conserva o caminho atual, com SKU, barcode, custo, preço, estoque e movimentos no próprio produto; `variantId = null` nas operações novas e antigas.
- **Variável:** funciona como agrupador **não vendável**; cada `InventoryProductVariant` é a unidade vendável, com valores comerciais e estoque próprios. Campos comerciais legados do pai não devem ser usados como fonte de preço/saldo de variantes.
- Não criar “variante default” para todos os produtos simples. Não converter produtos históricos automaticamente.
- Produtos variáveis sem variantes ativas podem ser cadastrados/editados, mas não podem ser adicionados ou concluídos em venda.

### 3.2 Atributos e combinações

- Atributos configuráveis por empresa (ex.: Cor, Tamanho, Memória) e respectivos valores (Azul, M, 16 GB). Reutilização de atributos/valores entre produtos da mesma empresa é desejável.
- Cada variante representa **uma combinação única** de valores de atributos vinculados ao produto. Ex.: `Cor=Preta; Tamanho=M`.
- Combinações são criadas explicitamente pelo operador; oferecer geração assistida opcional se simples de implementar, com prévia, limites razoáveis e possibilidade de selecionar combinações, **sem criação cartesiana silenciosa**.
- Evitar duplicatas mesmo quando a ordem dos atributos difere. A unicidade da combinação deve ser garantida de modo seguro também sob concorrência (chave canônica e constraint por produto, ou estratégia equivalente).
- Alterações de atributos não podem tornar ambiguamente idênticas duas variantes existentes; bloquear ou exigir resolução. Não apagar atributos/valores com histórico de variantes/vendas.
- Exibir rótulo legível e estável, por exemplo `Azul` ou `Preta / M`; não depender de texto livre como identidade técnica.

### 3.3 Identidade, códigos e preços

- Cada variante possui `id`, `companyId`, `productId`, SKU opcional, barcode opcional, custo, preço, `currentQuantity`, `minStock`, status e combinação de atributos.
- SKU/barcode de produto simples continuam no pai. Produto variável **não pode** competir como unidade vendável por código de barras/SKU do pai; validar/limpar os campos comerciais do pai no fluxo de conversão.
- SKU e barcode, quando informados, devem ser únicos **entre todos os itens vendáveis da mesma empresa**, abrangendo simultaneamente produtos simples e variantes; empresas distintas podem reutilizar códigos.
- Normalizar códigos de maneira consistente com o comportamento atual (trim, nulos, comparação/case conforme regras existentes). Não alterar a semântica atual sem teste de regressão.
- **Atenção:** índices `UNIQUE` separados nas tabelas `InventoryProducts` e `InventoryProductVariants` **não garantem** unicidade cruzada. Projetar garantia transacional no banco (ex.: registro único de códigos por tenant com constraint e vínculo exclusivo ao vendável, ou alternativa comprovadamente segura sob corrida); validação apenas em aplicação é insuficiente. Preservar a constraint existente de barcode durante migração e garantir atualização/remoção atômica do registro de código.
- Em caso de colisões pré-existentes de SKU/barcode, não modificar dados automaticamente: detectar, relatar e tratar com política de compatibilidade segura, sem bloquear deploy desnecessariamente.
- Preço/custo não devem ser herdados implicitamente do pai no momento da venda; devem vir da variante selecionada. Snapshots históricos não mudam com edições de catálogo.

### 3.4 Estoque e integridade

- Saldo autoritativo da variante em `InventoryProductVariant.currentQuantity` e movimentos identificados por `productId` **e** `variantId`; movimentos legados e simples permanecem com `variantId = null`.
- Produto variável não recebe movimentação de estoque sem variante. O total do pai é apenas **agregação de leitura** das variantes, nunca um segundo saldo gravado.
- Manter transações e `SELECT FOR UPDATE` na **unidade vendável** correta em entrada, saída, ajuste, conclusão e cancelamento. Se uma operação abranger várias unidades vendáveis, ordenar locks por chave estável para reduzir deadlocks.
- Preservar política `allowNegativeStock` existente e a regra de draft sem reserva. Duas conclusões simultâneas da última unidade, com estoque negativo proibido, devem produzir uma conclusão e uma falha segura.
- Criar movimentos de `initial` quando aplicável, inclusive para variantes com estoque inicial, mantendo compatibilidade com comportamento legado; não reescrever ledger histórico.
- Estoque mínimo e alertas: **por variante**; no pai mostrar total consolidado e indicação de variantes abaixo do mínimo. Não considerar o total do pai suficiente para liberar venda de uma variante esgotada.

### 3.5 Vendas, identificadores e histórico

- Adicionar `variantId` **nullable** em `InventorySaleItem` e `InventoryStockMovement`; FK e índices apropriados.
- `productId` permanece obrigatório nas linhas e movimentos. Sempre validar `variant.productId === productId` e mesmo `companyId` do contexto da venda/movimento.
- Venda de produto variável exige `variantId` válido, ativo e pertencente ao pai; venda de produto simples exige `variantId = null`.
- Item de venda deve registrar snapshot suficiente de **nome do pai, descrição legível da variação, SKU/barcode da unidade vendida, preços e regras já existentes**, sem recalcular documentos históricos a partir do catálogo atual.
- Identificadores (IMEI/serial) continuam associados à linha da venda. Ao alterar `productId` ou `variantId` de uma linha em draft, impedir associação silenciosa de identificadores antigos: limpar com confirmação explícita ou exigir revisão conforme UX existente. Nunca alterar identificadores de venda concluída retroativamente.
- Conclusão e cancelamento usam a referência vendável persistida no item, não a variante atualmente selecionada no frontend. Cancelamento devolve saldo à mesma variante, inclusive se estiver inativa, respeitando integridade histórica e evitando revenda automática de item inativo.
- Não mudar fórmulas de descontos, frete, comissões, split payment, Crédito da Loja ou Contas a Receber; apenas garantir que o preço da variante alimente o fluxo existente.

### 3.6 Segurança, exclusão e mudanças de tipo

- Reutilizar permissões existentes `manageProducts`, `manageStock`, `createSale`, `viewReports`, plan flag `inventory.sales` e regras atuais de admin/supportMode; não abrir bypass novo.
- Toda leitura/escrita de variante, atributo, opção e código deve validar empresa; IDs de outra empresa devem falhar sem revelar dados (preferir 404 conforme padrão).
- Não permitir excluir fisicamente variante com histórico de venda/movimento; desativação é a alternativa. Proteger produto pai contra exclusão que deixe variantes ou histórico órfãos.
- Conversão `simple → variable` só mediante ação explícita e segura: se existir estoque, movimentos, vendas ou códigos associados, não transferir/sumir dados silenciosamente; preferir bloquear conversão e explicar motivo, salvo se houver fluxo transacional de migração manual auditável e totalmente testado. Conversão `variable → simple` deve ser bloqueada se existirem variantes/histórico; não implementar conversão irrestrita.
- Não permitir editar combinação/identidade de variante já utilizada em histórico de modo que produza inconsistência comercial; preservar snapshots e exigir desativar/criar nova variante quando necessário.

## 4. Contratos e invariantes de dados

1. `InventoryProduct.companyId` é o tenant canônico.
2. `InventoryProductVariant.companyId` deve coincidir com o do pai; conferir via serviço e reforçar com constraints/FKs compostas ou equivalente onde viável.
3. `InventorySaleItem.variantId = null` significa produto simples/legado; não reinterpretar vendas históricas como variantes.
4. Para item novo, `variantId != null` implica pai variável e pertencimento válido; `variantId = null` é inválido para pai variável.
5. `InventoryStockMovement.variantId` identifica o mesmo vendável da linha/movimento; movimentos de simples/legados permanecem nulos.
6. `currentQuantity` de variante é a fonte de saldo da variante; o pai variável não mantém saldo paralelo.
7. Códigos comerciais únicos por `(companyId, tipo, valor normalizado)` no universo de itens vendáveis, com integridade sob concorrência; códigos opcionais não colidem por ausência.
8. Combinação de opções é única por `(companyId, productId, combinação canônica)`.
9. Preços e quantidades respeitam validações existentes (decimal, precisão, não negativos quando aplicável); sem uso de floats para cálculos monetários no backend.
10. Não mudar contrato legado de endpoints existentes de produtos simples sem compatibilidade explícita. Campos novos são aditivos; clientes antigos devem continuar funcionando para produtos simples.
11. Alterações em catálogo não modificam `InventorySaleItem` de vendas concluídas nem recibos históricos.
12. Regras de autorização, isolamento, transação e idempotência existentes prevalecem.

## 5. API e serviços — contratos funcionais

A implementação deve respeitar os padrões de `inventoryRoutes.ts`, controllers, validação e serializers atuais. A lista abaixo é **contrato funcional**, não imposição de nomes de rota:

- CRUD/listagem de atributos e opções **por empresa**, com regras de desativação/uso.
- CRUD/listagem de variantes vinculadas ao produto, incluindo preço, custo, SKU, barcode, estoque mínimo, ativo e combinação.
- Cadastro/edição de produto simples e variável, com distinção explícita; respostas devem informar `productKind`, quantidade de variantes, estoque agregado de variável e faixa de preços quando relevante.
- Busca de itens vendáveis no PDV por nome do pai, nome/descrição da variante, SKU e barcode; scanner exato resolve **uma variante**, nunca pai variável; simples permanece direto.
- Endpoints de movimento aceitam `variantId` apenas para pai variável; bloqueiam ausência/incompatibilidade; listagem inclui nome pai e rótulo da variante.
- Endpoints de itens de venda aceitam `productId` e `variantId` opcional conforme tipo; preço vem do vendável, salvo overrides já autorizados; snapshots são persistidos no servidor.
- Respostas e erros devem ser estáveis, úteis para UI, com tratamento de duplicidade de código, combinação repetida, falta de estoque, variante inativa e mudança de tipo proibida.
- Paginação, limites e filtros devem evitar N+1 e carregar matrizes inteiras na busca rápida do PDV.

## 6. Experiência de uso — desktop e mobile

### Cadastro de produto

- Alternativa clara **Produto simples / Produto com variações**, sem jargões técnicos.
- Para variável, cadastro principal curto e seção **Variações** com atributos e combinações; editor de variantes em tabela/cards adaptáveis.
- Campos por variante: combinação, SKU, barcode, custo, venda, estoque atual (por movimento inicial/ajuste conforme regra), estoque mínimo, status.
- Ações de adicionar, editar, desativar e visualizar histórico de variante, com mensagens claras quando houver histórico/estoque.
- Não gerar todas as combinações sem confirmação. Evitar campos duplicados e alterações silenciosas de preço.
- Listagem de produtos mostra **uma linha/card por produto pai**, contagem de variantes, estoque total e faixa de preço; permitir expandir detalhes sem poluir a tabela.

### Estoque

- Selecionar produto e, quando variável, a variante obrigatória antes de movimentar; apresentar saldo e mínimo da variante.
- Movimentos e alertas identificam claramente pai + variante. Filtros por produto e variante quando apropriado.

### PDV e fluxos alternativos

- Pesquisa por nome retorna pai com seleção simples de variante (incluindo preço e disponibilidade). Pesquisa por barcode/SKU exato de variante seleciona diretamente a variante correta.
- Produto simples mantém interação atual sem etapa adicional.
- Linha de venda exibe `Produto — Variação`, preço correto e estoque correspondente; ao editar uma linha, preservar ou validar a variante e seus identificadores.
- Aplicar tanto no wizard quanto no `SaleDrawer`/fluxos de ticket legados, evitando caminho que permita vender pai variável sem variante.
- Conferência, recibos A4/80/58 e mobile exibem variação de forma legível sem quebrar layout.
- Acessibilidade básica: labels, foco, teclado/scanner, estados de loading/erro; mobile sem overflow horizontal.

## 7. Relatórios e exportações

- Relatório de produtos oferece visão **consolidada por produto pai** e **detalhada por variante**; não duplicar valores na soma global.
- Vendas antigas de produtos simples continuam como `variantId = null`; relatórios históricos não dependem de nomes atuais do catálogo.
- Agregação não deve fragmentar o mesmo `productId` apenas por renomeação do snapshot; preservar exibição histórica apropriada, com regras claras para agrupamento por IDs e rótulos.
- CSV de produtos deve permitir identificar variante, produto pai, SKU e quantidades/valores correspondentes; manter compatibilidade com exportações existentes onde possível.
- Estoque mínimo e movimentações devem discriminar variantes. Recibos e documentos mostram o snapshot da variação vendida.
- Relatórios de vendedores, clientes, descontos, comissão, pagamentos e recebíveis não podem sofrer regressão.

## 8. Roadmap de execução — 12 fases internas

**Regra de orquestração:** uma única execução do agente integrador. As fases abaixo são checkpoints técnicos internos; **não solicitar aprovação humana entre fases**. Corrigir falhas encontradas e avançar. Não fazer commit, push, deploy ou SSH. Se houver impedimento real não resolvível com o código local, documentar precisamente sem simular conclusão.

### Fase 1 — Fundação e migrations aditivas

**Entregas:** tipo explícito do produto com default simples; tabelas de variantes, atributos, valores, combinações e mecanismo de unicidade cruzada de códigos; `variantId` nullable em linhas e movimentos; índices/FKs/constraints; migrations reversíveis na medida segura. **Aceite:** schema preserva registros existentes; sem backfill destrutivo; integridade tenant e unicidade sob corrida; teste de migrations em banco de teste local quando disponível.

### Fase 2 — Domínio, modelos e atributos

**Entregas:** models Sequelize, associações, validadores e serviços CRUD de atributos/valores/variantes; combinação canônica; regras de desativação e conversão de tipo. **Aceite:** produto simples intacto; combinações duplicadas bloqueadas; preço/códigos próprios; isolamento tenant.

### Fase 3 — Cadastro e listagem

**Entregas:** `ProductFormDialog.js`, `InventoryProductsTab.js`, `inventoryApi.js` e componentes reutilizáveis; tipo simples/variável, editor de combinações e cards mobile; listagem agregada. **Aceite:** iPhone três cores e camiseta cor×tamanho cadastráveis sem duplicar pais; sem conversão automática; UX clara.

### Fase 4 — Estoque por variante

**Entregas:** `CreateInventoryStockMovementService`, listagens, `InventoryStockTab.js`, `StockMovementFormDialog.js`, saldos/alertas, movimentos `initial`, locks por vendável. **Aceite:** movimentar Azul não altera Laranja/Cinza; pai apenas soma; ledger preservado; política de estoque negativo respeitada.

### Fase 5 — Identidade comercial e scanner

**Entregas:** integração de SKU/barcode de produtos simples e variantes, mecanismo transacional de unicidade, busca exata e parcial, ranking e limites, `saleProductSearch.js`. **Aceite:** scanner de variante identifica folha exata; colisões simples↔variante bloqueadas; mesmo código em empresas diferentes permitido.

### Fase 6 — PDV e itens de venda

**Entregas:** `SaleItemsEditor.js`, add/update/delete de itens, snapshots, seleção de variantes, wizard e `SaleDrawer` legado/ticket. **Aceite:** pai variável nunca entra como linha vendável; preço e estoque da variante corretos; simples sem regressão; descontos intactos.

### Fase 7 — Conclusão, cancelamento e concorrência

**Entregas:** `CompleteInventorySaleService`, `CancelInventorySaleService`, validações de variante ativa na conclusão, locks, movimentos de venda e reversão. **Aceite:** baixa/reversão exata; duas conclusões da última unidade com estoque negativo desabilitado resultam em apenas uma venda concluída; erros transacionais não deixam saldos parciais.

### Fase 8 — Identificadores de unidades

**Entregas:** validação do vínculo entre identificadores e linha/variante; tratamento explícito na troca de variante em draft; edição e visualização em desktop/mobile. **Aceite:** identificadores não migram silenciosamente entre variantes; cancelamento preserva histórico; sem exigir unicidade global nova.

### Fase 9 — Recibos, relatórios e CSV

**Entregas:** snapshots e exibição da variante em recibos A4/80/58; relatório por pai/variante, estoque e movimentações, exportação CSV. **Aceite:** valores agregados não duplicam; vendas antigas continuam legíveis; snapshots sobrevivem à renomeação/desativação.

### Fase 10 — Permissões, multiempresa e compatibilidade

**Entregas:** revisão de endpoints, escopos `companyId`, FKs/guards, autorização, exclusão/desativação, contratos legados. **Aceite:** IDOR bloqueado; variante de outra empresa/produto não pode ser usada; produtos simples e vendas históricas preservados.

### Fase 11 — Acabamento de interface

**Entregas:** refinamentos desktop/mobile em cadastro, estoque, PDV, conferência e relatórios; estados vazios, mensagens de erro, acessibilidade, teclado/scanner, responsividade. **Aceite:** sem scroll horizontal inesperado; seleção clara de cor/tamanho; sem regressão do editor de descontos e autosave.

### Fase 12 — Testes integrados e hardening

**Entregas:** testes backend/frontend de casos críticos, lint/typecheck/build disponíveis, revisão de queries/índices, documentação operacional e relatório consolidado. **Aceite:** matriz da seção 9 coberta; testes existentes relevantes passam; falhas e limitações explicitadas; nenhum deploy automático.

## 9. Matriz obrigatória de testes e aceite

| ID | Cenário | Resultado obrigatório |
|---|---|---|
| T01 | Produto simples antigo | CRUD, busca, venda, estoque e recibo sem alteração de comportamento |
| T02 | iPhone Azul/Laranja/Cinza | Um pai, três preços/custos/códigos/saldos independentes |
| T03 | Camiseta Cor × Tamanho | Combinações selecionadas, sem duplicatas nem geração compulsória |
| T04 | Venda por nome | Exige escolha da variante antes de adicionar linha |
| T05 | Venda por barcode/SKU | Seleciona diretamente a variante exata |
| T06 | Baixa de estoque | Debita apenas variante vendida |
| T07 | Cancelamento | Reverte apenas variante original e preserva snapshots |
| T08 | Movimento manual | Exige variante de pai variável; simples segue atual |
| T09 | SKU/barcode | Sem colisão entre simples e variante no mesmo tenant, inclusive corrida |
| T10 | Isolamento | Mesmos códigos em tenants distintos permitidos; acesso cruzado negado |
| T11 | IMEI/serial | Troca de variante exige limpeza/revisão, sem vínculo silencioso |
| T12 | Descontos | R$/%, individual/global, arredondamentos intactos |
| T13 | Frete e comissão | Fórmulas atuais inalteradas |
| T14 | Pagamentos e Crédito da Loja | Split/recebíveis baseados no total correto |
| T15 | Relatórios | Pai consolidado, variante detalhada, sem dupla contagem |
| T16 | Recibos | A4/80/58 exibem variante e valores históricos corretos |
| T17 | Variante inativa | Não adicionável/concluível em nova venda; histórico/cancelamento íntegros |
| T18 | Última unidade | Concorrência sem oversell quando estoque negativo proibido |
| T19 | Venda histórica | `variantId null` e snapshots preservados após migration |
| T20 | Fluxo legado | `SaleDrawer`/ticket não contorna seleção e validação |
| T21 | Mobile | Cadastro, seleção e estoque utilizáveis sem overflow |
| T22 | Exclusão/conversão | Histórico protegido; mudanças perigosas bloqueadas |
| T23 | Migration | Execução em base de teste com dados legados e rollback seguro quando aplicável |
| T24 | Produto sem variantes ativas | Pai não vendável, mensagem clara |
| T25 | Saldo mínimo | Alertas por variante, agregado do pai apenas informativo |

**Testes automatizados prioritários:** backend de transações e concorrência (T06–T10, T17–T19, T22); frontend de seleção/scanner e editor (T01–T05, T11, T20–T21); integração de pagamentos/descontos e snapshots (T12–T16). Preferir testes determinísticos e isolamento de dados por tenant.

## 10. Riscos e mitigação

| Risco | Mitigação mandatória |
|---|---|
| Estoque duplicado pai/filho | Apenas variante armazena saldo em produto variável; pai agrega em leitura |
| Código duplicado entre tabelas | Registro/constraint unificado com transação; testar corrida |
| Venda sem variante | Validação backend em add/update/complete e nos fluxos legados |
| Cancelamento na variante errada | Persistir `variantId` na linha/movimento e restaurar pela referência histórica |
| IDs cruzados entre empresas | Validar cadeia `companyId → productId → variantId` em toda operação |
| Desativação/renomeação | Snapshots e política de exclusão/conversão segura |
| IMEI herdado ao trocar variante | Limpar mediante confirmação ou bloquear até revisão explícita |
| Histórico/relatórios fragmentados | Agrupar por IDs estáveis e apresentar snapshots históricos |
| Custo de busca/N+1 | Índices, paginação, busca vendável e carregamento sob demanda |
| Regressão no PDV | Cobrir wizard + drawer + scanner + descontos + pagamentos |
| Migrations em produção | Primeiro aplicar/testar integralmente em TESTE; promoção posterior e manual |

## 11. Plano de entrega, Git e ambientes

1. **Antes da execução:** verificar branch/HEAD e working tree; preservar alterações preexistentes; não limpar arquivos de terceiros nem incluir mudanças não relacionadas.
2. **Execução autônoma local:** agente integrador implementa as 12 fases, delega tarefas independentes a subagentes quando disponíveis, integra alterações em arquivos compartilhados e executa testes necessários. Não solicitar checkpoints humanos rotineiros.
3. **Documentação:** atualizar este roadmap com status por fase e decisões técnicas efetivas; criar notas de migração/uso se necessário, sem substituir o roadmap por resumo vago.
4. **Entrega do agente:** relatório único com fases, migrations, arquivos principais, testes, falhas conhecidas e instruções de atualização. **Sem commit, push, SSH, deploy, restart ou execução de migration em VPS.**
5. **Publicação:** usuário revisa entrega e realiza commit/push manualmente. Atualização e migrations pelo procedimento normal do painel Super Admin **na VPS de TESTE**.
6. **Homologação:** usuário valida funcionalmente em TESTE. Seu aceite explícito é suficiente; não exigir prints, testes repetidos ou aprovações por fase.
7. **Produção:** somente após aprovação completa de TESTE, promover via procedimento normal e validar inicialização/funcionamento em produção. Nunca promover fases parciais automaticamente.

## 12. Critérios para declarar roadmap concluído

- Todas as 12 fases implementadas e integradas, ou impedimentos explicitamente reportados (não mascarar pendências como concluídas).
- T01–T25 cobertos por testes automatizados ou justificativa técnica para validação manual, com evidência de resultados no relatório do agente.
- Migrations aditivas seguras, compatíveis com dados antigos, sem conversão automática de catálogo.
- Estoque, preços, códigos, seleção e cancelamento operam por variante; simples permanece intacto.
- Permissões, isolamento multiempresa, relatórios, recibos, descontos e pagamentos preservados.
- Build/testes relevantes executados com resultados registrados.
- **Homologação de TESTE aprovada pelo usuário** e, posteriormente, deploy de produção realizado pelo usuário. Implementação local e aprovação de TESTE são estados diferentes.

## 13. Orientação para o agente executor

- Tratar este documento como **contrato de implementação**; investigar apenas detalhes necessários à execução, sem repetir auditoria geral.
- Respeitar padrões reais de Sequelize, TypeScript, Express, React e testes do projeto; não introduzir dependências ou abstrações desnecessárias.
- Manter mudanças concentradas no módulo de Estoque e Vendas e seus contratos compartilhados indispensáveis.
- Não executar alterações destrutivas em banco; se uma decisão exigir migração perigosa ou risco não resolvido, implementar o caminho seguro e registrar impedimento.
- Não confundir `productId` (agrupador/legado) com `variantId` (vendável variável).
- Corrigir regressões encontradas autonomamente; só interromper por decisão de negócio verdadeiramente ambígua ou bloqueio incontornável.
- Não usar subagentes concorrentes nos mesmos arquivos sem integração coordenada.
- Não fazer commit, push, deploy ou SSH; deixar working tree pronta para revisão e publicação manual.

---

**Status inicial das fases 1–12:** PENDENTE.  
**Próxima ação:** salvar este arquivo no repositório e executar um único prompt autônomo referenciando este roadmap.
