import AppError from "../../errors/AppError";
import { WebhookModel } from "../../models/Webhook";
import { sendMessageFlow } from "../../controllers/MessageController";
import { IConnections, INodes } from "./DispatchWebHookService";
import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { ParsedQs } from "qs";
import CreateContactService from "../ContactServices/CreateContactService";
import Contact from "../../models/Contact";
//import CreateTicketService from "../TicketServices/CreateTicketService";
//import CreateTicketServiceWebhook from "../TicketServices/CreateTicketServiceWebhook";
import { SendMessage } from "../../helpers/SendMessage";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import Ticket from "../../models/Ticket";
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
    const io = getIO();
    const originalWhatsAppMsg = msg;
    let next = nextStage;
    console.log(
      "ActionWebhookService | 53",
      idFlowDb,
      companyId,
      nodes,
      connects,
      nextStage,
      dataWebhook,
      details,
      hashWebhookId,
      pressKey,
      idTicket,
      numberPhrase
    );
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

    if (idTicket && ticket) {
      logger.info(
        {
          flowBuilderTicketEmit: true,
          idTicket,
          contactId: ticket.contactId,
          contactNumber: ticket.contact?.number,
          queueId: ticket.queueId,
          whatsappId: ticket.whatsappId
        },
        "[FlowBuilder][DEBUG] ActionsWebhookService: ticket no início do fluxo"
      );
    }

    let noAlterNext = false;

    for (var i = 0; i < lengthLoop; i++) {
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
        "[FlowBuilder][DEBUG] ActionsWebhookService: iteração do fluxo"
      );
      let nodeSelected: any;
      let ticketInit: Ticket;

      if (pressKey) {
        console.log("UPDATE2...");
        if (pressKey === "parar") {
          console.log("UPDATE3...");
          if (idTicket) {
            console.log("UPDATE4...");
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
          console.log("UPDATE5...");
          nodeSelected = {
            type: "menu"
          };
        } else {
          console.log("UPDATE6...");
          nodeSelected = nodes.filter(node => node.id === execFn)[0];
        }
      } else {
        console.log("UPDATE7...");
        const otherNode = nodes.filter(node => node.id === next)[0];
        if (otherNode) {
          nodeSelected = otherNode;
        }
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
          logger.info(
            {
              flowBuilderSendDest: true,
              ticketId: ticketDetails.id,
              contactId: ticketDetails.contactId,
              contactNumber: ticketDetails.contact?.number,
              destJid
            },
            "[FlowBuilder][DEBUG] message node: destino do envio (ticket)"
          );
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
            logger.info(
              {
                flowBuilderSendDest: true,
                ticketId: ticketDetails.id,
                branch: "message_node_recovered_ticket",
                contactNumber: ticketDetails.contact?.number,
                numberClientFallback: numberClient,
                destJid
              },
              "[FlowBuilder][DEBUG] message node: ticket sem contact na 1ª carga — usando ShowTicketService"
            );
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
      console.log("273");
      if (nodeSelected.type === "typebot") {
        console.log("275");
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
          voice,
          voiceKey,
          voiceRegion,
          maxTokens: parseInt(maxTokens),
          temperature: parseInt(temperature),
          apiKey,
          queueId: parseInt(queueId),
          maxMessages: parseInt(maxMessages)
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

        logger.info(
          {
            flowBuilderQuestionSend: true,
            ticketId: ticket.id,
            preview: bodyFila.slice(0, 120),
            varsKeys: Object.keys(getFlowVariablesFromTicket(ticket))
          },
          "[FlowBuilder] enviando pergunta (interpolação {{chave}} + Mustache contato)"
        );

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
            logger.info(
              {
                flowBuilderSector: true,
                ticketId: idTicket,
                queueId: ticket.queueId,
                queueName: ticket.queue?.name
              },
              "[FlowBuilder][DEBUG] sector node: ticket após transferência de fila"
            );
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
        ticket = await Ticket.findOne({
          where: { id: idTicket, companyId }
        });
        io.of(String(companyId)).emit(`company-${companyId}-ticket`, {
          action: "delete",
          ticketId: idTicket
        });
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

            logger.info(
              {
                flowBuilderSingleBlockMsg: true,
                ticketId: idTicket,
                preview: String(msg).slice(0, 100)
              },
              "[FlowBuilder] singleBlock: mensagem com {{variáveis}} + Mustache"
            );

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
            logger.info(
              {
                flowBuilderSendDest: true,
                ticketId: ticketForImg.id,
                branch: "singleBlock_img",
                mediaPath: mediaPath.split("/").slice(-2).join("/")
              },
              "[FlowBuilder][DEBUG] singleBlock img: envio via ticket (getTicketRemoteJid)"
            );
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

      let isMenu: boolean;

      if (nodeSelected.type === "menu") {
        if (pressKey) {
          const filterOne = connectStatic.filter(
            confil => confil.source === next
          );
          let filterTwo = filterOne.filter(
            filt2 => filt2.sourceHandle === "a" + pressKey
          );
          if (filterTwo.length === 0 && pressKey !== "") {
            const n = Number(pressKey);
            if (!Number.isNaN(n)) {
              filterTwo = filterOne.filter(
                filt2 => filt2.sourceHandle === "a" + String(n)
              );
            }
          }
          if (filterTwo.length > 0) {
            execFn = filterTwo[0].target;
          } else {
            execFn = undefined;
          }
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
              nextNodeId: execFn
            },
            "[FlowBuilder] menu: resposta do cliente e edge escolhida"
          );
          if (execFn === undefined) {
            logger.warn(
              { flowBuilderMenu: true, menuNodeId: next, clientReply: pressKey },
              "[FlowBuilder] menu: nenhuma edge com sourceHandle a{opção}"
            );
            break;
          }
          pressKey = "999";

          const isNodeExist = nodes.filter(item => item.id === execFn);
          if (isNodeExist.length > 0) {
            isMenu = isNodeExist[0].type === "menu" ? true : false;
          } else {
            isMenu = false;
          }
          logger.info(
            {
              flowBuilderMenu: true,
              nextNodeType: isNodeExist[0]?.type,
              isNextNodeAlsoMenu: isMenu
            },
            "[FlowBuilder] menu: próximo nó após opção"
          );
        } else {
          let optionsMenu = "";
          nodeSelected.data.arrayOption.map(item => {
            optionsMenu += `[${item.number}] ${item.value}\n`;
          });

          const menuCreate = `${nodeSelected.data.message}\n\n${optionsMenu}`;

          const ticketDetails = await ShowTicketService(ticket.id, companyId);
          const menuBody = interpolateFlowMessage(
            menuCreate,
            ticket,
            ticketDetails.contact
          );

          logger.info(
            {
              flowBuilderMenuBody: true,
              ticketId: ticket.id,
              preview: menuBody.slice(0, 100)
            },
            "[FlowBuilder] menu: corpo após {{variáveis}} e Mustache"
          );

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
          logger.info(
            { flowBuilderMenu: true, nextTarget: execFn },
            "[FlowBuilder] menu: avançando para nó após opção (não-menu)"
          );
        } else if (isRandomizer) {
          isRandomizer = false;
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

        console.log(626, "ActionsWebhookService");

        if (nextNode === 0) {
          await Ticket.findOne({
            where: { id: idTicket, whatsappId, companyId: companyId }
          });
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

      console.log("UPDATE10...");
      ticket = await Ticket.findOne({
        where: { id: idTicket, whatsappId, companyId: companyId }
      });

      if (ticket.status === "closed") {
        io.of(String(companyId))
          // .to(oldStatus)
          // .to(ticketId.toString())
          .emit(`company-${ticket.companyId}-ticket`, {
            action: "delete",
            ticketId: ticket.id
          });
      }

      const lastFlowIdToSave = nodeSelected?.id ?? next;
      logger.info(
        {
          flowBuilder: true,
          lastFlowIdToSave,
          nextAfterStep: next,
          nodeType: nodeSelected?.type
        },
        "[FlowBuilder] persistindo lastFlowId no ticket"
      );
      await ticket.update({
        whatsappId: whatsappId,
        queueId: ticket?.queueId,
        userId: null,
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
const interpolateFlowMessage = (
  raw: string,
  ticket: Ticket | null,
  contact: Contact | undefined | null
): string => {
  const vars = getFlowVariablesFromTicket(ticket);
  const afterFlow = replaceMessages(vars, raw);
  return formatBody(afterFlow, contact as Contact);
};

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
