/* eslint-disable import/first */
const initWASocket = jest.fn();
const wbotMessageListener = jest.fn();
const wbotMonitor = jest.fn();
const getIO = jest.fn(() => ({
  to: () => ({ emit: jest.fn() })
}));
const startEvolution = jest.fn().mockResolvedValue(undefined);

jest.mock("../../../libs/wbot", () => ({
  initWASocket: (...args: unknown[]) => initWASocket(...args)
}));
jest.mock("../wbotMessageListener", () => ({
  wbotMessageListener: (...args: unknown[]) => wbotMessageListener(...args)
}));
jest.mock("../wbotMonitor", () => ({
  __esModule: true,
  default: (...args: unknown[]) => wbotMonitor(...args)
}));
jest.mock("../../../libs/socket", () => ({
  getIO: () => getIO()
}));
jest.mock("@sentry/node", () => ({
  captureException: jest.fn()
}));
jest.mock("../../../modules/whatsapp/providers/evolution", () => ({
  startEvolutionWhatsAppSessionEntry: (...a: unknown[]) => startEvolution(...a)
}));

import { StartWhatsAppSession } from "../StartWhatsAppSession";
import { StartAllWhatsAppsSessions } from "../StartAllWhatsAppsSessions";

jest.mock("../../WhatsappService/ListWhatsAppsService", () => ({
  __esModule: true,
  default: jest.fn()
}));

import ListWhatsAppsService from "../../WhatsappService/ListWhatsAppsService";

const mockedList = ListWhatsAppsService as jest.Mock;

describe("StartWhatsAppSession multi-provider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    initWASocket.mockResolvedValue({ id: 1 });
    startEvolution.mockResolvedValue(undefined);
  });

  it("Baileys continua chamando initWASocket", async () => {
    const whatsapp = {
      id: 10,
      companyId: 1,
      name: "Baileys Conn",
      connectionProvider: "baileys",
      status: "DISCONNECTED",
      update: jest.fn().mockResolvedValue(undefined)
    };

    await StartWhatsAppSession(whatsapp as never, 1);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(initWASocket).toHaveBeenCalledWith(whatsapp);
    expect(wbotMessageListener).toHaveBeenCalled();
    expect(wbotMonitor).toHaveBeenCalled();
    expect(startEvolution).not.toHaveBeenCalled();
  });

  it("Evolution NÃO chama initWASocket — usa lifecycle", async () => {
    const whatsapp = {
      id: 20,
      companyId: 1,
      name: "Evo Conn",
      connectionProvider: "evolution",
      status: "DISCONNECTED",
      update: jest.fn().mockResolvedValue(undefined)
    };

    await StartWhatsAppSession(whatsapp as never, 1);

    expect(initWASocket).not.toHaveBeenCalled();
    expect(wbotMessageListener).not.toHaveBeenCalled();
    expect(wbotMonitor).not.toHaveBeenCalled();
    expect(startEvolution).toHaveBeenCalledWith(whatsapp, 1);
  });

  it("boot misto: falha Evolution não bloqueia Baileys", async () => {
    const baileys = {
      id: 1,
      companyId: 5,
      name: "B",
      connectionProvider: "baileys",
      status: "DISCONNECTED",
      update: jest.fn().mockResolvedValue(undefined)
    };
    const evolution = {
      id: 2,
      companyId: 5,
      name: "E",
      connectionProvider: "evolution",
      status: "DISCONNECTED",
      update: jest.fn().mockResolvedValue(undefined)
    };
    mockedList.mockResolvedValue([baileys, evolution]);
    startEvolution.mockRejectedValueOnce(new Error("evo down"));

    await StartAllWhatsAppsSessions(5);
    await new Promise<void>(resolve => {
      setImmediate(() => resolve());
    });
    await new Promise<void>(resolve => {
      setTimeout(() => resolve(), 30);
    });

    expect(initWASocket).toHaveBeenCalledTimes(1);
    expect(initWASocket).toHaveBeenCalledWith(baileys);
    expect(startEvolution).toHaveBeenCalled();
  });

  it("falha Evolution A não bloqueia Evolution B", async () => {
    const e1 = {
      id: 11,
      companyId: 5,
      name: "E1",
      connectionProvider: "evolution",
      status: "DISCONNECTED",
      update: jest.fn()
    };
    const e2 = {
      id: 12,
      companyId: 5,
      name: "E2",
      connectionProvider: "evolution",
      status: "DISCONNECTED",
      update: jest.fn()
    };
    mockedList.mockResolvedValue([e1, e2]);
    startEvolution
      .mockRejectedValueOnce(new Error("A fail"))
      .mockResolvedValueOnce(undefined);

    await StartAllWhatsAppsSessions(5);
    await new Promise<void>(resolve => {
      setTimeout(() => resolve(), 40);
    });

    expect(startEvolution).toHaveBeenCalledTimes(2);
  });
});
