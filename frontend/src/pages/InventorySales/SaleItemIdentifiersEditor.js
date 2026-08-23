import React from "react";
import {
  Box,
  IconButton,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import CloseIcon from "@material-ui/icons/Close";

import { AppSecondaryButton } from "../../ui";
import { i18n } from "../../translate/i18n";
import {
  IDENTIFIER_MAX_LEN,
  isFractionalIdentifierResolution,
  isWholeQuantity,
  nextAvailablePosition,
  usesInlineIdentifierSlots,
  visibleIdentifierPositions,
  wholeQuantityValue,
} from "./saleItemIdentifiers";

const useStyles = makeStyles((theme) => ({
  root: {
    minWidth: 0,
    width: "100%",
    maxWidth: "100%",
  },
  title: {
    fontWeight: 600,
    display: "block",
  },
  hint: {
    display: "block",
    marginTop: theme.spacing(0.25),
    marginBottom: theme.spacing(1),
  },
  integerHint: {
    display: "block",
    marginTop: theme.spacing(0.5),
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
    maxHeight: 240,
    overflowY: "auto",
    minWidth: 0,
    width: "100%",
    maxWidth: "100%",
  },
  row: {
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1),
    minWidth: 0,
    width: "100%",
    maxWidth: "100%",
  },
  field: {
    flex: 1,
    minWidth: 0,
    width: "100%",
    maxWidth: "100%",
  },
  overflowing: {
    marginTop: 2,
  },
  resolution: {
    display: "block",
    marginTop: theme.spacing(0.25),
    marginBottom: theme.spacing(1),
    color: theme.palette.error.main,
  },
}));

export default function SaleItemIdentifiersEditor({
  quantity,
  values = {},
  extraPositions = [],
  onChange,
  itemId,
}) {
  const classes = useStyles();
  const whole = isWholeQuantity(quantity);
  const qty = wholeQuantityValue(quantity);
  const inline = usesInlineIdentifierSlots(quantity);
  const positions = visibleIdentifierPositions({
    quantity,
    values,
    extraPositions,
  });

  const emitChange = (next) => {
    if (onChange) {
      onChange({
        identifierValues: next.identifierValues != null ? next.identifierValues : values,
        extraPositions:
          next.extraPositions != null ? next.extraPositions : extraPositions,
        identifiersTouched: true,
      });
    }
  };

  const handleValueChange = (position, identifier) => {
    emitChange({
      identifierValues: {
        ...values,
        [position]: identifier,
      },
    });
  };

  const handleAdd = () => {
    const occupied = visibleIdentifierPositions({
      quantity,
      values,
      extraPositions,
    });
    const position = nextAvailablePosition(quantity, occupied);
    if (position == null) return;
    emitChange({
      extraPositions: [...extraPositions, position],
      identifierValues: {
        ...values,
        [position]: values[position] || "",
      },
    });
  };

  const handleRemove = (position) => {
    const nextValues = { ...values };
    delete nextValues[position];
    emitChange({
      identifierValues: nextValues,
      extraPositions: extraPositions.filter((p) => Number(p) !== Number(position)),
    });
  };

  const handleRemoveAll = () => {
    emitChange({
      identifierValues: {},
      extraPositions: [],
    });
  };

  const n = Number(quantity);
  const resolutionMode = isFractionalIdentifierResolution(quantity, values);

  if (!whole && !resolutionMode) {
    if (!Number.isFinite(n) || n <= 0) return null;
    return (
      <Typography
        variant="caption"
        color="textSecondary"
        className={classes.integerHint}
        data-testid={
          itemId != null
            ? `sale-item-identifiers-fractional-${itemId}`
            : "sale-item-identifiers-fractional"
        }
      >
        {i18n.t("inventorySales.sales.items.identifiers.integerOnly")}
      </Typography>
    );
  }

  const canAdd =
    !resolutionMode &&
    !inline &&
    nextAvailablePosition(quantity, positions) != null;
  const showUnitLabel =
    resolutionMode || qty > 1 || positions.some((position) => position > 1);
  const hint = i18n.t("inventorySales.sales.items.identifiers.hint");

  return (
    <Box
      className={classes.root}
      data-testid={
        itemId != null
          ? `sale-item-identifiers-${itemId}`
          : "sale-item-identifiers-add"
      }
    >
      <Typography
        variant="caption"
        className={classes.title}
        data-testid={
          itemId != null
            ? `sale-item-identifiers-title-${itemId}`
            : "sale-item-identifiers-title-add"
        }
      >
        {i18n.t("inventorySales.sales.items.identifiers.title")}
      </Typography>

      {resolutionMode ? (
        <Typography
          variant="caption"
          className={classes.resolution}
          data-testid={
            itemId != null
              ? `sale-item-identifiers-fractional-resolve-${itemId}`
              : "sale-item-identifiers-fractional-resolve"
          }
        >
          {i18n.t("inventorySales.sales.items.identifiers.fractionalNeedsClear")}
        </Typography>
      ) : (
        <Typography variant="caption" color="textSecondary" className={classes.hint}>
          {hint}
        </Typography>
      )}
      <Box className={classes.list}>
        {positions.map((position) => {
          const overflowing = !resolutionMode && position > qty;
          return (
            <Box key={position} className={classes.row}>
              <TextField
                size="small"
                variant="outlined"
                className={classes.field}
                id={
                  itemId != null
                    ? `sale-item-identifier-field-${itemId}-${position}`
                    : `sale-item-identifier-field-add-${position}`
                }
                label={
                  showUnitLabel
                    ? i18n.t("inventorySales.sales.items.identifiers.unitLabel", {
                        position,
                      })
                    : undefined
                }
                placeholder={showUnitLabel ? undefined : hint}
                value={values[position] == null ? "" : String(values[position])}
                onChange={(e) => handleValueChange(position, e.target.value)}
                inputProps={{
                  maxLength: IDENTIFIER_MAX_LEN,
                  "data-testid":
                    itemId != null
                      ? `sale-item-identifier-input-${itemId}-${position}`
                      : `sale-item-identifier-input-add-${position}`,
                }}
                error={overflowing}
                helperText={
                  overflowing
                    ? i18n.t("inventorySales.sales.items.identifiers.reduceQuantity", {
                        position,
                      })
                    : undefined
                }
                FormHelperTextProps={{
                  className: overflowing ? classes.overflowing : undefined,
                }}
                fullWidth
              />
              {!inline || overflowing || resolutionMode ? (
                <IconButton
                  size="small"
                  onClick={() => handleRemove(position)}
                  aria-label={i18n.t(
                    "inventorySales.sales.items.identifiers.remove"
                  )}
                  data-testid={
                    itemId != null
                      ? `sale-item-identifier-remove-${itemId}-${position}`
                      : `sale-item-identifier-remove-add-${position}`
                  }
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              ) : null}
            </Box>
          );
        })}
      </Box>
      {canAdd ? (
        <Box mt={1}>
          <AppSecondaryButton
            size="small"
            onClick={handleAdd}
            data-testid={
              itemId != null
                ? `sale-item-identifier-add-${itemId}`
                : "sale-item-identifier-add-new"
            }
          >
            {i18n.t("inventorySales.sales.items.identifiers.add")}
          </AppSecondaryButton>
        </Box>
      ) : null}
      {resolutionMode ? (
        <Box mt={1}>
          <AppSecondaryButton
            size="small"
            onClick={handleRemoveAll}
            data-testid={
              itemId != null
                ? `sale-item-identifier-remove-all-${itemId}`
                : "sale-item-identifier-remove-all-add"
            }
          >
            {i18n.t("inventorySales.sales.items.identifiers.removeAll")}
          </AppSecondaryButton>
        </Box>
      ) : null}
    </Box>
  );
}
