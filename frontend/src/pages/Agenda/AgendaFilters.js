import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Chip from "@material-ui/core/Chip";
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import InputAdornment from "@material-ui/core/InputAdornment";
import SearchIcon from "@material-ui/icons/Search";
import ClearIcon from "@material-ui/icons/Clear";
import { i18n } from "../../translate/i18n";
import { QUICK_FILTERS } from "./agendaUtils";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(0, 2, 1.5),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.75),
    alignItems: "center",
  },
  searchRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "flex-start",
  },
  searchField: {
    flex: "1 1 220px",
    minWidth: 200,
  },
}));

const FILTER_ORDER = [
  QUICK_FILTERS.ALL,
  QUICK_FILTERS.MY_EVENTS,
  QUICK_FILTERS.CREATED_BY_ME,
  QUICK_FILTERS.COLLECTIVE,
  QUICK_FILTERS.INDIVIDUAL,
  QUICK_FILTERS.TODAY,
  QUICK_FILTERS.NEXT_7,
];

const filterLabelKey = (id) => `agenda.filters.quick.${id}`;

const AgendaFilters = ({ quickFilter, onQuickFilter, searchQuery, onSearchChange, onClear }) => {
  const classes = useStyles();
  const hasExtra =
    quickFilter !== QUICK_FILTERS.ALL || (searchQuery && searchQuery.trim() !== "");

  return (
    <Box className={classes.root}>
      <Box className={classes.chipRow}>
        {FILTER_ORDER.map((id) => (
          <Chip
            key={id}
            label={i18n.t(filterLabelKey(id))}
            clickable
            color={quickFilter === id ? "primary" : "default"}
            onClick={() => onQuickFilter(id)}
            variant={quickFilter === id ? "default" : "outlined"}
            size="small"
          />
        ))}
      </Box>
      <Box className={classes.searchRow}>
        <TextField
          className={classes.searchField}
          size="small"
          variant="outlined"
          placeholder={i18n.t("agenda.filters.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => onSearchChange("")}
                  aria-label={i18n.t("agenda.filters.clearSearch")}
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
        {hasExtra ? (
          <Button size="small" variant="outlined" onClick={onClear}>
            {i18n.t("agenda.filters.clear")}
          </Button>
        ) : null}
      </Box>
    </Box>
  );
};

export default AgendaFilters;
