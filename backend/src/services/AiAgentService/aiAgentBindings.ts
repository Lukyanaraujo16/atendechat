import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";

/** Bloqueia exclusão quando o agente está vinculado a conexões WhatsApp. */
export async function assertNoAiAgentBindings(agentId: number): Promise<void> {
  const count = await Whatsapp.count({
    where: { aiAgentId: agentId }
  });
  if (count > 0) {
    throw new AppError(
      "ERR_AI_AGENT_IN_USE",
      400,
      "Este agente está vinculado a uma ou mais conexões WhatsApp e não pode ser excluído."
    );
  }
}

/** Conta conexões WhatsApp que referenciam o agente (útil para UI futura). */
export async function countWhatsappBindingsForAiAgent(
  agentId: number
): Promise<number> {
  return Whatsapp.count({
    where: { aiAgentId: agentId }
  });
}
