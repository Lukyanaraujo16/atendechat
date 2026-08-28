import * as Yup from "yup";
import crypto from "crypto";
import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import Company from "../../models/Company";
import Plan from "../../models/Plan";
import AssociateWhatsappQueue from "./AssociateWhatsappQueue";
import {
  parseWhatsAppConnectionProviderInput,
  WhatsAppConnectionProvider,
  WhatsAppConnectionProviderValue,
  isEvolutionConnection,
  isWhatsAppConnectionProvider
} from "../../modules/whatsapp/connectionProvider";
import { ERR_WHATSAPP_CONNECTION_PROVIDER_INVALID } from "../../modules/whatsapp/providers/evolution/evolutionErrors";
import { provisionCentralEvolutionCredentials } from "../../modules/whatsapp/providers/evolution/central/provisionCentralEvolutionCredentials";
import { assertEvolutionCentralProvisionAllowed } from "./evolutionProvisioningGuard";

interface EvolutionConfigInput {
  baseUrl?: string;
  instanceName?: string;
  instanceId?: string | null;
  apiKey?: string;
}

interface Request {
  name: string;
  companyId: number;
  queueIds?: number[];
  greetingMessage?: string;
  complationMessage?: string;
  outOfHoursMessage?: string;
  ratingMessage?: string;
  status?: string;
  isDefault?: boolean;
  token?: string;
  /** Legado Baileys stable/beta — NÃO é connectionProvider. */
  provider?: string;
  connectionProvider?: string;
  evolution?: EvolutionConfigInput;
  transferQueueId?: number;
  timeToTransfer?: number;
  promptId?: number;
  maxUseBotQueues?: number;
  timeUseBotQueues?: number;
  expiresTicket?: number;
  expiresInactiveMessage?: string;
  integrationId?: number;
  flowIdWelcome?: number;
  flowIdNotPhrase?: number;
  autoReadMessages?: boolean;
  defaultGroupVisible?: boolean;
  ticketVisibility?: string;
  /** Usuário que solicita a criação — gate Evolution central (Fase 10.5). */
  createdByUserId?: number;
}

interface Response {
  whatsapp: Whatsapp;
  oldDefaultWhatsapp: Whatsapp | null;
}

const CreateWhatsAppService = async ({
  name,
  status = "OPENING",
  queueIds = [],
  greetingMessage,
  complationMessage,
  outOfHoursMessage,
  ratingMessage,
  isDefault = false,
  companyId,
  token = "",
  provider = "beta",
  connectionProvider: connectionProviderInput,
  evolution,
  transferQueueId,
  timeToTransfer,
  promptId,
  maxUseBotQueues = 3,
  timeUseBotQueues = 0,
  expiresTicket = 0,
  expiresInactiveMessage = "",
  integrationId = null,
  flowIdWelcome = null,
  flowIdNotPhrase = null,
  autoReadMessages = true,
  defaultGroupVisible = false,
  ticketVisibility = "all",
  createdByUserId
}: Request): Promise<Response> => {
  const company = await Company.findOne({
    where: {
      id: companyId
    },
    include: [{ model: Plan, as: "plan" }]
  });

  if (company !== null) {
    const whatsappCount = await Whatsapp.count({
      where: {
        companyId
      }
    });

    if (whatsappCount >= company.plan.connections) {
      throw new AppError(
        `Número máximo de conexões já alcançado: ${whatsappCount}`
      );
    }
  }

  let connectionProvider: WhatsAppConnectionProviderValue =
    WhatsAppConnectionProvider.BAILEYS;
  try {
    if (
      connectionProviderInput != null &&
      connectionProviderInput !== "" &&
      !isWhatsAppConnectionProvider(
        String(connectionProviderInput).trim().toLowerCase()
      )
    ) {
      throw new AppError(
        ERR_WHATSAPP_CONNECTION_PROVIDER_INVALID,
        400,
        `connectionProvider inválido: ${String(connectionProviderInput)}`
      );
    }
    connectionProvider = parseWhatsAppConnectionProviderInput(
      connectionProviderInput
    );
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      ERR_WHATSAPP_CONNECTION_PROVIDER_INVALID,
      400,
      err instanceof Error ? err.message : String(err)
    );
  }

  // Evolution: não iniciar como OPENING (evita lifecycle Baileys/QR).
  const effectiveStatus = isEvolutionConnection(connectionProvider)
    ? status &&
      status !== "OPENING" &&
      status !== "CONNECTED" &&
      status !== "qrcode"
      ? status
      : "DISCONNECTED"
    : status;

  if (isEvolutionConnection(connectionProvider)) {
    await assertEvolutionCentralProvisionAllowed({
      createdByUserId,
      evolution
    });
  }

  const schema = Yup.object().shape({
    name: Yup.string()
      .required()
      .min(2)
      .test(
        "Check-name",
        "Esse nome já está sendo utilizado por outra conexão",
        async value => {
          if (!value) return false;
          const nameExists = await Whatsapp.findOne({
            where: { name: value, companyId }
          });
          return !nameExists;
        }
      ),
    isDefault: Yup.boolean().required()
  });

  try {
    await schema.validate({ name, status: effectiveStatus, isDefault });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const whatsappFound = await Whatsapp.findOne({ where: { companyId } });

  isDefault = !whatsappFound;

  let oldDefaultWhatsapp: Whatsapp | null = null;

  if (isDefault) {
    oldDefaultWhatsapp = await Whatsapp.findOne({
      where: { isDefault: true, companyId }
    });
    if (oldDefaultWhatsapp) {
      await oldDefaultWhatsapp.update({ isDefault: false, companyId });
    }
  }

  const finalToken =
    token && String(token).trim() !== ""
      ? String(token).trim()
      : crypto.randomBytes(24).toString("hex");

  if (token && String(token).trim() !== "") {
    const tokenSchema = Yup.object().shape({
      token: Yup.string()
        .required()
        .min(2)
        .test(
          "Check-token",
          "This whatsapp token is already used.",
          async value => {
            if (!value) return false;
            const tokenExists = await Whatsapp.findOne({
              where: { token: value }
            });
            return !tokenExists;
          }
        )
    });

    try {
      await tokenSchema.validate({ token: finalToken });
    } catch (err: any) {
      throw new AppError(err.message);
    }
  }

  console.info(
    "[Connection]",
    JSON.stringify({
      event: "whatsapp_create",
      companyId,
      name,
      connectionProvider
    })
  );

  const greetingStored =
    greetingMessage != null && String(greetingMessage).trim() !== ""
      ? String(greetingMessage).trim()
      : null;

  const whatsapp = await Whatsapp.create(
    {
      name,
      status: effectiveStatus,
      greetingMessage: greetingStored,
      complationMessage,
      outOfHoursMessage,
      ratingMessage,
      isDefault,
      companyId,
      token: finalToken,
      provider,
      connectionProvider,
      transferQueueId,
      timeToTransfer,
      promptId,
      maxUseBotQueues,
      timeUseBotQueues,
      expiresTicket,
      expiresInactiveMessage,
      integrationId,
      flowIdWelcome,
      flowIdNotPhrase,
      autoReadMessages,
      defaultGroupVisible: Boolean(defaultGroupVisible),
      ticketVisibility:
        ticketVisibility === "admin_supervisor" ? "admin_supervisor" : "all"
    },
    { include: ["queues"] }
  );

  if (isEvolutionConnection(connectionProvider)) {
    try {
      await provisionCentralEvolutionCredentials({
        companyId,
        whatsappId: whatsapp.id
      });
    } catch (err) {
      await whatsapp.destroy();
      throw err;
    }
  }

  await AssociateWhatsappQueue(whatsapp, queueIds);

  return { whatsapp, oldDefaultWhatsapp };
};

export default CreateWhatsAppService;
