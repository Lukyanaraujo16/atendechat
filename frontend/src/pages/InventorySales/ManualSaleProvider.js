import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useHistory } from "react-router-dom";

import SaleDrawer from "./SaleDrawer";

const ManualSaleContext = createContext(null);

/**
 * Drawer compartilhado para consultar/editar vendas existentes.
 * Nova venda manual vai para o wizard em /inventory-sales/new.
 */
export function ManualSaleProvider({ children }) {
  const history = useHistory();
  const [open, setOpen] = useState(false);
  const [saleId, setSaleId] = useState(null);
  const listenersRef = useRef(new Set());

  const subscribe = useCallback((listener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const notify = useCallback(() => {
    listenersRef.current.forEach((listener) => listener());
  }, []);

  const openSale = useCallback((id) => {
    setSaleId(id);
    setOpen(true);
  }, []);

  const startManualSale = useCallback(() => {
    history.push("/inventory-sales/new");
  }, [history]);

  const closeSale = useCallback(() => {
    setOpen(false);
    setSaleId(null);
  }, []);

  const value = useMemo(
    () => ({
      startManualSale,
      openSale,
      creating: false,
      subscribe,
    }),
    [startManualSale, openSale, subscribe]
  );

  return (
    <ManualSaleContext.Provider value={value}>
      {children}
      <SaleDrawer
        open={open}
        saleId={saleId}
        onClose={closeSale}
        onChanged={notify}
      />
    </ManualSaleContext.Provider>
  );
}

export function useManualSale() {
  const ctx = useContext(ManualSaleContext);
  if (!ctx) {
    throw new Error("useManualSale must be used within ManualSaleProvider");
  }
  return ctx;
}
