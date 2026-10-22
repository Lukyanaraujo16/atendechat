import AppError from "../../errors/AppError";
import {
  assertEfiSlotAllowedForRuntime,
  getAllowedEfiApiEnvironment,
  getAllowedEfiSlotForRuntime,
  getPermittedEfiApiEnvironments,
  getStreamhubRuntimeEnv,
  isEfiProductionApiAllowedInTestRuntime,
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

  describe("B34-T10: EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API", () => {
    it("desligada por padrão: test só aceita sandbox", () => {
      process.env.STREAMHUB_RUNTIME_ENV = "test";
      delete process.env.EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API;
      expect(isEfiProductionApiAllowedInTestRuntime()).toBe(false);
      expect(getPermittedEfiApiEnvironments("test")).toEqual(["sandbox"]);
      expect(() => assertEfiSlotAllowedForRuntime("homologation", "production")).toThrow(
        "ERR_EFI_ENVIRONMENT_FORBIDDEN_FOR_RUNTIME"
      );
    });

    it("ligada: test aceita sandbox e production só no slot homologation", () => {
      process.env.STREAMHUB_RUNTIME_ENV = "test";
      process.env.EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API = "true";
      expect(getPermittedEfiApiEnvironments("test")).toEqual(["sandbox", "production"]);
      expect(assertEfiSlotAllowedForRuntime("homologation", "production")).toBe("test");
      expect(assertEfiSlotAllowedForRuntime("homologation", "sandbox")).toBe("test");
      expect(() => assertEfiSlotAllowedForRuntime("production", "production")).toThrow(
        "ERR_EFI_SLOT_FORBIDDEN_FOR_RUNTIME"
      );
      // O default do slot novo continua sandbox: nada é selecionado implicitamente.
      expect(getAllowedEfiApiEnvironment("test")).toBe("sandbox");
    });

    it("valores diferentes de true não autorizam", () => {
      for (const v of ["1", "yes", "on", "false", ""]) {
        process.env.EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API = v;
        expect(isEfiProductionApiAllowedInTestRuntime()).toBe(false);
      }
    });

    it("runtime production não muda com a autorização", () => {
      process.env.STREAMHUB_RUNTIME_ENV = "production";
      process.env.EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API = "true";
      expect(getPermittedEfiApiEnvironments("production")).toEqual(["production"]);
      expect(() => assertEfiSlotAllowedForRuntime("production", "sandbox")).toThrow(AppError);
      expect(() => assertEfiSlotAllowedForRuntime("homologation", "production")).toThrow(AppError);
      expect(assertEfiSlotAllowedForRuntime("production", "production")).toBe("production");
    });
  });
});
