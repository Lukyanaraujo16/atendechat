import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import clsx from "clsx";

import ListItem from "@material-ui/core/ListItem";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import ListItemText from "@material-ui/core/ListItemText";
import Avatar from "@material-ui/core/Avatar";
import Box from "@material-ui/core/Box";
import Chip from "@material-ui/core/Chip";
import Typography from "@material-ui/core/Typography";
import GroupIcon from "@material-ui/icons/Group";
import { makeStyles, alpha } from "@material-ui/core/styles";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { showSuccessToast } from "../../errors/feedbackToasts";
import { TicketsSetContext } from "../../context/Tickets/TicketsContext";
import { useContext, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  getSubtleBorder,
  getInboxCardSurface,
  getInboxCardSurfaceHover,
  getCardElevation,
} from "../../theme/ticketPanelStyles";
import { buildTicketConversationLocation } from "../../utils/ticketConversationRoute";

const CARD_RADIUS = 14;

const useStyles = makeStyles((theme) => ({
  listItemRoot: {
    alignItems: "center",
    padding: "12px 14px",
    borderRadius: CARD_RADIUS,
    marginBottom: 10,
    width: "100%",
    border: getSubtleBorder(theme),
    backgroundColor: getInboxCardSurface(theme),
    boxShadow: getCardElevation(theme),
    borderStyle: "dashed",
    "&:hover": {
      backgroundColor: getInboxCardSurfaceHover(theme),
    },
  },
  avatar: {
    backgroundColor: alpha(theme.palette.primary.main, 0.15),
    color: theme.palette.primary.main,
  },
  title: {
    fontWeight: 600,
    fontSize: "0.9375rem",
  },
  subtitle: {
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(0.75),
  },
  chipStart: {
    fontWeight: 600,
  },
}));

function groupJidFromNumber(number) {
  const digits = String(number || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.includes("@g.us") ? digits : `${digits}@g.us`;
}

export default function GroupInboxListItem({ group, disabled, onOpened }) {
  const classes = useStyles();
  const history = useHistory();
  const setCurrentTicket = useContext(TicketsSetContext);
  const [opening, setOpening] = useState(false);

  const handleOpen = useCallback(async () => {
    if (!group?.whatsappId || opening || disabled) {
      return;
    }
    const groupId = groupJidFromNumber(group.number);
    if (!groupId) {
      toastError(new Error("invalid group"));
      return;
    }
    setOpening(true);
    try {
      const { data } = await api.post("/groups/open-conversation", {
        whatsappId: Number(group.whatsappId),
        groupId,
      });
      if (data?.uuid) {
        showSuccessToast("groups.inbox.openingConversation");
        if (typeof setCurrentTicket === "function") {
          setCurrentTicket({ id: null, uuid: data.uuid, code: uuidv4() });
        }
        history.push(
          buildTicketConversationLocation(data.uuid, {
            fromInbox: true,
            search: "?inboxTab=groups",
          })
        );
        if (typeof onOpened === "function") {
          onOpened(group.contactId);
        }
      }
    } catch (err) {
      toastError(err);
    } finally {
      setOpening(false);
    }
  }, [group, opening, disabled, history, setCurrentTicket, onOpened]);

  const subtitle = group.whatsappName
    ? `${group.whatsappName} · ${i18n.t("groups.inbox.noConversationYet")}`
    : i18n.t("groups.inbox.noConversationYet");

  return (
    <ListItem
      button
      dense
      disabled={opening || disabled || !group.whatsappId}
      className={classes.listItemRoot}
      onClick={handleOpen}
      data-group-inbox-item
    >
      <ListItemAvatar>
        <Avatar
          src={group.profilePicUrl || undefined}
          className={classes.avatar}
          alt=""
        >
          <GroupIcon />
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={
          <Typography className={classes.title} noWrap component="span">
            {group.name || group.number}
          </Typography>
        }
        secondary={
          <Box component="span" display="block">
            <Typography className={classes.subtitle} noWrap component="span">
              {subtitle}
            </Typography>
            <span className={classes.chipRow}>
              <Chip
                size="small"
                label={i18n.t("groups.inbox.chipGroup")}
                color="default"
                variant="outlined"
              />
              <Chip
                size="small"
                label={i18n.t("groups.inbox.chipNoConversation")}
                variant="outlined"
              />
              <Chip
                size="small"
                className={classes.chipStart}
                label={i18n.t("groups.inbox.chipStart")}
                color="primary"
              />
            </span>
          </Box>
        }
      />
    </ListItem>
  );
}
