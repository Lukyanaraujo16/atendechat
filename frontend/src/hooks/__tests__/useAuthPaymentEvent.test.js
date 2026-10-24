/**
 * @jest-environment jsdom
 *
 * Segurança 1: o evento `company-{id}-payment` passa a trazer só { id, dueDate, status }.
 * O useAuth mescla o payload em user.company: os campos da sessão continuam e só dueDate/finance mudam.
 */
import React from "react";
import { render, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { SocketContext } from "../../context/Socket/SocketContext";
import useAuth from "../useAuth.js";

const mockPost = jest.fn();
jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {
    post: (...a) => mockPost(...a),
    get: jest.fn(async () => ({ data: {} })),
    delete: jest.fn(async () => ({})),
    defaults: { headers: {} },
  },
}));
jest.mock("react-toastify", () => ({ toast: { info: jest.fn(), success: jest.fn(), error: jest.fn() } }));
jest.mock("../../errors/toastError", () => jest.fn());

const SESSION_COMPANY = {
  id: 10,
  name: "Empresa IT",
  dueDate: "2026-11-15T03:00:00.000Z",
  timezone: "America/Sao_Paulo",
  businessSegment: "geral",
  modulePermissions: { crm: true },
};

function fakeSocketManager() {
  const handlers = {};
  const socket = { on: (ev, fn) => { handlers[ev] = fn; }, off: (ev) => { delete handlers[ev]; } };
  return { manager: { getSocket: () => socket }, emit: (ev, data) => handlers[ev] && handlers[ev](data) };
}

let current;
function Probe() {
  current = useAuth();
  return null;
}

describe("useAuth — evento de pagamento com payload mínimo", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("token", JSON.stringify("tok"));
    mockPost.mockReset();
    mockPost.mockImplementation(async (url) =>
      url === "/auth/refresh_token"
        ? { data: { token: "tok", user: { id: 5, profile: "user", companyId: 10, company: { ...SESSION_COMPANY } } } }
        : { data: {} }
    );
  });
  afterEach(cleanup);

  it("atualiza dueDate e finance e preserva os demais campos da sessão", async () => {
    const s = fakeSocketManager();
    render(
      <MemoryRouter>
        <SocketContext.Provider value={s.manager}>
          <Probe />
        </SocketContext.Provider>
      </MemoryRouter>
    );
    await act(async () => {});
    expect(current.user.company.name).toBe("Empresa IT");

    const newDue = "2026-12-15T03:00:00.000Z";
    await act(async () => {
      s.emit("company-10-payment", { action: "paid", company: { id: 10, dueDate: newDue, status: true } });
    });

    const company = current.user.company;
    expect(company.dueDate).toBe(newDue);
    expect(company).toMatchObject({
      name: "Empresa IT",
      timezone: "America/Sao_Paulo",
      businessSegment: "geral",
      modulePermissions: { crm: true },
      status: true,
    });
    expect(company).not.toHaveProperty("internalNotes");
    expect(current.user.finance).toBeTruthy();
  });

  it("evento sem company ou com outra action não altera a sessão", async () => {
    const s = fakeSocketManager();
    render(
      <MemoryRouter>
        <SocketContext.Provider value={s.manager}>
          <Probe />
        </SocketContext.Provider>
      </MemoryRouter>
    );
    await act(async () => {});
    const before = current.user;
    await act(async () => {
      s.emit("company-10-payment", { action: "paid", company: null });
      s.emit("company-10-payment", { action: "other", company: { id: 10, dueDate: "2030-01-01", status: true } });
    });
    expect(current.user).toBe(before);
  });
});
