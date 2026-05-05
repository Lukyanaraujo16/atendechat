import AppError from "../../errors/AppError";
import { WebhookModel } from "../../models/Webhook";
import { sendMessageFlow } from "../../controllers/MessageController";
import { IConnections, INodes } from "./DispatchWebHookService";
import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { ParsedQs } from "qs";
import CreateContactService from "../ContactServices/CreateContactService";
import Contact from "../../models/Contact";
import SetContactDisableBotService from "../ContactServices/SetContactDisableBotService";
//import CreateTicketService from "../TicketServices/CreateTicketService";
//import CreateTicketServiceWebhook from "../TicketServices/CreateTicketServiceWebhook";
import { SendMessage } from "../../helpers/SendMessage";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import fs from "fs";
import GetWhatsappWbot from "../../helpers/GetWhatsappWbot";
import path from "path";
import SendWhatsAppMedia from "../WbotServices/SendWhatsAppMedia";
import SendWhatsAppMediaFlow, {
  typeSimulation
} from "../WbotServices/SendWhatsAppMediaFlow";
import { randomizarCaminho } from "../../utils/randomizador";
import { SendMessageFlow } from "../../helpers/SendMessageFlow";
import formatBody from "../../helpers/Mustache";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import ShowTicketService from "../TicketServices/ShowTicketService";
import CreateMessageService, {
  MessageData
} from "../MessageServices/CreateMessageService";
import { randomString } from "../../utils/randomCode";
import ShowQueueService from "../QueueService/ShowQueueService";
import { getIO } from "../../libs/socket";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import TicketTag from "../../models/TicketTag";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import ShowTicketUUIDService from "../TicketServices/ShowTicketFromUUIDService";
import {logger} from "../../utils/logger";
///import CreateLogTicketService from "../TicketServices/CreateLogTicketService";
//import CompaniesSettings from "../../models/CompaniesSettings";
//import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import { delay } from "bluebird";
import typebotListener from "../TypebotServices/typebotListener";
import { getWbot } from "../../libs/wbot";
import { proto } from "@whiskeysockets/baileys";
import { handleOpenAi } from "../IntegrationsServices/OpenAiService";
import { IOpenAi } from "../../@types/openai";
import { v4 as uuidv4 } from "uuid";
import { getTicketRemoteJid, parseTicketDataWebhook } from "../../helpers/GetTicketRemoteJid";
import {
  evaluateFlowCondition,
  pickConditionEdgeTarget
} from "../FlowBuilderService/EvaluateFlowConditionService";
import {
  executeFlowHttpRequestAndPersist,
  pickHttpRequestEdgeTarget
} from "../FlowBuilderService/ExecuteFlowHttpRequestService";
import AddContactToContactListFromTicketService from "../FlowBuilderService/AddContactToContactListFromTicketService";
import { isFlowBuilderDebugEnabled } from "../../utils/flowBuilderDebug";
import { createFlowExecutionLogIfTicket } from "../FlowBuilderService/FlowExecutionLogService";
import {
  cancelFlowMenuTimeout,
  scheduleFlowMenuTimeout
} from "../FlowBuilderService/flowMenuTimeoutScheduler";

interface IAddContact {
  companyId: number;
  name: string;
  phoneNumber: string;
  email?: string;
  dataMore?: any;
}

export const ActionsWebhookService = async (
  whatsappId: number,
  idFlowDb: number,
  companyId: number,
  nodes: INodes[],
  connects: IConnections[],
  nextStage: string,
  dataWebhook: any,
  details: any,
  hashWebhookId: string,
  pressKey?: string,
  idTicket?: number,
  numberPhrase: "" | { number: string; name: string; email: string } = "",
  msg?: proto.IWebMessageInfo
): Promise<string> => {
  try {
    if (
      idTicket &&
      pressKey != null &&
      String(pressKey).trim() !== "" &&
      pressKey !== "999"
    ) {
      await cancelFlowMenuTimeout(idTicket).catch(() => undefined);
    }
    const io = getIO();
    const originalWhatsAppMsg = msg;
    let next = nextStage;
    if (isFlowBuilderDebugEnabled()) {
      logger.info(
        {
          flowBuilderDebug: true,
          idFlowDb,
          companyId,
          nextStage,
          idTicket,
          pressKey: pressKey ?? null
        },
        "[FlowBuilder][debug] ActionsWebhookService entrada"
      );
    }
    if (
      pressKey != null &&
      pressKey !== "999" &&
      pressKey !== "parar"
    ) {
      pressKey = String(pressKey).trim().replace(/\u200e/g, "");
    }
    let createFieldJsonName = "";

    const connectStatic = connects;
    const hasWebhookFormInputs =
      details &&
      typeof details === "object" &&
      Array.isArray((details as { inputs?: unknown }).inputs);

    if (numberPhrase === "") {
      if (hasWebhookFormInputs) {
        const d = details as {
          inputs: { keyValue: string; data: string }[];
          keysFull: string[];
        };
        const nameInput = d.inputs.find(item => item.keyValue === "nome");
        if (nameInput) {
          nameInput.data.split(",").map(dataN => {
            const lineToData = d.keysFull.find(item => item === dataN);
            let sumRes = "";
            if (!lineToData) {
              sumRes = dataN;
            } else {
              sumRes = constructJsonLine(lineToData, dataWebhook);
            }
            createFieldJsonName = createFieldJsonName + sumRes;
          });
        }
      }
    } else {
      createFieldJsonName = numberPhrase.name;
    }

    let numberClient = "";

    if (numberPhrase === "") {
      if (hasWebhookFormInputs) {
        const d = details as {
          inputs: { keyValue: string; data: string }[];
          keysFull: string[];
        };
        const numberInput = d.inputs.find(
          item => item.keyValue === "celular"
        );
        if (numberInput) {
          numberInput.data.split(",").map(dataN => {
            const lineToDataNumber = d.keysFull.find(item => item === dataN);
            let createFieldJsonNumber = "";
            if (!lineToDataNumber) {
              createFieldJsonNumber = dataN;
            } else {
              createFieldJsonNumber = constructJsonLine(
                lineToDataNumber,
                dataWebhook
              );
            }

            numberClient = numberClient + createFieldJsonNumber;
          });
        }
      }
    } else {
      numberClient = numberPhrase.number;
    }

    numberClient = removerNaoLetrasNumeros(numberClient);

    if (numberClient.substring(0, 2) === "55") {
      if (parseInt(numberClient.substring(2, 4)) >= 31) {
        if (numberClient.length === 13) {
          numberClient =
            numberClient.substring(0, 4) + numberClient.substring(5, 13);
        }
      }
    }

    let createFieldJsonEmail = "";

    if (numberPhrase === "") {
      if (hasWebhookFormInputs) {
        const d = details as {
          inputs: { keyValue: string; data: string }[];
          keysFull: string[];
        };
        const emailInput = d.inputs.find(item => item.keyValue === "email");
        if (emailInput) {
          emailInput.data.split(",").map(dataN => {
            const lineToDataEmail = d.keysFull.find(item =>
              item.endsWith("email")
            );

            let sumRes = "";
            if (!lineToDataEmail) {
              sumRes = dataN;
            } else {
              sumRes = constructJsonLine(lineToDataEmail, dataWebhook);
            }

            createFieldJsonEmail = createFieldJsonEmail + sumRes;
          });
        }
      }
    } else {
      createFieldJsonEmail = numberPhrase.email;
    }

    const lengthLoop = nodes.length;
    const whatsapp = whatsappId
      ? await ShowWhatsAppService(whatsappId, companyId)
      : await GetDefaultWhatsApp(companyId);

    if (whatsapp.status !== "CONNECTED") {
      return;
    }

    let execCount = 0;

    let execFn = "";

    let ticket: Ticket | null = null;
    if (idTicket && whatsappId) {
      ticket = await Ticket.findOne({
        where: { id: idTicket, whatsappId, companyId },
        include: [{ model: Contact, as: "contact" }]
      });
    }

    if (idTicket && ticket && isFlowBuilderDebugEnabled()) {
      logger.info(
        {
          flowBuilderTicketEmit: true,
          idTicket,
          contactId: ticket.contactId,
          contactNumber: ticket.contact?.number,
          queueId: ticket.queueId,
          whatsappId: ticket.whatsappId
        },
        "[FlowBuilder][debug] ticket no início do fluxo"
      );
    }

    let noAlterNext = false;
    /** Após nó attendant bem-sucedido, não zerar userId no fim da iteração (nem nas seguintes). */
    let flowAssignedHumanUser = false;

    for (var i = 0; i < lengthLoop; i++) {
      if (isFlowBuilderDebugEnabled()) {
        logger.info(
          {
            flowBuilderNodeLoop: true,
            idFlowDb,
            idTicket,
            ticketIdStable: ticket?.id,
            loopIndex: i,
            nextStage: next,
            pressKey: pressKey ?? null
          },
          "[FlowBuilder][debug] iteração do fluxo"
        );
      }
      let nodeSelected: any;
      let ticketInit: Ticket;

      if (pressKey) {
        if (pressKey === "parar") {
          if (idTicket) {
            ticketInit = await Ticket.findOne({
              where: { id: idTicket, whatsappId }
            });
            await ticket.update({
              status: "closed"
            });
          }
          break;
        }

        if (execFn === "") {
          nodeSelected = nodes.filter(node => node.id === next)[0];
        } else {
          nodeSelected = nodes.filter(node => node.id === execFn)[0];
        }
      } else {
        const otherNode = nodes.filter(node => node.id === next)[0];
        if (otherNode) {
          nodeSelected = otherNode;
        }
      }

      if (!nodeSelected) {
        logger.warn(
          { flowBuilder: true, next, pressKey: pressKey ?? null },
          "[FlowBuilder] nó atual não resolvido — interrompendo fluxo"
        );
        await createFlowExecutionLogIfTicket(
          idTicket,
          companyId,
          idFlowDb,
          "-",
          "-",
          "flow_error",
          "error",
          { reason: "node_not_resolved", next, pressKey: pressKey ?? null }
        );
        break;
      }

      if (idTicket) {
        if (i === 0) {
          await createFlowExecutionLogIfTicket(
            idTicket,
            companyId,
            idFlowDb,
            String(nodeSelected.id),
            String(nodeSelected.type),
            "flow_started",
            "ok",
            { initialNext: nextStage, pressKey: pressKey ?? null }
          );
        }
        await createFlowExecutionLogIfTicket(
          idTicket,
          companyId,
          idFlowDb,
          String(nodeSelected.id),
          String(nodeSelected.type),
          "node_executed",
          "ok",
          { loopIndex: i, pressKey: pressKey ?? null }
        );
      }

      if (nodeSelected.type === "message") {

        const ticketDetailsForMsg = await ShowTicketService(
          ticket.id,
          companyId
        );
        const msg = {
          body: interpolateFlowMessage(
            nodeSelected.data.label,
            ticket,
            ticketDetailsForMsg.contact
          )
        };

        if (ticket && ticket.contact) {
          const ticketDetails = ticketDetailsForMsg;
          const destJid =
            (await getTicketRemoteJid(ticketDetails)) ||
            originalWhatsAppMsg?.key?.remoteJid ||
            null;
          if (isFlowBuilderDebugEnabled()) {
            logger.info(
              {
                flowBuilderSendDest: true,
                ticketId: ticketDetails.id,
                contactId: ticketDetails.contactId,
                contactNumber: ticketDetails.contact?.number,
                destJid
              },
              "[FlowBuilder] message node: destino do envio (ticket)"
            );
          }
          await delay(500);
          await typeSimulation(ticketDetails, "composing");
          // Usar remoteJid da mensagem original para conversas LID (garante que a resposta chegue ao cliente)
          const sentMessage = await SendWhatsAppMessage({
            body: msg.body,
            ticket: ticketDetails,
            quotedMsg: null,
            ...(originalWhatsAppMsg?.key?.remoteJid && { remoteJid: originalWhatsAppMsg.key.remoteJid })
          });
          if (sentMessage) {
            await CreateMessageService({
              messageData: {
                id: (sentMessage as any)?.key?.id || uuidv4(),
                ticketId: ticketDetails.id,
                body: msg.body,
                fromMe: true,
                read: true,
                ack: (sentMessage as any)?.status,
                mediaType: "conversation",
                remoteJid: (sentMessage as any)?.key?.remoteJid,
                ...((sentMessage as any) ? { dataJson: JSON.stringify(sentMessage as any) } : {})
              } as MessageData,
              companyId: ticketDetails.companyId
            });
          }
          SetTicketMessagesAsRead(ticketDetails);
        } else if (idTicket) {
          const ticketDetails = await ShowTicketService(idTicket, companyId);
          if (ticketDetails.contact) {
            const destJid =
              (await getTicketRemoteJid(ticketDetails)) ||
              originalWhatsAppMsg?.key?.remoteJid ||
              null;
            if (isFlowBuilderDebugEnabled()) {
              logger.info(
                {
                  flowBuilderSendDest: true,
                  ticketId: ticketDetails.id,
                  branch: "message_node_recovered_ticket",
                  contactNumber: ticketDetails.contact?.number,
                  numberClientFallback: numberClient,
                  destJid
                },
                "[FlowBuilder] message node: ticket sem contact na 1ª carga — usando ShowTicketService"
              );
            }
            await delay(500);
            await typeSimulation(ticketDetails, "composing");
            const sentMessage = await SendWhatsAppMessage({
              body: msg.body,
              ticket: ticketDetails,
              quotedMsg: null,
              ...(originalWhatsAppMsg?.key?.remoteJid && { remoteJid: originalWhatsAppMsg.key.remoteJid })
            });
            if (sentMessage) {
              await CreateMessageService({
                messageData: {
                  id: (sentMessage as any)?.key?.id || uuidv4(),
                  ticketId: ticketDetails.id,
                  body: msg.body,
                  fromMe: true,
                  read: true,
                  ack: (sentMessage as any)?.status,
                  mediaType: "conversation",
                  remoteJid: (sentMessage as any)?.key?.remoteJid,
                  ...((sentMessage as any) ? { dataJson: JSON.stringify(sentMessage as any) } : {})
                } as MessageData,
                companyId: ticketDetails.companyId
              });
            }
            SetTicketMessagesAsRead(ticketDetails);
          } else {
            logger.warn(
              { ticketId: idTicket, numberClient },
              "[FlowBuilder] message node: sem contact no ticket — fallback SendMessage (pode duplicar conversa em LID)"
            );
            await SendMessage(whatsapp, {
              number: numberClient,
              body: msg.body
            });
          }
        } else {
          await SendMessage(whatsapp, {
            number: numberClient,
            body: msg.body
          });
        }

        await intervalWhats("1");
      }
      if (nodeSelected.type === "typebot") {
        const wbot = getWbot(whatsapp.id);
        await typebotListener({
          wbot: wbot,
          msg,
          ticket,
          typebot: nodeSelected.data.typebotIntegration
        });
      }

      if (nodeSelected.type === "openai") {
        let {
          name,
          prompt,
          model,
          voice,
          voiceKey,
          voiceRegion,
          maxTokens,
          temperature,
          apiKey,
          queueId,
          maxMessages
        } = nodeSelected.data.typebotIntegration as IOpenAi;

        let openAiSettings = {
          name,
          prompt,
          model: model && String(model).trim() ? String(model).trim() : undefined,
          voice,
          voiceKey,
          voiceRegion,
          maxTokens: parseInt(String(maxTokens), 10) || 100,
          temperature: parseFloat(String(temperature ?? "1")) || 1,
          apiKey,
          queueId: parseInt(String(queueId), 10),
          maxMessages: parseInt(String(maxMessages), 10) || 10
        };

        const contact = await Contact.findOne({
          where: { number: numberClient, companyId }
        });

        const wbot = getWbot(whatsapp.id);

        const ticketTraking = await FindOrCreateATicketTrakingService({
          ticketId: ticket.id,
          companyId,
          userId: null,
          whatsappId: whatsapp?.id
        });

        await handleOpenAi(
          openAiSettings,
          msg,
          wbot,
          ticket,
          contact,
          null,
          ticketTraking
        );
      }

      if (nodeSelected.type === "question") {
        const message =
          nodeSelected.data?.typebotIntegration?.message ?? "";
        const ticketDetails = await ShowTicketService(ticket.id, companyId);

        const bodyFila = interpolateFlowMessage(
          `${message}`,
          ticket,
          ticketDetails.contact
        );

        if (isFlowBuilderDebugEnabled()) {
          logger.info(
            {
              flowBuilderQuestionSend: true,
              ticketId: ticket.id,
              preview: bodyFila.slice(0, 120),
              varsKeys: Object.keys(getFlowVariablesFromTicket(ticket))
            },
            "[FlowBuilder][debug] enviando pergunta (interpolação {{chave}} + Mustache contato)"
          );
        }

        await delay(3000);
        await typeSimulation(ticket, "composing");

        await SendWhatsAppMessage({
          body: bodyFila,
          ticket: ticketDetails,
          quotedMsg: null
        });

        SetTicketMessagesAsRead(ticketDetails);

        await ticketDetails.update({
          lastMessage: bodyFila
        });

        await ticket.update({
          userId: null,
          companyId: companyId,
          lastFlowId: nodeSelected.id,
          hashFlowId: hashWebhookId,
          flowStopped: idFlowDb.toString()
        });
        break;
      }

      if (nodeSelected.type === "waitForInteraction") {
        await ticket.update({
          userId: null,
          companyId: companyId,
          lastFlowId: nodeSelected.id,
          hashFlowId: hashWebhookId,
          flowStopped: idFlowDb.toString()
        });
        break;
      }

      if (nodeSelected.type === "ticket") {
        /*const queueId = nodeSelected.data?.data?.id || nodeSelected.data?.id;
        const queue = await ShowQueueService(queueId, companyId);

        await ticket.update({
          status: "pending",
          queueId: queue.id,
          userId: ticket.userId,
          companyId: companyId,
          flowWebhook: true,
          lastFlowId: nodeSelected.id,
          hashFlowId: hashWebhookId,
          flowStopped: idFlowDb.toString()
        });

        await FindOrCreateATicketTrakingService({
          ticketId: ticket.id,
          companyId,
          whatsappId: ticket.whatsappId,
          userId: ticket.userId
        });

        await UpdateTicketService({
          ticketData: {
            status: "pending",
            queueId: queue.id
          },
          ticketId: ticket.id,
          companyId
        });

        await CreateLogTicketService({
          ticketId: ticket.id,
          type: "queue",
          queueId: queue.id
        });

        let settings = await CompaniesSettings.findOne({
          where: {
            companyId: companyId
          }
        });

        const enableQueuePosition = settings.sendQueuePosition === "enabled";

        if (enableQueuePosition) {
          const count = await Ticket.findAndCountAll({
            where: {
              userId: null,
              status: "pending",
              companyId,
              queueId: queue.id,
              whatsappId: whatsapp.id,
              isGroup: false
            }
          });

          // Lógica para enviar posição da fila de atendimento
          const qtd = count.count === 0 ? 1 : count.count;

          const msgFila = `${settings.sendQueuePositionMessage} *${qtd}*`;

          const ticketDetails = await ShowTicketService(ticket.id, companyId);

          const bodyFila = formatBody(`${msgFila}`, ticket.contact);

          await delay(3000);
          await typeSimulation(ticket, "composing");

          await SendWhatsAppMessage({
            body: bodyFila,
            ticket: ticketDetails,
            quotedMsg: null
          });

          SetTicketMessagesAsRead(ticketDetails);

          await ticketDetails.update({
            lastMessage: bodyFila
          });
        }*/
      }

      if (nodeSelected.type === "sector" && idTicket) {
        const queueId = nodeSelected.data?.queue?.id || nodeSelected.data?.id;
        if (queueId) {
          const queue = await ShowQueueService(queueId, companyId);
          if (queue) {
            await UpdateTicketService({
              ticketData: {
                status: "pending",
                queueId: queue.id
              },
              ticketId: String(idTicket),
              companyId
            });
            ticket = await ShowTicketService(idTicket, companyId);
            await createFlowExecutionLogIfTicket(
              idTicket,
              companyId,
              idFlowDb,
              String(nodeSelected.id),
              "sector",
              "transferred_to_queue",
              "ok",
              { queueId: queue.id, queueName: queue.name }
            );
            if (isFlowBuilderDebugEnabled()) {
              logger.info(
                {
                  flowBuilderSector: true,
                  ticketId: idTicket,
                  queueId: ticket.queueId,
                  queueName: ticket.queue?.name
                },
                "[FlowBuilder] sector node: ticket após transferência de fila"
              );
            }
          }
        }
        await intervalWhats("1");
      }

      if (nodeSelected.type === "attendant" && idTicket) {
        /** Padrão: parar o fluxo após transferência; `stopFlowAfterTransfer: false` permite seguir (ex.: mensagem pós-transferência). */
        const stopFlowAfterTransfer =
          nodeSelected.data?.stopFlowAfterTransfer !== false;
        const targetUserId = Number(nodeSelected.data?.user?.id);
        if (!targetUserId || Number.isNaN(targetUserId)) {
          logger.warn(
            { flowBuilderAttendant: true, ticketId: idTicket },
            "[FlowBuilder][attendant] user.id inválido — ignorando transferência"
          );
        } else {
          const assignUser = await User.findOne({
            where: { id: targetUserId, companyId }
          });
          if (!assignUser) {
            logger.warn(
              {
                flowBuilderAttendant: true,
                ticketId: idTicket,
                targetUserId
              },
              "[FlowBuilder][attendant] usuário não encontrado na empresa"
            );
          } else {
            const currentTicket = await ShowTicketService(idTicket, companyId);
            const previousUserId = currentTicket.userId;
            const previousQueueId = currentTicket.queueId;
            const previousStatus = currentTicket.status;
            await UpdateTicketService({
              ticketData: {
                /** pending: atendente designado vê como aguardando e pode assumir (open = “em atendimento”). */
                status: "pending",
                userId: targetUserId,
                queueId: currentTicket.queueId ?? null,
                chatbot: false
              },
              ticketId: String(idTicket),
              companyId
            });
            ticket = await ShowTicketService(idTicket, companyId);
            flowAssignedHumanUser = true;

            await createFlowExecutionLogIfTicket(
              idTicket,
              companyId,
              idFlowDb,
              String(nodeSelected.id),
              "attendant",
              "transferred_to_attendant",
              "ok",
              {
                userId: targetUserId,
                userName: assignUser.name,
                stopFlowAfterTransfer
              }
            );

            logger.info(
              {
                flowBuilderAttendant: true,
                ticketId: idTicket,
                previousUserId,
                newUserId: ticket.userId,
                previousStatus,
                finalStatus: ticket.status,
                queueId: ticket.queueId,
                previousQueueId,
                stopFlowAfterTransfer
              },
              "[FlowBuilder][attendant] transferência concluída (UpdateTicketService)"
            );

            if (stopFlowAfterTransfer) {
              await ticket.update({
                lastFlowId: nodeSelected.id,
                hashFlowId: null,
                flowWebhook: false,
                flowStopped: idFlowDb.toString()
              });
              await createFlowExecutionLogIfTicket(
                idTicket,
                companyId,
                idFlowDb,
                String(nodeSelected.id),
                "attendant",
                "flow_stopped",
                "ok",
                { reason: "after_attendant_transfer" }
              );
              logger.info(
                {
                  flowBuilderAttendant: true,
                  ticketId: idTicket,
                  previousUserId,
                  newUserId: ticket.userId,
                  previousStatus,
                  finalStatus: ticket.status,
                  queueId: ticket.queueId,
                  flowInterruptedAfterAttendant: true
                },
                "[FlowBuilder][attendant] fluxo automático interrompido após transferência"
              );
              await intervalWhats("1");
              break;
            }
          }
        }
        await intervalWhats("1");
      }

      if (nodeSelected.type === "closeTicket" && idTicket) {
        await UpdateTicketService({
          ticketData: { status: "closed" },
          ticketId: String(idTicket),
          companyId
        });
        await createFlowExecutionLogIfTicket(
          idTicket,
          companyId,
          idFlowDb,
          String(nodeSelected.id),
          "closeTicket",
          "ticket_closed",
          "ok",
          {}
        );
        /** Socket já emitido por UpdateTicketService; evitar `io.of(companyId)` (namespace inexistente para os clientes). */
        await intervalWhats("1");
      }

      if (nodeSelected.type === "tag" && idTicket) {
        const tagId = nodeSelected.data?.tag?.id || nodeSelected.data?.id;
        if (tagId) {
          const existing = await TicketTag.findOne({
            where: { ticketId: idTicket, tagId }
          });
          if (!existing) {
            await TicketTag.create({ ticketId: idTicket, tagId });
          }
        }
        await intervalWhats("1");
      }

      if (nodeSelected.type === "notification" && idTicket) {
        try {
          const ticketDetails = await ShowTicketService(idTicket, companyId);
          const rawPhone = String(nodeSelected.data?.phone ?? "").trim();
          const rawMsg = String(nodeSelected.data?.message ?? "");
          const phoneInterpolated = interpolateFlowMessage(
            rawPhone,
            ticketDetails,
            ticketDetails.contact
          );
          const messageInterpolated = interpolateFlowMessage(
            rawMsg,
            ticketDetails,
            ticketDetails.contact
          );
          const destDigits = phoneInterpolated.replace(/\D/g, "");
          if (!destDigits || destDigits.length < 8) {
            await createFlowExecutionLogIfTicket(
              idTicket,
              companyId,
              idFlowDb,
              String(nodeSelected.id),
              "notification",
              "notification_sent",
              "error",
              { reason: "invalid_phone_after_interpolation" }
            );
            logger.warn(
              {
                flowBuilderNotification: true,
                ticketId: idTicket,
                success: false,
                reason: "invalid_phone"
              },
              "[FlowBuilder][notification] telefone inválido após interpolação"
            );
          } else {
            await SendMessage(whatsapp, {
              number: destDigits,
              body: messageInterpolated
            });
            await createFlowExecutionLogIfTicket(
              idTicket,
              companyId,
              idFlowDb,
              String(nodeSelected.id),
              "notification",
              "notification_sent",
              "ok",
              {
                destinationDigits: destDigits,
                messagePreview: messageInterpolated.slice(0, 200)
              }
            );
            logger.info(
              {
                flowBuilderNotification: true,
                ticketId: idTicket,
                destination: destDigits,
                messageInterpolated: messageInterpolated.slice(0, 500),
                success: true
              },
              "[FlowBuilder][notification] envio WhatsApp (fora do ticket do cliente)"
            );
          }
        } catch (err: any) {
          await createFlowExecutionLogIfTicket(
            idTicket,
            companyId,
            idFlowDb,
            String(nodeSelected.id),
            "notification",
            "notification_sent",
            "error",
            { err: String(err?.message || err).slice(0, 300) }
          );
          logger.warn(
            {
              flowBuilderNotification: true,
              ticketId: idTicket,
              success: false,
              err: String(err?.message || err).slice(0, 300)
            },
            "[FlowBuilder][notification] falha no envio"
          );
        }
        await intervalWhats("1");
      }

      if (nodeSelected.type === "blacklist" && idTicket) {
        const rawAction = String(nodeSelected.data?.action ?? "add").toLowerCase();
        const action = rawAction === "remove" ? "remove" : "add";
        const disableBot = action === "add";
        try {
          const ticketBl = await Ticket.findOne({
            where: { id: idTicket, companyId },
            attributes: ["id", "contactId"]
          });
          const contactId = ticketBl?.contactId;
          if (!contactId) {
            await createFlowExecutionLogIfTicket(
              idTicket,
              companyId,
              idFlowDb,
              String(nodeSelected.id),
              "blacklist",
              "blacklist_changed",
              "warning",
              { action, reason: "no_contact_on_ticket" }
            );
            logger.warn(
              {
                flowBuilderBlacklist: true,
                ticketId: idTicket,
                success: false,
                action,
                reason: "no_contact_on_ticket"
              },
              "[FlowBuilder][blacklist] ticket sem contactId"
            );
          } else {
            const contactAfter = await SetContactDisableBotService({
              contactId,
              companyId,
              disableBot
            });
            await createFlowExecutionLogIfTicket(
              idTicket,
              companyId,
              idFlowDb,
              String(nodeSelected.id),
              "blacklist",
              "blacklist_changed",
              "ok",
              { action, disableBot: contactAfter.disableBot, contactId }
            );
            logger.info(
              {
                flowBuilderBlacklist: true,
                ticketId: idTicket,
                contactId: contactAfter.id,
                contactNumber: contactAfter.number,
                action,
                disableBot: contactAfter.disableBot,
                success: true
              },
              "[FlowBuilder][blacklist] disableBot aplicado no contato"
            );
          }
        } catch (err: any) {
          await createFlowExecutionLogIfTicket(
            idTicket,
            companyId,
            idFlowDb,
            String(nodeSelected.id),
            "blacklist",
            "blacklist_changed",
            "error",
            { action, err: String(err?.message || err).slice(0, 300) }
          );
          logger.warn(
            {
              flowBuilderBlacklist: true,
              ticketId: idTicket,
              action,
              success: false,
              err: String(err?.message || err).slice(0, 300)
            },
            "[FlowBuilder][blacklist] falha ao aplicar"
          );
        }
        await intervalWhats("1");
      }

      if (nodeSelected.type === "flowUp" && idTicket) {
        const listId = Number(
          nodeSelected.data?.contactList?.id ?? nodeSelected.data?.id
        );
        try {
          if (!listId || Number.isNaN(listId)) {
            await createFlowExecutionLogIfTicket(
              idTicket,
              companyId,
              idFlowDb,
              String(nodeSelected.id),
              "flowUp",
              "flowup_added",
              "error",
              { reason: "missing_contact_list_id" }
            );
            logger.warn(
              {
                flowBuilderFlowUp: true,
                ticketId: idTicket,
                success: false,
                reason: "missing_contact_list_id"
              },
              "[FlowBuilder][flowUp] lista não configurada"
            );
          } else {
            const result = await AddContactToContactListFromTicketService({
              ticketId: idTicket,
              companyId,
              contactListId: listId
            });
            await createFlowExecutionLogIfTicket(
              idTicket,
              companyId,
              idFlowDb,
              String(nodeSelected.id),
              "flowUp",
              "flowup_added",
              result.success ? "ok" : "warning",
              {
                contactListId: result.contactListId,
                contactListName: result.contactListName,
                alreadyInList: result.alreadyInList
              }
            );
            logger.info(
              {
                flowBuilderFlowUp: true,
                ticketId: idTicket,
                contactId: result.contactId,
                contactNumber: result.contactNumber,
                contactListId: result.contactListId,
                contactListName: result.contactListName,
                contactListItemId: result.contactListItemId,
                alreadyInList: result.alreadyInList,
                inserted: !result.alreadyInList,
                success: result.success
              },
              "[FlowBuilder][flowUp] contato na lista de remarketing"
            );
          }
        } catch (err: any) {
          await createFlowExecutionLogIfTicket(
            idTicket,
            companyId,
            idFlowDb,
            String(nodeSelected.id),
            "flowUp",
            "flowup_added",
            "error",
            { err: String(err?.message || err).slice(0, 300) }
          );
          logger.warn(
            {
              flowBuilderFlowUp: true,
              ticketId: idTicket,
              success: false,
              err: String(err?.message || err).slice(0, 300)
            },
            "[FlowBuilder][flowUp] falha ao adicionar à lista"
          );
        }
        await intervalWhats("1");
      }

      if (nodeSelected.type === "singleBlock") {
        for (var iLoc = 0; iLoc < nodeSelected.data.seq.length; iLoc++) {
          const elementNowSelected = nodeSelected.data.seq[iLoc];

          ticket = await Ticket.findOne({
            where: { id: idTicket, companyId }
          });

          if (elementNowSelected.includes("message")) {
            const bodyFor = nodeSelected.data.elements.filter(
              item => item.number === elementNowSelected
            )[0].value;

            const ticketDetails = await ShowTicketService(idTicket, companyId);

            const msg = interpolateFlowMessage(
              bodyFor,
              ticket,
              ticketDetails.contact
            );

            if (isFlowBuilderDebugEnabled()) {
              logger.info(
                {
                  flowBuilderSingleBlockMsg: true,
                  ticketId: idTicket,
                  preview: String(msg).slice(0, 100)
                },
                "[FlowBuilder][debug] singleBlock: mensagem com {{variáveis}} + Mustache"
              );
            }

            await delay(3000);
            await typeSimulation(ticket, "composing");

            await SendWhatsAppMessage({
              body: msg,
              ticket: ticketDetails,
              quotedMsg: null
            });

            SetTicketMessagesAsRead(ticketDetails);

            await ticketDetails.update({
              lastMessage: msg
            });

            await intervalWhats("1");
          }
          if (elementNowSelected.includes("interval")) {
            await intervalWhats(
              nodeSelected.data.elements.filter(
                item => item.number === elementNowSelected
              )[0].value
            );
          }

          if (elementNowSelected.includes("img")) {
            const mediaPath =
              process.env.BACKEND_URL.includes("http://localhost")
                ? `${__dirname.split("src")[0].split("\\").join("/")}public/${
                    nodeSelected.data.elements.filter(
                      item => item.number === elementNowSelected
                    )[0].value
                  }`
                : `${__dirname
                    .split("dist")[0]
                    .split("\\")
                    .join("/")}public/${
                    nodeSelected.data.elements.filter(
                      item => item.number === elementNowSelected
                    )[0].value
                  }`;

            const ticketForImg = await ShowTicketService(idTicket, companyId);
            if (isFlowBuilderDebugEnabled()) {
              logger.info(
                {
                  flowBuilderSendDest: true,
                  ticketId: ticketForImg.id,
                  branch: "singleBlock_img",
                  mediaPath: mediaPath.split("/").slice(-2).join("/")
                },
                "[FlowBuilder] singleBlock img: envio via ticket"
              );
            }
            await typeSimulation(ticketForImg, "composing");

            await SendWhatsAppMediaFlow({
              media: mediaPath,
              ticket: ticketForImg,
              body: ""
            });
            await intervalWhats("1");
          }

          if (elementNowSelected.includes("audio")) {
            const mediaDirectory =
              process.env.BACKEND_URL === "http://localhost:8090"
                ? `${__dirname.split("src")[0].split("\\").join("/")}public/${
                    nodeSelected.data.elements.filter(
                      item => item.number === elementNowSelected
                    )[0].value
                  }`
                : `${__dirname.split("dist")[0].split("\\").join("/")}public/${
                    nodeSelected.data.elements.filter(
                      item => item.number === elementNowSelected
                    )[0].value
                  }`;
            const ticketInt = await Ticket.findOne({
              where: { id: ticket.id }
            });

            await typeSimulation(ticket, "recording");

            await SendWhatsAppMediaFlow({
              media: mediaDirectory,
              ticket: ticketInt,
              isRecord: nodeSelected.data.elements.filter(
                item => item.number === elementNowSelected
              )[0].record
            });
            //fs.unlinkSync(mediaDirectory.split('.')[0] + 'A.mp3');
            await intervalWhats("1");
          }
          if (elementNowSelected.includes("video")) {
            const mediaDirectory =
              process.env.BACKEND_URL === "http://localhost:8090"
                ? `${__dirname.split("src")[0].split("\\").join("/")}public/${
                    nodeSelected.data.elements.filter(
                      item => item.number === elementNowSelected
                    )[0].value
                  }`
                : `${__dirname.split("dist")[0].split("\\").join("/")}public/${
                    nodeSelected.data.elements.filter(
                      item => item.number === elementNowSelected
                    )[0].value
                  }`;
            const ticketInt = await Ticket.findOne({
              where: { id: ticket.id }
            });

            await typeSimulation(ticket, "recording");

            await SendWhatsAppMediaFlow({
              media: mediaDirectory,
              ticket: ticketInt
            });
            //fs.unlinkSync(mediaDirectory.split('.')[0] + 'A.mp3');
            await intervalWhats("1");
          }
        }
      }

      let isRandomizer: boolean;
      if (nodeSelected.type === "randomizer") {
        const selectedRandom = randomizarCaminho(
          nodeSelected.data.percent / 100
        );

        const resultConnect = connects.filter(
          connect => connect.source === nodeSelected.id
        );
        if (selectedRandom === "A") {
          next = resultConnect.filter(item => item.sourceHandle === "a")[0]
            .target;
          noAlterNext = true;
        } else {
          next = resultConnect.filter(item => item.sourceHandle === "b")[0]
            .target;
          noAlterNext = true;
        }
        isRandomizer = true;
      }

      let isCondition = false;
      if (nodeSelected.type === "condition" && idTicket) {
        const ticketForCond = await Ticket.findOne({
          where: { id: idTicket, companyId },
          include: [{ model: Contact, as: "contact" }]
        });
        if (!ticketForCond) {
          logger.warn(
            { flowConditionNode: true, idTicket },
            "[FlowBuilder][condition] ticket não encontrado"
          );
        }
        const condResult = await evaluateFlowCondition(
          ticketForCond || ticket,
          ticketForCond?.contact || ticket?.contact,
          nodeSelected.data as any,
          originalWhatsAppMsg,
          companyId
        );
        const handleChosen = condResult.passed ? "true" : "false";
        const nextTarget = pickConditionEdgeTarget(
          connects,
          nodeSelected.id,
          condResult.passed
        );
        if (isFlowBuilderDebugEnabled()) {
          logger.info(
            {
              flowConditionNode: true,
              ticketId: idTicket,
              nodeId: nodeSelected.id,
              passed: condResult.passed,
              handleChosen,
              nextNodeId: nextTarget ?? null
            },
            "[FlowBuilder][debug][condition] ramo escolhido"
          );
        }
        if (nextTarget) {
          next = nextTarget;
          noAlterNext = true;
        } else {
          logger.warn(
            {
              flowConditionNode: true,
              nodeId: nodeSelected.id,
              handleChosen
            },
            "[FlowBuilder][condition] sem aresta para o handle — fluxo interrompido"
          );
          next = "";
        }
        await createFlowExecutionLogIfTicket(
          idTicket,
          companyId,
          idFlowDb,
          String(nodeSelected.id),
          "condition",
          "condition_evaluated",
          nextTarget ? "ok" : "warning",
          {
            passed: condResult.passed,
            handleChosen,
            nextNodeId: nextTarget ?? null
          }
        );
        isCondition = true;
      }

      let isHttpRequest = false;
      if (nodeSelected.type === "httpRequest" && idTicket) {
        const ticketForHttp = await Ticket.findOne({
          where: { id: idTicket, companyId },
          include: [{ model: Contact, as: "contact" }]
        });
        if (!ticketForHttp) {
          await createFlowExecutionLogIfTicket(
            idTicket,
            companyId,
            idFlowDb,
            String(nodeSelected.id),
            "httpRequest",
            "http_request_error",
            "error",
            { reason: "ticket_not_found" }
          );
          logger.warn(
            { flowHttpRequest: true, ticketId: idTicket },
            "[FlowBuilder][httpRequest] ticket não encontrado"
          );
          next = "";
          noAlterNext = true;
          isHttpRequest = true;
        } else {
          const httpResult = await executeFlowHttpRequestAndPersist({
            nodeData: (nodeSelected.data || {}) as any,
            ticketId: idTicket,
            ticket: ticketForHttp,
            contact: ticketForHttp.contact
          });
          ticket = await Ticket.findOne({
            where: { id: idTicket, whatsappId, companyId },
            include: [{ model: Contact, as: "contact" }]
          });
          const nextTarget = pickHttpRequestEdgeTarget(
            connects,
            nodeSelected.id,
            httpResult.outcome
          );
          if (isFlowBuilderDebugEnabled()) {
            logger.info(
              {
                flowHttpRequest: true,
                ticketId: idTicket,
                method: httpResult.method,
                url: httpResult.urlForLog,
                httpStatus: httpResult.httpStatus,
                outcome: httpResult.outcome,
                extractedKeys: httpResult.extractedKeys,
                nextHandle: httpResult.nextHandle,
                nextNodeId: nextTarget ?? null
              },
              "[FlowBuilder][debug][httpRequest] ramo e próximo nó"
            );
          }
          if (nextTarget) {
            next = nextTarget;
            noAlterNext = true;
          } else {
            next = "";
          }
          await createFlowExecutionLogIfTicket(
            idTicket,
            companyId,
            idFlowDb,
            String(nodeSelected.id),
            "httpRequest",
            httpResult.outcome === "success"
              ? "http_request_success"
              : "http_request_error",
            httpResult.outcome === "success" ? "ok" : "error",
            {
              method: httpResult.method,
              url: httpResult.urlForLog,
              httpStatus: httpResult.httpStatus,
              extractedKeys: httpResult.extractedKeys,
              nextHandle: httpResult.nextHandle,
              nextNodeId: nextTarget ?? null
            }
          );
          isHttpRequest = true;
        }
        await intervalWhats("1");
      }

      let isMenu = false;

      if (nodeSelected.type === "menu") {
        if (pressKey) {
          const menuData = (nodeSelected.data || {}) as Record<string, any>;
          const optionsArr = Array.isArray(menuData.arrayOption)
            ? menuData.arrayOption
            : [];
          const validNumbers = new Set(
            optionsArr.map((o: { number: number | string }) => String(o.number))
          );

          const filterOne = connectStatic.filter(
            confil => String(confil.source) === String(next)
          );

          const pickEdgesForHandle = (suffix: string) =>
            filterOne.filter(filt2 => filt2.sourceHandle === "a" + suffix);

          let filterTwo = pickEdgesForHandle(String(pressKey));
          if (filterTwo.length === 0 && pressKey !== "") {
            const n = Number(pressKey);
            if (!Number.isNaN(n)) {
              filterTwo = pickEdgesForHandle(String(n));
            }
          }
          if (filterTwo.length === 0) {
            const m = String(pressKey).match(/\d+/);
            if (m && validNumbers.has(m[0])) {
              filterTwo = pickEdgesForHandle(m[0]);
            }
          }

          if (filterTwo.length > 0 && validNumbers.size > 0) {
            const h = String(filterTwo[0].sourceHandle || "");
            const numFromHandle = h.startsWith("a") ? h.slice(1) : h;
            if (!validNumbers.has(numFromHandle)) {
              filterTwo = [];
            }
          }

          let chosenTarget: string | undefined;
          let usedInvalidBranch = false;

          if (filterTwo.length > 0) {
            chosenTarget = filterTwo[0].target;
          } else {
            const invalidEdge = filterOne.find(
              f => String(f.sourceHandle || "") === "invalid"
            );
            if (invalidEdge) {
              chosenTarget = invalidEdge.target;
              usedInvalidBranch = true;
              const invMsg = String(menuData.invalidOptionMessage || "").trim();
              if (invMsg && ticket && idTicket) {
                const ticketDetails = await ShowTicketService(ticket.id, companyId);
                const body = interpolateFlowMessage(
                  invMsg,
                  ticket,
                  ticketDetails.contact
                );
                await SendWhatsAppMessage({
                  body,
                  ticket: ticketDetails,
                  quotedMsg: null
                });
                await intervalWhats("1");
              }
            }
          }

          execFn = chosenTarget ?? "";

          if (isFlowBuilderDebugEnabled()) {
            logger.info(
              {
                flowBuilderMenu: true,
                clientReply: pressKey,
                menuNodeId: next,
                edgesFromMenu: filterOne.map(e => ({
                  sourceHandle: e.sourceHandle,
                  target: e.target
                })),
                matchedHandle: filterTwo[0]?.sourceHandle,
                nextNodeId: execFn || null,
                usedInvalidBranch
              },
              "[FlowBuilder][debug] menu: resposta do cliente e edge escolhida"
            );
          }

          if (!execFn) {
            const hasInvalidHandle = filterOne.some(
              f => String(f.sourceHandle || "") === "invalid"
            );
            await createFlowExecutionLogIfTicket(
              idTicket,
              companyId,
              idFlowDb,
              String(next),
              "menu",
              "flow_error",
              "error",
              {
                reason: "no_edge_for_option_or_invalid",
                clientReply: pressKey,
                menuNodeId: next
              }
            );
            if (filterTwo.length === 0 && !hasInvalidHandle) {
              logger.warn(
                {
                  flowBuilderMenu: true,
                  menuNodeId: next,
                  clientReply: pressKey
                },
                "[FlowBuilder] invalid option without fallback"
              );
            } else {
              logger.warn(
                { flowBuilderMenu: true, menuNodeId: next, clientReply: pressKey },
                "[FlowBuilder] menu: sem aresta para a opção nem ramo \"invalid\""
              );
            }
            break;
          }

          pressKey = "999";

          const isNodeExist = nodes.filter(item => item.id === execFn);
          if (isNodeExist.length > 0) {
            isMenu = isNodeExist[0].type === "menu" ? true : false;
          } else {
            isMenu = false;
          }
          if (isFlowBuilderDebugEnabled()) {
            logger.info(
              {
                flowBuilderMenu: true,
                nextNodeType: isNodeExist[0]?.type,
                isNextNodeAlsoMenu: isMenu
              },
              "[FlowBuilder][debug] menu: próximo nó após opção"
            );
          }
        } else {
          let optionsMenu = "";
          const optList = Array.isArray(nodeSelected.data?.arrayOption)
            ? nodeSelected.data.arrayOption
            : [];
          optList.map((item: { number: number | string; value: string }) => {
            optionsMenu += `${item.number} - ${item.value}\n`;
          });

          const menuCreate = `${nodeSelected.data.message}\n\n${optionsMenu}`;

          const ticketDetails = await ShowTicketService(ticket.id, companyId);
          const menuBody = interpolateFlowMessage(
            menuCreate,
            ticket,
            ticketDetails.contact
          );

          if (isFlowBuilderDebugEnabled()) {
            logger.info(
              {
                flowBuilderMenuBody: true,
                ticketId: ticket.id,
                preview: menuBody.slice(0, 100)
              },
              "[FlowBuilder][debug] menu: corpo após {{variáveis}} e Mustache"
            );
          }

          const msg = {
            body: menuBody,
            number: numberClient,
            companyId: companyId
          };

          //const messageData: MessageData = {
          //  wid: randomString(50),
          //  ticketId: ticket.id,
          //  body: msg.body,
          //  fromMe: true,
          //  read: true
          //};

          //await CreateMessageService({ messageData: messageData, companyId });

          //await SendWhatsAppMessage({ body: bodyFor, ticket: ticketDetails, quotedMsg: null })

          // await SendMessage(whatsapp, {
          //   number: numberClient,
          //   body: msg.body
          // });

          await typeSimulation(ticket, "composing");

          await SendWhatsAppMessage({
            body: msg.body,
            ticket: ticketDetails,
            quotedMsg: null
          });

          SetTicketMessagesAsRead(ticketDetails);

          await ticketDetails.update({
            lastMessage: msg.body
          });
          await intervalWhats("1");

          if (ticket) {
            ticket = await Ticket.findOne({
              where: {
                id: ticket.id,
                whatsappId: whatsappId,
                companyId: companyId
              }
            });
          } else {
            ticket = await Ticket.findOne({
              where: {
                id: idTicket,
                whatsappId: whatsappId,
                companyId: companyId
              }
            });
          }

          if (ticket) {
            const prevDw = parseTicketDataWebhook(ticket.dataWebhook);
            const incoming =
              dataWebhook && typeof dataWebhook === "object" && !Array.isArray(dataWebhook)
                ? (dataWebhook as Record<string, unknown>)
                : {};
            const mergedDw = { ...prevDw, ...incoming };
            if (prevDw.remoteJid) {
              mergedDw.remoteJid = prevDw.remoteJid;
            }
            await ticket.update({
              queueId: ticket.queueId ? ticket.queueId : null,
              userId: null,
              companyId: companyId,
              flowWebhook: true,
              lastFlowId: nodeSelected.id,
              dataWebhook: mergedDw as any,
              hashFlowId: hashWebhookId,
              flowStopped: idFlowDb.toString()
            });

            const menuCfg = (nodeSelected.data || {}) as Record<string, any>;
            const timeoutRaw = Number(menuCfg.menuTimeoutSeconds);
            const timeoutSec = Math.min(
              86400,
              Math.max(
                0,
                Number.isFinite(timeoutRaw) && timeoutRaw > 0
                  ? Math.floor(timeoutRaw)
                  : 0
              )
            );
            if (timeoutSec > 0 && idTicket) {
              await scheduleFlowMenuTimeout(
                {
                  ticketId: idTicket,
                  companyId,
                  whatsappId,
                  idFlowDb,
                  menuNodeId: String(nodeSelected.id)
                },
                timeoutSec * 1000
              );
            }
          }

          break;
        }
      }

      let isContinue = false;

      if (pressKey === "999" && execCount > 0) {
        pressKey = undefined;
        let result = connects.filter(connect => connect.source === execFn)[0];
        if (typeof result === "undefined") {
          next = "";
        } else {
          if (!noAlterNext) {
            next = result.target;
          }
        }
      } else {
        let result;

        if (isMenu) {
          result = { target: execFn };
          isContinue = true;
          pressKey = undefined;
        } else if (pressKey === "999" && execFn) {
          // Próximo nó é sector, tag, closeTicket, etc. — não outro menu.
          // Antes caía no primeiro connect(source===next) e ignorava a opção escolhida.
          result = { target: execFn };
          isContinue = true;
          pressKey = undefined;
          if (isFlowBuilderDebugEnabled()) {
            logger.info(
              { flowBuilderMenu: true, nextTarget: execFn },
              "[FlowBuilder][debug] menu: avançando para nó após opção (não-menu)"
            );
          }
        } else if (isRandomizer) {
          isRandomizer = false;
          result = next;
        } else if (isCondition) {
          isCondition = false;
          result = next;
        } else if (isHttpRequest) {
          isHttpRequest = false;
          result = next;
        } else {
          result = connects.filter(connect => connect.source === next)[0];
        }

        if (typeof result === "undefined") {
          next = "";
        } else {
          if (!noAlterNext) {
            next = result.target;
          }
        }
      }

      if (!pressKey && !isContinue) {
        const nextNode = connects.filter(
          connect => connect.source === nodeSelected.id
        ).length;

        if (nextNode === 0) {
          await Ticket.findOne({
            where: { id: idTicket, whatsappId, companyId: companyId }
          });
          await createFlowExecutionLogIfTicket(
            idTicket,
            companyId,
            idFlowDb,
            String(nodeSelected.id),
            String(nodeSelected.type),
            "flow_stopped",
            "ok",
            { reason: "no_outgoing_edge", lastFlowId: nodeSelected.id }
          );
          await ticket.update({
            lastFlowId: nodeSelected.id,
            hashFlowId: null,
            flowWebhook: false,
            flowStopped: idFlowDb.toString()
          });
          break;
        }
      }

      isContinue = false;

      if (next === "") {
        break;
      }

      ticket = await Ticket.findOne({
        where: { id: idTicket, whatsappId, companyId: companyId }
      });

      if (ticket.status === "closed") {
        io.to(`company-${ticket.companyId}-mainchannel`).emit(
          `company-${ticket.companyId}-ticket`,
          {
            action: "delete",
            ticketId: ticket.id
          }
        );
      }

      const lastFlowIdToSave = nodeSelected?.id ?? next;
      if (isFlowBuilderDebugEnabled()) {
        logger.info(
          {
            flowBuilder: true,
            lastFlowIdToSave,
            nextAfterStep: next,
            nodeType: nodeSelected?.type
          },
          "[FlowBuilder] persistindo lastFlowId no ticket"
        );
      }
      await ticket.update({
        whatsappId: whatsappId,
        queueId: ticket?.queueId,
        ...(!flowAssignedHumanUser ? { userId: null } : {}),
        companyId: companyId,
        flowWebhook: true,
        lastFlowId: lastFlowIdToSave,
        hashFlowId: hashWebhookId,
        flowStopped: idFlowDb.toString()
      });

      noAlterNext = false;
      execCount++;
    }

    return "ds";
  } catch (error) {
    logger.error(error);
    const errMsg =
      error instanceof Error ? error.message : String(error).slice(0, 500);
    await createFlowExecutionLogIfTicket(
      idTicket,
      companyId,
      idFlowDb,
      "-",
      "-",
      "flow_error",
      "error",
      { message: errMsg }
    );
  }
};

const constructJsonLine = (line: string, json: any) => {
  let valor = json;
  const chaves = line.split(".");

  if (chaves.length === 1) {
    return valor[chaves[0]];
  }

  for (const chave of chaves) {
    valor = valor[chave];
  }
  return valor;
};

function removerNaoLetrasNumeros(texto: string) {
  // Substitui todos os caracteres que não são letras ou números por vazio
  return texto.replace(/[^a-zA-Z0-9]/g, "");
}

const sendMessageWhats = async (
  whatsId: number,
  msg: any,
  req: Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>
) => {
  sendMessageFlow(whatsId, msg, req);
  return Promise.resolve();
};

const intervalWhats = (time: string) => {
  const seconds = parseInt(time) * 1000;
  return new Promise(resolve => setTimeout(resolve, seconds));
};

/** Variáveis do fluxo salvas em ticket.dataWebhook.variables (chave → valor da resposta). */
const getFlowVariablesFromTicket = (
  ticket: Ticket | null
): Record<string, unknown> => {
  if (!ticket?.dataWebhook) return {};
  const dw = parseTicketDataWebhook(ticket.dataWebhook);
  const v = dw.variables;
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
};

/**
 * 1) Substitui placeholders do FlowBuilder: {{chave}} usando dataWebhook.variables
 * 2) Depois aplica Mustache do contato: {{name}}, {{firstName}}, {{protocol}}, etc.
 */
export function interpolateFlowMessage(
  raw: string,
  ticket: Ticket | null,
  contact: Contact | undefined | null
): string {
  const vars = getFlowVariablesFromTicket(ticket);
  const afterFlow = replaceMessages(vars, raw);
  return formatBody(afterFlow, contact as Contact);
}

const replaceMessages = (
  variables: Record<string, unknown>,
  message: string
): string => {
  if (!message || typeof message !== "string") return "";
  return message.replace(
    /{{\s*([^{}\s]+)\s*}}/g,
    (_match, key: string) => {
      const v = variables[key];
      if (v === undefined || v === null) return "";
      return String(v);
    }
  );
};

const replaceMessagesOld = (
  message: string,
  details: any,
  dataWebhook: any,
  dataNoWebhook?: any
) => {
  const matches = message.match(/\{([^}]+)\}/g);

  if (dataWebhook) {
    let newTxt = message.replace(/{+nome}+/, dataNoWebhook.nome);
    newTxt = newTxt.replace(/{+numero}+/, dataNoWebhook.numero);
    newTxt = newTxt.replace(/{+email}+/, dataNoWebhook.email);
    return newTxt;
  }

  if (matches && matches.includes("inputs")) {
    const placeholders = matches.map(match => match.replace(/\{|\}/g, ""));
    let newText = message;
    placeholders.map(item => {
      const value = details["inputs"].find(
        itemLocal => itemLocal.keyValue === item
      );
      const lineToData = details["keysFull"].find(itemLocal =>
        itemLocal.endsWith(`.${value.data}`)
      );
      const createFieldJson = constructJsonLine(lineToData, dataWebhook);
      newText = newText.replace(`{${item}}`, createFieldJson);
    });
    return newText;
  } else {
    return message;
  }
};
