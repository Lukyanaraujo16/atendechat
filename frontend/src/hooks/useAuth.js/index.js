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

const BUSINESS_FORBIDDEN = [
  "ERR_COMPANY_DELINQUENT",
  "ERR_EXTERNAL_API_NOT_ALLOWED",
  "ERR_NO_PERMISSION",
  /** Plano / feature: não é falha de sessão — não tentar refresh nem logout */
  "ERR_PLAN_FEATURE_DISABLED",
  "ERR_USER_FEATURE_DISABLED",
];

const useAuth = () => {
  const history = useHistory();
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({});

  const isRefreshingRef = useRef(false);
  const failedRequestsQueueRef = useRef([]);

  /** Regista interceptors uma vez; evita empilhar handlers e re-render em cada request (crítico no mobile). */
  useEffect(() => {
    const requestId = api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem("token");
        if (token) {
          config.headers.Authorization = `Bearer ${JSON.parse(token)}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const responseId = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (originalRequest?.skipLogoutOnAuthError) {
          return Promise.reject(error);
        }

        if (error?.response?.status === 403 && !originalRequest._retry) {
          const errCode = error?.response?.data?.error;
          if (errCode && BUSINESS_FORBIDDEN.includes(errCode)) {
            return Promise.reject(error);
          }
          if (isRefreshingRef.current) {
            return new Promise((resolve, reject) => {
              failedRequestsQueueRef.current.push({ resolve, reject });
            })
              .then((token) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                return api(originalRequest);
              })
              .catch((err) => Promise.reject(err));
          }

          originalRequest._retry = true;
          isRefreshingRef.current = true;

          try {
            const { data } = await api.post("/auth/refresh_token");

            if (data) {
              localStorage.setItem("token", JSON.stringify(data.token));
              api.defaults.headers.Authorization = `Bearer ${data.token}`;

              failedRequestsQueueRef.current.forEach((request) => {
                request.resolve(data.token);
              });
              failedRequestsQueueRef.current = [];
            }

            return api(originalRequest);
          } catch (refreshError) {
            failedRequestsQueueRef.current.forEach((request) => {
              request.reject(refreshError);
            });
            failedRequestsQueueRef.current = [];

            localStorage.removeItem("token");
            localStorage.removeItem("companyId");
            api.defaults.headers.Authorization = undefined;
            setIsAuth(false);

            return Promise.reject(refreshError);
          } finally {
            isRefreshingRef.current = false;
          }
        }

        if (
          error?.response?.status === 401 ||
          (error?.response?.status === 403 && originalRequest._retry)
        ) {
          localStorage.removeItem("token");
          localStorage.removeItem("companyId");
          api.defaults.headers.Authorization = undefined;
          setIsAuth(false);
        }

        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.request.eject(requestId);
      api.interceptors.response.eject(responseId);
    };
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

  const handleLogin = async (userData) => {
    setLoading(true);

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
      toast.success(i18n.t("auth.toasts.success"));

      if (dueDate) {
        const dias = moment.duration(moment(dueDate).diff(moment())).asDays();
        if (dias >= 0 && Math.round(dias) < 5) {
          toast.warn(
            i18n.t("finance.login.expiringSoon", {
              days: Math.round(dias),
              count: Math.round(dias),
            })
          );
        }
      }

      if (data.user.finance?.delinquent) {
        toast.warn(i18n.t("finance.login.delinquentWarning"), { autoClose: 10000 });
      }

      if (canAccessSaasPlatform(data.user)) {
        history.push("/saas");
      } else {
        history.push(getPostLoginHomePath(data.user));
      }
      setLoading(false);

    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
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
  };

  const getCurrentUserInfo = async () => {
    try {
      const { data } = await api.get("/auth/me");
      return data;
    } catch (err) {
      toastError(err);
    }
  };

  const enterSupportMode = async (companyId) => {
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
  };

  const exitSupportMode = async () => {
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
  };

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
