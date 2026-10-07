import React, { useContext, useEffect, useState } from "react";
import { Box, CircularProgress, Typography } from "@material-ui/core";
import { useHistory } from "react-router-dom";

import MainContainer from "../../components/MainContainer";
import { AppEmptyState, AppSecondaryButton } from "../../ui";
import { AuthContext } from "../../context/Auth/AuthContext";
import { createInventorySale } from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { useInventoryPermissions } from "../../utils/inventoryAccess";

/** Sobrevive a remounts (StrictMode) no mesmo ciclo de navegação. */
let inFlightCreate = null;

/**
 * /inventory-sales/new — cria um draft uma vez e redireciona para o wizard.
 */
export default function NewSaleRedirectPage() {
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const perms = useInventoryPermissions();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!perms.loaded) return undefined;
    if (!perms.canCreateSale) {
      history.replace("/inventory-sales");
      return undefined;
    }

    let cancelled = false;

    (async () => {
      try {
        if (!inFlightCreate) {
          const body = { source: "manual" };
          if (user?.id != null && Number.isFinite(Number(user.id))) {
            body.sellerUserId = Number(user.id);
          }
          inFlightCreate = createInventorySale(body).then((res) => res.data);
        }
        const data = await inFlightCreate;
        inFlightCreate = null;
        if (cancelled) return;
        history.replace(`/inventory-sales/sales/${data.id}`);
      } catch (err) {
        inFlightCreate = null;
        if (cancelled) return;
        setError(true);
        toastError(err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [perms.loaded, perms.canCreateSale, user?.id, history]);

  if (error) {
    return (
      <MainContainer>
        <AppEmptyState title={i18n.t("inventorySales.sales.wizard.createError")}>
          <AppSecondaryButton
            onClick={() => {
              setError(false);
              inFlightCreate = null;
              history.replace("/inventory-sales/new");
            }}
          >
            {i18n.t("inventorySales.common.retry")}
          </AppSecondaryButton>
        </AppEmptyState>
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        py={8}
        data-testid="sale-wizard-creating"
      >
        <CircularProgress size={36} />
        <Typography variant="body2" color="textSecondary" style={{ marginTop: 16 }}>
          {i18n.t("inventorySales.sales.wizard.creating")}
        </Typography>
      </Box>
    </MainContainer>
  );
}
