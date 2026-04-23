import React, { useState, useContext, useEffect } from "react";
import clsx from "clsx";
import moment from "moment";
import {
  makeStyles,
  Avatar,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  MenuItem,
  IconButton,
  Menu,
  Switch,
  useTheme,
  useMediaQuery,
  Button,
} from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";
import { Link, useLocation } from "react-router-dom";

import MenuIcon from "@material-ui/icons/Menu";
import AccountCircle from "@material-ui/icons/AccountCircle";

import MainListItems from "./MainListItems";
import NotificationsPopOver from "../components/NotificationsPopOver";
import NotificationsVolume from "../components/NotificationsVolume";
import UserModal from "../components/UserModal";
import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
import DarkMode from "../components/DarkMode";
import { i18n } from "../translate/i18n";
import toastError from "../errors/toastError";
import AnnouncementsPopover from "../components/AnnouncementsPopover";

import { useBranding } from "../context/Branding/BrandingContext";
import { SocketContext } from "../context/Socket/SocketContext";
import ChatPopover from "../pages/Chat/ChatPopover";

import { useDate } from "../hooks/useDate";

import ColorModeContext from "../layout/themeContext";
import Brightness4Icon from '@material-ui/icons/Brightness4';
import Brightness7Icon from '@material-ui/icons/Brightness7';
import LanguageControl from "../components/LanguageControl";
import ConfirmationModal from "../components/ConfirmationModal";
import { versionSystem } from "../../package.json";

const drawerWidth = 299;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100vh",
    [theme.breakpoints.down("sm")]: {
      height: "calc(100vh - 56px)",
    },
    backgroundColor: theme.palette.background.default,
    '& .MuiButton-outlinedPrimary': {
      color: theme.palette.primary.contrastText,
      backgroundColor:
        theme.palette.type === "light"
          ? theme.palette.primary.main
          : theme.palette.background.paper,
      borderColor: theme.palette.primary.main,
      "&:hover": {
        backgroundColor:
          theme.palette.type === "light"
            ? theme.palette.primary.dark
            : theme.palette.action.hover,
      },
    },
    '& .MuiTab-textColorPrimary.Mui-selected': {
      color: theme.palette.primary.main,
    },
  },
  avatar: {
    width: "100%",
  },
  toolbar: {
    paddingRight: 24,
    minHeight: 50,
    height: 50,
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background.paper,
    borderBottom: `1px solid ${theme.palette.divider}`,
    "& .MuiIconButton-root": {
      color: `${theme.palette.action.active} !important`,
    },
    "& .MuiIconButton-root:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  /** Topo do drawer: logo centrada, altura fixa, sem empurrar a lista */
  drawerLogoContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    minHeight: 68,
    maxHeight: 72,
    boxSizing: "border-box",
    padding: theme.spacing(1.25, 1.5),
    flexShrink: 0,
    [theme.breakpoints.down("sm")]: {
      minHeight: 64,
      maxHeight: 68,
      padding: theme.spacing(1, 1),
    },
  },
  menuLogoImage: {
    maxHeight: 40,
    width: "auto",
    maxWidth: "100%",
    height: "auto",
    objectFit: "contain",
    display: "block",
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    boxShadow: "none",
    borderBottom: `1px solid ${theme.palette.divider}`,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },
  appBarShift: {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    [theme.breakpoints.down("sm")]: {
      display: "none"
    }
  },
  menuButton: {
    marginRight: 36,
  },
  menuButtonHidden: {
    display: "none",
  },
  title: {
    flexGrow: 1,
    fontSize: 14,
    color: theme.palette.text.primary,
  },
  drawerPaper: {
    position: "relative",
    whiteSpace: "nowrap",
    width: drawerWidth,
    height: "100%",
    backgroundColor: theme.palette.background.paper,
    borderRight: `1px solid ${theme.palette.divider}`,
    overflowX: "hidden",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    [theme.breakpoints.down("sm")]: {
      width: "100%"
    },
    ...theme.scrollbarStylesSoft
  },
  drawerToolbar: {
    "& .MuiIconButton-root": {
      color: theme.palette.action.active,
    },
  },
  drawerPaperClose: {
    overflowX: "hidden",
    backgroundColor: theme.palette.background.paper,
    borderRight: `1px solid ${theme.palette.divider}`,
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    width: theme.spacing(7),
    [theme.breakpoints.up("sm")]: {
      width: theme.spacing(9),
    },
    [theme.breakpoints.down("sm")]: {
      width: "100%"
    }
  },
  appBarSpacer: {
    minHeight: 50,
  },
  content: {
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    overflow: "auto",
    overflowX: "hidden",
    minHeight: 0,
    WebkitOverflowScrolling: "touch",
    backgroundColor: theme.palette.background.default,
    color: theme.palette.text.primary,
  },
  /** Atendimentos: encadear altura para scroll só na lista/conversa (não no documento) */
  contentTicketsFocus: {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  contentChildrenGrow: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  container: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4),
  },
  paper: {
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column"
  },
  containerWithScroll: {
    flex: 1,
    minHeight: 0,
    padding: 0,
    overflowY: "auto",
    overflowX: "hidden",
    ...theme.scrollbarStyles,
  },
  drawerFooter: {
    flexShrink: 0,
    padding: theme.spacing(1.25, 2),
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  drawerFooterUser: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.25),
    marginBottom: theme.spacing(0.5),
  },
  drawerFooterName: {
    fontWeight: 600,
    color: theme.palette.text.primary,
  },
  drawerAvatar: {
    width: 36,
    height: 36,
    backgroundColor: theme.palette.primary.main,
  },
  attendanceLabel: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  drawerFooterRole: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    marginBottom: 0,
  },
  drawerFooterVersion: {
    fontSize: "0.625rem",
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
    opacity: 0.7,
  },
  NotificationsPopOver: {
    // color: theme.barraSuperior.secondary.main,
  },
  supportAlert: {
    margin: theme.spacing(0, 2, 2),
    alignItems: "center",
  },
  supportExitButton: {
    fontWeight: 600,
    backgroundColor:
      theme.palette.type === "light"
        ? theme.palette.common.white
        : "rgba(255, 255, 255, 0.92)",
    color: "#0d47a1",
    "&:hover": {
      backgroundColor:
        theme.palette.type === "light"
          ? theme.palette.grey[100]
          : "rgba(255, 255, 255, 1)",
    },
  },
  financeAlert: {
    margin: theme.spacing(0, 2, 2),
    alignItems: "center",
  },
}));

const LoggedInLayout = ({ children, themeToggle }) => {
  const classes = useStyles();
  const location = useLocation();
  const isTicketsPage =
    location.pathname === "/tickets" || location.pathname.startsWith("/tickets/");
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { handleLogout, loading, user, exitSupportMode } = useContext(AuthContext);
  const [drawerOpen, setDrawerOpen] = useState(() => {
    const saved = localStorage.getItem("drawerOpen");
    if (saved !== null) return saved === "true";
    return true; // sempre expandido por padrão, independente da resolução
  });
  const [drawerVariant, setDrawerVariant] = useState("permanent");
  // const [dueDate, setDueDate] = useState("");
  const { branding, resolveMenuLogo } = useBranding();
  const menuLogoSrc = resolveMenuLogo();

  const theme = useTheme();
  const { colorMode } = useContext(ColorModeContext);
  const greaterThenSm = useMediaQuery(theme.breakpoints.up("sm"));

  const [volume, setVolume] = useState(localStorage.getItem("volume") || 1);
  const [attendancePaused, setAttendancePaused] = useState(
    () => localStorage.getItem("attendancePaused") === "true"
  );
  const [showPauseConfirmDialog, setShowPauseConfirmDialog] = useState(false);

  const { dateToClient } = useDate();

  //################### CODIGOS DE TESTE #########################################
  // useEffect(() => {
  //   navigator.getBattery().then((battery) => {
  //     console.log(`Battery Charging: ${battery.charging}`);
  //     console.log(`Battery Level: ${battery.level * 100}%`);
  //     console.log(`Charging Time: ${battery.chargingTime}`);
  //     console.log(`Discharging Time: ${battery.dischargingTime}`);
  //   })
  // }, []);

  // useEffect(() => {
  //   const geoLocation = navigator.geolocation

  //   geoLocation.getCurrentPosition((position) => {
  //     let lat = position.coords.latitude;
  //     let long = position.coords.longitude;

  //     console.log('latitude: ', lat)
  //     console.log('longitude: ', long)
  //   })
  // }, []);

  // useEffect(() => {
  //   const nucleos = window.navigator.hardwareConcurrency;

  //   console.log('Nucleos: ', nucleos)
  // }, []);

  // useEffect(() => {
  //   console.log('userAgent', navigator.userAgent)
  //   if (
  //     navigator.userAgent.match(/Android/i)
  //     || navigator.userAgent.match(/webOS/i)
  //     || navigator.userAgent.match(/iPhone/i)
  //     || navigator.userAgent.match(/iPad/i)
  //     || navigator.userAgent.match(/iPod/i)
  //     || navigator.userAgent.match(/BlackBerry/i)
  //     || navigator.userAgent.match(/Windows Phone/i)
  //   ) {
  //     console.log('é mobile ', true) //celular
  //   }
  //   else {
  //     console.log('não é mobile: ', false) //nao é celular
  //   }
  // }, []);
  //##############################################################################

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    if (document.body.offsetWidth < 600) {
      setDrawerVariant("temporary");
    } else {
      setDrawerVariant("permanent");
    }
  }, [drawerOpen]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const userId = localStorage.getItem("userId");

    const socket = socketManager.getSocket(companyId);

    socket.on(`company-${companyId}-auth`, (data) => {
      if (data.user.id === +userId) {
        toastError("Sua conta foi acessada em outro computador.");
        setTimeout(() => {
          localStorage.clear();
          window.location.reload();
        }, 1000);
      }
    });

    socket.emit("userStatus");
    const interval = setInterval(() => {
      socket.emit("userStatus");
    }, 1000 * 60 * 5);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [socketManager]);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
    setMenuOpen(true);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setMenuOpen(false);
  };

  const handleOpenUserModal = () => {
    setUserModalOpen(true);
    handleCloseMenu();
  };

  const handleClickLogout = () => {
    handleCloseMenu();
    handleLogout();
  };

  const drawerClose = () => {
    if (document.body.offsetWidth < 600) {
      setDrawerOpen(false);
    }
  };

  const handleAttendancePausedChange = (event) => {
    const wantToPause = !event.target.checked;
    if (wantToPause) {
      setShowPauseConfirmDialog(true);
    } else {
      setAttendancePaused(false);
      localStorage.setItem("attendancePaused", "false");
    }
  };

  const handleConfirmPause = () => {
    setAttendancePaused(true);
    localStorage.setItem("attendancePaused", "true");
    setShowPauseConfirmDialog(false);
    // TODO: emitir para backend e enviar mensagem automática quando pausado
  };

  const handleMenuItemClick = () => {
    const { innerWidth: width } = window;
    if (width <= 600) {
      setDrawerOpen(false);
    }
  };

  const toggleColorMode = () => {
    colorMode.toggleColorMode();
  }

  if (loading) {
    return <BackdropLoading />;
  }

  return (
    <div className={classes.root}>
      <Drawer
        variant={drawerVariant}
        className={drawerOpen ? classes.drawerPaper : classes.drawerPaperClose}
        classes={{
          paper: clsx(
            classes.drawerPaper,
            !drawerOpen && classes.drawerPaperClose
          ),
        }}
        open={drawerOpen}
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
          <div className={classes.drawerLogoContainer}>
            <img
              src={menuLogoSrc}
              className={classes.menuLogoImage}
              alt={branding.systemName || "logo"}
            />
          </div>
          <Divider />
          <List className={classes.containerWithScroll}>
            <MainListItems drawerClose={drawerClose} />
          </List>
          {drawerOpen && (
            <div className={classes.drawerFooter}>
              <div className={classes.drawerFooterUser}>
                <Avatar className={classes.drawerAvatar}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : "?"}
                </Avatar>
                <Typography variant="body2" className={classes.drawerFooterName} noWrap>
                  {user?.name || "-"}
                </Typography>
              </div>
              <Typography className={classes.drawerFooterRole}>
                {user?.super
                  ? i18n.t("mainDrawer.drawerFooter.roleSuperAdmin")
                  : user?.profile === "admin"
                    ? i18n.t("mainDrawer.drawerFooter.roleAdmin")
                    : user?.profile === "user"
                      ? i18n.t("mainDrawer.drawerFooter.roleUser")
                      : user?.profile || "-"}
              </Typography>
              <Typography className={classes.drawerFooterVersion} component="div">
                v{versionSystem}
              </Typography>
            </div>
          )}
        </div>
      </Drawer>
      <UserModal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        userId={user?.id}
      />
      <ConfirmationModal
        open={showPauseConfirmDialog}
        onClose={() => setShowPauseConfirmDialog(false)}
        onConfirm={handleConfirmPause}
        title={i18n.t("mainDrawer.appBar.pauseAttendance.title")}
        confirmText={i18n.t("mainDrawer.appBar.pauseAttendance.confirm")}
        cancelText={i18n.t("mainDrawer.appBar.pauseAttendance.cancel")}
      >
        {i18n.t("mainDrawer.appBar.pauseAttendance.message")}
      </ConfirmationModal>
      <AppBar
        position="absolute"
        className={clsx(classes.appBar, drawerOpen && classes.appBarShift)}
        color="default"
      >
        <Toolbar variant="dense" className={classes.toolbar}>
          <IconButton
            edge="start"
            aria-label="menu"
            onClick={() => {
              const next = !drawerOpen;
              setDrawerOpen(next);
              localStorage.setItem("drawerOpen", String(next));
            }}
            className={classes.menuButton}
          >
            <MenuIcon />
          </IconButton>

          <Typography component="div" className={classes.title} style={{ flex: 1 }}/>

          <LanguageControl />

          <IconButton onClick={toggleColorMode}>
            {theme.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>

          <NotificationsVolume
            setVolume={setVolume}
            volume={volume}
          />

          {user.id && <NotificationsPopOver volume={volume} />}

          <AnnouncementsPopover />

          <ChatPopover />

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Typography variant="body2" className={classes.attendanceLabel}>
              {attendancePaused ? "Pausado" : "Ativo"}
            </Typography>
            <Switch
              checked={!attendancePaused}
              onChange={handleAttendancePausedChange}
              color="primary"
              size="small"
            />
          </div>

          <div>
            <IconButton
              aria-label="conta"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
            >
              <AccountCircle />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              getContentAnchorEl={null}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              open={menuOpen}
              onClose={handleCloseMenu}
            >
              <MenuItem onClick={handleOpenUserModal}>
                {i18n.t("mainDrawer.appBar.user.profile")}
              </MenuItem>
              <MenuItem onClick={handleClickLogout}>
                {i18n.t("mainDrawer.appBar.user.logout")}
              </MenuItem>
            </Menu>
          </div>
        </Toolbar>
      </AppBar>
      <main
        className={clsx(classes.content, isTicketsPage && classes.contentTicketsFocus)}
      >
        <div className={classes.appBarSpacer} />

        {user?.supportMode && user?.company?.name ? (
          <Alert
            severity="info"
            variant="filled"
            className={classes.supportAlert}
            icon={false}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 12,
                width: "100%",
              }}
            >
              <span style={{ flex: 1, minWidth: 200, fontWeight: 500 }}>
                {i18n.t("platform.support.banner", { name: user.company.name })}
              </span>
              <Button
                type="button"
                variant="contained"
                size="small"
                onClick={() => exitSupportMode()}
                className={classes.supportExitButton}
              >
                {i18n.t("platform.support.exitButton")}
              </Button>
            </div>
          </Alert>
        ) : null}

        {user?.finance?.delinquent && (
          <Alert
            severity="warning"
            variant="outlined"
            className={classes.financeAlert}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 12,
                width: "100%",
              }}
            >
              <span style={{ flex: 1, minWidth: 200 }}>
                {i18n.t("finance.banner.message")}
              </span>
              <Button
                component={Link}
                to="/financeiro"
                variant="contained"
                color="primary"
                size="small"
              >
                {i18n.t("finance.banner.action")}
              </Button>
            </div>
          </Alert>
        )}

        {children ? (
          isTicketsPage ? (
            <div className={classes.contentChildrenGrow}>{children}</div>
          ) : (
            children
          )
        ) : null}
      </main>
    </div>
  );
};

export default LoggedInLayout;
