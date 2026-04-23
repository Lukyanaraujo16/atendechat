import React, { useContext, useEffect, useReducer, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";

import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import { Badge } from "@material-ui/core";
import DashboardOutlinedIcon from "@material-ui/icons/DashboardOutlined";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import SyncAltIcon from "@material-ui/icons/SyncAlt";
import PeopleAltOutlinedIcon from "@material-ui/icons/PeopleAltOutlined";
import EventAvailableIcon from "@material-ui/icons/EventAvailable";
import LocalAtmIcon from "@material-ui/icons/LocalAtm";
import ForumIcon from "@material-ui/icons/Forum";
import BorderColorIcon from "@material-ui/icons/BorderColor";
import EventIcon from "@material-ui/icons/Event";
import AnnouncementIcon from "@material-ui/icons/Announcement";
import AttachFile from "@material-ui/icons/AttachFile";
import LocalOfferIcon from "@material-ui/icons/LocalOffer";
import HelpOutlineIcon from "@material-ui/icons/HelpOutline";
import AssessmentOutlinedIcon from "@material-ui/icons/AssessmentOutlined";
import { AccountTree, BusinessCenter } from "@material-ui/icons";
import { i18n } from "../translate/i18n";
import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../context/Auth/AuthContext";
import { Can } from "../components/Can";
import { SocketContext } from "../context/Socket/SocketContext";
import { isArray } from "lodash";
import api from "../services/api";
import toastError from "../errors/toastError";
import { makeStyles, alpha } from "@material-ui/core/styles";
import usePlans from "../hooks/usePlans";

const useStyles = makeStyles((theme) => {
  const brand = theme.palette.primary.main;
  return {
    listItemIcon: {
      color: brand,
      minWidth: 40,
    },
    listItemText: {
      color: theme.palette.text.primary,
      minWidth: 0,
      "&.MuiListItemText-primary": {
        fontWeight: 500,
      },
      "& .MuiTypography-root": {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      },
    },
    listItem: {
      minWidth: 0,
      "&:hover": {
        backgroundColor: alpha(brand, 0.1),
      },
      "&.Mui-selected": {
        backgroundColor:
          theme.palette.type === "dark"
            ? alpha(brand, 0.2)
            : alpha(brand, 0.12),
        borderLeft: `3px solid ${brand}`,
        "& .MuiListItemIcon-root": {
          color: brand,
        },
        "& .MuiTypography-root": {
          color: theme.palette.text.primary,
        },
      },
    },
  };
});

function ListItemLink(props) {
  const {
    icon,
    primary,
    to,
    listItemClassName,
    listItemIconClassName,
    listItemTextClassName,
    selected,
  } = props;

  const renderLink = React.useMemo(
    () =>
      React.forwardRef((itemProps, ref) => (
        <RouterLink to={to} ref={ref} {...itemProps} />
      )),
    [to]
  );

  return (
    <li>
      <ListItem
        button
        dense
        component={renderLink}
        className={listItemClassName}
        selected={selected}
      >
        {icon ? (
          <ListItemIcon className={listItemIconClassName}>{icon}</ListItemIcon>
        ) : null}
        <ListItemText primary={primary} className={listItemTextClassName} />
      </ListItem>
    </li>
  );
}

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
    }
    return [chat, ...state];
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
    return state.map((chat) =>
      chat.id === action.payload.chat.id ? action.payload.chat : chat
    );
  }
};

function defaultAutomacaoPath(flags, isAdmin) {
  if (!isAdmin) return "/quick-messages";
  if (flags.useFlowbuilders) return "/flowbuilders";
  if (flags.useIntegrations) return "/queue-integration";
  if (flags.useOpenAi) return "/prompts";
  return "/quick-messages";
}

const MainListItems = (props) => {
  const classes = useStyles();
  const { drawerClose } = props;
  const { whatsApps } = useContext(WhatsAppsContext);
  const { user } = useContext(AuthContext);
  const [connectionWarning, setConnectionWarning] = useState(false);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [showFlowbuilders, setShowFlowbuilders] = useState(false);
  const [showKanban, setShowKanban] = useState(false);
  const [showOpenAi, setShowOpenAi] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [showSchedules, setShowSchedules] = useState(false);
  const [showExternalApi, setShowExternalApi] = useState(false);
  const [showGroups, setShowGroups] = useState(true);
  const [showInternalChat, setShowInternalChat] = useState(true);

  const [invisible, setInvisible] = useState(true);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam] = useState("");
  const [chats, dispatch] = useReducer(reducer, []);
  const { getPlanCompany } = usePlans();
  const location = useLocation();

  const socketManager = useContext(SocketContext);

  const isAdmin = user?.profile === "admin";
  const planFlags = {
    useCampaigns: showCampaigns,
    useFlowbuilders: showFlowbuilders,
    useKanban: showKanban,
    useOpenAi: showOpenAi,
    useIntegrations: showIntegrations,
    useSchedules: showSchedules,
    useExternalApi: showExternalApi,
    useGroups: showGroups,
  };

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    async function fetchData() {
      if (user?.super && (user?.companyId == null || user?.companyId === "")) {
        return;
      }
      const companyId = user.companyId;
      if (companyId == null || companyId === "") {
        return;
      }
      try {
        const planConfigs = await getPlanCompany(undefined, companyId);
        const plan = planConfigs?.plan;
        const eff = planConfigs?.effectiveModules;
        if (eff) {
          setShowCampaigns(!!eff.useCampaigns);
          setShowFlowbuilders(!!eff.useFlowbuilders);
          setShowKanban(!!eff.useKanban);
          setShowOpenAi(!!eff.useOpenAi);
          setShowIntegrations(!!eff.useIntegrations);
          setShowSchedules(!!eff.useSchedules);
          setShowExternalApi(!!eff.useExternalApi);
          setShowGroups(eff.useGroups !== false);
          setShowInternalChat(
            eff.useInternalChat !== undefined
              ? !!eff.useInternalChat
              : plan?.useInternalChat !== false
          );
        } else if (plan) {
          setShowCampaigns(!!plan.useCampaigns);
          setShowFlowbuilders(!!plan.useCampaigns);
          setShowKanban(!!plan.useKanban);
          setShowOpenAi(!!plan.useOpenAi);
          setShowIntegrations(!!plan.useIntegrations);
          setShowSchedules(!!plan.useSchedules);
          setShowExternalApi(!!plan.useExternalApi);
          setShowGroups(true);
          setShowInternalChat(plan.useInternalChat !== false);
        }
      } catch (e) {
        toastError(e);
      }
    }
    if (user?.id) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.companyId, user?.super]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchChats();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);
    socket.on(`company-${companyId}-chat`, (data) => {
      if (data.action === "new-message" || data.action === "update") {
        dispatch({ type: "CHANGE_CHAT", payload: data });
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [socketManager]);

  useEffect(() => {
    let unreadsCount = 0;
    if (chats.length > 0) {
      for (let chat of chats) {
        for (let chatUser of chat.users) {
          if (Number(chatUser.userId) === Number(user.id)) {
            unreadsCount += chatUser.unreads;
          }
        }
      }
    }
    setInvisible(unreadsCount === 0);
  }, [chats, user.id]);

  useEffect(() => {
    if (localStorage.getItem("cshow")) {
      setShowCampaigns(true);
      setShowFlowbuilders(true);
    }
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (whatsApps.length > 0) {
        const offlineWhats = whatsApps.filter(
          (whats) =>
            whats.status === "qrcode" ||
            whats.status === "PAIRING" ||
            whats.status === "DISCONNECTED" ||
            whats.status === "TIMEOUT" ||
            whats.status === "OPENING"
        );
        setConnectionWarning(offlineWhats.length > 0);
      }
    }, 2000);
    return () => clearTimeout(delayDebounceFn);
  }, [whatsApps]);

  const fetchChats = async () => {
    try {
      const { data } = await api.get("/chats/", {
        params: { searchParam, pageNumber },
      });
      dispatch({ type: "LOAD_CHATS", payload: data.records });
    } catch (err) {
      toastError(err);
    }
  };

  const path = location.pathname;

  const selDashboard = path === "/" || path === "/relatorios";
  const selAtendimento =
    path.startsWith("/tickets") ||
    path === "/kanban" ||
    path === "/contacts" ||
    path === "/group-manager";
  const selAutomacao =
    path.startsWith("/flowbuilder") ||
    path === "/flowbuilders" ||
    path === "/phrase-lists" ||
    path === "/queue-integration" ||
    path === "/prompts" ||
    path === "/quick-messages";
  const selCampanhas =
    path === "/campaigns" ||
    path.startsWith("/contact-lists") ||
    path === "/campaigns-config" ||
    path.startsWith("/campaign/");
  const selChatInterno = path.startsWith("/chats");
  const selEquipe =
    path === "/users" ||
    path === "/setores" ||
    path === "/queues" ||
    path.startsWith("/queues/");
  const selConfig =
    path === "/connections" || path === "/messages-api" || path === "/settings";
  const selFinanceiro = path === "/financeiro";

  const selTarefas = path === "/todolist";
  const selAgendamentos = path === "/schedules";
  const selAvaliacao = path === "/avaliacao";
  const selInformativos =
    path === "/announcements" || path.startsWith("/saas/announcements");
  const selArquivos = path === "/files";
  const selTags = path === "/tags";
  const selAjuda = path === "/helps";
  const selSaaS = path.startsWith("/saas") || path.startsWith("/platform");

  const toAutomacao = defaultAutomacaoPath(planFlags, isAdmin);

  const standaloneAfterConfig = (
    <>
      <ListItemLink
        to="/todolist"
        primary={i18n.t("mainDrawer.listItems.tasks")}
        icon={<BorderColorIcon />}
        listItemClassName={classes.listItem}
        listItemIconClassName={classes.listItemIcon}
        listItemTextClassName={classes.listItemText}
        selected={selTarefas}
      />
      {showSchedules && (
        <ListItemLink
          to="/schedules"
          primary={i18n.t("mainDrawer.listItems.schedules")}
          icon={<EventIcon />}
          listItemClassName={classes.listItem}
          listItemIconClassName={classes.listItemIcon}
          listItemTextClassName={classes.listItemText}
          selected={selAgendamentos}
        />
      )}
      <ListItemLink
        to="/avaliacao"
        primary={i18n.t("mainDrawer.listItems.evaluation")}
        icon={<AssessmentOutlinedIcon />}
        listItemClassName={classes.listItem}
        listItemIconClassName={classes.listItemIcon}
        listItemTextClassName={classes.listItemText}
        selected={selAvaliacao}
      />
      <ListItemLink
        to="/tags"
        primary={i18n.t("mainDrawer.listItems.tags")}
        icon={<LocalOfferIcon />}
        listItemClassName={classes.listItem}
        listItemIconClassName={classes.listItemIcon}
        listItemTextClassName={classes.listItemText}
        selected={selTags}
      />
      <ListItemLink
        to="/files"
        primary={i18n.t("mainDrawer.listItems.files")}
        icon={<AttachFile />}
        listItemClassName={classes.listItem}
        listItemIconClassName={classes.listItemIcon}
        listItemTextClassName={classes.listItemText}
        selected={selArquivos}
      />
      {user.super && (
        <ListItemLink
          to="/saas/announcements"
          primary={i18n.t("mainDrawer.listItems.annoucements")}
          icon={<AnnouncementIcon />}
          listItemClassName={classes.listItem}
          listItemIconClassName={classes.listItemIcon}
          listItemTextClassName={classes.listItemText}
          selected={selInformativos}
        />
      )}
      <ListItemLink
        to="/helps"
        primary={i18n.t("mainDrawer.listItems.helps")}
        icon={<HelpOutlineIcon />}
        listItemClassName={classes.listItem}
        listItemIconClassName={classes.listItemIcon}
        listItemTextClassName={classes.listItemText}
        selected={selAjuda}
      />
    </>
  );

  return (
    <div onClick={drawerClose}>
      <Can
        role={user.profile}
        perform="dashboard:view"
        yes={() => (
          <ListItemLink
            to="/"
            primary={i18n.t("mainDrawer.sections.dashboard")}
            icon={<DashboardOutlinedIcon />}
            listItemClassName={classes.listItem}
            listItemIconClassName={classes.listItemIcon}
            listItemTextClassName={classes.listItemText}
            selected={selDashboard}
          />
        )}
      />

      {user.super && (
        <ListItemLink
          to="/saas"
          primary={i18n.t("mainDrawer.listItems.platform")}
          icon={<BusinessCenter />}
          listItemClassName={classes.listItem}
          listItemIconClassName={classes.listItemIcon}
          listItemTextClassName={classes.listItemText}
          selected={selSaaS}
        />
      )}

      <ListItemLink
        to="/tickets"
        primary={i18n.t("mainDrawer.sections.atendimento")}
        icon={<WhatsAppIcon />}
        listItemClassName={classes.listItem}
        listItemIconClassName={classes.listItemIcon}
        listItemTextClassName={classes.listItemText}
        selected={selAtendimento}
      />

      {showInternalChat ? (
        <ListItemLink
          to="/chats"
          primary={i18n.t("mainDrawer.sections.chatInterno")}
          icon={
            <Badge color="secondary" variant="dot" invisible={invisible}>
              <ForumIcon />
            </Badge>
          }
          listItemClassName={classes.listItem}
          listItemIconClassName={classes.listItemIcon}
          listItemTextClassName={classes.listItemText}
          selected={selChatInterno}
        />
      ) : null}

      <ListItemLink
        to={toAutomacao}
        primary={i18n.t("mainDrawer.sections.automacao")}
        icon={<AccountTree />}
        listItemClassName={classes.listItem}
        listItemIconClassName={classes.listItemIcon}
        listItemTextClassName={classes.listItemText}
        selected={selAutomacao}
      />

      {isAdmin && (
        <>
          {showCampaigns && (
            <ListItemLink
              to="/campaigns"
              primary={i18n.t("mainDrawer.sections.campanhas")}
              icon={<EventAvailableIcon />}
              listItemClassName={classes.listItem}
              listItemIconClassName={classes.listItemIcon}
              listItemTextClassName={classes.listItemText}
              selected={selCampanhas}
            />
          )}

          <ListItemLink
            to="/users"
            primary={i18n.t("mainDrawer.sections.equipe")}
            icon={<PeopleAltOutlinedIcon />}
            listItemClassName={classes.listItem}
            listItemIconClassName={classes.listItemIcon}
            listItemTextClassName={classes.listItemText}
            selected={selEquipe}
          />

          <ListItemLink
            to="/financeiro"
            primary={i18n.t("mainDrawer.sections.financeiro")}
            icon={<LocalAtmIcon />}
            listItemClassName={classes.listItem}
            listItemIconClassName={classes.listItemIcon}
            listItemTextClassName={classes.listItemText}
            selected={selFinanceiro}
          />

          <ListItemLink
            to="/connections"
            primary={i18n.t("mainDrawer.sections.configuracoes")}
            icon={
              <Badge badgeContent={connectionWarning ? "!" : 0} color="error">
                <SyncAltIcon />
              </Badge>
            }
            listItemClassName={classes.listItem}
            listItemIconClassName={classes.listItemIcon}
            listItemTextClassName={classes.listItemText}
            selected={selConfig}
          />
        </>
      )}

      {standaloneAfterConfig}
    </div>
  );
};

export default MainListItems;
