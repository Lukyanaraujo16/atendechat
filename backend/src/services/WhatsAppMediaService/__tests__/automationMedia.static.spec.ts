import fs from "fs";
import path from "path";

function read(rel: string): string {
  return fs.readFileSync(path.join(__dirname, rel), "utf8");
}

describe("12.3-F automation media static coupling", () => {
  it("helpers de mídia Typebot/download/PTT não acoplam Baileys", () => {
    const files = [
      "../downloadPublicHttpMedia.ts",
      "../prepareWhatsAppPttAudio.ts",
      "../AutomationMediaError.ts",
      "../../../helpers/httpUrlSafety.ts",
      "../../TypebotServices/sendTypebotRemoteMedia.ts"
    ];
    files.forEach(rel => {
      const src = read(rel);
      expect(src).not.toMatch(/from ["']@whiskeysockets\/baileys["']/);
      expect(src).not.toMatch(/\bWASocket\b/);
      expect(src).not.toMatch(/\bproto\./);
      expect(src).not.toMatch(/\bgetWbot\s*\(/);
      expect(src).not.toMatch(/GetTicketWbot/);
      expect(src).not.toMatch(/GetWhatsappWbot/);
      expect(src).not.toMatch(/wrapBaileysSession/);
    });
  });

  it("sendTypebotRemoteMedia não monta payload URL no sendContent", () => {
    const src = read("../../TypebotServices/sendTypebotRemoteMedia.ts");
    expect(src).not.toMatch(/image:\s*\{\s*url/);
    expect(src).not.toMatch(/audio:\s*\{\s*url/);
    expect(src).toMatch(/image: downloaded\.buffer/);
    expect(src).toMatch(/audio,/);
  });
});
