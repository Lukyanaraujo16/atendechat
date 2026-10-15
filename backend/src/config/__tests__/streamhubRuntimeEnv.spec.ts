import AppError from "../../errors/AppError";
import {
  assertEfiSlotAllowedForRuntime,
  getAllowedEfiApiEnvironment,
  getAllowedEfiSlotForRuntime,
  getStreamhubRuntimeEnv,
  tryGetStreamhubRuntimeEnv
} from "../streamhubRuntimeEnv";

describe("streamhubRuntimeEnv", () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env = { ...original };
  });

  afterAll(() => {
    process.env = original;
  });

  it("aceita test e production", () => {
    process.env.STREAMHUB_RUNTIME_ENV = "test";
    expect(getStreamhubRuntimeEnv()).toBe("test");
    process.env.STREAMHUB_RUNTIME_ENV = "production";
    expect(getStreamhubRuntimeEnv()).toBe("production");
  });

  it("bloqueia ausente ou inválido", () => {
    delete process.env.STREAMHUB_RUNTIME_ENV;
    expect(() => getStreamhubRuntimeEnv()).toThrow(AppError);
    expect(tryGetStreamhubRuntimeEnv()).toBeNull();

    process.env.STREAMHUB_RUNTIME_ENV = "staging";
    expect(() => getStreamhubRuntimeEnv()).toThrow(AppError);
  });

  it("não usa NODE_ENV como substituto", () => {
    delete process.env.STREAMHUB_RUNTIME_ENV;
    process.env.NODE_ENV = "production";
    expect(() => getStreamhubRuntimeEnv()).toThrow(AppError);
  });

  it("mapeia slot e API Efí por runtime", () => {
    expect(getAllowedEfiSlotForRuntime("test")).toBe("homologation");
    expect(getAllowedEfiApiEnvironment("test")).toBe("sandbox");
    expect(getAllowedEfiSlotForRuntime("production")).toBe("production");
    expect(getAllowedEfiApiEnvironment("production")).toBe("production");
  });

  it("runtime test bloqueia slot production", () => {
    process.env.STREAMHUB_RUNTIME_ENV = "test";
    expect(() =>
      assertEfiSlotAllowedForRuntime("production", "sandbox")
    ).toThrow(AppError);
    expect(() =>
      assertEfiSlotAllowedForRuntime("homologation", "production")
    ).toThrow(AppError);
    expect(assertEfiSlotAllowedForRuntime("homologation", "sandbox")).toBe(
      "test"
    );
  });

  it("runtime production bloqueia homologation/sandbox", () => {
    process.env.STREAMHUB_RUNTIME_ENV = "production";
    expect(() =>
      assertEfiSlotAllowedForRuntime("homologation", "production")
    ).toThrow(AppError);
    expect(() =>
      assertEfiSlotAllowedForRuntime("production", "sandbox")
    ).toThrow(AppError);
  });
});
