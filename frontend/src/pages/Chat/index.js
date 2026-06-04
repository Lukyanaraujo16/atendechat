import React, { useContext, useEffect, useRef, useState } from "react";

import { useParams, useHistory } from "react-router-dom";

import {
  Box,
  Fab,
  Grid,
  makeStyles,
  Paper,
  TextField,
  Typography,
} from "@material-ui/core";
import InputAdornment from "@material-ui/core/InputAdornment";
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
import { useGlobalNotifications } from "../../context/GlobalNotifications/GlobalNotificationsContext";
import { i18n } from "../../translate/i18n";
import useIsMobile from "../../hooks/useIsMobile";
import toastError from "../../errors/toastError";
import {
  AppPrimaryButton,
  AppNeutralButton,
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
  AppEmptyState,
  AppLoadingState,
  AppActionBar,
} from "../../ui";

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    minHeight: 0,
    padding: theme.spacing(2),
    height: `calc(100% - 48px)`,
    overflow: "hidden",
    backgroundColor: theme.palette.type === "light" ? theme.palette.grey[100] : theme.palette.background.default,
    [theme.breakpoints.down("md")]: {
      padding: 0,
      height: "100%",
      maxWidth: "100%",
    },
  },
  mobileInboxRoot: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    height: "100%",
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
    backgroundColor: theme.palette.background.paper,
  },
  mobileConversationRoot: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    height: "100%",
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
  },
  gridContainer: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[1],
    border: `1px solid ${theme.palette.divider}`,
  },
  gridItem: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRight: `1px solid ${theme.palette.divider}`,
    [theme.breakpoints.down("md")]: {
      borderRight: "none",
    },
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
  paneHeader: {
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  paneTitle: {
    fontWeight: 600,
  },
  searchBar: {
    padding: theme.spacing(1, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  filtersBar: {
    flexWrap: "wrap",
    alignItems: "center",
    width: "100%",
    gap: theme.spacing(1),
  },
  searchField: {
    flex: "1 1 160px",
    minWidth: 0,
  },
  listWrap: {
    flex: 1,
    overflow: "auto",
    minHeight: 0,
  },
  emptyPaneFill: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 0,
    padding: theme.spacing(2),
  },
  fabNew: {
    position: "absolute",
    bottom: 16,
    right: 16,
    zIndex: 10,
    [theme.breakpoints.down("md")]: {
      bottom: `calc(16px + env(safe-area-inset-bottom, 0px))`,
    },
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
    <AppDialog
      open={open}
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      maxWidth="sm"
    >
      <AppDialogTitle id="alert-dialog-title">{i18n.t("chat.modal.title")}</AppDialogTitle>
      <AppDialogContent dividers>
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
      </AppDialogContent>
      <AppDialogActions>
        <AppNeutralButton onClick={handleClose}>
          {i18n.t("chat.buttons.close")}
        </AppNeutralButton>
        <AppPrimaryButton onClick={handleSave}>
          {i18n.t("chat.buttons.save")}
        </AppPrimaryButton>
      </AppDialogActions>
    </AppDialog>
  );
}

function Chat() {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const history = useHistory();
  const isMobile = useIsMobile();

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
  const [searchChat, setSearchChat] = useState("");
  const isMounted = useRef(true);
  const scrollToBottomRef = useRef();
  const currentChatRef = useRef({});
  const { id } = useParams();
  const { markAsReadByChat } = useGlobalNotifications();

  useEffect(() => {
    currentChatRef.current = currentChat;
  }, [currentChat]);

  useEffect(() => {
    if (!isObject(currentChat) || !currentChat.id) return;
    markAsReadByChat({
      chatId: currentChat.id,
      chatUuid: currentChat.uuid,
    });
  }, [currentChat?.id, currentChat?.uuid, markAsReadByChat]);

  useEffect(() => {
    if (!id) return;
    markAsReadByChat({ chatId: id, chatUuid: id });
  }, [id, markAsReadByChat]);

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
          const chat = records.find((r) => r.uuid === id || String(r.id) === String(id));
          if (chat) selectChat(chat, { skipNavigation: true });
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

    const upsertChatInList = (prev, incomingChat) => {
      if (!incomingChat?.id) return prev;
      const idx = prev.findIndex((c) => c.id === incomingChat.id);
      if (idx !== -1) {
        return prev.map((c) =>
          c.id === incomingChat.id ? { ...incomingChat } : c
        );
      }
      return [incomingChat, ...prev];
    };

    const onChatCompany = (data) => {
      if (data.action === "new-message" || data.action === "update") {
        const incomingChat = data.chat || data.record;
        setChats((prev) => upsertChatInList(prev, incomingChat));
        if (data.action === "update") {
          setCurrentChat((cur) =>
            cur && incomingChat && cur.id === incomingChat.id
              ? incomingChat
              : cur
          );
        }
        return;
      }

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
        setChats((prev) => {
          if (!data.chat?.id) return prev;
          const idx = prev.findIndex((c) => c.id === data.chat.id);
          if (idx === -1) return [data.chat, ...prev];
          return prev.map((chat) =>
            chat.id === data.newMessage.chatId ? { ...data.chat } : chat
          );
        });
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

  const selectChat = (chat, { skipNavigation = false } = {}) => {
    if (!chat) return;
    markAsReadByChat({ chatId: chat.id, chatUuid: chat.uuid });
    setMessages([]);
    setMessagesPage(1);
    setCurrentChat(chat);
    const pathId = chat.uuid || chat.id;
    if (!skipNavigation && pathId) {
      history.push(`/chats/${pathId}`);
    }
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

  const sendMessageWithMedia = async ({ message, file }) => {
    setMessagesLoading(true);
    try {
      const form = new FormData();
      if (message != null) form.append("message", message);
      form.append("file", file);

      await api.post(`/chats/${currentChat.id}/messages/media`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessagesLoading(false);
      return true;
    } catch (err) {
      toastError(err);
      setMessagesLoading(false);
      return false;
    }
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

  const searchTrim = (searchChat || "").trim();
  const hasSearch = searchTrim.length > 0;
  const hasChatSelected = isObject(currentChat) && has(currentChat, "id");

  const openNewChatDialog = () => {
    setDialogType("new");
    setShowDialog(true);
  };

  const openEditChatDialog = () => {
    setDialogType("edit");
    setShowDialog(true);
  };

  const renderListPane = () => (
    <div className={classes.leftPane}>
      <Box className={classes.paneHeader}>
        <Typography
          variant="h6"
          color="primary"
          component="h1"
          className={classes.paneTitle}
        >
          {i18n.t("chat.page.title")}
        </Typography>
        <Typography variant="body2" color="textSecondary" component="p">
          {i18n.t("chat.page.subtitle")}
        </Typography>
      </Box>
      <Box className={classes.searchBar}>
        <AppActionBar className={classes.filtersBar}>
          <TextField
            className={classes.searchField}
            placeholder={i18n.t("chat.page.searchPlaceholder")}
            value={searchChat}
            onChange={(e) => setSearchChat(e.target.value)}
            variant="outlined"
            size="small"
            fullWidth
            inputProps={{ "aria-label": i18n.t("chat.page.searchPlaceholder") }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </AppActionBar>
      </Box>
      <div className={classes.listWrap}>
        {chatsLoading ? (
          <AppLoadingState message={i18n.t("chat.page.loadingConversations")} />
        ) : filteredChats.length === 0 ? (
          <AppEmptyState
            icon={PeopleIcon}
            title={
              hasSearch && chats.length > 0
                ? i18n.t("chat.page.emptyNoSearchTitle")
                : i18n.t("chat.page.emptyNoConversationsTitle")
            }
            description={
              hasSearch && chats.length > 0
                ? i18n.t("chat.page.emptyNoSearchSub")
                : i18n.t("chat.page.emptyNoConversationsSub")
            }
          >
            {!(hasSearch && chats.length > 0) && (
              <AppPrimaryButton startIcon={<AddIcon />} onClick={openNewChatDialog}>
                {i18n.t("chat.page.newConversationButton")}
              </AppPrimaryButton>
            )}
          </AppEmptyState>
        ) : (
          <ChatList
            chats={filteredChats}
            pageInfo={chatsPageInfo}
            loading={chatsLoading}
            handleSelectChat={(chat) => selectChat(chat)}
            handleDeleteChat={(chat) => deleteChat(chat)}
            handleEditChat={openEditChatDialog}
          />
        )}
      </div>
      <Fab
        className={classes.fabNew}
        color="primary"
        size="medium"
        aria-label="nova conversa"
        onClick={openNewChatDialog}
      >
        <AddIcon />
      </Fab>
    </div>
  );

  const renderMessagesPane = (mobileBack = false) => (
    <ChatMessages
      chat={currentChat}
      scrollToBottomRef={scrollToBottomRef}
      pageInfo={messagesPageInfo}
      messages={messages}
      loading={messagesLoading}
      handleSendMessage={sendMessage}
      handleSendMessageWithMedia={sendMessageWithMedia}
      handleLoadMore={loadMoreMessages}
      showBackButton={mobileBack}
      onBack={mobileBack ? () => history.push("/chats") : undefined}
    />
  );

  const renderGrid = () => (
    <Grid className={classes.gridContainer} container>
      <Grid className={classes.gridItem} md={4} item>
        {renderListPane()}
      </Grid>
      <Grid className={classes.gridItemRight} md={8} item>
        {hasChatSelected ? (
          renderMessagesPane(false)
        ) : (
          <div className={classes.emptyPaneFill}>
            <AppEmptyState
              icon={PeopleIcon}
              title={i18n.t("chat.page.emptySelectTitle")}
              description={i18n.t("chat.page.emptySelectSub")}
            />
          </div>
        )}
      </Grid>
    </Grid>
  );

  const chatModal = (
    <ChatModal
      type={dialogType}
      open={showDialog}
      chat={currentChat}
      handleLoadNewChat={(data) => {
        history.push(`/chats/${data.uuid}`);
      }}
      handleClose={() => setShowDialog(false)}
    />
  );

  if (isMobile) {
    if (id) {
      return (
        <>
          {chatModal}
          <Box
            className={classes.mobileConversationRoot}
            data-chat-mobile="conversation"
          >
            {hasChatSelected ? (
              renderMessagesPane(true)
            ) : chatsLoading ? (
              <AppLoadingState message={i18n.t("chat.page.loadingConversations")} />
            ) : (
              <div className={classes.emptyPaneFill}>
                <AppEmptyState
                  icon={PeopleIcon}
                  title={i18n.t("chat.page.emptySelectTitle")}
                  description={i18n.t("chat.page.emptySelectSub")}
                />
              </div>
            )}
          </Box>
        </>
      );
    }

    return (
      <>
        {chatModal}
        <Box className={classes.mobileInboxRoot} data-chat-mobile="inbox">
          {renderListPane()}
        </Box>
      </>
    );
  }

  return (
    <>
      {chatModal}
      <Paper className={classes.mainContainer}>{renderGrid()}</Paper>
    </>
  );
}

export default Chat;
