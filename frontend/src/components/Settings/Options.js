import React, { useEffect, useState, useRef, useCallback } from "react";

import Grid from "@material-ui/core/Grid";
import Box from "@material-ui/core/Box";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import FormHelperText from "@material-ui/core/FormHelperText";
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Tooltip from "@material-ui/core/Tooltip";
import IconButton from "@material-ui/core/IconButton";
import Chip from "@material-ui/core/Chip";
import InfoOutlined from "@material-ui/icons/InfoOutlined";
import CheckCircleOutline from "@material-ui/icons/CheckCircleOutline";
import Divider from "@material-ui/core/Divider";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import useSettings from "../../hooks/useSettings";
import { makeStyles, alpha } from "@material-ui/core/styles";
import { grey, blue } from "@material-ui/core/colors";
import Switch from "@material-ui/core/Switch";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import { i18n } from "../../translate/i18n";
import { useHistory } from "react-router-dom";
import { AuthContext } from "../../context/Auth/AuthContext";
import { canManageWhatsappBehavior } from "../../utils/canManageWhatsappBehavior";
import useWhatsappBehaviorSettings from "../../hooks/useWhatsappBehaviorSettings";
import { showSuccessToast } from "../../errors/feedbackToasts";
import Alert from "@material-ui/lab/Alert";

//import 'react-toastify/dist/ReactToastify.css';
 
const useStyles = makeStyles((theme) => ({
  container: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4),
  },
  fixedHeightPaper: {
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
    height: 240,
  },
  tab: {
    backgroundColor: theme.palette.options,  //DARK MODE PLW DESIGN//
    borderRadius: 4,
    width: "100%",
    "& .MuiTab-wrapper": {
      color: theme.palette.fontecor,
    },   //DARK MODE PLW DESIGN//
    "& .MuiTabs-flexContainer": {
      justifyContent: "center"
    }


  },
  paper: {
    padding: theme.spacing(2),
    display: "flex",
    alignItems: "center",
    marginBottom: 12,
    width: "100%",
  },
  cardAvatar: {
    fontSize: "55px",
    color: grey[500],
    backgroundColor: "#ffffff",
    width: theme.spacing(7),
    height: theme.spacing(7),
  },
  cardTitle: {
    fontSize: "18px",
    color: blue[700],
  },
  cardSubtitle: {
    color: grey[600],
    fontSize: "14px",
  },
  alignRight: {
    textAlign: "right",
  },
  fullWidth: {
    width: "100%",
  },
  selectContainer: {
    width: "100%",
    textAlign: "left",
  },
  sectionPaper: {
    padding: theme.spacing(3),
    width: "100%",
  },
  sectionTitle: {
    fontWeight: 600,
  },
  connectionTabsPaper: {
    padding: theme.spacing(2, 2, 0),
    width: "100%",
  },
  connectionTabs: {
    borderBottom: `1px solid ${theme.palette.divider}`,
    marginBottom: theme.spacing(1),
  },
  sectionStack: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(3),
    width: "100%",
  },
  subSectionLabel: {
    marginTop: theme.spacing(2),
    fontWeight: 600,
  },
  subSectionLabelFirst: {
    marginTop: 0,
  },
  toggleHighlight: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.04)"
        : theme.palette.grey[50],
  },
  chatbotStateStack: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    overflow: "visible",
  },
  chatbotToggleCard: {
    padding: theme.spacing(2),
    borderRadius: 14,
    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
    backgroundColor: theme.palette.background.paper,
    overflow: "visible",
  },
  chatbotScheduleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(180px, 280px))",
    gap: theme.spacing(2),
    alignItems: "end",
    marginTop: theme.spacing(2),
    overflow: "visible",
    width: "100%",
    [theme.breakpoints.down("sm")]: {
      gridTemplateColumns: "1fr",
    },
  },
  chatbotTimeField: {
    width: "100%",
    minWidth: 180,
    overflow: "visible",
    "& .MuiOutlinedInput-root": {
      width: "100%",
      minWidth: 180,
      height: 52,
      borderRadius: 12,
      boxSizing: "border-box",
    },
    "& .MuiOutlinedInput-input": {
      boxSizing: "border-box",
    },
    "& .MuiInputLabel-root": {
      color: theme.palette.text.secondary,
    },
    "& .MuiFormHelperText-root": {
      color: theme.palette.text.secondary,
    },
  },
  chatbotSaveRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(2.5),
  },
  chatbotSaveHint: {
    marginTop: theme.spacing(1),
    display: "block",
  },
  autoSaveFooter: {
    marginTop: theme.spacing(2),
    display: "block",
  },
  autoSaveFooterRow: {
    marginTop: theme.spacing(2),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing(1),
  },
  cardTitleRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
  },
  cardTitleIcon: {
    fontSize: "1.35rem",
    lineHeight: 1.2,
    flexShrink: 0,
  },
  cardTitleTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  cardTitleTopLine: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing(1),
  },
  autoSavedBadge: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    color: theme.palette.success.main,
  },
  saveHintFooter: {
    marginTop: theme.spacing(2),
    display: "block",
  },
}));

export default function Options(props) {
  const {
    variant = "main",
    settings,
    scheduleTypeChanged,
    onSettingCommitted,
    chatbotSaveTick = 0,
    showPlatformIntegrations = false,
    showGroupManagerButton = false,
    showChatbotControl = false,
    chatbotControl,
    setChatbotControl,
    chatbotControlLoading = false,
    chatbotControlSaving = false,
    chatbotWeekdayStart = "08:00",
    setChatbotWeekdayStart,
    chatbotWeekdayEnd = "18:00",
    setChatbotWeekdayEnd,
    onSaveChatbotControl,
    useConnectionBehaviorTabs = false,
    connectionBehaviorRows = [],
    activeWhatsappId = null,
    onActiveWhatsappIdChange,
    connectionBehavior = null,
    connectionBehaviorLoading = false,
    connectionBehaviorSaving = false,
    onUpdateConnectionBehavior,
  } = props;
  const classes = useStyles();
  const history = useHistory();
  const { user } = React.useContext(AuthContext);
  const canManageBehavior = canManageWhatsappBehavior(user);
  const behavior = useWhatsappBehaviorSettings(
    canManageBehavior && !useConnectionBehaviorTabs
  );
  const [userRating, setUserRating] = useState("disabled");
  const [scheduleType, setScheduleType] = useState("disabled");
  const [callType, setCallType] = useState("enabled");
  const [callRejectSendMessage, setCallRejectSendMessage] = useState("enabled");
  const [callRejectMessage, setCallRejectMessage] = useState("");
  const [chatbotType, setChatbotType] = useState("");
  const [CheckMsgIsGroup, setCheckMsgIsGroupType] = useState("enabled");

  const [loadingUserRating, setLoadingUserRating] = useState(false);
  const [loadingScheduleType, setLoadingScheduleType] = useState(false);
  const [loadingCallType, setLoadingCallType] = useState(false);
  const [loadingCallRejectSendMessage, setLoadingCallRejectSendMessage] = useState(false);
  const [loadingCallRejectMessage, setLoadingCallRejectMessage] = useState(false);
  const [loadingChatbotType, setLoadingChatbotType] = useState(false);
  const [loadingCheckMsgIsGroup, setCheckMsgIsGroup] = useState(false);


  //const [ipixcType, setIpIxcType] = useState("");
  //const [loadingIpIxcType, setLoadingIpIxcType] = useState(false);
  //const [tokenixcType, setTokenIxcType] = useState("");
  //const [loadingTokenIxcType, setLoadingTokenIxcType] = useState(false);

  //const [ipmkauthType, setIpMkauthType] = useState("");
  //const [loadingIpMkauthType, setLoadingIpMkauthType] = useState(false);
  //const [clientidmkauthType, setClientIdMkauthType] = useState("");
  //const [loadingClientIdMkauthType, setLoadingClientIdMkauthType] = useState(false);
  //const [clientsecretmkauthType, setClientSecrectMkauthType] = useState("");
  //const [loadingClientSecrectMkauthType, setLoadingClientSecrectMkauthType] = useState(false);

  const [asaasType, setAsaasType] = useState("");
  const [loadingAsaasType, setLoadingAsaasType] = useState(false);
  
  // recursos a mais da plw design

  const [SendGreetingAccepted, setSendGreetingAccepted] = useState("disabled");
  const [loadingSendGreetingAccepted, setLoadingSendGreetingAccepted] = useState(false);
  
  const [SettingsTransfTicket, setSettingsTransfTicket] = useState("disabled");
  const [loadingSettingsTransfTicket, setLoadingSettingsTransfTicket] = useState(false);
  
  const [sendGreetingMessageOneQueues, setSendGreetingMessageOneQueues] = useState("disabled");
  const [loadingSendGreetingMessageOneQueues, setLoadingSendGreetingMessageOneQueues] = useState(false);

  const { update } = useSettings();
  const connectionFieldsDisabled =
    useConnectionBehaviorTabs &&
    (connectionBehaviorLoading ||
      connectionBehaviorSaving ||
      !connectionBehavior);
  const behaviorFieldsReadOnly = !canManageBehavior;
  const autoSaveTimers = useRef({});
  const [autoSaveFlash, setAutoSaveFlash] = useState({});
  const [chatbotManualSaved, setChatbotManualSaved] = useState(false);

  const markAutoSaved = useCallback((cardId) => {
    if (autoSaveTimers.current[cardId]) {
      clearTimeout(autoSaveTimers.current[cardId]);
    }
    setAutoSaveFlash((s) => ({ ...s, [cardId]: Date.now() }));
    autoSaveTimers.current[cardId] = setTimeout(() => {
      setAutoSaveFlash((s) => {
        const next = { ...s };
        delete next[cardId];
        return next;
      });
      delete autoSaveTimers.current[cardId];
    }, 2400);
  }, []);

  const notifyCommitted = useCallback(
    (key, value) => {
      if (typeof onSettingCommitted === "function") {
        onSettingCommitted(key, value);
      }
    },
    [onSettingCommitted]
  );

  useEffect(() => {
    if (!chatbotSaveTick) return;
    setChatbotManualSaved(true);
    const t = setTimeout(() => setChatbotManualSaved(false), 2800);
    return () => clearTimeout(t);
  }, [chatbotSaveTick]);

  useEffect(() => {
    if (useConnectionBehaviorTabs) {
      return;
    }
    if (!canManageBehavior || behavior.loading || !behavior.selectedRows.length) {
      return;
    }
    const ch = behavior.pickCommonForSelected("callHandlingMode");
    if (ch) {
      setCallType(ch === "accept" ? "enabled" : "disabled");
    }
    const sms = behavior.pickCommonForSelected("sendMessageOnCallReject");
    if (sms !== undefined) {
      setCallRejectSendMessage(sms ? "enabled" : "disabled");
    }
    const msg = behavior.pickCommonForSelected("callRejectMessage");
    if (msg !== undefined) {
      setCallRejectMessage(msg || "");
    }
    const gm = behavior.pickCommonForSelected("groupMessagesMode");
    if (gm) {
      setCheckMsgIsGroupType(gm === "ignore" ? "enabled" : "disabled");
    }
  }, [
    useConnectionBehaviorTabs,
    canManageBehavior,
    behavior.loading,
    behavior.selectedIds,
    behavior.rows,
    behavior.selectedRows,
    behavior.pickCommonForSelected,
  ]);

  useEffect(() => {
    if (!useConnectionBehaviorTabs || !connectionBehavior) {
      return;
    }
    setCallType(
      connectionBehavior.callHandlingMode === "accept" ? "enabled" : "disabled"
    );
    setCallRejectSendMessage(
      connectionBehavior.sendMessageOnCallReject ? "enabled" : "disabled"
    );
    setCallRejectMessage(connectionBehavior.callRejectMessage || "");
    setCheckMsgIsGroupType(
      connectionBehavior.groupMessagesMode === "ignore" ? "enabled" : "disabled"
    );
    setSendGreetingAccepted(connectionBehavior.sendGreetingAccepted || "disabled");
    setSettingsTransfTicket(connectionBehavior.sendMsgTransfTicket || "disabled");
    setSendGreetingMessageOneQueues(
      connectionBehavior.sendGreetingMessageOneQueues || "disabled"
    );
    setChatbotType(connectionBehavior.chatBotType || "text");
    setUserRating(connectionBehavior.userRating || "disabled");
    setScheduleType(connectionBehavior.scheduleType || "disabled");
  }, [useConnectionBehaviorTabs, connectionBehavior, activeWhatsappId]);

  const skipBehaviorFromGlobalSettings =
    useConnectionBehaviorTabs ||
    (canManageBehavior && connectionBehaviorLoading);

  const skipAutoMessagesFromGlobalSettings = skipBehaviorFromGlobalSettings;
  const skipChatBotTypeFromGlobalSettings = skipBehaviorFromGlobalSettings;
  const skipUserRatingFromGlobalSettings = skipBehaviorFromGlobalSettings;
  const skipScheduleTypeFromGlobalSettings = skipBehaviorFromGlobalSettings;

  useEffect(() => {
    if (Array.isArray(settings) && settings.length) {
      if (!skipUserRatingFromGlobalSettings) {
        const userRating = settings.find((s) => s.key === "userRating");
        if (userRating) {
          setUserRating(userRating.value);
        }
      }
      if (!skipScheduleTypeFromGlobalSettings) {
        const scheduleType = settings.find((s) => s.key === "scheduleType");
        if (scheduleType) {
          setScheduleType(scheduleType.value);
        }
      }

      if (!skipBehaviorFromGlobalSettings) {
        const callType = settings.find((s) => s.key === "call");
        if (callType) {
          setCallType(callType.value);
        }
        const crs = settings.find((s) => s.key === "callRejectSendMessage");
        setCallRejectSendMessage(crs ? crs.value : "enabled");
        const crm = settings.find((s) => s.key === "callRejectMessage");
        setCallRejectMessage(crm && crm.value != null ? String(crm.value) : "");
        const CheckMsgIsGroup = settings.find((s) => s.key === "CheckMsgIsGroup");
        if (CheckMsgIsGroup) {
          setCheckMsgIsGroupType(CheckMsgIsGroup.value);
        }
      }

      if (!skipAutoMessagesFromGlobalSettings) {
        const SendGreetingAccepted = settings.find((s) => s.key === "sendGreetingAccepted");
        if (SendGreetingAccepted) {
          setSendGreetingAccepted(SendGreetingAccepted.value);
        }
        const SettingsTransfTicket = settings.find((s) => s.key === "sendMsgTransfTicket");
        if (SettingsTransfTicket) {
          setSettingsTransfTicket(SettingsTransfTicket.value);
        }
        const sendGreetingMessageOneQueues = settings.find(
          (s) => s.key === "sendGreetingMessageOneQueues"
        );
        if (sendGreetingMessageOneQueues) {
          setSendGreetingMessageOneQueues(sendGreetingMessageOneQueues.value);
        }
      }

      if (!skipChatBotTypeFromGlobalSettings) {
        const chatbotType = settings.find((s) => s.key === "chatBotType");
        if (chatbotType) {
          setChatbotType(chatbotType.value);
        }
      }

	    {/*const ipixcType = settings.find((s) => s.key === "ipixc");
      if (ipixcType) {
        setIpIxcType(ipixcType.value);
      }*/}

      {/*const tokenixcType = settings.find((s) => s.key === "tokenixc");
      if (tokenixcType) {
        setTokenIxcType(tokenixcType.value);
      }*/}

      {/*const ipmkauthType = settings.find((s) => s.key === "ipmkauth");
      if (ipmkauthType) {
        setIpMkauthType(ipmkauthType.value);
      }*/}

     {/* const clientidmkauthType = settings.find((s) => s.key === "clientidmkauth");
      if (clientidmkauthType) {
        setClientIdMkauthType(clientidmkauthType.value);
      }*/}

      {/*const clientsecretmkauthType = settings.find((s) => s.key === "clientsecretmkauth");
      if (clientsecretmkauthType) {
        setClientSecrectMkauthType(clientsecretmkauthType.value);
      }*/}

      const asaasType = settings.find((s) => s.key === "asaas");
      if (asaasType) {
        setAsaasType(asaasType.value);
      }
    }
  }, [
    settings,
    skipBehaviorFromGlobalSettings,
    skipAutoMessagesFromGlobalSettings,
    skipChatBotTypeFromGlobalSettings,
    skipUserRatingFromGlobalSettings,
    skipScheduleTypeFromGlobalSettings,
  ]);

  async function handleChangeUserRating(value) {
    const targetWhatsappId = activeWhatsappId;
    setUserRating(value);
    setLoadingUserRating(true);
    if (
      await saveConnectionBehavior(
        targetWhatsappId,
        { userRating: value },
        "settings.whatsappBehavior.userRatingSaved"
      )
    ) {
      markAutoSaved("ratings");
      notifyCommitted("userRating", value);
      setLoadingUserRating(false);
      return;
    }
    await update({
      key: "userRating",
      value,
    });
    markAutoSaved("ratings");
    notifyCommitted("userRating", value);
    setLoadingUserRating(false);
  }
  
  async function handleSendGreetingMessageOneQueues(value) {
    const targetWhatsappId = activeWhatsappId;
    setSendGreetingMessageOneQueues(value);
    setLoadingSendGreetingMessageOneQueues(true);
    if (
      await saveConnectionBehavior(
        targetWhatsappId,
        { sendGreetingMessageOneQueues: value },
        "settings.whatsappBehavior.autoMessagesSaved"
      )
    ) {
      markAutoSaved("autoMsg");
      notifyCommitted("sendGreetingMessageOneQueues", value);
      setLoadingSendGreetingMessageOneQueues(false);
      return;
    }
    await update({
      key: "sendGreetingMessageOneQueues",
      value,
    });
    markAutoSaved("autoMsg");
    notifyCommitted("sendGreetingMessageOneQueues", value);
    setLoadingSendGreetingMessageOneQueues(false);
  }

  async function handleScheduleType(value) {
    const targetWhatsappId = activeWhatsappId;
    setScheduleType(value);
    setLoadingScheduleType(true);
    if (
      await saveConnectionBehavior(
        targetWhatsappId,
        { scheduleType: value },
        "settings.whatsappBehavior.scheduleTypeSaved"
      )
    ) {
      markAutoSaved("ratings");
      notifyCommitted("scheduleType", value);
      setLoadingScheduleType(false);
      return;
    }
    await update({
      key: "scheduleType",
      value,
    });
    markAutoSaved("ratings");
    notifyCommitted("scheduleType", value);
    setLoadingScheduleType(false);
    if (typeof scheduleTypeChanged === "function") {
      scheduleTypeChanged(value);
    }
  }

  const saveConnectionBehavior = useCallback(
    async (whatsappId, settings, toastKey) => {
      if (
        !useConnectionBehaviorTabs ||
        whatsappId == null ||
        typeof onUpdateConnectionBehavior !== "function"
      ) {
        return false;
      }
      await onUpdateConnectionBehavior(whatsappId, settings);
      if (toastKey) {
        showSuccessToast(toastKey);
      }
      return true;
    },
    [useConnectionBehaviorTabs, onUpdateConnectionBehavior]
  );

  async function handleCallType(value) {
    const targetWhatsappId = activeWhatsappId;
    setCallType(value);
    setLoadingCallType(true);
    if (
      await saveConnectionBehavior(
        targetWhatsappId,
        { callHandlingMode: value === "enabled" ? "accept" : "reject" },
        "settings.whatsappBehavior.callsSaved"
      )
    ) {
      markAutoSaved("calls");
      setLoadingCallType(false);
      return;
    }
    if (canManageBehavior && behavior.rows.length > 0) {
      await behavior.bulkUpdate(
        { callHandlingMode: value === "enabled" ? "accept" : "reject" },
        "settings.whatsappBehavior.callsSaved"
      );
    } else {
      await update({ key: "call", value });
      notifyCommitted("call", value);
    }
    markAutoSaved("calls");
    setLoadingCallType(false);
  }

  async function handleCallRejectSendMessage(value) {
    const targetWhatsappId = activeWhatsappId;
    setCallRejectSendMessage(value);
    setLoadingCallRejectSendMessage(true);
    if (
      await saveConnectionBehavior(
        targetWhatsappId,
        { sendMessageOnCallReject: value !== "disabled" },
        "settings.whatsappBehavior.callsSaved"
      )
    ) {
      markAutoSaved("calls");
      setLoadingCallRejectSendMessage(false);
      return;
    }
    if (canManageBehavior && behavior.rows.length > 0) {
      await behavior.bulkUpdate(
        { sendMessageOnCallReject: value !== "disabled" },
        "settings.whatsappBehavior.callsSaved"
      );
    } else {
      await update({ key: "callRejectSendMessage", value });
      notifyCommitted("callRejectSendMessage", value);
    }
    markAutoSaved("calls");
    setLoadingCallRejectSendMessage(false);
  }

  async function handleCallRejectMessageSave() {
    const targetWhatsappId = activeWhatsappId;
    const messageToSave = callRejectMessage;
    setLoadingCallRejectMessage(true);
    if (
      await saveConnectionBehavior(
        targetWhatsappId,
        { callRejectMessage: messageToSave },
        "settings.whatsappBehavior.callsSaved"
      )
    ) {
      markAutoSaved("calls");
      setLoadingCallRejectMessage(false);
      return;
    }
    if (canManageBehavior && behavior.rows.length > 0) {
      await behavior.bulkUpdate(
        { callRejectMessage },
        "settings.whatsappBehavior.callsSaved"
      );
    } else {
      await update({ key: "callRejectMessage", value: callRejectMessage });
      notifyCommitted("callRejectMessage", callRejectMessage);
    }
    markAutoSaved("calls");
    setLoadingCallRejectMessage(false);
  }

  async function handleChatbotType(value) {
    const targetWhatsappId = activeWhatsappId;
    setChatbotType(value);
    setLoadingChatbotType(true);
    if (
      await saveConnectionBehavior(
        targetWhatsappId,
        { chatBotType: value },
        "settings.whatsappBehavior.chatBotTypeSaved"
      )
    ) {
      markAutoSaved("chatbot");
      notifyCommitted("chatBotType", value);
      setLoadingChatbotType(false);
      return;
    }
    await update({
      key: "chatBotType",
      value,
    });
    markAutoSaved("chatbot");
    notifyCommitted("chatBotType", value);
    setLoadingChatbotType(false);
  }

  async function handleGroupType(value) {
    const targetWhatsappId = activeWhatsappId;
    setCheckMsgIsGroupType(value);
    setCheckMsgIsGroup(true);
    if (
      await saveConnectionBehavior(
        targetWhatsappId,
        { groupMessagesMode: value === "enabled" ? "ignore" : "receive" },
        "settings.whatsappBehavior.groupsSaved"
      )
    ) {
      markAutoSaved("groups");
      setCheckMsgIsGroup(false);
      return;
    }
    if (canManageBehavior && behavior.rows.length > 0) {
      await behavior.bulkUpdate(
        { groupMessagesMode: value === "enabled" ? "ignore" : "receive" },
        "settings.whatsappBehavior.groupsSaved"
      );
    } else {
      await update({ key: "CheckMsgIsGroup", value });
      notifyCommitted("CheckMsgIsGroup", value);
    }
    markAutoSaved("groups");
    setCheckMsgIsGroup(false);
    /*     if (typeof scheduleTypeChanged === "function") {
          scheduleTypeChanged(value);
        } */
  }
  
  {/*NOVO CÓDIGO*/}  
  async function handleSendGreetingAccepted(value) {
    const targetWhatsappId = activeWhatsappId;
    setSendGreetingAccepted(value);
    setLoadingSendGreetingAccepted(true);
    if (
      await saveConnectionBehavior(
        targetWhatsappId,
        { sendGreetingAccepted: value },
        "settings.whatsappBehavior.autoMessagesSaved"
      )
    ) {
      markAutoSaved("autoMsg");
      notifyCommitted("sendGreetingAccepted", value);
      setLoadingSendGreetingAccepted(false);
      return;
    }
    await update({
      key: "sendGreetingAccepted",
      value,
    });
    markAutoSaved("autoMsg");
    notifyCommitted("sendGreetingAccepted", value);
    setLoadingSendGreetingAccepted(false);
  }

  async function handleSettingsTransfTicket(value) {
    const targetWhatsappId = activeWhatsappId;
    setSettingsTransfTicket(value);
    setLoadingSettingsTransfTicket(true);
    if (
      await saveConnectionBehavior(
        targetWhatsappId,
        { sendMsgTransfTicket: value },
        "settings.whatsappBehavior.autoMessagesSaved"
      )
    ) {
      markAutoSaved("autoMsg");
      notifyCommitted("sendMsgTransfTicket", value);
      setLoadingSettingsTransfTicket(false);
      return;
    }
    await update({
      key: "sendMsgTransfTicket",
      value,
    });
    markAutoSaved("autoMsg");
    notifyCommitted("sendMsgTransfTicket", value);
    setLoadingSettingsTransfTicket(false);
  }
 
 {/*async function handleChangeIPIxc(value) {
    setIpIxcType(value);
    setLoadingIpIxcType(true);
    await update({
      key: "ipixc",
      value,
    });
    toast.success(i18n.t("settings.options.toasts.success"));
    setLoadingIpIxcType(false);
  }

   {/*async function handleChangeTokenIxc(value) {
    setTokenIxcType(value);
    setLoadingTokenIxcType(true);
    await update({
      key: "tokenixc",
      value,
    });
    toast.success(i18n.t("settings.options.toasts.success"));
    setLoadingTokenIxcType(false);
  }

  async function handleChangeIpMkauth(value) {
    setIpMkauthType(value);
    setLoadingIpMkauthType(true);
    await update({
      key: "ipmkauth",
      value,
    });
    toast.success(i18n.t("settings.options.toasts.success"));
    setLoadingIpMkauthType(false);
  }

  async function handleChangeClientIdMkauth(value) {
    setClientIdMkauthType(value);
    setLoadingClientIdMkauthType(true);
    await update({
      key: "clientidmkauth",
      value,
    });
    toast.success(i18n.t("settings.options.toasts.success"));
    setLoadingClientIdMkauthType(false);
  }

  async function handleChangeClientSecrectMkauth(value) {
    setClientSecrectMkauthType(value);
    setLoadingClientSecrectMkauthType(true);
    await update({
      key: "clientsecretmkauth",
      value,
    });
    toast.success(i18n.t("settings.options.toasts.success"));
    setLoadingClientSecrectMkauthType(false);
  }*/}

  async function handleChangeAsaas(value) {
    setAsaasType(value);
    setLoadingAsaasType(true);
    await update({
      key: "asaas",
      value,
    });
    markAutoSaved("asaas");
    notifyCommitted("asaas", value);
    setLoadingAsaasType(false);
  }

  const ratingsStatusChip =
    userRating === "enabled"
      ? { label: i18n.t("settings.status.ratingsOn"), color: "primary" }
      : { label: i18n.t("settings.status.ratingsOff"), color: "default" };

  const expedientStatusChip =
    scheduleType === "disabled"
      ? { label: i18n.t("settings.status.expedientOff"), color: "default" }
      : scheduleType === "queue"
      ? { label: i18n.t("settings.status.expedientQueue"), color: "primary" }
      : { label: i18n.t("settings.status.expedientCompany"), color: "primary" };

  const callsStatusChip =
    callType === "enabled"
      ? { label: i18n.t("settings.status.callsAccepting"), color: "primary" }
      : { label: i18n.t("settings.status.callsBlocked"), color: "default" };

  const groupsStatusChip =
    CheckMsgIsGroup === "disabled"
      ? { label: i18n.t("settings.status.groupsInbox"), color: "primary" }
      : { label: i18n.t("settings.status.groupsIgnored"), color: "default" };

  const anyAutoMsgEnabled =
    SendGreetingAccepted === "enabled" ||
    SettingsTransfTicket === "enabled" ||
    sendGreetingMessageOneQueues === "enabled";
  const autoMsgStatusChip = anyAutoMsgEnabled
    ? { label: i18n.t("settings.status.autoMessagesOn"), color: "primary" }
    : { label: i18n.t("settings.status.autoMessagesMinimal"), color: "default" };

  const chatbotMainStatusChip = !showChatbotControl
    ? null
    : Boolean(chatbotControl?.chatbotDisabled)
    ? { label: i18n.t("settings.status.chatbotCompanyOff"), color: "default" }
    : { label: i18n.t("settings.status.chatbotCompanyOn"), color: "primary" };

  const chatbotScheduleStatusChip = !showChatbotControl
    ? null
    : Boolean(chatbotControl?.chatbotScheduleEnabled)
    ? { label: i18n.t("settings.status.chatbotScheduleOn"), color: "primary" }
    : { label: i18n.t("settings.status.chatbotScheduleOff"), color: "default" };

  const chatbotTypeStatusChip = {
    label:
      chatbotType === "text"
        ? i18n.t("settings.options.fields.chatbotType.text")
        : chatbotType || "—",
    color: "default",
  };

  const chatbotHeaderChips = (() => {
    const list = [];
    if (showChatbotControl) {
      if (chatbotMainStatusChip) list.push(chatbotMainStatusChip);
      if (chatbotScheduleStatusChip) list.push(chatbotScheduleStatusChip);
    } else {
      list.push(chatbotTypeStatusChip);
    }
    return list;
  })();

  const asaasStatusChip =
    asaasType && String(asaasType).trim().length > 0
      ? { label: i18n.t("settings.status.asaasConfigured"), color: "primary" }
      : { label: i18n.t("settings.status.asaasPending"), color: "default" };

  const renderCardHeader = ({ iconEmojiKey, titleKey, taglineKey, tooltipKey, chips }) => (
    <Box className={classes.cardTitleRow}>
      <Typography className={classes.cardTitleIcon} component="span" aria-hidden>
        {i18n.t(iconEmojiKey)}
      </Typography>
      <Box className={classes.cardTitleTextBlock}>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={1}>
          <Box flex={1} minWidth={0}>
            <Box className={classes.cardTitleTopLine}>
              <Typography variant="h6" className={classes.sectionTitle} component="span">
                {i18n.t(titleKey)}
              </Typography>
              {(chips || []).map((c, i) => (
                <Chip
                  key={`${c.label}-${i}`}
                  size="small"
                  label={c.label}
                  color={c.color === "primary" ? "primary" : "default"}
                  variant="outlined"
                />
              ))}
            </Box>
            <Typography variant="body2" color="textSecondary">
              {i18n.t(taglineKey)}
            </Typography>
          </Box>
          <Tooltip title={i18n.t(tooltipKey)}>
            <IconButton size="small" aria-label={i18n.t("settings.ux.moreInfoAria")}>
              <InfoOutlined fontSize="small" color="action" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );

  const renderAutoSaveRow = (cardId) => (
    <Box className={classes.autoSaveFooterRow}>
      <Typography variant="caption" color="textSecondary">
        {i18n.t("settings.ux.autoSaveHint")}
      </Typography>
      {autoSaveFlash[cardId] ? (
        <Box className={classes.autoSavedBadge}>
          <CheckCircleOutline style={{ fontSize: 18 }} />
          <Typography variant="caption">{i18n.t("settings.ux.autoSaved")}</Typography>
        </Box>
      ) : null}
    </Box>
  );

  if (variant === "integrations") {
    if (!showPlatformIntegrations) {
      return null;
    }
    return (
      <Box className={classes.sectionStack}>
        <Paper elevation={1} className={classes.sectionPaper}>
          {renderCardHeader({
            iconEmojiKey: "settings.ux.cardIconIntegrations",
            titleKey: "settings.sections.integrationsTitle",
            taglineKey: "settings.sections.integrationsDescription",
            tooltipKey: "settings.sections.tooltips.integrations",
            chips: [asaasStatusChip],
          })}
          <Box display="flex" alignItems="center" gap={0.5} mb={2}>
            <Typography variant="subtitle2" className={classes.subSectionLabelFirst}>
              {i18n.t("settings.sections.asaasTitle")}
            </Typography>
            <Tooltip title={i18n.t("settings.sections.tooltips.asaasNotice")}>
              <IconButton size="small" aria-label={i18n.t("settings.ux.moreInfoAria")}>
                <InfoOutlined fontSize="small" color="action" />
              </IconButton>
            </Tooltip>
          </Box>
          <TextField
            id="asaas"
            name="asaas"
            margin="dense"
            label={i18n.t("settings.sections.asaasTokenLabel")}
            variant="outlined"
            fullWidth
            value={asaasType}
            onChange={async (e) => {
              handleChangeAsaas(e.target.value);
            }}
            helperText={loadingAsaasType ? i18n.t("settings.options.updating") : undefined}
          />
          {renderAutoSaveRow("asaas")}
        </Paper>
      </Box>
    );
  }

  return (
    <Box className={classes.sectionStack}>
      <Paper
        key={useConnectionBehaviorTabs ? `ratings-${activeWhatsappId}` : "ratings-global"}
        elevation={1}
        className={classes.sectionPaper}
      >
        {renderCardHeader({
          iconEmojiKey: "settings.ux.cardIconRating",
          titleKey: "settings.sections.ratingsScheduleTitle",
          taglineKey: "settings.sections.ratingsScheduleDescription",
          tooltipKey: "settings.sections.tooltips.ratingsSchedule",
          chips: [ratingsStatusChip, expedientStatusChip],
        })}
        {useConnectionBehaviorTabs ? (
          <Alert severity="info" style={{ marginBottom: 12 }}>
            {i18n.t("settings.whatsappBehavior.perConnectionModeInfo")}
          </Alert>
        ) : null}
        {useConnectionBehaviorTabs &&
        (connectionBehavior?.usesPerConnectionUserRating === false ||
          connectionBehavior?.usesPerConnectionScheduleType === false) ? (
          <Typography
            variant="caption"
            color="textSecondary"
            display="block"
            style={{ marginBottom: 12 }}
          >
            {i18n.t("settings.whatsappBehavior.connectionGlobalFallbackHint")}
          </Typography>
        ) : null}
        <Grid spacing={3} container>
          <Grid xs={12} sm={6} md={4} item>
            <FormControl className={classes.selectContainer}>
              <InputLabel id="ratings-label">{i18n.t("settings.options.fields.ratings.title")}</InputLabel>
              <Select
                labelId="ratings-label"
                value={userRating}
                disabled={
                  behaviorFieldsReadOnly ||
                  (useConnectionBehaviorTabs && connectionFieldsDisabled)
                }
                onChange={async (e) => {
                  handleChangeUserRating(e.target.value);
                }}
              >
                <MenuItem value={"disabled"}>{i18n.t("settings.options.fields.ratings.disabled")}</MenuItem>
                <MenuItem value={"enabled"}>{i18n.t("settings.options.fields.ratings.enabled")}</MenuItem>
              </Select>
              <FormHelperText>
                {loadingUserRating && i18n.t("settings.options.updating")}
              </FormHelperText>
            </FormControl>
          </Grid>
          <Grid xs={12} sm={6} md={4} item>
            <FormControl className={classes.selectContainer}>
              <InputLabel id="schedule-type-label">
                {i18n.t("settings.options.fields.expedientManager.title")}
              </InputLabel>
              <Select
                labelId="schedule-type-label"
                value={scheduleType}
                disabled={
                  behaviorFieldsReadOnly ||
                  (useConnectionBehaviorTabs && connectionFieldsDisabled)
                }
                onChange={async (e) => {
                  handleScheduleType(e.target.value);
                }}
              >
                <MenuItem value={"disabled"}>{i18n.t("settings.options.fields.disabled")}</MenuItem>
                <MenuItem value={"queue"}>{i18n.t("settings.options.fields.expedientManager.queue")}</MenuItem>
                <MenuItem value={"company"}>{i18n.t("settings.options.fields.expedientManager.company")}</MenuItem>
              </Select>
              <FormHelperText>
                {scheduleType === "company"
                  ? i18n.t("settings.options.expedientCompanyWarningShort")
                  : loadingScheduleType && i18n.t("settings.options.updating")}
              </FormHelperText>
            </FormControl>
          </Grid>
        </Grid>
        {renderAutoSaveRow("ratings")}
      </Paper>

      {useConnectionBehaviorTabs ? (
        <Paper elevation={1} className={classes.connectionTabsPaper}>
          <Typography variant="subtitle2" style={{ marginBottom: 8 }}>
            {i18n.t("settings.whatsappBehavior.connectionTabsTitle")}
          </Typography>
          <Tabs
            className={classes.connectionTabs}
            value={activeWhatsappId ?? false}
            onChange={(_, nextId) => {
              const nextRow = connectionBehaviorRows.find((row) => row.id === nextId);
              if (nextRow) {
                setCallType(
                  nextRow.callHandlingMode === "accept" ? "enabled" : "disabled"
                );
                setCallRejectSendMessage(
                  nextRow.sendMessageOnCallReject ? "enabled" : "disabled"
                );
                setCallRejectMessage(nextRow.callRejectMessage || "");
                setCheckMsgIsGroupType(
                  nextRow.groupMessagesMode === "ignore" ? "enabled" : "disabled"
                );
                setSendGreetingAccepted(nextRow.sendGreetingAccepted || "disabled");
                setSettingsTransfTicket(nextRow.sendMsgTransfTicket || "disabled");
                setSendGreetingMessageOneQueues(
                  nextRow.sendGreetingMessageOneQueues || "disabled"
                );
                setChatbotType(nextRow.chatBotType || "text");
                setUserRating(nextRow.userRating || "disabled");
                setScheduleType(nextRow.scheduleType || "disabled");
              }
              if (typeof onActiveWhatsappIdChange === "function") {
                onActiveWhatsappIdChange(nextId);
              }
            }}
            indicatorColor="primary"
            textColor="primary"
            variant="scrollable"
            scrollButtons="auto"
          >
            {connectionBehaviorRows.map((row) => (
              <Tab
                key={row.id}
                value={row.id}
                label={row.name || `#${row.id}`}
                disabled={connectionBehaviorLoading || connectionBehaviorSaving}
              />
            ))}
          </Tabs>
          {connectionBehavior?.usesPerConnectionConfig === false ||
          connectionBehavior?.usesPerConnectionAutoMessages === false ||
          connectionBehavior?.usesPerConnectionChatBotType === false ||
          connectionBehavior?.usesPerConnectionUserRating === false ||
          connectionBehavior?.usesPerConnectionScheduleType === false ? (
            <Typography variant="caption" color="textSecondary" display="block">
              {i18n.t("settings.whatsappBehavior.connectionGlobalFallbackHint")}
            </Typography>
          ) : null}
        </Paper>
      ) : null}

      <Paper
        key={useConnectionBehaviorTabs ? `calls-${activeWhatsappId}` : "calls-global"}
        elevation={1}
        className={classes.sectionPaper}
      >
        {renderCardHeader({
          iconEmojiKey: "settings.ux.cardIconCalls",
          titleKey: "settings.sections.attendanceCallsCardTitle",
          taglineKey: "settings.sections.callsDescription",
          tooltipKey: "settings.sections.tooltips.callsCard",
          chips: [callsStatusChip],
        })}
        <Grid spacing={2} container>
          <Grid xs={12} sm={6} md={4} item>
            <FormControl className={classes.selectContainer} fullWidth>
              <InputLabel id="call-type-label">
                {i18n.t("settings.options.fields.acceptCall.title")}
              </InputLabel>
              <Select
                labelId="call-type-label"
                value={callType}
                disabled={behaviorFieldsReadOnly || connectionFieldsDisabled}
                onChange={async (e) => {
                  handleCallType(e.target.value);
                }}
              >
                <MenuItem value={"enabled"}>{i18n.t("settings.options.fields.acceptCall.enabled")}</MenuItem>
                <MenuItem value={"disabled"}>{i18n.t("settings.options.fields.acceptCall.disabled")}</MenuItem>
              </Select>
              <FormHelperText>
                {loadingCallType && i18n.t("settings.options.updating")}
              </FormHelperText>
            </FormControl>
          </Grid>
          {callType === "disabled" && (
            <>
              <Grid xs={12} sm={6} md={4} item>
                <FormControl className={classes.selectContainer} fullWidth>
                  <InputLabel id="call-reject-send-label">
                    {i18n.t("settings.options.fields.acceptCall.rejectSendTitle")}
                  </InputLabel>
                  <Select
                    labelId="call-reject-send-label"
                    value={callRejectSendMessage}
                    disabled={behaviorFieldsReadOnly || connectionFieldsDisabled}
                    onChange={async (e) => {
                      handleCallRejectSendMessage(e.target.value);
                    }}
                  >
                    <MenuItem value={"enabled"}>{i18n.t("settings.options.fields.acceptCall.rejectSendYes")}</MenuItem>
                    <MenuItem value={"disabled"}>{i18n.t("settings.options.fields.acceptCall.rejectSendNo")}</MenuItem>
                  </Select>
                  <FormHelperText>
                    {loadingCallRejectSendMessage && i18n.t("settings.options.updating")}
                  </FormHelperText>
                </FormControl>
              </Grid>
              <Grid xs={12} item>
                <TextField
                  label={i18n.t("settings.options.fields.acceptCall.rejectMessageLabel")}
                  placeholder={i18n.t("settings.options.fields.acceptCall.rejectMessagePlaceholder")}
                  value={callRejectMessage}
                  onChange={(e) => setCallRejectMessage(e.target.value)}
                  onBlur={() => handleCallRejectMessageSave()}
                  disabled={
                    behaviorFieldsReadOnly ||
                    connectionFieldsDisabled ||
                    callRejectSendMessage === "disabled"
                  }
                  multiline
                  minRows={2}
                  variant="outlined"
                  fullWidth
                  helperText={
                    loadingCallRejectMessage
                      ? i18n.t("settings.options.updating")
                      : i18n.t("settings.options.fields.acceptCall.rejectMessageHelper")
                  }
                />
              </Grid>
            </>
          )}
        </Grid>
        {renderAutoSaveRow("calls")}
      </Paper>

      <Paper
        key={useConnectionBehaviorTabs ? `groups-${activeWhatsappId}` : "groups-global"}
        elevation={1}
        className={classes.sectionPaper}
      >
        {renderCardHeader({
          iconEmojiKey: "settings.ux.cardIconGroups",
          titleKey: "settings.sections.attendanceGroupsCardTitle",
          taglineKey: "settings.sections.groupsConfigDescription",
          tooltipKey: "settings.sections.tooltips.groupsCard",
          chips: [groupsStatusChip],
        })}
        {showGroupManagerButton ? (
          <Box mb={2}>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => history.push("/settings/groups")}
            >
              {i18n.t("settings.sections.groupManagerButton")}
            </Button>
          </Box>
        ) : null}
        <Grid spacing={2} container>
          <Grid xs={12} sm={12} md={6} item>
            <FormControl className={classes.selectContainer} fullWidth>
              <InputLabel id="group-type-label">
                {i18n.t("settings.options.fields.ignoreMessages.title")}
              </InputLabel>
              <Select
                labelId="group-type-label"
                value={CheckMsgIsGroup}
                disabled={behaviorFieldsReadOnly || connectionFieldsDisabled}
                onChange={async (e) => {
                  handleGroupType(e.target.value);
                }}
              >
                <MenuItem value={"disabled"}>
                  {i18n.t("settings.options.fields.ignoreMessages.optionReceive")}
                </MenuItem>
                <MenuItem value={"enabled"}>
                  {i18n.t("settings.options.fields.ignoreMessages.optionIgnore")}
                </MenuItem>
              </Select>
              <FormHelperText>
                {loadingCheckMsgIsGroup && i18n.t("settings.options.updating")}
              </FormHelperText>
            </FormControl>
          </Grid>
        </Grid>
        {renderAutoSaveRow("groups")}
      </Paper>

      <Paper
        key={useConnectionBehaviorTabs ? `autoMsg-${activeWhatsappId}` : "autoMsg-global"}
        elevation={1}
        className={classes.sectionPaper}
      >
        {renderCardHeader({
          iconEmojiKey: "settings.ux.cardIconAutoMsg",
          titleKey: "settings.sections.attendanceAutoMsgCardTitle",
          taglineKey: "settings.sections.autoMessagesDescription",
          tooltipKey: "settings.sections.tooltips.autoMessagesCard",
          chips: [autoMsgStatusChip],
        })}
        {useConnectionBehaviorTabs &&
        connectionBehavior?.usesPerConnectionAutoMessages === false ? (
          <Typography
            variant="caption"
            color="textSecondary"
            display="block"
            style={{ marginBottom: 12 }}
          >
            {i18n.t("settings.whatsappBehavior.connectionGlobalFallbackHint")}
          </Typography>
        ) : null}
        <Grid spacing={2} container>
          <Grid xs={12} sm={6} md={4} item>
            <FormControl className={classes.selectContainer}>
              <InputLabel id="sendGreetingAccepted-label">
                {i18n.t("settings.options.fields.sendGreetingAccepted.title")}
              </InputLabel>
              <Select
                labelId="sendGreetingAccepted-label"
                value={SendGreetingAccepted}
                disabled={behaviorFieldsReadOnly || connectionFieldsDisabled}
                onChange={async (e) => {
                  handleSendGreetingAccepted(e.target.value);
                }}
              >
                <MenuItem value={"disabled"}>{i18n.t("settings.options.fields.disabled")}</MenuItem>
                <MenuItem value={"enabled"}>{i18n.t("settings.options.fields.enabled")}</MenuItem>
              </Select>
              <FormHelperText>
                {loadingSendGreetingAccepted && i18n.t("settings.options.updating")}
              </FormHelperText>
            </FormControl>
          </Grid>
          <Grid xs={12} sm={6} md={4} item>
            <FormControl className={classes.selectContainer}>
              <InputLabel id="sendMsgTransfTicket-label">
                {i18n.t("settings.options.fields.sendMsgTransfTicket.title")}
              </InputLabel>
              <Select
                labelId="sendMsgTransfTicket-label"
                value={SettingsTransfTicket}
                disabled={behaviorFieldsReadOnly || connectionFieldsDisabled}
                onChange={async (e) => {
                  handleSettingsTransfTicket(e.target.value);
                }}
              >
                <MenuItem value={"disabled"}>{i18n.t("settings.options.fields.disabled")}</MenuItem>
                <MenuItem value={"enabled"}>{i18n.t("settings.options.fields.enabled")}</MenuItem>
              </Select>
              <FormHelperText>
                {loadingSettingsTransfTicket && i18n.t("settings.options.updating")}
              </FormHelperText>
            </FormControl>
          </Grid>
          <Grid xs={12} sm={6} md={4} item>
            <FormControl className={classes.selectContainer}>
              <InputLabel id="sendGreetingMessageOneQueues-label">
                {i18n.t("settings.options.fields.sendGreetingMessageOneQueues.title")}
              </InputLabel>
              <Select
                labelId="sendGreetingMessageOneQueues-label"
                value={sendGreetingMessageOneQueues}
                disabled={behaviorFieldsReadOnly || connectionFieldsDisabled}
                onChange={async (e) => {
                  handleSendGreetingMessageOneQueues(e.target.value);
                }}
              >
                <MenuItem value={"disabled"}>{i18n.t("settings.options.fields.disabled")}</MenuItem>
                <MenuItem value={"enabled"}>{i18n.t("settings.options.fields.enabled")}</MenuItem>
              </Select>
              <FormHelperText>
                {loadingSendGreetingMessageOneQueues && i18n.t("settings.options.updating")}
              </FormHelperText>
            </FormControl>
          </Grid>
        </Grid>
        {renderAutoSaveRow("autoMsg")}
      </Paper>

      <Paper elevation={1} className={classes.sectionPaper}>
        {renderCardHeader({
          iconEmojiKey: "settings.ux.cardIconChatbot",
          titleKey: "settings.sections.chatbotAutomationTitle",
          taglineKey: "settings.sections.chatbotAutomationDescription",
          tooltipKey: "settings.sections.tooltips.chatbotAutomation",
          chips: chatbotHeaderChips,
        })}

        {showChatbotControl ? (
          <>
            <Typography
              variant="subtitle2"
              className={classes.subSectionLabelFirst}
              color="textSecondary"
            >
              {i18n.t("settings.sections.chatbotSectionStateTitle")}
            </Typography>
            <Box className={classes.chatbotStateStack}>
              <Box className={classes.chatbotToggleCard}>
                <FormControlLabel
                  control={
                    <Switch
                      color="primary"
                      size="medium"
                      checked={Boolean(chatbotControl?.chatbotDisabled)}
                      onChange={(e) =>
                        setChatbotControl((prev) => ({
                          ...(prev || {}),
                          chatbotDisabled: e.target.checked,
                        }))
                      }
                      disabled={chatbotControlLoading}
                    />
                  }
                  label={
                    <Typography variant="body1" component="span" style={{ fontWeight: 600 }}>
                      {i18n.t("settings.chatbotControl.disableCompany")}
                    </Typography>
                  }
                />
              </Box>
              <Box className={classes.chatbotToggleCard}>
                <FormControlLabel
                  control={
                    <Switch
                      color="primary"
                      size="medium"
                      checked={Boolean(chatbotControl?.chatbotScheduleEnabled)}
                      onChange={(e) =>
                        setChatbotControl((prev) => ({
                          ...(prev || {}),
                          chatbotScheduleEnabled: e.target.checked,
                        }))
                      }
                      disabled={chatbotControlLoading}
                    />
                  }
                  label={
                    <Typography variant="body1" component="span" style={{ fontWeight: 600 }}>
                      {i18n.t("settings.chatbotControl.enableSchedule")}
                    </Typography>
                  }
                />
                {Boolean(chatbotControl?.chatbotScheduleEnabled) && (
                  <Box className={classes.chatbotScheduleGrid}>
                    <TextField
                      className={classes.chatbotTimeField}
                      label={i18n.t("settings.chatbotControl.weekdayStart")}
                      type="time"
                      value={chatbotWeekdayStart}
                      onChange={(e) => setChatbotWeekdayStart(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ step: 300 }}
                      variant="outlined"
                      fullWidth
                      helperText={i18n.t("settings.chatbotControl.weekdaysHint")}
                    />
                    <TextField
                      className={classes.chatbotTimeField}
                      label={i18n.t("settings.chatbotControl.weekdayEnd")}
                      type="time"
                      value={chatbotWeekdayEnd}
                      onChange={(e) => setChatbotWeekdayEnd(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ step: 300 }}
                      variant="outlined"
                      fullWidth
                    />
                  </Box>
                )}
              </Box>
              <Box className={classes.chatbotSaveRow}>
                <Button
                  variant="contained"
                  color="primary"
                  size="medium"
                  onClick={onSaveChatbotControl}
                  disabled={chatbotControlSaving || chatbotControlLoading}
                >
                  {chatbotControlSaving
                    ? i18n.t("settings.chatbotControl.buttons.saving")
                    : i18n.t("settings.chatbotControl.buttons.save")}
                </Button>
                {chatbotManualSaved ? (
                  <Box className={classes.autoSavedBadge}>
                    <CheckCircleOutline style={{ fontSize: 18 }} />
                    <Typography variant="caption">{i18n.t("settings.ux.autoSaved")}</Typography>
                  </Box>
                ) : null}
              </Box>
              <Typography
                variant="caption"
                color="textSecondary"
                display="block"
                className={classes.chatbotSaveHint}
              >
                {i18n.t("settings.ux.saveCardHint")}
              </Typography>
            </Box>
          </>
        ) : null}

        <Divider style={{ marginTop: showChatbotControl ? 24 : 0, marginBottom: 16 }} />

        <Typography variant="subtitle2" className={classes.subSectionLabelFirst}>
          {i18n.t("settings.sections.chatbotSectionBehaviorTitle")}
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph style={{ marginBottom: 12 }}>
          {i18n.t("settings.sections.chatbotBehaviorHint")}
        </Typography>
        {useConnectionBehaviorTabs &&
        connectionBehavior?.usesPerConnectionChatBotType === false ? (
          <Typography
            variant="caption"
            color="textSecondary"
            display="block"
            style={{ marginBottom: 12 }}
          >
            {i18n.t("settings.whatsappBehavior.connectionGlobalFallbackHint")}
          </Typography>
        ) : null}
        <Grid spacing={2} container alignItems="flex-end">
          <Grid xs={12} sm={6} md={4} item>
            <FormControl className={classes.selectContainer} fullWidth>
              <InputLabel id="chatbot-type-label">
                {i18n.t("settings.options.fields.chatbotType.title")}
              </InputLabel>
              <Select
                labelId="chatbot-type-label"
                value={chatbotType}
                disabled={behaviorFieldsReadOnly || connectionFieldsDisabled}
                onChange={async (e) => {
                  handleChatbotType(e.target.value);
                }}
              >
                <MenuItem value={"text"}>{i18n.t("settings.options.fields.chatbotType.text")}</MenuItem>
              </Select>
              <FormHelperText>
                {loadingChatbotType && i18n.t("settings.options.updating")}
              </FormHelperText>
            </FormControl>
          </Grid>
        </Grid>
        {renderAutoSaveRow("chatbot")}

        <Divider style={{ marginTop: 24, marginBottom: 16 }} />

        <Typography variant="subtitle2" className={classes.subSectionLabelFirst}>
          {i18n.t("settings.sections.chatbotSectionFlowsTitle")}
        </Typography>
        <Box mt={1}>
          <Button variant="outlined" color="primary" onClick={() => history.push("/flowbuilders")}>
            {i18n.t("settings.sections.openFlowsButton")}
          </Button>
        </Box>
      </Paper>
      {/*-----------------IXC DESATIVADO 4.6.5-----------------*/}
      {/*<Grid spacing={3} container
        style={{ marginBottom: 10 }}>
        <Tabs
          indicatorColor="primary"
          textColor="primary"
          scrollButtons="on"
          variant="scrollable"
          className={classes.tab}
        >
          <Tab

            label="IXC" />

        </Tabs>
        <Grid xs={12} sm={6} md={6} item>
          <FormControl className={classes.selectContainer}>
            <TextField
              id="ipixc"
              name="ipixc"
              margin="dense"
              label="IP do IXC"
              variant="outlined"
              value={ipixcType}
              onChange={async (e) => {
                handleChangeIPIxc(e.target.value);
              }}
            >
            </TextField>
            <FormHelperText>
              {loadingIpIxcType && i18n.t("settings.options.updating")}
            </FormHelperText>
          </FormControl>
        </Grid>
        <Grid xs={12} sm={6} md={6} item>
          <FormControl className={classes.selectContainer}>
            <TextField
              id="tokenixc"
              name="tokenixc"
              margin="dense"
              label="Token do IXC"
              variant="outlined"
              value={tokenixcType}
              onChange={async (e) => {
                handleChangeTokenIxc(e.target.value);
              }}
            >
            </TextField>
            <FormHelperText>
              {loadingTokenIxcType && i18n.t("settings.options.updating")}
            </FormHelperText>
          </FormControl>
        </Grid>
      </Grid>*/}
      {/*-----------------MK-AUTH DESATIVADO 4.6.5-----------------*/}
      {/*<Grid spacing={3} container
        style={{ marginBottom: 10 }}>
        <Tabs
          indicatorColor="primary"
          textColor="primary"
          scrollButtons="on"
          variant="scrollable"
          className={classes.tab}
        >
          <Tab label="MK-AUTH" />

        </Tabs>
        <Grid xs={12} sm={12} md={4} item>
          <FormControl className={classes.selectContainer}>
            <TextField
              id="ipmkauth"
              name="ipmkauth"
              margin="dense"
              label="Ip Mk-Auth"
              variant="outlined"
              value={ipmkauthType}
              onChange={async (e) => {
                handleChangeIpMkauth(e.target.value);
              }}
            >
            </TextField>
            <FormHelperText>
              {loadingIpMkauthType && i18n.t("settings.options.updating")}
            </FormHelperText>
          </FormControl>
        </Grid>
        <Grid xs={12} sm={12} md={4} item>
          <FormControl className={classes.selectContainer}>
            <TextField
              id="clientidmkauth"
              name="clientidmkauth"
              margin="dense"
              label="Client Id"
              variant="outlined"
              value={clientidmkauthType}
              onChange={async (e) => {
                handleChangeClientIdMkauth(e.target.value);
              }}
            >
            </TextField>
            <FormHelperText>
              {loadingClientIdMkauthType && i18n.t("settings.options.updating")}
            </FormHelperText>
          </FormControl>
        </Grid>
        <Grid xs={12} sm={12} md={4} item>
          <FormControl className={classes.selectContainer}>
            <TextField
              id="clientsecretmkauth"
              name="clientsecretmkauth"
              margin="dense"
              label="Client Secret"
              variant="outlined"
              value={clientsecretmkauthType}
              onChange={async (e) => {
                handleChangeClientSecrectMkauth(e.target.value);
              }}
            >
            </TextField>
            <FormHelperText>
              {loadingClientSecrectMkauthType && i18n.t("settings.options.updating")}
            </FormHelperText>
          </FormControl>
        </Grid>
      </Grid>*/}
    </Box>
  );
}
