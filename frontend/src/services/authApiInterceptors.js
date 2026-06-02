import api from "./api";

const BUSINESS_FORBIDDEN = [
  "ERR_COMPANY_DELINQUENT",
  "ERR_EXTERNAL_API_NOT_ALLOWED",
  "ERR_NO_PERMISSION",
  "ERR_PLAN_FEATURE_DISABLED",
  "ERR_USER_FEATURE_DISABLED",
];

let registered = false;
let isRefreshing = false;
let failedRequestsQueue = [];

const sessionHandlers = {
  onSessionInvalid: null,
};

/**
 * Regista interceptors de auth uma única vez por sessão da app (nunca por render).
 */
export function registerAuthApiInterceptors(handlers = {}) {
  if (handlers.onSessionInvalid) {
    sessionHandlers.onSessionInvalid = handlers.onSessionInvalid;
  }
  if (registered) {
    return;
  }
  registered = true;

  api.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${JSON.parse(token)}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  api.interceptors.response.use(
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
          const { data } = await api.post("/auth/refresh_token");

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

          localStorage.removeItem("token");
          localStorage.removeItem("companyId");
          api.defaults.headers.Authorization = undefined;
          if (sessionHandlers.onSessionInvalid) {
            sessionHandlers.onSessionInvalid();
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
        localStorage.removeItem("token");
        localStorage.removeItem("companyId");
        api.defaults.headers.Authorization = undefined;
        if (sessionHandlers.onSessionInvalid) {
          sessionHandlers.onSessionInvalid();
        }
      }

      return Promise.reject(error);
    }
  );
}
