/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, render } from "@testing-library/react";
import {
  HUMAN_WHATSAPP_TYPING,
  isEligibleForHumanWhatsAppTypingPresence,
} from "../humanWhatsAppTypingPresence";
import useHumanWhatsAppTypingPresence from "../useHumanWhatsAppTypingPresence";
import { sendHumanTicketPresence } from "../humanWhatsAppTypingPresence";

jest.mock("../../../services/api", () => ({
  __esModule: true,
  default: {
    post: jest.fn(() => Promise.resolve({ data: { sent: true } })),
  },
}));

jest.mock("../humanWhatsAppTypingPresence", () => {
  const actual = jest.requireActual("../humanWhatsAppTypingPresence");
  return {
    ...actual,
    sendHumanTicketPresence: jest.fn(() => Promise.resolve({ data: { sent: true } })),
  };
});

const openTicket = {
  id: 3,
  channel: "whatsapp",
  whatsappId: 11,
  isGroup: false,
  isOrphan: false,
};

function Probe({ ticketId, ticket, ticketStatus, enabled, clock, onApi }) {
  const api = useHumanWhatsAppTypingPresence({
    ticketId,
    ticket,
    ticketStatus,
    enabled,
    clock,
  });
  React.useEffect(() => {
    onApi(api);
  }, [api, onApi]);
  return null;
}

describe("useHumanWhatsAppTypingPresence", () => {
  let now;
  let timers;
  let clock;

  beforeEach(() => {
    jest.clearAllMocks();
    now = 1_000_000;
    timers = [];
    clock = {
      now: () => now,
      setTimeout: (fn, ms) => {
        const id = { fn, due: now + ms };
        timers.push(id);
        return id;
      },
      clearTimeout: (id) => {
        timers = timers.filter((t) => t !== id);
      },
    };
    sendHumanTicketPresence.mockClear();
    sendHumanTicketPresence.mockResolvedValue({ data: { sent: true } });
  });

  function flushDue() {
    const due = timers.filter((t) => t.due <= now);
    timers = timers.filter((t) => t.due > now);
    due.forEach((t) => t.fn());
  }

  function advance(ms) {
    now += ms;
    flushDue();
  }

  function mount(props = {}) {
    let api = null;
    const onApi = (next) => {
      api = next;
    };
    const view = render(
      <Probe
        ticketId={3}
        ticket={openTicket}
        ticketStatus="open"
        clock={clock}
        onApi={onApi}
        {...props}
      />
    );
    return {
      getApi: () => api,
      rerender: (next) =>
        view.rerender(
          <Probe
            ticket={openTicket}
            ticketStatus="open"
            clock={clock}
            onApi={onApi}
            {...next}
          />
        ),
      unmount: view.unmount,
    };
  }

  it("foco sem digitação: zero composing", () => {
    mount();
    expect(sendHumanTicketPresence).not.toHaveBeenCalled();
  });

  it("primeira digitação envia composing", () => {
    const { getApi } = mount();
    act(() => {
      getApi().notifyTyping("o");
    });
    expect(sendHumanTicketPresence).toHaveBeenCalledTimes(1);
    expect(sendHumanTicketPresence).toHaveBeenCalledWith(3, "composing");
  });

  it("várias teclas rápidas não geram uma chamada por tecla", () => {
    const { getApi } = mount();
    act(() => {
      getApi().notifyTyping("o");
      getApi().notifyTyping("oi");
      getApi().notifyTyping("ola");
    });
    expect(sendHumanTicketPresence).toHaveBeenCalledTimes(1);
    expect(sendHumanTicketPresence).toHaveBeenCalledWith(3, "composing");
  });

  it("digitação contínua envia heartbeat controlado", () => {
    const { getApi } = mount();
    act(() => {
      getApi().notifyTyping("a");
    });
    act(() => {
      advance(HUMAN_WHATSAPP_TYPING.idlePauseMs - 100);
      getApi().notifyTyping("ab");
    });
    expect(sendHumanTicketPresence).toHaveBeenCalledTimes(1);
    act(() => {
      advance(
        HUMAN_WHATSAPP_TYPING.composingThrottleMs -
          (HUMAN_WHATSAPP_TYPING.idlePauseMs - 100)
      );
      getApi().notifyTyping("abc");
    });
    expect(sendHumanTicketPresence.mock.calls.map((c) => c[1])).toEqual([
      "composing",
      "composing",
    ]);
  });

  it("idle envia um paused", () => {
    const { getApi } = mount();
    act(() => {
      getApi().notifyTyping("oi");
    });
    act(() => {
      advance(HUMAN_WHATSAPP_TYPING.idlePauseMs);
    });
    expect(
      sendHumanTicketPresence.mock.calls.filter((c) => c[1] === "paused")
    ).toHaveLength(1);
    act(() => {
      advance(HUMAN_WHATSAPP_TYPING.idlePauseMs);
    });
    expect(
      sendHumanTicketPresence.mock.calls.filter((c) => c[1] === "paused")
    ).toHaveLength(1);
  });

  it("voltar a digitar envia novo composing", () => {
    const { getApi } = mount();
    act(() => {
      getApi().notifyTyping("oi");
    });
    act(() => {
      advance(HUMAN_WHATSAPP_TYPING.idlePauseMs);
    });
    act(() => {
      getApi().notifyTyping("oi ");
    });
    const kinds = sendHumanTicketPresence.mock.calls.map((c) => c[1]);
    expect(kinds).toEqual(["composing", "paused", "composing"]);
  });

  it("input apagado até vazio envia paused", () => {
    const { getApi } = mount();
    act(() => {
      getApi().notifyTyping("oi");
      getApi().notifyTyping("");
    });
    expect(sendHumanTicketPresence.mock.calls.map((c) => c[1])).toEqual([
      "composing",
      "paused",
    ]);
  });

  it("envio dispara paused imediatamente", () => {
    const { getApi } = mount();
    act(() => {
      getApi().notifyTyping("oi");
      getApi().pauseNow();
    });
    expect(sendHumanTicketPresence.mock.calls.map((c) => c[1])).toEqual([
      "composing",
      "paused",
    ]);
  });

  it("falha no presence não lança no composer", () => {
    sendHumanTicketPresence.mockImplementation(() =>
      Promise.reject(new Error("network"))
    );
    const { getApi } = mount();
    expect(() => {
      act(() => {
        getApi().notifyTyping("oi");
        getApi().pauseNow();
      });
    }).not.toThrow();
  });

  it("troca de ticket pausa o anterior e não vaza composing", () => {
    const { getApi, rerender } = mount({ ticketId: 3 });
    act(() => {
      getApi().notifyTyping("oi");
    });
    act(() => {
      rerender({ ticketId: 4, ticket: { ...openTicket, id: 4 } });
    });
    expect(sendHumanTicketPresence.mock.calls).toEqual([
      [3, "composing"],
      [3, "paused"],
    ]);
    act(() => {
      advance(HUMAN_WHATSAPP_TYPING.idlePauseMs);
    });
    expect(sendHumanTicketPresence).toHaveBeenCalledTimes(2);
  });

  it("unmount cancela timers e envia paused", () => {
    const { getApi, unmount } = mount();
    act(() => {
      getApi().notifyTyping("oi");
    });
    act(() => {
      unmount();
    });
    expect(sendHumanTicketPresence.mock.calls.map((c) => c[1])).toEqual([
      "composing",
      "paused",
    ]);
    act(() => {
      advance(HUMAN_WHATSAPP_TYPING.idlePauseMs);
    });
    expect(sendHumanTicketPresence).toHaveBeenCalledTimes(2);
  });

  it("Instagram e ticket fechado não enviam composing", () => {
    const insta = mount({
      ticket: { ...openTicket, channel: "instagram" },
    });
    act(() => {
      insta.getApi().notifyTyping("oi");
    });
    const closed = mount({ ticketStatus: "closed" });
    act(() => {
      closed.getApi().notifyTyping("oi");
    });
    expect(sendHumanTicketPresence).not.toHaveBeenCalled();
  });

  it("elegibilidade rejeita grupo e canal não WhatsApp", () => {
    expect(
      isEligibleForHumanWhatsAppTypingPresence({
        ticketId: 1,
        ticketStatus: "open",
        ticket: { ...openTicket, isGroup: true },
      })
    ).toBe(false);
    expect(
      isEligibleForHumanWhatsAppTypingPresence({
        ticketId: 1,
        ticketStatus: "open",
        ticket: { ...openTicket, channel: "instagram" },
      })
    ).toBe(false);
    expect(
      isEligibleForHumanWhatsAppTypingPresence({
        ticketId: 1,
        ticketStatus: "open",
        ticket: openTicket,
      })
    ).toBe(true);
  });
});
