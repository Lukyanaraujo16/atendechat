import React from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
} from "@material-ui/core";
import { makeStyles, useTheme } from "@material-ui/core/styles";

import AppTableContainer from "../../ui/components/AppTableContainer";
import { AppEmptyState } from "../../ui";

const useStyles = makeStyles((theme) => ({
  table: { minWidth: 640 },
  card: {
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    marginBottom: theme.spacing(1.5),
    background: theme.palette.background.paper,
  },
  cardRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 0),
    "& > *:last-child": { textAlign: "right", wordBreak: "break-word" },
  },
  cardLabel: {
    color: theme.palette.text.secondary,
    fontSize: "0.8rem",
    flexShrink: 0,
  },
  cardActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
}));

/**
 * Tabela com rolagem horizontal no desktop e cartões no mobile.
 * columns: [{ key, label, render(row) }]; actions(row) opcional.
 */
export default function FinanceTable({
  columns,
  rows,
  rowKey = (r) => r.id,
  actions,
  rowClassName,
  emptyTitle,
  emptyDescription,
}) {
  const classes = useStyles();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("xs"));

  if (!rows || rows.length === 0) {
    return <AppEmptyState title={emptyTitle || "Nada por aqui"} description={emptyDescription} />;
  }

  if (mobile) {
    return (
      <Box>
        {rows.map((row) => (
          <Box key={rowKey(row)} className={`${classes.card} ${rowClassName ? rowClassName(row) || "" : ""}`}>
            {columns.map((c) => (
              <div key={c.key} className={classes.cardRow}>
                <Typography component="span" className={classes.cardLabel}>
                  {c.label}
                </Typography>
                <Box component="span" fontSize="0.875rem">
                  {c.render ? c.render(row) : row[c.key] ?? "—"}
                </Box>
              </div>
            ))}
            {actions ? <div className={classes.cardActions}>{actions(row)}</div> : null}
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <AppTableContainer nested>
      <Table size="small" className={classes.table}>
        <TableHead>
          <TableRow>
            {columns.map((c) => (
              <TableCell key={c.key}>{c.label}</TableCell>
            ))}
            {actions ? <TableCell align="right">Ações</TableCell> : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={rowKey(row)} className={rowClassName ? rowClassName(row) : undefined}>
              {columns.map((c) => (
                <TableCell key={c.key}>{c.render ? c.render(row) : row[c.key] ?? "—"}</TableCell>
              ))}
              {actions ? (
                <TableCell align="right" style={{ whiteSpace: "nowrap" }}>
                  {actions(row)}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AppTableContainer>
  );
}
