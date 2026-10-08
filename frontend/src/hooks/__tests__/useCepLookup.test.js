/**
 * @jest-environment jsdom
 */
import React, { useState } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";

import useCepLookup from "../useCepLookup";
import { mergeCepLookupIntoAddress } from "../../utils/cepLookup";

jest.mock("axios", () => {
  const get = jest.fn();
  return {
    __esModule: true,
    default: {
      get,
      isCancel: (err) => err?.__cancel === true,
    },
  };
});

function Probe({ onSuccess, enabled = true }) {
  const [addr, setAddr] = useState({
    postalCode: "",
    street: "",
    number: "123",
    complement: "Apto 201",
    district: "",
    city: "",
    state: "",
  });
  const { status, lookup } = useCepLookup({
    enabled,
    debounceMs: 10,
    onSuccess: (next) => {
      setAddr((prev) => mergeCepLookupIntoAddress(prev, next));
      if (onSuccess) onSuccess(next);
    },
  });
  return (
    <div>
      <button
        type="button"
        data-testid="lookup"
        onClick={() => lookup(addr.postalCode || "29100-000")}
      >
        go
      </button>
      <button
        type="button"
        data-testid="set-a"
        onClick={() => {
          setAddr((p) => ({ ...p, postalCode: "11111-111" }));
          lookup("11111-111");
        }}
      >
        A
      </button>
      <button
        type="button"
        data-testid="set-b"
        onClick={() => {
          setAddr((p) => ({ ...p, postalCode: "22222-222" }));
          lookup("22222-222");
        }}
      >
        B
      </button>
      <span data-testid="status">{status}</span>
      <span data-testid="street">{addr.street}</span>
      <span data-testid="number">{addr.number}</span>
      <span data-testid="complement">{addr.complement}</span>
      <span data-testid="city">{addr.city}</span>
      <span data-testid="cep">{addr.postalCode}</span>
    </div>
  );
}

describe("useCepLookup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("menos de 8 dígitos não consulta", () => {
    let api;
    function Inner() {
      api = useCepLookup({ debounceMs: 10 });
      return <span data-testid="s">{api.status}</span>;
    }
    render(<Inner />);
    act(() => {
      api.lookup("29100");
      jest.advanceTimersByTime(50);
    });
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("8 dígitos consulta e preenche sem tocar número/complemento", async () => {
    axios.get.mockResolvedValue({
      data: {
        cep: "29100-000",
        logradouro: "Rua Exemplo",
        complemento: "lado ímpar",
        bairro: "Centro",
        localidade: "Vila Velha",
        uf: "ES",
      },
    });
    render(<Probe />);
    act(() => {
      screen.getByTestId("lookup").click();
      jest.advanceTimersByTime(20);
    });
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("success")
    );
    expect(screen.getByTestId("street").textContent).toBe("Rua Exemplo");
    expect(screen.getByTestId("city").textContent).toBe("Vila Velha");
    expect(screen.getByTestId("number").textContent).toBe("123");
    expect(screen.getByTestId("complement").textContent).toBe("Apto 201");
    expect(axios.get).toHaveBeenCalledWith(
      "https://viacep.com.br/ws/29100000/json/",
      expect.objectContaining({ timeout: expect.any(Number) })
    );
  });

  it("erro:true → not_found", async () => {
    axios.get.mockResolvedValue({ data: { erro: true } });
    render(<Probe />);
    act(() => {
      screen.getByTestId("lookup").click();
      jest.advanceTimersByTime(20);
    });
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("not_found")
    );
  });

  it("network error → error", async () => {
    axios.get.mockRejectedValue(new Error("network"));
    render(<Probe />);
    act(() => {
      screen.getByTestId("lookup").click();
      jest.advanceTimersByTime(20);
    });
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("error")
    );
  });

  it("stale response A não sobrescreve CEP B", async () => {
    let resolveA;
    const promiseA = new Promise((r) => {
      resolveA = r;
    });
    axios.get.mockImplementation((url) => {
      if (url.includes("11111111")) return promiseA;
      return Promise.resolve({
        data: {
          cep: "22222-222",
          logradouro: "Rua B",
          bairro: "Bairro B",
          localidade: "Cidade B",
          uf: "SP",
        },
      });
    });

    render(<Probe />);
    act(() => {
      screen.getByTestId("set-a").click();
      jest.advanceTimersByTime(20);
    });
    act(() => {
      screen.getByTestId("set-b").click();
      jest.advanceTimersByTime(20);
    });

    await waitFor(() =>
      expect(screen.getByTestId("street").textContent).toBe("Rua B")
    );

    await act(async () => {
      resolveA({
        data: {
          cep: "11111-111",
          logradouro: "Rua A",
          bairro: "Bairro A",
          localidade: "Cidade A",
          uf: "RJ",
        },
      });
    });

    expect(screen.getByTestId("street").textContent).toBe("Rua B");
    expect(screen.getByTestId("city").textContent).toBe("Cidade B");
  });

  it("unmount não aplica setState de request pendente", async () => {
    let resolveReq;
    axios.get.mockReturnValue(
      new Promise((r) => {
        resolveReq = r;
      })
    );
    const { unmount } = render(<Probe />);
    act(() => {
      screen.getByTestId("lookup").click();
      jest.advanceTimersByTime(20);
    });
    unmount();
    await act(async () => {
      resolveReq({
        data: {
          cep: "29100-000",
          logradouro: "X",
          bairro: "Y",
          localidade: "Z",
          uf: "ES",
        },
      });
    });
    // Sem throw de setState em unmounted = ok
  });
});
