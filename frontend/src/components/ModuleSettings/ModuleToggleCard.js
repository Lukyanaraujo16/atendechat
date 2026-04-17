import React from "react";
import { Box, Switch, Typography } from "@material-ui/core";
import { useModuleCardStyles } from "./moduleCardStyles";

/**
 * Cartão reutilizável: título, descrição, toggle à direita; opcional linha de origem (empresa).
 */
export default function ModuleToggleCard({
  title,
  description,
  checked,
  onChange,
  disabled,
  originLabel,
  inputProps,
}) {
  const classes = useModuleCardStyles();
  return (
    <Box className={classes.moduleCard}>
      <Box className={classes.moduleRowInner}>
        <Box className={classes.moduleRowText}>
          <Typography component="div" className={classes.moduleTitle}>
            {title}
          </Typography>
          {originLabel ? (
            <Typography component="div" className={classes.moduleOrigin}>
              {originLabel}
            </Typography>
          ) : null}
          {description ? (
            <Typography component="div" className={classes.moduleDescription}>
              {description}
            </Typography>
          ) : null}
        </Box>
        <Box pt={0.25} flexShrink={0}>
          <Switch
            color="primary"
            checked={Boolean(checked)}
            onChange={onChange}
            disabled={disabled}
            inputProps={inputProps}
          />
        </Box>
      </Box>
    </Box>
  );
}
