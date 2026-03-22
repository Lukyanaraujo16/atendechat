# Evolução do FlowBuilder - Documentação Técnica

## Resumo das Mudanças desta Etapa

### 1. Refinamento do Menu "+"

**Categorias aplicadas:**
- **Mensagens**: Início, Conteúdo
- **Interações**: Menu, Pergunta, Aguardar Interação
- **Atendimento**: Ticket, Setor, Encerrar Ticket, Tag Kanban
- **Integrações**: TypeBot, OpenAI
- **Utilitários**: Randomizador, Intervalo

### 2. Novo Node: waitForInteraction

**Função:** Pausar o fluxo até o cliente enviar qualquer nova mensagem.

**Lógica reutilizada:**
- `flowStopped`, `lastFlowId` no Ticket (mesmo padrão do question)
- Handler em `wbotMessageListener` similar ao question, mas sem validação de resposta nem salvamento em variáveis
- Ao receber qualquer mensagem, encontra a conexão de saída e segue para o próximo nó

**Persistência JSON:**
```json
{
  "id": "...",
  "position": { "x": 0, "y": 0 },
  "data": {},
  "type": "waitForInteraction"
}
```

**Arquivos alterados:**
- `frontend/src/components/FlowBuilderAddNodeMenu/index.js` - Categorias e novo item
- `frontend/src/pages/FlowBuilderConfig/nodes/waitForInteractionNode.js` - Novo componente
- `frontend/src/pages/FlowBuilderConfig/index.js` - Integração
- `backend/src/services/WebhookService/ActionsWebhookService.ts` - Case waitForInteraction
- `backend/src/services/WbotServices/wbotMessageListener.ts` - Handler de retomada

---

## 3. saveVariable – Base para Implementação Futura

### Onde armazenar variáveis do fluxo por ticket

#### Opção A: Campo JSON no Ticket (dataWebhook)

**Estrutura atual:**
- Ticket já possui `dataWebhook` (DataType.JSON)
- Usado hoje por `question` para guardar `{ variables: { [answerKey]: valor } }`

**Vantagens:**
- Já existe e está em uso
- Sem migração
- Sem nova tabela
- Acesso rápido (um SELECT no Ticket)

**Desvantagens:**
- Sem histórico de alterações
- Tamanho limitado por campo JSON do banco
- Menos flexível para queries por variável

**Impacto:** Baixo. Só estender o formato atual.

#### Opção B: Nova tabela específica (TicketFlowVariable)

```sql
TicketFlowVariable:
  - id
  - ticketId (FK)
  - flowId (FK, opcional)
  - variableKey (string)
  - variableValue (text/json)
  - createdAt, updatedAt
```

**Vantagens:**
- Histórico auditável
- Queries por variável
- Escalável para muitos tickets/variáveis

**Desvantagens:**
- Nova migração e modelo
- Mais JOINs nas consultas
- Maior complexidade

### Recomendação

**Usar Opção A (dataWebhook) na primeira versão:**

1. **Compatibilidade:** O question já usa `dataWebhook.variables`; saveVariable pode seguir o mesmo padrão.
2. **Simplicidade:** Sem migração nem nova tabela.
3. **Segurança:** Continua no escopo do ticket e já validado em produção.
4. **Evolução:** Se no futuro for necessário histórico ou queries por variável, é possível:
   - Criar a tabela `TicketFlowVariable`
   - Migrar dados de `dataWebhook` e passar a escrever nos dois lugares
   - Depois remover o uso de variáveis em `dataWebhook`

**Formato sugerido para dataWebhook com saveVariable:**

```json
{
  "variables": {
    "nome_cliente": "João",
    "email": "joao@email.com",
    "opcao_escolhida": "1"
  }
}
```

O node saveVariable gravaria: `{ ...dataWebhook, variables: { ...variables, [key]: value } }`.

---

## 4. Padronização de Nomenclatura

### Situação Atual

| Termo | Onde | Uso |
|------|------|-----|
| sector | type do node | Backend, frontend |
| queue | Model/Tabela | Fila de atendimento (Queue) |
| setor | UI (português) | Label "Setor" nos modais e nós |
| ticket | type do node | Atribuição de fila |

### Convenção adotada

- **Type do node:** `sector` (inglês, técnico) – não alterar para não quebrar fluxos salvos.
- **Label na UI:** "Setor" (português).
- **Dados no JSON:** `data.queue` (refere-se ao model Queue).
- **Backend:** `queueId` no Ticket, `ShowQueueService`, etc.

### Compatibilidade com fluxos antigos

| Garantia | Implementação |
|----------|---------------|
| Nodes sem tipo novo | Ignorados ou sem efeito no backend |
| `sector` com `data.queue` ou `data.id` | Backend lê `data.queue?.id` e `data.id` |
| `tag` com `data.tag` ou `data` | Backend lê `data.tag?.id` e `data.id` |
| Fluxos sem waitForInteraction | Sem impacto; handler só age quando `lastFlowId` aponta para esse tipo |

---

## Arquivos Alterados (Resumo)

| Arquivo | Alteração |
|---------|-----------|
| `frontend/src/components/FlowBuilderAddNodeMenu/index.js` | Novas categorias, item waitForInteraction |
| `frontend/src/pages/FlowBuilderConfig/nodes/waitForInteractionNode.js` | Novo arquivo |
| `frontend/src/pages/FlowBuilderConfig/index.js` | Registro do node, addNode, clickActions |
| `backend/src/services/WebhookService/ActionsWebhookService.ts` | Case waitForInteraction |
| `backend/src/services/WbotServices/wbotMessageListener.ts` | Handler isWaitForInteraction |
| `docs/FLOWBUILDER-EVOLUCAO.md` | Este documento |

---

## Cuidados para não quebrar fluxos antigos

1. **Não alterar `type` de nodes:** Manter `sector`, `tag`, `closeTicket`, etc.
2. **Fallbacks nos dados:** Ler `data.queue?.id || data.id` para sector; `data.tag?.id || data.id` para tag.
3. **Novos handlers:** Só rodar quando o tipo do node corresponder (`node.type === "waitForInteraction"`).
4. **Fluxos sem conexão:** Se waitForInteraction não tiver conexão de saída, o handler não chama ActionsWebhookService (evita erro).
5. **Load de fluxos:** Estrutura de nodes/connections permanece a mesma; o frontend só adiciona um novo `nodeType`.
