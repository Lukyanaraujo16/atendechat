import React, { useState, useCallback } from "react";
import { Box, Grid } from "@material-ui/core";
import { FEATURES } from "../../config/features";
import PlanFeatureGroupCard from "./PlanFeatureGroupCard";
import { FEATURE_GROUP_ORDER } from "./planFeatureUiUtils";

/**
 * Grelha de cartões por categoria. Mantém o mesmo contrato: value = mapa featureKey → boolean, onChange recebe o mapa completo.
 */
export default function PlanFeaturesTree({ value, onChange }) {
  const [expanded, setExpanded] = useState({});

  const toggleExpanded = useCallback((rootKey) => {
    setExpanded((prev) => ({
      ...prev,
      [rootKey]: !prev[rootKey],
    }));
  }, []);

  return (
    <Grid container spacing={2}>
      {FEATURE_GROUP_ORDER.filter((k) => FEATURES[k]).map((rootKey) => (
        <Grid item xs={12} sm={6} md={4} key={rootKey}>
          <PlanFeatureGroupCard
            rootKey={rootKey}
            node={FEATURES[rootKey]}
            value={value || {}}
            onChange={onChange}
            expanded={Boolean(expanded[rootKey])}
            onToggleExpand={() => toggleExpanded(rootKey)}
          />
        </Grid>
      ))}
    </Grid>
  );
}
