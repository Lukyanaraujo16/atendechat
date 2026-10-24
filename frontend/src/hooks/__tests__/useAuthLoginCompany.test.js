/**
 * @jest-environment jsdom
 *
 * Segurança 2: o login passa a devolver Company só com os campos da sessão e a Setting
 * `campaignsEnabled`. O handleLogin continua aplicando campanhas, vencimento e redirecionamento.
 */
import React from "react";
import { render, act, cleanup } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

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
jest.mock("react-toastify", () => ({ toast: { info: jest.fn(), success: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("../../errors/toastError", () => jest.fn());

const LOGIN_USER = {
  id: 5,
  profile: "user",
  super: false,
  companyId: 10,
  company: {
    id: 10,
    name: "Empresa IT",
    email: "contato@empresa-it.example",
    status: true,
    dueDate: "2027-01-15T03:00:00.000Z",
    timezone: "America/Sao_Paulo",
    businessSegment: "geral",
    crmVisibilityMode: "all",
    unassignedTicketsQueueId: null,
    modulePermissions: { campaigns: true },
    settings: [{ key: "campaignsEnabled", value: "true" }],
  },
  finance: { overdue: false, delinquent: false, dueDate: "2027-01-15", daysPastDue: null },
  effectiveUserFeatures: { "attendance.inbox": true },
  platformPermissions: [],
};

let current;
let pathname;
function Probe() {
  current = useAuth();
  pathname = useLocation().pathname;
  return null;
}

describe("useAuth.handleLogin — payload de Company restrito", () => {
  beforeEach(() => {
    localStorage.clear();
    window.requestAnimationFrame = (cb) => cb();
    mockPost.mockReset();
    mockPost.mockImplementation(async (url) =>
      url === "/auth/login" ? { data: { token: "tok", user: LOGIN_USER } } : { data: {} }
    );
  });
  afterEach(cleanup);

  it("autentica, guarda empresa/vencimento, aplica campaignsEnabled e redireciona uma vez", async () => {
    const socket = { on: () => {}, off: () => {} };
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <SocketContext.Provider value={{ getSocket: () => socket }}>
          <Probe />
        </SocketContext.Provider>
      </MemoryRouter>
    );
    await act(async () => {});
    await act(async () => { await current.handleLogin({ email: "u@x", password: "p" }); });

    expect(current.isAuth).toBe(true);
    expect(current.user.company).toMatchObject({ name: "Empresa IT", modulePermissions: { campaigns: true } });
    expect(current.user.company).not.toHaveProperty("internalNotes");
    expect(localStorage.getItem("companyId")).toBe("10");
    expect(localStorage.getItem("companyDueDate")).toBe("15/01/2027");
    expect(localStorage.getItem("cshow")).toBe("null");
    expect(pathname).not.toBe("/login");
    expect(mockPost.mock.calls.filter(([u]) => u === "/auth/login")).toHaveLength(1);
    expect(mockPost.mock.calls.filter(([u]) => u === "/auth/refresh_token")).toHaveLength(0);
  });
});
