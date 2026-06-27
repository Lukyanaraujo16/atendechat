import React, { useCallback, useEffect, useState } from "react";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import Chip from "@material-ui/core/Chip";
import CircularProgress from "@material-ui/core/CircularProgress";
import Divider from "@material-ui/core/Divider";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import OpenInNewIcon from "@material-ui/icons/OpenInNew";
import { format } from "date-fns";

import { listInventorySales } from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { formatCurrencyBRL } from "../../utils/brazilianCurrency";
import {
  formatSaleNumber,
  getSaleDisplayDate,
} from "../../pages/InventorySales/utils";
import { useTicketInventorySales } from "./TicketInventorySalesProvider";

function statusChipColor(status) {
  if (status === "completed") return "primary";
  if (status === "cancelled") return "default";
  return "default";
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return format(new Date(value), "dd/MM/yyyy HH:mm");
  } catch {
    return "—";
  }
}

export default function TicketInventorySalesSection({ ticketId }) {
  const ctx = useTicketInventorySales();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!ticketId || !ctx?.canView) {
      setSales([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await listInventorySales({
        ticketId,
        limit: 20,
        page: 1,
      });
      setSales(Array.isArray(data?.sales) ? data.sales : []);
    } catch (err) {
      toastError(err);
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [ticketId, ctx?.enabled]);

  useEffect(() => {
    load();
  }, [load, ctx?.refreshKey]);

  if (!ctx?.canView) {
    return null;
  }

  const statusLabel = (status) =>
    i18n.t(`inventorySales.sales.status.${status}`, status);

  return (
    <Box>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={1}
      >
        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
          {i18n.t("inventorySales.ticket.sectionTitle")}
        </Typography>
        {ctx.canCreate ? (
          <Button
            size="small"
            color="primary"
            onClick={ctx.createNewSale}
            disabled={ctx.opening}
          >
            {i18n.t("inventorySales.ticket.newSale")}
          </Button>
        ) : null}
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={2}>
          <CircularProgress size={22} />
        </Box>
      ) : sales.length === 0 ? (
        <Typography variant="body2" color="textSecondary">
          {i18n.t("inventorySales.ticket.noSales")}
        </Typography>
      ) : (
        <Box display="flex" flexDirection="column" style={{ gap: 8 }}>
          {sales.map((sale, index) => (
            <React.Fragment key={sale.id}>
              {index > 0 ? <Divider /> : null}
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                style={{ gap: 8 }}
              >
                <Box minWidth={0} flex={1}>
                  <Box display="flex" alignItems="center" style={{ gap: 6 }}>
                    <Typography variant="body2" style={{ fontWeight: 600 }}>
                      {formatSaleNumber(sale)}
                    </Typography>
                    <Chip
                      size="small"
                      color={statusChipColor(sale.status)}
                      label={statusLabel(sale.status)}
                    />
                  </Box>
                  <Typography variant="caption" color="textSecondary">
                    {formatCurrencyBRL(sale.totalAmount)} ·{" "}
                    {formatDate(getSaleDisplayDate(sale))}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => ctx.openSale(sale.id)}
                  aria-label={i18n.t("inventorySales.ticket.openSale")}
                >
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Box>
            </React.Fragment>
          ))}
        </Box>
      )}
    </Box>
  );
}
