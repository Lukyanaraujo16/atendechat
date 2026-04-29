import React, { useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
  Checkbox,
  Collapse,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Typography,
  Link,
} from "@material-ui/core";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import ExpandLessIcon from "@material-ui/icons/ExpandLess";
import { makeStyles, alpha } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";

function isBranch(n) {
  return n && typeof n.children === "object";
}

function collectLeaves(rootKey, node) {
  const keys = [];
  const leaves = [];
  const walk = (p, nd) => {
    if (isBranch(nd)) {
      Object.entries(nd.children).forEach(([ck, c]) => {
        const nextPath = p ? `${p}.${ck}` : ck;
        walk(nextPath, c);
      });
    } else if (p) {
      keys.push(p);
      leaves.push({ key: p, label: nd.label });
    }
  };
  walk(rootKey, node);
  return { keys, leaves };
}

const useStyles = makeStyles((theme) => ({
  card: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor:
      theme.palette.type === "dark"
        ? alpha(theme.palette.background.paper, 0.55)
        : theme.palette.background.paper,
    boxShadow:
      theme.palette.type === "dark"
        ? "0 1px 3px rgba(0,0,0,0.35)"
        : "0 1px 2px rgba(15,23,42,0.06)",
    transition: theme.transitions.create(["box-shadow", "border-color"], {
      duration: 180,
    }),
    "&:hover": {
      borderColor: alpha(theme.palette.primary.main, 0.35),
      boxShadow:
        theme.palette.type === "dark"
          ? `0 2px 8px ${alpha(theme.palette.common.black, 0.35)}`
          : `0 2px 8px ${alpha(theme.palette.common.black, 0.06)}`,
    },
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(0.5),
    cursor: "pointer",
    userSelect: "none",
    outline: "none",
    "&:focus-visible": {
      boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.45)}`,
      borderRadius: 4,
    },
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontWeight: 600,
    fontSize: "0.9375rem",
    lineHeight: 1.35,
    color: theme.palette.text.primary,
  },
  meta: {
    marginTop: theme.spacing(0.5),
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  count: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: theme.palette.text.secondary,
    letterSpacing: "0.02em",
  },
  progress: {
    flex: "1 1 72px",
    minWidth: 56,
    height: 4,
    borderRadius: 2,
    backgroundColor: alpha(theme.palette.primary.main, 0.12),
    "& .MuiLinearProgress-bar": {
      borderRadius: 2,
    },
  },
  actionsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1, 2),
    marginBottom: theme.spacing(1.25),
    marginTop: theme.spacing(0.25),
  },
  actionLink: {
    fontSize: "0.75rem",
    fontWeight: 500,
    cursor: "pointer",
  },
  leafRow: {
    marginLeft: theme.spacing(-1),
    marginBottom: theme.spacing(0.25),
    alignItems: "flex-start",
  },
  leafLabel: {
    fontSize: "0.8125rem",
    lineHeight: 1.4,
    color: theme.palette.text.primary,
  },
  leafHint: {
    fontSize: "0.7rem",
    lineHeight: 1.35,
    color: theme.palette.text.secondary,
    marginTop: 2,
    paddingLeft: theme.spacing(3.25),
  },
  expandIcon: {
    padding: theme.spacing(0.5),
    marginTop: -4,
  },
}));

/**
 * Cartão colapsável por categoria raiz do catálogo FEATURES.
 */
export default function PlanFeatureGroupCard({
  rootKey,
  node,
  value,
  onChange,
  expanded,
  onToggleExpand,
}) {
  const classes = useStyles();
  const { keys, leaves } = useMemo(() => collectLeaves(rootKey, node), [rootKey, node]);

  const total = keys.length;
  const active = useMemo(
    () => keys.filter((k) => value[k] === true).length,
    [keys, value]
  );
  const progress = total ? Math.round((active / total) * 100) : 0;

  const setAll = (checked) => {
    const next = { ...value };
    keys.forEach((k) => {
      next[k] = checked;
    });
    onChange(next);
  };

  const toggleOne = (path, checked) => {
    onChange({ ...value, [path]: checked });
  };

  return (
    <Card className={classes.card} elevation={0}>
      <CardContent style={{ paddingBottom: 8, flex: 1 }}>
        <Box
          className={classes.header}
          onClick={onToggleExpand}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onToggleExpand();
            }
          }}
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
        >
          <Box className={classes.headerMain}>
            <Typography variant="subtitle1" className={classes.title} component="div">
              {node.label}
            </Typography>
            <Box className={classes.meta}>
              <Typography className={classes.count} component="span">
                {i18n.t("plans.form.featureGroupCount", { active, total })}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={progress}
                className={classes.progress}
                color="primary"
              />
            </Box>
          </Box>
          <IconButton
            size="small"
            className={classes.expandIcon}
            aria-label={expanded ? i18n.t("plans.form.collapseModule") : i18n.t("plans.form.expandModule")}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          >
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Box>

        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box className={classes.actionsRow}>
            <Link
              component="button"
              type="button"
              className={classes.actionLink}
              onClick={() => setAll(true)}
            >
              {i18n.t("plans.form.selectAllFeatures")}
            </Link>
            <Link
              component="button"
              type="button"
              className={classes.actionLink}
              onClick={() => setAll(false)}
            >
              {i18n.t("plans.form.clearAllFeatures")}
            </Link>
          </Box>
          <Box display="flex" flexDirection="column">
            {leaves.map(({ key, label }) => (
              <Box key={key}>
                <FormControlLabel
                  className={classes.leafRow}
                  control={
                    <Checkbox
                      color="primary"
                      size="small"
                      checked={value[key] === true}
                      onChange={(e) => toggleOne(key, e.target.checked)}
                    />
                  }
                  label={<span className={classes.leafLabel}>{label}</span>}
                />
              </Box>
            ))}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}
