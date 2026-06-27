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
import {
  canCreateInventorySale,
  canViewInventory,
} from "../../utils/inventoryAccess";
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

  const canView = useMemo(() => {
    if (!planFlags.loaded) return false;
    if (!canViewInventory(planFlags, user)) return false;
    if (!ticket?.id || !ticket?.contactId) return false;
    return true;
  }, [planFlags.loaded, planFlags, user, ticket?.id, ticket?.contactId]);

  const canCreate = useMemo(() => {
    if (!canView) return false;
    return canCreateInventorySale(planFlags, user);
  }, [canView, planFlags, user]);

  const enabled = canCreate;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saleId, setSaleId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [ticketSales, setTicketSales] = useState([]);
  const [opening, setOpening] = useState(false);

  const ticketLink = useMemo(() => {
    if (!canView) return null;
    return {
      ticketId: ticket.id,
      contactId: ticket.contactId,
      contactName: ticket.contact?.name || "",
    };
  }, [canView, ticket?.id, ticket?.contactId, ticket?.contact?.name]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const openSale = useCallback((id) => {
    setSaleId(id);
    setDrawerOpen(true);
    setChoiceOpen(false);
  }, []);

  const createNewSale = useCallback(async () => {
    if (!canCreate || !ticketLink) return;
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
  }, [canCreate, ticketLink, user?.id, openSale, refresh]);

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
      canView,
      canCreate,
      opening,
      refreshKey,
      refresh,
      openSale,
      createNewSale,
      handleSaleButtonClick,
    }),
    [
      enabled,
      canView,
      canCreate,
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
      {canView ? (
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
          {canCreate ? (
            <TicketInventorySalesChoiceDialog
              open={choiceOpen}
              onClose={() => setChoiceOpen(false)}
              sales={ticketSales}
              onSelectSale={openSale}
              onCreateNew={createNewSale}
            />
          ) : null}
        </>
      ) : null}
    </TicketInventorySalesContext.Provider>
  );
}
