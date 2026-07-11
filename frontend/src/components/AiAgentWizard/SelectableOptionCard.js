import React from "react";
import clsx from "clsx";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";

const useStyles = makeStyles((theme) => ({
  card: {
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    cursor: "pointer",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(0.5),
    "&:hover": {
      borderColor: theme.palette.primary.main,
    },
    "&:focus": {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
  selected: {
    borderColor: theme.palette.primary.main,
    boxShadow: `0 0 0 1px ${theme.palette.primary.main}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(144, 202, 249, 0.08)"
        : "rgba(25, 118, 210, 0.04)",
  },
  disabled: {
    opacity: 0.65,
    cursor: "not-allowed",
    "&:hover": {
      borderColor: theme.palette.divider,
    },
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(1),
  },
  title: {
    fontWeight: 600,
  },
  description: {
    color: theme.palette.text.secondary,
    fontSize: "0.8125rem",
    lineHeight: 1.45,
  },
  check: {
    color: theme.palette.primary.main,
    fontSize: 20,
    flexShrink: 0,
  },
}));

export default function SelectableOptionCard({
  title,
  description,
  selected = false,
  disabled = false,
  onClick,
  className,
}) {
  const classes = useStyles();

  const handleKeyDown = (event) => {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (onClick) onClick();
    }
  };

  return (
    <Paper
      component="div"
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={disabled}
      className={clsx(
        classes.card,
        selected && classes.selected,
        disabled && classes.disabled,
        className
      )}
      elevation={0}
      onClick={disabled ? undefined : onClick}
      onKeyDown={handleKeyDown}
    >
      <div className={classes.header}>
        <Typography variant="body2" className={classes.title}>
          {title}
        </Typography>
        {selected ? <CheckCircleIcon className={classes.check} /> : null}
      </div>
      {description ? (
        <Typography variant="body2" className={classes.description}>
          {description}
        </Typography>
      ) : null}
    </Paper>
  );
}
