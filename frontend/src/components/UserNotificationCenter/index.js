import React, { useState, useEffect, useContext, useCallback, useRef } from "react";
import { useHistory, Link as RouterLink } from "react-router-dom";
import {
  Badge,
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Popover,
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

import { AuthContext } from "../../context/Auth/AuthContext";
import { SocketContext } from "../../context/Socket/SocketContext";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import {
  navigateFromNotificationData,
  notificationVisualType,
} from "../../utils/notificationNavigation";
import { formatNotificationTime } from "../../utils/formatNotificationTime";

const useStyles = makeStyles((theme) => ({
  popoverPaper: {
    width: 380,
    maxWidth: "92vw",
    maxHeight: 480,
    display: "flex",
    flexDirection: "column",
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

export default function UserNotificationCenter() {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const socketManager = useContext(SocketContext);
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState(false);

  const canUse =
    Boolean(user?.id) &&
    user?.companyId != null &&
    user?.companyId !== "";

  const fetchUnread = useCallback(async () => {
    if (!canUse) return;
    try {
      const { data } = await api.get("/notifications/unread-count");
      setUnreadCount(Number(data?.count) || 0);
    } catch {
      /* noop */
    }
  }, [canUse]);

  const fetchList = useCallback(async () => {
    if (!canUse) return;
    setListLoading(true);
    setListError(false);
    try {
      const { data } = await api.get("/notifications", {
        params: { page: 1, limit: 20 },
      });
      setItems(Array.isArray(data?.notifications) ? data.notifications : []);
    } catch (e) {
      setListError(true);
      toastError(e);
    } finally {
      setListLoading(false);
    }
  }, [canUse]);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  useEffect(() => {
    if (!canUse || !user?.id || user?.companyId == null || user?.companyId === "") {
      return undefined;
    }
    const companyId = String(user.companyId);
    const socket = socketManager.getSocket(companyId);
    const ev = `user-${user.id}-notification`;
    const onCreate = (payload) => {
      if (payload?.action === "create" && payload?.notification) {
        const n = payload.notification;
        setItems((prev) => {
          const next = [n, ...prev.filter((x) => x.id !== n.id)];
          return next.slice(0, 30);
        });
        setUnreadCount((c) => c + 1);
      }
    };
    socket.on(ev, onCreate);
    return () => socket.off(ev, onCreate);
  }, [canUse, user?.id, socketManager]);

  const handleOpen = () => {
    setOpen(true);
    fetchList();
    fetchUnread();
  };

  const handleClose = () => setOpen(false);

  const markReadAndGo = async (n) => {
    try {
      if (!n.read) {
        await api.put(`/notifications/${n.id}/read`);
        setItems((prev) =>
          prev.map((x) =>
            x.id === n.id ? { ...x, read: true, readAt: new Date().toISOString() } : x
          )
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      navigateFromNotificationData(n.data, history);
    } catch (e) {
      toastError(e);
    }
    handleClose();
  };

  const markAllRead = async () => {
    try {
      await api.put("/notifications/read-all");
      setItems((prev) =>
        prev.map((x) => ({ ...x, read: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (e) {
      toastError(e);
    }
  };

  const archiveRead = async () => {
    try {
      await api.put("/notifications/archive-all");
      setItems((prev) => prev.filter((x) => !x.read));
      fetchUnread();
    } catch (e) {
      toastError(e);
    }
  };

  const archiveOne = async (e, n) => {
    e.stopPropagation();
    try {
      await api.put(`/notifications/${n.id}/archive`);
      setItems((prev) => prev.filter((x) => x.id !== n.id));
      if (!n.read) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      toastError(err);
    }
  };

  if (!canUse) {
    return null;
  }

  const unreadItems = items.filter((x) => !x.read);
  const readItems = items.filter((x) => x.read);

  const renderItem = (n) => {
    const v = notificationVisualType(n);
    return (
      <ListItem
        key={n.id}
        button
        className={!n.read ? classes.unread : undefined}
        onClick={() => markReadAndGo(n)}
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
            onClick={(e) => archiveOne(e, n)}
          >
            <ArchiveOutlinedIcon fontSize="small" />
          </IconButton>
        </ListItemSecondaryAction>
      </ListItem>
    );
  };

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
          <Button size="small" onClick={markAllRead} disabled={unreadCount === 0}>
            {i18n.t("userNotificationCenter.markAllRead")}
          </Button>
          <Button size="small" onClick={archiveRead}>
            {i18n.t("userNotificationCenter.archiveRead")}
          </Button>
          <Box flex="1" />
          <Button
            size="small"
            color="primary"
            component={RouterLink}
            to="/notifications"
            onClick={handleClose}
          >
            {i18n.t("userNotificationCenter.viewAll")}
          </Button>
        </Box>
      </Popover>
    </>
  );
}
