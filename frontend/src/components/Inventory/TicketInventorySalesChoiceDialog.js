import React from "react";
import Button from "@material-ui/core/Button";
import Chip from "@material-ui/core/Chip";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";

import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
} from "../../ui";
import { i18n } from "../../translate/i18n";
import { formatCurrencyBRL } from "../../utils/brazilianCurrency";
import { formatSaleNumber } from "../../pages/InventorySales/utils";
import { format } from "date-fns";

function statusChipColor(status) {
  if (status === "completed") return "primary";
  if (status === "cancelled") return "default";
  return "default";
}

function formatDate(value) {
  if (!value) return "";
  try {
    return format(new Date(value), "dd/MM/yyyy HH:mm");
  } catch {
    return "";
  }
}

export default function TicketInventorySalesChoiceDialog({
  open,
  onClose,
  sales = [],
  onSelectSale,
  onCreateNew,
}) {
  const statusLabel = (status) =>
    i18n.t(`inventorySales.sales.status.${status}`, status);

  return (
    <AppDialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <AppDialogTitle>
        {i18n.t("inventorySales.ticket.existingSalesTitle")}
      </AppDialogTitle>
      <AppDialogContent>
        <Typography variant="body2" color="textSecondary" paragraph>
          {i18n.t("inventorySales.ticket.existingSalesHint")}
        </Typography>
        <List dense>
          {sales.map((sale) => (
            <ListItem button key={sale.id} onClick={() => onSelectSale(sale.id)}>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                    <span>{formatSaleNumber(sale)}</span>
                    <Chip
                      size="small"
                      color={statusChipColor(sale.status)}
                      label={statusLabel(sale.status)}
                    />
                  </Box>
                }
                secondary={`${formatCurrencyBRL(sale.totalAmount)} · ${formatDate(
                  sale.completedAt || sale.createdAt
                )}`}
              />
            </ListItem>
          ))}
        </List>
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={onClose} color="default">
          {i18n.t("inventorySales.common.cancel")}
        </Button>
        <Button onClick={onCreateNew} color="primary">
          {i18n.t("inventorySales.ticket.createNewAnyway")}
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
}
