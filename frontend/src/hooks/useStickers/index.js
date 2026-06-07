import { useState, useEffect, useCallback, useContext } from "react";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { SocketContext } from "../../context/Socket/SocketContext";
import { resolveBackendBaseURL } from "../../config/backendUrl";

export function stickerPreviewUrl(sticker) {
  if (!sticker) return "";
  if (sticker.publicUrl) {
    const base = resolveBackendBaseURL();
    return base ? `${base}${sticker.publicUrl}` : sticker.publicUrl;
  }
  if (sticker.filePath) {
    const base = resolveBackendBaseURL();
    return base ? `${base}/public/${sticker.filePath}` : `/public/${sticker.filePath}`;
  }
  return "";
}

export default function useStickers() {
  const [stickers, setStickers] = useState([]);
  const [loading, setLoading] = useState(false);
  const socketManager = useContext(SocketContext);

  const loadStickers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/stickers");
      setStickers(Array.isArray(data?.stickers) ? data.stickers : []);
    } catch (err) {
      toastError(err);
      setStickers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStickers();
  }, [loadStickers]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    if (!companyId) return undefined;
    const socket = socketManager.getSocket(companyId);
    const handler = (payload) => {
      if (!payload?.action) return;
      if (payload.action === "create" && payload.sticker) {
        setStickers((prev) => {
          const exists = prev.some((s) => s.id === payload.sticker.id);
          if (exists) return prev;
          return [payload.sticker, ...prev];
        });
      }
      if (payload.action === "delete" && payload.stickerId != null) {
        setStickers((prev) =>
          prev.filter((s) => Number(s.id) !== Number(payload.stickerId))
        );
      }
    };
    socket.on(`company-${companyId}-sticker`, handler);
    return () => {
      socket.off(`company-${companyId}-sticker`, handler);
    };
  }, [socketManager]);

  const uploadSticker = useCallback(async (file, name) => {
    const formData = new FormData();
    formData.append("sticker", file);
    if (name) formData.append("name", name);
    const { data } = await api.post("/stickers", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    setStickers((prev) => {
      const exists = prev.some((s) => s.id === data.id);
      if (exists) return prev;
      return [data, ...prev];
    });
    return data;
  }, []);

  const deleteSticker = useCallback(async (stickerId) => {
    await api.delete(`/stickers/${stickerId}`);
    setStickers((prev) =>
      prev.filter((s) => Number(s.id) !== Number(stickerId))
    );
  }, []);

  const sendStickerToTicket = useCallback(async (ticketId, stickerId) => {
    const { data } = await api.post(`/messages/${ticketId}/sticker`, {
      stickerId,
    });
    return data?.message;
  }, []);

  const saveStickerFromMessage = useCallback(async (messageId, name) => {
    const { data } = await api.post(
      `/stickers/from-message/${messageId}`,
      name ? { name } : {}
    );
    if (data && !data.duplicate) {
      setStickers((prev) => {
        const exists = prev.some((s) => s.id === data.id);
        if (exists) return prev;
        return [data, ...prev];
      });
    }
    return data;
  }, []);

  return {
    stickers,
    loading,
    loadStickers,
    uploadSticker,
    deleteSticker,
    sendStickerToTicket,
    saveStickerFromMessage,
  };
}
