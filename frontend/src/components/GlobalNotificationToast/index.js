import React from "react";
import {
  makeStyles,
  Button,
  Typography,
  Box,
  Avatar,
} from "@material-ui/core";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1.25),
    padding: theme.spacing(1.25, 1.5),
    minWidth: 260,
    maxWidth: 360,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
  },
  rootDiscrete: {
    padding: theme.spacing(1, 1.25),
    maxWidth: 320,
  },
  avatar: {
    width: 40,
    height: 40,
    flexShrink: 0,
    fontSize: "0.95rem",
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
  },
  avatarDiscrete: {
    width: 32,
    height: 32,
    fontSize: "0.8rem",
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontWeight: 600,
    fontSize: "0.875rem",
    lineHeight: 1.3,
    marginBottom: theme.spacing(0.25),
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  preview: {
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
    lineHeight: 1.35,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    wordBreak: "break-word",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: theme.spacing(0.75),
  },
}));

function initialsFromName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function GlobalNotificationToast({
  contactName,
  preview,
  avatarUrl,
  variant = "normal",
  onOpen,
  closeToast,
}) {
  const classes = useStyles();
  const discrete = variant === "discrete";
  const name = contactName || i18n.t("globalNotifications.unknownContact");
  const previewText = String(preview || "").trim();

  return (
    <Box
      className={`${classes.root} ${discrete ? classes.rootDiscrete : ""}`}
      onClick={() => {
        if (typeof onOpen === "function") onOpen();
        if (typeof closeToast === "function") closeToast();
      }}
      style={{ cursor: "pointer" }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (typeof onOpen === "function") onOpen();
          if (typeof closeToast === "function") closeToast();
        }
      }}
    >
      <Avatar
        src={avatarUrl || undefined}
        alt=""
        className={`${classes.avatar} ${discrete ? classes.avatarDiscrete : ""}`}
      >
        {initialsFromName(name)}
      </Avatar>
      <Box className={classes.content}>
        <Typography className={classes.name} component="div">
          {name}
        </Typography>
        {previewText ? (
          <Typography className={classes.preview} component="div">
            {previewText}
          </Typography>
        ) : null}
        <div className={classes.actions}>
          <Button
            size="small"
            color="primary"
            onClick={(e) => {
              e.stopPropagation();
              if (typeof onOpen === "function") onOpen();
              if (typeof closeToast === "function") closeToast();
            }}
          >
            {i18n.t("globalNotifications.open")}
          </Button>
        </div>
      </Box>
    </Box>
  );
}
