import { prepareWhatsAppPttAudio } from "../prepareWhatsAppPttAudio";

describe("prepareWhatsAppPttAudio 12.3-F", () => {
  it("Evolution usa OGG/Opus homologado e ptt true", async () => {
    const execFn = jest.fn((_cmd: string, cb: (err: null) => void) => cb(null));
    const unlinkSync = jest.fn();
    const result = await prepareWhatsAppPttAudio({
      sourcePath: "/tmp/in.webm",
      provider: "evolution",
      unlinkSource: true,
      outputDir: "/tmp",
      deps: { execFn: execFn as never, unlinkSync }
    });
    const cmd = String(execFn.mock.calls[0][0]);
    expect(cmd).toContain("libopus");
    expect(cmd).toContain("-f ogg");
    expect(cmd).not.toContain("-f ipod");
    expect(result.mimetype).toBe("audio/ogg; codecs=opus");
    expect(result.ptt).toBe(true);
    expect(result.outputPath).toMatch(/\.ogg$/);
    expect(unlinkSync).toHaveBeenCalledWith("/tmp/in.webm");
  });

  it("Baileys preserva AAC/MP4 legado", async () => {
    const execFn = jest.fn((_cmd: string, cb: (err: null) => void) => cb(null));
    const result = await prepareWhatsAppPttAudio({
      sourcePath: "/tmp/in.webm",
      provider: "baileys",
      unlinkSource: false,
      outputDir: "/tmp",
      deps: { execFn: execFn as never, unlinkSync: jest.fn() }
    });
    const cmd = String(execFn.mock.calls[0][0]);
    expect(cmd).toContain("-f ipod");
    expect(cmd).not.toContain("libopus");
    expect(result.mimetype).toBe("audio/mp4");
    expect(result.ptt).toBe(true);
  });

  it("falha de ffmpeg vira prepare_failed", async () => {
    const execFn = jest.fn((_cmd: string, cb: (err: Error) => void) =>
      cb(new Error("ffmpeg"))
    );
    await expect(
      prepareWhatsAppPttAudio({
        sourcePath: "/tmp/in.webm",
        provider: "evolution",
        deps: { execFn: execFn as never }
      })
    ).rejects.toMatchObject({ code: "prepare_failed" });
  });
});
