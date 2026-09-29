/* eslint-disable import/first */
/**
 * 12.5-B — Campaign Dispatch reidrata connectionProvider e resolve outbound
 * sem GetWhatsappWbot no cenário Evolution.
 */
jest.mock("../../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../../helpers/GetWhatsappWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("@whiskeysockets/baileys", () => ({
  proto: {},
  jidNormalizedUser: (jid: string) => jid
}));

import GetTicketWbot from "../../../helpers/GetTicketWbot";
import GetWhatsappWbot from "../../../helpers/GetWhatsappWbot";
import { getWhatsAppOutboundForWhatsapp } from "../../../modules/whatsapp/outbound/resolveWhatsAppOutbound";
import { resolveWhatsAppConnectionProvider } from "../../../modules/whatsapp/connectionProvider";
import { CAMPAIGN_DISPATCH_WHATSAPP_ATTRIBUTES } from "../campaignDispatchWhatsappAttributes";

const mockedWhatsappWbot = GetWhatsappWbot as jest.Mock;
const mockedTicketWbot = GetTicketWbot as jest.Mock;

/** Shape que getCampaign devolvia antes da 12.5-B (bug). */
function legacyCampaignWhatsappPartial() {
  return { id: 42, name: "Campanha Conn" };
}

/** Shape que getCampaign devolve com CAMPAIGN_DISPATCH_WHATSAPP_ATTRIBUTES. */
function campaignWhatsappAsLoaded(provider: "evolution" | "baileys") {
  return {
    id: 42,
    name: "Campanha Conn",
    connectionProvider: provider,
    status: "CONNECTED",
    companyId: 7
  };
}

describe("12.5-B campaign dispatch Whatsapp rehydration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("atributos do include cobrem connectionProvider/status/companyId", () => {
    expect([...CAMPAIGN_DISPATCH_WHATSAPP_ATTRIBUTES]).toEqual([
      "id",
      "name",
      "connectionProvider",
      "status",
      "companyId"
    ]);
  });

  it("shape legado {id,name} cai no default Baileys (bug pré-12.5-B)", () => {
    expect(
      resolveWhatsAppConnectionProvider(
        legacyCampaignWhatsappPartial() as { connectionProvider?: string | null }
      )
    ).toBe("baileys");
  });

  it("Campaign Evolution → EvolutionOutbound sem GetWhatsappWbot/GetTicketWbot", async () => {
    const campaignWhatsapp = campaignWhatsappAsLoaded("evolution");
    expect(resolveWhatsAppConnectionProvider(campaignWhatsapp)).toBe(
      "evolution"
    );

    const outbound = await getWhatsAppOutboundForWhatsapp(
      campaignWhatsapp as never
    );

    expect(outbound.provider).toBe("evolution");
    expect(mockedWhatsappWbot).not.toHaveBeenCalled();
    expect(mockedTicketWbot).not.toHaveBeenCalled();
  });

  it("Campaign Baileys → BaileysOutbound via GetWhatsappWbot", async () => {
    mockedWhatsappWbot.mockResolvedValue({
      id: 42,
      user: { id: "5511999:1@s.whatsapp.net" },
      sendMessage: jest.fn()
    });

    const outbound = await getWhatsAppOutboundForWhatsapp(
      campaignWhatsappAsLoaded("baileys") as never
    );

    expect(outbound.provider).toBe("baileys");
    expect(mockedWhatsappWbot).toHaveBeenCalled();
    expect(mockedTicketWbot).not.toHaveBeenCalled();
  });
});
