import React, { useCallback, useState } from "react";
import { Box, Paper, Tab } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import MainContainer from "../../components/MainContainer";
import TabPanel from "../../components/TabPanel";
import { AppPageHeader, AppTabs } from "../../ui";
import { i18n } from "../../translate/i18n";
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
  const [tab, setTab] = useState(INVENTORY_TABS.SUMMARY);
  const [autoOpenProductForm, setAutoOpenProductForm] = useState(false);
  const [autoOpenStockForm, setAutoOpenStockForm] = useState(false);
  const [stockProductFilter, setStockProductFilter] = useState("");

  const handleTabChange = (_e, value) => {
    setTab(value);
  };

  const goToProducts = useCallback(() => {
    setTab(INVENTORY_TABS.PRODUCTS);
    setAutoOpenProductForm(true);
  }, []);

  const goToStockMovement = useCallback(() => {
    setTab(INVENTORY_TABS.STOCK);
    setAutoOpenStockForm(true);
  }, []);

  const viewStockHistory = useCallback((productId) => {
    setStockProductFilter(String(productId));
    setTab(INVENTORY_TABS.STOCK);
  }, []);

  const tabLabels = [
    i18n.t("inventorySales.tabs.summary"),
    i18n.t("inventorySales.tabs.products"),
    i18n.t("inventorySales.tabs.categories"),
    i18n.t("inventorySales.tabs.stock"),
    i18n.t("inventorySales.tabs.sales"),
    i18n.t("inventorySales.tabs.reports"),
    i18n.t("inventorySales.tabs.settings"),
  ];

  return (
    <MainContainer>
      <div className={classes.pageRoot}>
        <AppPageHeader
          title={i18n.t("inventorySales.title")}
          subtitle={i18n.t("inventorySales.subtitle")}
        />

        <Paper className={classes.tabsPaper} elevation={0}>
          <AppTabs
            value={tab}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="scrollable"
            scrollButtons="auto"
          >
            {tabLabels.map((label, index) => (
              <Tab key={label} label={label} value={index} />
            ))}
          </AppTabs>
        </Paper>

        <Box className={classes.tabContent}>
          <TabPanel value={tab} name={INVENTORY_TABS.SUMMARY}>
            <InventorySummaryTab
              onNavigateTab={setTab}
              onNewProduct={goToProducts}
              onNewMovement={goToStockMovement}
            />
          </TabPanel>
          <TabPanel value={tab} name={INVENTORY_TABS.PRODUCTS}>
            <InventoryProductsTab
              autoOpenCreate={autoOpenProductForm}
              onAutoOpenConsumed={() => setAutoOpenProductForm(false)}
              onViewStockHistory={viewStockHistory}
            />
          </TabPanel>
          <TabPanel value={tab} name={INVENTORY_TABS.CATEGORIES}>
            <InventoryCategoriesTab />
          </TabPanel>
          <TabPanel value={tab} name={INVENTORY_TABS.STOCK}>
            <InventoryStockTab
              productFilter={stockProductFilter}
              autoOpenCreate={autoOpenStockForm}
              onAutoOpenConsumed={() => setAutoOpenStockForm(false)}
            />
          </TabPanel>
          <TabPanel value={tab} name={INVENTORY_TABS.SALES}>
            <InventorySalesTab />
          </TabPanel>
          <TabPanel value={tab} name={INVENTORY_TABS.REPORTS}>
            <InventoryReportsTab />
          </TabPanel>
          <TabPanel value={tab} name={INVENTORY_TABS.SETTINGS}>
            <InventorySettingsTab />
          </TabPanel>
        </Box>
      </div>
    </MainContainer>
  );
};

export default InventorySales;
