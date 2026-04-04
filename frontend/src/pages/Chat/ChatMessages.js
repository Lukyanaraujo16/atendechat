import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Box,
  CircularProgress,
  IconButton,
  Input,
  makeStyles,
  Paper,
  Typography,
} from "@material-ui/core";
import SendIcon from "@material-ui/icons/Send";

import { AuthContext } from "../../context/Auth/AuthContext";
import { useDate } from "../../hooks/useDate";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    overflow: "hidden",
    borderRadius: 0,
    height: "100%",
    borderLeft: "1px solid rgba(0, 0, 0, 0.08)",
    backgroundColor: "#fff",
  },
  chatHeader: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(1.5, 2),
    borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
    backgroundColor: "#fff",
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    backgroundColor: "#2196f3",
    color: "#fff",
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
    backgroundColor: "#fafafa",
  },
  loadingWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
    flexDirection: "column",
    gap: theme.spacing(1),
  },
  inputBar: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(1, 2),
    borderTop: "1px solid rgba(0, 0, 0, 0.08)",
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    margin: "0 8px",
    padding: "10px 14px",
    fontSize: "0.9375rem",
    backgroundColor: "#f0f0f0",
    borderRadius: 20,
  },
  boxLeft: {
    padding: "10px 12px",
    margin: "8px 12px",
    maxWidth: 280,
    borderRadius: 12,
    borderBottomLeftRadius: 4,
    backgroundColor: "#e8e8e8",
    border: "1px solid rgba(0, 0, 0, 0.06)",
  },
  boxRight: {
    padding: "10px 12px",
    margin: "8px 12px 8px auto",
    maxWidth: 280,
    borderRadius: 12,
    borderBottomRightRadius: 4,
    backgroundColor: "#dcf8c6",
    textAlign: "right",
    border: "1px solid rgba(0, 0, 0, 0.06)",
  },
}));

export default function ChatMessages({
  chat,
  messages,
  handleSendMessage,
  handleLoadMore,
  scrollToBottomRef,
  pageInfo,
  loading,
}) {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const { datetimeToClient } = useDate();
  const baseRef = useRef();

  const [contentMessage, setContentMessage] = useState("");

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

  return (
    <Paper className={classes.mainContainer}>
      <div className={classes.chatHeader}>
        <div className={classes.headerAvatar}>{initial}</div>
        <div>
          <Typography className={classes.headerTitle}>{chat?.title || "Chat"}</Typography>
          <Typography className={classes.headerSub}>{participantLabel}</Typography>
        </div>
      </div>
      <div onScroll={handleScroll} className={classes.messageList}>
        {loading && (!messages || messages.length === 0) && (
          <div className={classes.loadingWrap}>
            <CircularProgress size={28} />
            <Typography variant="body2">
              {i18n.t("chat.page.loadingMessages")}
            </Typography>
          </div>
        )}
        {Array.isArray(messages) &&
          messages.map((item, key) => {
            if (item.senderId === user.id) {
              return (
                <Box key={key} className={classes.boxRight}>
                  <Typography variant="subtitle2">{item.sender.name}</Typography>
                  {item.message}
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
        <Input
          disableUnderline
          fullWidth
          placeholder={i18n.t("chat.page.messagePlaceholder")}
          value={contentMessage}
          onKeyUp={(e) => {
            if (e.key === "Enter" && contentMessage.trim() !== "") {
              handleSendMessage(contentMessage);
              setContentMessage("");
            }
          }}
          onChange={(e) => setContentMessage(e.target.value)}
          className={classes.input}
          inputProps={{ "aria-label": "mensagem" }}
        />
        <IconButton
          size="small"
          aria-label="enviar"
          onClick={() => {
            if (contentMessage.trim() !== "") {
              handleSendMessage(contentMessage);
              setContentMessage("");
            }
          }}
        >
          <SendIcon />
        </IconButton>
      </div>
    </Paper>
  );
}
