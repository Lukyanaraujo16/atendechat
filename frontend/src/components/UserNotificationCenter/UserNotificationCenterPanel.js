import React from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Typography,
  CircularProgress,
  makeStyles,
} from "@material-ui/core";
import NotificationsIcon from "@material-ui/icons/Notifications";
import ChatBubbleOutlineIcon from "@material-ui/icons/ChatBubbleOutline";
import ConfirmationNumberOutlinedIcon from "@material-ui/icons/ConfirmationNumberOutlined";
import EventOutlinedIcon from "@material-ui/icons/EventOutlined";
import AttachMoneyOutlinedIcon from "@material-ui/icons/AttachMoneyOutlined";
import TrackChangesOutlinedIcon from "@material-ui/icons/TrackChangesOutlined";
import ArchiveOutlinedIcon from "@material-ui/icons/ArchiveOutlined";

import { i18n } from "../../translate/i18n";
import { notificationVisualType } from "../../utils/notificationNavigation";
import { formatNotificationTime } from "../../utils/formatNotificationTime";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    minHeight: 200,
    maxHeight: 420,
  },
  list: {
    overflowY: "auto",
    flex: 1,
    paddingTop: 0,
    paddingBottom: 0,
  },
  unread: {
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(0,0,0,0.04)",
  },
  footer: {
    padding: theme.spacing(1),
    borderTop: `1px solid ${theme.palette.divider}`,
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  sectionLabel: {
    padding: theme.spacing(0.75, 2, 0.25),
    fontSize: "0.7rem",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: theme.palette.text.secondary,
    fontWeight: 600,
  },
  emptyWrap: {
    padding: theme.spacing(3, 2),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
}));

function TypeIcon({ v }) {
  if (v === "message") return <ChatBubbleOutlineIcon fontSize="small" color="action" />;
  if (v === "appointment") return <EventOutlinedIcon fontSize="small" color="action" />;
  if (v === "billing") return <AttachMoneyOutlinedIcon fontSize="small" color="action" />;
  if (v === "crm") return <TrackChangesOutlinedIcon fontSize="small" color="action" />;
  return <ConfirmationNumberOutlinedIcon fontSize="small" color="action" />;
}

export default function UserNotificationCenterPanel({
  items,
  listLoading,
  listError,
  unreadCount,
  onMarkReadAndGo,
  onMarkAllRead,
  onArchiveRead,
  onArchiveOne,
  onViewAllClick,
}) {
  const classes = useStyles();

  const unreadItems = items.filter((x) => !x.read);
  const readItems = items.filter((x) => x.read);

  const renderItem = (n) => {
    const v = notificationVisualType(n);
    return (
      <ListItem
        key={n.id}
        button
        className={!n.read ? classes.unread : undefined}
        onClick={() => onMarkReadAndGo(n)}
      >
        <ListItemIcon style={{ minWidth: 40 }}>
          <TypeIcon v={v} />
        </ListItemIcon>
        <ListItemText
          primary={n.title}
          secondary={
            <>
              <Typography component="span" variant="body2" color="textSecondary" display="block">
                {n.body}
              </Typography>
              <Typography component="span" variant="caption" color="textSecondary">
                {formatNotificationTime(n.createdAt)}
              </Typography>
            </>
          }
        />
        <ListItemSecondaryAction>
          <IconButton
            edge="end"
            size="small"
            aria-label={i18n.t("userNotificationCenter.archiveOneAria")}
            onClick={(e) => {
              e.stopPropagation();
              onArchiveOne(n);
            }}
          >
            <ArchiveOutlinedIcon fontSize="small" />
          </IconButton>
        </ListItemSecondaryAction>
      </ListItem>
    );
  };

  return (
    <div className={classes.root}>
      {listLoading ? (
        <Box display="flex" justifyContent="center" py={3}>
          <CircularProgress size={28} />
        </Box>
      ) : listError ? (
        <Box className={classes.emptyWrap}>
          <Typography variant="body2" color="error">
            {i18n.t("userNotificationCenter.listLoadError")}
          </Typography>
        </Box>
      ) : items.length === 0 ? (
        <Box className={classes.emptyWrap}>
          <NotificationsIcon style={{ fontSize: 40, opacity: 0.35, marginBottom: 8 }} />
          <Typography variant="body2">{i18n.t("userNotificationCenter.empty")}</Typography>
        </Box>
      ) : (
        <List dense className={classes.list}>
          {unreadItems.length > 0 && (
            <>
              <Typography className={classes.sectionLabel} component="div">
                {i18n.t("userNotificationCenter.unreadSection")}
              </Typography>
              {unreadItems.map(renderItem)}
            </>
          )}
          {readItems.length > 0 && (
            <>
              <Typography className={classes.sectionLabel} component="div">
                {i18n.t("userNotificationCenter.readSection")}
              </Typography>
              {readItems.map(renderItem)}
            </>
          )}
        </List>
      )}
      <Box className={classes.footer}>
        <Button size="small" onClick={onMarkAllRead} disabled={unreadCount === 0}>
          {i18n.t("userNotificationCenter.markAllRead")}
        </Button>
        <Button size="small" onClick={onArchiveRead}>
          {i18n.t("userNotificationCenter.archiveRead")}
        </Button>
        <Box flex="1" />
        <Button
          size="small"
          color="primary"
          component={RouterLink}
          to="/notifications"
          onClick={onViewAllClick}
        >
          {i18n.t("userNotificationCenter.viewAll")}
        </Button>
      </Box>
    </div>
  );
}
