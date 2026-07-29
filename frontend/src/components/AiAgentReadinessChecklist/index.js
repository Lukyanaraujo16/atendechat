import React from "react";
import Box from "@material-ui/core/Box";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import Typography from "@material-ui/core/Typography";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import RadioButtonUncheckedIcon from "@material-ui/icons/RadioButtonUnchecked";
import ErrorOutlineIcon from "@material-ui/icons/ErrorOutline";
import WarningOutlinedIcon from "@material-ui/icons/WarningOutlined";
import { makeStyles } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    marginTop: theme.spacing(2),
  },
  title: {
    fontWeight: 600,
    marginBottom: theme.spacing(1),
  },
  item: {
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(0.5),
    border: `1px solid ${theme.palette.divider}`,
  },
  complete: { color: theme.palette.success?.main || theme.palette.primary.main },
  pending: { color: theme.palette.text.secondary },
  blocked: { color: theme.palette.error.main },
  warning: { color: theme.palette.warning?.main || theme.palette.secondary.main },
}));

function CheckIcon({ status, classes }) {
  if (status === "complete") {
    return <CheckCircleOutlineIcon className={classes.complete} aria-hidden />;
  }
  if (status === "blocked") {
    return <ErrorOutlineIcon className={classes.blocked} aria-hidden />;
  }
  if (status === "warning") {
    return <WarningOutlinedIcon className={classes.warning} aria-hidden />;
  }
  return <RadioButtonUncheckedIcon className={classes.pending} aria-hidden />;
}

export default function AiAgentReadinessChecklist({ checks }) {
  const classes = useStyles();
  const items = Array.isArray(checks) ? checks : [];

  if (!items.length) return null;

  return (
    <Box className={classes.root} component="section" aria-labelledby="ai-agent-checklist-title">
      <Typography id="ai-agent-checklist-title" variant="subtitle1" className={classes.title}>
        {i18n.t("aiAgentProduct.checklist.title")}
      </Typography>
      <List disablePadding aria-label={i18n.t("aiAgentProduct.checklist.aria")}>
        {items.map((check) => {
          const statusLabel = i18n.t(`aiAgentProduct.checkStatus.${check.status}`);
          return (
            <ListItem key={check.key} className={classes.item} dense>
              <ListItemIcon>
                <CheckIcon status={check.status} classes={classes} />
              </ListItemIcon>
              <ListItemText
                primary={i18n.t(check.labelKey)}
                secondary={`${statusLabel}. ${i18n.t(check.descriptionKey, {
                  defaultValue: "",
                })}`.trim()}
                primaryTypographyProps={{ component: "span" }}
              />
              <span className="sr-only">{statusLabel}</span>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
}
