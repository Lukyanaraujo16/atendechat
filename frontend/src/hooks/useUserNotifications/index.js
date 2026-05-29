import { useState, useEffect, useContext, useCallback } from "react";
import { useHistory } from "react-router-dom";

import { AuthContext } from "../../context/Auth/AuthContext";
import { SocketContext } from "../../context/Socket/SocketContext";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { navigateFromNotificationData } from "../../utils/notificationNavigation";

/**
 * Estado e ações da central persistente (/notifications no banco).
 * Usado pelo sino unificado e por UserNotificationCenter (legado).
 */
export default function useUserNotifications({ enabled = true } = {}) {
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const socketManager = useContext(SocketContext);

  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState(false);

  const canUse =
    enabled &&
    Boolean(user?.id) &&
    user?.companyId != null &&
    user?.companyId !== "";

  const fetchUnread = useCallback(async () => {
    if (!canUse) return;
    try {
      const { data } = await api.get("/notifications/unread-count");
      setUnreadCount(Number(data?.count) || 0);
    } catch {
      /* noop */
    }
  }, [canUse]);

  const fetchList = useCallback(async () => {
    if (!canUse) return;
    setListLoading(true);
    setListError(false);
    try {
      const { data } = await api.get("/notifications", {
        params: { page: 1, limit: 20 },
      });
      setItems(Array.isArray(data?.notifications) ? data.notifications : []);
    } catch (e) {
      setListError(true);
      toastError(e);
    } finally {
      setListLoading(false);
    }
  }, [canUse]);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  useEffect(() => {
    if (!canUse || !user?.id || user?.companyId == null || user?.companyId === "") {
      return undefined;
    }
    const companyId = String(user.companyId);
    const socket = socketManager.getSocket(companyId);
    const ev = `user-${user.id}-notification`;
    const onCreate = (payload) => {
      if (payload?.action === "create" && payload?.notification) {
        const n = payload.notification;
        setItems((prev) => {
          const next = [n, ...prev.filter((x) => x.id !== n.id)];
          return next.slice(0, 30);
        });
        setUnreadCount((c) => c + 1);
      }
    };
    socket.on(ev, onCreate);
    return () => socket.off(ev, onCreate);
  }, [canUse, user?.id, user?.companyId, socketManager]);

  const markRead = useCallback(async (n) => {
    if (!n?.id || n.read) return;
    try {
      await api.put(`/notifications/${n.id}/read`);
      setItems((prev) =>
        prev.map((x) =>
          x.id === n.id ? { ...x, read: true, readAt: new Date().toISOString() } : x
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {
      toastError(e);
    }
  }, []);

  const markReadAndGo = useCallback(
    async (n) => {
      try {
        await markRead(n);
        navigateFromNotificationData(n.data, history, {
          effectiveFeatures: user?.effectiveUserFeatures,
        });
      } catch (e) {
        toastError(e);
      }
    },
    [history, markRead]
  );

  const markAllRead = useCallback(async () => {
    try {
      await api.put("/notifications/read-all");
      setItems((prev) =>
        prev.map((x) => ({ ...x, read: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (e) {
      toastError(e);
    }
  }, []);

  const archiveRead = useCallback(async () => {
    try {
      await api.put("/notifications/archive-all");
      setItems((prev) => prev.filter((x) => !x.read));
      fetchUnread();
    } catch (e) {
      toastError(e);
    }
  }, [fetchUnread]);

  const archiveOne = useCallback(async (n) => {
    try {
      await api.put(`/notifications/${n.id}/archive`);
      setItems((prev) => prev.filter((x) => x.id !== n.id));
      if (!n.read) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      toastError(err);
    }
  }, []);

  const removeIdsFromState = useCallback((ids) => {
    const idSet = new Set(
      (Array.isArray(ids) ? ids : [ids]).map((id) => Number(id)).filter((id) => !Number.isNaN(id))
    );
    if (!idSet.size) return;
    setItems((prev) => {
      let unreadRemoved = 0;
      const next = prev.filter((x) => {
        if (!idSet.has(Number(x.id))) return true;
        if (!x.read) unreadRemoved += 1;
        return false;
      });
      if (unreadRemoved > 0) {
        setUnreadCount((c) => Math.max(0, c - unreadRemoved));
      }
      return next;
    });
  }, []);

  const deleteOne = useCallback(
    async (n) => {
      if (!n?.id) return;
      try {
        await api.delete(`/notifications/${n.id}`);
        removeIdsFromState([n.id]);
      } catch (err) {
        toastError(err);
      }
    },
    [removeIdsFromState]
  );

  const deleteAllRead = useCallback(async () => {
    try {
      const { data } = await api.post("/notifications/delete-read");
      const deleted = Number(data?.deleted) || 0;
      setItems((prev) => prev.filter((x) => !(x.read && !x.archivedAt)));
      if (deleted > 0) {
        await fetchUnread();
      }
      return deleted;
    } catch (err) {
      toastError(err);
      return 0;
    }
  }, [fetchUnread]);

  return {
    canUse,
    unreadCount,
    items,
    listLoading,
    listError,
    fetchUnread,
    fetchList,
    markRead,
    markReadAndGo,
    markAllRead,
    archiveRead,
    archiveOne,
    deleteOne,
    deleteAllRead,
  };
}
