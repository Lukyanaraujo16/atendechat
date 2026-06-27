import React from "react";
import { Typography, Box } from "@material-ui/core";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import { i18n } from "../../translate/i18n";

const InventorySales = () => (
  <MainContainer>
    <MainHeader>
      <Title>{i18n.t("inventorySales.title")}</Title>
    </MainHeader>
    <Box px={2} py={3}>
      <Typography variant="body1" color="textSecondary">
        {i18n.t("inventorySales.comingSoon")}
      </Typography>
    </Box>
  </MainContainer>
);

export default InventorySales;
