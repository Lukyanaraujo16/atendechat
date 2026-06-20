import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import "emoji-mart/css/emoji-mart.css";
import clsx from "clsx";
import { isNil } from "lodash";

import { makeStyles, alpha } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import InputBase from "@material-ui/core/InputBase";
import CircularProgress from "@material-ui/core/CircularProgress";
import Tooltip from "@material-ui/core/Tooltip";
import { green } from "@material-ui/core/colors";
import IconButton from "@material-ui/core/IconButton";
import MoodIcon from "@material-ui/icons/Mood";
import SendIcon from "@material-ui/icons/Send";
import CancelIcon from "@material-ui/icons/Cancel";
import ClearIcon from "@material-ui/icons/Clear";
import MicIcon from "@material-ui/icons/Mic";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import HighlightOffIcon from "@material-ui/icons/HighlightOff";
import CreateOutlinedIcon from "@material-ui/icons/CreateOutlined";
import Autocomplete from "@material-ui/lab/Autocomplete";
import { isString, isEmpty, isObject, has } from "lodash";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import axios from "axios";

import RecordingTimer from "./RecordingTimer";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import toastError from "../../errors/toastError";

import useQuickMessages from "../../hooks/useQuickMessages";
import usePlanFlags from "../../hooks/usePlanFlags";
import { canUseQuickRepliesFeature } from "../../utils/canUseQuickRepliesFeature";
import { SocketContext } from "../../context/Socket/SocketContext";
import { useWhatsAppPanelRecorder } from "../../hooks/useWhatsAppPanelRecorder";
import resolveQuickMessageTemplate from "../../utils/resolveQuickMessageTemplate";
import { recordRecentUse } from "../../utils/quickMessageChatStorage";
import { PANEL_RADIUS, getSubtleBorderColor, getComposerSurface, getComposerTopDivider } from "../../theme/ticketPanelStyles";
import {
  canAutoFocusMessageInput,
  safeFocusMessageInput,
} from "../../utils/messageInputFocus";
import { isOrphanTicket } from "../../utils/isOrphanTicket";
import ComposerAttachMenu from "./ComposerAttachMenu";
import ComposerEmojiStickerPanel from "./ComposerEmojiStickerPanel";
import useStickers from "../../hooks/useStickers";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  return {
  mainWrapper: {
    backgroundColor: getComposerSurface(theme),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    borderTop: "none",
    boxShadow: getComposerTopDivider(theme),
    borderBottomRightRadius: PANEL_RADIUS,
    borderBottomLeftRadius: 0,
  },
  pendingHint: {
    width: "100%",
    padding: theme.spacing(1, 2),
    textAlign: "center",
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
    backgroundColor: alpha(theme.palette.action.hover, isDark ? 0.35 : 0.5),
    borderBottom: `1px solid ${getSubtleBorderColor(theme)}`,
  },

  newMessageBox: {
    backgroundColor: getComposerSurface(theme),
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    display: "flex",
    padding: theme.spacing(1, 1.25),
    paddingBottom: `calc(${theme.spacing(1)}px + env(safe-area-inset-bottom, 0px))`,
    alignItems: "flex-end",
    gap: theme.spacing(0.5),
  },

  messageInputWrapper: {
    position: "relative",
    padding: theme.spacing(0.5, 0.75),
    backgroundColor: isDark
      ? alpha(theme.palette.common.white, 0.06)
      : alpha(theme.palette.common.black, 0.04),
    display: "flex",
    alignItems: "flex-end",
    borderRadius: 24,
    flex: 1,
    minWidth: 0,
    border: `1px solid ${getSubtleBorderColor(theme)}`,
    transition: theme.transitions.create(["box-shadow", "border-color"], {
      duration: 180,
    }),
    "&:focus-within": {
      borderColor: alpha(theme.palette.success.main, 0.55),
      boxShadow: `0 0 0 3px ${alpha(theme.palette.success.main, 0.14)}`,
    },
  },

  emojiInlineButton: {
    flexShrink: 0,
    padding: theme.spacing(0.75),
    color: theme.palette.text.secondary,
    [theme.breakpoints.down("md")]: {
      minWidth: 40,
      minHeight: 40,
    },
  },

  messageInputField: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
  },

  messageInput: {
    paddingLeft: 4,
    paddingRight: 4,
    flex: 1,
    minWidth: 0,
    border: "none",
    color: theme.palette.text.primary,
  },

  signToggleButton: {
    flexShrink: 0,
    padding: theme.spacing(0.75),
    color: theme.palette.text.disabled,
    [theme.breakpoints.down("md")]: {
      minWidth: 36,
      minHeight: 36,
    },
  },

  signToggleActive: {
    color: theme.palette.primary.main,
  },

  sendMessageIcons: {
    color: theme.palette.text.secondary,
  },

  sendButton: {
    backgroundColor: theme.palette.success.main,
    color: theme.palette.success.contrastText,
    marginLeft: theme.spacing(0.25),
    padding: theme.spacing(1),
    transition: "all 0.18s ease",
    "&:hover": {
      backgroundColor: theme.palette.success.dark,
      transform: "scale(1.06)",
      boxShadow: `0 4px 12px ${alpha(theme.palette.success.main, 0.35)}`,
    },
  },

  sendIconActive: {
    color: theme.palette.success.contrastText,
  },

  uploadInput: {
    display: "none",
  },

  viewMediaInputWrapper: {
    display: "flex",
    padding: theme.spacing(1.25, 1.5),
    position: "relative",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.palette.background.paper,
    borderTop: `1px solid ${theme.palette.divider}`,
    borderBottomRightRadius: PANEL_RADIUS,
    borderBottomLeftRadius: 0,
    overflow: "hidden",
  },

  circleLoading: {
    color: green[500],
    opacity: "70%",
    position: "absolute",
    top: "20%",
    left: "50%",
    marginLeft: -12,
  },

  audioLoading: {
    color: green[500],
    opacity: "70%",
  },

  recorderWrapper: {
    display: "flex",
    alignItems: "center",
    alignContent: "middle",
  },

  cancelAudioIcon: {
    color: "red",
  },

  sendAudioIcon: {
    color: "green",
  },

  replyginMsgWrapper: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    paddingLeft: theme.spacing(1.25),
    paddingRight: theme.spacing(1.25),
    boxSizing: "border-box",
  },

  replyginMsgContainer: {
    flex: 1,
    marginRight: 5,
    overflowY: "hidden",
    backgroundColor: alpha(theme.palette.action.hover, 0.85),
    borderRadius: 12,
    display: "flex",
    position: "relative",
  },

  replyginMsgBody: {
    padding: 10,
    height: "auto",
    display: "block",
    whiteSpace: "pre-wrap",
    overflow: "hidden",
  },

  replyginContactMsgSideColor: {
    flex: "none",
    width: "4px",
    backgroundColor: theme.palette.success.main,
  },

  replyginSelfMsgSideColor: {
    flex: "none",
    width: "4px",
    backgroundColor: theme.palette.info.main,
  },

  messageContactName: {
    display: "flex",
    color: theme.palette.info.main,
    fontWeight: 600,
  },
};
});

const ActionButtons = (props) => {
  const {
    inputMessage,
    loading,
    recording,
    ticketStatus,
    isOrphan,
    isInstagramChannel,
    handleSendMessage,
    handleCancelAudio,
    handleUploadAudio,
    handleStartRecording,
  } = props;
  const classes = useStyles();
  if (inputMessage) {
    return (
      <IconButton
        aria-label="sendMessage"
        component="span"
        className={classes.sendButton}
        onClick={handleSendMessage}
        disabled={loading}
      >
        <SendIcon className={classes.sendIconActive} />
      </IconButton>
    );
  } else if (recording) {
    return (
      <div className={classes.recorderWrapper}>
        <IconButton
          aria-label="cancelRecording"
          component="span"
          fontSize="large"
          disabled={loading}
          onClick={handleCancelAudio}
        >
          <HighlightOffIcon className={classes.cancelAudioIcon} />
        </IconButton>
        {loading ? (
          <div>
            <CircularProgress className={classes.audioLoading} />
          </div>
        ) : (
          <RecordingTimer />
        )}

        <IconButton
          aria-label="sendRecordedAudio"
          component="span"
          onClick={handleUploadAudio}
          disabled={loading}
        >
          <CheckCircleOutlineIcon className={classes.sendAudioIcon} />
        </IconButton>
      </div>
    );
  } else {
    return (
      <IconButton
        aria-label="showRecorder"
        component="span"
        disabled={loading || ticketStatus !== "open" || isOrphan}
        onClick={handleStartRecording}
      >
        <MicIcon className={classes.sendMessageIcons} />
      </IconButton>
    );
  }
};

const CustomInput = (props) => {
  const {
    loading,
    inputRef,
    ticketStatus,
    isOrphan,
    inputMessage,
    setInputMessage,
    handleSendMessage,
    handleInputPaste,
    disableOption,
    handleQuickAnswersClick,
    resolveMessageTemplate,
    onQuickMessageUsed,
  } = props;
  const classes = useStyles();
  const [quickMessages, setQuickMessages] = useState([]);
  const [options, setOptions] = useState([]);
  const [popupOpen, setPopupOpen] = useState(false);

  const { user } = useContext(AuthContext);
  const planFlags = usePlanFlags();
  const quickRepliesEnabled = canUseQuickRepliesFeature(user, planFlags);

  const { list: listQuickMessages } = useQuickMessages();
  const socketManager = useContext(SocketContext);

  const loadQuickMessageOptions = useCallback(async () => {
    const companyId = localStorage.getItem("companyId");
    if (!companyId || !user?.id || !quickRepliesEnabled) {
      setQuickMessages([]);
      return;
    }
    try {
      const messages = await listQuickMessages({ companyId, userId: user.id });
      const options = (Array.isArray(messages) ? messages : []).map((m) => {
      let truncatedMessage = m.message;
      if (isString(truncatedMessage) && truncatedMessage.length > 48) {
        truncatedMessage = m.message.substring(0, 48) + "...";
      }
      const cat = m.category ? ` · ${m.category}` : "";
      return {
        id: m.id,
        value: m.message,
        label: `/${m.shortcode} - ${truncatedMessage}${cat}`,
        shortcode: m.shortcode,
        mediaPath: m.mediaPath,
      };
      });
      setQuickMessages(options);
    } catch {
      setQuickMessages([]);
    }
  }, [listQuickMessages, user?.id, quickRepliesEnabled]);

  useEffect(() => {
    loadQuickMessageOptions();
  }, [loadQuickMessageOptions]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    if (!companyId || !user?.id || !quickRepliesEnabled) return;
    const socket = socketManager.getSocket(companyId);
    const onQm = () => {
      loadQuickMessageOptions();
    };
    socket.on(`company-${companyId}-quickmessage`, onQm);
    return () => {
      socket.off(`company-${companyId}-quickmessage`, onQm);
    };
  }, [socketManager, user?.id, loadQuickMessageOptions, quickRepliesEnabled]);

  useEffect(() => {
    if (
      isString(inputMessage) &&
      !isEmpty(inputMessage) &&
      inputMessage.startsWith("/")
    ) {
      setPopupOpen(true);
      const needle = inputMessage.toLowerCase();
      const scNeedle = needle.replace(/^\//, "");
      const filteredOptions = (quickMessages || [])
        .filter((m) => {
          if (!m.label) return false;
          const lbl = m.label.toLowerCase();
          const sc = (m.shortcode && String(m.shortcode).toLowerCase()) || "";
          return lbl.includes(needle) || (sc && sc.includes(scNeedle));
        })
        .slice(0, 50);
      setOptions(filteredOptions);
    } else {
      setPopupOpen(false);
      setOptions([]);
    }
  }, [inputMessage, quickMessages]);

  const onKeyDown = (e) => {
    if (e.key !== "Enter") return;
    if (e.shiftKey) return;
    if (popupOpen) return;
    e.preventDefault();
    e.stopPropagation();
    if (loading || disableOption()) return;
    if (!String(inputMessage || "").trim()) return;
    handleSendMessage();
  };

  const onPaste = (e) => {
    if (ticketStatus === "open" && !isOrphan) {
      handleInputPaste(e);
    }
  };

  const renderPlaceholder = () => {
    if (isOrphan) {
      return i18n.t("ticket.orphan.inputPlaceholder");
    }
    if (ticketStatus === "open") {
      return i18n.t("messagesInput.placeholderOpen");
    }
    return i18n.t("messagesInput.placeholderClosed");
  };


  const setInputRef = (input) => {
    inputRef.current = input || null;
  };

  return (
    <div className={classes.messageInputField}>
      <Autocomplete
        freeSolo
        open={popupOpen}
        id="grouped-demo"
        value={inputMessage}
        options={Array.isArray(options) ? options : []}
        closeIcon={null}
        getOptionLabel={(option) => {
          if (isObject(option)) {
            return option.label;
          } else {
            return option;
          }
        }}
        onChange={(event, opt) => {
          if (isObject(opt) && has(opt, "value") && opt.id && onQuickMessageUsed) {
            onQuickMessageUsed(opt.id);
          }
          if (isObject(opt) && has(opt, "value") && isNil(opt.mediaPath)) {
            setInputMessage(
              resolveMessageTemplate
                ? resolveMessageTemplate(opt.value)
                : opt.value
            );
            setTimeout(() => {
              inputRef.current.scrollTop = inputRef.current.scrollHeight;
            }, 200);
          } else if (isObject(opt) && has(opt, "value") && !isNil(opt.mediaPath)) {
            handleQuickAnswersClick(opt);

            setTimeout(() => {
              inputRef.current.scrollTop = inputRef.current.scrollHeight;
            }, 200);
          }
        }}
        onInputChange={(event, opt, reason) => {
          if (reason === "input") {
            setInputMessage(event.target.value);
          }
        }}
        onPaste={onPaste}
        style={{ width: "100%" }}
        renderInput={(params) => {
          const { InputLabelProps, InputProps, ...rest } = params;
          return (
            <InputBase
              {...params.InputProps}
              {...rest}
              disabled={disableOption()}
              inputRef={setInputRef}
              placeholder={renderPlaceholder()}
              multiline
              className={classes.messageInput}
              maxRows={5}
              onKeyDown={onKeyDown}
            />
          );
        }}
      />
    </div>
  );
};

const MessageInputCustom = (props) => {
  const {
    ticketStatus,
    ticketId,
    chatInputControllerRef,
    contact,
    ticket,
    transferModalOpen = false,
    quickRepliesOpen = false,
    onOpenQuickReplies,
    onMessageSent,
  } = props;

  const focusBlockers = { transferModalOpen, quickRepliesOpen };
  const classes = useStyles();
  const isOrphan = isOrphanTicket(ticket);
  const isInstagramChannel =
    String(ticket?.channel || "").toLowerCase() === "instagram";

  const [medias, setMedias] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [composerPanelOpen, setComposerPanelOpen] = useState(false);
  const [composerPanelTab, setComposerPanelTab] = useState("emoji");
  const [sendingStickerId, setSendingStickerId] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef();
  const { setReplyingMessage, replyingMessage } =
    useContext(ReplyMessageContext);
  const { user } = useContext(AuthContext);
  const planFlags = usePlanFlags();
  const quickRepliesEnabled = canUseQuickRepliesFeature(user, planFlags);

  const [signMessage, setSignMessage] = useLocalStorage("signOption", true);
  const documentInputRef = useRef(null);
  const mediaInputRef = useRef(null);
  const instagramImageInputRef = useRef(null);
  const instagramVideoInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const { sendStickerToTicket } = useStickers();
  const canManageStickers =
    user?.profile === "admin" || user?.profile === "supervisor";

  const resolveMessageTemplate = useCallback(
    (text) =>
      resolveQuickMessageTemplate(text, {
        contact,
        ticket,
        user,
        greeting: i18n.t("quickMessages.chat.greetingDefault"),
      }),
    [contact, ticket, user]
  );

  const onQuickMessageUsed = useCallback(
    (messageId) => {
      if (user?.id && messageId) {
        recordRecentUse(user.id, messageId, 10);
      }
    },
    [user?.id]
  );

  const { recording, handleStartRecording, handleUploadAudio, handleCancelAudio } =
    useWhatsAppPanelRecorder({
      ticketId,
      setLoading,
      defaultUploadBody: isInstagramChannel ? "Áudio" : undefined,
      onMessageSent,
    });

  useEffect(() => {
    if (!replyingMessage || !inputRef.current) return;
    if (!canAutoFocusMessageInput(focusBlockers)) return;
    safeFocusMessageInput(inputRef.current, focusBlockers, "replyingMessage");
  }, [replyingMessage, transferModalOpen, quickRepliesOpen]);

  useEffect(() => {
    if (inputRef.current && canAutoFocusMessageInput(focusBlockers)) {
      safeFocusMessageInput(inputRef.current, focusBlockers, "ticketId");
    }
    return () => {
      setInputMessage("");
      setComposerPanelOpen(false);
      setMedias([]);
      setReplyingMessage(null);
    };
  }, [ticketId, setReplyingMessage, transferModalOpen, quickRepliesOpen]);

  // const handleChangeInput = e => {
  // 	if (isObject(e) && has(e, 'value')) {
  // 		setInputMessage(e.value);
  // 	} else {
  // 		setInputMessage(e.target.value)
  // 	}
  // };

  const handleAddEmoji = (e) => {
    let emoji = e.native;
    setInputMessage((prevState) => prevState + emoji);
  };

  const handleChangeMedias = (e, options = {}) => {
    if (!e.target.files) {
      return;
    }

    let selectedMedias = Array.from(e.target.files);
    const { allowedPrefix } = options;

    if (isInstagramChannel) {
      selectedMedias = selectedMedias.filter((file) => {
        const type = String(file.type || "");
        if (allowedPrefix) {
          return type.startsWith(allowedPrefix);
        }
        return type.startsWith("image/") || type.startsWith("video/") || type.startsWith("audio/");
      });
      if (!selectedMedias.length) {
        return;
      }
    }

    setMedias(selectedMedias);
    e.target.value = "";
  };

  const handleInputPaste = (e) => {
    const pastedFile = e.clipboardData.files[0];
    if (!pastedFile) {
      return;
    }

    if (isInstagramChannel) {
      const type = String(pastedFile.type || "");
      if (type.startsWith("image/") || type.startsWith("video/") || type.startsWith("audio/")) {
        setMedias([pastedFile]);
      }
      return;
    }

    setMedias([pastedFile]);
  };

  const openComposerPanel = useCallback((tab = "emoji") => {
    setComposerPanelTab(tab);
    setComposerPanelOpen(true);
  }, []);

  const handleStickerSend = useCallback(
    async (sticker) => {
      if (isInstagramChannel || isOrphan || !ticketId || !sticker?.id || loading) return;
      setSendingStickerId(sticker.id);
      setLoading(true);
      try {
        const message = await sendStickerToTicket(ticketId, sticker.id);
        setComposerPanelOpen(false);
        if (message && typeof onMessageSent === "function") {
          onMessageSent(message);
        }
      } catch (err) {
        toastError(err);
      } finally {
        setSendingStickerId(null);
        setLoading(false);
      }
    },
    [isInstagramChannel, isOrphan, ticketId, loading, sendStickerToTicket, onMessageSent]
  );

  const handleUploadQuickMessageMedia = async (blob, message) => {
    if (isInstagramChannel) {
      return;
    }
    setLoading(true);
    try {
      const extension = blob.type.split("/")[1];
      const body = resolveMessageTemplate(String(message || ""));

      const formData = new FormData();
      const filename = `${new Date().getTime()}.${extension}`;
      formData.append("medias", blob, filename);
      formData.append("body",  body);
      formData.append("fromMe", true);

      await api.post(`/messages/${ticketId}`, formData);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
    setLoading(false);
  };
  
  const handleQuickAnswersClick = async (value) => {
    if (value.mediaPath) {
      if (isInstagramChannel) {
        return;
      }

      try {
        const { data } = await axios.get(value.mediaPath, {
          responseType: "blob",
        });

        handleUploadQuickMessageMedia(data, value.value);
        setInputMessage("");
        return;
        //  handleChangeMedias(response)
      } catch (err) {
        toastError(err);
      }
    }

    setInputMessage("");
    setInputMessage(resolveMessageTemplate(value.value));
  };

  const quickApplyFromModalRef = useRef();
  quickApplyFromModalRef.current = (row) => {
    if (!row) return;
    if (row.id) {
      onQuickMessageUsed(row.id);
    }
    if (row.mediaPath) {
      handleQuickAnswersClick({
        id: row.id,
        value: row.message,
        shortcode: row.shortcode,
        mediaPath: row.mediaPath,
        label: `/${row.shortcode}`,
      });
    } else {
      setInputMessage(resolveMessageTemplate(row.message || ""));
      setTimeout(() => {
        safeFocusMessageInput(inputRef.current, focusBlockers, "quickApplyFromModal");
      }, 0);
    }
  };

  useEffect(() => {
    if (!chatInputControllerRef) return;
    chatInputControllerRef.current = {
      setDraft: (t) => {
        setInputMessage(
          resolveMessageTemplate
            ? resolveMessageTemplate(t)
            : t
        );
        setTimeout(() => {
          safeFocusMessageInput(inputRef.current, focusBlockers, "chatInputController.setDraft");
        }, 0);
      },
      focus: () => {
        safeFocusMessageInput(inputRef.current, focusBlockers, "chatInputController.focus");
      },
      applyQuick: (row) => quickApplyFromModalRef.current?.(row),
    };
    return () => {
      if (chatInputControllerRef) {
        chatInputControllerRef.current = null;
      }
    };
  }, [
    chatInputControllerRef,
    resolveMessageTemplate,
    transferModalOpen,
    quickRepliesOpen,
  ]);

  const handleUploadMedia = async (e) => {
    if (isOrphan) return;
    setLoading(true);
    e.preventDefault();

    const formData = new FormData();
    formData.append("fromMe", true);
    medias.forEach((media) => {
      formData.append("medias", media);
      const fallbackBody = isInstagramChannel
        ? String(media.type || "").startsWith("video/")
          ? "Vídeo"
          : String(media.type || "").startsWith("audio/")
            ? "Áudio"
            : "Imagem"
        : media.name;
      formData.append("body", inputMessage.trim() || fallbackBody);
    });

    try {
      const { data } = await api.post(`/messages/${ticketId}`, formData);
      if (data?.message && typeof onMessageSent === "function") {
        onMessageSent(data.message);
      }
      setInputMessage("");
      setComposerPanelOpen(false);
      setReplyingMessage(null);
    } catch (err) {
      toastError(err);
    }

    setLoading(false);
    setMedias([]);
  };

  const handleSendMessage = async () => {
    if (isOrphanTicket(ticket)) return;
    if (loading) return;
    if (inputMessage.trim() === "") return;
    setLoading(true);

    const message = {
      read: 1,
      fromMe: true,
      mediaUrl: "",
      body: signMessage
        ? `*${user?.name}:*\n${inputMessage.trim()}`
        : inputMessage.trim(),
      quotedMsg: replyingMessage,
    };
    try {
      const { data } = await api.post(`/messages/${ticketId}`, message);
      if (data?.message && typeof onMessageSent === "function") {
        onMessageSent(data.message);
      }
    } catch (err) {
      toastError(err);
    }

    setInputMessage("");
    setComposerPanelOpen(false);
    setLoading(false);
    setReplyingMessage(null);
  };

  const disableOption = () => {
    return loading || recording || ticketStatus !== "open" || isOrphan;
  };

  const renderReplyingMessage = (message) => {
    return (
      <div className={classes.replyginMsgWrapper}>
        <div className={classes.replyginMsgContainer}>
          <span
            className={clsx(classes.replyginContactMsgSideColor, {
              [classes.replyginSelfMsgSideColor]: !message.fromMe,
            })}
          ></span>
          <div className={classes.replyginMsgBody}>
            {!message.fromMe && (
              <span className={classes.messageContactName}>
                {message.contact?.name}
              </span>
            )}
            {message.body}
          </div>
        </div>
        <IconButton
          aria-label="showRecorder"
          component="span"
          disabled={loading || ticketStatus !== "open"}
          onClick={() => setReplyingMessage(null)}
        >
          <ClearIcon className={classes.sendMessageIcons} />
        </IconButton>
      </div>
    );
  };

  if (medias.length > 0)
    return (
      <Paper elevation={0} square className={classes.viewMediaInputWrapper}>
        <IconButton
          aria-label="cancel-upload"
          component="span"
          onClick={(e) => setMedias([])}
        >
          <CancelIcon className={classes.sendMessageIcons} />
        </IconButton>

        {loading ? (
          <div>
            <CircularProgress className={classes.circleLoading} />
          </div>
        ) : (
          <span>
            {medias[0]?.name}
            {/* <img src={media.preview} alt=""></img> */}
          </span>
        )}
        <IconButton
          aria-label="send-upload"
          component="span"
          onClick={handleUploadMedia}
          disabled={loading}
        >
          <SendIcon className={classes.sendMessageIcons} />
        </IconButton>
      </Paper>
    );
  else {
    return (
      <Paper square elevation={0} className={classes.mainWrapper}>
        {isOrphan && (
          <div className={classes.pendingHint} data-ticket-orphan-input-hint>
            {i18n.t("ticket.orphan.inputHint")}
          </div>
        )}
        {ticketStatus === "pending" && !isOrphan && (
          <div className={classes.pendingHint} data-ticket-pending-input-hint>
            {i18n.t("ticket.pendingPreview.inputHint")}
          </div>
        )}
        {isInstagramChannel && (
          <div className={classes.pendingHint} data-ticket-instagram-input-hint>
            {i18n.t("messagesInput.instagramImageHint")}
          </div>
        )}
        {replyingMessage && renderReplyingMessage(replyingMessage)}
        <div className={classes.newMessageBox}>
          <input
            ref={documentInputRef}
            type="file"
            multiple
            className={classes.uploadInput}
            disabled={disableOption() || isInstagramChannel}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.csv,.xml,.json,.odt,.ods,.pages,.key,.numbers"
            onChange={handleChangeMedias}
          />
          <input
            ref={mediaInputRef}
            type="file"
            multiple
            className={classes.uploadInput}
            disabled={disableOption() || isInstagramChannel}
            accept="image/*,video/*"
            onChange={handleChangeMedias}
          />
          <input
            ref={instagramImageInputRef}
            type="file"
            multiple
            className={classes.uploadInput}
            disabled={disableOption() || !isInstagramChannel}
            accept="image/*"
            onChange={(e) => handleChangeMedias(e, { allowedPrefix: "image/" })}
          />
          <input
            ref={instagramVideoInputRef}
            type="file"
            multiple
            className={classes.uploadInput}
            disabled={disableOption() || !isInstagramChannel}
            accept="video/mp4,video/quicktime,.mp4,.mov"
            onChange={(e) => handleChangeMedias(e, { allowedPrefix: "video/" })}
          />
          <input
            ref={cameraInputRef}
            type="file"
            className={classes.uploadInput}
            disabled={disableOption() || isInstagramChannel}
            accept="image/*"
            capture="environment"
            onChange={handleChangeMedias}
          />
          <ComposerAttachMenu
            disabled={disableOption()}
            instagramImageMode={isInstagramChannel}
            quickRepliesEnabled={quickRepliesEnabled}
            onMenuOpen={() => setComposerPanelOpen(false)}
            onPickDocument={() => documentInputRef.current?.click()}
            onPickMedia={() => mediaInputRef.current?.click()}
            onPickInstagramImage={() => instagramImageInputRef.current?.click()}
            onPickInstagramVideo={() => instagramVideoInputRef.current?.click()}
            onPickCamera={() => cameraInputRef.current?.click()}
            onOpenStickerLibrary={() => openComposerPanel("stickers")}
            onStartRecording={() => {
              if (!disableOption()) {
                handleStartRecording();
              }
            }}
            onOpenQuickReplies={() => {
              if (quickRepliesEnabled && typeof onOpenQuickReplies === "function") {
                onOpenQuickReplies();
              }
            }}
          />

          <div className={classes.messageInputWrapper}>
            <IconButton
              aria-label="emojiPicker"
              className={classes.emojiInlineButton}
              disabled={disableOption()}
              onClick={() => {
                if (composerPanelOpen && composerPanelTab === "emoji") {
                  setComposerPanelOpen(false);
                } else {
                  openComposerPanel("emoji");
                }
              }}
            >
              <MoodIcon fontSize="small" />
            </IconButton>

            <ComposerEmojiStickerPanel
              open={composerPanelOpen}
              onClose={() => setComposerPanelOpen(false)}
              initialTab={composerPanelTab}
              onEmojiSelect={handleAddEmoji}
              onStickerSend={handleStickerSend}
              canManageStickers={canManageStickers}
              sendingStickerId={sendingStickerId}
              stickersEnabled={!isInstagramChannel}
            />

            <CustomInput
              loading={loading}
              inputRef={inputRef}
              ticketStatus={ticketStatus}
              isOrphan={isOrphan}
              inputMessage={inputMessage}
              setInputMessage={setInputMessage}
              handleSendMessage={handleSendMessage}
              handleInputPaste={handleInputPaste}
              disableOption={disableOption}
              handleQuickAnswersClick={handleQuickAnswersClick}
              resolveMessageTemplate={resolveMessageTemplate}
              onQuickMessageUsed={onQuickMessageUsed}
            />

            <Tooltip title={i18n.t("messagesInput.signMessage")}>
              <IconButton
                aria-label={i18n.t("messagesInput.signMessage")}
                className={clsx(classes.signToggleButton, {
                  [classes.signToggleActive]: signMessage,
                })}
                disabled={disableOption()}
                onClick={() => setSignMessage((prev) => !prev)}
              >
                <CreateOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>

          <ActionButtons
            inputMessage={inputMessage}
            loading={loading}
            recording={recording}
            ticketStatus={ticketStatus}
            isOrphan={isOrphan}
            isInstagramChannel={isInstagramChannel}
            handleSendMessage={handleSendMessage}
            handleCancelAudio={handleCancelAudio}
            handleUploadAudio={handleUploadAudio}
            handleStartRecording={handleStartRecording}
          />
        </div>
      </Paper>
    );
  }
};

export default MessageInputCustom;
