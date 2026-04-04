import React, { useContext, useEffect, useRef, useState } from "react";

import { useParams, useHistory } from "react-router-dom";

import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  Grid,
  InputBase,
  makeStyles,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import AddIcon from "@material-ui/icons/Add";
import PeopleIcon from "@material-ui/icons/People";
import ChatList from "./ChatList";
import ChatMessages from "./ChatMessages";
import { UsersFilter } from "../../components/UsersFilter";
import api from "../../services/api";
import { SocketContext } from "../../context/Socket/SocketContext";

import { has, isObject } from "lodash";

import { AuthContext } from "../../context/Auth/AuthContext";
import withWidth, { isWidthUp } from "@material-ui/core/withWidth";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    padding: theme.spacing(2),
    height: `calc(100% - 48px)`,
    overflow: "hidden",
    backgroundColor: "#f4f4f4",
  },
  gridContainer: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  gridItem: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRight: "1px solid rgba(0,0,0,0.08)",
  },
  gridItemRight: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  leftPane: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    position: "relative",
  },
  chatHeader: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(1.5, 2),
    borderBottom: "1px solid rgba(0,0,0,0.08)",
    fontWeight: 600,
    fontSize: "1.125rem",
  },
  searchWrap: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(1, 2),
    borderBottom: "1px solid rgba(0,0,0,0.08)",
    backgroundColor: "#fff",
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: "0.9375rem",
  },
  listWrap: {
    flex: 1,
    overflow: "auto",
    minHeight: 0,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(4),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
  emptyIcon: {
    fontSize: 64,
    color: "rgba(0,0,0,0.2)",
    marginBottom: theme.spacing(2),
  },
  emptyTitle: {
    fontWeight: 600,
    fontSize: "1rem",
    marginBottom: theme.spacing(0.5),
    color: theme.palette.text.primary,
  },
  emptySub: {
    fontSize: "0.875rem",
    marginBottom: theme.spacing(2),
  },
  btnNewChat: {
    backgroundColor: "#1a1a1a",
    color: "#fff",
    fontWeight: 600,
    textTransform: "uppercase",
    padding: "10px 20px",
    "&:hover": {
      backgroundColor: "#333",
    },
  },
  fabNew: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: "#1a1a1a",
    color: "#fff",
    zIndex: 10,
    "&:hover": {
      backgroundColor: "#333",
    },
  },
  gridItemTab: {
    height: "92%",
    width: "100%",
  },
  btnContainer: {
    textAlign: "right",
    padding: 10,
  },
}));

export function ChatModal({
  open,
  chat,
  type,
  handleClose,
  handleLoadNewChat,
}) {
  const [users, setUsers] = useState([]);
  const [title, setTitle] = useState("");

  useEffect(() => {
    setTitle("");
    setUsers([]);
    if (type === "edit") {
      const userList = chat.users.map((u) => ({
        id: u.user.id,
        name: u.user.name,
      }));
      setUsers(userList);
      setTitle(chat.title);
    }
  }, [chat, open, type]);

  const handleSave = async () => {
    try {
      if (!title) {
        alert(i18n.t("chat.toasts.fillTitle"));
        return;
      }

      if (!users || users.length === 0) {
        alert(i18n.t("chat.toasts.fillUser"));
        return;
      }

      if (type === "edit") {
        await api.put(`/chats/${chat.id}`, {
          users,
          title,
        });
      } else {
        const { data } = await api.post("/chats", {
          users,
          title,
        });
        handleLoadNewChat(data);
      }
      handleClose();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">{i18n.t("chat.modal.title")}</DialogTitle>
      <DialogContent>
        <Grid spacing={2} container>
          <Grid xs={12} style={{ padding: 18 }} item>
            <TextField
              label={i18n.t("chat.modal.titleField")}
              placeholder={i18n.t("chat.modal.titleField")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              variant="outlined"
              size="small"
              fullWidth
            />
          </Grid>
          <Grid xs={12} item>
            <UsersFilter
              onFiltered={(users) => setUsers(users)}
              initialUsers={users}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary">
          {i18n.t("chat.buttons.close")}
        </Button>
        <Button onClick={handleSave} color="primary" variant="contained">
          {i18n.t("chat.buttons.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Chat(props) {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const history = useHistory();

  const [showDialog, setShowDialog] = useState(false);
  const [dialogType, setDialogType] = useState("new");
  const [currentChat, setCurrentChat] = useState({});
  const [chats, setChats] = useState([]);
  const [chatsPageInfo, setChatsPageInfo] = useState({ hasMore: false });
  const [messages, setMessages] = useState([]);
  const [messagesPageInfo, setMessagesPageInfo] = useState({ hasMore: false });
  const [messagesPage, setMessagesPage] = useState(1);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [searchChat, setSearchChat] = useState("");
  const isMounted = useRef(true);
  const scrollToBottomRef = useRef();
  const currentChatRef = useRef({});
  const { id } = useParams();

  useEffect(() => {
    currentChatRef.current = currentChat;
  }, [currentChat]);

  const filteredChats = React.useMemo(() => {
    if (!Array.isArray(chats)) return [];
    const q = (searchChat || "").trim().toLowerCase();
    if (!q) return chats;
    return chats.filter(
      (c) =>
        (c.title || "").toLowerCase().includes(q) ||
        (c.lastMessage || "").toLowerCase().includes(q)
    );
  }, [chats, searchChat]);

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (isMounted.current) {
      findChats().then((data) => {
        if (!data) return;
        const { records = [] } = data;
        setChats(records);
        setChatsPageInfo(data);

        if (id && records.length) {
          const chat = records.find((r) => r.uuid === id);
          if (chat) selectChat(chat);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isObject(currentChat) && has(currentChat, "id")) {
      findMessages(currentChat.id, { isLoadMore: false }).then(() => {
        if (typeof scrollToBottomRef.current === "function") {
          setTimeout(() => {
            scrollToBottomRef.current();
          }, 300);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChat]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);
    if (!socket) return;

    const onChatUser = (data) => {
      if (data.action === "create") {
        setChats((prev) => [data.record, ...prev]);
      }
      if (data.action === "update") {
        setChats((prev) =>
          prev.map((chat) =>
            chat.id === data.record.id ? { ...data.record } : chat
          )
        );
        setCurrentChat((cur) =>
          cur && cur.id === data.record.id ? data.record : cur
        );
      }
    };

    const onChatCompany = (data) => {
      if (data.action !== "delete") return;
      const deletedId = +data.id;
      setChats((prev) => prev.filter((c) => c.id !== deletedId));
      const cur = currentChatRef.current;
      if (cur && cur.id === deletedId) {
        setMessages([]);
        setMessagesPage(1);
        setMessagesPageInfo({ hasMore: false });
        setCurrentChat({});
        history.push("/chats");
      }
    };

    const userEvent = `company-${companyId}-chat-user-${user.id}`;
    const companyEvent = `company-${companyId}-chat`;

    socket.on(userEvent, onChatUser);
    socket.on(companyEvent, onChatCompany);

    return () => {
      socket.off(userEvent, onChatUser);
      socket.off(companyEvent, onChatCompany);
    };
  }, [socketManager, user.id, history]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);
    if (!socket) return;

    if (!isObject(currentChat) || !has(currentChat, "id")) return;

    const chatId = currentChat.id;
    const eventName = `company-${companyId}-chat-${chatId}`;

    const onChatRoom = (data) => {
      if (data.action === "new-message") {
        setMessages((prev) => [...prev, data.newMessage]);
        setChats((prev) =>
          prev.map((chat) =>
            chat.id === data.newMessage.chatId ? { ...data.chat } : chat
          )
        );
        if (typeof scrollToBottomRef.current === "function") {
          scrollToBottomRef.current();
        }
      }
      if (data.action === "update") {
        setChats((prev) =>
          prev.map((chat) =>
            chat.id === data.chat.id ? { ...data.chat } : chat
          )
        );
        setCurrentChat((cur) =>
          cur && cur.id === data.chat.id ? data.chat : cur
        );
        if (typeof scrollToBottomRef.current === "function") {
          scrollToBottomRef.current();
        }
      }
    };

    socket.on(eventName, onChatRoom);

    return () => {
      socket.off(eventName, onChatRoom);
    };
  }, [socketManager, currentChat?.id]);

  const selectChat = (chat) => {
    if (!chat) return;
    setMessages([]);
    setMessagesPage(1);
    setCurrentChat(chat);
    setTab(1);
  };

  const sendMessage = async (contentMessage) => {
    setMessagesLoading(true);
    try {
      await api.post(`/chats/${currentChat.id}/messages`, {
        message: contentMessage,
      });
    } catch (err) {
      toastError(err);
    }
    setMessagesLoading(false);
  };

  const deleteChat = async (chat) => {
    try {
      await api.delete(`/chats/${chat.id}`);
    } catch (err) {
      toastError(err);
    }
  };

  const findMessages = async (chatId, { isLoadMore = false } = {}) => {
    setMessagesLoading(true);
    try {
      const page = isLoadMore ? messagesPage : 1;
      const { data } = await api.get(
        `/chats/${chatId}/messages?pageNumber=${page}`
      );
      setMessagesPageInfo(data);
      if (isLoadMore) {
        setMessages((prev) => [...data.records, ...prev]);
        setMessagesPage((p) => p + 1);
      } else {
        setMessages(data.records);
        setMessagesPage(2);
      }
    } catch (err) {
      toastError(err);
      if (!isLoadMore) {
        setMessages([]);
      }
    }
    setMessagesLoading(false);
  };

  const loadMoreMessages = async () => {
    if (!messagesLoading && currentChat?.id) {
      await findMessages(currentChat.id, { isLoadMore: true });
    }
  };

  const findChats = async () => {
    setChatsLoading(true);
    try {
      const { data } = await api.get("/chats");
      return data;
    } catch (err) {
      toastError(err);
      return { records: [], count: 0, hasMore: false };
    } finally {
      setChatsLoading(false);
    }
  };

  const renderGrid = () => {
    const hasChatSelected = isObject(currentChat) && has(currentChat, "id");
    const searchTrim = (searchChat || "").trim();
    const hasSearch = searchTrim.length > 0;
    return (
      <Grid className={classes.gridContainer} container>
        <Grid className={classes.gridItem} md={4} item>
          <div className={classes.leftPane}>
            <div className={classes.chatHeader}>
              <Typography component="span" style={{ fontWeight: 600, fontSize: "1.125rem" }}>
                {i18n.t("chat.page.title")}
              </Typography>
            </div>
            <div className={classes.searchWrap}>
              <SearchIcon style={{ color: "rgba(0,0,0,0.4)" }} />
              <InputBase
                className={classes.searchInput}
                placeholder={i18n.t("chat.page.searchPlaceholder")}
                value={searchChat}
                onChange={(e) => setSearchChat(e.target.value)}
                inputProps={{ "aria-label": "buscar conversas" }}
              />
            </div>
            <div className={classes.listWrap}>
              {chatsLoading ? (
                <div className={classes.emptyState}>
                  <CircularProgress size={36} />
                  <Typography className={classes.emptySub} style={{ marginTop: 16 }}>
                    {i18n.t("chat.page.loadingConversations")}
                  </Typography>
                </div>
              ) : filteredChats.length === 0 ? (
                <div className={classes.emptyState}>
                  <PeopleIcon className={classes.emptyIcon} />
                  <Typography className={classes.emptyTitle}>
                    {hasSearch && chats.length > 0
                      ? i18n.t("chat.page.emptyNoSearchTitle")
                      : i18n.t("chat.page.emptyNoConversationsTitle")}
                  </Typography>
                  <Typography className={classes.emptySub}>
                    {hasSearch && chats.length > 0
                      ? i18n.t("chat.page.emptyNoSearchSub")
                      : i18n.t("chat.page.emptyNoConversationsSub")}
                  </Typography>
                  {!(hasSearch && chats.length > 0) && (
                    <Button
                      className={classes.btnNewChat}
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        setDialogType("new");
                        setShowDialog(true);
                      }}
                    >
                      {i18n.t("chat.page.newConversationButton")}
                    </Button>
                  )}
                </div>
              ) : (
                <ChatList
                  chats={filteredChats}
                  pageInfo={chatsPageInfo}
                  loading={chatsLoading}
                  handleSelectChat={(chat) => selectChat(chat)}
                  handleDeleteChat={(chat) => deleteChat(chat)}
                  handleEditChat={() => {
                    setDialogType("edit");
                    setShowDialog(true);
                  }}
                />
              )}
            </div>
            <Fab
              className={classes.fabNew}
              size="medium"
              aria-label="nova conversa"
              onClick={() => {
                setDialogType("new");
                setShowDialog(true);
              }}
            >
              <AddIcon />
            </Fab>
          </div>
        </Grid>
        <Grid className={classes.gridItemRight} md={8} item>
          {hasChatSelected ? (
            <ChatMessages
              chat={currentChat}
              scrollToBottomRef={scrollToBottomRef}
              pageInfo={messagesPageInfo}
              messages={messages}
              loading={messagesLoading}
              handleSendMessage={sendMessage}
              handleLoadMore={loadMoreMessages}
            />
          ) : (
            <div
              className={classes.emptyState}
              style={{
                flex: 1,
                justifyContent: "center",
                minHeight: 0,
                display: "flex",
              }}
            >
              <div>
                <PeopleIcon className={classes.emptyIcon} />
                <Typography className={classes.emptyTitle}>
                  {i18n.t("chat.page.emptySelectTitle")}
                </Typography>
                <Typography className={classes.emptySub}>
                  {i18n.t("chat.page.emptySelectSub")}
                </Typography>
              </div>
            </div>
          )}
        </Grid>
      </Grid>
    );
  };

  const renderTab = () => {
    const searchTrim = (searchChat || "").trim();
    const hasSearch = searchTrim.length > 0;
    return (
      <Grid className={classes.gridContainer} container>
        <Grid md={12} item>
          <Tabs
            value={tab}
            indicatorColor="primary"
            textColor="primary"
            onChange={(e, v) => setTab(v)}
            aria-label={i18n.t("chat.page.tabsAria")}
          >
            <Tab label={i18n.t("chat.chats")} />
            <Tab label={i18n.t("chat.messages")} />
          </Tabs>
        </Grid>
        {tab === 0 && (
          <Grid className={classes.gridItemTab} md={12} item>
            <div className={classes.searchWrap}>
              <SearchIcon style={{ color: "rgba(0,0,0,0.4)" }} />
              <InputBase
                className={classes.searchInput}
                placeholder={i18n.t("chat.page.searchPlaceholder")}
                value={searchChat}
                onChange={(e) => setSearchChat(e.target.value)}
                inputProps={{ "aria-label": "buscar conversas" }}
              />
            </div>
            <div className={classes.btnContainer}>
              <Button
                onClick={() => {
                  setDialogType("new");
                  setShowDialog(true);
                }}
                color="primary"
                variant="contained"
              >
                {i18n.t("chat.buttons.newChat")}
              </Button>
            </div>
            {chatsLoading ? (
              <div className={classes.emptyState}>
                <CircularProgress size={32} />
                <Typography variant="body2" style={{ marginTop: 12 }}>
                  {i18n.t("chat.page.loadingConversations")}
                </Typography>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className={classes.emptyState}>
                <PeopleIcon className={classes.emptyIcon} />
                <Typography className={classes.emptyTitle}>
                  {hasSearch && chats.length > 0
                    ? i18n.t("chat.page.emptyNoSearchTitle")
                    : i18n.t("chat.page.emptyNoConversationsTitle")}
                </Typography>
                <Typography className={classes.emptySub}>
                  {hasSearch && chats.length > 0
                    ? i18n.t("chat.page.emptyNoSearchSub")
                    : i18n.t("chat.page.emptyNoConversationsSub")}
                </Typography>
              </div>
            ) : (
              <ChatList
                chats={filteredChats}
                pageInfo={chatsPageInfo}
                loading={chatsLoading}
                handleSelectChat={(chat) => selectChat(chat)}
                handleDeleteChat={(chat) => deleteChat(chat)}
                handleEditChat={() => {
                  setDialogType("edit");
                  setShowDialog(true);
                }}
              />
            )}
          </Grid>
        )}
        {tab === 1 && (
          <Grid className={classes.gridItemTab} md={12} item>
            {isObject(currentChat) && has(currentChat, "id") ? (
              <ChatMessages
                chat={currentChat}
                scrollToBottomRef={scrollToBottomRef}
                pageInfo={messagesPageInfo}
                messages={messages}
                loading={messagesLoading}
                handleSendMessage={sendMessage}
                handleLoadMore={loadMoreMessages}
              />
            ) : (
              <div
                className={classes.emptyState}
                style={{ height: "100%", minHeight: 200 }}
              >
                <PeopleIcon className={classes.emptyIcon} />
                <Typography className={classes.emptyTitle}>
                  {i18n.t("chat.page.emptySelectTitle")}
                </Typography>
                <Typography className={classes.emptySub}>
                  {i18n.t("chat.page.emptySelectSub")}
                </Typography>
              </div>
            )}
          </Grid>
        )}
      </Grid>
    );
  };

  return (
    <>
      <ChatModal
        type={dialogType}
        open={showDialog}
        chat={currentChat}
        handleLoadNewChat={(data) => {
          setMessages([]);
          setMessagesPage(1);
          setCurrentChat(data);
          setTab(1);
          history.push(`/chats/${data.uuid}`);
        }}
        handleClose={() => setShowDialog(false)}
      />
      <Paper className={classes.mainContainer}>
        {isWidthUp("md", props.width) ? renderGrid() : renderTab()}
      </Paper>
    </>
  );
}

export default withWidth()(Chat);
