/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, act, cleanup } from "@testing-library/react";

import { changeLanguage } from "../../../../translate/i18n";
import { SocketContext } from "../../../../context/Socket/SocketContext";
import CheckoutSuccess, { PIX_STATUS_POLL_MS } from "../CheckoutSuccess";

const mockApiGet = jest.fn();
jest.mock("../../../../services/api", () => ({
  __esModule: true,
  default: { get: (...a) => mockApiGet(...a) },
}));
jest.mock("react-toastify", () => ({ toast: { success: jest.fn() } }));

const PIX = { qrcode: { qrcode: "00020126pixcopiaecola" }, valor: { original: "1.00" } };
const INVOICE = { id: 2, detail: "Homologação" };

function fakeSocketManager() {
  const handlers = {};
  const socket = {
    on: (ev, fn) => { handlers[ev] = fn; },
    off: (ev) => { delete handlers[ev]; },
  };
  return { manager: { getSocket: () => socket }, emit: (ev, data) => handlers[ev] && handlers[ev](data), handlers };
}

const flush = () => act(async () => {});
const tick = (ms) => act(async () => { jest.advanceTimersByTime(ms); });

function renderModal(socket) {
  return render(
    <SocketContext.Provider value={socket.manager}>
      <CheckoutSuccess pix={PIX} invoice={INVOICE} />
    </SocketContext.Provider>
  );
}

describe("CheckoutSuccess — confirmação do Pix", () => {
  beforeAll(() => changeLanguage("pt"));
  beforeEach(() => {
    jest.useFakeTimers();
    mockApiGet.mockReset();
    localStorage.setItem("companyId", "1");
  });
  // Desmonta com os timers falsos ainda ativos (senão os intervalos de um teste vazam para o próximo).
  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it("aguarda com polling da fatura e confirma quando o backend marca paga; para de consultar", async () => {
    mockApiGet.mockResolvedValue({ data: { id: 2, status: "open" } });
    const s = fakeSocketManager();
    renderModal(s);
    await flush();
    expect(mockApiGet).toHaveBeenCalledWith("/invoices/2");
    expect(screen.getByText(/Aguardando pagamento/)).toBeTruthy();

    mockApiGet.mockResolvedValue({ data: { id: 2, status: "paid" } });
    await tick(PIX_STATUS_POLL_MS);
    expect(screen.getByText("Pagamento confirmado!")).toBeTruthy();
    expect(screen.queryByText(/Aguardando pagamento/)).toBeNull();
    expect(screen.queryByText("Copiar código PIX")).toBeNull();

    const calls = mockApiGet.mock.calls.length;
    await tick(PIX_STATUS_POLL_MS * 3);
    expect(mockApiGet.mock.calls.length).toBe(calls);
  });

  it("evento de socket `paid` dispara consulta imediata e mostra a renovação", async () => {
    mockApiGet.mockResolvedValue({ data: { id: 2, status: "open" } });
    const s = fakeSocketManager();
    renderModal(s);
    await flush();

    mockApiGet.mockResolvedValue({ data: { id: 2, status: "paid" } });
    await act(async () => { s.emit("company-1-payment", { action: "paid", company: { dueDate: "2026-12-14" } }); });
    expect(screen.getByText("Pagamento confirmado!")).toBeTruthy();
    expect(screen.getByText(/Assinatura renovada até/)).toBeTruthy();
  });

  it("evento de pagamento de outra fatura não confirma esta (fonte da verdade é a fatura)", async () => {
    mockApiGet.mockResolvedValue({ data: { id: 2, status: "open" } });
    const s = fakeSocketManager();
    renderModal(s);
    await flush();
    await act(async () => { s.emit("company-1-payment", { action: "paid", company: { dueDate: "2026-12-14" } }); });
    expect(screen.queryByText("Pagamento confirmado!")).toBeNull();
    expect(screen.getByText(/Aguardando pagamento/)).toBeTruthy();
  });

  it("falha de rede não encerra a espera; a próxima consulta confirma", async () => {
    mockApiGet.mockRejectedValueOnce(new Error("Network Error"));
    const s = fakeSocketManager();
    renderModal(s);
    await flush();
    expect(screen.getByText(/Tentando novamente/)).toBeTruthy();
    expect(screen.getByText(/Aguardando pagamento/)).toBeTruthy();

    mockApiGet.mockResolvedValue({ data: { id: 2, status: "paid" } });
    await tick(PIX_STATUS_POLL_MS);
    expect(screen.getByText("Pagamento confirmado!")).toBeTruthy();
  });

  it("fatura já paga ao abrir: confirma sem mostrar o QR como pendente", async () => {
    mockApiGet.mockResolvedValue({ data: { id: 2, status: "paid" } });
    renderModal(fakeSocketManager());
    await flush();
    expect(screen.getByText("Pagamento confirmado!")).toBeTruthy();
    expect(screen.queryByText("Copiar código PIX")).toBeNull();
  });

  it("fechar o modal (desmontar) encerra polling e listener do socket", async () => {
    mockApiGet.mockResolvedValue({ data: { id: 2, status: "open" } });
    const s = fakeSocketManager();
    const { unmount } = renderModal(s);
    await flush();
    unmount();
    const calls = mockApiGet.mock.calls.length;
    await tick(PIX_STATUS_POLL_MS * 3);
    expect(mockApiGet.mock.calls.length).toBe(calls);
    expect(s.handlers["company-1-payment"]).toBeUndefined();
  });
});
