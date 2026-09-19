import fs from "fs";
import path from "path";

describe("SendWhatsAppMessage provider-neutral telemetry 12.3-E-FIX5", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../SendWhatsAppMessage.ts"),
    "utf8"
  );

  it("transporte continua via getWhatsAppOutboundForTicket + sendText", () => {
    expect(src).toMatch(/getWhatsAppOutboundForTicket/);
    expect(src).toMatch(/outbound\.sendText/);
    expect(src).not.toMatch(/GetTicketWbot/);
    expect(src).not.toMatch(/GetWhatsappWbot/);
    expect(src).not.toMatch(/wbot\.sendMessage/);
  });

  it("telemetria SendPerf é provider-neutral", () => {
    expect(src).toContain("[SendPerf] outbound_send_start");
    expect(src).toContain("[SendPerf] outbound_send_done");
    expect(src).toMatch(/providerMessageId: sent\.messageId/);
    expect(src).not.toContain("baileys_send_start");
    expect(src).not.toContain("baileys_send_done");
    expect(src).not.toContain("baileysMessageId");
  });
});
