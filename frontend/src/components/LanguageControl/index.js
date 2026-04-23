import React, { useEffect, useState } from "react";
import { changeLanguage } from "../../translate/i18n";
import { Button, Menu, MenuItem } from "@material-ui/core";
import ExpandLessIcon from "@material-ui/icons/ExpandLess";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import { makeStyles } from "@material-ui/core/styles";
import api from "../../services/api";

const LANGUAGES = [
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
];

const useStyles = makeStyles((theme) => ({
  langButton: {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 6,
    color: theme.palette.text.primary,
    textTransform: "none",
    padding: "6px 12px",
    minWidth: 140,
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  expandIcon: {
    fontSize: 20,
    color: theme.palette.action.active,
  },
  flag: {
    marginRight: 8,
    fontSize: 18,
  },
  flagMenu: {
    marginRight: 10,
    fontSize: 18,
  },
  menuPaper: {
    marginTop: 4,
    minWidth: 140,
    borderRadius: 6,
  },
  menuList: {
    padding: "4px 0",
  },
  menuItem: {
    padding: "8px 16px",
  },
  menuItemSelected: {
    backgroundColor: `${theme.palette.action.selected} !important`,
  },
}));

const LanguageControl = () => {
  const classes = useStyles();
  const [selectedLanguage, setSelectedLanguage] = useState("pt");
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const currentLang = LANGUAGES.find((l) => l.code === selectedLanguage) || LANGUAGES[0];

  const handleOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLanguageChange = async (code) => {
    setSelectedLanguage(code);
    changeLanguage(code);
    handleClose();

    try {
      await api.post(`/users/set-language/${code}`);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("i18nextLng");
    if (saved && LANGUAGES.some((l) => l.code === saved)) {
      setSelectedLanguage(saved);
    } else if (saved) {
      const normalized = saved.split("-")[0];
      if (LANGUAGES.some((l) => l.code === normalized)) {
        setSelectedLanguage(normalized);
      }
    }
  }, []);

  return (
    <>
      <Button
        aria-controls={open ? "language-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleOpen}
        variant="outlined"
        className={classes.langButton}
      >
        <span className={classes.flag}>{currentLang.flag}</span>
        <span style={{ flex: 1, textAlign: "left" }}>{currentLang.label}</span>
        {open ? (
          <ExpandLessIcon className={classes.expandIcon} />
        ) : (
          <ExpandMoreIcon className={classes.expandIcon} />
        )}
      </Button>
      <Menu
        id="language-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        getContentAnchorEl={null}
        PaperProps={{
          className: classes.menuPaper,
        }}
        MenuListProps={{
          className: classes.menuList,
        }}
      >
        {LANGUAGES.map((lang) => (
          <MenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`${classes.menuItem} ${
              selectedLanguage === lang.code ? classes.menuItemSelected : ""
            }`}
          >
            <span className={classes.flagMenu}>{lang.flag}</span>
            {lang.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default LanguageControl;
