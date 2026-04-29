import React from "react";
import { Box, Checkbox, FormControlLabel, Typography } from "@material-ui/core";
import { FEATURES } from "../../config/features";

function isBranch(n) {
  return n && typeof n.children === "object";
}

function Group({ path, node, value, onToggle }) {
  const v = value || {};
  if (isBranch(node)) {
    return (
      <Box key={path} marginBottom={1.5} marginLeft={path ? 1 : 0}>
        <Typography variant="subtitle2" style={{ fontWeight: 600, marginBottom: 8 }}>
          {node.label}
        </Typography>
        <Box display="flex" flexDirection="column" gap={0.25}>
          {Object.entries(node.children).map(([childKey, child]) => (
            <Group
              key={`${path}.${childKey}`}
              path={path ? `${path}.${childKey}` : childKey}
              node={child}
              value={v}
              onToggle={onToggle}
            />
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <FormControlLabel
      key={path}
      control={
        <Checkbox
          color="primary"
          size="small"
          checked={v[path] === true}
          onChange={(e) => onToggle(path, e.target.checked)}
        />
      }
      label={<Typography variant="body2">{node.label}</Typography>}
    />
  );
}

/**
 * @param {Record<string, boolean>} value mapa featureKey -> ativo
 * @param {(path: string, checked: boolean) => void} onChange
 */
export default function PlanFeaturesTree({ value, onChange }) {
  const onToggle = (path, checked) => {
    onChange({ ...value, [path]: checked });
  };

  return (
    <Box>
      {Object.entries(FEATURES).map(([rootKey, node]) => (
        <Group key={rootKey} path={rootKey} node={node} value={value} onToggle={onToggle} />
      ))}
    </Box>
  );
}
