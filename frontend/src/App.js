import React, { useState, useEffect } from "react";

import "./styles/mobileViewport.css";
import "react-toastify/dist/ReactToastify.css";
import { QueryClient, QueryClientProvider } from "react-query";

import { enUS, ptBR, esES } from "@material-ui/core/locale";
import CssBaseline from "@material-ui/core/CssBaseline";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { useMediaQuery } from "@material-ui/core";
import ColorModeContext from "./layout/themeContext";
import { SocketContext, SocketManager } from "./context/Socket/SocketContext";
import { getThemeOptions } from "./theme/appThemeOptions";

import Routes from "./routes";
import { BrandingProvider } from "./context/Branding/BrandingContext";
import { NotificationSoundProvider } from "./context/NotificationSound/NotificationSoundContext";

const queryClient = new QueryClient();

const App = () => {
  const [locale, setLocale] = useState();

  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const preferredTheme = window.localStorage.getItem("preferredTheme");
  const [mode, setMode] = useState(
    preferredTheme ? preferredTheme : prefersDarkMode ? "dark" : "light"
  );

  const colorMode = React.useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === "light" ? "dark" : "light"));
      },
    }),
    []
  );

  const theme = createTheme(getThemeOptions(mode), locale);

  useEffect(() => {
    const i18nlocale = localStorage.getItem("i18nextLng");
    const browserLocale = i18nlocale?.substring(0, 2) ?? "pt";

    if (browserLocale === "pt") {
      setLocale(ptBR);
    } else if (browserLocale === "en") {
      setLocale(enUS);
    } else if (browserLocale === "es") setLocale(esES);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("preferredTheme", mode);
    document.documentElement.setAttribute("data-theme", mode);
    document.body.setAttribute("data-theme", mode);
  }, [mode]);

  return (
    <ColorModeContext.Provider value={{ colorMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}>
          <SocketContext.Provider value={SocketManager}>
            <NotificationSoundProvider>
              <BrandingProvider>
                <Routes />
              </BrandingProvider>
            </NotificationSoundProvider>
          </SocketContext.Provider>
        </QueryClientProvider>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};

export default App;
