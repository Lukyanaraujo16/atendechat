/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, render } from "@testing-library/react";
import { SocketContext } from "../../../context/Socket/SocketContext";
import useInboundTicketPresence, {
  INBOUND_TICKET_PRESENCE_TTL_MS,
} from "../useInboundTicketPresence";

function Probe({ ticketId, onState }) {
  const presence = useInboundTicketPresence({ ticketId });
  React.useEffect(() => {
    onState(presence);
  }, [presence, onState]);
  return null;
}

describe("useInboundTicketPresence", () => {
  let listeners;
  let socket;
  let socketManager;

  beforeEach(() => {
    jest.useFakeTimers();
    listeners = {};
    socket = {
      on: (event, cb) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(cb);
      },
      off: (event, cb) => {
        listeners[event] = (listeners[event] || []).filter((fn) => fn !== cb);
      },
      emit: jest.fn(),
    };
    socketManager = { getSocket: () => socket };
    localStorage.setItem("companyId", "1");
  });

  afterEach(() => {
    jest.useRealTimers();
    localStorage.clear();
  });

  function emitEvent(event, payload) {
    (listeners[event] || []).forEach((fn) => fn(payload));
  }

  function mount(ticketId = 77) {
    let state = null;
    const onState = (next) => {
      state = next;
    };
    const view = render(
      <SocketContext.Provider value={socketManager}>
        <Probe ticketId={ticketId} onState={onState} />
      </SocketContext.Provider>
    );
    return {
      getState: () => state,
      rerender: (id) =>
        view.rerender(
          <SocketContext.Provider value={socketManager}>
            <Probe ticketId={id} onState={onState} />
          </SocketContext.Provider>
        ),
      unmount: view.unmount,
    };
  }

  it("composing do ticket atual mostra digitando e renovar TTL", () => {
    const { getState } = mount();
    act(() => {
      emitEvent("company-1-ticketPresence", {
        ticketId: 77,
        presence: "composing",
      });
    });
    expect(getState()).toBe("composing");
    act(() => {
      jest.advanceTimersByTime(INBOUND_TICKET_PRESENCE_TTL_MS - 1);
      emitEvent("company-1-ticketPresence", {
        ticketId: 77,
        presence: "composing",
      });
    });
    act(() => {
      jest.advanceTimersByTime(INBOUND_TICKET_PRESENCE_TTL_MS - 1);
    });
    expect(getState()).toBe("composing");
  });

  it("recording mostra gravando, renova TTL e paused remove imediatamente", () => {
    const { getState } = mount();
    act(() => {
      emitEvent("company-1-ticketPresence", {
        ticketId: 77,
        presence: "recording",
      });
    });
    expect(getState()).toBe("recording");
    act(() => {
      jest.advanceTimersByTime(INBOUND_TICKET_PRESENCE_TTL_MS - 1);
      emitEvent("company-1-ticketPresence", {
        ticketId: 77,
        presence: "recording",
      });
    });
    act(() => {
      jest.advanceTimersByTime(INBOUND_TICKET_PRESENCE_TTL_MS - 1);
    });
    expect(getState()).toBe("recording");
    act(() => {
      emitEvent("company-1-ticketPresence", {
        ticketId: 77,
        presence: "paused",
      });
    });
    expect(getState()).toBe(null);
  });

  it("sem paused o TTL 6s remove", () => {
    const { getState } = mount();
    act(() => {
      emitEvent("company-1-ticketPresence", {
        ticketId: 77,
        presence: "composing",
      });
    });
    act(() => {
      jest.advanceTimersByTime(INBOUND_TICKET_PRESENCE_TTL_MS);
    });
    expect(getState()).toBe(null);
  });

  it("evento de outro ticket é ignorado", () => {
    const { getState } = mount(77);
    act(() => {
      emitEvent("company-1-ticketPresence", {
        ticketId: 99,
        presence: "composing",
      });
    });
    expect(getState()).toBe(null);
  });

  it("troca de ticket limpa estado e cancela timer", () => {
    const { getState, rerender } = mount(77);
    act(() => {
      emitEvent("company-1-ticketPresence", {
        ticketId: 77,
        presence: "composing",
      });
    });
    expect(getState()).toBe("composing");
    act(() => {
      rerender(88);
    });
    expect(getState()).toBe(null);
    act(() => {
      jest.advanceTimersByTime(INBOUND_TICKET_PRESENCE_TTL_MS);
    });
    expect(getState()).toBe(null);
  });

  it("unmount cancela timer", () => {
    const { getState, unmount } = mount();
    act(() => {
      emitEvent("company-1-ticketPresence", {
        ticketId: 77,
        presence: "composing",
      });
    });
    expect(getState()).toBe("composing");
    act(() => {
      unmount();
    });
    act(() => {
      jest.advanceTimersByTime(INBOUND_TICKET_PRESENCE_TTL_MS);
    });
  });

  it("disconnect/reconnect não deixa indicador preso", () => {
    const { getState } = mount();
    act(() => {
      emitEvent("company-1-ticketPresence", {
        ticketId: 77,
        presence: "composing",
      });
    });
    expect(getState()).toBe("composing");
    act(() => {
      emitEvent("disconnect");
    });
    expect(getState()).toBe(null);
    act(() => {
      emitEvent("company-1-ticketPresence", {
        ticketId: 77,
        presence: "composing",
      });
    });
    expect(getState()).toBe("composing");
    act(() => {
      emitEvent("disconnect");
    });
    expect(getState()).toBe(null);
  });
});
