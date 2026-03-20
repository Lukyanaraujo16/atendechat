import React, { useContext, useEffect, useReducer, useState } from "react";
import { Link as RouterLink, useHistory, useLocation } from "react-router-dom";

import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import ListSubheader from "@material-ui/core/ListSubheader";
import Divider from "@material-ui/core/Divider";
import { Badge, Collapse, List } from "@material-ui/core";
import DashboardOutlinedIcon from "@material-ui/icons/DashboardOutlined";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import SyncAltIcon from "@material-ui/icons/SyncAlt";
import SettingsOutlinedIcon from "@material-ui/icons/SettingsOutlined";
import PeopleAltOutlinedIcon from "@material-ui/icons/PeopleAltOutlined";
import ContactPhoneOutlinedIcon from "@material-ui/icons/ContactPhoneOutlined";
import AccountTreeOutlinedIcon from "@material-ui/icons/AccountTreeOutlined";
import FlashOnIcon from "@material-ui/icons/FlashOn";
import HelpOutlineIcon from "@material-ui/icons/HelpOutline";
import CodeRoundedIcon from "@material-ui/icons/CodeRounded";
import EventIcon from "@material-ui/icons/Event";
import LocalOfferIcon from "@material-ui/icons/LocalOffer";
import EventAvailableIcon from "@material-ui/icons/EventAvailable";
import ExpandLessIcon from "@material-ui/icons/ExpandLess";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import DescriptionOutlinedIcon from "@material-ui/icons/DescriptionOutlined";
import PeopleIcon from "@material-ui/icons/People";
import ListIcon from "@material-ui/icons/ListAlt";
import AnnouncementIcon from "@material-ui/icons/Announcement";
import ForumIcon from "@material-ui/icons/Forum";
import LocalAtmIcon from '@material-ui/icons/LocalAtm';
import RotateRight from "@material-ui/icons/RotateRight";
import { i18n } from "../translate/i18n";
import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../context/Auth/AuthContext";
import LoyaltyRoundedIcon from '@material-ui/icons/LoyaltyRounded';
import { Can } from "../components/Can";
import { SocketContext } from "../context/Socket/SocketContext";
import { isArray } from "lodash";
import TableChartIcon from '@material-ui/icons/TableChart';
import api from "../services/api";
import BorderColorIcon from '@material-ui/icons/BorderColor';
import ToDoList from "../pages/ToDoList/";
import toastError from "../errors/toastError";
import { makeStyles } from "@material-ui/core/styles";
import { AccountTree, AllInclusive, AttachFile, BlurCircular, Chat, DeviceHubOutlined, Schedule } from '@material-ui/icons';
import usePlans from "../hooks/usePlans";
import Typography from "@material-ui/core/Typography";
import { ShapeLine } from "@mui/icons-material";

const SIDEBAR_GREEN = "#24c776";

const useStyles = makeStyles((theme) => ({
  ListSubheader: {
    height: 26,
    marginTop: "-15px",
    marginBottom: "-10px",
    color: "rgba(0, 0, 0, 0.87)",
  },
  listItemIcon: {
    color: SIDEBAR_GREEN,
    minWidth: 40,
  },
  listItemText: {
    color: "rgba(0, 0, 0, 0.87)",
    "&.MuiListItemText-primary": {
      fontWeight: 500,
    },
  },
  listItem: {
    "&:hover": {
      backgroundColor: "rgba(36, 199, 118, 0.08)",
    },
    "&.Mui-selected": {
      backgroundColor: "rgba(36, 199, 118, 0.12)",
      borderLeft: `3px solid ${SIDEBAR_GREEN}`,
      "& .MuiListItemIcon-root": {
        color: SIDEBAR_GREEN,
      },
    },
  },
}));


function ListItemLink(props) {
  const { icon, primary, to, className, listItemClassName, listItemIconClassName, listItemTextClassName } = props;

  const renderLink = React.useMemo(
    () =>
      React.forwardRef((itemProps, ref) => (
        <RouterLink to={to} ref={ref} {...itemProps} />
      )),
    [to]
  );

  return (
    <li>
      <ListItem button dense component={renderLink} className={listItemClassName || className}>
        {icon ? <ListItemIcon className={listItemIconClassName}>{icon}</ListItemIcon> : null}
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
    const changedChats = state.map((chat) => {
      if (chat.id === action.payload.chat.id) {
        return action.payload.chat;
      }
      return chat;
    });
    return changedChats;
  }
};

const MainListItems = (props) => {
  const classes = useStyles();
  const { drawerClose, collapsed } = props;
  const { whatsApps } = useContext(WhatsAppsContext);
  const { user, handleLogout } = useContext(AuthContext);
  const [connectionWarning, setConnectionWarning] = useState(false);
  const [openCampaignSubmenu, setOpenCampaignSubmenu] = useState(false);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [showKanban, setShowKanban] = useState(false);
  const [showOpenAi, setShowOpenAi] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false); const history = useHistory();
  const [showSchedules, setShowSchedules] = useState(false);
  const [showInternalChat, setShowInternalChat] = useState(false);
  const [showExternalApi, setShowExternalApi] = useState(false);


  const [invisible, setInvisible] = useState(true);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam] = useState("");
  const [chats, dispatch] = useReducer(reducer, []);
  const { getPlanCompany } = usePlans();
  
  const [openFlowsSubmenu, setOpenFlowsSubmenu] = useState(false);
  const [openDashboardSubmenu, setOpenDashboardSubmenu] = useState(true);
  const [openGestaoSubmenu, setOpenGestaoSubmenu] = useState(true);
  const [openAdministracaoSubmenu, setOpenAdministracaoSubmenu] = useState(true);
  const [openAjustesSubmenu, setOpenAjustesSubmenu] = useState(true);
  const location = useLocation();

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    if (location.pathname === "/" || location.pathname === "/relatorios") {
      setOpenDashboardSubmenu(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith("/chats")) {
      setOpenGestaoSubmenu(true);
      return;
    }
    const shouldOpen = [
      "/",
      "/contacts",
      "/tags",
      "/financeiro",
      "/quick-messages",
      "/todolist",
      "/schedules",
    ].includes(path);
    setOpenGestaoSubmenu(shouldOpen);
  }, [location.pathname]);

  useEffect(() => {
    const path = location.pathname;
    const shouldOpen = [
      "/users",
      "/messages-api",
      "/queues",
      "/setores",
      "/financeiro",
    ].includes(path);
    setOpenAdministracaoSubmenu(shouldOpen);
  }, [location.pathname]);

  useEffect(() => {
    const path = location.pathname;
    const shouldOpen = [
      "/prompts",
      "/queue-integration",
      "/settings",
      "/connections",
    ].includes(path);
    setOpenAjustesSubmenu(shouldOpen);
  }, [location.pathname]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
 

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);

      setShowCampaigns(planConfigs.plan.useCampaigns);
      setShowKanban(planConfigs.plan.useKanban);
      setShowOpenAi(planConfigs.plan.useOpenAi);
      setShowIntegrations(planConfigs.plan.useIntegrations);
      setShowSchedules(planConfigs.plan.useSchedules);
      setShowInternalChat(planConfigs.plan.useInternalChat);
      setShowExternalApi(planConfigs.plan.useExternalApi);
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



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
      if (data.action === "new-message") {
        dispatch({ type: "CHANGE_CHAT", payload: data });
      }
      if (data.action === "update") {
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
    if (unreadsCount > 0) {
      setInvisible(false);
    } else {
      setInvisible(true);
    }
  }, [chats, user.id]);

  useEffect(() => {
    if (localStorage.getItem("cshow")) {
      setShowCampaigns(true);
    }
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (whatsApps.length > 0) {
        const offlineWhats = whatsApps.filter((whats) => {
          return (
            whats.status === "qrcode" ||
            whats.status === "PAIRING" ||
            whats.status === "DISCONNECTED" ||
            whats.status === "TIMEOUT" ||
            whats.status === "OPENING"
          );
        });
        if (offlineWhats.length > 0) {
          setConnectionWarning(true);
        } else {
          setConnectionWarning(false);
        }
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

  const handleClickLogout = () => {
    //handleCloseMenu();
    handleLogout();
  };

  return (
    <div onClick={drawerClose}>
      <Can
        role={user.profile}
        perform="dashboard:view"
        yes={() => (
          <>
            <ListItem
              button
              onClick={() => setOpenDashboardSubmenu((prev) => !prev)}
              className={classes.listItem}
            >
              <ListItemIcon className={classes.listItemIcon}>
                <DashboardOutlinedIcon />
              </ListItemIcon>
              <ListItemText primary="Dashboard" className={classes.listItemText} />
              {openDashboardSubmenu ? (
                <ExpandLessIcon style={{ color: SIDEBAR_GREEN }} />
              ) : (
                <ExpandMoreIcon style={{ color: SIDEBAR_GREEN }} />
              )}
            </ListItem>
            <Collapse in={openDashboardSubmenu} timeout="auto" unmountOnExit>
              <List component="div" disablePadding style={{ paddingLeft: 15 }}>
                <ListItem
                  button
                  dense
                  component={RouterLink}
                  to="/"
                  className={classes.listItem}
                  selected={location.pathname === "/"}
                >
                  <ListItemIcon className={classes.listItemIcon}>
                    <DashboardOutlinedIcon />
                  </ListItemIcon>
                  <ListItemText primary="Dashboard" className={classes.listItemText} />
                </ListItem>
                <ListItem
                  button
                  dense
                  component={RouterLink}
                  to="/relatorios"
                  className={classes.listItem}
                  selected={location.pathname === "/relatorios"}
                >
                  <ListItemIcon className={classes.listItemIcon}>
                    <DescriptionOutlinedIcon />
                  </ListItemIcon>
                  <ListItemText primary="Relatórios Gerados" className={classes.listItemText} />
                </ListItem>
              </List>
            </Collapse>
          </>
        )}
      />

      <ListItemLink
        to="/tickets"
        primary={i18n.t("mainDrawer.listItems.tickets")}
        icon={<WhatsAppIcon />}
        listItemClassName={classes.listItem}
        listItemIconClassName={classes.listItemIcon}
        listItemTextClassName={classes.listItemText}
      />
	{showKanban && (
	  <ListItemLink
        to="/kanban"
        primary="Kanban"
        icon={<TableChartIcon />}
        listItemClassName={classes.listItem}
        listItemIconClassName={classes.listItemIcon}
        listItemTextClassName={classes.listItemText}
      />
	)}


      <ListItemLink
        to="/chats"
        primary={i18n.t("mainDrawer.listItems.chats")}
        icon={
          <Badge color="secondary" variant="dot" invisible={invisible}>
            <ForumIcon />
          </Badge>
        }
        listItemClassName={classes.listItem}
        listItemIconClassName={classes.listItemIcon}
        listItemTextClassName={classes.listItemText}
      />

      <ListItem
        button
        onClick={() => setOpenGestaoSubmenu((prev) => !prev)}
        className={classes.listItem}
      >
        <ListItemIcon className={classes.listItemIcon}>
          <SettingsOutlinedIcon />
        </ListItemIcon>
        <ListItemText primary="Gestão" className={classes.listItemText} />
        {openGestaoSubmenu ? (
          <ExpandLessIcon style={{ color: SIDEBAR_GREEN }} />
        ) : (
          <ExpandMoreIcon style={{ color: SIDEBAR_GREEN }} />
        )}
      </ListItem>

      <Collapse
        style={{ paddingLeft: 15 }}
        in={openGestaoSubmenu}
        timeout="auto"
        unmountOnExit
      >
        <List component="div" disablePadding>
          <ListItem
            button
            dense
            component={RouterLink}
            to="/contacts"
            className={classes.listItem}
            selected={location.pathname === "/contacts"}
          >
            <ListItemIcon className={classes.listItemIcon}>
              <ContactPhoneOutlinedIcon />
            </ListItemIcon>
            <ListItemText primary={i18n.t("mainDrawer.listItems.contacts")} className={classes.listItemText} />
          </ListItem>

          <ListItem
            button
            dense
            component={RouterLink}
            to="/tags"
            className={classes.listItem}
            selected={location.pathname === "/tags"}
          >
            <ListItemIcon className={classes.listItemIcon}>
              <LocalOfferIcon />
            </ListItemIcon>
            <ListItemText primary={i18n.t("mainDrawer.listItems.tags")} className={classes.listItemText} />
          </ListItem>

          <ListItem
            button
            dense
            component={RouterLink}
            to="/financeiro"
            className={classes.listItem}
            selected={location.pathname === "/financeiro"}
          >
            <ListItemIcon className={classes.listItemIcon}>
              <LocalAtmIcon />
            </ListItemIcon>
            <ListItemText primary="Carteira de Clientes" className={classes.listItemText} />
          </ListItem>

          <ListItem
            button
            dense
            component={RouterLink}
            to="/quick-messages"
            className={classes.listItem}
            selected={location.pathname === "/quick-messages"}
          >
            <ListItemIcon className={classes.listItemIcon}>
              <FlashOnIcon />
            </ListItemIcon>
            <ListItemText
              primary={i18n.t("mainDrawer.listItems.quickMessages")}
              className={classes.listItemText}
            />
          </ListItem>

          <ListItem
            button
            dense
            component={RouterLink}
            to="/todolist"
            className={classes.listItem}
            selected={location.pathname === "/todolist"}
          >
            <ListItemIcon className={classes.listItemIcon}>
              <BorderColorIcon />
            </ListItemIcon>
            <ListItemText primary={i18n.t("mainDrawer.listItems.tasks")} className={classes.listItemText} />
          </ListItem>

          <ListItem
            button
            dense
            component={RouterLink}
            to="/schedules"
            className={classes.listItem}
            selected={location.pathname === "/schedules"}
          >
            <ListItemIcon className={classes.listItemIcon}>
              <EventIcon />
            </ListItemIcon>
            <ListItemText primary={i18n.t("mainDrawer.listItems.schedules")} className={classes.listItemText} />
          </ListItem>

          <ListItem
            button
            dense
            component={RouterLink}
            to="/"
            className={classes.listItem}
            selected={location.pathname === "/"}
          >
            <ListItemIcon className={classes.listItemIcon}>
              <DashboardOutlinedIcon />
            </ListItemIcon>
            <ListItemText primary="Avaliação" className={classes.listItemText} />
          </ListItem>
        </List>
      </Collapse>

      <Can
        role={user.profile}
        perform="drawer-admin-items:view"
        yes={() => (
          <>
            <ListItem
              button
              onClick={() => setOpenAdministracaoSubmenu((prev) => !prev)}
              className={classes.listItem}
            >
              <ListItemIcon className={classes.listItemIcon}>
                <SettingsOutlinedIcon />
              </ListItemIcon>
              <ListItemText primary="Administração" className={classes.listItemText} />
              {openAdministracaoSubmenu ? (
                <ExpandLessIcon style={{ color: SIDEBAR_GREEN }} />
              ) : (
                <ExpandMoreIcon style={{ color: SIDEBAR_GREEN }} />
              )}
            </ListItem>

            <Collapse
              style={{ paddingLeft: 15 }}
              in={openAdministracaoSubmenu}
              timeout="auto"
              unmountOnExit
            >
              <List component="div" disablePadding>
                <ListItem
                  button
                  dense
                  component={RouterLink}
                  to="/users"
                  className={classes.listItem}
                  selected={location.pathname === "/users"}
                >
                  <ListItemIcon className={classes.listItemIcon}>
                    <PeopleAltOutlinedIcon />
                  </ListItemIcon>
                  <ListItemText primary={i18n.t("mainDrawer.listItems.users")} className={classes.listItemText} />
                </ListItem>

                {showExternalApi && (
                  <ListItem
                    button
                    dense
                    component={RouterLink}
                    to="/messages-api"
                    className={classes.listItem}
                    selected={location.pathname === "/messages-api"}
                  >
                    <ListItemIcon className={classes.listItemIcon}>
                      <CodeRoundedIcon />
                    </ListItemIcon>
                    <ListItemText primary="API" className={classes.listItemText} />
                  </ListItem>
                )}

                <ListItem
                  button
                  dense
                  component={RouterLink}
                  to="/setores"
                  className={classes.listItem}
                  selected={location.pathname === "/setores" || location.pathname === "/queues"}
                >
                  <ListItemIcon className={classes.listItemIcon}>
                    <AccountTreeOutlinedIcon />
                  </ListItemIcon>
                  <ListItemText primary="Setores" className={classes.listItemText} />
                </ListItem>

                <ListItem
                  button
                  dense
                  component={RouterLink}
                  to="/financeiro"
                  className={classes.listItem}
                  selected={location.pathname === "/financeiro"}
                >
                  <ListItemIcon className={classes.listItemIcon}>
                    <LocalAtmIcon />
                  </ListItemIcon>
                  <ListItemText primary="Financeiro" className={classes.listItemText} />
                </ListItem>
              </List>
            </Collapse>

            <ListItem
              button
              onClick={() => setOpenAjustesSubmenu((prev) => !prev)}
              className={classes.listItem}
            >
              <ListItemIcon className={classes.listItemIcon}>
                <SettingsOutlinedIcon />
              </ListItemIcon>
              <ListItemText primary="Ajustes" className={classes.listItemText} />
              {openAjustesSubmenu ? (
                <ExpandLessIcon style={{ color: SIDEBAR_GREEN }} />
              ) : (
                <ExpandMoreIcon style={{ color: SIDEBAR_GREEN }} />
              )}
            </ListItem>

            <Collapse
              style={{ paddingLeft: 15 }}
              in={openAjustesSubmenu}
              timeout="auto"
              unmountOnExit
            >
              <List component="div" disablePadding>
                {showOpenAi && (
                  <ListItem
                    button
                    dense
                    component={RouterLink}
                    to="/prompts"
                    className={classes.listItem}
                    selected={location.pathname === "/prompts"}
                  >
                    <ListItemIcon className={classes.listItemIcon}>
                      <AllInclusive />
                    </ListItemIcon>
                    <ListItemText primary="OPEN.AI" className={classes.listItemText} />
                  </ListItem>
                )}
                {showIntegrations && (
                  <ListItem
                    button
                    dense
                    component={RouterLink}
                    to="/queue-integration"
                    className={classes.listItem}
                    selected={location.pathname === "/queue-integration"}
                  >
                    <ListItemIcon className={classes.listItemIcon}>
                      <DeviceHubOutlined />
                    </ListItemIcon>
                    <ListItemText primary="Integrações" className={classes.listItemText} />
                  </ListItem>
                )}
                <ListItem
                  button
                  dense
                  component={RouterLink}
                  to="/settings"
                  className={classes.listItem}
                  selected={location.pathname === "/settings"}
                >
                  <ListItemIcon className={classes.listItemIcon}>
                    <SettingsOutlinedIcon />
                  </ListItemIcon>
                  <ListItemText primary="Configurações" className={classes.listItemText} />
                </ListItem>
                <ListItem
                  button
                  dense
                  component={RouterLink}
                  to="/connections"
                  className={classes.listItem}
                  selected={location.pathname === "/connections"}
                >
                  <ListItemIcon className={classes.listItemIcon}>
                    <Badge badgeContent={connectionWarning ? "!" : 0} color="error">
                      <SyncAltIcon />
                    </Badge>
                  </ListItemIcon>
                  <ListItemText primary="Conexões" className={classes.listItemText} />
                </ListItem>
              </List>
            </Collapse>
          </>
        )}
      />

      <Can
        role={user.profile}
        perform="drawer-admin-items:view"
        yes={() => (
          <>
            {showCampaigns && (
              <>
                <ListItem
                  button
                  onClick={() => setOpenCampaignSubmenu((prev) => !prev)}
                  className={classes.listItem}
                >
                  <ListItemIcon className={classes.listItemIcon}>
                    <EventAvailableIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={i18n.t("mainDrawer.listItems.campaigns")}
                    className={classes.listItemText}
                  />
                  {openCampaignSubmenu ? (
                    <ExpandLessIcon style={{ color: SIDEBAR_GREEN }} />
                  ) : (
                    <ExpandMoreIcon style={{ color: SIDEBAR_GREEN }} />
                  )}
                </ListItem>
                <Collapse
                  style={{ paddingLeft: 15 }}
                  in={openCampaignSubmenu}
                  timeout="auto"
                  unmountOnExit
                >
                  <List component="div" disablePadding>
                    <ListItem onClick={() => history.push("/campaigns")} button className={classes.listItem}>
                      <ListItemIcon className={classes.listItemIcon}><ListIcon /></ListItemIcon>
                      <ListItemText primary="Listagem" className={classes.listItemText} />
                    </ListItem>
                    <ListItem onClick={() => history.push("/contact-lists")} button className={classes.listItem}>
                      <ListItemIcon className={classes.listItemIcon}><PeopleIcon /></ListItemIcon>
                      <ListItemText primary="Listas de Contatos" className={classes.listItemText} />
                    </ListItem>
                    <ListItem onClick={() => history.push("/campaigns-config")} button className={classes.listItem}>
                      <ListItemIcon className={classes.listItemIcon}><SettingsOutlinedIcon /></ListItemIcon>
                      <ListItemText primary="Configurações" className={classes.listItemText} />
                    </ListItem>
                  </List>
                </Collapse>
                <ListItem button onClick={() => setOpenFlowsSubmenu((prev) => !prev)} className={classes.listItem}>
                  <ListItemIcon className={classes.listItemIcon}><AccountTree /></ListItemIcon>
                  <ListItemText primary={i18n.t("mainDrawer.listItems.flows")} className={classes.listItemText} />
                  {openFlowsSubmenu ? <ExpandLessIcon style={{ color: SIDEBAR_GREEN }} /> : <ExpandMoreIcon style={{ color: SIDEBAR_GREEN }} />}
                </ListItem>
                <Collapse style={{ paddingLeft: 15 }} in={openFlowsSubmenu} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    <ListItem onClick={() => history.push("/phrase-lists")} button className={classes.listItem}>
                      <ListItemIcon className={classes.listItemIcon}><EventAvailableIcon /></ListItemIcon>
                      <ListItemText primary="Campanha" className={classes.listItemText} />
                    </ListItem>
                    <ListItem onClick={() => history.push("/flowbuilders")} button className={classes.listItem}>
                      <ListItemIcon className={classes.listItemIcon}><ShapeLine /></ListItemIcon>
                      <ListItemText primary="Conversa" className={classes.listItemText} />
                    </ListItem>
                  </List>
                </Collapse>
              </>
            )}

            {user.super && (
              <ListItemLink
                to="/announcements"
                primary={i18n.t("mainDrawer.listItems.annoucements")}
                icon={<AnnouncementIcon />}
                listItemClassName={classes.listItem}
                listItemIconClassName={classes.listItemIcon}
                listItemTextClassName={classes.listItemText}
              />
            )}
            <ListItemLink
              to="/files"
              primary={i18n.t("mainDrawer.listItems.files")}
              icon={<AttachFile />}
              listItemClassName={classes.listItem}
              listItemIconClassName={classes.listItemIcon}
              listItemTextClassName={classes.listItemText}
            />

            {!collapsed && <React.Fragment>
              <Divider />
              <Typography style={{ fontSize: "12px", padding: "10px", textAlign: "right", fontWeight: "bold" }}>
                8.0.1
              </Typography>
            </React.Fragment>
            }
          </>
        )}
      />

      <ListItemLink
        to="/helps"
        primary={i18n.t("mainDrawer.listItems.helps")}
        icon={<HelpOutlineIcon />}
        listItemClassName={classes.listItem}
        listItemIconClassName={classes.listItemIcon}
        listItemTextClassName={classes.listItemText}
      />
    </div>
  );
};

export default MainListItems;
