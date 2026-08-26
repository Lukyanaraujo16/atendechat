import { resolveQuotedMessageByStanzaId } from "../resolveQuotedMessageByStanzaId";

const findOne = jest.fn();

jest.mock("../../../../models/Message", () => ({
  __esModule: true,
  default: {
    findOne: (...args: unknown[]) => findOne(...args)
  }
}));

describe("resolveQuotedMessageByStanzaId", () => {
  beforeEach(() => {
    findOne.mockReset();
  });

  it("retorna null para stanza vazio", async () => {
    expect(await resolveQuotedMessageByStanzaId(null)).toBeNull();
    expect(await resolveQuotedMessageByStanzaId("")).toBeNull();
    expect(await resolveQuotedMessageByStanzaId("   ")).toBeNull();
    expect(findOne).not.toHaveBeenCalled();
  });

  it("busca Message pelo id do stanza", async () => {
    const row = { id: "STZ1", body: "citada" };
    findOne.mockResolvedValue(row);
    const found = await resolveQuotedMessageByStanzaId("STZ1");
    expect(findOne).toHaveBeenCalledWith({ where: { id: "STZ1" } });
    expect(found).toBe(row);
  });
});
