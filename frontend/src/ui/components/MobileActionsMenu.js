import React, { useState } from "react";
import IconButton from "@material-ui/core/IconButton";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import Divider from "@material-ui/core/Divider";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  danger: {
    color: theme.palette.error.main,
  },
}));

/**
 * Menu de ações (⋮) para listas em cards no mobile.
 * items: { key, label, icon?, onClick, hidden?, disabled?, danger?, divider? }
 */
export default function MobileActionsMenu({ items = [], ariaLabel = "Ações" }) {
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const visibleItems = items.filter((item) => item && !item.hidden);

  const handleOpen = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const handleItemClick = (item) => {
    handleClose();
    if (typeof item.onClick === "function") {
      item.onClick();
    }
  };

  if (!visibleItems.length) return null;

  return (
    <>
      <IconButton
        size="small"
        onClick={handleOpen}
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        keepMounted
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {visibleItems.map((item, index) => {
          if (item.divider) {
            return <Divider key={`divider-${index}`} />;
          }
          return (
            <MenuItem
              key={item.key || `action-${index}`}
              onClick={() => handleItemClick(item)}
              disabled={item.disabled}
              className={item.danger ? classes.danger : undefined}
            >
              {item.icon ? (
                <ListItemIcon className={item.danger ? classes.danger : undefined}>
                  {item.icon}
                </ListItemIcon>
              ) : null}
              <ListItemText primary={item.label} />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
