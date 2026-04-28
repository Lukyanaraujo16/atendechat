import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(0, 2, 1),
    color: theme.palette.text.secondary,
    fontSize: "0.8125rem",
  },
  strong: {
    color: theme.palette.text.primary,
    fontWeight: 600,
  },
}));

const AgendaStats = ({
  periodTotal,
  filteredCount,
  todayInFiltered,
  filtersActive,
  inVisibleRange,
}) => {
  const classes = useStyles();

  return (
    <Box className={classes.root}>
      <Typography variant="body2" component="div">
        <span className={classes.strong}>{periodTotal}</span>
        {` ${i18n.t("agenda.stats.inPeriod")}`}
        {typeof inVisibleRange === "number" ? (
          <>
            {" · "}
            <span className={classes.strong}>{inVisibleRange}</span>
            {` ${i18n.t("agenda.stats.inVisibleRange")}`}
          </>
        ) : null}
        {filtersActive ? (
          <>
            {" · "}
            <span className={classes.strong}>{filteredCount}</span>
            {` ${i18n.t("agenda.stats.shown")}`}
          </>
        ) : null}
        {" · "}
        <span className={classes.strong}>{todayInFiltered}</span>
        {` ${i18n.t("agenda.stats.todayCount")}`}
      </Typography>
    </Box>
  );
};

export default AgendaStats;
