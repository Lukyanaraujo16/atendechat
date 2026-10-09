import React, { useState } from "react";
import {
  Box,
  Checkbox,
  Chip,
  Collapse,
  FormControlLabel,
  Grid,
  IconButton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
} from "@material-ui/core";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import AddIcon from "@material-ui/icons/Add";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import ExpandLessIcon from "@material-ui/icons/ExpandLess";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";

import { AppSecondaryButton, AppTableContainer } from "../../ui";
import { i18n } from "../../translate/i18n";
import {
  MAX_AUTO_VARIANT_COMBINATIONS,
  combinationKey,
  mergeCombinationPreview,
} from "./productVariantCombinations";

const useStyles = makeStyles((theme) => ({
  section: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
  },
  charCard: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    padding: theme.spacing(1.5),
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.75),
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  optionRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "center",
  },
  applyRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "center",
    marginBottom: theme.spacing(1),
  },
  mobileCard: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
  },
  comboList: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(0.5),
    maxHeight: 180,
    overflowY: "auto",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    padding: theme.spacing(1),
  },
  tableInput: {
    minWidth: 96,
  },
}));

export function newCharacteristic() {
  return {
    localId: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    options: [],
    optionDraft: "",
  };
}

function normalizeChars(characteristics) {
  return (characteristics || [])
    .map((c) => ({
      name: String(c.name || "").trim(),
      options: (c.options || []).map((o) => String(o).trim()).filter(Boolean),
    }))
    .filter((c) => c.name && c.options.length);
}

function rebuildDrafts(characteristics, drafts) {
  const chars = normalizeChars(characteristics);
  if (!chars.length) {
    return {
      drafts: (drafts || []).filter((d) => d.persisted || d.id),
      truncated: false,
      totalPossible: 0,
    };
  }
  return mergeCombinationPreview(chars, drafts || []);
}

export default function ProductVariantsEditor({
  value,
  onChange,
  disabled = false,
  isEdit = false,
}) {
  const classes = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const characteristics = value?.characteristics?.length
    ? value.characteristics
    : [newCharacteristic()];
  const drafts = value?.drafts || [];
  const [bulkSalePrice, setBulkSalePrice] = useState("");
  const [expandedKeys, setExpandedKeys] = useState({});

  const emit = (nextCharacteristics, nextDrafts, meta = {}) => {
    onChange({
      characteristics: nextCharacteristics,
      drafts: nextDrafts,
      truncated: meta.truncated ?? false,
      totalPossible: meta.totalPossible ?? 0,
    });
  };

  const emitWithRebuild = (nextCharacteristics, keepDrafts = drafts) => {
    const rebuilt = rebuildDrafts(nextCharacteristics, keepDrafts);
    emit(nextCharacteristics, rebuilt.drafts, rebuilt);
  };

  const updateCharacteristic = (localId, patch, rebuild = false) => {
    const next = characteristics.map((c) =>
      c.localId === localId ? { ...c, ...patch } : c
    );
    if (rebuild) emitWithRebuild(next);
    else emit(next, drafts, value);
  };

  const addOption = (localId) => {
    const char = characteristics.find((c) => c.localId === localId);
    if (!char) return;
    const valueText = String(char.optionDraft || "").trim();
    if (!valueText) return;
    const exists = (char.options || []).some(
      (o) => String(o).toLowerCase() === valueText.toLowerCase()
    );
    if (exists) {
      updateCharacteristic(localId, { optionDraft: "" }, false);
      return;
    }
    updateCharacteristic(
      localId,
      {
        options: [...(char.options || []), valueText],
        optionDraft: "",
      },
      true
    );
  };

  const removeOption = (localId, optionValue) => {
    const char = characteristics.find((c) => c.localId === localId);
    if (!char) return;
    updateCharacteristic(
      localId,
      {
        options: (char.options || []).filter((o) => o !== optionValue),
      },
      true
    );
  };

  const updateDraft = (localKey, patch) => {
    emit(
      characteristics,
      drafts.map((d) =>
        (d.localKey || combinationKey(d.options)) === localKey
          ? { ...d, ...patch }
          : d
      ),
      value
    );
  };

  const selectedDrafts = drafts.filter((d) => d.selected !== false);

  const applySalePriceToAll = () => {
    const price = String(bulkSalePrice || "").trim();
    if (!price) return;
    emit(
      characteristics,
      drafts.map((d) =>
        d.selected === false ? d : { ...d, salePrice: price }
      ),
      value
    );
  };

  return (
    <Box className={classes.section}>
      <Box>
        <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
          {i18n.t("inventorySales.products.variants.howItVaries")}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {i18n.t("inventorySales.products.variants.howItVariesHelp")}
        </Typography>
      </Box>

      {characteristics.map((char, index) => (
        <Box key={char.localId} className={classes.charCard}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography
              variant="caption"
              color="textSecondary"
              style={{ fontWeight: 600 }}
            >
              {i18n.t("inventorySales.products.variants.characteristicLabel", {
                index: index + 1,
              })}
            </Typography>
            {characteristics.length > 1 ? (
              <IconButton
                size="small"
                type="button"
                disabled={disabled}
                aria-label={i18n.t(
                  "inventorySales.products.variants.removeCharacteristic"
                )}
                onClick={() =>
                  emitWithRebuild(
                    characteristics.filter((c) => c.localId !== char.localId)
                  )
                }
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            ) : null}
          </Box>
          <TextField
            id={`product-characteristic-name-${char.localId}`}
            size="small"
            variant="outlined"
            fullWidth
            label={i18n.t("inventorySales.products.variants.characteristicName")}
            placeholder={i18n.t(
              "inventorySales.products.variants.characteristicNamePlaceholder"
            )}
            value={char.name}
            onChange={(e) =>
              updateCharacteristic(char.localId, { name: e.target.value }, false)
            }
            onBlur={() => emitWithRebuild(characteristics)}
            disabled={disabled}
            margin="dense"
            InputLabelProps={{ shrink: true }}
            helperText={
              index === 0
                ? i18n.t(
                    "inventorySales.products.variants.characteristicNameHelp"
                  )
                : undefined
            }
          />
          <Typography variant="caption" color="textSecondary">
            {i18n.t("inventorySales.products.variants.optionsLabel")}
          </Typography>
          <Box className={classes.chips}>
            {(char.options || []).map((opt) => (
              <Chip
                key={opt}
                size="small"
                label={opt}
                onDelete={
                  disabled ? undefined : () => removeOption(char.localId, opt)
                }
              />
            ))}
            {!char.options?.length ? (
              <Typography variant="body2" color="textSecondary">
                {i18n.t("inventorySales.products.variants.optionsEmpty")}
              </Typography>
            ) : null}
          </Box>
          <Box className={classes.optionRow}>
            <TextField
              id={`product-characteristic-option-${char.localId}`}
              size="small"
              variant="outlined"
              label={i18n.t("inventorySales.products.variants.addOptionLabel")}
              placeholder={i18n.t(
                "inventorySales.products.variants.addOptionPlaceholder"
              )}
              value={char.optionDraft || ""}
              onChange={(e) =>
                updateCharacteristic(
                  char.localId,
                  { optionDraft: e.target.value },
                  false
                )
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addOption(char.localId);
                }
              }}
              disabled={disabled}
              InputLabelProps={{ shrink: true }}
            />
            <AppSecondaryButton
              type="button"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => addOption(char.localId)}
              disabled={disabled}
            >
              {i18n.t("inventorySales.products.variants.addOption")}
            </AppSecondaryButton>
          </Box>
        </Box>
      ))}

      <AppSecondaryButton
        type="button"
        size="small"
        startIcon={<AddIcon />}
        disabled={disabled || characteristics.length >= 6}
        onClick={() =>
          emit([...characteristics, newCharacteristic()], drafts, value)
        }
      >
        {i18n.t("inventorySales.products.variants.addCharacteristic")}
      </AppSecondaryButton>

      {drafts.length > 0 ? (
        <Box>
          <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
            {i18n.t("inventorySales.products.variants.combinationsTitle")}
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            {i18n.t("inventorySales.products.variants.combinationsHelp")}
          </Typography>
          {value?.truncated ? (
            <Typography variant="body2" color="error" paragraph>
              {i18n.t("inventorySales.products.variants.combinationsLimit", {
                max: MAX_AUTO_VARIANT_COMBINATIONS,
                total: value?.totalPossible || drafts.length,
              })}
            </Typography>
          ) : null}
          <Box className={classes.comboList}>
            {drafts.map((draft) => {
              const key = draft.localKey || combinationKey(draft.options);
              return (
                <FormControlLabel
                  key={key}
                  control={
                    <Checkbox
                      color="primary"
                      size="small"
                      checked={draft.selected !== false}
                      disabled={disabled}
                      onChange={(e) => {
                        if (draft.persisted && !e.target.checked) {
                          updateDraft(key, {
                            selected: false,
                            active: false,
                          });
                          return;
                        }
                        updateDraft(key, {
                          selected: e.target.checked,
                          active: e.target.checked
                            ? draft.active !== false
                            : false,
                        });
                      }}
                    />
                  }
                  label={draft.label || key}
                />
              );
            })}
          </Box>
        </Box>
      ) : null}

      {selectedDrafts.length > 0 ? (
        <Box>
          <Typography
            variant="subtitle2"
            style={{ fontWeight: 600 }}
            gutterBottom
          >
            {i18n.t("inventorySales.products.variants.pricesTitle")}
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            {i18n.t("inventorySales.products.variants.pricesHelp")}
          </Typography>

          <Box className={classes.applyRow}>
            <TextField
              size="small"
              variant="outlined"
              label={i18n.t("inventorySales.products.variants.applySalePrice")}
              value={bulkSalePrice}
              onChange={(e) => setBulkSalePrice(e.target.value)}
              disabled={disabled}
              className={classes.tableInput}
            />
            <AppSecondaryButton
              type="button"
              size="small"
              onClick={applySalePriceToAll}
              disabled={disabled || !String(bulkSalePrice).trim()}
            >
              {i18n.t("inventorySales.products.variants.applySalePriceAction")}
            </AppSecondaryButton>
          </Box>

          {isMobile
            ? selectedDrafts.map((draft) => {
                const key = draft.localKey || combinationKey(draft.options);
                const open = Boolean(expandedKeys[key]);
                return (
                  <Box key={key} className={classes.mobileCard}>
                    <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
                      {i18n.t("inventorySales.products.variants.variationLabel", {
                        label: draft.label,
                      })}
                    </Typography>
                    <Grid container spacing={1}>
                      <Grid item xs={12}>
                        <TextField
                          size="small"
                          variant="outlined"
                          fullWidth
                          required
                          label={i18n.t(
                            "inventorySales.products.fields.salePrice"
                          )}
                          value={draft.salePrice}
                          onChange={(e) =>
                            updateDraft(key, { salePrice: e.target.value })
                          }
                          disabled={disabled}
                          inputProps={{ inputMode: "decimal" }}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          size="small"
                          variant="outlined"
                          fullWidth
                          label={i18n.t(
                            "inventorySales.products.fields.costPrice"
                          )}
                          value={draft.costPrice}
                          onChange={(e) =>
                            updateDraft(key, { costPrice: e.target.value })
                          }
                          disabled={disabled}
                          inputProps={{ inputMode: "decimal" }}
                        />
                      </Grid>
                      {!isEdit || !draft.persisted ? (
                        <Grid item xs={12}>
                          <TextField
                            size="small"
                            variant="outlined"
                            fullWidth
                            type="number"
                            label={i18n.t(
                              "inventorySales.products.fields.initialQuantity"
                            )}
                            value={draft.currentQuantity}
                            onChange={(e) =>
                              updateDraft(key, {
                                currentQuantity: e.target.value,
                              })
                            }
                            disabled={disabled || draft.trackStock === false}
                            inputProps={{
                              min: 0,
                              step: "any",
                              inputMode: "decimal",
                            }}
                          />
                        </Grid>
                      ) : (
                        <Grid item xs={12}>
                          <Typography variant="caption" color="textSecondary">
                            {i18n.t(
                              "inventorySales.products.variants.stockReadonly",
                              {
                                quantity: draft.currentQuantityDisplay || "0",
                              }
                            )}
                          </Typography>
                        </Grid>
                      )}
                    </Grid>
                    <Box mt={1}>
                      <AppSecondaryButton
                        type="button"
                        size="small"
                        endIcon={
                          open ? <ExpandLessIcon /> : <ExpandMoreIcon />
                        }
                        onClick={() =>
                          setExpandedKeys((prev) => ({
                            ...prev,
                            [key]: !open,
                          }))
                        }
                      >
                        {i18n.t("inventorySales.products.variants.moreDetails")}
                      </AppSecondaryButton>
                    </Box>
                    <Collapse in={open}>
                      <Grid container spacing={1} style={{ marginTop: 8 }}>
                        <Grid item xs={12}>
                          <TextField
                            size="small"
                            variant="outlined"
                            fullWidth
                            label={i18n.t("inventorySales.products.fields.sku")}
                            value={draft.sku}
                            onChange={(e) =>
                              updateDraft(key, { sku: e.target.value })
                            }
                            disabled={disabled}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            size="small"
                            variant="outlined"
                            fullWidth
                            label={i18n.t(
                              "inventorySales.products.fields.barcode"
                            )}
                            value={draft.barcode}
                            onChange={(e) =>
                              updateDraft(key, { barcode: e.target.value })
                            }
                            disabled={disabled}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            size="small"
                            variant="outlined"
                            fullWidth
                            type="number"
                            label={i18n.t(
                              "inventorySales.products.fields.minStock"
                            )}
                            value={draft.minStock}
                            onChange={(e) =>
                              updateDraft(key, { minStock: e.target.value })
                            }
                            disabled={disabled}
                            inputProps={{
                              min: 0,
                              step: "any",
                              inputMode: "decimal",
                            }}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <FormControlLabel
                            control={
                              <Switch
                                color="primary"
                                checked={draft.active !== false}
                                onChange={(e) =>
                                  updateDraft(key, {
                                    active: e.target.checked,
                                  })
                                }
                                disabled={disabled}
                              />
                            }
                            label={i18n.t(
                              "inventorySales.products.fields.active"
                            )}
                          />
                        </Grid>
                      </Grid>
                    </Collapse>
                  </Box>
                );
              })
            : (
              <AppTableContainer nested>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        {i18n.t(
                          "inventorySales.products.variants.columns.label"
                        )}
                      </TableCell>
                      <TableCell>
                        {i18n.t("inventorySales.products.fields.salePrice")}
                      </TableCell>
                      <TableCell>
                        {i18n.t("inventorySales.products.fields.costPrice")}
                      </TableCell>
                      <TableCell>
                        {isEdit
                          ? i18n.t("inventorySales.products.columns.stock")
                          : i18n.t(
                              "inventorySales.products.fields.initialQuantity"
                            )}
                      </TableCell>
                      <TableCell>
                        {i18n.t("inventorySales.products.fields.sku")}
                      </TableCell>
                      <TableCell>
                        {i18n.t("inventorySales.products.fields.barcode")}
                      </TableCell>
                      <TableCell>
                        {i18n.t("inventorySales.products.fields.minStock")}
                      </TableCell>
                      <TableCell>
                        {i18n.t("inventorySales.products.fields.active")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedDrafts.map((draft) => {
                      const key =
                        draft.localKey || combinationKey(draft.options);
                      return (
                        <TableRow key={key}>
                          <TableCell>{draft.label}</TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              variant="outlined"
                              required
                              value={draft.salePrice}
                              onChange={(e) =>
                                updateDraft(key, { salePrice: e.target.value })
                              }
                              disabled={disabled}
                              className={classes.tableInput}
                              inputProps={{ inputMode: "decimal" }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              variant="outlined"
                              value={draft.costPrice}
                              onChange={(e) =>
                                updateDraft(key, { costPrice: e.target.value })
                              }
                              disabled={disabled}
                              className={classes.tableInput}
                              inputProps={{ inputMode: "decimal" }}
                            />
                          </TableCell>
                          <TableCell>
                            {isEdit && draft.persisted ? (
                              <Typography variant="body2">
                                {draft.trackStock === false
                                  ? i18n.t(
                                      "inventorySales.products.noStockTracking"
                                    )
                                  : draft.currentQuantityDisplay || "0"}
                              </Typography>
                            ) : (
                              <TextField
                                size="small"
                                variant="outlined"
                                type="number"
                                value={draft.currentQuantity}
                                onChange={(e) =>
                                  updateDraft(key, {
                                    currentQuantity: e.target.value,
                                  })
                                }
                                disabled={
                                  disabled || draft.trackStock === false
                                }
                                className={classes.tableInput}
                                inputProps={{
                                  min: 0,
                                  step: "any",
                                  inputMode: "decimal",
                                }}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              variant="outlined"
                              value={draft.sku}
                              onChange={(e) =>
                                updateDraft(key, { sku: e.target.value })
                              }
                              disabled={disabled}
                              className={classes.tableInput}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              variant="outlined"
                              value={draft.barcode}
                              onChange={(e) =>
                                updateDraft(key, { barcode: e.target.value })
                              }
                              disabled={disabled}
                              className={classes.tableInput}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              variant="outlined"
                              type="number"
                              value={draft.minStock}
                              onChange={(e) =>
                                updateDraft(key, { minStock: e.target.value })
                              }
                              disabled={disabled}
                              className={classes.tableInput}
                              inputProps={{
                                min: 0,
                                step: "any",
                                inputMode: "decimal",
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Switch
                              color="primary"
                              size="small"
                              checked={draft.active !== false}
                              onChange={(e) =>
                                updateDraft(key, { active: e.target.checked })
                              }
                              disabled={disabled}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </AppTableContainer>
            )}
        </Box>
      ) : null}
    </Box>
  );
}
