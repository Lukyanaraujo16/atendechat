import React, { useMemo, useState, useCallback } from "react";
import {
  makeStyles,
  Tabs,
  Tab,
  Typography,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Box,
} from "@material-ui/core";
import ForumIcon from "@material-ui/icons/Forum";
import ChatIcon from "@material-ui/icons/Chat";
import InboxIcon from "@material-ui/icons/Inbox";

import { i18n } from "../../translate/i18n";
import { formatNotificationTime } from "../../utils/formatNotificationTime";
import {
  NOTIFICATION_CENTER_TABS,
  filterNotificationsByTab,
  groupNotificationsForCenter,
  buildVirtualRows,
  formatNotificationDisplayLine,
  getNextVisibleLimit,
  NOTIFICATION_CENTER_INITIAL_VISIBLE,
  NOTIFICATION_CENTER_MAX_VISIBLE,
} from "../../utils/notificationCenterUtils";
import VirtualizedNotificationList from "./VirtualizedNotificationList";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    minWidth: 320,
    maxWidth: 380,
    backgroundColor: theme.palette.background.paper,
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: theme.shadows[8],
  },
  rootEmbedded: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    width: "100%",
    maxWidth: "100%",
    backgroundColor: theme.palette.background.paper,
    overflow: "hidden",
    boxShadow: "none",
  },
  header: {
    padding: theme.spacing(2, 2, 1),
  },
  headerTitle: {
    fontWeight: 600,
    fontSize: "1rem",
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  tabs: {
    borderBottom: `1px solid ${theme.palette.divider}`,
    minHeight: 40,
  },
  tab: {
    minWidth: 64,
    minHeight: 40,
    fontSize: "0.75rem",
    textTransform: "none",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(0.75, 2),
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(0,0,0,0.03)",
    height: "100%",
    boxSizing: "border-box",
  },
  sectionTitle: {
    fontWeight: 600,
    fontSize: "0.8rem",
    color: theme.palette.text.secondary,
  },
  listItem: {
    cursor: "pointer",
    height: "100%",
    boxSizing: "border-box",
    borderBottom: `1px solid ${theme.palette.divider}`,
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  unreadItem: {
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(0,0,0,0.04)",
  },
  empty: {
    padding: theme.spacing(4, 2),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: theme.spacing(1),
    opacity: 0.4,
  },
  footer: {
    padding: theme.spacing(1, 2),
    borderTop: `1px solid ${theme.palette.divider}`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing(1),
  },
  showMore: {
    width: "100%",
    textAlign: "center",
    padding: theme.spacing(1),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
}));

function TypeIcon({ type }) {
  if (type === "internalChat") {
    return <ForumIcon fontSize="small" color="primary" />;
  }
  return <ChatIcon fontSize="small" color="primary" />;
}

function sectionLabel(sectionKey) {
  if (sectionKey === "internalChat") {
    return i18n.t("notificationCenter.sections.internal");
  }
  if (sectionKey === "whatsapp") {
    return i18n.t("notificationCenter.sections.whatsapp");
  }
  return "";
}

export default function NotificationCenterPanel({
  notifications,
  activeTab,
  onTabChange,
  onItemClick,
  onMarkAllRead,
  embedded = false,
}) {
  const classes = useStyles();
  const [visibleLimit, setVisibleLimit] = useState(
    NOTIFICATION_CENTER_INITIAL_VISIBLE
  );

  const filtered = useMemo(
    () => filterNotificationsByTab(notifications, activeTab),
    [notifications, activeTab]
  );

  const groups = useMemo(
    () => groupNotificationsForCenter(filtered, activeTab),
    [filtered, activeTab]
  );

  const { rows, hasMore, totalItems } = useMemo(
    () => buildVirtualRows(groups, visibleLimit),
    [groups, visibleLimit]
  );

  const handleTabChange = useCallback(
    (_, value) => {
      setVisibleLimit(NOTIFICATION_CENTER_INITIAL_VISIBLE);
      onTabChange(value);
    },
    [onTabChange]
  );

  const renderSection = useCallback(
    (row) => (
      <div className={classes.sectionHeader}>
        <Typography className={classes.sectionTitle}>
          {sectionLabel(row.sectionKey)}
          {row.unread > 0 ? ` (${row.unread})` : ""}
        </Typography>
      </div>
    ),
    [classes]
  );

  const renderItem = useCallback(
    (notification) => (
      <ListItem
        className={`${classes.listItem} ${
          !notification.read ? classes.unreadItem : ""
        }`}
        button
        onClick={() => onItemClick(notification)}
        disableGutters
        style={{ paddingLeft: 16, paddingRight: 16 }}
      >
        <ListItemIcon style={{ minWidth: 40 }}>
          <TypeIcon type={notification.type} />
        </ListItemIcon>
        <ListItemText
          primary={notification.title}
          secondary={
            <>
              <Typography
                component="span"
                variant="body2"
                style={{ display: "block", lineHeight: 1.35 }}
              >
                {formatNotificationDisplayLine(notification)}
              </Typography>
              <Typography
                component="span"
                variant="caption"
                color="textSecondary"
              >
                {formatNotificationTime(
                  new Date(notification.createdAt).toISOString()
                )}
              </Typography>
            </>
          }
          primaryTypographyProps={{ variant: "caption", color: "textSecondary" }}
        />
      </ListItem>
    ),
    [classes, onItemClick]
  );

  const isEmpty = filtered.length === 0;

  const listHeight = embedded
    ? Math.max(240, (typeof window !== "undefined" ? window.innerHeight : 640) - 220)
    : 360;

  return (
    <div className={embedded ? classes.rootEmbedded : classes.root}>
      {!embedded ? (
        <div className={classes.header}>
          <Typography className={classes.headerTitle}>
            🔔 {i18n.t("notificationCenter.title")}
          </Typography>
        </div>
      ) : null}

      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        className={classes.tabs}
        indicatorColor="primary"
        textColor="primary"
      >
        <Tab
          className={classes.tab}
          value={NOTIFICATION_CENTER_TABS.ALL}
          label={i18n.t("notificationCenter.tabs.all")}
        />
        <Tab
          className={classes.tab}
          value={NOTIFICATION_CENTER_TABS.WHATSAPP}
          label={i18n.t("notificationCenter.tabs.whatsapp")}
        />
        <Tab
          className={classes.tab}
          value={NOTIFICATION_CENTER_TABS.INTERNAL}
          label={i18n.t("notificationCenter.tabs.internal")}
        />
        <Tab
          className={classes.tab}
          value={NOTIFICATION_CENTER_TABS.UNREAD}
          label={i18n.t("notificationCenter.tabs.unread")}
        />
      </Tabs>

      {isEmpty ? (
        <Box className={classes.empty}>
          <InboxIcon className={classes.emptyIcon} color="disabled" />
          <Typography variant="body2">
            {i18n.t("notificationCenter.empty")}
          </Typography>
        </Box>
      ) : (
        <>
          <VirtualizedNotificationList
            rows={rows}
            height={listHeight}
            renderSection={renderSection}
            renderItem={renderItem}
          />
          {hasMore && (
            <div className={classes.showMore}>
              <Button
                size="small"
                color="primary"
                onClick={() =>
                  setVisibleLimit((prev) =>
                    getNextVisibleLimit(prev, totalItems)
                  )
                }
              >
                {i18n.t("notificationCenter.showMore")}
              </Button>
            </div>
          )}
          {totalItems >= NOTIFICATION_CENTER_MAX_VISIBLE && !hasMore && (
            <Typography
              variant="caption"
              color="textSecondary"
              align="center"
              display="block"
              style={{ padding: 8 }}
            >
              {i18n.t("notificationCenter.limitHint")}
            </Typography>
          )}
        </>
      )}

      {!isEmpty && (
        <Box className={classes.footer}>
          <Button size="small" color="primary" onClick={onMarkAllRead}>
            {i18n.t("globalNotifications.markAllRead")}
          </Button>
        </Box>
      )}
    </div>
  );
}
