import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import withWidth, { isWidthUp } from "@material-ui/core/withWidth";
import "emoji-mart/css/emoji-mart.css";
import { Picker } from "emoji-mart";
import clsx from "clsx";
import { isNil } from "lodash";

import { makeStyles, alpha } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import InputBase from "@material-ui/core/InputBase";
import CircularProgress from "@material-ui/core/CircularProgress";
import { green } from "@material-ui/core/colors";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import ImageIcon from "@material-ui/icons/Image";
import IconButton from "@material-ui/core/IconButton";
import MoodIcon from "@material-ui/icons/Mood";
import SendIcon from "@material-ui/icons/Send";
import CancelIcon from "@material-ui/icons/Cancel";
import ClearIcon from "@material-ui/icons/Clear";
import MicIcon from "@material-ui/icons/Mic";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import HighlightOffIcon from "@material-ui/icons/HighlightOff";
import { FormControlLabel, Switch } from "@material-ui/core";
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
import { SocketContext } from "../../context/Socket/SocketContext";
import { useWhatsAppPanelRecorder } from "../../hooks/useWhatsAppPanelRecorder";
import resolveQuickMessageTemplate from "../../utils/resolveQuickMessageTemplate";
import { recordRecentUse } from "../../utils/quickMessageChatStorage";
import { PANEL_RADIUS } from "../../theme/ticketPanelStyles";
import {
  canAutoFocusMessageInput,
  safeFocusMessageInput,
} from "../../utils/messageInputFocus";
import { isOrphanTicket } from "../../utils/isOrphanTicket";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  return {
  mainWrapper: {
    backgroundColor: theme.palette.background.paper,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    borderTop: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
    borderBottomRightRadius: PANEL_RADIUS,
    borderBottomLeftRadius: 0,
    boxShadow: "none",
  },
  pendingHint: {
    width: "100%",
    padding: theme.spacing(1, 2),
    textAlign: "center",
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.action.hover,
    borderBottom: `1px solid ${theme.palette.divider}`,
  },

  newMessageBox: {
    backgroundColor: theme.palette.background.paper,
    width: "100%",
    display: "flex",
    padding: theme.spacing(1, 1.25),
    alignItems: "center",
    gap: theme.spacing(0.25),
  },

  messageInputWrapper: {
    padding: theme.spacing(0.75, 1.25),
    marginRight: theme.spacing(0.75),
    backgroundColor: isDark
      ? alpha(theme.palette.common.white, 0.06)
      : alpha(theme.palette.common.black, 0.04),
    display: "flex",
    borderRadius: 999,
    flex: 1,
    border: `1px solid ${theme.palette.divider}`,
    transition: theme.transitions.create(["box-shadow", "border-color"], {
      duration: 180,
    }),
    "&:focus-within": {
      borderColor: alpha(theme.palette.success.main, 0.55),
      boxShadow: `0 0 0 3px ${alpha(theme.palette.success.main, 0.14)}`,
    },
  },

  messageInput: {
    paddingLeft: 10,
    flex: 1,
    border: "none",
    color: theme.palette.text.primary,
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

  emojiBox: {
    position: "absolute",
    bottom: 63,
    width: 40,
    borderTop: `1px solid ${theme.palette.divider}`,
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
    paddingLeft: 73,
    paddingRight: 7,
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

const EmojiOptions = (props) => {
  const { disabled, showEmoji, setShowEmoji, handleAddEmoji } = props;
  const classes = useStyles();
  return (
    <>
      <IconButton
        aria-label="emojiPicker"
        component="span"
        disabled={disabled}
        onClick={(e) => setShowEmoji((prevState) => !prevState)}
      >
        <MoodIcon className={classes.sendMessageIcons} />
      </IconButton>
      {showEmoji ? (
        <div className={classes.emojiBox}>
          <Picker
            perLine={16}
            showPreview={false}
            showSkinTones={false}
            onSelect={handleAddEmoji}
          />
        </div>
      ) : null}
    </>
  );
};

const SignSwitch = (props) => {
  const { width, setSignMessage, signMessage } = props;
  if (isWidthUp("md", width)) {
    return (
      <FormControlLabel
        style={{ marginRight: 7, color: "gray" }}
        label={i18n.t("messagesInput.signMessage")}
        labelPlacement="start"
        control={
          <Switch
            size="small"
            checked={signMessage}
            onChange={(e) => {
              setSignMessage(e.target.checked);
            }}
            name="showAllTickets"
            color="primary"
          />
        }
      />
    );
  }
  return null;
};

const FileInput = (props) => {
  const { handleChangeMedias, handleChangeSticker, disableOption } = props;
  const classes = useStyles();
  return (
    <>
      <input
        multiple
        type="file"
        id="upload-button"
        disabled={disableOption()}
        className={classes.uploadInput}
        onChange={handleChangeMedias}
      />
      <input
        type="file"
        id="sticker-upload-custom"
        accept=".webp,image/webp"
        disabled={disableOption()}
        className={classes.uploadInput}
        onChange={handleChangeSticker}
      />
      <label htmlFor="upload-button">
        <IconButton
          aria-label="upload"
          component="span"
          disabled={disableOption()}
        >
          <AttachFileIcon className={classes.sendMessageIcons} />
        </IconButton>
      </label>
      <label htmlFor="sticker-upload-custom">
        <IconButton
          aria-label={i18n.t("messagesInput.sticker")}
          component="span"
          disabled={disableOption()}
          title={i18n.t("messagesInput.sticker")}
        >
          <ImageIcon className={classes.sendMessageIcons} />
        </IconButton>
      </label>
    </>
  );
};

const ActionButtons = (props) => {
  const {
    inputMessage,
    loading,
    recording,
    ticketStatus,
    isOrphan,
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

  const { list: listQuickMessages } = useQuickMessages();
  const socketManager = useContext(SocketContext);

  const loadQuickMessageOptions = useCallback(async () => {
    const companyId = localStorage.getItem("companyId");
    if (!companyId || !user?.id) return;
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
  }, [listQuickMessages, user?.id]);

  useEffect(() => {
    loadQuickMessageOptions();
  }, [loadQuickMessageOptions]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    if (!companyId || !user?.id) return;
    const socket = socketManager.getSocket(companyId);
    const onQm = () => {
      loadQuickMessageOptions();
    };
    socket.on(`company-${companyId}-quickmessage`, onQm);
    return () => {
      socket.off(`company-${companyId}-quickmessage`, onQm);
    };
  }, [socketManager, user?.id, loadQuickMessageOptions]);

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

  const onKeyPress = (e) => {
    if (loading || e.shiftKey) return;
    else if (e.key === "Enter") {
      handleSendMessage();
    }
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
    <div className={classes.messageInputWrapper}>
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
        onKeyPress={onKeyPress}
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
  } = props;

  const focusBlockers = { transferModalOpen, quickRepliesOpen };
  const classes = useStyles();
  const isOrphan = isOrphanTicket(ticket);

  const [medias, setMedias] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef();
  const uploadAsStickerRef = useRef(false);
  const { setReplyingMessage, replyingMessage } =
    useContext(ReplyMessageContext);
  const { user } = useContext(AuthContext);

  const [signMessage, setSignMessage] = useLocalStorage("signOption", true);

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
    useWhatsAppPanelRecorder({ ticketId, setLoading });

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
      setShowEmoji(false);
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

  const handleChangeMedias = (e) => {
    if (!e.target.files) {
      return;
    }

    const selectedMedias = Array.from(e.target.files);
    setMedias(selectedMedias);
  };

  const handleInputPaste = (e) => {
    if (e.clipboardData.files[0]) {
      setMedias([e.clipboardData.files[0]]);
    }
  };

  const handleChangeSticker = (e) => {
    const file = e.target.files?.[0];
    if (file && (file.type === "image/webp" || file.name.toLowerCase().endsWith(".webp"))) {
      uploadAsStickerRef.current = true;
      setMedias([file]);
    } else if (file) {
      toastError(new Error(i18n.t("messagesInput.stickerOnlyWebp")));
    }
    e.target.value = "";
  };

  const handleUploadQuickMessageMedia = async (blob, message) => {
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
    if (uploadAsStickerRef.current) {
      formData.append("asSticker", "true");
    }
    medias.forEach((media) => {
      formData.append("medias", media);
      formData.append("body", media.name);
    });

    try {
      await api.post(`/messages/${ticketId}`, formData);
    } catch (err) {
      toastError(err);
    }

    setLoading(false);
    setMedias([]);
    uploadAsStickerRef.current = false;
  };

  const handleSendMessage = async () => {
    if (isOrphanTicket(ticket)) return;
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
      await api.post(`/messages/${ticketId}`, message);
    } catch (err) {
      toastError(err);
    }

    setInputMessage("");
    setShowEmoji(false);
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
        {replyingMessage && renderReplyingMessage(replyingMessage)}
        <div className={classes.newMessageBox}>
          <EmojiOptions
            disabled={disableOption()}
            handleAddEmoji={handleAddEmoji}
            showEmoji={showEmoji}
            setShowEmoji={setShowEmoji}
          />

          <FileInput
            disableOption={disableOption}
            handleChangeMedias={handleChangeMedias}
            handleChangeSticker={handleChangeSticker}
          />

          <SignSwitch
            width={props.width}
            setSignMessage={setSignMessage}
            signMessage={signMessage}
          />

          <CustomInput
            loading={loading}
            inputRef={inputRef}
            ticketStatus={ticketStatus}
            isOrphan={isOrphan}
            inputMessage={inputMessage}
            setInputMessage={setInputMessage}
            // handleChangeInput={handleChangeInput}
            handleSendMessage={handleSendMessage}
            handleInputPaste={handleInputPaste}
            disableOption={disableOption}
            handleQuickAnswersClick={handleQuickAnswersClick}
            resolveMessageTemplate={resolveMessageTemplate}
            onQuickMessageUsed={onQuickMessageUsed}
          />

          <ActionButtons
            inputMessage={inputMessage}
            loading={loading}
            recording={recording}
            ticketStatus={ticketStatus}
            isOrphan={isOrphan}
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

export default withWidth()(MessageInputCustom);
