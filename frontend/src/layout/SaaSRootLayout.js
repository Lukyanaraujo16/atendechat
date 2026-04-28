import React, { useContext, useState } from "react";
import { Button } from "@material-ui/core";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import Box from "@material-ui/core/Box";
import Alert from "@material-ui/lab/Alert";
import AccountCircle from "@material-ui/icons/AccountCircle";
import Brightness4Icon from "@material-ui/icons/Brightness4";
import Brightness7Icon from "@material-ui/icons/Brightness7";
import { makeStyles, useTheme } from "@material-ui/core/styles";

import { AuthContext } from "../context/Auth/AuthContext";
import ColorModeContext from "./themeContext";
import LanguageControl from "../components/LanguageControl";
import UserModal from "../components/UserModal";
import { useBranding } from "../context/Branding/BrandingContext";
import { i18n } from "../translate/i18n";
import { APP_HEADER_HEIGHT } from "./layoutConstants";

const useStyles = makeStyles((theme) => ({
  shell: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
    backgroundColor: theme.palette.background.default,
  },
  appBar: {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    borderBottom: `1px solid ${theme.palette.divider}`,
    boxShadow: "none",
    flexShrink: 0,
  },
  iconButton: {
    color: theme.palette.action.active,
  },
  toolbar: {
    minHeight: APP_HEADER_HEIGHT,
    height: APP_HEADER_HEIGHT,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
  },
  logo: {
    maxHeight: 32,
    maxWidth: 150,
    width: "auto",
    height: "auto",
    objectFit: "contain",
    flexShrink: 0,
    marginRight: theme.spacing(1.5),
  },
  title: {
    flex: 1,
    fontWeight: 600,
    fontSize: "1rem",
  },
  body: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  alertWrap: {
    flexShrink: 0,
    padding: theme.spacing(0, 2),
    paddingTop: theme.spacing(1.5),
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
}));

/**
 * Layout raiz do módulo SaaS: sem drawer do produto.
 * AppBar mínima (idioma, tema, conta) + área para SaaSModuleLayout.
 */
export default function SaaSRootLayout({ children }) {
  const classes = useStyles();
  const theme = useTheme();
  const { colorMode } = useContext(ColorModeContext);
  const { handleLogout, user, exitSupportMode } = useContext(AuthContext);
  const { resolveMenuLogo } = useBranding();
  const menuLogoSrc = resolveMenuLogo();

  const [anchorEl, setAnchorEl] = useState(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const menuOpen = Boolean(anchorEl);

  const toggleColorMode = () => colorMode.toggleColorMode();

  return (
    <Box className={classes.shell}>
      <AppBar position="static" className={classes.appBar} elevation={0}>
        <Toolbar variant="dense" className={classes.toolbar}>
          <img
            src={menuLogoSrc}
            className={classes.logo}
            alt=""
          />
          <Typography component="h1" className={classes.title} noWrap>
            {i18n.t("saas.shell.moduleTitle")}
          </Typography>
          <LanguageControl />
          <IconButton onClick={toggleColorMode} className={classes.iconButton}>
            {theme.mode === "dark" ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
          <IconButton
            aria-label="conta"
            onClick={(e) => setAnchorEl(e.currentTarget)}
            className={classes.iconButton}
          >
            <AccountCircle />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            getContentAnchorEl={null}
          >
            <MenuItem
              onClick={() => {
                setAnchorEl(null);
                setUserModalOpen(true);
              }}
            >
              {i18n.t("mainDrawer.appBar.user.profile")}
            </MenuItem>
            <MenuItem
              onClick={() => {
                setAnchorEl(null);
                handleLogout();
              }}
            >
              {i18n.t("mainDrawer.appBar.user.logout")}
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {user?.supportMode && user?.company?.name ? (
        <Box className={classes.alertWrap}>
          <Alert severity="info" variant="filled" icon={false}>
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
        </Box>
      ) : null}

      {user?.finance?.delinquent ? (
        <Box className={classes.alertWrap}>
          <Alert severity="warning" variant="outlined" style={{ alignItems: "center" }}>
            {i18n.t("finance.banner.message")}
          </Alert>
        </Box>
      ) : null}

      <Box className={classes.body}>{children}</Box>

      <UserModal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        userId={user?.id}
      />
    </Box>
  );
}
