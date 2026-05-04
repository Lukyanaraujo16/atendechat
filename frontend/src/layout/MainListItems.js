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
import CalendarTodayIcon from "@material-ui/icons/CalendarToday";
import AnnouncementIcon from "@material-ui/icons/Announcement";
import AttachFile from "@material-ui/icons/AttachFile";
import LocalOfferIcon from "@material-ui/icons/LocalOffer";
import HelpOutlineIcon from "@material-ui/icons/HelpOutline";
import NotificationsIcon from "@material-ui/icons/Notifications";
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
import usePlanFlags from "../hooks/usePlanFlags";

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

function defaultAutomacaoPath(planFlags, isAdmin) {
  if (!isAdmin) return "/quick-messages";
  const fx = planFlags.effectiveFeatures || {};
  if (fx["automation.chatbot"] === true) return "/flowbuilders";
  if (fx["automation.keywords"] === true) return "/phrase-lists";
  if (planFlags.useIntegrations || fx["automation.integrations"] === true) {
    return "/queue-integration";
  }
  if (planFlags.useOpenAi || fx["automation.openai"] === true) return "/prompts";
  if (fx["automation.quick_replies"] === true) return "/quick-messages";
  return "/tickets";
}

const MainListItems = (props) => {
  const classes = useStyles();
  const { drawerClose } = props;
  const { whatsApps } = useContext(WhatsAppsContext);
  const { user } = useContext(AuthContext);
  const [connectionWarning, setConnectionWarning] = useState(false);

  const [invisible, setInvisible] = useState(true);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam] = useState("");
  const [chats, dispatch] = useReducer(reducer, []);
  const planFlags = usePlanFlags();
  const location = useLocation();

  const socketManager = useContext(SocketContext);

  const isAdmin = user?.profile === "admin";
  const fx = planFlags.effectiveFeatures || {};
  const showCampaigns = planFlags.useCampaigns;
  const showKanban = planFlags.useKanban;
  const showSchedules = planFlags.useSchedules;
  const showInternalChat = planFlags.useInternalChat;
  const showDashboardNav =
    fx["dashboard.main"] === true || fx["dashboard.reports"] === true;
  const showAgendaNav = fx["agenda.calendar"] === true;
  const showFinanceNav =
    fx["finance.subscription"] === true || fx["finance.invoices"] === true;
  const showEvalNav = fx["team.ratings"] === true;
  const showTagsNav = fx["contacts.tags"] === true;
  const showFilesNav = fx["contacts.files"] === true;
  const showCrmNav = fx["crm.pipeline"] === true;
  const showTeamUsersNav =
    fx["team.users"] === true || fx["team.queues"] === true;

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    if (!planFlags.loaded || !showInternalChat) return undefined;
    const delayDebounceFn = setTimeout(() => {
      fetchChats();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber, planFlags.loaded, showInternalChat]);

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
    path === "/connections" ||
    path === "/messages-api" ||
    path === "/settings" ||
    path.startsWith("/settings/");
  const selFinanceiro = path === "/financeiro";

  const selTarefas = path === "/todolist";
  const selAgenda = path === "/agenda";
  const selAgendamentos = path === "/schedules";
  const selCrm = path === "/crm" || path.startsWith("/crm/");
  const selAvaliacao = path === "/avaliacao";
  const selInformativos =
    path === "/announcements" || path.startsWith("/saas/announcements");
  const selArquivos = path === "/files";
  const selTags = path === "/tags";
  const selAjuda = path === "/helps";
  const selNotifications = path === "/notifications";
  const selSaaS = path.startsWith("/saas") || path.startsWith("/platform");

  const toAutomacao = defaultAutomacaoPath(planFlags, isAdmin);
  const automacaoVisible =
    isAdmin &&
    (fx["automation.chatbot"] === true ||
      fx["automation.keywords"] === true ||
      fx["automation.integrations"] === true ||
      fx["automation.openai"] === true ||
      fx["automation.quick_replies"] === true);

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
      {showAgendaNav && (
        <ListItemLink
          to="/agenda"
          primary={i18n.t("mainDrawer.listItems.agenda")}
          icon={<CalendarTodayIcon />}
          listItemClassName={classes.listItem}
          listItemIconClassName={classes.listItemIcon}
          listItemTextClassName={classes.listItemText}
          selected={selAgenda}
        />
      )}
      {showCrmNav && (
        <ListItemLink
          to="/crm"
          primary={i18n.t("mainDrawer.listItems.crm")}
          icon={<BusinessCenter />}
          listItemClassName={classes.listItem}
          listItemIconClassName={classes.listItemIcon}
          listItemTextClassName={classes.listItemText}
          selected={selCrm}
        />
      )}
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
      {showEvalNav && (
        <ListItemLink
          to="/avaliacao"
          primary={i18n.t("mainDrawer.listItems.evaluation")}
          icon={<AssessmentOutlinedIcon />}
          listItemClassName={classes.listItem}
          listItemIconClassName={classes.listItemIcon}
          listItemTextClassName={classes.listItemText}
          selected={selAvaliacao}
        />
      )}
      {showTagsNav && (
        <ListItemLink
          to="/tags"
          primary={i18n.t("mainDrawer.listItems.tags")}
          icon={<LocalOfferIcon />}
          listItemClassName={classes.listItem}
          listItemIconClassName={classes.listItemIcon}
          listItemTextClassName={classes.listItemText}
          selected={selTags}
        />
      )}
      {showFilesNav && (
        <ListItemLink
          to="/files"
          primary={i18n.t("mainDrawer.listItems.files")}
          icon={<AttachFile />}
          listItemClassName={classes.listItem}
          listItemIconClassName={classes.listItemIcon}
          listItemTextClassName={classes.listItemText}
          selected={selArquivos}
        />
      )}
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
        yes={() =>
          planFlags.loaded && showDashboardNav ? (
            <ListItemLink
              to="/"
              primary={i18n.t("mainDrawer.sections.dashboard")}
              icon={<DashboardOutlinedIcon />}
              listItemClassName={classes.listItem}
              listItemIconClassName={classes.listItemIcon}
              listItemTextClassName={classes.listItemText}
              selected={selDashboard}
            />
          ) : null
        }
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

      {user?.companyId != null &&
        user?.companyId !== "" &&
        !user?.super && (
          <ListItemLink
            to="/notifications"
            primary={i18n.t("mainDrawer.listItems.notificationCenter")}
            icon={<NotificationsIcon />}
            listItemClassName={classes.listItem}
            listItemIconClassName={classes.listItemIcon}
            listItemTextClassName={classes.listItemText}
            selected={selNotifications}
          />
        )}

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

      {planFlags.loaded && automacaoVisible ? (
        <ListItemLink
          to={toAutomacao}
          primary={i18n.t("mainDrawer.sections.automacao")}
          icon={<AccountTree />}
          listItemClassName={classes.listItem}
          listItemIconClassName={classes.listItemIcon}
          listItemTextClassName={classes.listItemText}
          selected={selAutomacao}
        />
      ) : null}

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

          {planFlags.loaded && showTeamUsersNav ? (
            <ListItemLink
              to="/users"
              primary={i18n.t("mainDrawer.sections.equipe")}
              icon={<PeopleAltOutlinedIcon />}
              listItemClassName={classes.listItem}
              listItemIconClassName={classes.listItemIcon}
              listItemTextClassName={classes.listItemText}
              selected={selEquipe}
            />
          ) : null}

          {planFlags.loaded && showFinanceNav ? (
            <ListItemLink
              to="/financeiro"
              primary={i18n.t("mainDrawer.sections.financeiro")}
              icon={<LocalAtmIcon />}
              listItemClassName={classes.listItem}
              listItemIconClassName={classes.listItemIcon}
              listItemTextClassName={classes.listItemText}
              selected={selFinanceiro}
            />
          ) : null}

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
