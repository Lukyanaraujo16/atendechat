import { useState, useEffect, useContext, useRef, useCallback } from "react";
import { useHistory } from "react-router-dom";
import { has, isArray } from "lodash";

import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { SocketContext } from "../../context/Socket/SocketContext";
import moment from "moment";
import { computeFinanceFromDueDate } from "../../helpers/financeFlags";
import { oneSignalLogout } from "../../services/oneSignalService";
import { canAccessSaasPlatform } from "../../utils/platformUser";
import { getPostLoginHomePath } from "../../utils/attendanceAccess";
import { registerAuthApiInterceptors } from "../../services/authApiInterceptors";
import { countPostLogin, debugPostLogin } from "../../utils/postLoginDebug";

const useAuth = () => {
  const history = useHistory();
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({});

  useEffect(() => {
    registerAuthApiInterceptors({
      onSessionInvalid: () => setIsAuth(false),
    });
  }, []);

  const socketManager = useContext(SocketContext);

  const permRefreshTimerRef = useRef(null);
  const permRefreshInFlightRef = useRef(false);

  const refreshSessionAfterPermissionChange = useCallback(async () => {
    if (permRefreshInFlightRef.current) return;
    permRefreshInFlightRef.current = true;
    try {
      const { data } = await api.post(
        "/auth/refresh_token",
        undefined,
        { skipLogoutOnAuthError: true }
      );
      if (data?.token) {
        localStorage.setItem("token", JSON.stringify(data.token));
        api.defaults.headers.Authorization = `Bearer ${data.token}`;
      }
      if (data?.user) {
        if (data.user.companyId != null && data.user.companyId !== "") {
          localStorage.setItem("companyId", String(data.user.companyId));
        } else {
          localStorage.removeItem("companyId");
        }
        setUser(data.user);
        toast.success(i18n.t("userPermissions.sessionRefreshedToast"), {
          autoClose: 4000,
        });
      } else {
        toast.info(i18n.t("userPermissions.sessionUpdatedFallbackToast"), {
          autoClose: 12000,
        });
      }
    } catch {
      toast.info(i18n.t("userPermissions.sessionUpdatedFallbackToast"), {
        autoClose: 12000,
      });
    } finally {
      permRefreshInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    (async () => {
      if (token) {
        try {
          const { data } = await api.post("/auth/refresh_token");
          if (data?.token) {
            localStorage.setItem("token", JSON.stringify(data.token));
          }
          api.defaults.headers.Authorization = `Bearer ${data?.token || JSON.parse(token)}`;
          setIsAuth(true);
          if (data?.user) {
            if (data.user.companyId != null && data.user.companyId !== "") {
              localStorage.setItem("companyId", String(data.user.companyId));
            } else {
              localStorage.removeItem("companyId");
            }
            setUser(data.user);
          } else {
            setUser({});
          }
        } catch (err) {
          if (err?.response?.status === 401 || err?.response?.status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("companyId");
            api.defaults.headers.Authorization = undefined;
            setIsAuth(false);
            toastError(err);
          } else {
            toastError(err);
          }
        }
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (user?.companyId == null || user?.companyId === "") {
      return undefined;
    }
    const companyId = String(user.companyId);
    const socket = socketManager.getSocket(companyId);

    const onCompanyUser = (data) => {
      if (data.action === "update" && data.user?.id === user.id) {
        setUser(data.user);
      }
    };

    const onPermissionsUpdated = (payload) => {
      const pid =
        payload?.companyId != null ? String(payload.companyId) : null;
      if (pid && pid !== companyId) return;
      if (permRefreshTimerRef.current) {
        clearTimeout(permRefreshTimerRef.current);
      }
      permRefreshTimerRef.current = setTimeout(() => {
        permRefreshTimerRef.current = null;
        refreshSessionAfterPermissionChange();
      }, 450);
    };

    socket.on(`company-${companyId}-user`, onCompanyUser);
    socket.on("user-permissions-updated", onPermissionsUpdated);

    return () => {
      if (permRefreshTimerRef.current) {
        clearTimeout(permRefreshTimerRef.current);
        permRefreshTimerRef.current = null;
      }
      socket.off(`company-${companyId}-user`, onCompanyUser);
      socket.off("user-permissions-updated", onPermissionsUpdated);
    };
  }, [socketManager, user?.id, user?.companyId, refreshSessionAfterPermissionChange]);

  useEffect(() => {
    if (user?.companyId == null || user?.companyId === "") {
      return undefined;
    }
    const companyId = String(user.companyId);
    const socket = socketManager.getSocket(companyId);
    const handler = (data) => {
      if (data.action !== "CONCLUIDA" || !data.company) return;
      setUser((prev) => {
        const dueDate = data.company.dueDate;
        const finance = computeFinanceFromDueDate(dueDate);
        return {
          ...prev,
          company: { ...prev.company, ...data.company, dueDate },
          finance,
        };
      });
    };
    socket.on(`company-${companyId}-payment`, handler);
    return () => {
      socket.off(`company-${companyId}-payment`, handler);
    };
  }, [socketManager, user?.companyId]);

  const handleLogin = useCallback(async (userData) => {
    try {
      const { data } = await api.post("/auth/login", userData);
      const {
        user: { companyId, id, company },
      } = data;

      if (company && has(company, "settings") && isArray(company.settings)) {
        const setting = company.settings.find(
          (s) => s.key === "campaignsEnabled"
        );
        if (setting && setting.value === "true") {
          localStorage.setItem("cshow", null); //regra pra exibir campanhas
        }
      }

      moment.locale("pt-br");
      const dueDate = data.user.company?.dueDate;
      const vencimento = dueDate ? moment(dueDate).format("DD/MM/yyyy") : null;

      localStorage.setItem("token", JSON.stringify(data.token));
      if (companyId != null && companyId !== "") {
        localStorage.setItem("companyId", String(companyId));
      } else {
        localStorage.removeItem("companyId");
      }
      localStorage.setItem("userId", id);
      if (vencimento) {
        localStorage.setItem("companyDueDate", vencimento);
      }
      api.defaults.headers.Authorization = `Bearer ${data.token}`;
      setUser(data.user);
      setIsAuth(true);
      setLoading(false);

      debugPostLogin("handleLogin success", {
        companyId,
        path: canAccessSaasPlatform(data.user) ? "/saas" : getPostLoginHomePath(data.user),
      });

      if (canAccessSaasPlatform(data.user)) {
        history.push("/saas");
      } else {
        history.push(getPostLoginHomePath(data.user));
      }

      window.requestAnimationFrame(() => {
        toast.success(i18n.t("auth.toasts.success"), {
          toastId: "auth-login-success",
          autoClose: 2500,
        });

        if (dueDate) {
          const dias = moment.duration(moment(dueDate).diff(moment())).asDays();
          if (dias >= 0 && Math.round(dias) < 5) {
            toast.warn(
              i18n.t("finance.login.expiringSoon", {
                days: Math.round(dias),
                count: Math.round(dias),
              }),
              { autoClose: 6000 }
            );
          }
        }

        if (data.user.finance?.delinquent) {
          toast.warn(i18n.t("finance.login.delinquentWarning"), {
            autoClose: 8000,
          });
        }
      });
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  }, [history]);

  const handleLogout = useCallback(async () => {
    setLoading(true);

    try {
      await oneSignalLogout();
      await api.delete("/auth/logout");
      setIsAuth(false);
      setUser({});
      localStorage.removeItem("token");
      localStorage.removeItem("companyId");
      localStorage.removeItem("userId");
      localStorage.removeItem("cshow");
      api.defaults.headers.Authorization = undefined;
      setLoading(false);
      history.push("/login");
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  }, [history]);

  const getCurrentUserInfo = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      return data;
    } catch (err) {
      toastError(err);
    }
  }, []);

  const enterSupportMode = useCallback(async (companyId) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/support/start", { companyId });
      localStorage.setItem("token", JSON.stringify(data.token));
      localStorage.setItem("companyId", data.user.companyId);
      api.defaults.headers.Authorization = `Bearer ${data.token}`;
      setUser(data.user);
      setIsAuth(true);
      toast.success(i18n.t("platform.support.entered"));
      history.push(getPostLoginHomePath(data.user));
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [history]);

  const exitSupportMode = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/support/stop");
      localStorage.setItem("token", JSON.stringify(data.token));
      if (data.user.companyId != null && data.user.companyId !== "") {
        localStorage.setItem("companyId", String(data.user.companyId));
      } else {
        localStorage.removeItem("companyId");
      }
      api.defaults.headers.Authorization = `Bearer ${data.token}`;
      setUser(data.user);
      setIsAuth(true);
      toast.success(i18n.t("platform.support.exited"));
      history.push("/saas");
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [history]);

  return {
    isAuth,
    user,
    loading,
    handleLogin,
    handleLogout,
    getCurrentUserInfo,
    enterSupportMode,
    exitSupportMode,
  };
};

export default useAuth;
