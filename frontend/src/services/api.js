import axios from "axios";
import { resolveBackendBaseURL } from "../config/backendUrl";
import { countPostLogin } from "../utils/postLoginDebug";
import { attachAuthApiInterceptors } from "./authApiInterceptors";

let warnedEmptyBackend = false;

function attachBackendInterceptor(client) {
	client.interceptors.request.use((config) => {
		countPostLogin("axios request");
		const rawUrl = config.url || "";
		if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
			return config;
		}
		const base = resolveBackendBaseURL();
		if (base) {
			config.baseURL = base;
		} else if (process.env.NODE_ENV === "production" && !warnedEmptyBackend) {
			warnedEmptyBackend = true;
			// eslint-disable-next-line no-console
			console.error(
				"[coreflow] URL do backend vazia. Defina REACT_APP_BACKEND_URL ou use host + REACT_APP_BACKEND_PORT."
			);
		}
		return config;
	});
}

const api = axios.create({
	withCredentials: true,
});

attachBackendInterceptor(api);
attachAuthApiInterceptors(api);

export const openApi = axios.create({});

attachBackendInterceptor(openApi);

export default api;
