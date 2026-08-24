import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import AiAgent from "../../models/AiAgent";
import { loadCompanyPlanContextByCompanyId } from "../../middleware/loadCompanyEffectiveFeatures";
import { isAiAgentArchived } from "../../helpers/isAiAgentArchived";
import { AI_AGENT_PLAN_FEATURE_KEY } from "./resolveAiAgentWhatsappFields";
import { InboundMessageClassification } from "./classifyInboundMessage";

export type AiAgentInboundChannel = "whatsapp";

export type AiAgentInboundMessageInput = {
  id?: string | null;
  fromMe?: boolean;
  body?: string | null;
  classification?: InboundMessageClassification;
};

export type AiAgentRuntimeContext = {
  companyId: number;
  channel: AiAgentInboundChannel;
  planHasAiAgent: boolean;
  ticket: Ticket;
  contact: Contact;
  whatsapp: Whatsapp;
  message: AiAgentInboundMessageInput;
  aiAgent: AiAgent | null;
};

export type BuildAiAgentRuntimeContextInput = {
  companyId: number;
  ticket: Ticket;
  contact: Contact;
  whatsapp: Whatsapp;
  message: AiAgentInboundMessageInput;
  channel?: AiAgentInboundChannel;
};

export async function buildAiAgentRuntimeContext(
  input: BuildAiAgentRuntimeContextInput
): Promise<AiAgentRuntimeContext> {
  const channel = input.channel ?? "whatsapp";

  const [planCtx, ticket, aiAgent] = await Promise.all([
    loadCompanyPlanContextByCompanyId(input.companyId),
    Ticket.findOne({
      where: { id: input.ticket.id, companyId: input.companyId }
    }),
    input.whatsapp.aiAgentId
      ? AiAgent.findOne({
          where: {
            id: input.whatsapp.aiAgentId,
            companyId: input.companyId
          }
        })
      : Promise.resolve(null)
  ]);

  return {
    companyId: input.companyId,
    channel,
    planHasAiAgent: planCtx?.featureMap[AI_AGENT_PLAN_FEATURE_KEY] === true,
    ticket: ticket ?? input.ticket,
    contact: input.contact,
    whatsapp: input.whatsapp,
    message: input.message,
    aiAgent: isAiAgentArchived(aiAgent) ? null : aiAgent
  };
}
