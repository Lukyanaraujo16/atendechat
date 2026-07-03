import Prompt from "../../models/Prompt";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";

/**
 * Reutiliza API key do Prompt já configurado na conexão/fila (OpenAI legado).
 * AiAgent não armazena chave própria nesta fase.
 */
export async function resolveAiAgentOpenAiApiKey(input: {
  companyId: number;
  whatsapp: Whatsapp;
  ticket: Ticket;
}): Promise<string | null> {
  const candidates: Array<number | null | undefined> = [
    input.whatsapp.promptId,
    input.ticket.promptId
  ];

  for (const promptId of candidates) {
    if (promptId == null) continue;
    const prompt = await Prompt.findOne({
      where: { id: promptId, companyId: input.companyId },
      attributes: ["id", "apiKey"]
    });
    const key = prompt?.apiKey?.trim();
    if (key) return key;
  }

  return null;
}
