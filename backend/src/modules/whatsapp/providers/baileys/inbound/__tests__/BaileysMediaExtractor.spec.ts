import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { downloadBaileysMedia } from "../BaileysMediaExtractor";

jest.mock("@whiskeysockets/baileys", () => ({
  downloadMediaMessage: jest.fn()
}));

const downloadMock = downloadMediaMessage as jest.MockedFunction<
  typeof downloadMediaMessage
>;

describe("BaileysMediaExtractor", () => {
  beforeEach(() => {
    downloadMock.mockReset();
  });

  it("isola downloadMediaMessage e devolve buffer/mimetype/filename", async () => {
    downloadMock.mockResolvedValue(Buffer.from("img-bytes") as never);
    const msg = {
      key: { id: "MID" },
      message: {
        imageMessage: { mimetype: "image/jpeg" }
      }
    };

    const extracted = await downloadBaileysMedia(msg as never);
    expect(downloadMock).toHaveBeenCalledTimes(1);
    expect(extracted).not.toBeNull();
    expect(extracted!.data.equals(Buffer.from("img-bytes"))).toBe(true);
    expect(extracted!.mimetype).toBe("image/jpeg");
    expect(extracted!.filename).toMatch(/\.(jpe?g|bin)$/i);
  });

  it("retorna null quando download falha", async () => {
    downloadMock.mockRejectedValue(new Error("net"));
    const extracted = await downloadBaileysMedia({
      key: { id: "X" },
      message: { imageMessage: { mimetype: "image/png" } }
    } as never);
    expect(extracted).toBeNull();
  });
});
