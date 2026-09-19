import { AutomationMediaError } from "../AutomationMediaError";
import { downloadPublicHttpMedia } from "../downloadPublicHttpMedia";
import { EVOLUTION_MEDIA_LIMITS } from "../../../modules/whatsapp/providers/evolution/inbound/evolutionMediaLimits";

describe("downloadPublicHttpMedia 12.3-F", () => {
  const publicUrl = "https://cdn.typebot.io/img.jpg";

  it("URL válida retorna Buffer e content-type", async () => {
    const result = await downloadPublicHttpMedia({
      url: publicUrl,
      kind: "image",
      deps: {
        assertUrl: async () => ({ ok: true, url: new URL(publicUrl) }),
        axiosGet: async () =>
          ({
            status: 200,
            data: Buffer.from("img-bytes"),
            headers: { "content-type": "image/jpeg; charset=binary" }
          } as never)
      }
    });
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.buffer.toString()).toBe("img-bytes");
    expect(result.contentType).toBe("image/jpeg");
  });

  it("URL inválida falha controladamente", async () => {
    await expect(
      downloadPublicHttpMedia({
        url: "not-a-url",
        kind: "image",
        deps: {
          assertUrl: async () => ({ ok: false, reason: "invalid_url" })
        }
      })
    ).rejects.toMatchObject({ code: "invalid_url" });
  });

  it("SSRF/local/private é rejeitado", async () => {
    await expect(
      downloadPublicHttpMedia({
        url: "http://127.0.0.1/secret",
        kind: "image",
        deps: {
          assertUrl: async () => ({
            ok: false,
            reason: "private_or_local_host"
          })
        }
      })
    ).rejects.toMatchObject({ code: "ssrf" });
  });

  it("HTTP 404 falha controladamente", async () => {
    await expect(
      downloadPublicHttpMedia({
        url: publicUrl,
        kind: "image",
        deps: {
          assertUrl: async () => ({ ok: true, url: new URL(publicUrl) }),
          axiosGet: async () =>
            ({ status: 404, data: "", headers: {} } as never)
        }
      })
    ).rejects.toMatchObject({ code: "http_status", httpStatus: 404 });
  });

  it("HTTP 500 falha controladamente", async () => {
    await expect(
      downloadPublicHttpMedia({
        url: publicUrl,
        kind: "audio",
        deps: {
          assertUrl: async () => ({ ok: true, url: new URL(publicUrl) }),
          axiosGet: async () =>
            ({ status: 500, data: "", headers: {} } as never)
        }
      })
    ).rejects.toMatchObject({ code: "http_status", httpStatus: 500 });
  });

  it("timeout falha controladamente", async () => {
    const err = Object.assign(new Error("timeout"), { code: "ECONNABORTED" });
    await expect(
      downloadPublicHttpMedia({
        url: publicUrl,
        kind: "image",
        deps: {
          assertUrl: async () => ({ ok: true, url: new URL(publicUrl) }),
          axiosGet: async () => {
            throw err;
          }
        }
      })
    ).rejects.toMatchObject({ code: "timeout" });
  });

  it("mídia acima do limite falha controladamente", async () => {
    const tooBig = Buffer.alloc(EVOLUTION_MEDIA_LIMITS.imageMaxBytes + 1, 1);
    await expect(
      downloadPublicHttpMedia({
        url: publicUrl,
        kind: "image",
        deps: {
          assertUrl: async () => ({ ok: true, url: new URL(publicUrl) }),
          axiosGet: async () =>
            ({
              status: 200,
              data: tooBig,
              headers: { "content-type": "image/jpeg" }
            } as never)
        }
      })
    ).rejects.toBeInstanceOf(AutomationMediaError);
    await expect(
      downloadPublicHttpMedia({
        url: publicUrl,
        kind: "image",
        deps: {
          assertUrl: async () => ({ ok: true, url: new URL(publicUrl) }),
          axiosGet: async () => {
            throw new Error("maxContentLength size of exceeded");
          }
        }
      })
    ).rejects.toMatchObject({ code: "too_large" });
  });

  it("usa timeout e maxRedirects=0 da política do projeto", async () => {
    const axiosGet = jest.fn().mockResolvedValue({
      status: 200,
      data: Buffer.from("x"),
      headers: {}
    });
    await downloadPublicHttpMedia({
      url: publicUrl,
      kind: "image",
      deps: {
        assertUrl: async () => ({ ok: true, url: new URL(publicUrl) }),
        axiosGet
      }
    });
    expect(axiosGet).toHaveBeenCalledWith(
      publicUrl,
      expect.objectContaining({
        timeout: EVOLUTION_MEDIA_LIMITS.downloadTimeoutMs,
        maxRedirects: 0,
        maxContentLength: EVOLUTION_MEDIA_LIMITS.imageMaxBytes
      })
    );
  });
});
