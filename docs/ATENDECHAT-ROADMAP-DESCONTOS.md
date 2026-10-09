# ATENDECHAT --- ROADMAP DE DESCONTOS DO PDV

**Módulo:** Estoque e Vendas / PDV\
**Status:** especificação aprovada para implementação autônoma\
**Objetivo:** evoluir o desconto atual em valor monetário por linha para
um domínio seguro de descontos por item e por venda, em R\$ ou %,
preservando compatibilidade histórica, autoridade financeira do backend
e integração com comissão, pagamentos, Crédito da Loja, Contas a
Receber, frete, recibos e relatórios.

------------------------------------------------------------------------

## 1. Contexto atual confirmado

O sistema atual possui desconto monetário por linha de item.

Fórmulas atuais:

-   `lineSubtotal = roundMoney(unitPrice × quantity)`
-   `lineDiscount = item.discountAmount`
-   `lineTotal = roundMoney(lineSubtotal - lineDiscount)`
-   `sale.subtotalAmount = Σ lineSubtotal`
-   `sale.discountAmount = Σ item.discountAmount`
-   `merchandiseTotal = Σ lineTotal`
-   `sale.totalAmount = roundMoney(merchandiseTotal + freightAmount)`
-   `commissionBase = sale.totalAmount - freightAmount`

Semântica histórica obrigatória:

-   `InventorySaleItem.discountAmount` é desconto monetário da **linha
    inteira**, não por unidade.
-   `InventorySale.discountAmount` é a soma dos descontos monetários das
    linhas.
-   Vendas antigas não podem ter essa semântica reinterpretada.
-   Frete é separado dos produtos.
-   Comissão atualmente usa mercadoria líquida, sem frete.
-   Pagamentos, Crédito da Loja e Contas a Receber trabalham sobre
    `sale.totalAmount`.
-   Estoque trabalha por quantidade/custo e não depende do desconto.

Risco atual a corrigir neste roadmap: o backend aceita desconto
monetário superior ao bruto da linha, podendo produzir total negativo.

------------------------------------------------------------------------

## 2. Objetivos funcionais

Ao final, o PDV deverá suportar:

1.  desconto por item em **R\$**;
2.  desconto por item em **%**;
3.  desconto global da venda em **R\$**;
4.  desconto global da venda em **%**;
5.  combinação de desconto por item + desconto global;
6.  desconto global aplicado somente à mercadoria, nunca ao frete;
7.  comissão calculada após todos os descontos da mercadoria e sem
    frete;
8.  governança por percentual máximo sem autorização;
9.  autorização explícita acima do limite, com motivo e auditoria;
10. recibos claros;
11. relatórios de descontos concedidos;
12. compatibilidade integral com vendas históricas;
13. proteção backend contra totais negativos e manipulação de valores;
14. integração correta com pagamentos múltiplos, Crédito da Loja e
    Contas a Receber.

------------------------------------------------------------------------

## 3. Regras de produto aprovadas

### 3.1 Desconto por item

O desconto continua pertencendo à **linha**.

Para uma linha:

`lineGross = roundMoney(unitPrice × quantity)`

#### Tipo `fixed`

O operador informa um valor em R\$.

Exemplo:

-   preço unitário: R\$ 100
-   quantidade: 3
-   desconto: R\$ 10
-   bruto da linha: R\$ 300
-   desconto da linha: R\$ 10
-   líquido: R\$ 290

Isso preserva exatamente a semântica atual.

#### Tipo `percentage`

O operador informa percentual.

Exemplo:

-   preço unitário: R\$ 100
-   quantidade: 3
-   desconto: 10%
-   bruto da linha: R\$ 300
-   desconto monetário calculado: R\$ 30
-   líquido: R\$ 270

Fórmula:

`itemDiscountAmount = roundMoney(lineGross × discountPercent / 100)`

O percentual incide sobre o **bruto da linha**, não individualmente
sobre cada unidade.

### 3.2 Desconto global da venda

É um desconto independente dos descontos dos itens.

Ordem obrigatória:

1.  calcular bruto de cada linha;
2.  aplicar desconto de cada linha;
3.  somar mercadoria líquida após descontos dos itens;
4.  aplicar desconto global sobre essa base;
5.  somar frete;
6.  obter total final.

Definições:

-   `grossMerchandise = Σ lineGross`
-   `itemDiscountTotal = Σ itemDiscountAmount`
-   `merchandiseAfterItemDiscounts = grossMerchandise - itemDiscountTotal`
-   `saleGlobalDiscountAmount = desconto global calculado`
-   `netMerchandise = merchandiseAfterItemDiscounts - saleGlobalDiscountAmount`
-   `sale.totalAmount = netMerchandise + freightAmount`

### 3.3 Desconto global em percentual

Fórmula:

`saleGlobalDiscountAmount = roundMoney(merchandiseAfterItemDiscounts × saleGlobalDiscountPercent / 100)`

Exemplo:

-   produtos brutos: R\$ 1.000
-   descontos nos itens: R\$ 100
-   base após itens: R\$ 900
-   desconto global: 10% = R\$ 90
-   frete: R\$ 30
-   total: R\$ 840

### 3.4 Desconto global em R\$

O valor monetário informado é abatido diretamente de
`merchandiseAfterItemDiscounts`.

### 3.5 Frete

Frete **não participa da base de desconto**.

Nenhum desconto de item ou global pode reduzir o frete.

### 3.6 Comissão

Preservar a filosofia atual:

`commissionBase = netMerchandise`

Ou equivalentemente:

`commissionBase = sale.totalAmount - freightAmount`

A comissão é calculada após descontos de item e desconto global, sem
frete.

### 3.7 Autoridade financeira

O frontend pode oferecer preview, mas **não é autoridade**.

O backend deve recalcular e validar:

-   bruto das linhas;
-   desconto monetário derivado de percentual;
-   descontos agregados;
-   desconto global;
-   total líquido de mercadoria;
-   frete;
-   total final;
-   percentual efetivo para governança;
-   comissão.

Nunca confiar em totais calculados pelo cliente.

------------------------------------------------------------------------

## 4. Precisão e arredondamento

Manter compatibilidade com a política monetária atual do módulo, com
valores persistidos em `DECIMAL(12,2)` e cálculo monetário arredondado
para centavos.

Regras:

-   percentual do item é aplicado sobre o bruto da linha e o valor
    monetário resultante é arredondado para 2 casas;
-   percentual global é aplicado sobre a mercadoria líquida após
    descontos dos itens e arredondado para 2 casas;
-   o valor monetário persistido é a autoridade financeira para a venda
    concluída;
-   não distribuir artificialmente o desconto global entre itens apenas
    para fechar o total;
-   não usar o percentual para recalcular vendas históricas concluídas;
-   proteger edge cases de ponto flutuante com os helpers financeiros
    existentes ou evolução segura deles.

Casos obrigatórios:

-   R\$ 29,90 × 10% → desconto monetário conforme `roundMoney`;
-   múltiplas unidades;
-   percentual fracionário permitido conforme validação definida;
-   valores que produzam fração de centavo;
-   desconto igual a 100% da base;
-   tentativa de desconto superior à base.

------------------------------------------------------------------------

## 5. Invariantes financeiras obrigatórias

O backend deve impedir:

-   desconto de item \< 0;
-   desconto monetário do item \> bruto da linha;
-   percentual \< 0;
-   percentual \> 100%, salvo se uma regra futura explícita alterar
    isso;
-   desconto global \< 0;
-   desconto global \> mercadoria disponível após descontos dos itens;
-   mercadoria líquida negativa;
-   `sale.totalAmount` negativo;
-   tentativa de contornar limite de desconto escolhendo R\$ em vez de
    %.

Desconto de 100% pode produzir mercadoria líquida R\$ 0 quando
autorizado pelas regras de governança, mas nunca valor negativo.

------------------------------------------------------------------------

## 6. Modelo de dados

### 6.1 Compatibilidade

Não alterar a semântica histórica de:

-   `InventorySaleItem.discountAmount`;
-   `InventorySale.discountAmount`.

`InventorySale.discountAmount` deve continuar significando **soma dos
descontos dos itens**.

Não reutilizá-lo como desconto global.

### 6.2 Item

Evoluir `InventorySaleItem` com campos conceitualmente equivalentes a:

-   `discountType`: `fixed | percentage`;
-   `discountPercent`: percentual original, nullable;
-   `discountAmount`: valor monetário calculado/persistido já existente.

Para registros históricos:

-   ausência de `discountType` deve ser tratada de maneira compatível
    como desconto monetário legado;
-   não reinterpretar `discountAmount` histórico como percentual;
-   evitar backfill destrutivo ou desnecessário.

A implementação deve escolher defaults/nullability que preservem leitura
das vendas antigas.

### 6.3 Venda --- desconto global

Criar campos próprios e semanticamente inequívocos, conceitualmente:

-   `globalDiscountType`;
-   `globalDiscountPercent`;
-   `globalDiscountAmount`.

Os nomes finais devem respeitar os padrões do projeto, mas não podem
colidir semanticamente com `InventorySale.discountAmount`.

### 6.4 Auditoria de autorização

Quando desconto ultrapassar o limite sem autorização, deve ser
bloqueado.

Quando for autorizado, persistir trilha suficiente para responder:

-   quem autorizou;
-   quando;
-   motivo;
-   percentual efetivo;
-   valor/base envolvidos;
-   venda;
-   empresa.

Preferir entidade de auditoria dedicada se isso for mais consistente com
o domínio atual. Não sobrecarregar campos da venda se isso reduzir
rastreabilidade.

------------------------------------------------------------------------

## 7. Governança de desconto

### 7.1 Configuração por empresa

Adicionar em `InventorySettings` configuração de percentual máximo que
pode ser concedido sem autorização.

Conceito:

`maxDiscountPercentWithoutAuthorization`

A configuração é por `companyId`.

Definir default conservador e compatível durante a implementação,
evitando bloquear silenciosamente operações existentes. O roadmap exige
que a escolha final do default seja documentada no relatório de
implementação.

### 7.2 Percentual efetivo

Para desconto informado em R\$, calcular percentual efetivo sobre a base
correspondente.

Item:

`effectivePercent = discountAmount / lineGross × 100`

Global:

`effectivePercent = globalDiscountAmount / merchandiseAfterItemDiscounts × 100`

A mesma política de autorização deve valer para R\$ e %.

### 7.3 Permissões

Criar permissões coerentes com o namespace atual, incluindo capacidade
equivalente a:

-   conceder desconto normal na venda;
-   autorizar desconto acima do limite configurado;
-   gerenciar configuração/limite, se a permissão de settings atual não
    for suficiente.

Preservar o modelo de bypass existente para admin/superadmin/suporte
quando aplicável.

Não permitir que a UI seja a única barreira; backend deve validar
permissão.

### 7.4 Autorização acima do limite

Se qualquer desconto relevante ultrapassar o limite:

-   bloquear conclusão/alteração sem autorização válida;
-   permitir autorização apenas a usuário com permissão;
-   exigir motivo;
-   registrar auditoria.

O desenho deve evitar que o operador contorne a regra dividindo desconto
entre mecanismos diferentes. A implementação deve avaliar o **desconto
efetivo total da mercadoria** para governança global, além dos descontos
individuais, de forma documentada e testada.

------------------------------------------------------------------------

## 8. UX --- desconto por item

No editor de produtos da venda:

-   manter campo de desconto;
-   adicionar seletor compacto `R$ | %`;
-   preservar boa operação desktop/mobile;
-   `R$` usa input monetário;
-   `%` usa input numérico adequado;
-   preview do líquido da linha deve reagir imediatamente;
-   quantidade \> 1 deve deixar claro que o desconto pertence à linha;
-   edição de draft deve restaurar tipo, percentual e valor
    corretamente;
-   vendas concluídas permanecem somente leitura conforme regra atual.

Evitar UX técnica. O operador deve entender imediatamente:

-   preço/quantidade;
-   desconto;
-   total do item.

------------------------------------------------------------------------

## 9. UX --- desconto da venda

Adicionar seção clara de **Desconto da venda** no fluxo de criação,
preferencialmente junto ao resumo/totais em ponto anterior à confirmação
do pagamento.

Permitir:

-   sem desconto;
-   desconto em R\$;
-   desconto em %.

Exibir em tempo real:

-   subtotal bruto dos produtos;
-   descontos nos itens;
-   subtotal após descontos dos itens;
-   desconto da venda;
-   frete;
-   total final.

A UX não deve exigir distribuir desconto global entre produtos.

Na Conferência, mostrar claramente os dois níveis de desconto.

------------------------------------------------------------------------

## 10. Pagamentos

Todos os meios de pagamento devem continuar usando `sale.totalAmount`
autoritativo após:

-   descontos dos itens;
-   desconto global;
-   frete.

Validar regressão de:

-   dinheiro;
-   PIX;
-   débito;
-   crédito;
-   parcelamento de cartão;
-   múltiplos pagamentos;
-   saldo pendente;
-   pagamento parcial, quando aplicável.

Alterar desconto de draft deve invalidar/reconciliar qualquer estado de
pagamento incompatível conforme regras existentes, sem permitir
alocações superiores ao novo total.

------------------------------------------------------------------------

## 11. Crédito da Loja

Crédito da Loja deve financiar somente o valor líquido efetivamente
alocado após todos os descontos.

Exemplo obrigatório:

-   mercadoria após descontos + frete conforme total: R\$ 900;
-   PIX: R\$ 300;
-   Crédito da Loja: R\$ 600;
-   receivable: R\$ 600;
-   `creditUsed`: +R\$ 600.

Não criar recebível sobre valores brutos pré-desconto.

Preservar:

-   schedule;
-   parcelas;
-   limite;
-   override;
-   Contas a Receber;
-   baixa;
-   estorno.

------------------------------------------------------------------------

## 12. Contas a Receber

Nenhum desconto deve criar divergência entre:

-   total da venda;
-   linhas de pagamento;
-   valor financiado;
-   receivable;
-   installments;
-   `openAmount`;
-   `creditUsed`.

Testar venda com desconto de item, desconto global e pagamento misto.

------------------------------------------------------------------------

## 13. Estoque

Desconto não altera:

-   quantidade baixada;
-   custo;
-   identificação/serial/IMEI;
-   movimentação;
-   restauração de estoque no cancelamento.

Executar regressão para confirmar.

------------------------------------------------------------------------

## 14. Cancelamento

Venda cancelada deve preservar historicamente:

-   tipo de desconto;
-   percentual original quando houver;
-   valor monetário dos descontos;
-   desconto global;
-   autorização/motivo/auditoria.

Cancelamento não deve reinterpretar nem recalcular semanticamente
descontos históricos.

Preservar regras atuais de estoque, comissão, pagamentos, Crédito da
Loja e Contas a Receber.

------------------------------------------------------------------------

## 15. Recibos / cupons

Preservar infraestrutura e geometria já homologadas:

-   A4;
-   thermal80;
-   thermal58;
-   branding;
-   logo;
-   cabeçalho;
-   rodapé;
-   impressão isolada.

Não redesenhar o motor de impressão.

### 15.1 Item com percentual

Quando houver percentual, apresentar de forma compreensível, por
exemplo:

`Desconto 10% (-R$ 30,00)`

Para desconto monetário:

`Desconto (-R$ 10,00)`

### 15.2 Totais

Resumo conceitual:

-   Subtotal dos produtos
-   Descontos nos itens
-   Desconto da venda --- 10% (quando percentual)
-   Frete
-   **TOTAL**

Não mostrar desconto global artificialmente dentro de um produto.

Vendas históricas devem continuar imprimindo corretamente.

------------------------------------------------------------------------

## 16. Relatórios

Evoluir relatórios relevantes para permitir enxergar descontos
concedidos.

No mínimo disponibilizar:

-   desconto total concedido;
-   desconto nos itens;
-   desconto global.

Quando tecnicamente adequado, permitir métricas/colunas adicionais sem
quebrar contratos existentes.

Receita/faturamento/ticket médio devem continuar usando os valores
líquidos conforme semântica atual.

Não somar frete como desconto nem alterar silenciosamente métricas
históricas.

------------------------------------------------------------------------

## 17. Configurações

Adicionar configuração de governança na área de Configurações do Estoque
e Vendas.

UX deve explicar em linguagem simples, por exemplo:

**Desconto máximo sem autorização**

Descrição conceitual:

"Até este percentual, vendedores autorizados podem conceder desconto
normalmente. Acima dele, será necessária autorização de um usuário com
permissão."

Evitar termos técnicos.

------------------------------------------------------------------------

## 18. API e segurança

Backend deve ser autoridade para:

-   tipo;
-   percentual;
-   valor monetário;
-   base;
-   limite;
-   autorização;
-   total.

Schemas devem rejeitar payloads inválidos.

Não confiar em:

-   `discountAmount` calculado pelo frontend para desconto percentual;
-   percentual efetivo enviado pelo frontend;
-   total final enviado pelo frontend;
-   indicação frontend de que autorização é válida.

Validar sempre `companyId` a partir da sessão/contexto autenticado.

Nenhuma entidade de auditoria/configuração pode atravessar tenant.

------------------------------------------------------------------------

## 19. Compatibilidade histórica

Obrigatório:

-   vendas antigas abrem normalmente;
-   recibos antigos continuam corretos;
-   desconto monetário histórico mantém significado de desconto da
    linha;
-   `InventorySale.discountAmount` continua sendo soma de descontos dos
    itens;
-   ausência de novos campos deve possuir fallback seguro;
-   nenhuma venda concluída antiga deve ser recalculada;
-   não gerar desconto global retroativo;
-   não gerar auditoria retroativa fictícia.

Se migrations forem necessárias, devem ser aditivas e compatíveis.

------------------------------------------------------------------------

## 20. Casos numéricos obrigatórios

### Caso A --- item R\$

-   R\$ 100 × 1
-   desconto R\$ 10
-   líquido R\$ 90

### Caso B --- linha R\$

-   R\$ 100 × 3
-   desconto R\$ 10
-   líquido R\$ 290

### Caso C --- linha %

-   R\$ 100 × 3
-   desconto 10%
-   desconto monetário R\$ 30
-   líquido R\$ 270

### Caso D --- centavos

-   R\$ 29,90
-   desconto 10%
-   validar arredondamento monetário determinístico

### Caso E --- item + global

-   bruto R\$ 1.000
-   descontos dos itens R\$ 100
-   base global R\$ 900
-   desconto global 10% = R\$ 90
-   líquido mercadoria R\$ 810

### Caso F --- frete

Caso E + frete R\$ 30:

-   mercadoria líquida R\$ 810
-   frete R\$ 30
-   total R\$ 840

### Caso G --- comissão

Caso E, comissão 10%:

-   base R\$ 810
-   comissão R\$ 81

### Caso H --- pagamento misto

-   total autoritativo R\$ 900
-   PIX R\$ 300
-   Crédito da Loja R\$ 600
-   receivable R\$ 600

### Caso I --- desconto inválido

-   bruto da linha R\$ 100
-   desconto R\$ 101
-   backend deve rejeitar

### Caso J --- 100%

-   base R\$ 100
-   desconto 100%
-   líquido R\$ 0
-   permitido somente conforme governança/permissões;
-   nunca negativo.

------------------------------------------------------------------------

## 21. Testes obrigatórios

### Backend

Cobrir:

-   fixed item;

-   percentage item;

-   quantity \> 1;

-   centavos;

-   desconto zero;

-   100%;

-   100%;

-   fixed maior que base;

-   global fixed;

-   global percentage;

-   item + global;

-   frete fora da base;

-   comissão após ambos;

-   limite de desconto;

-   R\$ convertido em percentual efetivo para governança;

-   autorização válida;

-   autorização sem permissão;

-   autorização sem motivo;

-   tenant isolation;

-   conclusão da venda;

-   múltiplos pagamentos;

-   Crédito da Loja;

-   receivable;

-   cancelamento;

-   compatibilidade de venda legada.

### Frontend

Cobrir:

-   seletor R\$ / % por item;
-   digitação monetária;
-   digitação percentual;
-   quantidade \> 1;
-   preview;
-   desconto global;
-   resumo/totais;
-   validações;
-   configuração do limite;
-   autorização/motivo;
-   Conferência;
-   venda concluída;
-   recibo;
-   i18n pt/en/es;
-   venda histórica.

### Impressão

Cobrir:

-   A4;
-   80mm;
-   58mm;
-   fixed;
-   percentage;
-   global;
-   item + global;
-   venda antiga.

------------------------------------------------------------------------

## 22. Critérios de aceite

### A. Item

-   operador escolhe R\$ ou %;
-   quantidade \> 1 respeita desconto da linha;
-   backend recalcula;
-   total nunca negativo.

### B. Venda

-   existe desconto global independente;
-   aceita R\$ ou %;
-   incide após descontos dos itens;
-   não incide sobre frete;
-   não é artificialmente atribuído a produto.

### C. Financeiro

-   comissão usa mercadoria líquida;
-   pagamentos usam total final;
-   Crédito da Loja financia somente alocação líquida;
-   Contas a Receber não recebe bruto pré-desconto.

### D. Governança

-   existe limite por empresa;
-   R\$ e % obedecem mesma política;
-   acima do limite exige permissão + motivo;
-   auditoria registra autorização.

### E. Histórico

-   vendas antigas permanecem intactas;
-   sem recálculo retroativo;
-   recibos antigos continuam válidos.

### F. Recibo

-   desconto percentual mostra % + R\$;
-   desconto global aparece separado;
-   frete permanece separado;
-   58/80/A4 preservados.

### G. Relatórios

-   descontos concedidos são mensuráveis;
-   receita/ticket continuam coerentes com líquido.

------------------------------------------------------------------------

## 23. Fora de escopo

Não implementar neste roadmap:

-   cupons promocionais;
-   códigos de desconto;
-   campanhas automáticas;
-   promoções por período;
-   "leve 3 pague 2";
-   desconto por categoria automático;
-   cashback;
-   programa de fidelidade;
-   preço atacado automático;
-   integração externa de promoções;
-   aprovação remota por WhatsApp;
-   juros/acréscimos como "desconto negativo".

Esses temas podem usar a fundação no futuro, mas não devem ampliar esta
entrega.

------------------------------------------------------------------------

## 24. Fases de implementação

### Fase 1 --- Fundação e compatibilidade

-   migrations aditivas;
-   novos campos de item;
-   campos próprios de desconto global;
-   settings;
-   auditoria/autorização;
-   models/associações;
-   fallback legado;
-   constraints seguras.

**Gate:** models/migrations/typecheck/testes de compatibilidade.

### Fase 2 --- Motor financeiro backend

-   helpers de desconto;
-   fixed/%;
-   invariantes;
-   recálculo da venda;
-   global;
-   frete;
-   arredondamento;
-   autoridade backend.

**Gate:** casos A--F e I/J.

### Fase 3 --- Comissão e integrações financeiras

-   comissão pós-desconto;
-   payments;
-   múltiplos pagamentos;
-   Crédito da Loja;
-   Contas a Receber;
-   cancelamento.

**Gate:** casos G/H + regressões financeiras.

### Fase 4 --- Governança

-   configuração por empresa;
-   percentual efetivo;
-   permissões;
-   autorização;
-   motivo;
-   auditoria;
-   tenant isolation.

**Gate:** matriz de autorização/permissões.

### Fase 5 --- UX desconto por item

-   R\$ / %;
-   inputs;
-   preview;
-   autosave/draft;
-   drawer/legado;
-   validações.

**Gate:** testes FE item + compatibilidade.

### Fase 6 --- UX desconto global

-   seção Desconto da venda;
-   R\$ / %;
-   totais;
-   frete separado;
-   Conferência;
-   sucesso/detalhes.

**Gate:** testes FE venda completa.

### Fase 7 --- Configurações e permissões UI

-   limite sem autorização;
-   UI de permissões;
-   motivo/autorização;
-   i18n.

**Gate:** testes de acesso e UX.

### Fase 8 --- Recibos

-   fixed;
-   percentual;
-   global;
-   resumo;
-   compatibilidade histórica;
-   A4/80/58.

**Gate:** testes de impressão/geometria.

### Fase 9 --- Relatórios

-   descontos concedidos;
-   item/global;
-   preservar métricas líquidas;
-   filtros/exports existentes quando aplicável.

**Gate:** testes de agregação.

### Fase 10 --- Hardening e regressão

-   matriz completa;
-   multi-tenant;
-   legado;
-   arredondamento;
-   pagamentos;
-   estoque;
-   comissão;
-   Crédito da Loja;
-   AR;
-   cancelamento;
-   i18n;
-   build.

**Gate final:** nenhuma regressão conhecida bloqueante.

------------------------------------------------------------------------

## 25. Estratégia de execução autônoma

Este roadmap foi preparado para execução integral por agente de código.

Ao receber ordem de implementação:

1.  fazer checkpoint do repositório;
2.  preservar leftovers;
3.  executar Fases 1--10 em sequência;
4.  usar subagentes para investigações/tarefas independentes quando
    seguro;
5.  manter um integrador responsável pela coerência final;
6.  cumprir o gate de cada fase antes de avançar;
7.  corrigir falhas encontradas durante os gates sem pedir aprovação
    intermediária quando a correção estiver dentro deste contrato;
8.  não ampliar escopo;
9.  não reinterpretar regras aprovadas;
10. finalizar com regressão completa e relatório consolidado.

Não exigir aprovação humana entre fases.

------------------------------------------------------------------------

## 26. Restrições operacionais da implementação

Durante execução autônoma:

-   não acessar VPS/SSH;
-   não fazer deploy;
-   não executar migrations em produção;
-   não fazer push;
-   não fazer commit automaticamente;
-   não descartar leftovers;
-   não usar `git add .` / `git add -A`;
-   não alterar módulos não relacionados sem necessidade demonstrável;
-   não mudar geometria homologada dos recibos;
-   não modificar semanticamente vendas históricas.

O working tree deve ser deixado pronto para revisão humana.

------------------------------------------------------------------------

## 27. Relatório final obrigatório do agente

Ao terminar, reportar:

1.  checkpoint inicial/final;
2.  fases 1--10 e respectivos gates;
3.  migrations criadas;
4.  modelo de dados final;
5.  fórmula financeira final;
6.  regras de arredondamento;
7.  governança/permissões;
8.  auditoria;
9.  UX item/global;
10. comissão;
11. pagamentos;
12. Crédito da Loja;
13. Contas a Receber;
14. estoque/cancelamento;
15. recibos;
16. relatórios;
17. compatibilidade histórica;
18. i18n;
19. lista completa de arquivos;
20. testes e resultados;
21. typecheck/build;
22. riscos/pendências reais;
23. confirmação de ausência de push/deploy/SSH/produção;
24. checklist de homologação manual no ambiente de TESTE.

------------------------------------------------------------------------

## 28. Definition of Done

A entrega só está concluída quando:

-   R\$ e % funcionam por item;
-   R\$ e % funcionam globalmente;
-   matemática é autoritativa no backend;
-   nenhum desconto produz total negativo;
-   frete fica fora da base;
-   comissão usa mercadoria líquida;
-   pagamentos permanecem coerentes;
-   Crédito da Loja/AR permanecem coerentes;
-   governança funciona para R\$ e %;
-   autorização é auditável;
-   recibos mostram descontos corretamente;
-   relatórios mensuram descontos;
-   vendas antigas permanecem compatíveis;
-   tenant isolation é preservado;
-   testes obrigatórios passam;
-   backend typecheck passa;
-   frontend build passa;
-   nenhuma regressão bloqueante permanece.
