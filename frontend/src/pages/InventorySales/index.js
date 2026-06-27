import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Paper, Tab } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import MainContainer from "../../components/MainContainer";
import TabPanel from "../../components/TabPanel";
import { AppPageHeader, AppTabs, AppEmptyState } from "../../ui";
import { i18n } from "../../translate/i18n";
import { useInventoryPermissions } from "../../utils/inventoryAccess";
import { INVENTORY_TABS } from "./constants";
import InventorySummaryTab from "./InventorySummaryTab";
import InventoryProductsTab from "./InventoryProductsTab";
import InventoryCategoriesTab from "./InventoryCategoriesTab";
import InventoryStockTab from "./InventoryStockTab";
import InventorySalesTab from "./InventorySalesTab";
import InventoryReportsTab from "./InventoryReportsTab";
import InventorySettingsTab from "./InventorySettingsTab";

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    maxWidth: "100%",
    overflowX: "hidden",
  },
  tabsPaper: {
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    overflow: "hidden",
  },
  tabContent: {
    paddingTop: theme.spacing(1),
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    maxWidth: "100%",
    overflowX: "hidden",
  },
}));

const InventorySales = () => {
  const classes = useStyles();
  const perms = useInventoryPermissions();
  const [tab, setTab] = useState(INVENTORY_TABS.SUMMARY);
  const [autoOpenProductForm, setAutoOpenProductForm] = useState(false);
  const [autoOpenStockForm, setAutoOpenStockForm] = useState(false);
  const [stockProductFilter, setStockProductFilter] = useState("");

  const tabDefs = useMemo(
    () =>
      [
        {
          value: INVENTORY_TABS.SUMMARY,
          label: i18n.t("inventorySales.tabs.summary"),
          show: perms.canView,
        },
        {
          value: INVENTORY_TABS.PRODUCTS,
          label: i18n.t("inventorySales.tabs.products"),
          show: perms.canView,
        },
        {
          value: INVENTORY_TABS.CATEGORIES,
          label: i18n.t("inventorySales.tabs.categories"),
          show: perms.canView,
        },
        {
          value: INVENTORY_TABS.STOCK,
          label: i18n.t("inventorySales.tabs.stock"),
          show: perms.canView,
        },
        {
          value: INVENTORY_TABS.SALES,
          label: i18n.t("inventorySales.tabs.sales"),
          show: perms.canView,
        },
        {
          value: INVENTORY_TABS.REPORTS,
          label: i18n.t("inventorySales.tabs.reports"),
          show: perms.canViewReports,
        },
        {
          value: INVENTORY_TABS.SETTINGS,
          label: i18n.t("inventorySales.tabs.settings"),
          show: perms.canManageSettings,
        },
      ].filter((item) => item.show),
    [perms]
  );

  useEffect(() => {
    if (!tabDefs.length) return;
    if (!tabDefs.some((item) => item.value === tab)) {
      setTab(tabDefs[0].value);
    }
  }, [tab, tabDefs]);

  const handleTabChange = (_e, value) => {
    setTab(value);
  };

  const goToProducts = useCallback(() => {
    setTab(INVENTORY_TABS.PRODUCTS);
    if (perms.canManageProducts) {
      setAutoOpenProductForm(true);
    }
  }, [perms.canManageProducts]);

  const goToStockMovement = useCallback(() => {
    setTab(INVENTORY_TABS.STOCK);
    if (perms.canManageStock) {
      setAutoOpenStockForm(true);
    }
  }, [perms.canManageStock]);

  const viewStockHistory = useCallback((productId) => {
    setStockProductFilter(String(productId));
    setTab(INVENTORY_TABS.STOCK);
  }, []);

  return (
    <MainContainer>
      <div className={classes.pageRoot}>
        <AppPageHeader
          title={i18n.t("inventorySales.title")}
          subtitle={i18n.t("inventorySales.subtitle")}
        />

        {tabDefs.length > 0 ? (
          <Paper className={classes.tabsPaper} elevation={0}>
            <AppTabs
              value={tab}
              onChange={handleTabChange}
              indicatorColor="primary"
              textColor="primary"
              variant="scrollable"
              scrollButtons="auto"
            >
              {tabDefs.map((item) => (
                <Tab key={item.value} label={item.label} value={item.value} />
              ))}
            </AppTabs>
          </Paper>
        ) : (
          <AppEmptyState
            title={i18n.t("inventorySales.permissions.noTabAccessTitle")}
            description={i18n.t("inventorySales.permissions.noTabAccessDescription")}
          />
        )}

        <Box className={classes.tabContent}>
          {perms.canView ? (
            <TabPanel value={tab} name={INVENTORY_TABS.SUMMARY}>
              <InventorySummaryTab
                onNavigateTab={setTab}
                onNewProduct={goToProducts}
                onNewMovement={goToStockMovement}
              />
            </TabPanel>
          ) : null}
          {perms.canView ? (
            <TabPanel value={tab} name={INVENTORY_TABS.PRODUCTS}>
              <InventoryProductsTab
                autoOpenCreate={autoOpenProductForm}
                onAutoOpenConsumed={() => setAutoOpenProductForm(false)}
                onViewStockHistory={viewStockHistory}
              />
            </TabPanel>
          ) : null}
          {perms.canView ? (
            <TabPanel value={tab} name={INVENTORY_TABS.CATEGORIES}>
              <InventoryCategoriesTab />
            </TabPanel>
          ) : null}
          {perms.canView ? (
            <TabPanel value={tab} name={INVENTORY_TABS.STOCK}>
              <InventoryStockTab
                productFilter={stockProductFilter}
                autoOpenCreate={autoOpenStockForm}
                onAutoOpenConsumed={() => setAutoOpenStockForm(false)}
              />
            </TabPanel>
          ) : null}
          {perms.canView ? (
            <TabPanel value={tab} name={INVENTORY_TABS.SALES}>
              <InventorySalesTab />
            </TabPanel>
          ) : null}
          {perms.canViewReports ? (
            <TabPanel value={tab} name={INVENTORY_TABS.REPORTS}>
              <InventoryReportsTab />
            </TabPanel>
          ) : null}
          {perms.canManageSettings ? (
            <TabPanel value={tab} name={INVENTORY_TABS.SETTINGS}>
              <InventorySettingsTab />
            </TabPanel>
          ) : null}
        </Box>
      </div>
    </MainContainer>
  );
};

export default InventorySales;
