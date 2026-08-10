import React from "react";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import CircularProgress from "@material-ui/core/CircularProgress";
import ShoppingCartOutlinedIcon from "@material-ui/icons/ShoppingCartOutlined";

import { i18n } from "../../translate/i18n";
import { useTicketInventorySales } from "./TicketInventorySalesProvider";

export default function TicketInventorySaleButton({
  disabled = false,
  renderTrigger,
}) {
  const ctx = useTicketInventorySales();

  if (!ctx?.enabled) {
    return null;
  }

  const { opening, handleSaleButtonClick } = ctx;
  const isDisabled = disabled || opening;
  const tooltipTitle = i18n.t("inventorySales.ticket.openSale");

  if (typeof renderTrigger === "function") {
    return renderTrigger(handleSaleButtonClick, isDisabled);
  }

  return (
    <Tooltip title={tooltipTitle}>
      <span>
        <IconButton
          size="small"
          onClick={handleSaleButtonClick}
          disabled={isDisabled}
          aria-label={tooltipTitle}
        >
          {opening ? (
            <CircularProgress size={18} />
          ) : (
            <ShoppingCartOutlinedIcon fontSize="small" />
          )}
        </IconButton>
      </span>
    </Tooltip>
  );
}
