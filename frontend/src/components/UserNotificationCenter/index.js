import React, { useState, useRef } from "react";
import {
  Badge,
  IconButton,
  Popover,
  Typography,
  Box,
  makeStyles,
} from "@material-ui/core";
import NotificationsIcon from "@material-ui/icons/Notifications";

import useUserNotifications from "../../hooks/useUserNotifications";
import UserNotificationCenterPanel from "./UserNotificationCenterPanel";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles({
  popoverPaper: {
    width: 380,
    maxWidth: "92vw",
    maxHeight: 480,
    display: "flex",
    flexDirection: "column",
  },
});

/**
 * Sino legado (central persistente). Preferir UnifiedNotificationBell na TopBar.
 */
export default function UserNotificationCenter() {
  const classes = useStyles();
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);

  const {
    canUse,
    unreadCount,
    items,
    listLoading,
    listError,
    fetchList,
    fetchUnread,
    markReadAndGo,
    markAllRead,
    archiveRead,
    archiveOne,
  } = useUserNotifications();

  const handleOpen = () => {
    setOpen(true);
    fetchList();
    fetchUnread();
  };

  const handleClose = () => setOpen(false);

  const handleMarkReadAndGo = async (n) => {
    await markReadAndGo(n);
    handleClose();
  };

  if (!canUse) {
    return null;
  }

  return (
    <>
      <IconButton
        ref={anchorRef}
        aria-label={i18n.t("userNotificationCenter.bellAria")}
        color="inherit"
        onClick={handleOpen}
      >
        <Badge
          badgeContent={unreadCount}
          color="secondary"
          invisible={unreadCount === 0}
        >
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ className: classes.popoverPaper }}
      >
        <Box px={2} py={1} borderBottom={1} borderColor="divider">
          <Typography variant="subtitle1">
            {i18n.t("userNotificationCenter.title")}
          </Typography>
        </Box>
        <UserNotificationCenterPanel
          items={items}
          listLoading={listLoading}
          listError={listError}
          unreadCount={unreadCount}
          onMarkReadAndGo={handleMarkReadAndGo}
          onMarkAllRead={markAllRead}
          onArchiveRead={archiveRead}
          onArchiveOne={archiveOne}
          onViewAllClick={handleClose}
        />
      </Popover>
    </>
  );
}
