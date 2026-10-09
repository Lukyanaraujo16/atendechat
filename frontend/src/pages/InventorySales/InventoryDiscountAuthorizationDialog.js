import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@material-ui/core";

import { AppPrimaryButton, AppSecondaryButton } from "../../ui";
import { i18n } from "../../translate/i18n";

export default function InventoryDiscountAuthorizationDialog({
  open,
  detailMessage,
  canAuthorize,
  confirming,
  onClose,
  onConfirm,
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={() => !confirming && onClose()}
      maxWidth="sm"
      fullWidth
      data-testid="inventory-discount-auth-dialog"
    >
      <DialogTitle>
        {i18n.t("inventorySales.sales.discountAuth.title")}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" paragraph>
          {i18n.t("inventorySales.sales.discountAuth.body")}
        </Typography>
        {detailMessage ? (
          <Typography variant="body2" paragraph data-testid="discount-auth-detail">
            {detailMessage}
          </Typography>
        ) : null}
        {!canAuthorize ? (
          <Typography variant="body2" color="error">
            {i18n.t("inventorySales.sales.discountAuth.noPermission")}
          </Typography>
        ) : (
          <TextField
            label={i18n.t("inventorySales.sales.discountAuth.reason")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            variant="outlined"
            size="small"
            fullWidth
            multiline
            rows={2}
            disabled={confirming}
            inputProps={{ "data-testid": "discount-auth-reason" }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <AppSecondaryButton onClick={onClose} disabled={confirming}>
          {i18n.t("inventorySales.common.cancel")}
        </AppSecondaryButton>
        {canAuthorize ? (
          <AppPrimaryButton
            onClick={() => onConfirm(reason)}
            disabled={confirming || !String(reason).trim()}
            data-testid="discount-auth-confirm"
          >
            {i18n.t("inventorySales.sales.discountAuth.confirm")}
          </AppPrimaryButton>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
