import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";

import { createInventorySale } from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import SaleDrawer from "./SaleDrawer";

const ManualSaleContext = createContext(null);

/**
 * Um único drawer de venda manual, compartilhado por Resumo e Vendas.
 * A criação continua sendo POST /inventory/sales { source: "manual" }.
 */
export function ManualSaleProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [saleId, setSaleId] = useState(null);
  const [creating, setCreating] = useState(false);
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

  const startManualSale = useCallback(async () => {
    setCreating(true);
    try {
      const { data } = await createInventorySale({ source: "manual" });
      toast.success(i18n.t("inventorySales.sales.toasts.created"));
      setSaleId(data.id);
      setOpen(true);
      notify();
      return data;
    } catch (err) {
      toastError(err);
      return null;
    } finally {
      setCreating(false);
    }
  }, [notify]);

  const closeSale = useCallback(() => {
    setOpen(false);
    setSaleId(null);
  }, []);

  const value = useMemo(
    () => ({
      startManualSale,
      openSale,
      creating,
      subscribe,
    }),
    [startManualSale, openSale, creating, subscribe]
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
