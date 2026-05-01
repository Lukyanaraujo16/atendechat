import React from "react";
import PropTypes from "prop-types";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import Alert from "@material-ui/lab/Alert";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(2),
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    height: "100%",
    backgroundColor: theme.palette.background.paper,
  },
  title: {
    fontWeight: 600,
    marginBottom: theme.spacing(1),
  },
  caption: {
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: theme.spacing(1),
    backgroundColor: theme.palette.action.hover,
  },
}));

function pickBarColor(percent, palette) {
  if (percent == null) return palette.primary.main;
  if (percent >= 100) return palette.error.main;
  if (percent >= 90) return palette.error.main;
  if (percent >= 80) return palette.warning.main;
  return palette.success.main;
}

export default function CompanyStorageUsageCard({ data, loading }) {
  const classes = useStyles();
  const theme = useTheme();

  if (loading) {
    return (
      <Paper className={classes.root} elevation={0}>
        <Typography variant="body2" color="textSecondary">
          {i18n.t("companyStorage.loading")}
        </Typography>
      </Paper>
    );
  }
  if (!data) return null;

  const { usedFormatted, limitFormatted, remainingFormatted, percent } = data;

  let alertSeverity = "info";
  let alertMsg = null;
  if (percent != null) {
    const p = Number(percent);
    if (p >= 100) {
      alertSeverity = "error";
      alertMsg = i18n.t("companyStorage.alertExceeded");
    } else if (p >= 90) {
      alertSeverity = "error";
      alertMsg = i18n.t("companyStorage.alertAlmostFull");
    } else if (p >= 80) {
      alertSeverity = "warning";
      alertMsg = i18n.t("companyStorage.alertAttention");
    }
  }

  const pct = percent != null ? Math.min(100, Number(percent) || 0) : null;

  return (
    <Paper className={classes.root} elevation={0}>
      <Typography className={classes.title} variant="subtitle1">
        {i18n.t("companyStorage.title")}
      </Typography>
      <Typography variant="body2" color="textPrimary">
        {limitFormatted
          ? i18n.t("companyStorage.usedOfTotal", {
              used: usedFormatted,
              total: limitFormatted,
            })
          : i18n.t("companyStorage.usedUnlimited", { used: usedFormatted })}
      </Typography>
      {remainingFormatted != null && limitFormatted ? (
        <Typography className={classes.caption} component="div">
          {i18n.t("companyStorage.remaining", { value: remainingFormatted })}
        </Typography>
      ) : null}
      {data.calculatedAt ? (
        <Typography className={classes.caption} component="div" style={{ marginTop: 4 }}>
          {i18n.t("companyStorage.updatedAt", {
            date: new Date(data.calculatedAt).toLocaleString(),
          })}
        </Typography>
      ) : null}
      {pct != null ? (
        <Box className={classes.barTrack}>
          <Box
            style={{
              width: `${pct}%`,
              height: "100%",
              backgroundColor: pickBarColor(Number(percent), theme.palette),
              transition: "width 0.25s ease",
            }}
          />
        </Box>
      ) : null}
      {alertMsg ? (
        <Box mt={1.5}>
          <Alert severity={alertSeverity}>{alertMsg}</Alert>
        </Box>
      ) : null}
    </Paper>
  );
}

CompanyStorageUsageCard.propTypes = {
  data: PropTypes.object,
  loading: PropTypes.bool,
};
