import { useState, useEffect, useReducer, useContext } from "react";
import toastError from "../../errors/toastError";

import api from "../../services/api";
import { SocketContext } from "../../context/Socket/SocketContext";
import { AuthContext } from "../../context/Auth/AuthContext";

const reducer = (state, action) => {
  if (action.type === "LOAD_WHATSAPPS") {
    const whatsApps = action.payload;

    return [...whatsApps];
  }

  if (action.type === "UPDATE_WHATSAPPS") {
    const whatsApp = action.payload;
    const whatsAppIndex = state.findIndex((s) => s.id === whatsApp.id);

    if (whatsAppIndex !== -1) {
      state[whatsAppIndex] = whatsApp;
      return [...state];
    }
    return [whatsApp, ...state];
  }

  if (action.type === "UPDATE_SESSION") {
    const whatsApp = action.payload;
    const whatsAppIndex = state.findIndex((s) => s.id === whatsApp.id);

    if (whatsAppIndex !== -1) {
      state[whatsAppIndex] = {
        ...state[whatsAppIndex],
        ...whatsApp,
      };
      return [...state];
    }
    return [...state];
  }

  if (action.type === "DELETE_WHATSAPPS") {
    const whatsAppId = action.payload;

    const whatsAppIndex = state.findIndex((s) => s.id === whatsAppId);
    if (whatsAppIndex !== -1) {
      state.splice(whatsAppIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useWhatsApps = () => {
  const [whatsApps, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(true);

  const socketManager = useContext(SocketContext);
  const { user, loading: authLoading } = useContext(AuthContext);

  const companyId = user?.companyId;
  const userId = user?.id;

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (userId == null || companyId == null) {
      dispatch({ type: "RESET" });
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const fetchSession = async () => {
      try {
        const { data } = await api.get("/whatsapp/?session=0");
        const list = Array.isArray(data)
          ? data
          : data?.records || data?.whatsapps || [];
        if (!cancelled) {
          dispatch({
            type: "LOAD_WHATSAPPS",
            payload: Array.isArray(list) ? list : [],
          });
        }
      } catch (err) {
        if (!cancelled) {
          toastError(err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    fetchSession();
    return () => {
      cancelled = true;
    };
  }, [authLoading, userId, companyId]);

  useEffect(() => {
    if (authLoading || userId == null || companyId == null) {
      return;
    }

    const cid = String(companyId);
    const socket = socketManager.getSocket(cid);

    const onWhatsapp = (data) => {
      if (data.action === "update" && data.whatsapp) {
        const w = data.whatsapp;
        if (
          w.companyId != null &&
          Number(w.companyId) !== Number(companyId)
        ) {
          return;
        }
        dispatch({ type: "UPDATE_WHATSAPPS", payload: w });
      } else if (data.action === "delete" && data.whatsappId != null) {
        dispatch({ type: "DELETE_WHATSAPPS", payload: data.whatsappId });
      }
    };

    const onWhatsappSession = (data) => {
      if (data.action === "update" && data.session) {
        const s = data.session;
        if (
          s.companyId != null &&
          Number(s.companyId) !== Number(companyId)
        ) {
          return;
        }
        dispatch({ type: "UPDATE_SESSION", payload: s });
      }
    };

    socket.on(`company-${cid}-whatsapp`, onWhatsapp);
    socket.on(`company-${cid}-whatsappSession`, onWhatsappSession);

    return () => {
      socket.off(`company-${cid}-whatsapp`, onWhatsapp);
      socket.off(`company-${cid}-whatsappSession`, onWhatsappSession);
      socket.disconnect();
    };
  }, [socketManager, authLoading, userId, companyId]);

  return { whatsApps, loading };
};

export default useWhatsApps;
