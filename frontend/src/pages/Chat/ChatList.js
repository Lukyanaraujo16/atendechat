import React, { useContext, useState } from "react";
import {
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  makeStyles,
  Menu,
  MenuItem,
} from "@material-ui/core";

import { useHistory, useParams } from "react-router-dom";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useDate } from "../../hooks/useDate";

import DeleteIcon from "@material-ui/icons/Delete";
import EditIcon from "@material-ui/icons/Edit";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import PersonIcon from "@material-ui/icons/Person";

import ConfirmationModal from "../../components/ConfirmationModal";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    borderRadius: 0,
    backgroundColor: "#fff",
  },
  chatList: {
    flex: 1,
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  listItem: {
    cursor: "pointer",
    paddingLeft: 12,
    paddingRight: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    backgroundColor: "#1a1a1a",
    color: "#fff",
  },
  primaryText: {
    fontWeight: 500,
    fontSize: "0.9375rem",
  },
  secondaryText: {
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  timeBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    marginLeft: 8,
  },
  timeText: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
  },
}));

export default function ChatList({
  chats,
  handleSelectChat,
  handleDeleteChat,
  handleEditChat,
  pageInfo,
  loading,
}) {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const { datetimeToClient } = useDate();

  const [confirmationModal, setConfirmModalOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState({});

  const { id } = useParams();

  const goToMessages = async (chat) => {
    if (unreadMessages(chat) > 0) {
      try {
        await api.post(`/chats/${chat.id}/read`, { userId: user.id });
      } catch (err) {
        toastError(err);
      }
    }

    if (id !== chat.uuid) {
      history.push(`/chats/${chat.uuid}`);
      handleSelectChat(chat);
    }
  };

  const handleDelete = () => {
    handleDeleteChat(selectedChat);
  };

  const unreadMessages = (chat) => {
    const currentUser = chat.users.find((u) => u.userId === user.id);
    return currentUser.unreads;
  };

  const getPrimaryText = (chat) => {
    const mainText = chat.title;
    const unreads = unreadMessages(chat);
    return (
      <>
        {mainText}
        {unreads > 0 && (
          <Chip
            size="small"
            style={{ marginLeft: 5 }}
            label={unreads}
            color="secondary"
          />
        )}
      </>
    );
  };

  const getSecondaryLine = (chat) => {
    const msg = (chat.lastMessage || "").trim();
    const text = msg ? msg : "Nenhuma mensagem ainda";
    const count = Array.isArray(chat.users) ? chat.users.length : 0;
    const part = count === 1 ? "1 participante" : `${count} participantes`;
    return `${text} · ${part}`;
  };

  const getTimeShort = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const getItemStyle = (chat) => {
    return {
      borderLeft: chat.uuid === id ? "4px solid #0c6" : "4px solid transparent",
      backgroundColor: chat.uuid === id ? "rgba(0,0,0,0.04)" : "transparent",
    };
  };

  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuChat, setMenuChat] = useState(null);

  const openMenu = (e, chat) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuChat(chat);
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuChat(null);
  };

  const handleMenuEdit = () => {
    if (menuChat) {
      goToMessages(menuChat).then(() => {
        if (typeof handleEditChat === "function") {
          handleEditChat(menuChat);
        }
      });
    }
    closeMenu();
  };

  const handleMenuDelete = () => {
    if (menuChat) {
      setSelectedChat(menuChat);
      setConfirmModalOpen(true);
    }
    closeMenu();
  };

  return (
    <>
      <ConfirmationModal
        title={i18n.t("chat.confirm.title")}
        open={confirmationModal}
        onClose={setConfirmModalOpen}
        onConfirm={handleDelete}
      >
        {i18n.t("chat.confirm.message")}
      </ConfirmationModal>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={handleMenuEdit}>{i18n.t("chat.buttons.edit")}</MenuItem>
        <MenuItem onClick={handleMenuDelete}>{i18n.t("chat.buttons.delete")}</MenuItem>
      </Menu>
      <div className={classes.mainContainer}>
        <div className={classes.chatList}>
          <List disablePadding>
            {Array.isArray(chats) &&
              chats.length > 0 &&
              chats.map((chat, key) => (
                <ListItem
                  onClick={() => goToMessages(chat)}
                  key={key}
                  className={classes.listItem}
                  style={getItemStyle(chat)}
                  button
                >
                  <ListItemAvatar>
                    <div
                      className={classes.avatar}
                      style={{
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <PersonIcon style={{ fontSize: 28 }} />
                    </div>
                  </ListItemAvatar>
                  <ListItemText
                    primary={getPrimaryText(chat)}
                    primaryTypographyProps={{ className: classes.primaryText }}
                    secondary={getSecondaryLine(chat)}
                    secondaryTypographyProps={{ className: classes.secondaryText }}
                  />
                  <div className={classes.timeBlock}>
                    <span className={classes.timeText}>{getTimeShort(chat.updatedAt)}</span>
                    {chat.ownerId === user.id && (
                      <IconButton
                        size="small"
                        onClick={(e) => openMenu(e, chat)}
                        aria-label="menu"
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    )}
                  </div>
                </ListItem>
              ))}
          </List>
        </div>
      </div>
    </>
  );
}
