# AI Agent Wizard — Inventário de migração para Product API

Fase 2.4 do frontend. O Wizard preserva o fluxo guiado e passa a resolver o
agente exclusivamente pelo escopo comercial retornado pela Product API.

| Etapa / operação | Endpoint legado | Product API | Status |
|---|---|---|---|
| Resolver agente e carregar perfil | `GET /ai-agents/:id` + `GET /ai-agents/:id/profile` | `GET /product/ai-agent/configuration` | Migrado |
| Carregar provedores, modelos, credenciais e conexões | `GET /ai-provider-credentials` | `GET /product/ai-agent/configuration/options` | Migrado |
| Criar configuração guiada | `POST /ai-agents` + `PUT /ai-agents/:id/profile` | `POST /product/ai-agent/configuration` | Migrado |
| Atualizar identidade e perfil | `PUT /ai-agents/:id` + `PUT /ai-agents/:id/profile` | `PUT /product/ai-agent/configuration` | Migrado |
| Atualizar conexões | mutações diretas de conexão | `PUT /product/ai-agent/configuration/connections` | Migrado |
| Visualizar configuração gerada | `POST /ai-agents/:id/profile/preview` | `POST /product/ai-agent/configuration/preview` | Migrado; indisponibilidade temporária resulta em ação desabilitada |
| Cancelar antes da criação | exclusão do agente rascunho | nenhuma persistência | Migrado; rascunho é somente local |

## Resolução de escopo

- `none`: modo de criação, mesmo quando a URL contém um identificador antigo;
- `single`: modo de edição, hidratado por `configuration.profile` e
  `configuration.identity`;
- `ambiguous`: edição bloqueada e retorno para a central comercial;
- identificadores da URL não são enviados em payloads de persistência.

## Mudança residual de abandono

O Wizard não cria mais um agente no início ou na visualização prévia. Antes do
primeiro `POST`, cancelar apenas descarta o estado local. Depois que a criação
for concluída, o agente permanece salvo em modo Off, ainda que o setup esteja
incompleto. O frontend não usa exclusão legada para limpar rascunhos.

Status de ativação e pendências vêm integralmente de `summary`; o Wizard não
calcula prontidão.

## Hardening 2.4.1

### Edição com agente ativo (`editableWhileActive === false`)

- Campos estruturais (provider, model, credential, connections, profile/instruções)
  permanecem bloqueados na UI.
- Botão de salvar permanece habilitado e envia **somente identidade**:
  `name`, `description`, `fallbackMessage`, `handoffMessage`
  via `wizardFormStateToProductIdentityPayload`.
- `PUT /product/ai-agent/configuration/connections` **não** é chamado.
- `changed: false` é tratado como sucesso idempotente.
- Mensagem comercial deixa claro que a desativação ocorre no Hub (sem auto-deactivate).

### Obrigatoriedade no fluxo guiado

- Create (`agentScope.none`) e edição estrutural Off exigem
  `provider` + `model` + `credentialRef` compatíveis com `options`.
- Validação local via `validateAiAgentWizardCommercialSetup` antes do POST/PUT.
- Nenhuma credencial default é escolhida automaticamente.
- Troca de provider limpa `model` e `credentialRef`.
- `setup_incomplete` continua vindo do backend; o Wizard não converte status.

### Legado removido

- Removido `createMinimalAiAgentPayload` (continha `enabled`, `systemPrompt`).
- Rota `/ai-agent/wizard/:agentId` permanece como compatibilidade de navegação;
  o param **não** é consumido para resolução nem payload.

### Testes

- `aiAgentWizardMigrationPhase24.test.js` — anti-legado ampliado
- `aiAgentWizardActiveIdentityPhase241.test.js` — identidade ativa + setup obrigatório

## Hardening 2.4.2 — modo dedicado de identidade ativa

O Wizard possui duas superfícies mutuamente exclusivas:

- **Agente Off:** fluxo guiado completo (`welcome` → `review` → `success`),
  com profile, provider, model, credential e connections.
- **Agente ativo:** tela dedicada sem barra de progresso, steps estruturais,
  Review estrutural ou preview de prompt. Edita apenas `name`, `description`,
  `fallbackMessage` e `handoffMessage`.

### Separação de domínios

- `identityName` hidrata sempre de `configuration.identity.name`.
- `identityDescription` hidrata sempre de `configuration.identity.description`.
- `attendantName` hidrata de `configuration.profile.attendantName`.
- `companyName` hidrata de `configuration.profile.companyName`.
- Um profile antigo não sobrescreve a identidade após reload.
- No fluxo Off, a criação/edição estrutural pode continuar derivando a identidade
  inicial dos campos guiados, preservando a experiência existente.

### Segurança do modo ativo

- `activeIdentityMode = isEditMode && editableWhileActive === false`.
- O step corrente é normalizado para `activeIdentity`; parâmetros `:agentId`
  da rota não têm autoridade sobre a superfície renderizada.
- Não há caminho visual para editar profile, provider, model, credential ou
  connections; portanto não existe descarte silencioso desses campos.
- Submit: `PUT /product/ai-agent/configuration` com allowlist identity-only.
- Não chama POST, PUT connections, commands, preview, activate ou deactivate.
- Dirty state observa somente os quatro campos editáveis.
- Success e toast específicos informam que a identidade foi atualizada e o
  agente continua ativo.
- Teste: `aiAgentWizardActiveIdentityModePhase242.test.js`.

# AI Agent — Inventário de Migração do Wizard (Fase 2.4)

Inventário do Wizard comercial (`frontend/src/components/AiAgentWizard`) e matriz de migração para a Product API.

**Commit-base:** `e48d83f` (Fase 2.3 + Hardenings 2.3.1/2.3.2)

---

## Steps identificados

| Step ID | Título (conceito) | Persistência |
|---------|-------------------|--------------|
| `welcome` | Boas-vindas | Nenhuma |
| `company` | Empresa | Draft local → profile |
| `attendant` | Atendente | Draft local → profile + name |
| `personality` | Personalidade | Draft local → profile |
| `allowedActions` | Ações permitidas | Draft local → profile |
| `forbiddenActions` | Ações proibidas | Draft local → profile |
| `handoff` | Transferência | Draft local → profile |
| `businessKnowledge` | Conhecimento | Draft local → profile |
| `policies` | Políticas | Draft local → profile |
| `review` | Revisão + provider/credencial/modelo/conexões | POST/PUT configuration (+ connections) |
| `success` | Sucesso | Exibe summary do backend |

---

## Matriz de migração

| Etapa | Operação atual | Endpoint legado | Nova Product API | Ação |
|-------|----------------|-----------------|------------------|------|
| Carregamento | buscar agente + profile | `GET /ai-agents/:id` + `GET .../profile` | `GET /product/ai-agent/configuration` | migrar |
| Options | listar credenciais | `GET /ai-provider-credentials` | `GET .../configuration/options` | migrar |
| Providers/modelos | hardcoded OpenAI default | local `aiProviderModels` | options.providers + options.models | migrar |
| Criação | criar draft | `POST /ai-agents` | `POST .../configuration` | migrar |
| Profile | salvar profile | `PUT /ai-agents/:id/profile` | `PUT .../configuration` | migrar |
| Preview | preview prompt | `POST .../profile/preview` | `POST .../configuration/preview` | migrar |
| Conexões | não vinculava no Wizard | — / `PUT /whatsapp/:id` externo | `PUT .../configuration/connections` | migrar (review) |
| Cleanup draft | `DELETE /ai-agents/:id` | legado | (sem delete) draft só local até POST | alterar |
| Finalização | chip “inativo” local | — | summary/readiness Product | migrar |
| Ambiguidade | N/A (URL agentId) | — | `agentScope.ambiguous` | adicionar |

---

## Endpoints legados anteriores (Wizard)

- `POST /ai-agents`
- `GET /ai-agents/:id`
- `DELETE /ai-agents/:id`
- `GET /ai-agents/:id/profile`
- `PUT /ai-agents/:id/profile`
- `POST /ai-agents/:id/profile/preview`
- `GET /ai-provider-credentials`

## Product APIs utilizadas

- `GET /product/ai-agent/configuration`
- `GET /product/ai-agent/configuration/options`
- `POST /product/ai-agent/configuration`
- `PUT /product/ai-agent/configuration`
- `PUT /product/ai-agent/configuration/connections`
- `POST /product/ai-agent/configuration/preview`
- Summary retornado nas mutações (sem cálculo local de readiness)

---

## Momento de criação (estratégia adotada)

Draft exclusivamente no frontend até o **submit do Review** (ou preview que força criação).

1. Usuário preenche steps → estado local
2. Review: escolhe provider, modelo, credencial, conexões
3. `POST /product/ai-agent/configuration` com profile + provider + credentialRef + model + connectionRefs
4. Agente criado em **Off** (sem ativação automática)
5. Success usa `summary` retornado

Em edição (`agentScope.single`): `PUT configuration` (+ `PUT connections` se necessário).

Abandono antes do POST: descarta draft local (sem `DELETE` legado).

---

## Modal avançado / credenciais

| Superfície | Relação com Wizard | Migração 2.4 |
|------------|--------------------|--------------|
| AiAgentWizard | Fluxo guiado | **Migrado** |
| AiAgentModal | Removido (Fase 2.8A) | Substituído por Product Hub/Wizard/Configuration |
| AiProviderCredentialModal | Removido (Fase 2.8A) | Product Credential UI (2.7) — Hub/Wizard |
| AiAgentCreateChoiceModal | Removido (Fase 2.8A) | Entrada direta ao Wizard Product |
| WhatsApp settings | Controles AI removidos (2.6); CTA → `/ai-agent` | Concluído — mutação só Product |
| Simulator | Pós-success navegação | Intacta (Product 2.5) |
---

## Regras arquiteturais do frontend

**Pode:** navegação de steps, validação UX, filtrar options, montar payload comercial, exibir summary/erros.

**Não pode:** calcular readiness, enviar companyId/agentId/enabled/mode/apiKey, chamar `/ai-agents`, `/ai-provider-credentials`, `PUT /whatsapp/:id`, `/automation/*`.
