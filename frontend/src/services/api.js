import axios from "axios";
import { getBackendBaseURL } from "../config/backendUrl";

let warnedEmptyBackend = false;

function attachBackendInterceptor(client) {
	client.interceptors.request.use((config) => {
		const rawUrl = config.url || "";
		if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
			return config;
		}
		const base = getBackendBaseURL();
		if (base) {
			config.baseURL = base;
		} else if (process.env.NODE_ENV === "production" && !warnedEmptyBackend) {
			warnedEmptyBackend = true;
			// eslint-disable-next-line no-console
			console.error(
				"[atendechat] URL do backend vazia. Defina REACT_APP_BACKEND_URL ou use host + REACT_APP_BACKEND_PORT."
			);
		}
		return config;
	});
}

const api = axios.create({
	withCredentials: true,
});

attachBackendInterceptor(api);

export const openApi = axios.create({});

attachBackendInterceptor(openApi);

export default api;
