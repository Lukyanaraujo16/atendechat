import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Box,
  IconButton,
  Input,
  makeStyles,
  Paper,
  Tooltip,
  Typography,
} from "@material-ui/core";
import { alpha } from "@material-ui/core/styles";
import SendIcon from "@material-ui/icons/Send";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";
import { useHistory } from "react-router-dom";

import { AuthContext } from "../../context/Auth/AuthContext";
import { useDate } from "../../hooks/useDate";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { AppLoadingState } from "../../ui";
import { resolveBackendBaseURL } from "../../config/backendUrl";

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    overflow: "hidden",
    borderRadius: 0,
    height: "100%",
    borderLeft: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    [theme.breakpoints.down("md")]: {
      borderLeft: "none",
      borderRadius: 0,
    },
  },
  chatHeader: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    flexShrink: 0,
  },
  backButton: {
    marginRight: theme.spacing(0.5),
    marginLeft: theme.spacing(-0.5),
    flexShrink: 0,
  },
  headerBody: {
    flex: 1,
    minWidth: 0,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    fontSize: "1rem",
    marginRight: theme.spacing(1.5),
  },
  headerTitle: {
    fontWeight: 600,
    fontSize: "1rem",
  },
  headerSub: {
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
    display: "block",
  },
  messageList: {
    position: "relative",
    overflowY: "auto",
    flex: 1,
    minHeight: 0,
    ...theme.scrollbarStyles,
    backgroundColor: theme.palette.background.default,
  },
  inputBar: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(1, 2),
    paddingBottom: `calc(${theme.spacing(1)}px + env(safe-area-inset-bottom, 0px))`,
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    margin: "0 8px",
    padding: "10px 14px",
    fontSize: "0.9375rem",
    backgroundColor:
      theme.palette.type === "dark"
        ? alpha(theme.palette.common.white, 0.06)
        : alpha(theme.palette.common.black, 0.05),
    color: theme.palette.text.primary,
    borderRadius: 20,
  },
  boxLeft: {
    padding: "10px 12px",
    margin: "8px 12px",
    maxWidth: 280,
    borderRadius: 12,
    borderBottomLeftRadius: 4,
    backgroundColor:
      theme.palette.type === "dark"
        ? alpha(theme.palette.common.white, 0.08)
        : theme.palette.background.paper,
    color: theme.palette.text.primary,
    border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
  },
  boxRight: {
    padding: "10px 12px",
    margin: "8px 12px 8px auto",
    maxWidth: 280,
    borderRadius: 12,
    borderBottomRightRadius: 4,
    backgroundColor:
      theme.palette.type === "dark"
        ? alpha(theme.palette.primary.main, 0.28)
        : alpha(theme.palette.primary.main, 0.12),
    color: theme.palette.text.primary,
    textAlign: "right",
    border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
  },
  mediaPreview: {
    display: "block",
    marginTop: 6,
    maxWidth: 260,
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  mediaLink: {
    display: "inline-block",
    marginTop: 6,
    textDecoration: "none",
    color: theme.palette.primary.main,
    wordBreak: "break-word",
  },
  pendingFile: {
    display: "block",
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
    margin: "4px 8px 0",
  },
}));

export default function ChatMessages({
  chat,
  messages,
  handleSendMessage,
  handleSendMessageWithMedia,
  handleLoadMore,
  scrollToBottomRef,
  pageInfo,
  loading,
  showBackButton = false,
  onBack,
}) {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const { datetimeToClient } = useDate();
  const baseRef = useRef();
  const fileInputRef = useRef(null);

  const [contentMessage, setContentMessage] = useState("");
  const [pendingFile, setPendingFile] = useState(null);

  const scrollToBottom = () => {
    if (baseRef.current) {
      baseRef.current.scrollIntoView({});
    }
  };

  const getUnreadCount = (c) => {
    if (!c || !Array.isArray(c.users)) return 0;
    const currentUser = c.users.find((u) => u.userId === user.id);
    return currentUser?.unreads ?? 0;
  };

  useEffect(() => {
    scrollToBottomRef.current = scrollToBottom;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!chat || !chat.id) return;
    if (getUnreadCount(chat) <= 0) return;

    const markRead = async () => {
      try {
        await api.post(`/chats/${chat.id}/read`, { userId: user.id });
      } catch (err) {
        toastError(err);
      }
    };
    markRead();
  }, [chat?.id, user.id]);

  const handleScroll = (e) => {
    const { scrollTop } = e.currentTarget;
    if (!pageInfo?.hasMore || loading) return;
    if (scrollTop < 600) {
      handleLoadMore();
    }
  };

  const participantCount = chat && Array.isArray(chat.users) ? chat.users.length : 0;
  const participantLabel =
    participantCount === 1 ? "1 participante" : `${participantCount} participantes`;
  const initial = (chat && chat.title ? chat.title.charAt(0).toUpperCase() : "C") || "C";

  const backendBase = resolveBackendBaseURL() || "";
  const mediaUrlFor = (relPath) => {
    if (!relPath) return "";
    const norm = String(relPath).replace(/^\/+/, "");
    return `${backendBase}/public/${norm}`;
  };

  const renderMedia = (item) => {
    if (!item?.mediaPath) return null;
    const url = mediaUrlFor(item.mediaPath);
    const mime = String(item.mimeType || "").toLowerCase();

    if (mime.startsWith("image/")) {
      return (
        <a href={url} target="_blank" rel="noreferrer">
          <img className={classes.mediaPreview} src={url} alt={item.mediaName || "imagem"} />
        </a>
      );
    }
    if (mime.startsWith("video/")) {
      return (
        <video className={classes.mediaPreview} src={url} controls preload="metadata" />
      );
    }
    if (mime.startsWith("audio/")) {
      return <audio className={classes.mediaPreview} src={url} controls preload="metadata" />;
    }
    return (
      <a className={classes.mediaLink} href={url} target="_blank" rel="noreferrer">
        {i18n.t("chat.page.openFile")}: {item.mediaName || i18n.t("chat.page.attachment")}
      </a>
    );
  };

  const humanFileSize = (bytes) => {
    const b = Number(bytes);
    if (!Number.isFinite(b) || b <= 0) return "";
    const units = ["B", "KB", "MB", "GB"];
    let v = b;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i += 1;
    }
    const rounded = v >= 10 || i === 0 ? Math.round(v) : Math.round(v * 10) / 10;
    return `${rounded} ${units[i]}`;
  };

  const handleBack = (e) => {
    if (e && typeof e.stopPropagation === "function") {
      e.stopPropagation();
    }
    if (typeof onBack === "function") {
      onBack();
      return;
    }
    history.push("/chats");
  };

  return (
    <Paper className={classes.mainContainer}>
      <div className={classes.chatHeader}>
        {showBackButton ? (
          <IconButton
            className={classes.backButton}
            size="small"
            edge="start"
            onClick={handleBack}
            aria-label={i18n.t("chat.page.backToList")}
          >
            <ArrowBackIcon />
          </IconButton>
        ) : null}
        <div className={classes.headerAvatar}>{initial}</div>
        <div className={classes.headerBody}>
          <Typography className={classes.headerTitle} noWrap>
            {chat?.title || "Chat"}
          </Typography>
          <Typography className={classes.headerSub}>{participantLabel}</Typography>
        </div>
      </div>
      <div onScroll={handleScroll} className={classes.messageList}>
        {loading && (!messages || messages.length === 0) && (
          <AppLoadingState message={i18n.t("chat.page.loadingMessages")} size={32} />
        )}
        {Array.isArray(messages) &&
          messages.map((item, key) => {
            if (item.senderId === user.id) {
              return (
                <Box key={key} className={classes.boxRight}>
                  <Typography variant="subtitle2">{item.sender.name}</Typography>
                  {item.message}
                  {renderMedia(item)}
                  <Typography variant="caption" display="block">
                    {datetimeToClient(item.createdAt)}
                  </Typography>
                </Box>
              );
            } else {
              return (
                <Box key={key} className={classes.boxLeft}>
                  <Typography variant="subtitle2">{item.sender.name}</Typography>
                  {item.message}
                  {renderMedia(item)}
                  <Typography variant="caption" display="block">
                    {datetimeToClient(item.createdAt)}
                  </Typography>
                </Box>
              );
            }
          })}
        <div ref={baseRef} />
      </div>
      <div className={classes.inputBar}>
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files && e.target.files[0];
            if (f) setPendingFile(f);
          }}
        />
        <Tooltip title={i18n.t("chat.page.attachFile")}>
          <IconButton
            size="small"
            color="primary"
            aria-label={i18n.t("chat.page.attachFile")}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            disabled={!chat?.id || loading}
          >
            <AttachFileIcon />
          </IconButton>
        </Tooltip>
        <Input
          disableUnderline
          fullWidth
          placeholder={i18n.t("chat.page.messagePlaceholder")}
          value={contentMessage}
          onKeyUp={(e) => {
            if (e.key !== "Enter") return;
            if (pendingFile && typeof handleSendMessageWithMedia === "function") {
              (async () => {
                const ok = await handleSendMessageWithMedia({
                  message: contentMessage,
                  file: pendingFile,
                });
                if (ok) {
                  setContentMessage("");
                  setPendingFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }
              })();
              return;
            }
            if (contentMessage.trim() !== "") {
              handleSendMessage(contentMessage);
              setContentMessage("");
            }
          }}
          onChange={(e) => setContentMessage(e.target.value)}
          className={classes.input}
          inputProps={{ "aria-label": i18n.t("chat.page.messageInputAria") }}
        />
        <Tooltip title={i18n.t("chat.page.sendMessage")}>
          <IconButton
            size="small"
            color="primary"
            aria-label={i18n.t("chat.page.sendMessage")}
            disabled={loading}
            onClick={() => {
              if (pendingFile && typeof handleSendMessageWithMedia === "function") {
                (async () => {
                  const ok = await handleSendMessageWithMedia({
                    message: contentMessage,
                    file: pendingFile,
                  });
                  if (ok) {
                    setContentMessage("");
                    setPendingFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }
                })();
                return;
              }
              if (contentMessage.trim() !== "") {
                handleSendMessage(contentMessage);
                setContentMessage("");
              }
            }}
          >
            <SendIcon />
          </IconButton>
        </Tooltip>
      </div>
      {pendingFile && (
        <div className={classes.pendingFile}>
          {(loading ? i18n.t("chat.page.uploadingFile") : i18n.t("chat.page.sendingFile"))}{" "}
          {pendingFile.name}
          {pendingFile.size ? ` (${humanFileSize(pendingFile.size)})` : ""}
          {" · "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (loading) return;
              setPendingFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          >
            {i18n.t("chat.page.cancelFile")}
          </a>
        </div>
      )}
    </Paper>
  );
}
