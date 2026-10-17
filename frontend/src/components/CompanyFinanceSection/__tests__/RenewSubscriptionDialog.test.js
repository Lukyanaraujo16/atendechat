import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import api from "../../../services/api";
import RenewSubscriptionDialog from "../RenewSubscriptionDialog";

// jsdom antigo do CRA 3 não expõe MutationObserver (necessário para waitFor).
if (typeof global.MutationObserver === "undefined") {
  global.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

// Diálogos MUI são lentos no jsdom do CRA 3 quando as suítes rodam em paralelo.
jest.setTimeout(20000);

jest.mock("../../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));
jest.mock("../../../errors/toastError", () => ({ __esModule: true, default: jest.fn() }));

const company = { id: 7, name: "ACME", dueDate: "2026-10-10", recurrence: "MENSAL" };
const preview = {
  currentDueDate: "2026-10-10",
  recurrence: "MENSAL",
  months: 1,
  newDueDate: "2026-11-10",
  overdue: true,
  cyclesSkipped: 2,
};

function fillAndConfirm() {
  fireEvent.change(screen.getByLabelText(/Justificativa/i), {
    target: { value: "Acordo comercial" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
}

describe("RenewSubscriptionDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockResolvedValue({ data: preview });
  });

  it("mostra prévia, exige justificativa e envia expectedCurrentDueDate", async () => {
    const onRenewed = jest.fn();
    const onClose = jest.fn();
    api.post.mockResolvedValue({ data: { id: 7, dueDate: "2026-11-10" } });

    render(
      <RenewSubscriptionDialog open company={company} onClose={onClose} onRenewed={onRenewed} />
    );

    expect(await screen.findByText("10/11/2026")).toBeTruthy();
    expect(screen.getByText(/2 ciclos não pagos serão pulados/)).toBeTruthy();
    expect(screen.getByText("Mensal (1 mês)")).toBeTruthy();

    const button = screen.getByRole("button", { name: /Renovar assinatura/i });
    expect(button.disabled).toBe(true);

    fillAndConfirm();
    expect(button.disabled).toBe(false);
    fireEvent.click(button);

    await waitFor(() => expect(onRenewed).toHaveBeenCalled());
    expect(api.get).toHaveBeenCalledWith("/saas/companies/7/finance/renewal-preview");
    expect(api.post).toHaveBeenCalledWith("/companies/7/renew", {
      reason: "Acordo comercial",
      expectedCurrentDueDate: "2026-10-10",
    });
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it("trata 409 ERR_RENEWAL_STALE pedindo recarga", async () => {
    api.post.mockRejectedValue({
      response: { status: 409, data: { error: "ERR_RENEWAL_STALE" } },
    });
    render(<RenewSubscriptionDialog open company={company} onClose={jest.fn()} />);
    await screen.findByText("10/11/2026");
    fillAndConfirm();
    fireEvent.click(screen.getByRole("button", { name: /Renovar assinatura/i }));
    expect(await screen.findByText(/O vencimento já foi alterado/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Renovar assinatura/i }).disabled).toBe(true);
  });

  it("mostra willUnblock/blockKind e alertas da prévia", async () => {
    api.get.mockResolvedValue({
      data: {
        ...preview,
        overdue: false,
        cyclesSkipped: 0,
        willUnblock: false,
        blockKind: "manual",
        alerts: [{ code: "MANUAL_BLOCK_KEEPS_BLOCKED", message: "Bloqueio manual mantido." }],
      },
    });
    render(<RenewSubscriptionDialog open company={company} onClose={jest.fn()} />);
    expect(await screen.findByText(/continuará bloqueada \(bloqueio manual\)/)).toBeTruthy();
    expect(screen.getByText("Bloqueio manual mantido.")).toBeTruthy();
    expect(screen.getByText(/Renovação administrativa — sem receita/)).toBeTruthy();
  });

  it("indica desbloqueio quando willUnblock", async () => {
    api.get.mockResolvedValue({ data: { ...preview, willUnblock: true, blockKind: "financial", alerts: [] } });
    render(<RenewSubscriptionDialog open company={company} onClose={jest.fn()} />);
    expect(await screen.findByText("A empresa será desbloqueada ao renovar.")).toBeTruthy();
  });
});
