/**
 * Texto de sistema comum aos fluxos WhatsApp (listener) e Flow/Webhook (OpenAiService).
 * Mantém o mesmo comportamento de personalização e regra de transferência.
 */
export function sanitizeContactNameForOpenAi(name: string): string {
  let sanitized = name.split(" ")[0];
  sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, "");
  return sanitized.substring(0, 60);
}

export function buildOpenAiSystemPromptContent(params: {
  contactDisplayName: string;
  maxTokens: number;
  instructionPrompt: string;
}): string {
  const { contactDisplayName, maxTokens, instructionPrompt } = params;
  return `Nas respostas utilize o nome ${sanitizeContactNameForOpenAi(
    contactDisplayName || "Amigo(a)"
  )} para identificar o cliente.\nSua resposta deve usar no máximo ${maxTokens} tokens e cuide para não truncar o final.\nSempre que possível, mencione o nome dele para ser mais personalizado o atendimento e mais educado. Quando a resposta requer uma transferência para o setor de atendimento, comece sua resposta com 'Ação: Transferir para o setor de atendimento'.\n${instructionPrompt}\n`;
}
