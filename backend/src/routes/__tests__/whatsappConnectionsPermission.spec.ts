import * as fs from "fs";
import * as path from "path";

/**
 * Wiring: endpoints de gerenciamento de conexão WhatsApp exigem
 * settings.connections; listagem GET /whatsapp/ permanece só com isAuth
 * (uso em atendimento/transferência). Isolamento multiempresa continua
 * nos services (ShowWhatsAppService filtra por companyId).
 */
describe("whatsapp routes — settings.connections", () => {
  const whatsappRoutes = fs.readFileSync(
    path.join(__dirname, "../../routes/whatsappRoutes.ts"),
    "utf8"
  );
  const sessionRoutes = fs.readFileSync(
    path.join(__dirname, "../../routes/whatsappSessionRoutes.ts"),
    "utf8"
  );

  it("importa requireEffectiveModule(settings.connections)", () => {
    expect(whatsappRoutes).toMatch(/requireEffectiveModule/);
    expect(whatsappRoutes).toMatch(/settings\.connections/);
    expect(sessionRoutes).toMatch(/requireEffectiveModule/);
    expect(sessionRoutes).toMatch(/settings\.connections/);
  });

  it("GET /whatsapp/ (listagem) NÃO exige settings.connections", () => {
    expect(whatsappRoutes).toMatch(
      /whatsappRoutes\.get\(\s*"\/whatsapp\/",\s*isAuth,\s*WhatsAppController\.index/
    );
    const listBlock = whatsappRoutes.match(
      /whatsappRoutes\.get\(\s*"\/whatsapp\/"[\s\S]*?WhatsAppController\.index/
    )?.[0];
    expect(listBlock).toBeTruthy();
    expect(listBlock!).not.toMatch(
      /requireConnectionsManage|settings\.connections/
    );
  });

  it("protege criar/editar/excluir/token/show", () => {
    expect(whatsappRoutes).toMatch(
      /post\(\s*"\/whatsapp\/"[\s\S]*?requireConnectionsManage[\s\S]*?store/
    );
    expect(whatsappRoutes).toMatch(
      /get\(\s*"\/whatsapp\/:whatsappId"[\s\S]*?requireConnectionsManage[\s\S]*?show/
    );
    expect(whatsappRoutes).toMatch(
      /put\(\s*"\/whatsapp\/:whatsappId"[\s\S]*?requireConnectionsManage[\s\S]*?update/
    );
    expect(whatsappRoutes).toMatch(
      /put\(\s*"\/whatsapp\/:whatsappId\/token"[\s\S]*?requireConnectionsManage/
    );
    expect(whatsappRoutes).toMatch(
      /delete\(\s*"\/whatsapp\/:whatsappId"[\s\S]*?requireConnectionsManage/
    );
  });

  it("protege sessões (start / new QR / disconnect)", () => {
    expect(sessionRoutes).toMatch(
      /post\(\s*"\/whatsappsession\/:whatsappId"[\s\S]*?requireConnectionsManage/
    );
    expect(sessionRoutes).toMatch(
      /put\(\s*"\/whatsappsession\/:whatsappId"[\s\S]*?requireConnectionsManage/
    );
    expect(sessionRoutes).toMatch(
      /delete\(\s*"\/whatsappsession\/:whatsappId"[\s\S]*?requireConnectionsManage/
    );
  });
});
