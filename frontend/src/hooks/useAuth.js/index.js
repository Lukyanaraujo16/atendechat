import { useState, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";
import { has, isArray } from "lodash";

import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { SocketContext } from "../../context/Socket/SocketContext";
import moment from "moment";
import { computeFinanceFromDueDate } from "../../helpers/financeFlags";

const BUSINESS_FORBIDDEN = [
  "ERR_COMPANY_DELINQUENT",
  "ERR_EXTERNAL_API_NOT_ALLOWED",
  "ERR_NO_PERMISSION",
];

const useAuth = () => {
  const history = useHistory();
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({});

  api.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers["Authorization"] = `Bearer ${JSON.parse(token)}`;
        setIsAuth(true);
      }
      return config;
    },
    (error) => {
      Promise.reject(error);
    }
  );

  let isRefreshing = false;
  let failedRequestsQueue = [];

  api.interceptors.response.use(
    (response) => {
      return response;
    },
    async (error) => {
      const originalRequest = error.config;

      if (error?.response?.status === 403 && !originalRequest._retry) {
        const errCode = error?.response?.data?.error;
        if (errCode && BUSINESS_FORBIDDEN.includes(errCode)) {
          return Promise.reject(error);
        }
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedRequestsQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return api(originalRequest);
            })
            .catch((err) => {
              return Promise.reject(err);
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const { data } = await api.post("/auth/refresh_token");

          if (data) {
            localStorage.setItem("token", JSON.stringify(data.token));
            api.defaults.headers.Authorization = `Bearer ${data.token}`;

            failedRequestsQueue.forEach((request) => {
              request.resolve(data.token);
            });
            failedRequestsQueue = [];
          }

          return api(originalRequest);
        } catch (refreshError) {
          failedRequestsQueue.forEach((request) => {
            request.reject(refreshError);
          });
          failedRequestsQueue = [];

          localStorage.removeItem("token");
          localStorage.removeItem("companyId");
          api.defaults.headers.Authorization = undefined;
          setIsAuth(false);

          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
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

  const socketManager = useContext(SocketContext);

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
          setUser(data?.user || {});
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
    const companyId = localStorage.getItem("companyId");
    if (companyId) {
      const socket = socketManager.getSocket(companyId);

      socket.on(`company-${companyId}-user`, (data) => {
        if (data.action === "update" && data.user.id === user.id) {
          setUser(data.user);
        }
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [socketManager, user]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    if (!companyId) return;
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
  }, [socketManager]);

  const handleLogin = async (userData) => {
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login", userData);
      const {
        user: { companyId, id, company, super: isSuperAdmin },
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

      if (isSuperAdmin && (companyId == null || companyId === "")) {
        history.push("/saas");
      } else {
        history.push("/tickets");
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
      history.push("/tickets");
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
