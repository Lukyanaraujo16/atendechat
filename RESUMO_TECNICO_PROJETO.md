# Resumo Técnico do Projeto - Atendechat

## 1. Stack do Projeto

### Linguagens
- **Backend:** TypeScript (compilado para JavaScript)
- **Frontend:** JavaScript (React 17)
- **Banco:** SQL (PostgreSQL)

### Frameworks e Bibliotecas Principais

**Backend:**
| Pacote | Função |
|--------|--------|
| Express | API REST |
| Sequelize + sequelize-typescript | ORM, migrações |
| Bull | Filas de jobs (Redis) |
| Socket.IO | Tempo real |
| node-cron | Agendamentos (ex: transferência de tickets) |
| jsonwebtoken | Autenticação JWT |
| bcryptjs | Hash de senhas |
| Yup | Validação |
| Pino | Logging |
| Sentry | Error tracking |
| Mustache | Templates de mensagens |

**Frontend:**
| Pacote | Função |
|--------|--------|
| React 17 | UI |
| Material-UI 4 + MUI 5 | Componentes (uso misto) |
| React Router 5 | Rotas |
| Formik + Yup | Formulários e validação |
| Axios | HTTP client |
| Socket.IO client | Tempo real |
| Recharts | Gráficos |
| i18next | Internacionais (pt, en, es) |
| react-flow-renderer / reactflow | FlowBuilder visual |
| moment / date-fns | Datas |
| lodash | Utilitários |

### Banco de Dados
- **PostgreSQL** (configurável via `DB_DIALECT=postgres`)
- Migrações: `npx sequelize db:migrate`
- Seeds: `npx sequelize db:seed:all`

### Integração com WhatsApp
- **Biblioteca:** `@whiskeysockets/baileys` (fork do Baileys, não-oficial)
- **Arquivo central:** `backend/src/libs/wbot.ts` (inicialização de sessões)
- **Listener de mensagens:** `backend/src/services/WbotServices/wbotMessageListener.ts`
- Conexão via QR Code ou sessão persistente (armazenada em disco)
- Múltiplas conexões WhatsApp por empresa (model `Whatsapp`)

---

## 2. Estrutura de Pastas

```
codatendechat-main/
├── backend/                    # API Node.js
│   ├── src/
│   │   ├── app.ts              # Express app
│   │   ├── server.ts           # Início do servidor
│   │   ├── config/             # Configurações (auth, upload, etc.)
│   │   ├── controllers/        # Controllers REST
│   │   ├── database/           # Migrações, seeds
│   │   ├── errors/             # Tratamento de erros
│   │   ├── helpers/            # Funções auxiliares (Mustache, GetWhatsappWbot, etc.)
│   │   ├── libs/               # Socket.IO, wbot, store, cache
│   │   ├── middleware/         # isAuth, etc.
│   │   ├── models/             # Sequelize models
│   │   ├── queues.ts           # Bull queues (mensagens, campanhas, agendamentos)
│   │   ├── routes/             # Definição das rotas
│   │   ├── services/           # Lógica de negócio (WbotServices, TicketServices, etc.)
│   │   ├── utils/              # Logger, etc.
│   │   ├── wbotTransferTicketQueue.ts  # Cron de transferência de tickets
│   │   └── @types/             # Tipos TypeScript
│   └── dist/                   # Build (tsc)
│
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── assets/             # Imagens, logos
│   │   ├── components/        # Componentes reutilizáveis
│   │   ├── context/            # Auth, Tickets, WhatsApp, Socket
│   │   ├── errors/             # toastError
│   │   ├── hooks/              # useAuth, useDashboard, etc.
│   │   ├── layout/             # Layout principal, menu (MainListItems)
│   │   ├── pages/              # Páginas (Tickets, Contacts, Dashboard, etc.)
│   │   ├── routes/             # Router e Route (com isPrivate)
│   │   ├── services/           # api.js, socket.js
│   │   └── translate/          # i18n (pt, en, es)
│   └── build/                  # Build produção
│
├── install.sh                  # Script de instalação (Ubuntu, Nginx, PM2/systemd)
├── package.json
└── README.md
```

### Pastas críticas do backend
- `services/WbotServices/` – Toda a lógica de recebimento/envio de mensagens WhatsApp
- `services/WbotServices/providers.ts` – Lógica específica por fila (integrações externas, CPF/CNPJ, etc.)
- `services/WbotServices/wbotMessageListener.ts` – **Arquivo central** do fluxo de mensagens
- `libs/wbot.ts` – Gerenciamento das sessões Baileys
- `queues.ts` – MessageQueue, CampaignQueue, ScheduleMonitor
- `models/` – Ticket, Contact, Message, Queue, Whatsapp, etc.

---

## 3. Arquitetura do Sistema

### Fluxo principal
1. **Inicialização:** `server.ts` carrega empresas, inicia sessões WhatsApp (`StartAllWhatsAppsSessions`), inicia filas Bull, inicializa Socket.IO.
2. **Mensagem recebida:** Baileys emite `messages.upsert` → `wbotMessageListener` → `handleMessage`.
3. **Tratamento da mensagem:**
   - Cria/atualiza contato (`verifyContact`)
   - Cria/atualiza ticket (`FindOrCreateTicketService`)
   - Chama `provider` (lógica por fila/integração)
   - Se chatbot ativo: `handleChartbot`
   - Se integração flowbuilder/typebot/dialogflow/n8n: trata conforme `QueueIntegrations`
   - Salva mensagem (`CreateMessageService`)
4. **Envio:** Mensagens saem pela fila Bull `MessageQueue` → `SendMessage` → Baileys `sendMessage`.

### Como as mensagens entram
```
WhatsApp → Baileys (libs/wbot) → wbot.ev.on("messages.upsert")
→ handleMessage (wbotMessageListener.ts)
→ verifyContact, FindOrCreateTicketService
→ provider() → handleChartbot() ou flowbuilderIntegration()
→ CreateMessageService
→ Socket.IO emite para frontend
```

### Atendimento (Filas, Usuários)
- **Queue (Setor):** Grupos de atendimento. Cada ticket pertence a uma fila (`queueId`).
- **UserQueue:** Relação N:N entre usuários e filas.
- **Ticket:** `userId` = atendente responsável; `queueId` = fila; `status`: pending, open, closed.
- **QueueOption:** Opções de menu dentro da fila (chatbot com árvore de decisão).
- **QueueIntegrations:** Integrações por fila: dialogflow, typebot, n8n, webhook, **flowbuilder**.
- **Transferência:** `wbotTransferTicketQueue.ts` roda a cada minuto; lógica em `TransferTicketQueue`.

---

## 4. Principais Funcionalidades

| Funcionalidade | Descrição |
|----------------|-----------|
| **Atendimento humano** | Tickets por fila, atribuição a usuários, tags, notas, histórico |
| **Chatbot** | `handleChartbot` – menu baseado em `QueueOption` (árvore de decisão) |
| **FlowBuilder** | Fluxos visuais (nodes: texto, imagem, áudio, vídeo, condição, typebot, OpenAI, ticket) – `flowbuilderIntegration` |
| **Typebot** | Integração externa via `QueueIntegrations` (typebot) |
| **DialogFlow** | Integração via `QueueIntegrations` |
| **OpenAI** | Nó no FlowBuilder; também prompts por setor |
| **N8n / Webhook** | Integrações via `QueueIntegrations` |
| **Campanhas** | Disparo em massa (model `Campaign`, `CampaignShipping`); filas Bull `CampaignQueue` |
| **Campanhas por frase** | `FlowCampaign` – disparo por palavra-chave |
| **Agendamentos** | `Schedule`, `sendScheduledMessages` |
| **Respostas rápidas** | `QuickMessage` |
| **Listas de contatos** | `ContactList`, `ContactListItem` – importação para campanhas |
| **Avaliação** | `UserRating`, `RatingTemplate` – avaliação de atendentes |
| **Chat interno** | `Chat`, `ChatMessage` – comunicação entre atendentes |
| **Mensagens API** | Endpoint para envio externo |
| **Kanban** | Visualização de tickets por tag |
| **Relatórios** | Dashboard, Reports (relatórios por período) |
| **Financeiro** | Invoices, assinaturas, Gerencianet (PIX) |
| **Multiempresa** | `Company` – isolamento por `companyId` |
| **Planos** | Limite de usuários/conexões por plano |

---

## 5. Pontos Críticos do Sistema

### Arquivos sensíveis
| Arquivo | Risco |
|---------|-------|
| `wbotMessageListener.ts` | ~3000 linhas; alterações podem quebrar recebimento/envio de mensagens |
| `providers.ts` | Lógica customizada por fila; alterações afetam fluxo de atendimento |
| `libs/wbot.ts` | Conexão WhatsApp; bugs podem derrubar sessões |
| `queues.ts` | Filas Bull; jobs de mensagens e campanhas |
| `helpers/SendMessage.ts` | Envio de mensagens – ponto único de saída |

### Onde alterações podem quebrar
1. **Nginx (install.sh):** Rotas em `location ~ ^/(...)` precisam ser **minúsculas** (ex: `flowbuilder`, não `flowBuilder`) – 405 Method Not Allowed em POST.
2. **APIs que retornam arrays:** Frontend usa `.map()` em vários lugares; se a API retornar `undefined` ou objeto, a tela pode quebrar. Sempre validar com `Array.isArray(x) ? x : []`.
3. **Sequelize migrations:** Não alterar migrações já aplicadas; criar novas.
4. **Baileys:** Atualizações podem quebrar compatibilidade; versão fixa em `7.0.0-rc.9`.
5. **Redis:** Filas Bull dependem do Redis; sem Redis, envio de mensagens e campanhas falha.

### Convenções importantes
- Todas as queries devem filtrar por `companyId` quando multiempresa.
- Tickets: `contactId`, `whatsappId`, `queueId`, `userId` são FKs obrigatórias em vários fluxos.

---

## 6. Melhorias Já Feitas Recentemente

### Correções de tela em branco (.map / .forEach em undefined)
- **Setores (QueueModal):** `integrations`, `prompts`, `data.queueIntegrations`, `data.prompts`
- **Prompts:** `data.prompts`
- **Queue Integration:** `data.queueIntegrations`
- **Contact Lists:** `data.records`
- **Phrase Lists (CampaignPhrase):** `res.data.flow`, `campaignflows.map`
- **FlowBuilders:** `data.flows`, `webhooks.map`
- **CampaignModalPhrase:** `flows.data.flows`
- **CampaignModal (Nova Campanha):** `file`, `contactLists`, `whatsapps`, `tagLists`, `data.tags`, `data.files`
- **QueueModal, SchedulesForm, QueueOptions, ToDoList:** Tratamento de arrays
- **Reducer Campaigns:** `isArray(campaigns)` antes de forEach

### Menu lateral (drawer)
- Expandido por padrão
- Submenus fechados por padrão, abrem ao clicar
- Indicação visual da página atual (`selected`)
- Persistência do estado em `localStorage`

### Terminologia
- "Filas" → "Setores" em todo o sistema (traduções e componentes)

### Página de Avaliação
- Nova página `/avaliacao`
- APIs: `GET /user-ratings`, `GET /user-ratings/summary`
- Modelo `RatingTemplate`, migração
- Modal `EvaluationModal` com 3 abas (Configuração, Opções, Preview)
- API: `GET/POST/PUT/DELETE /rating-templates`

### Outros
- ** install.sh:** Rotas Nginx com `flowdefault`, `flowbuilder`, `flowcampaign` em minúsculas
- **PulsingNotificationBadge:** Badge só quando `hasNotification === true`
- **EvaluationModal:** Correção ESLint (`if (onSave) onSave()`)
- **Dashboard:** Remoção do botão "Criar Relatório" e da barra de filtros; seletor compacto no canto superior (Hoje, 7/15/30 dias, Personalizado)

### Página de Relatórios
- Nova página `/relatorios` (não mais espelhando Dashboard)
- 4 tipos: Resumo Geral, Atendimentos por Período, Performance de Usuários, Relatório de Mensagens
- Filtros por período, impressão, integração com APIs do Dashboard

---

## 7. Sugestões de Melhoria

### Estrutura
- Padronizar Material-UI: hoje há MUI 4 e MUI 5; escolher uma versão e migrar.
- Extrair `providers.ts` em módulos menores por tipo de fila.
- Modularizar `wbotMessageListener.ts` em funções em arquivos separados.

### Performance
- Índices no banco para `Ticket` (companyId, status, queueId, userId).
- Paginação em listagens grandes (Contacts, Messages).
- Lazy loading de componentes no frontend (React.lazy).

### Segurança
- Revisar variáveis em `formatBody`/Mustache para evitar injeção.
- Rate limiting em endpoints sensíveis.
- Validar e sanitizar dados de integrações externas (webhook, n8n).

### Testes
- Testes unitários em `CreateMessageService`, `FindOrCreateTicketService`.
- Testes de integração para fluxo de mensagens.

### DevOps
- Docker Compose para desenvolvimento local.
- CI/CD para testes e deploy.
- Documentação de APIs (Swagger/OpenAPI).

---

*Documento gerado com base na análise do código e nas alterações recentes do projeto.*
