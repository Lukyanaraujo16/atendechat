import React, { useState, useRef, useContext, useEffect, useCallback } from "react";
import { useHistory } from "react-router-dom";

import Popover from "@material-ui/core/Popover";
import IconButton from "@material-ui/core/IconButton";
import Badge from "@material-ui/core/Badge";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Box from "@material-ui/core/Box";
import { makeStyles } from "@material-ui/core/styles";
import NotificationsIcon from "@material-ui/icons/Notifications";
import clsx from "clsx";

import NotificationCenterPanel from "../NotificationCenter/NotificationCenterPanel";
import UserNotificationCenterPanel from "../UserNotificationCenter/UserNotificationCenterPanel";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useGlobalNotifications } from "../../context/GlobalNotifications/GlobalNotificationsContext";
import useUserNotifications from "../../hooks/useUserNotifications";
import useUnifiedNotificationBadge from "../../hooks/useUnifiedNotificationBadge";
import { logNotificationMetric } from "../../utils/globalNotificationMetrics";
import {
  loadNotificationCenterTab,
  saveNotificationCenterTab,
} from "../../utils/notificationCenterUtils";
import { i18n } from "../../translate/i18n";

const MAIN_TAB_ACTIVITY = 0;
const MAIN_TAB_CENTRAL = 1;

const useStyles = makeStyles((theme) => ({
  popoverPaper: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(1),
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[8],
    borderRadius: 12,
    overflow: "hidden",
    minWidth: 320,
    maxWidth: 400,
    maxHeight: "min(520px, 85vh)",
    display: "flex",
    flexDirection: "column",
  },
  bellButton: {
    color: theme.palette.action.active,
    transition: "transform 0.25s ease",
  },
  bellPulse: {
    animation: "$bellReceive 0.55s ease",
  },
  "@keyframes bellReceive": {
    "0%": { transform: "scale(1)" },
    "35%": { transform: "scale(1.15) rotate(-8deg)" },
    "70%": { transform: "scale(1.05) rotate(4deg)" },
    "100%": { transform: "scale(1)" },
  },
  mainTabs: {
    borderBottom: `1px solid ${theme.palette.divider}`,
    minHeight: 40,
  },
  mainTab: {
    minHeight: 40,
    fontSize: "0.8rem",
    textTransform: "none",
    fontWeight: 600,
  },
  panelWrap: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  activityWrap: {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
  },
}));

/**
 * Sino único: Atividade (tempo real) + Central (persistente no banco).
 * Badge deduplicado via useUnifiedNotificationBadge (Fase 2).
 */
export default function UnifiedNotificationBell() {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const history = useHistory();
  const anchorEl = useRef();

  const {
    notifications,
    unreadCount: globalUnreadCount,
    markAsReadByChat,
    markAsReadByTicket,
    markAllAsRead,
  } = useGlobalNotifications();

  const {
    canUse: canUseCentral,
    unreadCount: userUnreadCount,
    items: centralItems,
    listLoading: centralListLoading,
    listError: centralListError,
    fetchList: fetchCentralList,
    fetchUnread: fetchCentralUnread,
    markRead: centralMarkRead,
    markReadAndGo: centralMarkReadAndGo,
    markAllRead: centralMarkAllRead,
    archiveRead: centralArchiveRead,
    archiveOne: centralArchiveOne,
    deleteOne: centralDeleteOne,
    deleteAllRead: centralDeleteAllRead,
  } = useUserNotifications({ enabled: Boolean(user?.id) });

  const {
    badgeCount,
    badgeDisplay,
    centralUnreadCountRaw,
    syncReadFromActivity,
    syncReadFromCentral,
  } = useUnifiedNotificationBadge({
    globalNotifications: notifications,
    globalUnreadCount,
    centralUnreadCount: canUseCentral ? userUnreadCount : 0,
    centralItems,
    markAsReadByChat,
    markAsReadByTicket,
    markCentralRead: centralMarkRead,
  });

  const [isOpen, setIsOpen] = useState(false);
  const [mainTab, setMainTab] = useState(MAIN_TAB_ACTIVITY);
  const [activityTab, setActivityTab] = useState(loadNotificationCenterTab);
  const [bellPulse, setBellPulse] = useState(false);
  const prevGlobalUnreadRef = useRef(globalUnreadCount);

  useEffect(() => {
    if (globalUnreadCount > prevGlobalUnreadRef.current) {
      setBellPulse(true);
      const t = setTimeout(() => setBellPulse(false), 600);
      prevGlobalUnreadRef.current = globalUnreadCount;
      return () => clearTimeout(t);
    }
    prevGlobalUnreadRef.current = globalUnreadCount;
    return undefined;
  }, [globalUnreadCount]);

  useEffect(() => {
    if (isOpen && mainTab === MAIN_TAB_CENTRAL && canUseCentral) {
      fetchCentralList();
      fetchCentralUnread();
    }
  }, [isOpen, mainTab, canUseCentral, fetchCentralList, fetchCentralUnread]);

  const handleToggleOpen = () => {
    setIsOpen((prev) => !prev);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleActivityTabChange = useCallback((tab) => {
    setActivityTab(tab);
    saveNotificationCenterTab(tab);
  }, []);

  const handleActivityItemClick = useCallback(
    async (notification) => {
      logNotificationMetric("notification_opened", {
        type: notification.type,
        id: notification.id,
        ticketId: notification.ticketId,
        chatId: notification.chatId,
      });

      await syncReadFromActivity(notification);

      if (notification.targetUrl) {
        history.push(notification.targetUrl);
      }
      handleClose();
    },
    [history, syncReadFromActivity]
  );

  const handleCentralMarkReadAndGo = useCallback(
    async (n) => {
      try {
        await syncReadFromCentral(n);
      } catch {
        /* noop */
      }
      await centralMarkReadAndGo(n);
      handleClose();
    },
    [syncReadFromCentral, centralMarkReadAndGo]
  );

  if (!user?.id) {
    return null;
  }

  return (
    <>
      <IconButton
        onClick={handleToggleOpen}
        ref={anchorEl}
        aria-label={i18n.t("unifiedNotificationBell.ariaLabel")}
        color="inherit"
        className={clsx(classes.bellButton, bellPulse && classes.bellPulse)}
      >
        <Badge
          badgeContent={badgeDisplay}
          color="secondary"
          invisible={badgeCount === 0}
        >
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Popover
        disableScrollLock
        open={isOpen}
        anchorEl={anchorEl.current}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        classes={{ paper: classes.popoverPaper }}
        onClose={handleClose}
      >
        <Tabs
          value={mainTab}
          onChange={(_, v) => setMainTab(v)}
          className={classes.mainTabs}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab
            className={classes.mainTab}
            label={i18n.t("unifiedNotificationBell.tabs.activity")}
          />
          <Tab
            className={classes.mainTab}
            label={
              centralUnreadCountRaw > 0
                ? `${i18n.t("unifiedNotificationBell.tabs.central")} (${centralUnreadCountRaw})`
                : i18n.t("unifiedNotificationBell.tabs.central")
            }
          />
        </Tabs>
        <Box className={classes.panelWrap}>
          {mainTab === MAIN_TAB_ACTIVITY ? (
            <Box className={classes.activityWrap}>
              <NotificationCenterPanel
                notifications={notifications}
                activeTab={activityTab}
                onTabChange={handleActivityTabChange}
                onItemClick={handleActivityItemClick}
                onMarkAllRead={markAllAsRead}
              />
            </Box>
          ) : canUseCentral ? (
            <UserNotificationCenterPanel
              items={centralItems}
              listLoading={centralListLoading}
              listError={centralListError}
              unreadCount={centralUnreadCountRaw}
              onMarkReadAndGo={handleCentralMarkReadAndGo}
              onMarkAllRead={centralMarkAllRead}
              onArchiveRead={centralArchiveRead}
              onArchiveOne={centralArchiveOne}
              onDeleteOne={centralDeleteOne}
              onDeleteAllRead={centralDeleteAllRead}
              onViewAllClick={handleClose}
            />
          ) : null}
        </Box>
      </Popover>
    </>
  );
}
