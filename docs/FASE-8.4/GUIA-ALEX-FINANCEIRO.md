# Guia do Alex — Financeiro e assinaturas do StreamHUB

Este guia explica, passo a passo, como cuidar das cobranças e assinaturas das empresas clientes.
Tudo é feito pela tela, com o seu usuário de Super Admin. Você nunca precisa mexer em banco de dados ou servidor.

Regra de ouro: **antes de confirmar qualquer coisa, leia a prévia**. A prévia mostra exatamente o que vai acontecer
(se gera receita, se muda o vencimento, se desbloqueia a empresa). Se algo parecer estranho, cancele e pergunte.

---

## 1. Palavras que aparecem na tela

| Termo | O que significa |
|---|---|
| **Vencimento** | Até quando a assinatura da empresa está paga/coberta. |
| **Pagamento atual** | Dinheiro recebido agora, para uma fatura. Conta como receita e normalmente estende o vencimento. |
| **Pagamento histórico** | Dinheiro que o cliente pagou **no passado** (antes da central financeira) e que nunca foi registrado. Conta como receita, mas **não mexe no vencimento** (você já tinha renovado na época). |
| **Cortesia** | Período liberado sem cobrança. **Não é receita.** |
| **Renovação administrativa** | Você estende o vencimento sem registrar pagamento (ex.: acordo comercial). **Não é receita** e não quita fatura. |
| **Ajuste de vencimento** | Você escolhe uma data de vencimento exata (correção). Também não é receita. |
| **Fatura histórica** | Fatura antiga, de antes de 17/10/2026, que pode já ter sido paga a você diretamente. Precisa ser revisada uma por uma. |
| **Conciliação** | Itens em que o sistema e a Efí podem não estar batendo. Precisam da sua conferência. |

## 2. Como localizar uma empresa
1. Menu **Gestão SaaS → Empresas**.
2. Digite o nome na busca. Use os filtros de **Situação financeira** se quiser: *Em dia*, *Vencido*, *Em carência*,
   *Bloqueado financeiramente*, *Bloqueado manualmente*, *Faturas históricas a revisar*.
3. Clique no nome da empresa (ou em **Financeiro** na linha para ir direto ao financeiro).

## 3. Como conferir assinatura e vencimento
Na página da empresa, aba **Financeiro**, o topo mostra a **Central de assinatura**:
- **Três situações separadas** — leia as três:
  - *Operação*: a empresa está ativa ou bloqueada (e se o bloqueio foi manual ou por falta de pagamento).
  - *Financeiro*: em dia, vence hoje, em carência (atrasada, mas ainda sem bloqueio), vencido.
  - *Assinatura*: em dia ou vencida.
  - Atenção: **empresa ativa não quer dizer assinatura paga.** Uma empresa pode estar ativa e vencida.
- Plano, recorrência, valor contratado, vencimento atual e o próximo vencimento caso seja renovada.
- Último pagamento confirmado, próxima cobrança prevista e pendências (faturas abertas, vencidas, conciliação,
  faturas históricas para revisar). Clicar numa pendência leva à lista certa.

## 4. Como registrar um pagamento atual (o cliente pagou agora)
1. Na Central de assinatura, clique em **Registrar pagamento** (ou na ação da fatura em *Cobranças*).
2. Escolha a fatura, informe o **valor recebido** (tem que ser exatamente o valor da fatura), a forma de pagamento,
   a data real do pagamento e uma observação (ex.: "Pix recebido no Banco X").
3. Leia a **prévia**: vencimento anterior → novo vencimento, se a empresa será desbloqueada, se gera receita.
   - Se aparecer "**NÃO haverá renovação — período já coberto**", é porque você já tinha renovado essa empresa antes.
     O pagamento é registrado, mas o vencimento não muda (isso evita renovar duas vezes).
   - Se aparecer "**Continua bloqueada (bloqueio manual)**", a empresa foi bloqueada por outro motivo; o pagamento
     não a desbloqueia sozinho.
   - Se aparecer o aviso de **fatura antiga**, use **Regularizar como histórica** (seção 5) em vez de pagamento atual.
4. Confirme. Se a tela disser "os dados mudaram desde a prévia", clique em recalcular e leia de novo.

O cliente pagou um valor diferente (desconto combinado)? Primeiro **edite a fatura** (Cobranças → Editar, com
justificativa) para o valor combinado, depois registre o pagamento. O sistema não aceita pagamento parcial.

## 5. Como regularizar uma fatura antiga que já foi paga
Use isto para faturas antigas que apareciam abertas para o cliente, mas que ele já pagou a você.
1. Menu **Revisão de históricas** (ou, na empresa, *Cobranças* → filtro **Históricas pendentes** → **Regularizar**).
2. Clique em **Revisar** na fatura. A tela mostra **indícios** (por exemplo, "a assinatura já foi renovada além deste
   ciclo"). **Indício não é prova**: uma renovação antiga não prova que o cliente pagou. Confira no seu extrato/controle.
3. Escolha **Pagamento histórico confirmado** e preencha:
   - **Fonte da confirmação**: onde você confirmou (extrato bancário, comprovante do cliente, seu controle).
   - **Data do pagamento**: a data real. Se você não sabe, marque **"Não sei a data"** — nunca invente uma data.
   - **Valor**: o valor da fatura. **Forma de pagamento**: pode escolher "Não sei" se não lembrar.
   - **Observação**: o que você conferiu.
4. Leia a prévia: deve dizer que **gera receita**, que a fatura ficará **paga** e que **NÃO haverá renovação**.
5. Confirme. Cada fatura só pode ser regularizada uma vez.

Ainda não tem certeza se foi paga? Escolha **Ainda devida / não confirmada** — a fatura continua aberta, fica anotado
que você revisou, e você pode decidir depois.

## 6. Como cancelar uma fatura indevida
Fatura que nunca deveria ter existido (ex.: gerada em duplicidade, cliente já tinha saído):
- Fatura antiga: **Revisar** → **Fatura indevida — cancelar**, com justificativa.
- Fatura atual: em *Cobranças*, **Cancelar**, com justificativa.
Cancelar não gera receita e não apaga a fatura: ela fica no histórico como cancelada. Fatura já paga não pode ser cancelada.

## 7. Como registrar cortesia
- **Cortesia atual** (liberar o próximo período sem cobrar): Central de assinatura → **Conceder cortesia**.
  Estende o vencimento, **não é receita**.
- **Cortesia histórica** (um período antigo que você liberou sem cobrar): **Revisar** a fatura antiga → **Cortesia
  histórica**. Não é receita e **não** mexe no vencimento.

## 8. Como gerar uma fatura
Central de assinatura → **Gerar fatura**: vencimento, valor (já vem o valor contratado), competência (mês/ano),
descrição e justificativa. O sistema **não deixa** criar duas faturas para o mesmo mês da mesma empresa.
Gerar fatura **não** cria cobrança na Efí e **não** envia nada ao cliente.

## 9. Como renovar administrativamente (sem pagamento)
Central de assinatura → **Renovar**. A tela mostra o vencimento atual, o período contratado e o novo vencimento.
Escreva a justificativa e confirme. Clicou duas vezes sem querer? O sistema estende uma vez só.
Renovação administrativa **não registra pagamento** e **não quita fatura** — se o cliente pagou, use *Registrar pagamento*.

Para colocar uma data exata (correção), use **Ajustar vencimento**, com justificativa.

## 10. Como consultar o histórico e a auditoria
Aba Financeiro → **Linha do tempo**: tudo que aconteceu com a empresa, em ordem, com data/hora, valor, quem fez e a
fatura relacionada. Se aparecer "Antes de dd/mm/aaaa não há histórico detalhado registrado", é porque o sistema
ainda não registrava esses eventos naquela época — não é erro.
A aba **Auditoria** mostra os registros técnicos detalhados.

## 11. Como identificar pendências da Efí
- Aba Financeiro → **Conciliação**, e a coluna **Situação na Efí** nas faturas.
- "Baixa somente local" é normal para Pix pago fora do sistema: a Efí não permite dar baixa manual em Pix.
- **"Possível pagamento em duplicidade"**: o cliente pagou pela Efí uma fatura que já estava quitada por outro meio.
  Confira na Efí e combine com o cliente (estorno ou crédito). **Chame o suporte se tiver dúvida.**
- Fatura com cobrança Efí gerada: antes de regularizar como histórica, confira no painel da Efí se ela **não** foi
  paga por Pix (a tela pede essa confirmação).

## 12. Simulação de bloqueios
Gestão SaaS → **Automação de cobrança → Simulação (somente leitura)** mostra quais empresas *seriam* bloqueadas ou
avisadas. **Nada é executado, enviado ou bloqueado** por essa tela. Hoje os bloqueios automáticos estão inativos na
prática; ligá-los é uma decisão a combinar com o suporte técnico.

## 13. NÃO faça (para evitar cobrança ou renovação duplicada)
- **Não** registre *pagamento atual* para uma fatura antiga que você já tinha renovado — use *Regularizar como histórica*.
- **Não** renove e depois registre o pagamento do mesmo mês esperando estender duas vezes (o sistema não estende de novo, de propósito).
- **Não** invente data, valor ou forma de pagamento. Use "Não sei a data" / "Não sei".
- **Não** gere fatura nova se já existe uma aberta para o mesmo mês — use a que existe.
- **Não** registre pela tela e depois peça para "reenviar o Pix" na Efí para a mesma fatura (ou vice-versa) — escolha um caminho.
- **Não** peça para alguém alterar dados "direto no banco". Tudo tem que passar pela tela para ficar auditado.
- **Não** compartilhe sua senha de Super Admin.

## 14. Checklist de conferência de cada empresa
- [ ] As três situações (operação, financeiro, assinatura) fazem sentido para o que você sabe do cliente.
- [ ] O vencimento está correto.
- [ ] Faturas abertas: cada uma é realmente devida? As antigas foram revisadas (paga, indevida, cortesia ou mantida pendente)?
- [ ] Pagamentos recebidos este mês estão registrados (com a data e a forma certas).
- [ ] Nenhum item de conciliação pendente sem explicação.
- [ ] Se a empresa está bloqueada: o motivo (manual ou financeiro) está correto.
- [ ] Linha do tempo sem ações estranhas ou que você não reconhece.

Dúvida ou algo que não bate? Pare e chame o suporte técnico antes de continuar.
