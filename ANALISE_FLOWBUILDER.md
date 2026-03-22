# Análise do Sistema FlowBuilder

## 1. Tipos de Nós/Blocos Existentes no Sistema

| Tipo | Nome no UI | Componente | Descrição |
|------|------------|------------|-----------|
| `start` | Inicio | startNode.js | Nó inicial do fluxo |
| `message` | (dentro de Conteúdo) | messageNode.js | Mensagem de texto |
| `menu` | Menu | menuNode.js | Menu com opções numeradas |
| `interval` | Intervalo | intervalNode.js | Pausa em segundos |
| `img` | (dentro de Conteúdo) | imgNode.js | Envio de imagem |
| `audio` | (dentro de Conteúdo) | audioNode.js | Envio de áudio |
| `video` | (dentro de Conteúdo) | videoNode.js | Envio de vídeo |
| `randomizer` | Randomizador | randomizerNode.js | Saídas aleatórias por percentual |
| `singleBlock` | Conteúdo | singleBlockNode.js | Bloco que agrupa message + interval + img + audio + video em sequência |
| `ticket` | Ticket | ticketNode.js | Direciona para setor (código comentado no backend) |
| `typebot` | TypeBot | typebotNode.js | Integração com Typebot |
| `openai` | OpenAI | openaiNode.js | Integração com IA OpenAI |
| `question` | Pergunta | questionNode.js | Pergunta que aguarda resposta do cliente |
| `condition` | - | **NÃO TEM NODE** | Adicionado em addNode mas sem componente em nodeTypes – cai no default |

**Observação:** O nó `condition` é criado no `addNode` mas não existe `conditionNode` em `nodeTypes` – o fluxo pode salvar, porém não há tratamento no backend.

---

## 2. Onde Cada Tipo é Tratado no Backend

**Arquivo principal:** `backend/src/services/WebhookService/ActionsWebhookService.ts`

O fluxo é executado em `ActionsWebhookService`, chamado por:
- `wbotMessageListener.ts` → `flowbuilderIntegration` / `flowBuilderQueue`
- `DispatchWebHookService.ts` (webhooks externos)

| Tipo | Tratamento no Backend |
|------|------------------------|
| `message` | Linha ~217: `SendMessage` com `nodeSelected.data.label` |
| `typebot` | Linha ~247: `typebotListener` |
| `openai` | Linha ~258: `handleOpenAi` do OpenAiService |
| `question` | Linha ~309: Envia mensagem, atualiza `lastFlowId`, `flowStopped`, dá `break` (aguarda resposta) |
| `ticket` | Linha ~345: **Código comentado** – não opera |
| `singleBlock` | Linha ~428: Loop em `nodeSelected.data.seq`; para cada elemento: message → `SendWhatsAppMessage`, interval → `intervalWhats`, img/audio/video → `SendMessage`/`SendWhatsAppMediaFlow` |
| `randomizer` | Linha ~564: `randomizarCaminho` + escolhe conexão por sourceHandle a/b |
| `menu` | Linha ~586: Monta menu, envia, atualiza ticket com `lastFlowId`/`flowStopped`, dá `break` (aguarda digitação) |
| `interval` | **Não tratado standalone** – só dentro de `singleBlock` |
| `img` | **Não tratado standalone** – só dentro de `singleBlock` |
| `audio` | **Não tratado standalone** – só dentro de `singleBlock` |
| `video` | **Não tratado standalone** – só dentro de `singleBlock` |
| `condition` | **Não tratado** |
| `start` | Pula – só ponto de entrada |

**Outros arquivos:**
- `backend/src/services/WbotServices/wbotMessageListener.ts` – `flowbuilderIntegration`, `flowBuilderQueue`, `handleMessageIntegration`
- `backend/src/services/TypebotServices/typebotListener.ts` – Typebot
- `backend/src/services/IntegrationsServices/OpenAiService.ts` – OpenAI
- `backend/src/controllers/FlowBuilderController.ts` – Upload de img, audio, content
- `backend/src/services/FlowBuilderService/*` – CRUD de fluxos, uploads

---

## 3. Funcionalidades no Backend que NÃO estão no FlowBuilder

| Funcionalidade | Onde existe | Situação no FlowBuilder |
|----------------|-------------|--------------------------|
| **Asaas (2ª via boleto)** | `providers.ts` – fila "2ª Via de Boleto" | Lógica hardcoded por nome de fila, fora do flowbuilder |
| **PIX / Gerencianet** | `providers.ts`, `config/Gn.ts` | Só em providers por fila |
| **Transferência para setor** | `UpdateTicketService`, `Queue` | Nó `ticket` está comentado |
| **Tags** | `Tag`, `TicketTag`, TagController | Não há nó de Tag no flow |
| **Aplicar tag ao ticket** | `TicketTag`, TagController | Não há nó no flow |
| **Encerrar ticket** | `UpdateTicketService` com status closed | Não há nó dedicado |
| **Enviar email** | Nodemailer, ForgotController, etc. | Não há nó de email |
| **HTTP Request** | Axios em vários serviços | Não há nó genérico de HTTP |
| **BlackList/contato bloqueado** | `ToggleDisableBotContactService`, Contact | Não há nó no flow |
| **ContactList (remarketing)** | `ContactList`, `ContactListItem` | Não há nó FlowUp |
| **Notificação ao atendente** | Socket.IO, lógica de ticket | Não há nó de notificação |

---

## 4. Itens da Lista que NÃO Existem e Precisam ser Criados

### Já existem (parcial ou total)

| Item | Status |
|------|--------|
| **Mensagem** | Existe – nó `message` e dentro de `singleBlock` |
| **Pergunta** | Existe – nó `question` |
| **Menu** | Existe – nó `menu` |
| **Condição** | Parcial – frontend cria nó `condition`, backend não trata |
| **Randomizador** | Existe – nó `randomizer` |
| **Espera** | Existe – nó `interval` (só dentro de singleBlock) |
| **Mídia** | Existe – img, audio, video (só dentro de singleBlock) |
| **Setor** | Parcial – nó `ticket` existe, backend comentado |
| **OpenAI** | Existe – nó `openai` |
| **Asaas** | Existe no backend (providers), não como nó do FlowBuilder |

### Não existem – precisam ser criados do zero

| Item | Observação |
|------|------------|
| **Salvar Variável** | Não há sistema de variáveis por ticket/sessão no flow |
| **Menu Lista** | Diferente do menu atual (apenas numerado) |
| **Botões Resposta** | Não há botões interativos (apenas texto) |
| **Botões Interativos** | Não há (SendMessageFlow com templateButtons está comentado) |
| **Fluxo (conectar fluxos)** | Não há nó que chame outro flow |
| **Aguardar Interação** | `question` já faz isso; seria variante |
| **Atendente** | Não há nó para transferir para usuário específico |
| **Encerrar Ticket** | Não há nó explícito |
| **Notificação** | Não há nó de notificação ao atendente |
| **Tag Kanban** | Não há nó para aplicar tag |
| **Chave Pix** | Não há nó no flow |
| **HTTP Request** | Não há nó genérico |
| **Email** | Não há nó de envio de email |
| **Banco de Dados Beta** | Não existe |
| **BlackList** | Não há nó no flow |
| **FlowUp (remarketing)** | Não há nó |
| **Google Calendar** | Não existe |
| **Reagir Mensagem** | Não existe |
| **Botões OficialAPI** | Não existe (Baileys não usa API oficial) |
| **CTA com URL** | Não existe |
| **Carrossel de Mídia** | Não existe |
| **Detalhes do Pedido** | Não existe |

---

## 5. Implementação dos Itens que Não Existem

| Item | Complexidade | Onde implementar |
|------|--------------|------------------|
| **Salvar Variável** | Média | Backend: persistir variáveis em Ticket (JSON) ou nova tabela; `ActionsWebhookService` ler/escrever; Frontend: novo nó + modal |
| **Menu Lista** | Fácil | Variante de `menu` com `listMessage` do Baileys; `ActionsWebhookService`; novo node/modal ou opção no menu |
| **Botões Resposta** | Média | Baileys `buttons`; `ActionsWebhookService`; frontend: nó + modal; validar suporte na lib |
| **Botões Interativos** | Difícil | Depende de API Oficial/Business; Baileys limitado; nova integração |
| **Fluxo (subfluxo)** | Média | `ActionsWebhookService`: ao encontrar nó flow, carregar outro flow e continuar execução (recursivo) |
| **Aguardar Interação** | Fácil | Similar a `question`; novo nó ou parâmetro em `question` |
| **Setor (ativar ticket)** | Fácil | Descomentar e ajustar bloco do nó `ticket` em `ActionsWebhookService` |
| **Atendente** | Média | Novo nó; `UpdateTicketService` com `userId`; frontend: select de usuários |
| **Encerrar Ticket** | Fácil | Novo nó; `UpdateTicketService` status `closed`; seguir para fim do fluxo |
| **Notificação** | Fácil | Novo nó; emitir evento Socket.IO ou criar notificação; definir formato no frontend |
| **Tag Kanban** | Fácil | Novo nó; `TicketTag` create; frontend: select de tags |
| **Chave Pix** | Média | Usar Gerencianet (já configurado); novo nó; buscar/e formatar chave; enviar mensagem |
| **HTTP Request** | Média | Novo nó; axios genérico; config URL, method, body; substituição de variáveis |
| **Email** | Média | Novo nó; Nodemailer; config template; variáveis Mustache |
| **Banco de Dados Beta** | Difícil | Novo serviço; interface para queries; grande superfície de segurança |
| **BlackList** | Fácil | Novo nó; `Contact` update ou `ToggleDisableBotContactService`; frontend: config |
| **FlowUp** | Média | Novo nó; adicionar contato a ContactList; frontend: select de lista |
| **Google Calendar** | Difícil | OAuth, API Google; novo serviço; escopo grande |
| **Reagir Mensagem** | Média | `wbot.sendMessage` com `react`; novo nó; Baileys suporta |
| **Botões OficialAPI** | Difícil | Exige API Oficial; Baileys não cobre; nova stack |
| **CTA com URL** | Difícil | Templates da API Oficial |
| **Carrossel de Mídia** | Difícil | Templates da API Oficial |
| **Detalhes do Pedido** | Difícil | Templates da API Oficial |

---

## Resumo Executivo

- **13 tipos de nó** no frontend, **8 efetivamente tratados** no backend (message, menu, randomizer, singleBlock, question, typebot, openai; ticket comentado).
- `img`, `audio`, `video`, `interval` só funcionam dentro de `singleBlock`.
- `condition` existe no frontend mas não é processado no backend.
- Asaas, PIX e lógicas similares estão em `providers.ts` por fila, não no FlowBuilder.
- Itens mais simples para adicionar: Encerrar Ticket, Setor (ativar), Tag Kanban, Notificação, Aguardar Interação, BlackList.
- Itens que dependem de API Oficial (Botões, CTA, Carrossel, Detalhes de Pedido) exigem mudança de infraestrutura (não Baileys).
