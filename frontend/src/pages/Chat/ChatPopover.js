import React, {
  useContext,
  useEffect,
  useReducer,
  useState,
} from "react";
import { useHistory } from "react-router-dom";
import { alpha, makeStyles } from "@material-ui/core/styles";
import toastError from "../../errors/toastError";
import { isForbiddenPermissionError } from "../../utils/apiErrorUtils";
import Popover from "@material-ui/core/Popover";
import ForumIcon from "@material-ui/icons/Forum";
import {
  IconButton,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  Typography,
} from "@material-ui/core";
import NotificationPopoverLayout from "../../components/NotificationPopoverLayout";
import api from "../../services/api";
import { isArray } from "lodash";
import { SocketContext } from "../../context/Socket/SocketContext";
import { useDate } from "../../hooks/useDate";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useGlobalNotifications } from "../../context/GlobalNotifications/GlobalNotificationsContext";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  popoverPaper: {
    "& > div": {
      boxShadow: "none",
    },
  },
  headerIconButton: {
    color: theme.palette.action.active,
  },
  listItem: {
    border: `1px solid ${theme.palette.divider}`,
    cursor: "pointer",
    marginBottom: 4,
    backgroundColor: theme.palette.background.paper,
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  listItemAlt: {
    backgroundColor:
      theme.palette.type === "dark"
        ? alpha(theme.palette.common.white, 0.04)
        : alpha(theme.palette.common.black, 0.03),
  },
}));

const reducer = (state, action) => {
  if (action.type === "LOAD_CHATS") {
    const chats = action.payload;
    const newChats = [];

    if (isArray(chats)) {
      chats.forEach((chat) => {
        const chatIndex = state.findIndex((u) => u.id === chat.id);
        if (chatIndex !== -1) {
          state[chatIndex] = chat;
        } else {
          newChats.push(chat);
        }
      });
    }

    return [...state, ...newChats];
  }

  if (action.type === "UPDATE_CHATS") {
    const chat = action.payload;
    const chatIndex = state.findIndex((u) => u.id === chat.id);

    if (chatIndex !== -1) {
      state[chatIndex] = chat;
      return [...state];
    } else {
      return [chat, ...state];
    }
  }

  if (action.type === "DELETE_CHAT") {
    const chatId = action.payload;

    const chatIndex = state.findIndex((u) => u.id === chatId);
    if (chatIndex !== -1) {
      state.splice(chatIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }

  if (action.type === "CHANGE_CHAT") {
    const chat = action.payload.chat;
    if (!chat?.id) return state;
    const chatIndex = state.findIndex((u) => u.id === chat.id);
    if (chatIndex !== -1) {
      const next = [...state];
      next[chatIndex] = chat;
      return next;
    }
    return [chat, ...state];
  }
};

export default function ChatPopover() {
  const classes = useStyles();

  const { user } = useContext(AuthContext);
  const hasTenant =
    user?.companyId != null && user?.companyId !== "";

  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchParam] = useState("");
  const [chats, dispatch] = useReducer(reducer, []);
  const { datetimeToClient } = useDate();
  const history = useHistory();
  const { markAsReadByChat } = useGlobalNotifications();

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    if (!hasTenant) {
      return undefined;
    }
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      fetchChats();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, pageNumber, hasTenant]);

  useEffect(() => {
    if (!hasTenant || !user?.id) {
      return undefined;
    }
    const companyId = String(user.companyId);
    const socket = socketManager.getSocket(companyId);
    if (!socket) {
      return () => {};
    }

    const eventName = `company-${companyId}-chat`;
    const onCompanyChat = (data) => {
      if (data.action === "new-message") {
        dispatch({ type: "CHANGE_CHAT", payload: data });
      }
      if (data.action === "update") {
        dispatch({ type: "CHANGE_CHAT", payload: data });
      }
    };

    socket.on(eventName, onCompanyChat);
    return () => {
      socket.off(eventName, onCompanyChat);
    };
  }, [socketManager, user.id, user?.companyId, hasTenant]);

  const fetchChats = async () => {
    try {
      const { data } = await api.get("/chats/", {
        params: { searchParam, pageNumber },
      });
      dispatch({ type: "LOAD_CHATS", payload: data.records });
      setHasMore(data.hasMore);
      setLoading(false);
    } catch (err) {
      if (!isForbiddenPermissionError(err)) {
        toastError(err);
      }
      setLoading(false);
    }
  };

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const goToMessages = (chat) => {
    if (!chat) return;
    markAsReadByChat({ chatId: chat.id, chatUuid: chat.uuid });
    const pathId = chat.uuid || chat.id;
    history.push(`/chats/${pathId}`);
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = open ? "simple-popover" : undefined;

  if (!hasTenant) {
    return null;
  }

  return (
    <div>
      <Tooltip title={i18n.t("chat.popover.openTooltip")}>
        <IconButton
          aria-describedby={id}
          onClick={handleClick}
          className={classes.headerIconButton}
          aria-label={i18n.t("chat.popover.openTooltip")}
        >
          <ForumIcon />
        </IconButton>
      </Tooltip>
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
        classes={{ paper: classes.popoverPaper }}
      >
        <NotificationPopoverLayout
          title={i18n.t("chat.popover.title")}
          emptyText={i18n.t("mainDrawer.appBar.notRegister")}
          hasItems={chats.length}
          onScroll={handleScroll}
        >
          <List
            component="nav"
            aria-label="mensagens internas"
            style={{ padding: 0 }}
          >
            {isArray(chats) &&
              chats.map((item, key) => (
                <ListItem
                  key={key}
                  className={`${classes.listItem} ${key % 2 === 0 ? classes.listItemAlt : ""}`}
                  onClick={() => goToMessages(item)}
                  button
                >
                  <ListItemText
                    primary={item.lastMessage}
                    secondary={
                      <>
                        <Typography component="span" style={{ fontSize: 12 }}>
                          {datetimeToClient(item.updatedAt)}
                        </Typography>
                        <span style={{ marginTop: 5, display: "block" }}></span>
                      </>
                    }
                  />
                </ListItem>
              ))}
          </List>
        </NotificationPopoverLayout>
      </Popover>
    </div>
  );
}
