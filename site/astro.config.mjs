// @ts-check
import { defineConfig } from "astro/config";

// URL canônica do site institucional. O app SaaS permanece em app.streamhubchat.com.br.
export default defineConfig({
  site: "https://streamhubchat.com.br",
  trailingSlash: "ignore",
  build: { inlineStylesheets: "auto" },
  compressHTML: true,
  devToolbar: { enabled: false },
});
