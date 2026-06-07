import React from "react";
import IconButton from "@material-ui/core/IconButton";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import Popover from "@material-ui/core/Popover";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import AddIcon from "@material-ui/icons/Add";
import CloseIcon from "@material-ui/icons/Close";
import InsertDriveFileOutlinedIcon from "@material-ui/icons/InsertDriveFileOutlined";
import PhotoLibraryOutlinedIcon from "@material-ui/icons/PhotoLibraryOutlined";
import MicNoneOutlinedIcon from "@material-ui/icons/MicNoneOutlined";
import FlashOnOutlinedIcon from "@material-ui/icons/FlashOnOutlined";
import ImageOutlinedIcon from "@material-ui/icons/ImageOutlined";

import { i18n } from "../../translate/i18n";
import useIsMobile from "../../hooks/useIsMobile";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
} from "../../ui";

const useStyles = makeStyles((theme) => ({
  attachButton: {
    flexShrink: 0,
    color: theme.palette.text.secondary,
    [theme.breakpoints.down("md")]: {
      minWidth: 44,
      minHeight: 44,
    },
  },
  attachButtonOpen: {
    transform: "rotate(45deg)",
    transition: theme.transitions.create("transform", { duration: 180 }),
  },
  attachButtonClosed: {
    transform: "rotate(0deg)",
    transition: theme.transitions.create("transform", { duration: 180 }),
  },
  menuList: {
    minWidth: 240,
    paddingTop: theme.spacing(0.5),
    paddingBottom: theme.spacing(0.5),
  },
  menuItem: {
    borderRadius: theme.shape.borderRadius,
    marginLeft: theme.spacing(0.5),
    marginRight: theme.spacing(0.5),
  },
  stickerSecondary: {
    display: "block",
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  mobileList: {
    padding: 0,
  },
  mobileListItem: {
    paddingTop: theme.spacing(1.5),
    paddingBottom: theme.spacing(1.5),
  },
}));

/**
 * Menu de anexos do composer (estilo WhatsApp).
 * Fase 2: figurinhas salvas / envio real via Baileys — hoje só upload WebP.
 */
export default function ComposerAttachMenu({
  disabled,
  quickRepliesEnabled,
  onPickDocument,
  onPickMedia,
  onPickSticker,
  onStartRecording,
  onOpenQuickReplies,
}) {
  const classes = useStyles();
  const isMobile = useIsMobile();
  const anchorRef = React.useRef(null);
  const [open, setOpen] = React.useState(false);

  const handleClose = () => setOpen(false);

  const handleToggle = () => {
    if (disabled) return;
    setOpen((prev) => !prev);
  };

  const runAction = (action) => {
    handleClose();
    if (typeof action === "function") {
      action();
    }
  };

  const items = [
    {
      key: "document",
      icon: <InsertDriveFileOutlinedIcon />,
      primary: i18n.t("messagesInput.attach.document"),
      onClick: onPickDocument,
    },
    {
      key: "media",
      icon: <PhotoLibraryOutlinedIcon />,
      primary: i18n.t("messagesInput.attach.photosVideos"),
      onClick: onPickMedia,
    },
    {
      key: "audio",
      icon: <MicNoneOutlinedIcon />,
      primary: i18n.t("messagesInput.attach.audio"),
      onClick: onStartRecording,
    },
    quickRepliesEnabled && {
      key: "quickReply",
      icon: <FlashOnOutlinedIcon />,
      primary: i18n.t("messagesInput.attach.quickReply"),
      onClick: onOpenQuickReplies,
    },
    {
      key: "sticker",
      icon: <ImageOutlinedIcon />,
      primary: i18n.t("messagesInput.attach.sticker"),
      secondary: i18n.t("messagesInput.attach.stickerHint"),
      dataStickerPhase: "upload-webp",
      onClick: onPickSticker,
    },
  ].filter(Boolean);

  const renderList = (dense = false) => (
    <List className={dense ? classes.mobileList : classes.menuList} disablePadding={dense}>
      {items.map((item) => (
        <ListItem
          key={item.key}
          button
          disabled={disabled}
          className={dense ? classes.mobileListItem : classes.menuItem}
          data-composer-attach={item.key}
          data-composer-sticker-phase={item.dataStickerPhase}
          onClick={() => runAction(item.onClick)}
        >
          <ListItemIcon>{item.icon}</ListItemIcon>
          <ListItemText
            primary={item.primary}
            secondary={
              item.secondary ? (
                <Typography
                  component="span"
                  variant="caption"
                  className={classes.stickerSecondary}
                >
                  {item.secondary}
                </Typography>
              ) : null
            }
          />
        </ListItem>
      ))}
    </List>
  );

  return (
    <>
      <IconButton
        ref={anchorRef}
        aria-label={i18n.t("messagesInput.attach.menuTitle")}
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled}
        className={`${classes.attachButton} ${
          open ? classes.attachButtonOpen : classes.attachButtonClosed
        }`}
        onClick={handleToggle}
      >
        {open && isMobile ? <CloseIcon /> : <AddIcon />}
      </IconButton>

      {isMobile ? (
        <AppDialog
          open={open}
          onClose={handleClose}
          fullWidth
          maxWidth="xs"
        >
          <AppDialogTitle>{i18n.t("messagesInput.attach.menuTitle")}</AppDialogTitle>
          <AppDialogContent dividers={false}>{renderList(true)}</AppDialogContent>
        </AppDialog>
      ) : (
        <Popover
          open={open}
          anchorEl={anchorRef.current}
          onClose={handleClose}
          anchorOrigin={{ vertical: "top", horizontal: "left" }}
          transformOrigin={{ vertical: "bottom", horizontal: "left" }}
          PaperProps={{ elevation: 8 }}
        >
          {renderList(false)}
        </Popover>
      )}
    </>
  );
}
