import React, { useState, useEffect, useCallback } from "react";
import { Picker } from "emoji-mart";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Box from "@material-ui/core/Box";
import IconButton from "@material-ui/core/IconButton";
import CircularProgress from "@material-ui/core/CircularProgress";
import Typography from "@material-ui/core/Typography";
import ClickAwayListener from "@material-ui/core/ClickAwayListener";
import AddIcon from "@material-ui/icons/Add";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import { makeStyles } from "@material-ui/core/styles";
import clsx from "clsx";

import { i18n } from "../../translate/i18n";
import useIsMobile from "../../hooks/useIsMobile";
import useStickers, { stickerPreviewUrl } from "../../hooks/useStickers";
import ComposerBottomSheet from "./ComposerBottomSheet";
import StickerUploadDialog from "./StickerUploadDialog";

const useStyles = makeStyles((theme) => ({
  desktopPanel: {
    position: "absolute",
    bottom: "calc(100% + 8px)",
    left: 0,
    zIndex: 1300,
    width: "min(100vw - 24px, 360px)",
    maxHeight: "min(60vh, 420px)",
    display: "flex",
    flexDirection: "column",
    backgroundColor: theme.palette.background.paper,
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.shadows[8],
    overflow: "hidden",
  },
  tabs: {
    minHeight: 40,
    borderBottom: `1px solid ${theme.palette.divider}`,
    flexShrink: 0,
  },
  tab: {
    minHeight: 40,
    textTransform: "none",
    fontSize: "0.8125rem",
    fontWeight: 500,
  },
  panelBody: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  emojiWrap: {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
    "& .emoji-mart": {
      border: "none",
      width: "100% !important",
    },
  },
  stickerToolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(0.75, 1),
    borderBottom: `1px solid ${theme.palette.divider}`,
    flexShrink: 0,
  },
  stickerGrid: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    WebkitOverflowScrolling: "touch",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    alignContent: "start",
  },
  stickerItem: {
    position: "relative",
    aspectRatio: "1",
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.action.hover,
    padding: theme.spacing(0.5),
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    "&:hover": {
      borderColor: theme.palette.primary.main,
    },
  },
  stickerImg: {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
  },
  stickerDelete: {
    position: "absolute",
    top: 2,
    right: 2,
    padding: 2,
    backgroundColor: theme.palette.background.paper,
    "&:hover": {
      backgroundColor: theme.palette.error.light,
      color: theme.palette.error.contrastText,
    },
  },
  emptyStickers: {
    gridColumn: "1 / -1",
    textAlign: "center",
    padding: theme.spacing(3, 1),
    color: theme.palette.text.secondary,
    fontSize: "0.875rem",
  },
  loadingWrap: {
    gridColumn: "1 / -1",
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(3),
  },
  mobileSheetContent: {
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    overflow: "hidden",
  },
}));

/**
 * Painel unificado Emoji + Figurinhas.
 */
export default function ComposerEmojiStickerPanel({
  open,
  onClose,
  initialTab = "emoji",
  onEmojiSelect,
  onStickerSend,
  canManageStickers,
  sendingStickerId,
}) {
  const classes = useStyles();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState(initialTab);
  const [uploadOpen, setUploadOpen] = useState(false);
  const {
    stickers,
    loading,
    uploadSticker,
    deleteSticker,
  } = useStickers();

  useEffect(() => {
    if (open) {
      setTab(initialTab);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handleStickerClick = useCallback(
    async (sticker) => {
      if (!sticker?.id || sendingStickerId) return;
      if (typeof onStickerSend === "function") {
        await onStickerSend(sticker);
      }
    },
    [onStickerSend, sendingStickerId]
  );

  const handleDelete = async (e, sticker) => {
    e.stopPropagation();
    if (!sticker?.id || !canManageStickers) return;
    if (!window.confirm(i18n.t("messagesInput.stickers.deleteConfirm"))) return;
    try {
      await deleteSticker(sticker.id);
    } catch {
      /* toast in hook */
    }
  };

  const panelTitle =
    tab === "stickers"
      ? i18n.t("messagesInput.stickers.tabStickers")
      : i18n.t("messagesInput.stickers.tabEmoji");

  const stickerTabContent = (
    <Box className={classes.panelBody} data-composer-sticker-phase="library">
      {canManageStickers ? (
        <Box className={classes.stickerToolbar}>
          <Typography variant="caption" color="textSecondary">
            {i18n.t("messagesInput.stickers.libraryTitle")}
          </Typography>
          <IconButton
            size="small"
            aria-label={i18n.t("messagesInput.stickers.add")}
            onClick={() => setUploadOpen(true)}
          >
            <AddIcon fontSize="small" />
          </IconButton>
        </Box>
      ) : null}
      <Box className={classes.stickerGrid}>
        {loading ? (
          <Box className={classes.loadingWrap}>
            <CircularProgress size={28} />
          </Box>
        ) : stickers.length === 0 ? (
          <Typography className={classes.emptyStickers}>
            {i18n.t("messagesInput.stickers.empty")}
          </Typography>
        ) : (
          stickers.map((sticker) => {
            const url = stickerPreviewUrl(sticker);
            const isSending = sendingStickerId === sticker.id;
            return (
              <Box
                key={sticker.id}
                className={clsx(classes.stickerItem, {
                  [classes.loadingWrap]: isSending,
                })}
                role="button"
                tabIndex={0}
                onClick={() => handleStickerClick(sticker)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleStickerClick(sticker);
                  }
                }}
              >
                {isSending ? (
                  <CircularProgress size={22} />
                ) : (
                  <img
                    src={url}
                    alt={sticker.name || "sticker"}
                    className={classes.stickerImg}
                    loading="lazy"
                  />
                )}
                {canManageStickers && !isSending ? (
                  <IconButton
                    size="small"
                    className={classes.stickerDelete}
                    aria-label={i18n.t("messagesInput.stickers.delete")}
                    onClick={(e) => handleDelete(e, sticker)}
                  >
                    <DeleteOutlineIcon style={{ fontSize: 14 }} />
                  </IconButton>
                ) : null}
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );

  const panelInner = (
    <>
      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        className={classes.tabs}
        indicatorColor="primary"
        textColor="primary"
        variant="fullWidth"
      >
        <Tab
          className={classes.tab}
          value="emoji"
          label={i18n.t("messagesInput.stickers.tabEmoji")}
        />
        <Tab
          className={classes.tab}
          value="stickers"
          label={i18n.t("messagesInput.stickers.tabStickers")}
        />
      </Tabs>
      {tab === "emoji" ? (
        <Box className={classes.emojiWrap}>
          <Picker
            perLine={isMobile ? 8 : 9}
            showPreview={false}
            showSkinTones={false}
            onSelect={(emoji) => {
              if (typeof onEmojiSelect === "function") {
                onEmojiSelect(emoji);
              }
            }}
          />
        </Box>
      ) : (
        stickerTabContent
      )}
    </>
  );

  return (
    <>
      {isMobile ? (
        <ComposerBottomSheet
          open={open}
          onClose={onClose}
          title={panelTitle}
          maxHeight="60vh"
          contentClassName={classes.mobileSheetContent}
        >
          {panelInner}
        </ComposerBottomSheet>
      ) : open ? (
        <ClickAwayListener onClickAway={onClose}>
          <Box className={classes.desktopPanel}>{panelInner}</Box>
        </ClickAwayListener>
      ) : null}

      <StickerUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUpload={uploadSticker}
      />
    </>
  );
}
