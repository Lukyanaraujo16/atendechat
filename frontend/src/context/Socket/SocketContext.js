import { createContext } from "react";
import openSocket from "socket.io-client";
import jwt from "jsonwebtoken";
import { getBackendBaseURL } from "../../config/backendUrl";
import { countPostLogin } from "../../utils/postLoginDebug";

class ManagedSocket {
  constructor(socketManager) {
    this.socketManager = socketManager;
    this.rawSocket = socketManager.currentSocket;
    this.callbacks = [];
    this.joins = [];

    this._onManagedConnect = () => {
      if (!this.rawSocket?.recovered) {
        const refreshJoinsOnReady = () => {
          for (const j of this.joins) {
            this.rawSocket.emit(`join${j.event}`, ...j.params);
          }
          this.rawSocket.off("ready", refreshJoinsOnReady);
        };
        for (const j of this.callbacks) {
          this.rawSocket.off(j.event, j.callback);
          this.rawSocket.on(j.event, j.callback);
        }

        this.rawSocket.on("ready", refreshJoinsOnReady);
      }
    };
    if (this.rawSocket) {
      this.rawSocket.on("connect", this._onManagedConnect);
    }
  }

  /** Espelha o estado real do socket.io — necessário para gates de notificação. */
  get connected() {
    return Boolean(this.rawSocket?.connected);
  }

  get id() {
    return this.rawSocket?.id ?? null;
  }

  get ready() {
    return Boolean(this.socketManager?.socketReady);
  }

  on(event, callback) {
    if (event === "ready" || event === "connect") {
      return this.socketManager.onReady(callback);
    }
    this.callbacks.push({ event, callback });
    return this.rawSocket.on(event, callback);
  }

  off(event, callback) {
    const i = this.callbacks.findIndex(
      (c) => c.event === event && c.callback === callback
    );
    if (i !== -1) {
      this.callbacks.splice(i, 1);
    }
    return this.rawSocket.off(event, callback);
  }

  emit(event, ...params) {
    if (event.startsWith("join")) {
      this.joins.push({ event: event.substring(4), params });
    }
    return this.rawSocket.emit(event, ...params);
  }

  disconnect() {
    for (const j of this.joins) {
      this.rawSocket.emit(`leave${j.event}`, ...j.params);
    }
    this.joins = [];
    for (const c of this.callbacks) {
      this.rawSocket.off(c.event, c.callback);
    }
    this.callbacks = [];
    if (this._onManagedConnect && this.rawSocket) {
      this.rawSocket.off("connect", this._onManagedConnect);
      this._onManagedConnect = null;
    }
  }
}

class DummySocket {
  get connected() {
    return false;
  }
  get ready() {
    return false;
  }
  get id() {
    return null;
  }
  on(..._) {}
  off(..._) {}
  emit(..._) {}
  disconnect() {}
}

const SocketManager = {
  currentCompanyId: -1,
  currentUserId: -1,
  currentSocket: null,
  socketReady: false,

  _resetSocketState() {
    this.currentSocket = null;
    this.currentCompanyId = -1;
    this.currentUserId = -1;
    this.socketReady = false;
  },

  /** Encerra o socket da sessão atual (logout / troca de conta). */
  disconnectSession() {
    if (this.currentSocket) {
      try {
        this.currentSocket.removeAllListeners();
        this.currentSocket.disconnect();
      } catch (_) {
        /* ignore */
      }
    }
    this._resetSocketState();
  },

  getSocket: function (companyId) {
    let userId = null;
    if (localStorage.getItem("userId")) {
      userId = localStorage.getItem("userId");
    }

    if (!companyId && !this.currentSocket) {
      return new DummySocket();
    }

    if (companyId && typeof companyId !== "string") {
      companyId = `${companyId}`;
    }

    if (companyId !== this.currentCompanyId || userId !== this.currentUserId) {
      if (this.currentSocket) {
        countPostLogin("socket reconnect (company/user changed)");
        try {
          this.currentSocket.removeAllListeners();
          this.currentSocket.disconnect();
        } catch (_) {
          /* ignore */
        }
        this.currentSocket = null;
      }
      // Evita onReady sticky da sessão/socket anterior.
      this.socketReady = false;

      let token = null;
      try {
        token = JSON.parse(localStorage.getItem("token"));
      } catch (_) {}

      if (!token) {
        this.currentCompanyId = -1;
        this.currentUserId = userId;
        this.socketReady = false;
        return new DummySocket();
      }

      if (!companyId) {
        this.currentCompanyId = -1;
        this.currentUserId = userId;
        this.socketReady = false;
        return new DummySocket();
      }

      const decoded = jwt.decode(token);
      const exp = decoded?.exp;
      if (exp && Date.now() >= exp * 1000) {
        this.currentCompanyId = -1;
        this.currentUserId = userId;
        this.socketReady = false;
        return new DummySocket();
      }

      this.currentCompanyId = companyId;
      this.currentUserId = userId;
      this.socketReady = false;

      this.currentSocket = openSocket(getBackendBaseURL(), {
        transports: ["polling"],
        pingTimeout: 18000,
        pingInterval: 18000,
        query: { token },
      });

      this.currentSocket.on("disconnect", (reason) => {
        countPostLogin("socket disconnect");
        this.socketReady = false;
        if (reason.startsWith("io ")) {
          const decodedToken = jwt.decode(token);
          const tokenExp = decodedToken?.exp;
          if (tokenExp && Date.now() - 180 >= tokenExp * 1000) {
            return;
          }
          if (this.currentSocket) {
            this.currentSocket.connect();
          }
        }
      });

      this.currentSocket.on("connect", () => {
        countPostLogin("socket connect");
      });

      if (process.env.NODE_ENV !== "production") {
        this.currentSocket.onAny((event, ...args) => {
          console.debug("Event: ", { socket: this.currentSocket, event, args });
        });
      }

      this.currentSocket.on("ready", () => {
        this.socketReady = true;
      });
    }

    return new ManagedSocket(this);
  },

  onReady: function (callbackReady) {
    if (this.socketReady && this.currentSocket?.connected) {
      callbackReady();
      return;
    }

    if (!this.currentSocket) {
      return;
    }

    const onReadyOnce = () => {
      this.socketReady = true;
      callbackReady();
    };

    this.currentSocket.once("ready", onReadyOnce);

    // Se o servidor já emitiu ready antes deste listener (corrida de montagem),
    // e o socket está conectado, armamos via microtask quando a flag já estiver true.
    if (this.currentSocket.connected && this.socketReady) {
      this.currentSocket.off("ready", onReadyOnce);
      callbackReady();
    }
  },
};

const SocketContext = createContext();

export { SocketContext, SocketManager };
