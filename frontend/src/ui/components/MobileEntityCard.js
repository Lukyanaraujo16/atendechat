import React from "react";
import clsx from "clsx";
import Box from "@material-ui/core/Box";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";

const useListStyles = makeStyles((theme) => ({
  list: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
    width: "100%",
    maxWidth: "100%",
    overflowX: "hidden",
    padding: theme.spacing(0.5, 0),
  },
}));

export function MobileCardList({ children, className }) {
  const classes = useListStyles();
  return <Box className={clsx(classes.list, className)}>{children}</Box>;
}

const useCardStyles = makeStyles((theme) => ({
  card: {
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1.25),
    minWidth: 0,
  },
  leading: {
    flexShrink: 0,
  },
  body: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
  },
  titleRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(0.5),
    minWidth: 0,
  },
  title: {
    fontWeight: 600,
    lineHeight: 1.3,
    wordBreak: "break-word",
  },
  subtitle: {
    marginTop: theme.spacing(0.25),
    lineHeight: 1.35,
    wordBreak: "break-word",
  },
  meta: {
    marginTop: theme.spacing(1),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(0.75),
    minWidth: 0,
  },
  chipRow: {
    marginTop: theme.spacing(1),
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.5),
    maxWidth: "100%",
  },
  footer: {
    marginTop: theme.spacing(1),
    paddingTop: theme.spacing(1),
    borderTop: `1px solid ${theme.palette.divider}`,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(0.75),
  },
}));

/**
 * Card vertical para listagens administrativas no mobile.
 */
export default function MobileEntityCard({
  leading,
  title,
  subtitle,
  badges,
  trailing,
  children,
  footer,
  onClick,
  className,
  elevation = 0,
}) {
  const classes = useCardStyles();

  return (
    <Paper
      variant="outlined"
      elevation={elevation}
      className={clsx(classes.card, className)}
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <Box className={classes.header}>
        {leading ? <Box className={classes.leading}>{leading}</Box> : null}
        <Box className={classes.body}>
          <Box className={classes.titleRow}>
            <Box minWidth={0} flex={1}>
              {title ? (
                <Typography variant="subtitle1" className={classes.title}>
                  {title}
                </Typography>
              ) : null}
              {subtitle ? (
                <Typography
                  variant="body2"
                  color="textSecondary"
                  className={classes.subtitle}
                >
                  {subtitle}
                </Typography>
              ) : null}
            </Box>
            {trailing ? (
              <Box flexShrink={0} onClick={(e) => e.stopPropagation()}>
                {trailing}
              </Box>
            ) : null}
          </Box>
          {badges ? <Box className={classes.chipRow}>{badges}</Box> : null}
          {children ? <Box className={classes.meta}>{children}</Box> : null}
          {footer ? <Box className={classes.footer}>{footer}</Box> : null}
        </Box>
      </Box>
    </Paper>
  );
}
