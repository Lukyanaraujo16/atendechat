import React from "react";
import { Box, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import { i18n } from "../../translate/i18n";
import { identifiersFromSaleItem } from "./saleItemIdentifiers";

const useStyles = makeStyles((theme) => ({
  root: {
    minWidth: 0,
    maxWidth: "100%",
  },
  title: {
    fontWeight: 600,
    display: "block",
    marginBottom: theme.spacing(0.5),
  },
  row: {
    display: "block",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    minWidth: 0,
  },
}));

export default function SaleItemIdentifiersList({
  item,
  values,
  variant = "default",
  testId,
}) {
  const classes = useStyles();
  const filled = values
    ? Object.keys(values)
        .map(Number)
        .filter((position) => String(values[position] || "").trim())
        .sort((a, b) => a - b)
        .map((position) => ({
          position,
          identifier: String(values[position]).trim(),
        }))
    : identifiersFromSaleItem(item);

  if (!filled.length) return null;

  const isReceipt = variant === "receipt";
  const resolvedTestId =
    testId ||
    (item?.id != null
      ? isReceipt
        ? `sale-receipt-item-identifiers-${item.id}`
        : `sale-item-identifiers-readonly-${item.id}`
      : "sale-item-identifiers-readonly");

  return (
    <Box className={classes.root} data-testid={resolvedTestId}>
      <Typography
        variant="caption"
        color="textSecondary"
        className={classes.title}
      >
        {i18n.t("inventorySales.sales.items.identifiers.listTitle")}
      </Typography>
      {filled.map((row) => (
        <Typography
          key={row.position}
          variant="caption"
          component="div"
          className={classes.row}
          data-testid={
            item?.id != null
              ? `sale-item-identifier-value-${item.id}-${row.position}`
              : undefined
          }
        >
          {isReceipt
            ? `- ${row.identifier}`
            : `${row.position}. ${row.identifier}`}
        </Typography>
      ))}
    </Box>
  );
}
