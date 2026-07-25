# AI Agent V1.1 — Architecture Lock

| Campo | Valor |
|-------|-------|
| **Produto** | StreamHUB Chat |
| **Fase** | AI Agent V1.1 — Product Experience |
| **Status** | Arquitetura aprovada e congelada |
| **Natureza** | Documento normativo permanente |
| **Aplicação** | Frontend, backend, Product API, Experience Layer, AgentOS, Console Técnico e futuras interfaces |
| **Versão** | 1.0 |

---

## 1. Finalidade deste documento

Este documento estabelece os princípios arquiteturais obrigatórios da AI Agent V1.1 — Product Experience.

Ele funciona como a constituição técnica e de produto desta fase.

Seu objetivo é impedir que, durante a implementação, a experiência comercial volte a se misturar com a arquitetura técnica do AgentOS.

As regras aqui definidas têm precedência sobre:

* decisões isoladas tomadas durante a implementação;
* conveniências momentâneas de frontend;
* soluções rápidas que criem acoplamento;
* sugestões automáticas de ferramentas de desenvolvimento;
* reorganizações visuais que contrariem a separação aprovada;
* implementações que exponham conceitos internos ao cliente.

Qualquer alteração nesses princípios deverá ser tratada como uma decisão arquitetural formal e não como uma simples modificação de código.

---

## 2. Definição das camadas

A arquitetura da AI Agent V1.1 é composta pelas seguintes camadas:

```
Cliente
  ↓
Product Experience
  ↓
Product API
  ↓
Experience Layer
  ↓
Serviços existentes
  ↓
AgentOS
  ↓
Infraestrutura e persistência
```

O Console Técnico é uma superfície interna que acessa capacidades técnicas autorizadas sem fazer parte da experiência comercial do cliente.

```
Equipe interna autorizada
  ↓
Console Técnico
  ↓
APIs e serviços técnicos
  ↓
AgentOS
```

---

## 3. Definição do AgentOS

O AgentOS é a plataforma técnica de inteligência e execução do StreamHUB Chat.

Ele contém, entre outros módulos:

* Planner;
* Evaluation;
* Runtime;
* Action Engine;
* Cognitive Memory;
* Learning;
* MCP Runtime;
* Multi-Agent;
* Persistence;
* Security;
* Observability;
* Scalability;
* Production Rollout;
* Replay;
* Evidence;
* Incidents;
* Execution Sessions;
* Capability Gates;
* Coordination;
* Function Calling;
* ferramentas e serviços internos relacionados.

O AgentOS não é a interface comercial vendida ao cliente.

O AgentOS fornece capacidades para que produtos sejam construídos sobre ele.

### Regra imutável

O AgentOS é uma plataforma, não uma tela de produto.

A existência de uma capacidade no AgentOS não significa que essa capacidade deverá ser exposta diretamente ao cliente.

---

## 4. Congelamento do AgentOS V1

A arquitetura do AgentOS V1 está congelada.

O diretório principal de referência é:

```
backend/src/services/AutomationOrchestrator/
```

Esse diretório não deverá ser alterado para facilitar:

* criação de telas;
* simplificação do frontend;
* tradução de termos;
* montagem do dashboard;
* construção do Wizard;
* criação do menu;
* reorganização de rotas;
* conveniência da Product API.

Alterações no AgentOS somente serão permitidas quando houver:

1. bug técnico comprovado;
2. falha de segurança;
3. falha de persistência;
4. problema de escalabilidade;
5. incompatibilidade real;
6. necessidade de observabilidade;
7. requisito técnico que não possa ser resolvido fora do AgentOS.

Toda exceção deverá:

* ser explicitamente justificada;
* ter escopo mínimo;
* preservar contratos existentes;
* possuir testes;
* não redesenhar engines ou fluxos consolidados.

---

## 5. Produto comercial e plataforma técnica

O produto comercial chama-se:

**Agente de IA**

A plataforma técnica chama-se:

**AgentOS**

Esses conceitos não são equivalentes.

### O cliente compra

* atendimento automatizado;
* respostas inteligentes;
* disponibilidade;
* conhecimento;
* personalização;
* transferência para humanos;
* redução de tempo;
* melhoria de atendimento;
* análise de conversas;
* desempenho do agente.

### A equipe técnica opera

* planning;
* evaluation;
* runtime;
* memory;
* function calling;
* capability gates;
* replay;
* traces;
* observability;
* rollout;
* production controls;
* security;
* evidence;
* incidents;
* coordination;
* MCP;
* multi-agent.

A experiência do cliente deverá traduzir capacidades técnicas em resultados de negócio.

---

## 6. Três superfícies obrigatórias

A interface deverá ser organizada em três superfícies independentes.

### 6.1 Agente de IA

Módulo comercial próprio.

Áreas aprovadas:

* Visão Geral
* Configuração
* Conhecimento
* Testes
* Conversas
* Desempenho
* Configurações

### 6.2 Automações

Módulo de automações determinísticas.

Áreas aprovadas:

* Fluxos
* Gatilhos
* Integrações

O Agente de IA não deverá permanecer dentro de Automações.

### 6.3 Console Técnico

Área interna e restrita.

Estrutura:

```
Console Técnico
  └── AgentOS
```

O Console Técnico poderá apresentar módulos técnicos existentes sem traduzi-los para linguagem comercial.

---

## 7. Experience Layer

A Experience Layer é a camada responsável por transformar capacidades técnicas em conceitos de produto.

Ela deverá:

* agregar informações vindas de diferentes serviços;
* calcular estados comerciais;
* calcular readiness;
* traduzir erros técnicos;
* gerar alertas comerciais;
* organizar informações para dashboards;
* ocultar detalhes de implementação;
* aplicar regras de experiência;
* produzir view models estáveis;
* preservar tenant isolation;
* centralizar decisões comerciais.

Exemplos de componentes da Experience Layer:

* `AgentProductOverviewService`
* `AgentReadinessService`
* `AgentProductSetupService`
* `AgentKnowledgeExperienceService`
* `AgentTestExperienceService`
* `AgentConversationExperienceService`
* `AgentPerformanceService`
* `AgentProductAlertService`
* `AgentModelExperienceService`
* `AgentActivationExperienceService`

### Regra imutável

Toda lógica comercial compartilhável deve viver na Experience Layer.

Ela não deverá ser duplicada em controllers, páginas React ou aplicativos futuros.

---

## 8. Product API

A Product API é a interface HTTP da Product Experience.

Ela deverá ser fina.

Suas responsabilidades são:

* receber requisições;
* validar parâmetros;
* validar autenticação e autorização;
* chamar a Experience Layer;
* retornar view models comerciais;
* padronizar respostas;
* padronizar erros.

A Product API não deverá conter lógica extensa de produto.

### Fluxo obrigatório

```
Controller
  ↓
Experience Service
  ↓
Serviços existentes
  ↓
Models e infraestrutura
```

### Regra imutável

A Product API não deve substituir a Experience Layer.

---

## 9. Acesso a dados e serviços

A Product API e a Experience Layer deverão priorizar os serviços existentes.

Não deverão consultar models diretamente quando já existir um service responsável pelo domínio.

### Exemplo correto

```
AgentProductOverviewService
  ↓
AiAgentService
  ↓
KnowledgeBaseService
  ↓
AnalyticsService
  ↓
RuntimeLogService
```

### Exemplo que deve ser evitado

```
Product Controller
  ↓
AiAgent.findOne()
  ↓
Whatsapp.findAll()
  ↓
RuntimeLog.findAll()
  ↓
KnowledgeBase.findAll()
```

Consultas diretas somente serão aceitáveis quando:

* não houver service de domínio;
* o acesso for encapsulado em um repository ou service próprio;
* a responsabilidade estiver claramente definida;
* tenant isolation estiver garantido;
* houver testes.

---

## 10. Responsabilidade do frontend

O frontend deverá apenas representar estados comerciais entregues pelo backend.

Ele não deverá reconstruir regras de negócio complexas.

### O React pode

* renderizar;
* ordenar dados simples;
* controlar interação local;
* manter estado visual;
* navegar;
* enviar comandos;
* mostrar loading;
* mostrar erros comerciais;
* formatar valores;
* controlar formulários.

### O React não pode

* interpretar Capability Gates;
* decidir readiness;
* combinar logs para calcular status;
* interpretar rollout;
* deduzir disponibilidade de provider;
* decidir se o agente pode ser ativado;
* interpretar erros internos do AgentOS;
* consultar múltiplas APIs técnicas para montar um estado comercial;
* decidir prioridade entre paused, unavailable, active ou attention;
* reproduzir regras existentes no backend.

### Regra imutável

O frontend desenha. O backend decide.

---

## 11. Estados comerciais

Estados comerciais deverão ser calculados no backend.

Contrato inicial aprovado:

```ts
type AgentProductStatus =
  | "not_created"
  | "setup_incomplete"
  | "ready_to_activate"
  | "active"
  | "paused"
  | "attention_required"
  | "unavailable";
```

O frontend receberá:

* valor técnico comercial;
* label;
* descrição;
* ação recomendada;
* prioridade;
* alertas relacionados.

O frontend não deverá montar esse estado a partir de:

* enabled;
* aiAgentMode;
* credencial;
* logs;
* conhecimento;
* rollout;
* provider;
* canal;
* gates;
* erros.

---

## 12. Readiness

O readiness deverá ser centralizado em um serviço independente:

`AgentReadinessService`

Ele será a única fonte oficial para determinar:

* progresso de configuração;
* bloqueadores;
* alertas;
* recomendações;
* disponibilidade de ativação acompanhada;
* disponibilidade de ativação automática;
* conflitos com configurações legadas;
* ausência de canal;
* ausência de credencial;
* ausência de transferência;
* necessidade de testes;
* pendências de conhecimento.

O cálculo deverá ser:

* determinístico;
* reproduzível;
* testável;
* executado no backend;
* independente de IA generativa.

### Regra imutável

Nenhuma inteligência generativa decide se o agente pode ser ativado.

---

## 13. Ativação

A interface comercial utilizará:

* **Ativação acompanhada**
* **Ativação automática**

Esses nomes correspondem tecnicamente a:

| Comercial | Técnico |
|-----------|---------|
| Ativação acompanhada | `shadow` |
| Ativação automática | `live` |

Os valores persistidos não serão renomeados.

Devem permanecer compatíveis:

* `shadow`;
* `live`;
* `disabled`;
* `dry_run`;
* valores e gates atualmente existentes.

A Experience Layer traduzirá esses valores.

Ela não poderá ignorar ou contornar:

* rollout;
* gates técnicos;
* validações existentes;
* segurança;
* regras de canal;
* function calling;
* knowledge live;
* políticas de execução.

---

## 14. Compatibilidade com agentes existentes

A Product Experience deverá funcionar sobre agentes já existentes.

Não deverá exigir:

* recriação;
* migração manual obrigatória;
* regravação de credenciais;
* alteração automática de modelos;
* alteração automática de prompts;
* alteração dos canais;
* renomeação de modos;
* perda do histórico;
* perda de conhecimento;
* interrupção de Shadow ou Live.

Qualquer migração deverá ser:

* aditiva;
* reversível;
* tenant-safe;
* validada;
* protegida por testes.

---

## 15. Credenciais e modelos

As credenciais existentes deverão ser preservadas integralmente.

Isso inclui:

* OpenAI;
* Gemini;
* criptografia;
* mascaramento;
* vínculos com empresa;
* vínculos com agentes;
* configuração padrão;
* modelos existentes;
* validações existentes.

A experiência comercial utilizará o nome:

**Modelo de IA**

Opções iniciais:

* Automático
* GPT
* Gemini

Claude não deverá aparecer como funcional enquanto não existir adapter real e validado.

### Regra imutável

O produto não anuncia capacidades que o backend ainda não entrega.

---

## 16. OpenAI legado

O suporte técnico à OpenAI não será removido.

Devem permanecer compatíveis:

* Prompt;
* promptId;
* OpenAiManager;
* OpenAiService;
* adapters;
* nós de fluxo;
* conexões existentes;
* filas existentes;
* configurações existentes.

A aba comercial chamada “OpenAI” deverá ser retirada da experiência principal.

A área legada poderá ser apresentada como:

**Assistente legado (Prompts)**

Ela deverá aparecer somente quando houver necessidade real de manutenção de configurações existentes.

### Regra imutável

Remover um nome da navegação não significa remover a tecnologia correspondente.

---

## 17. Conhecimento

A experiência comercial não deverá expor diretamente:

* embeddings;
* chunks;
* vetores;
* dimensionalidade;
* retrieval interno;
* índices;
* score bruto;
* nomes de engines;
* filas técnicas;
* erros de provider.

O cliente deverá enxergar conceitos como:

* documentos;
* conteúdos;
* fontes;
* perguntas e respostas;
* processamento;
* disponível;
* atualizando;
* precisa de atenção;
* lacunas de conhecimento.

Os detalhes técnicos permanecerão disponíveis apenas no Console Técnico quando necessário.

---

## 18. Conversas e desempenho

A área de Conversas deverá apresentar resultados de atendimento.

A área de Desempenho deverá apresentar indicadores de negócio.

Não deverão ser apresentados como informações principais:

* tokens;
* traces;
* latência de engine;
* planos internos;
* sessões técnicas;
* evidências brutas;
* replays;
* falhas de adapter;
* detalhes de rollout.

Essas informações pertencem ao Console Técnico.

---

## 19. Console Técnico

O Console Técnico é uma aplicação interna dentro do StreamHUB Chat.

Ele não é uma área avançada para administradores de clientes.

### Acesso obrigatório

```
Identidade interna
AND
Permissão explícita de plataforma
```

Identidade interna inicial:

```
User.super === true
OR
profile === "superadmin"
```

Permissão mínima:

```
agentOS.console.view
```

`supportMode` sozinho não autoriza acesso.

Admin comum de empresa cliente não poderá acessar:

* menu;
* rota;
* endpoint;
* página;
* componente;
* API técnica protegida.

Ocultar menu não é segurança suficiente.

---

## 20. Planos e autorização interna

Features de plano e permissões internas possuem finalidades diferentes.

### Features de plano

Definem capacidades contratadas pela empresa cliente.

Exemplos:

* `automation.ai_agent`
* `automation.knowledge_base`
* `automation.ai_tools`

### Permissões internas

Definem quais integrantes internos podem acessar ou operar o AgentOS.

Exemplos:

* `agentOS.console.view`
* `agentOS.console.manage`
* `agentOS.replay.execute`
* `agentOS.rollout.manage`
* `agentOS.production.manage`

### Regra imutável

Feature comercial de plano nunca substitui autorização interna de plataforma.

---

## 21. Wizard

O Wizard oficial terá oito etapas:

1. Bem-vindo
2. Criar agente
3. Personalidade
4. Conhecimento
5. Canais
6. Regras
7. Testes
8. Ativação

A implementação deverá reaproveitar estruturas existentes sempre que possível.

O Wizard deverá:

* salvar progresso;
* permitir sair e continuar;
* preservar agentes existentes;
* não ativar por autosave;
* não alterar canais live de forma acidental;
* não publicar configuração incompleta sobre agente ativo;
* usar readiness centralizado;
* usar Product API;
* não consumir endpoints AgentOS.

---

## 22. Rascunho e publicação

A estratégia oficial da V1.1 será:

**Progresso de Wizard + draft buffer + publicação nos models atuais**

Não será implementado versionamento completo de agente nesta fase.

Para agentes ativos:

* alterações incompletas não deverão afetar imediatamente a versão em produção;
* a configuração será preparada em rascunho;
* a aplicação definitiva ocorrerá por ação explícita de publicação;
* ativação de canal será tratada separadamente.

Essa decisão poderá evoluir futuramente para:

* Rascunho
* Versão publicada
* Histórico
* Rollback

Mas essa evolução não faz parte do núcleo da V1.1.

---

## 23. Erros comerciais

Erros apresentados ao cliente deverão usar um contrato comercial.

Exemplo:

```ts
interface ProductError {
  code: string;
  title: string;
  message: string;
  action?: {
    label: string;
    route?: string;
  };
  supportReference?: string;
}
```

Não deverão ser enviados à interface comercial:

* stack trace;
* mensagens brutas de provider;
* nomes de métodos;
* nomes de classes internas;
* caminhos de arquivos;
* queries;
* tokens de segurança;
* detalhes de engines;
* informações sensíveis.

O `supportReference` deverá permitir que uma equipe autorizada localize o evento no Console Técnico.

---

## 24. Multi-interface

A Experience Layer deverá ser reutilizável por interfaces futuras.

Exemplos:

* aplicativo mobile;
* dashboard mobile;
* portal do cliente;
* web widget;
* agente de voz;
* Instagram;
* Messenger;
* API pública;
* aplicativos parceiros.

Nenhuma regra essencial deverá existir somente em um componente React de desktop.

---

## 25. Evolução de novas capacidades

Toda nova capacidade de inteligência deverá seguir a sequência:

```
Capacidade técnica
  ↓
AgentOS ou serviço de domínio adequado
  ↓
Experience Layer
  ↓
Product API
  ↓
Interface comercial
```

Não deverá seguir:

```
Nova ideia
  ↓
Componente React
  ↓
Chamada direta a uma API técnica
```

### Regra imutável

Nenhuma nova capacidade do AgentOS será exposta diretamente à UX comercial.

---

## 26. Reutilização e duplicação

Antes de criar um novo service, endpoint, model ou componente, a implementação deverá verificar:

* se já existe serviço equivalente;
* se já existe regra equivalente;
* se já existe endpoint seguro;
* se já existe view model;
* se já existe componente reutilizável;
* se já existe estrutura de autorização;
* se já existe mecanismo de tenant isolation.

Duplicação de regras entre:

* frontend e backend;
* Product API e Experience Layer;
* Experience Layer e AgentOS;
* telas comerciais e Console Técnico;

deverá ser evitada.

---

## 27. Tenant isolation

Toda operação comercial ou técnica contextualizada em empresa deverá respeitar `companyId`.

Nenhuma rota deverá confiar apenas no `agentId`, `whatsappId`, `knowledgeBaseId`, `ticketId` ou outro identificador.

O acesso deverá validar:

```
recurso.companyId === contexto autorizado.companyId
```

O Console Técnico também deverá registrar:

* usuário interno;
* empresa acessada;
* horário;
* ação;
* contexto de suporte;
* permissão utilizada.

---

## 28. Segurança por camadas

A segurança deverá existir em todas as camadas necessárias.

```
Menu
Route Guard
Backend Middleware
Service Authorization
Tenant Isolation
Audit Log
```

A ausência de um item no menu não é autorização.

Um componente oculto não substitui middleware.

Um middleware não substitui tenant isolation.

---

## 29. Compatibilidade de URLs

Rotas existentes não deverão ser removidas sem período de compatibilidade.

Mudanças deverão usar:

* aliases;
* redirects;
* tratamento de deep link;
* comportamento correto em refresh;
* acesso negado seguro;
* preservação de bookmarks internos.

Rotas antigas do AgentOS não deverão continuar expondo conteúdo técnico a clientes apenas por compatibilidade.

Compatibilidade deverá preservar a navegação, não o acesso indevido.

---

## 30. Mobile

A Product Experience deverá ser mobile-first, especialmente:

* Visão Geral;
* status;
* checklist;
* alertas;
* próximas ações;
* conversas;
* indicadores principais.

O Console Técnico poderá ser desktop-first.

Caso uma página técnica não seja segura ou utilizável no mobile, deverá apresentar restrição explícita, e não uma tela quebrada.

---

## 31. Observabilidade

A Product Experience deverá produzir referências de suporte sem expor detalhes internos.

O Console Técnico deverá permitir localizar:

* falhas;
* eventos;
* runtime logs;
* execuções;
* replays;
* evidências;
* incidentes;
* métricas;
* gates;
* rollout;
* contexto de provider.

A separação de UX não poderá eliminar observabilidade técnica.

---

## 32. Testes obrigatórios

Cada fase deverá preservar ou adicionar testes para:

* identidade interna;
* permissões;
* acesso direto por URL;
* admin cliente bloqueado no Console;
* supportMode sem autorização explícita;
* tenant isolation;
* compatibilidade de redirects;
* Shadow;
* Live;
* pause e resume;
* handoff;
* credenciais;
* conhecimento;
* Prompt legado;
* Wizard;
* readiness;
* Product API;
* ausência de dados técnicos na resposta comercial.

Nenhuma etapa crítica será considerada concluída apenas porque o build passou.

---

## 33. Implementação incremental

A implementação seguirá a sequência oficial:

1. **Fase 1** — Fundação da Product Experience
2. **Fase 2** — Visão Geral e estados de entrada
3. **Fase 3** — Wizard de configuração
4. **Fase 4** — Gestão de conhecimento
5. **Fase 5** — Testes e ativação segura
6. **Fase 6** — Conversas e desempenho
7. **Fase 7** — Console Técnico
8. **Fase 8** — Hardening e QA final

Não deverá ocorrer avanço para uma fase posterior deixando:

* falha de autorização;
* regressão crítica;
* dívida estrutural conhecida;
* duplicação temporária insegura;
* acesso técnico indevido;
* quebra de compatibilidade sem plano.

---

## 34. Critério de decisão durante a implementação

Quando surgir uma dúvida técnica, a decisão deverá responder, nesta ordem:

1. Preserva o AgentOS?
2. Preserva agentes e configurações existentes?
3. Mantém a separação entre produto e plataforma?
4. Mantém a lógica fora do frontend?
5. Reutiliza serviços existentes?
6. Mantém tenant isolation?
7. Mantém autorização segura?
8. É incremental e reversível?
9. Possui testes?
10. Está de acordo com este Architecture Lock?

Caso uma solução falhe nesses critérios, ela deverá ser revista.

---

## 35. Violações arquiteturais

São consideradas violações deste documento:

* mover lógica de readiness para React;
* chamar APIs AgentOS diretamente em páginas comerciais;
* liberar Console Técnico para admin comum;
* usar supportMode como única autorização;
* misturar permissões internas com features de plano;
* remover OpenAI técnico ao retirar seu nome da interface;
* renomear valores persistidos shadow e live;
* criar segunda arquitetura de agentes fora do AgentOS;
* duplicar regras de ativação;
* consultar vários models no controller para montar dashboard;
* expor traces e erros internos ao cliente;
* editar agente ativo de forma parcial e imediata;
* anunciar Claude sem adapter;
* alterar AutomationOrchestrator por conveniência de UI;
* remover URLs sem estratégia de compatibilidade;
* permitir que o frontend determine se uma operação técnica é segura.

---

## 36. Governança deste documento

Este documento deverá permanecer no repositório durante toda a evolução da AI Agent V1.1.

Antes de cada subfase, o prompt de implementação deverá declarar:

> Esta implementação deve respeitar integralmente o  
> **AI Agent V1.1 — Architecture Lock**.

Ao concluir cada fase, o relatório deverá incluir:

> **Verificação de conformidade com o Architecture Lock**

O relatório deverá apontar:

* princípios atendidos;
* exceções;
* arquivos sensíveis alterados;
* acessos diretos evitados;
* riscos restantes;
* possíveis violações encontradas.

Nenhuma ferramenta de desenvolvimento está autorizada a modificar este documento automaticamente.

Mudanças neste Architecture Lock exigem aprovação arquitetural explícita.

---

## 37. Declaração final

A AI Agent V1.1 não é uma reescrita do AgentOS.

Ela é a construção de um produto comercial sobre uma plataforma técnica já existente.

A arquitetura oficial é:

```
Produto comercial
  ↓
Product API
  ↓
Experience Layer
  ↓
Serviços de domínio
  ↓
AgentOS
```

E, paralelamente:

```
Equipe interna autorizada
  ↓
Console Técnico
  ↓
AgentOS
```

O cliente deverá perceber simplicidade.

A plataforma deverá preservar profundidade técnica.

A implementação deverá garantir as duas coisas simultaneamente.

---

| Campo | Valor |
|-------|-------|
| **Status** | APROVADO E CONGELADO |
| **Versão** | 1.0 |
| **Fase de referência** | AI Agent V1.1 — Product Experience |

Este documento é a referência obrigatória de todos os próximos prompts de implementação. O Prompt 03 e os subsequentes deverão iniciar citando expressamente o Architecture Lock e terminar com uma verificação de conformidade.
