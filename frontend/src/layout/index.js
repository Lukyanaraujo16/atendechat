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
} from "@material-ui/core";

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

import logo from "../assets/logo.png";
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
    backgroundColor: theme.palette.fancyBackground,
    '& .MuiButton-outlinedPrimary': {
      color: theme.mode === 'light' ? '#FFF' : '#FFF',
	  //backgroundColor: theme.mode === 'light' ? '#682ee2' : '#682ee2',
	backgroundColor: theme.mode === 'light' ? theme.palette.primary.main : '#1c1c1c',
      //border: theme.mode === 'light' ? '1px solid rgba(0 124 102)' : '1px solid rgba(255, 255, 255, 0.5)',
    },
    '& .MuiTab-textColorPrimary.Mui-selected': {
      color: theme.mode === 'light' ? 'Primary' : '#FFF',
    }
  },
  avatar: {
    width: "100%",
  },
  toolbar: {
    paddingRight: 24,
    minHeight: 50,
    height: 50,
    color: "rgba(0, 0, 0, 0.87)",
    backgroundColor: "#ffffff",
    borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
    "& .MuiIconButton-root": {
      color: "rgba(0, 0, 0, 0.54) !important",
    },
    "& .MuiIconButton-root:hover": {
      backgroundColor: "rgba(0, 0, 0, 0.04)",
    },
  },
  toolbarIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 8px",
    minHeight: 50,
    [theme.breakpoints.down("sm")]: {
      height: 50
    }
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
    backgroundColor: "#ffffff",
    color: "rgba(0, 0, 0, 0.87)",
    boxShadow: "none",
    borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
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
    color: "rgba(0, 0, 0, 0.87)",
  },
  drawerPaper: {
    position: "relative",
    whiteSpace: "nowrap",
    width: drawerWidth,
    height: "100%",
    backgroundColor: "#ffffff",
    borderRight: "1px solid rgba(0, 0, 0, 0.08)",
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
      color: "rgba(0, 0, 0, 0.54)",
    },
  },
  drawerPaperClose: {
    overflowX: "hidden",
    backgroundColor: "#ffffff",
    borderRight: "1px solid rgba(0, 0, 0, 0.08)",
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
    overflow: "auto",

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
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  drawerFooter: {
    padding: theme.spacing(2),
    borderTop: "1px solid rgba(0, 0, 0, 0.08)",
    backgroundColor: "rgba(0, 0, 0, 0.02)",
  },
  drawerFooterUser: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
  },
  drawerFooterRole: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
  },
  versionBadge: {
    display: "inline-block",
    backgroundColor: "#24c776",
    color: "#fff",
    fontSize: "0.7rem",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 6,
    marginRight: theme.spacing(0.75),
  },
  NotificationsPopOver: {
    // color: theme.barraSuperior.secondary.main,
  },
  logo: {
    width: "80%",
    height: "auto",
    maxWidth: 180,
    [theme.breakpoints.down("sm")]: {
      width: "auto",
      height: "80%",
      maxWidth: 180,
    },
    logo: theme.logo
  },
}));

const LoggedInLayout = ({ children, themeToggle }) => {
  const classes = useStyles();
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { handleLogout, loading } = useContext(AuthContext);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVariant, setDrawerVariant] = useState("permanent");
  // const [dueDate, setDueDate] = useState("");
  const { user } = useContext(AuthContext);

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
    if (document.body.offsetWidth > 1200) {
      setDrawerOpen(true);
    }
  }, []);

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
          <div className={clsx(classes.toolbarIcon, classes.drawerToolbar)}>
            <img src={logo} className={classes.logo} alt="logo" />
          </div>
          <Divider />
          <List className={classes.containerWithScroll}>
            <MainListItems drawerClose={drawerClose} collapsed={!drawerOpen} />
          </List>
          <Divider />
          {drawerOpen && (
            <div className={classes.drawerFooter}>
              <div className={classes.drawerFooterUser}>
                <Avatar style={{ width: 36, height: 36, backgroundColor: "#24c776" }}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : "?"}
                </Avatar>
                <Typography variant="body2" style={{ fontWeight: 600 }} noWrap>
                  {user?.name || "-"}
                </Typography>
              </div>
              <Typography className={classes.drawerFooterRole}>
                {user?.profile === "admin" ? "Administrador" : user?.profile === "user" ? "Usuário" : user?.profile || "-"}
              </Typography>
              <div>
                <span className={classes.versionBadge}>Sistema {versionSystem}</span>
                <span className={classes.versionBadge}>API 2.2.6</span>
              </div>
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
            onClick={() => setDrawerOpen(!drawerOpen)}
            className={classes.menuButton}
            style={{ color: "rgba(0, 0, 0, 0.54)" }}
          >
            <MenuIcon />
          </IconButton>

          <Typography component="div" className={classes.title} style={{ flex: 1 }}/>

          <LanguageControl />

          <IconButton onClick={toggleColorMode} style={{ color: "rgba(0, 0, 0, 0.54)" }}>
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
            <Typography variant="body2" style={{ fontSize: 12, color: "rgba(0,0,0,0.6)" }}>
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
              style={{ color: "rgba(0, 0, 0, 0.54)" }}
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
      <main className={classes.content}>
        <div className={classes.appBarSpacer} />

        {children ? children : null}
      </main>
    </div>
  );
};

export default LoggedInLayout;
