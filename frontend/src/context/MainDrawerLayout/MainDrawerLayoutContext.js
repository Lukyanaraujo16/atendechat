import React, { createContext, useContext } from "react";

const MainDrawerLayoutContext = createContext({ drawerOpen: true });

export function MainDrawerLayoutProvider({ drawerOpen, children }) {
  return (
    <MainDrawerLayoutContext.Provider value={{ drawerOpen }}>
      {children}
    </MainDrawerLayoutContext.Provider>
  );
}

/** Estado do drawer principal (`LoggedInLayout`); default aberto fora do provider (testes). */
export function useMainDrawerOpen() {
  return useContext(MainDrawerLayoutContext).drawerOpen;
}
