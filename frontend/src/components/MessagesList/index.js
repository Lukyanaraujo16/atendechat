import React, {
  useState,
  useEffect,
  useReducer,
  useRef,
  useContext,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";

import { isSameDay, parseISO, format } from "date-fns";
import clsx from "clsx";

import { green } from "@material-ui/core/colors";
import {
  Button,
  CircularProgress,
  Divider,
  IconButton,
  makeStyles,
  alpha,
} from "@material-ui/core";

import {
  AccessTime,
  Block,
  Done,
  DoneAll,
  ExpandMore,
  GetApp,
} from "@material-ui/icons";

import MarkdownWrapper from "../MarkdownWrapper";
import { getDisplayableMessageBody } from "../../utils/messages/isTechnicalMediaFallback";
import ModalImageCors from "../ModalImageCors";
import MessageOptionsMenu from "../MessageOptionsMenu";
import whatsBackground from "../../assets/wa-background.png";
import LocationPreview from "../LocationPreview";

import whatsBackgroundDark from "../../assets/wa-background-dark.png"; //DARK MODE PLW DESIGN//

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { SocketContext } from "../../context/Socket/SocketContext";
import { hasUserVisibleEnrichWarnings } from "../../utils/openTicketEnrichWarnings";
import { i18n } from "../../translate/i18n";
import { getTicketPanelScrollbarStyles } from "../../theme/ticketPanelStyles";
import { getBackendBaseURL } from "../../config/backendUrl";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  return {
  messagesListWrapper: {
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    width: "100%",
    minWidth: 300,
  },

  messagesList: {
    backgroundImage: theme.mode === 'light' ? `url(${whatsBackground})` : `url(${whatsBackgroundDark})`, //DARK MODE PLW DESIGN//
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    padding: theme.spacing(2.5, 2),
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    ...getTicketPanelScrollbarStyles(theme),
  },

  circleLoading: {
    color: green[500],
    position: "absolute",
    opacity: "70%",
    top: 0,
    left: "50%",
    marginTop: 12,
  },

  messageLeft: {
    marginRight: 20,
    marginTop: 6,
    minWidth: 100,
    maxWidth: 600,
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },

    whiteSpace: "pre-wrap",
    backgroundColor: isDark
      ? alpha(theme.palette.common.white, 0.08)
      : theme.palette.background.paper,
    color: theme.palette.text.primary,
    alignSelf: "flex-start",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 6,
    paddingBottom: 0,
    boxShadow: isDark
      ? "none"
      : `0 1px 2px ${alpha(theme.palette.common.black, 0.08)}`,
  },

  quotedContainerLeft: {
    margin: "-3px -80px 6px -6px",
    overflow: "hidden",
    backgroundColor: alpha(theme.palette.action.hover, isDark ? 0.6 : 1),
    borderRadius: 12,
    display: "flex",
    position: "relative",
  },

  quotedMsg: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    display: "block",
    whiteSpace: "pre-wrap",
    overflow: "hidden",
  },

  quotedSideColorLeft: {
    flex: "none",
    width: "4px",
    backgroundColor: theme.palette.info.main,
  },

  messageRight: {
    marginLeft: 20,
    marginTop: 6,
    minWidth: 100,
    maxWidth: 600,
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },

    whiteSpace: "pre-wrap",
    backgroundColor: isDark
      ? alpha(theme.palette.success.main, 0.22)
      : alpha(theme.palette.success.main, 0.16),
    color: theme.palette.text.primary,
    alignSelf: "flex-end",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 6,
    paddingBottom: 0,
    boxShadow: isDark
      ? "none"
      : `0 1px 2px ${alpha(theme.palette.common.black, 0.06)}`,
  },

  quotedContainerRight: {
    margin: "-3px -80px 6px -6px",
    overflowY: "hidden",
    backgroundColor: alpha(theme.palette.success.main, isDark ? 0.18 : 0.12),
    borderRadius: 12,
    display: "flex",
    position: "relative",
  },

  quotedMsgRight: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    whiteSpace: "pre-wrap",
  },

  quotedSideColorRight: {
    flex: "none",
    width: "4px",
    backgroundColor: theme.palette.success.main,
  },

  messageActionsButton: {
    display: "none",
    position: "relative",
    color: theme.palette.text.secondary,
    zIndex: 1,
    backgroundColor: "inherit",
    opacity: "90%",
    "&:hover, &.Mui-focusVisible": { backgroundColor: "inherit" },
  },

  messageContactName: {
    display: "flex",
    color: theme.palette.info.main,
    fontWeight: 600,
  },

  textContentItem: {
    overflowWrap: "break-word",
    padding: "3px 80px 6px 6px",
  },
  
  textContentItemEdited: {
    overflowWrap: "break-word",
    padding: "3px 120px 6px 6px",
  },

  textContentItemDeleted: {
    fontStyle: "italic",
    color: theme.palette.text.disabled,
    overflowWrap: "break-word",
    padding: "3px 80px 6px 6px",
  },

  messageMedia: {
    objectFit: "cover",
    width: 250,
    height: 200,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },

  timestamp: {
    fontSize: 11,
    position: "absolute",
    bottom: 0,
    right: 5,
    color: theme.palette.text.secondary,
  },

  dailyTimestamp: {
    alignItems: "center",
    textAlign: "center",
    alignSelf: "center",
    width: "110px",
    backgroundColor: alpha(theme.palette.info.main, isDark ? 0.2 : 0.12),
    margin: theme.spacing(1.25),
    borderRadius: 12,
    boxShadow: isDark
      ? "none"
      : `0 1px 2px ${alpha(theme.palette.common.black, 0.08)}`,
  },

  dailyTimestampText: {
    color: theme.palette.text.secondary,
    padding: 8,
    alignSelf: "center",
    marginLeft: "0px",
  },

  ackIcons: {
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },

  deletedIcon: {
    fontSize: 18,
    verticalAlign: "middle",
    marginRight: 4,
  },

  ackDoneAllIcon: {
    color: green[500],
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },

  downloadMedia: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "inherit",
    padding: 10,
  },

  instagramShareCard: {
    width: 250,
    maxWidth: "100%",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: alpha(theme.palette.common.white, isDark ? 0.06 : 0.72),
    marginBottom: 4,
  },

  instagramShareCardBody: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    padding: "10px 12px",
    gap: 4,
  },

  instagramShareCardActions: {
    display: "flex",
    justifyContent: "center",
    padding: "0 10px 10px",
  },
};
});

const reducer = (state, action) => {
  if (action.type === "LOAD_MESSAGES") {
    const messages = Array.isArray(action.payload) ? action.payload : [];
    const newMessages = [];

    messages.forEach((message) => {
      const messageIndex = state.findIndex((m) => m.id === message.id);
      if (messageIndex !== -1) {
        state[messageIndex] = message;
      } else {
        newMessages.push(message);
      }
    });

    return [...newMessages, ...state];
  }

  if (action.type === "ADD_MESSAGE") {
    const newMessage = action.payload;
    const messageIndex = state.findIndex((m) => m.id === newMessage.id);

    if (messageIndex !== -1) {
      state[messageIndex] = newMessage;
    } else {
      state.push(newMessage);
    }

    return [...state];
  }

  if (action.type === "UPDATE_MESSAGE") {
    const messageToUpdate = action.payload;
    const messageIndex = state.findIndex((m) => m.id === messageToUpdate.id);

    if (messageIndex !== -1) {
      state[messageIndex] = messageToUpdate;
    }

    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

export const resolveMessageTicketId = (message, data = null) => {
  const raw =
    message?.ticketId ??
    message?.ticket?.id ??
    data?.ticket?.id ??
    data?.message?.ticketId;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

const getGroupSenderDisplayName = (message) => {
  if (message?.displayParticipantName) {
    return message.displayParticipantName;
  }
  const name = message?.contact?.name?.trim();
  const number = message?.contact?.number?.trim();
  if (name && name !== number && !/^\d{14,}$/.test(name.replace(/\D/g, ""))) {
    return name;
  }
  return name || number || "";
};

const MessagesList = forwardRef(function MessagesList(
  {
    ticket,
    ticketId,
    isGroup,
    onPartialEnrichWarning,
    onLoadError,
    /** Incrementar para recarregar mensagens (ex.: ticket atualizado via socket). */
    reloadToken = 0,
  },
  ref
) {
  const classes = useStyles();

  const [messagesList, dispatch] = useReducer(reducer, []);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const lastMessageRef = useRef();

  const [selectedMessage, setSelectedMessage] = useState({});
  const [anchorEl, setAnchorEl] = useState(null);
  const messageOptionsMenuOpen = Boolean(anchorEl);
  const currentTicketId = useRef(ticketId);

  const socketManager = useContext(SocketContext);

  const scrollToBottom = useCallback(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({});
    }
  }, []);

  const appendMessage = useCallback(
    (message, data = null) => {
      if (!message?.id) return;
      const msgTicketId = resolveMessageTicketId(message, data);
      const openId = currentTicketId.current;
      if (
        msgTicketId == null ||
        openId == null ||
        Number(msgTicketId) !== Number(openId)
      ) {
        return;
      }
      dispatch({ type: "ADD_MESSAGE", payload: message });
      scrollToBottom();
      if (typeof window !== "undefined") {
        const marker = window.__sendPerfByMessageId?.[message.id];
        if (marker) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const now =
                typeof performance !== "undefined" && performance.now
                  ? performance.now()
                  : Date.now();
              console.info("[SendPerf] frontend_message_rendered", {
                ticketId: marker.ticketId,
                channel: marker.channel,
                messageId: message.id,
                durationMs: Math.round(now - marker.startedAt),
                afterApiMs: Math.round(now - marker.apiDoneAt),
              });
              delete window.__sendPerfByMessageId[message.id];
            });
          });
        }
      }
    },
    [scrollToBottom]
  );

  useImperativeHandle(ref, () => ({ appendMessage }), [appendMessage]);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);

    currentTicketId.current = ticketId;
  }, [ticketId, reloadToken]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchMessages = async () => {
        if (ticketId === undefined) return;
        try {
          const { data } = await api.get("/messages/" + ticketId, {
            params: { pageNumber },
          });

          if (currentTicketId.current === ticketId) {
            dispatch({ type: "LOAD_MESSAGES", payload: Array.isArray(data?.messages) ? data.messages : [] });
            setHasMore(data.hasMore);
            setLoading(false);
            if (
              pageNumber === 1 &&
              typeof onPartialEnrichWarning === "function" &&
              hasUserVisibleEnrichWarnings(data?.enrichWarnings)
            ) {
              onPartialEnrichWarning(data.enrichWarnings);
            }
          }

          if (pageNumber === 1 && Array.isArray(data?.messages) && data.messages.length > 1) {
            scrollToBottom();
          }
        } catch (err) {
          if (currentTicketId.current !== ticketId) {
            return;
          }
          setLoading(false);
          if (typeof onLoadError === "function") {
            onLoadError(err);
          } else {
            toastError(err);
          }
        }
      };
      fetchMessages();
    }, 500);
    return () => {
      clearTimeout(delayDebounceFn);
    };
  }, [pageNumber, ticketId, reloadToken]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    const joinRoom = () => {
      const tid = currentTicketId.current;
      if (tid) socket.emit("joinChatBox", `${tid}`);
    };

    socket.on("ready", joinRoom);

    const handleAppMessage = (data) => {
      const msgTicketId = resolveMessageTicketId(data?.message, data);
      const openId = currentTicketId.current;
      const sameOpenTicket =
        msgTicketId != null &&
        openId != null &&
        Number(msgTicketId) === Number(openId);

      if (data.action === "create" && sameOpenTicket && data.message) {
        appendMessage(data.message, data);
      }

      if (data.action === "update" && sameOpenTicket && data.message) {
        dispatch({ type: "UPDATE_MESSAGE", payload: data.message });
      }
    };

    socket.on(`company-${companyId}-appMessage`, handleAppMessage);
    joinRoom();

    return () => {
      socket.off("ready", joinRoom);
      socket.off(`company-${companyId}-appMessage`, handleAppMessage);
    };
  }, [ticketId, socketManager, appendMessage]);

  const loadMore = () => {
    setPageNumber((prevPageNumber) => prevPageNumber + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore) return;
    const { scrollTop } = e.currentTarget;

    if (scrollTop === 0) {
      document.getElementById("messagesList").scrollTop = 1;
    }

    if (loading) {
      return;
    }

    if (scrollTop < 50) {
      loadMore();
    }
  };

  const handleOpenMessageOptionsMenu = (e, message) => {
    setAnchorEl(e.currentTarget);
    setSelectedMessage(message);
  };

  const handleCloseMessageOptionsMenu = (e) => {
    setAnchorEl(null);
  };

  const renderMessageBody = (message) => {
    const displayBody = getDisplayableMessageBody(message);
    if (displayBody == null) {
      return null;
    }
    return <MarkdownWrapper>{displayBody}</MarkdownWrapper>;
  };

  const parseMessageMetaPayload = (message) => {
    if (!message?.metaPayload) return null;
    if (typeof message.metaPayload === "object") return message.metaPayload;
    try {
      return JSON.parse(message.metaPayload);
    } catch {
      return null;
    }
  };

  const INSTAGRAM_PERMALINK_PATTERN =
    /instagram\.com\/(p\/|reel\/|reels\/|tv\/|stories\/)/i;

  const LOOKASIDE_CDN_PATTERN = /lookaside\.fbsbx\.com|ig_messaging_cdn/i;

  const isLookasideCdnUrl = (url) =>
    typeof url === "string" && LOOKASIDE_CDN_PATTERN.test(url);

  const INSTAGRAM_INTERACTION_MEDIA_TYPES = new Set([
    "instagram_post",
    "instagram_reel",
    "instagram_story",
    "instagram_profile",
    "instagram_unsupported",
    "reaction",
  ]);

  const extractInstagramExternalUrl = (value) => {
    if (!value || typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    const embeddedMatch = trimmed.match(
      /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/i
    );
    if (embeddedMatch) {
      return embeddedMatch[0];
    }

    if (/^https?:\/\//i.test(trimmed) && !isLookasideCdnUrl(trimmed)) {
      return trimmed;
    }

    return null;
  };

  const resolveInstagramPublicPermalink = (value) => {
    const extracted = extractInstagramExternalUrl(value);
    if (!extracted || isLookasideCdnUrl(extracted)) {
      return null;
    }

    if (!/instagram\.com/i.test(extracted)) {
      return null;
    }

    return extracted;
  };

  const isValidInstagramSharePermalink = (mediaType, url) => {
    if (!url || isLookasideCdnUrl(url) || !/instagram\.com/i.test(url)) {
      return false;
    }

    if (mediaType === "instagram_profile") {
      return (
        !INSTAGRAM_PERMALINK_PATTERN.test(url) &&
        /instagram\.com\/[^/?#]+\/?(?:$|[?#])/i.test(url)
      );
    }

    return INSTAGRAM_PERMALINK_PATTERN.test(url);
  };

  const resolveInstagramSharePermalink = (message) => {
    const meta = parseMessageMetaPayload(message);
    const mediaType = message.mediaType;
    const candidates = [
      meta?.share?.permalink,
      meta?.permalink,
      message.mediaUrl,
    ];

    for (const candidate of candidates) {
      const resolved = resolveInstagramPublicPermalink(candidate);
      if (resolved && isValidInstagramSharePermalink(mediaType, resolved)) {
        return resolved;
      }
    }

    const shortcode = meta?.share?.shortcode;
    if (shortcode && !/^\d+$/.test(String(shortcode))) {
      if (mediaType === "instagram_reel") {
        const reelUrl = resolveInstagramPublicPermalink(
          `https://www.instagram.com/reel/${shortcode}/`
        );
        if (reelUrl && isValidInstagramSharePermalink(mediaType, reelUrl)) {
          return reelUrl;
        }
      }

      if (mediaType === "instagram_post") {
        const postUrl = resolveInstagramPublicPermalink(
          `https://www.instagram.com/p/${shortcode}/`
        );
        if (postUrl && isValidInstagramSharePermalink(mediaType, postUrl)) {
          return postUrl;
        }
      }

      if (mediaType === "instagram_profile") {
        const profileUrl = resolveInstagramPublicPermalink(
          `https://www.instagram.com/${String(shortcode).replace(/^@/, "")}/`
        );
        if (profileUrl && isValidInstagramSharePermalink(mediaType, profileUrl)) {
          return profileUrl;
        }
      }
    }

    return null;
  };

  const resolveShareThumbnailUrl = (message) => {
    const meta = parseMessageMetaPayload(message);
    const thumbnail = meta?.share?.thumbnailUrl;
    if (!thumbnail || typeof thumbnail !== "string") {
      return null;
    }

    if (/^https?:\/\//i.test(thumbnail)) {
      return thumbnail;
    }

    const base = getBackendBaseURL();
    const normalized = thumbnail.replace(/^\//, "");
    return base ? `${base}/public/${normalized}` : `/public/${normalized}`;
  };

  const isInstagramChannelMessage = (message) =>
    String(ticket?.channel || message?.channel || "").toLowerCase() ===
    "instagram";

  const shouldRenderMessageMedia = (message) =>
    Boolean(message.mediaUrl) ||
    message.mediaType === "locationMessage" ||
    message.mediaType === "vcard" ||
    INSTAGRAM_INTERACTION_MEDIA_TYPES.has(message.mediaType);

  const INSTAGRAM_SHARE_CARD_COPY = {
    instagram_post: { icon: "📷", title: "Post compartilhado" },
    instagram_reel: { icon: "🎬", title: "Reel compartilhado" },
    instagram_story: { icon: "📱", title: "Story compartilhado" },
    instagram_profile: { icon: "👤", title: "Perfil compartilhado" },
  };

  const resolveMisclassifiedInstagramShare = (message) => {
    const meta = parseMessageMetaPayload(message);
    const shareMeta = meta?.share || null;
    const permalink = resolveInstagramSharePermalink(message);
    const url = permalink || shareMeta?.rawUrl || message.mediaUrl || null;

    if (
      message.mediaType === "instagram_post" ||
      message.mediaType === "instagram_reel" ||
      message.mediaType === "instagram_story" ||
      message.mediaType === "instagram_profile"
    ) {
      return null;
    }

    const attachmentType = shareMeta?.attachmentType;
    if (attachmentType === "ig_reel" || attachmentType === "reel_share") {
      return "instagram_reel";
    }
    if (attachmentType === "ig_post" || attachmentType === "post_share") {
      return "instagram_post";
    }
    if (attachmentType === "story_share" || attachmentType === "story_mention") {
      return "instagram_story";
    }
    if (attachmentType === "profile_share") {
      return "instagram_profile";
    }

    if (shareMeta?.thumbnailUrl || shareMeta?.assetUrl || isLookasideCdnUrl(url)) {
      if (/reel/i.test(String(url || ""))) {
        return "instagram_reel";
      }
      return "instagram_post";
    }

    if (!permalink) {
      return null;
    }

    if (/reel/i.test(permalink)) {
      return "instagram_reel";
    }
    if (/stories/i.test(permalink)) {
      return "instagram_story";
    }
    if (
      /instagram\.com\/[^/?#]+\/?(?:$|[?#])/i.test(permalink) &&
      !INSTAGRAM_PERMALINK_PATTERN.test(permalink)
    ) {
      return "instagram_profile";
    }
    return "instagram_post";
  };

  const renderInstagramShareCard = (mediaType, message) => {
    const meta = parseMessageMetaPayload(message);
    const copy = INSTAGRAM_SHARE_CARD_COPY[mediaType] || {
      icon: "📱",
      title: "Conteúdo compartilhado do Instagram",
    };
    const permalink = resolveInstagramSharePermalink(message);
    const thumbnailUrl = resolveShareThumbnailUrl(message);
    const username = meta?.share?.username;
    let title = copy.title;

    if (mediaType === "instagram_profile" && username) {
      title = `Perfil compartilhado @${String(username).replace(/^@/, "")}`;
    }

    const noLinkFallback =
      mediaType === "instagram_story"
        ? "Story compartilhado do Instagram"
        : "Conteúdo compartilhado do Instagram";

    return (
      <div className={classes.instagramShareCard}>
        {thumbnailUrl ? <ModalImageCors imageUrl={thumbnailUrl} /> : null}
        <div className={classes.instagramShareCardBody}>
          <span>
            {copy.icon} {title}
          </span>
          {!permalink && (
            <span style={{ opacity: 0.85, fontSize: 13 }}>{noLinkFallback}</span>
          )}
        </div>
        {permalink ? (
          <div className={classes.instagramShareCardActions}>
            <Button
              color="primary"
              variant="outlined"
              size="small"
              target="_blank"
              rel="noopener noreferrer"
              href={permalink}
            >
              Abrir no Instagram
            </Button>
          </div>
        ) : null}
      </div>
    );
  };

  const renderInstagramUnsupportedCard = () => (
    <div className={classes.instagramShareCard}>
      <div className={classes.instagramShareCardBody}>
        <span>📱 Conteúdo compartilhado do Instagram</span>
        <span style={{ opacity: 0.85, fontSize: 13 }}>
          Este tipo de conteúdo não é disponibilizado pela API do Instagram.
        </span>
        <span style={{ opacity: 0.85, fontSize: 13 }}>
          Visualize diretamente pelo aplicativo Instagram.
        </span>
      </div>
    </div>
  );

  const renderInstagramDirectInteraction = (message) => {
    const { mediaType } = message;

    if (mediaType === "instagram_unsupported") {
      return renderInstagramUnsupportedCard();
    }

    if (mediaType === "reaction") {
      return (
        <div className={classes.downloadMedia}>
          <span>{message.body || "❤️ Reagiu à mensagem"}</span>
        </div>
      );
    }

    if (
      mediaType === "instagram_post" ||
      mediaType === "instagram_reel" ||
      mediaType === "instagram_story" ||
      mediaType === "instagram_profile"
    ) {
      return renderInstagramShareCard(mediaType, message);
    }

    return null;
  };

  const checkMessageMedia = (message) => {
    const instagramInteraction = renderInstagramDirectInteraction(message);
    if (instagramInteraction) {
      return instagramInteraction;
    }

    if (isInstagramChannelMessage(message)) {
      const misclassifiedType = resolveMisclassifiedInstagramShare(message);
      if (misclassifiedType) {
        return renderInstagramShareCard(misclassifiedType, message);
      }
    }

    if (message.mediaType === "locationMessage" && message.body.split('|').length >= 2) {
      let locationParts = message.body.split('|')
      let imageLocation = locationParts[0]
      let linkLocation = locationParts[1]

      let descriptionLocation = null

      if (locationParts.length > 2)
        descriptionLocation = message.body.split('|')[2]

      return <LocationPreview image={imageLocation} link={linkLocation} description={descriptionLocation} />
    }
    /* else if (message.mediaType === "vcard") {
      let array = message.body.split("\n");
      let obj = [];
      let contact = "";
      for (let index = 0; index < array.length; index++) {
        const v = array[index];
        let values = v.split(":");
        for (let ind = 0; ind < values.length; ind++) {
          if (values[ind].indexOf("+") !== -1) {
            obj.push({ number: values[ind] });
          }
          if (values[ind].indexOf("FN") !== -1) {
            contact = values[ind + 1];
          }
        }
      }
      return <VcardPreview contact={contact} numbers={obj[0].number} />
    } */
    /*else if (message.mediaType === "multi_vcard") {
      console.log("multi_vcard")
      console.log(message)
    	
      if(message.body !== null && message.body !== "") {
        let newBody = JSON.parse(message.body)
        return (
          <>
            {
            newBody.map(v => (
              <VcardPreview contact={v.name} numbers={v.number} />
            ))
            }
          </>
        )
      } else return (<></>)
    }*/
    else if (message.mediaType === "image" || message.mediaType === "sticker") {
      return <ModalImageCors imageUrl={message.mediaUrl} />;
    } else if (message.mediaType === "audio") {
      return <audio controls src={message.mediaUrl} preload="metadata" />;
    } else if (message.mediaType === "video") {
      return (
        <video
          className={classes.messageMedia}
          src={message.mediaUrl}
          controls
        />
      );
    } else {
      return (
        <>
          <div className={classes.downloadMedia}>
            <Button
              startIcon={<GetApp />}
              color="primary"
              variant="outlined"
              target="_blank"
              href={message.mediaUrl}
            >
              {i18n.t("messagesList.header.buttons.download")}
            </Button>
          </div>
          <div style={{marginBottom: message.body === "" ? 8 : 0}}>
            <Divider />
          </div>
        </>
      );
    }
  };

  const renderMessageAck = (message) => {
    const ack = Number(message.ack);
    const isInstagram =
      String(ticket?.channel || message?.channel || "").toLowerCase() ===
      "instagram";

    if (isInstagram && message.fromMe && ack <= 1) {
      return <Done fontSize="small" className={classes.ackIcons} />;
    }

    if (ack === 1) {
      return <AccessTime fontSize="small" className={classes.ackIcons} />;
    }
    if (ack === 2) {
      return <Done fontSize="small" className={classes.ackIcons} />;
    }
    if (ack === 3) {
      return <DoneAll fontSize="small" className={classes.ackIcons} />;
    }
    if (ack === 4 || ack === 5) {
      return <DoneAll fontSize="small" className={classes.ackDoneAllIcon} />;
    }
  };

  const renderDailyTimestamps = (message, index) => {
    if (index === 0) {
      return (
        <span
          className={classes.dailyTimestamp}
          key={`timestamp-${message.id}`}
        >
          <div className={classes.dailyTimestampText}>
            {format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy")}
          </div>
        </span>
      );
    }
    if (index < messagesList.length - 1) {
      let messageDay = parseISO(messagesList[index].createdAt);
      let previousMessageDay = parseISO(messagesList[index - 1].createdAt);

      if (!isSameDay(messageDay, previousMessageDay)) {
        return (
          <span
            className={classes.dailyTimestamp}
            key={`timestamp-${message.id}`}
          >
            <div className={classes.dailyTimestampText}>
              {format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy")}
            </div>
          </span>
        );
      }
    }
    if (index === messagesList.length - 1) {
      return (
        <div
          key={`ref-${message.createdAt}`}
          ref={lastMessageRef}
          style={{ float: "left", clear: "both" }}
        />
      );
    }
  };

  const renderNumberTicket = (message, index) => {
    if (index < messagesList.length && index > 0) {

      let messageTicket = message.ticketId;
      let connectionName = message.ticket?.whatsapp?.name;
      let previousMessageTicket = messagesList[index - 1].ticketId;

      if (messageTicket !== previousMessageTicket) {
        return (
          <center>
            <div className={classes.ticketNunberClosed}>
              Conversa encerrada: {format(parseISO(messagesList[index - 1].createdAt), "dd/MM/yyyy HH:mm:ss")}
            </div>

            <div className={classes.ticketNunberOpen}>
              Conversa iniciada: {format(parseISO(message.createdAt), "dd/MM/yyyy HH:mm:ss")}
            </div>
          </center>
        );
      }
    }
  };

  const renderMessageDivider = (message, index) => {
    if (index < messagesList.length && index > 0) {
      let messageUser = messagesList[index].fromMe;
      let previousMessageUser = messagesList[index - 1].fromMe;

      if (messageUser !== previousMessageUser) {
        return (
          <span style={{ marginTop: 16 }} key={`divider-${message.id}`}></span>
        );
      }
    }
  };

  const renderQuotedMessage = (message) => {
    return (
      <div
        className={clsx(classes.quotedContainerLeft, {
          [classes.quotedContainerRight]: message.fromMe,
        })}
      >
        <span
          className={clsx(classes.quotedSideColorLeft, {
            [classes.quotedSideColorRight]: message.quotedMsg?.fromMe,
          })}
        ></span>
        <div className={classes.quotedMsg}>
          {!message.quotedMsg?.fromMe && (
            <span className={classes.messageContactName}>
              {isGroup
                ? getGroupSenderDisplayName(message.quotedMsg)
                : message.quotedMsg?.contact?.name}
            </span>
          )}

          {message.quotedMsg.mediaType === "audio"
            && (
              <div className={classes.downloadMedia}>
                <audio
                  controls
                  src={message.quotedMsg.mediaUrl}
                  preload="metadata"
                />
              </div>
            )
          }
          {message.quotedMsg.mediaType === "video"
            && (
              <video
                className={classes.messageMedia}
                src={message.quotedMsg.mediaUrl}
                controls
              />
            )
          }
          {(message.quotedMsg.mediaType === "application" ||
            message.quotedMsg.mediaType === "document") && (
              <div className={classes.downloadMedia}>
                <Button
                  startIcon={<GetApp />}
                  color="primary"
                  variant="outlined"
                  target="_blank"
                  href={message.quotedMsg.mediaUrl}
                >
                  {message.quotedMsg.body || i18n.t("messagesList.header.buttons.download")}
                </Button>
              </div>
            )}

          {(message.quotedMsg.mediaType === "chat" ||
            message.quotedMsg.mediaType === "conversation" ||
            !message.quotedMsg.mediaUrl) &&
            getDisplayableMessageBody(message.quotedMsg) && (
              <span>{getDisplayableMessageBody(message.quotedMsg)}</span>
            )}

          {message.quotedMsg.mediaType === "image"
            && (<ModalImageCors imageUrl={message.quotedMsg.mediaUrl} />)}

          {message.quotedMsg.mediaType === "contactMessage"
            && (
                <span>{message.quotedMsg.body}</span>
              )
          }
        </div>
      </div>
    );
  };

  const renderMessages = () => {
    const list = Array.isArray(messagesList) ? messagesList : [];
    if (list.length > 0) {
      const viewMessagesList = list.map((message, index) => {

        if (message.mediaType === "call_log") {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderNumberTicket(message, index)}
              {renderMessageDivider(message, index)}
              <div className={classes.messageCenter}>
                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                  onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                >
                  <ExpandMore />
                </IconButton>
                {isGroup && (
                  <span className={classes.messageContactName}>
                    {getGroupSenderDisplayName(message)}
                  </span>
                )}
                <div>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 17" width="20" height="17">
                    <path fill="#df3333" d="M18.2 12.1c-1.5-1.8-5-2.7-8.2-2.7s-6.7 1-8.2 2.7c-.7.8-.3 2.3.2 2.8.2.2.3.3.5.3 1.4 0 3.6-.7 3.6-.7.5-.2.8-.5.8-1v-1.3c.7-1.2 5.4-1.2 6.4-.1l.1.1v1.3c0 .2.1.4.2.6.1.2.3.3.5.4 0 0 2.2.7 3.6.7.2 0 1.4-2 .5-3.1zM5.4 3.2l4.7 4.6 5.8-5.7-.9-.8L10.1 6 6.4 2.3h2.5V1H4.1v4.8h1.3V3.2z"></path>
                  </svg> <span>{i18n.t("messagesList.lostCall")} {format(parseISO(message.createdAt), "HH:mm")}</span>
                </div>
              </div>
            </React.Fragment>
          );
        }

        if (!message.fromMe) {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderNumberTicket(message, index)}
              {renderMessageDivider(message, index)}
              <div className={classes.messageLeft}>
                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                  onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                >
                  <ExpandMore />
                </IconButton>
                {isGroup && (
                  <span className={classes.messageContactName}>
                    {getGroupSenderDisplayName(message)}
                  </span>
                )}

                {/* aviso de mensagem apagado pelo contato */}
                {message.isDeleted && (
                  <div>
                    <span className={"message-deleted"}
                    >{i18n.t("messagesList.deletedMessage")} &nbsp;
                      <Block
                        color="error"
                        fontSize="small"
                        className={classes.deletedIcon}
                      />
                    </span>
                  </div>
                )}

                {shouldRenderMessageMedia(message) && checkMessageMedia(message)}
                <div className={classes.textContentItem}>
                  {message.quotedMsg && renderQuotedMessage(message)}
                  {renderMessageBody(message)}
                  <span className={classes.timestamp}>
				    {message.isEdited && <span>Editada </span>}
                    {format(parseISO(message.createdAt), "HH:mm")}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        } else {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderNumberTicket(message, index)}
              {renderMessageDivider(message, index)}
              <div className={classes.messageRight}>
                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                  onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                >
                  <ExpandMore />
                </IconButton>
                {shouldRenderMessageMedia(message) && checkMessageMedia(message)}
                <div
                  className={clsx(classes.textContentItem, {
                    [classes.textContentItemDeleted]: message.isDeleted,
					[classes.textContentItemEdited]: message.isEdited,
                  })}
                >
                  {message.isDeleted && (
                    <Block
                      color="disabled"
                      fontSize="small"
                      className={classes.deletedIcon}
                    />
                  )}
                  {message.quotedMsg && renderQuotedMessage(message)}
                  {renderMessageBody(message)}
                  <span className={classes.timestamp}>
				    {message.isEdited && <span>{i18n.t("messagesList.edited")}</span>}
                    {format(parseISO(message.createdAt), "HH:mm")}
                    {renderMessageAck(message)}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        }
      });
      return viewMessagesList;
    } else {
      return <div>{i18n.t("messagesList.saudation")}</div>;
    }
  };

  return (
    <div className={classes.messagesListWrapper}>
      <MessageOptionsMenu
        message={selectedMessage}
        anchorEl={anchorEl}
        menuOpen={messageOptionsMenuOpen}
        handleClose={handleCloseMessageOptionsMenu}
      />
      <div
        id="messagesList"
        className={classes.messagesList}
        onScroll={handleScroll}
      >
        {messagesList.length > 0 ? renderMessages() : []}
      </div>
      {loading && (
        <div>
          <CircularProgress className={classes.circleLoading} />
        </div>
      )}
    </div>
  );
});

export default MessagesList;
