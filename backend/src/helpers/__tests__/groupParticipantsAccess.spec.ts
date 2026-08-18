import AppError from "../../errors/AppError";
import {
  assertCanManageGroupParticipants,
  assertGroupParticipantsVisibility,
  isGroupVisibilityPrivileged
} from "../groupVisibility";
import {
  buildExistingPhonesLookupWhere,
  resolveGroupJidFromBody,
  wrapGroupAccessError
} from "../groupParticipantsRequest";
import { Boom } from "@hapi/boom";

describe("group participants access", () => {
  const companyId = 19;

  it("admin e supervisor podem gerir participantes", () => {
    expect(() =>
      assertCanManageGroupParticipants({
        id: 1,
        profile: "admin",
        companyId
      })
    ).not.toThrow();
    expect(() =>
      assertCanManageGroupParticipants({
        id: 2,
        profile: "supervisor",
        companyId
      })
    ).not.toThrow();
    expect(
      isGroupVisibilityPrivileged({ id: 1, profile: "admin", companyId })
    ).toBe(true);
    expect(
      isGroupVisibilityPrivileged({ id: 2, profile: "supervisor", companyId })
    ).toBe(true);
  });

  it("usuário comum recebe 403 nas rotas de participantes", () => {
    try {
      assertCanManageGroupParticipants({
        id: 8,
        profile: "user",
        companyId
      });
      throw new Error("expected deny");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).message).toBe("ERR_NO_PERMISSION");
      expect((err as AppError).statusCode).toBe(403);
    }
  });

  it("grupo sem Contact falha para perfil não privilegiado", async () => {
    await expect(
      assertGroupParticipantsVisibility(
        { id: 8, profile: "user", companyId },
        null
      )
    ).rejects.toMatchObject({
      message: "ERR_GROUP_NOT_VISIBLE",
      statusCode: 403
    });
  });

  it("admin/supervisor acessam sem Contact do grupo", async () => {
    await expect(
      assertGroupParticipantsVisibility(
        { id: 1, profile: "admin", companyId },
        null
      )
    ).resolves.toBeUndefined();
    await expect(
      assertGroupParticipantsVisibility(
        { id: 2, profile: "supervisor", companyId },
        null
      )
    ).resolves.toBeUndefined();
  });

  it("lookup de contatos existentes isola companyId", () => {
    const where19 = buildExistingPhonesLookupWhere(19, ["5511999887766"]);
    const where20 = buildExistingPhonesLookupWhere(20, ["5511999887766"]);
    expect(where19.companyId).toBe(19);
    expect(where20.companyId).toBe(20);
    expect(where19.isGroup).toBe(false);
    expect(where19.companyId).not.toBe(where20.companyId);
  });

  it("JID do grupo sai só do body, nunca da query", () => {
    expect(
      resolveGroupJidFromBody({ groupJid: "120363@g.us" })
    ).toBe("120363@g.us");
    expect(resolveGroupJidFromBody({})).toBe("");
    expect(resolveGroupJidFromBody(null)).toBe("");
  });

  it("erros de acesso usam código estável", () => {
    expect.assertions(4);
    try {
      wrapGroupAccessError(new Boom("forbidden", { statusCode: 403 }));
    } catch (err) {
      expect((err as AppError).message).toBe("ERR_GROUP_ACCESS_DENIED");
      expect((err as AppError).statusCode).toBe(400);
    }
    try {
      wrapGroupAccessError(new Error("ERR_GROUP_ID_REQUIRED"));
    } catch (err) {
      expect((err as AppError).message).toBe("ERR_GROUP_ID_REQUIRED");
    }
    try {
      wrapGroupAccessError(new Error("ERR_GROUP_INVALID_GROUP_ID"));
    } catch (err) {
      expect((err as AppError).message).toBe("ERR_GROUP_INVALID_GROUP_ID");
    }
  });
});
