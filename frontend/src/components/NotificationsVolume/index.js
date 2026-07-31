import React, { useState, useRef, useEffect, useCallback } from "react";

import Popover from "@material-ui/core/Popover";
import IconButton from "@material-ui/core/IconButton";
import List from "@material-ui/core/List";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import { makeStyles } from "@material-ui/core/styles";
import VolumeUpIcon from "@material-ui/icons/VolumeUp";
import VolumeDownIcon from "@material-ui/icons/VolumeDown";
import VolumeOffIcon from "@material-ui/icons/VolumeOff";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";

import { Grid, Slider } from "@material-ui/core";
import { toast } from "react-toastify";

import { useNotificationSound } from "../../context/NotificationSound/NotificationSoundContext";
import { playNotificationSoundThrottled } from "../../utils/notificationSoundPlayback";
import {
  getDesktopNotificationPermission,
  isDesktopNotificationSupported,
  persistDesktopNotificationPrefEnabled,
  readDesktopNotificationPrefEnabled,
  requestDesktopNotificationPermission,
} from "../../utils/browserDesktopNotification";
import { i18n } from "../../translate/i18n";

const SLIDER_DEBOUNCE_MS = 150;

const useStyles = makeStyles((theme) => ({
  controlRoot: {
    display: "inline-flex",
    alignItems: "center",
    verticalAlign: "middle",
  },
  tabContainer: {
    padding: theme.spacing(2),
    minWidth: 260,
  },
  popoverPaper: {
    width: "100%",
    maxWidth: 350,
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(1),
    [theme.breakpoints.down("sm")]: {
      maxWidth: 270,
    },
  },
  icons: {
    color: "#fff",
  },
  expandBtn: {
    color: "#fff",
    padding: 4,
    marginLeft: -4,
  },
  testBtn: {
    marginTop: theme.spacing(1.5),
  },
  openConversationRow: {
    marginTop: theme.spacing(1),
    marginLeft: 0,
    alignItems: "flex-start",
  },
  openConversationHint: {
    display: "block",
    marginTop: theme.spacing(0.5),
    paddingLeft: theme.spacing(5),
  },
  sectionTitle: {
    marginTop: theme.spacing(2),
    display: "block",
  },
  warnText: {
    marginTop: theme.spacing(1),
    display: "block",
  },
}));

const NotificationsVolume = () => {
  const classes = useStyles();
  const {
    volume,
    muted,
    setVolume,
    setMuted,
    openConversationEnabled,
    setOpenConversationEnabled,
    playNotificationSound,
    audioBlocked,
  } = useNotificationSound();

  const anchorEl = useRef();
  const volumeDebounceRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [sliderValue, setSliderValue] = useState(() =>
    muted || volume === 0 ? 0 : volume
  );
  const [desktopPermission, setDesktopPermission] = useState(() =>
    getDesktopNotificationPermission()
  );
  const [desktopPrefEnabled, setDesktopPrefEnabled] = useState(() =>
    readDesktopNotificationPrefEnabled()
  );
  const isSilent = muted || volume === 0;

  const playThrottled = useCallback(
    (soundType) =>
      playNotificationSoundThrottled(playNotificationSound, soundType),
    [playNotificationSound]
  );

  useEffect(() => {
    setSliderValue(isSilent ? 0 : volume);
  }, [volume, isSilent]);

  useEffect(
    () => () => {
      if (volumeDebounceRef.current) {
        clearTimeout(volumeDebounceRef.current);
      }
    },
    []
  );

  const handleOpenPopover = (event) => {
    event.stopPropagation();
    setDesktopPermission(getDesktopNotificationPermission());
    setIsOpen(true);
  };

  const handleClosePopover = () => {
    setIsOpen(false);
  };

  const unmuteNotifications = useCallback(() => {
    if (volume === 0) {
      setVolume(0.5);
    } else {
      setMuted(false);
    }
    toast.success(i18n.t("notificationSound.toastUnmuted"));
    playThrottled("default");
  }, [volume, setVolume, setMuted, playThrottled]);

  const muteNotifications = useCallback(() => {
    setMuted(true);
    toast.success(i18n.t("notificationSound.toastMuted"));
  }, [setMuted]);

  const handleIconMuteToggle = (event) => {
    event.stopPropagation();
    if (isSilent) {
      unmuteNotifications();
    } else {
      muteNotifications();
    }
  };

  const applyVolume = useCallback(
    (value) => {
      setVolume(value);
    },
    [setVolume]
  );

  const handleVolumeChange = (_, value) => {
    setSliderValue(value);
    if (volumeDebounceRef.current) {
      clearTimeout(volumeDebounceRef.current);
    }
    volumeDebounceRef.current = setTimeout(() => {
      applyVolume(value);
    }, SLIDER_DEBOUNCE_MS);
  };

  const handleVolumeCommitted = (_, value) => {
    if (volumeDebounceRef.current) {
      clearTimeout(volumeDebounceRef.current);
      volumeDebounceRef.current = null;
    }
    setSliderValue(value);
    applyVolume(value);
    if (Number(value) > 0) {
      playThrottled("default");
    }
  };

  const handleToggleMuteInPopover = () => {
    if (isSilent) {
      unmuteNotifications();
    } else {
      muteNotifications();
    }
  };

  const handleTestSound = () => {
    playThrottled("default");
  };

  const handleOpenConversationChange = (event) => {
    setOpenConversationEnabled(event.target.checked);
  };

  const handleEnableDesktop = async () => {
    const result = await requestDesktopNotificationPermission();
    setDesktopPermission(result);
    if (result === "granted") {
      persistDesktopNotificationPrefEnabled(true);
      setDesktopPrefEnabled(true);
      toast.success(i18n.t("notificationSound.desktopToastGranted"));
    } else if (result === "denied") {
      toast.error(i18n.t("notificationSound.desktopToastDenied"));
    }
  };

  const handleDesktopPrefToggle = (event) => {
    const next = event.target.checked;
    setDesktopPrefEnabled(next);
    persistDesktopNotificationPrefEnabled(next);
  };

  const desktopSupported = isDesktopNotificationSupported();

  return (
    <div className={classes.controlRoot} ref={anchorEl}>
      <IconButton
        className={classes.icons}
        onClick={handleIconMuteToggle}
        aria-label={
          isSilent
            ? i18n.t("notificationSound.unmute")
            : i18n.t("notificationSound.mute")
        }
      >
        {isSilent ? (
          <VolumeOffIcon color="inherit" />
        ) : (
          <VolumeUpIcon color="inherit" />
        )}
      </IconButton>
      <IconButton
        className={classes.expandBtn}
        size="small"
        onClick={handleOpenPopover}
        aria-label={i18n.t("notificationSound.openSettings")}
        aria-expanded={isOpen}
      >
        <ExpandMoreIcon fontSize="small" color="inherit" />
      </IconButton>
      <Popover
        disableScrollLock
        open={isOpen}
        anchorEl={anchorEl.current}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        classes={{ paper: classes.popoverPaper }}
        onClose={handleClosePopover}
      >
        <List dense className={classes.tabContainer}>
          <Typography variant="caption" color="textSecondary" gutterBottom>
            {i18n.t("notificationSound.popoverTitle")}
          </Typography>
          <Button
            size="small"
            startIcon={isSilent ? <VolumeUpIcon /> : <VolumeOffIcon />}
            onClick={handleToggleMuteInPopover}
            style={{ marginBottom: 8 }}
          >
            {isSilent
              ? i18n.t("notificationSound.unmute")
              : i18n.t("notificationSound.mute")}
          </Button>
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <VolumeDownIcon />
            </Grid>
            <Grid item xs>
              <Slider
                value={sliderValue}
                aria-labelledby="notification-volume-slider"
                step={0.05}
                min={0}
                max={1}
                onChange={handleVolumeChange}
                onChangeCommitted={handleVolumeCommitted}
              />
            </Grid>
            <Grid item>
              <VolumeUpIcon />
            </Grid>
          </Grid>
          <FormControlLabel
            className={classes.openConversationRow}
            control={
              <Switch
                color="primary"
                size="small"
                checked={openConversationEnabled}
                onChange={handleOpenConversationChange}
                disabled={isSilent}
              />
            }
            label={
              <Typography variant="body2">
                {i18n.t("notificationSound.openConversation")}
              </Typography>
            }
          />
          <Typography
            variant="caption"
            color="textSecondary"
            className={classes.openConversationHint}
          >
            {i18n.t("notificationSound.openConversationHint")}
          </Typography>
          <Button
            size="small"
            color="primary"
            variant="outlined"
            fullWidth
            className={classes.testBtn}
            onClick={handleTestSound}
            disabled={isSilent}
          >
            {i18n.t("notificationSound.testSound")}
          </Button>
          {audioBlocked ? (
            <Typography
              variant="caption"
              color="error"
              className={classes.warnText}
            >
              {i18n.t("notificationSound.audioBlocked")}
            </Typography>
          ) : null}

          <Typography
            variant="caption"
            color="textSecondary"
            className={classes.sectionTitle}
          >
            {i18n.t("notificationSound.desktopNotifications")}
          </Typography>
          <Typography variant="caption" color="textSecondary" display="block">
            {i18n.t("notificationSound.desktopNotificationsHint")}
          </Typography>
          {!desktopSupported ? (
            <Typography variant="caption" color="textSecondary" display="block">
              {i18n.t("notificationSound.desktopUnsupported")}
            </Typography>
          ) : desktopPermission === "denied" ? (
            <Typography
              variant="caption"
              color="error"
              className={classes.warnText}
            >
              {i18n.t("notificationSound.desktopDenied")}
            </Typography>
          ) : desktopPermission === "granted" ? (
            <>
              <Typography variant="body2" className={classes.warnText}>
                {i18n.t("notificationSound.desktopEnabled")}
              </Typography>
              <FormControlLabel
                className={classes.openConversationRow}
                control={
                  <Switch
                    color="primary"
                    size="small"
                    checked={desktopPrefEnabled}
                    onChange={handleDesktopPrefToggle}
                  />
                }
                label={
                  <Typography variant="body2">
                    {i18n.t("notificationSound.desktopToggle")}
                  </Typography>
                }
              />
            </>
          ) : (
            <Button
              size="small"
              color="primary"
              variant="contained"
              fullWidth
              className={classes.testBtn}
              onClick={handleEnableDesktop}
            >
              {i18n.t("notificationSound.desktopEnable")}
            </Button>
          )}
        </List>
      </Popover>
    </div>
  );
};

export default NotificationsVolume;
