/* eslint-disable import/first */
const mockGetWbot = jest.fn();
jest.mock("../../libs/wbot", () => ({
  getWbot: (...args: unknown[]) => mockGetWbot(...args)
}));

import {
  contactNeedsGroupNameResolution,
  createFetchRemoteSubjectFromProvider,
  ensureGroupContactDisplayName
} from "../groupContactName";

describe("groupContactName", () => {
  beforeEach(() => {
    mockGetWbot.mockReset();
  });

  it("Baileys resolve subject remoto via callback de provider", async () => {
    const contact = {
      isGroup: true,
      name: "120363111",
      number: "120363111",
      update: jest.fn().mockResolvedValue(undefined)
    };
    const getGroupMetadata = jest.fn().mockResolvedValue({
      subject: "Time Comercial"
    });

    const name = await ensureGroupContactDisplayName(contact as never, {
      fetchRemoteSubject: createFetchRemoteSubjectFromProvider({
        getGroupMetadata
      } as never)
    });

    expect(getGroupMetadata).toHaveBeenCalledWith("120363111@g.us");
    expect(contact.update).toHaveBeenCalledWith({ name: "Time Comercial" });
    expect(name).toBe("Time Comercial");
    expect(mockGetWbot).not.toHaveBeenCalled();
  });

  it("Evolution sem GroupsProvider não chama getWbot e usa fallback estável", async () => {
    const contact = {
      isGroup: true,
      name: "120363111",
      number: "120363111",
      update: jest.fn()
    };

    const name = await ensureGroupContactDisplayName(contact as never);

    expect(name).toBe("120363111");
    expect(contact.update).not.toHaveBeenCalled();
    expect(mockGetWbot).not.toHaveBeenCalled();
    expect(contactNeedsGroupNameResolution(contact as never)).toBe(true);
  });

  it("nenhum pushName de participante vira nome do grupo", async () => {
    const contact = {
      isGroup: true,
      name: "120363111",
      number: "120363111",
      update: jest.fn()
    };
    const name = await ensureGroupContactDisplayName(contact as never, {
      fetchRemoteSubject: async () => null
    });
    expect(name).toBe("120363111");
    expect(name).not.toBe("João");
    expect(mockGetWbot).not.toHaveBeenCalled();
  });
});
