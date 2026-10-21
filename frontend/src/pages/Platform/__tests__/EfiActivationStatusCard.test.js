import React from "react";
import { render, screen } from "@testing-library/react";

import EfiActivationStatusCard from "../EfiActivationStatusCard";

if (typeof global.MutationObserver === "undefined") {
  global.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

jest.setTimeout(20000);

jest.mock("../../../errors/toastError", () => ({ __esModule: true, default: jest.fn() }));

const mockGet = jest.fn();
jest.mock("../../../services/api", () => ({
  __esModule: true,
  default: { get: (...args) => mockGet(...args) },
}));

const status = {
  environment: "sandbox",
  readiness: { pix: { ready: true, missing: [] }, cobrancas: { ready: true, missing: [] } },
  controls: {
    credentialsSource: "env",
    pixChargeV2Enabled: false,
    webhookPipeline: "async",
    webhookWorkerPaused: false,
    pixReconciliationSweepEnabled: false,
    trustProxyHops: 1,
    invalid: [],
  },
  pixChargeV2: { configured: false, released: false, releasedRuntimes: [], active: false },
  webhookPipeline: {
    configured: "async",
    released: false,
    releasedRuntimes: ["test"],
    active: false,
    workerPaused: false,
    sweep: { configured: false, released: false, releasedRuntimes: [], active: false },
    stats: null,
  },
  version: { currentCommit: "abcdef1234567890", source: "env", dirty: false, builtAt: null },
  credentialsSource: {
    active: "env",
    financial: "env",
    databaseFinancialReleased: false,
    databaseFinancialReleasedRuntimes: [],
    database: {
      runtime: "test",
      slot: "homologation",
      efiEnvironment: "sandbox",
      configFound: true,
      status: "active",
      validConfig: true,
      missing: [],
      configFingerprint: "0123456789abcdef",
      pixValidation: { validated: true, at: "2026-10-20T10:00:00Z" },
      homologation: {
        required: false,
        homologated: true,
        at: "2026-10-20T10:00:00Z",
        commit: "fedcba9876543210",
        versionDiffers: true,
      },
      usable: true,
      blockedReason: null,
    },
  },
};

test("pipeline async sem liberação mostra aviso e inativo; versão divergente avisa", async () => {
  mockGet.mockResolvedValue({ data: status });

  render(<EfiActivationStatusCard />);

  const warning = await screen.findByText(/a env sozinha não ativa/);
  expect(mockGet).toHaveBeenCalledWith("/saas/finance/efi/status");
  // só o pipeline está configurado ON sem liberação
  expect(screen.getAllByText(/a env sozinha não ativa/)).toHaveLength(1);
  expect(warning.closest("tr").textContent).toContain("Pipeline do webhook");
  expect(warning.closest("tr").textContent).toContain("inativo");
  expect(screen.getByText("Versão atual difere da homologada.")).toBeTruthy();
  expect(screen.getByText(/abcdef123456/)).toBeTruthy();
  expect(screen.queryByText(/abcdef1234567/)).toBeNull();
});
