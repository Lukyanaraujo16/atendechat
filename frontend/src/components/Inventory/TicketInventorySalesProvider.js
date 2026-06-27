import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { toast } from "react-toastify";

import { AuthContext } from "../../context/Auth/AuthContext";
import usePlanFlags from "../../hooks/usePlanFlags";
import { canUseInventorySales } from "../../utils/canUseInventorySales";
import {
  createInventorySale,
  listInventorySales,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import SaleDrawer from "../../pages/InventorySales/SaleDrawer";
import TicketInventorySalesChoiceDialog from "./TicketInventorySalesChoiceDialog";

const TicketInventorySalesContext = createContext(null);

export function useTicketInventorySales() {
  return useContext(TicketInventorySalesContext);
}

export function TicketInventorySalesProvider({ ticket, children }) {
  const { user } = useContext(AuthContext);
  const planFlags = usePlanFlags();

  const enabled = useMemo(() => {
    if (!planFlags.loaded) return false;
    if (!canUseInventorySales(planFlags)) return false;
    if (!ticket?.id || !ticket?.contactId) return false;
    return true;
  }, [planFlags.loaded, planFlags, ticket?.id, ticket?.contactId]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saleId, setSaleId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [ticketSales, setTicketSales] = useState([]);
  const [opening, setOpening] = useState(false);

  const ticketLink = useMemo(() => {
    if (!enabled) return null;
    return {
      ticketId: ticket.id,
      contactId: ticket.contactId,
      contactName: ticket.contact?.name || "",
    };
  }, [enabled, ticket?.id, ticket?.contactId, ticket?.contact?.name]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const openSale = useCallback((id) => {
    setSaleId(id);
    setDrawerOpen(true);
    setChoiceOpen(false);
  }, []);

  const createNewSale = useCallback(async () => {
    if (!enabled || !ticketLink) return;
    setOpening(true);
    try {
      const sellerUserId =
        user?.id != null && Number.isFinite(Number(user.id))
          ? Number(user.id)
          : undefined;
      const { data } = await createInventorySale({
        source: "ticket",
        ticketId: ticketLink.ticketId,
        contactId: ticketLink.contactId,
        sellerUserId,
      });
      toast.success(i18n.t("inventorySales.ticket.toasts.created"));
      openSale(data.id);
      refresh();
    } catch (err) {
      toastError(err);
    } finally {
      setOpening(false);
    }
  }, [enabled, ticketLink, user?.id, openSale, refresh]);

  const handleSaleButtonClick = useCallback(async () => {
    if (!enabled || !ticket?.id) return;
    setOpening(true);
    try {
      const { data } = await listInventorySales({
        ticketId: ticket.id,
        limit: 50,
        page: 1,
      });
      const sales = Array.isArray(data?.sales) ? data.sales : [];
      if (sales.length === 0) {
        await createNewSale();
        return;
      }
      setTicketSales(sales);
      setChoiceOpen(true);
    } catch (err) {
      toastError(err);
    } finally {
      setOpening(false);
    }
  }, [enabled, ticket?.id, createNewSale]);

  const value = useMemo(
    () => ({
      enabled,
      opening,
      refreshKey,
      refresh,
      openSale,
      createNewSale,
      handleSaleButtonClick,
    }),
    [
      enabled,
      opening,
      refreshKey,
      refresh,
      openSale,
      createNewSale,
      handleSaleButtonClick,
    ]
  );

  return (
    <TicketInventorySalesContext.Provider value={value}>
      {children}
      {enabled ? (
        <>
          <SaleDrawer
            open={drawerOpen}
            saleId={saleId}
            ticketLink={ticketLink}
            onClose={() => {
              setDrawerOpen(false);
              setSaleId(null);
            }}
            onChanged={refresh}
          />
          <TicketInventorySalesChoiceDialog
            open={choiceOpen}
            onClose={() => setChoiceOpen(false)}
            sales={ticketSales}
            onSelectSale={openSale}
            onCreateNew={createNewSale}
          />
        </>
      ) : null}
    </TicketInventorySalesContext.Provider>
  );
}
