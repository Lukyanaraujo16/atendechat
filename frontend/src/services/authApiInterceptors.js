const BUSINESS_FORBIDDEN = [
  "ERR_COMPANY_DELINQUENT",
  "ERR_EXTERNAL_API_NOT_ALLOWED",
  "ERR_NO_PERMISSION",
  "ERR_PLAN_FEATURE_DISABLED",
  "ERR_USER_FEATURE_DISABLED",
  "ERR_GROUP_NOT_VISIBLE",
];

let registered = false;
let isRefreshing = false;
let isLoggingOut = false;
let failedRequestsQueue = [];

const sessionHandlers = {
  onSessionInvalid: null,
};

export function setAuthSessionInvalidHandler(handler) {
  sessionHandlers.onSessionInvalid = typeof handler === "function" ? handler : null;
}

export function setAuthLoggingOut(next) {
  isLoggingOut = Boolean(next);
  if (isLoggingOut) {
    // Descarta fila de refresh pendente — não renovar sessão durante logout.
    failedRequestsQueue.forEach((request) => {
      request.reject(new Error("ERR_LOGGING_OUT"));
    });
    failedRequestsQueue = [];
    isRefreshing = false;
  }
}

export function getAuthLoggingOut() {
  return isLoggingOut;
}

function isLogoutRequest(config) {
  const url = String(config?.url || "");
  return /\/auth\/logout\b/.test(url);
}

/**
 * Anexa interceptors de auth ao cliente axios (chamar uma vez, após axios.create).
 * Não importar ./api aqui — evita dependência circular e api undefined no bootstrap.
 */
export function attachAuthApiInterceptors(api) {
  if (!api || registered) {
    return;
  }
  registered = true;

  api.interceptors.request.use(
    (config) => {
      if (isLoggingOut && !isLogoutRequest(config)) {
        return config;
      }
      try {
        const token = localStorage.getItem("token");
        if (token) {
          config.headers.Authorization = `Bearer ${JSON.parse(token)}`;
        }
      } catch {
        /* token inválido no storage — segue sem header */
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (originalRequest?.skipLogoutOnAuthError || isLoggingOut || isLogoutRequest(originalRequest)) {
        return Promise.reject(error);
      }

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
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const { data } = await api.post("/auth/refresh_token", undefined, {
            skipLogoutOnAuthError: true,
          });

          if (isLoggingOut) {
            return Promise.reject(error);
          }

          if (data?.token) {
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

          if (!isLoggingOut) {
            localStorage.removeItem("token");
            localStorage.removeItem("companyId");
            api.defaults.headers.Authorization = undefined;
            if (sessionHandlers.onSessionInvalid) {
              sessionHandlers.onSessionInvalid();
            }
          }

          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      if (
        error?.response?.status === 401 ||
        (error?.response?.status === 403 && originalRequest._retry)
      ) {
        if (!isLoggingOut) {
          localStorage.removeItem("token");
          localStorage.removeItem("companyId");
          api.defaults.headers.Authorization = undefined;
          if (sessionHandlers.onSessionInvalid) {
            sessionHandlers.onSessionInvalid();
          }
        }
      }

      return Promise.reject(error);
    }
  );
}

/** @deprecated use attachAuthApiInterceptors + setAuthSessionInvalidHandler */
export function registerAuthApiInterceptors(handlers = {}) {
  if (handlers.onSessionInvalid) {
    setAuthSessionInvalidHandler(handlers.onSessionInvalid);
  }
}

/** Test helpers */
export function __resetAuthInterceptorStateForTests() {
  registered = false;
  isRefreshing = false;
  isLoggingOut = false;
  failedRequestsQueue = [];
}
