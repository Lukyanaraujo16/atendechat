# AI Agent — Tom de comunicação (Fase 2.15)

## Escopo desta fase

- Seletor de tom na edição admin (`AiAgentIntelligencePanel`).
- Instruções de estilo ricas no prompt builder (`buildToneCommunicationInstructions`).

## Simulator — comparação entre tons (adiado)

Comparar o mesmo enunciado sob vários tons no Simulator exigiria:

1. override temporário de `tone` sem persistir o perfil; ou
2. múltiplas sessões/agentes paralelos; e
3. UI dedicada de side-by-side no produto.

Isso altera contratos de sessão do Simulator e o fluxo de preview — fora do hardening mínimo desta fase.

**Decisão:** adiar para fase futura. Validação de tom permanece via edição + conversa real/simulada com o perfil salvo, e via testes unitários do prompt.
