import React, { useEffect, useState } from 'react';
import { changeLanguage } from "../../translate/i18n";
import { Button, Menu, MenuItem } from '@material-ui/core';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import api from "../../services/api";

const LANGUAGES = [
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

const LanguageControl = () => {
  const [selectedLanguage, setSelectedLanguage] = useState('pt');
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const currentLang = LANGUAGES.find(l => l.code === selectedLanguage) || LANGUAGES[0];

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
    const saved = localStorage.getItem('i18nextLng');
    if (saved && LANGUAGES.some(l => l.code === saved)) {
      setSelectedLanguage(saved);
    } else if (saved) {
      const normalized = saved.split('-')[0];
      if (LANGUAGES.some(l => l.code === normalized)) {
        setSelectedLanguage(normalized);
      }
    }
  }, []);

  return (
    <>
      <Button
        aria-controls={open ? 'language-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleOpen}
        variant="outlined"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid rgba(0, 0, 0, 0.23)',
          borderRadius: 6,
          color: 'rgba(0, 0, 0, 0.87)',
          textTransform: 'none',
          padding: '6px 12px',
          minWidth: 140,
        }}
      >
        <span style={{ marginRight: 8, fontSize: 18 }}>{currentLang.flag}</span>
        <span style={{ flex: 1, textAlign: 'left' }}>{currentLang.label}</span>
        {open ? (
          <ExpandLessIcon style={{ fontSize: 20, color: 'rgba(0, 0, 0, 0.54)' }} />
        ) : (
          <ExpandMoreIcon style={{ fontSize: 20, color: 'rgba(0, 0, 0, 0.54)' }} />
        )}
      </Button>
      <Menu
        id="language-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        getContentAnchorEl={null}
        PaperProps={{
          style: {
            marginTop: 4,
            minWidth: 140,
            boxShadow: '0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)',
            borderRadius: 6,
          },
        }}
        MenuListProps={{
          style: { padding: '4px 0' },
        }}
      >
        {LANGUAGES.map((lang) => (
          <MenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            style={{
              padding: '8px 16px',
              backgroundColor: selectedLanguage === lang.code ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
            }}
          >
            <span style={{ marginRight: 10, fontSize: 18 }}>{lang.flag}</span>
            {lang.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default LanguageControl;
