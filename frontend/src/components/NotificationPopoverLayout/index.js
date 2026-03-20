import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import Divider from "@material-ui/core/Divider";
import Box from "@material-ui/core/Box";
import Badge from "@material-ui/core/Badge";
import NotificationsIcon from "@material-ui/icons/Notifications";
import InboxIcon from "@material-ui/icons/Inbox";

const useStyles = makeStyles((theme) => ({
  paper: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    boxShadow:
      "0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)",
    overflow: "hidden",
    minWidth: 320,
    maxWidth: 350,
    [theme.breakpoints.down("sm")]: {
      maxWidth: 270,
    },
  },
  header: {
    padding: "16px 20px 12px",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  headerIcon: {
    color: "#000000",
    fontSize: 24,
  },
  headerTitle: {
    fontWeight: 600,
    fontSize: 16,
    color: "rgba(0, 0, 0, 0.87)",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(0, 0, 0, 0.6)",
    marginLeft: 34,
  },
  divider: {
    margin: "0 20px",
  },
  body: {
    padding: "20px 20px 24px",
    maxHeight: 350,
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 16px",
    textAlign: "center",
  },
  emptyIcon: {
    fontSize: 64,
    color: "rgba(0, 0, 0, 0.2)",
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: "rgba(0, 0, 0, 0.6)",
    fontWeight: 500,
  },
  pulsingDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    backgroundColor: "#e53935",
    animation: "$pulse 1.5s ease-in-out infinite",
  },
  "@keyframes pulse": {
    "0%, 100%": { opacity: 1, transform: "scale(1)" },
    "50%": { opacity: 0.6, transform: "scale(1.2)" },
  },
}));

export function PulsingNotificationBadge({ hasNotification, children }) {
  const classes = useStyles();
  return (
    <Badge
      variant="dot"
      invisible={!hasNotification}
      overlap="circular"
      classes={{
        badge: classes.pulsingDot,
      }}
    >
      {children}
    </Badge>
  );
}

export default function NotificationPopoverLayout({
  title = "Notificações",
  subtitle,
  emptyText = "Nenhuma notificação.",
  hasItems,
  children,
  headerIcon: HeaderIcon = NotificationsIcon,
  onScroll,
}) {
  const classes = useStyles();

  const displaySubtitle =
    subtitle !== undefined
      ? subtitle
      : hasItems
      ? `${hasItems} ${hasItems === 1 ? "notificação pendente" : "notificações pendentes"}`
      : "Nenhuma notificação pendente";

  return (
    <div className={classes.paper}>
      <div className={classes.header}>
        <div className={classes.headerRow}>
          <HeaderIcon className={classes.headerIcon} />
          <Typography className={classes.headerTitle}>{title}</Typography>
        </div>
        <Typography className={classes.headerSubtitle} variant="body2">
          {displaySubtitle}
        </Typography>
      </div>
      <Divider className={classes.divider} />
      <div className={classes.body} onScroll={onScroll}>
        {hasItems ? (
          children
        ) : (
          <Box className={classes.emptyState}>
            <InboxIcon className={classes.emptyIcon} />
            <Typography className={classes.emptyText}>{emptyText}</Typography>
          </Box>
        )}
      </div>
    </div>
  );
}
