import React from "react";
import clsx from "clsx";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import useIsMobile from "../../hooks/useIsMobile";

export const useAppDialogStyles = makeStyles((theme) => ({
  titleHeading: {
    fontWeight: 600,
    fontSize: "1.125rem",
    lineHeight: 1.35,
    color: theme.palette.text.primary,
  },
  subtitle: {
    display: "block",
    marginTop: theme.spacing(0.75),
    fontSize: "0.8125rem",
    lineHeight: 1.45,
    color: theme.palette.text.secondary,
    fontWeight: 400,
  },
}));

const useResponsiveDialogStyles = makeStyles((theme) => ({
  paperFullscreen: {
    display: "flex",
    flexDirection: "column",
    margin: 0,
    width: "100%",
    maxWidth: "100%",
    maxHeight: "100dvh",
    height: "100dvh",
    borderRadius: 0,
    "@supports not (height: 100dvh)": {
      maxHeight: "100vh",
      height: "100vh",
    },
  },
  contentFullscreen: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    WebkitOverflowScrolling: "touch",
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    paddingTop: theme.spacing(1.5),
    paddingBottom: theme.spacing(2),
  },
  actionsSticky: {
    flexShrink: 0,
    margin: 0,
    borderTop: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1.5, 2),
    paddingBottom: `calc(${theme.spacing(2)}px + env(safe-area-inset-bottom, 0px))`,
    backgroundColor: theme.palette.background.paper,
    "& > *": {
      marginLeft: theme.spacing(1),
    },
  },
}));

function mergePaperClasses(...parts) {
  return parts.filter(Boolean).join(" ").trim();
}

export function AppDialog({
  children,
  paperClassName,
  maxWidth = "sm",
  fullWidth = true,
  scroll = "paper",
  fullScreen: fullScreenProp,
  classes: dialogClassesProp,
  ...rest
}) {
  const isMobile = useIsMobile();
  const responsiveClasses = useResponsiveDialogStyles();
  const fullScreen =
    fullScreenProp !== undefined ? fullScreenProp : isMobile;

  const paper = mergePaperClasses(
    paperClassName,
    fullScreen && responsiveClasses.paperFullscreen,
    dialogClassesProp && dialogClassesProp.paper
  );

  return (
    <Dialog
      fullScreen={fullScreen}
      maxWidth={fullScreen ? false : maxWidth}
      fullWidth={fullWidth}
      scroll={scroll}
      classes={{ ...dialogClassesProp, ...(paper ? { paper } : {}) }}
      {...rest}
    >
      {children}
    </Dialog>
  );
}

export function AppDialogTitle({
  children,
  subtitle,
  disableTypography,
  className,
  ...rest
}) {
  const classes = useAppDialogStyles();
  if (disableTypography) {
    return (
      <DialogTitle className={className} {...rest}>
        {children}
      </DialogTitle>
    );
  }
  return (
    <DialogTitle disableTypography className={className} {...rest}>
      <Typography component="h2" variant="h6" className={classes.titleHeading}>
        {children}
      </Typography>
      {subtitle != null && subtitle !== "" && (
        typeof subtitle === "string" ? (
          <Typography component="span" variant="body2" className={classes.subtitle}>
            {subtitle}
          </Typography>
        ) : (
          subtitle
        )
      )}
    </DialogTitle>
  );
}

export function AppDialogContent({
  className,
  dividers = true,
  fullscreenContent,
  ...rest
}) {
  const isMobile = useIsMobile();
  const responsiveClasses = useResponsiveDialogStyles();
  const useFullscreenContent =
    fullscreenContent !== undefined ? fullscreenContent : isMobile;

  return (
    <DialogContent
      dividers={dividers && !useFullscreenContent}
      className={clsx(
        className,
        useFullscreenContent && responsiveClasses.contentFullscreen
      )}
      {...rest}
    />
  );
}

export function AppDialogActions({
  className,
  stickyFooter,
  ...rest
}) {
  const isMobile = useIsMobile();
  const responsiveClasses = useResponsiveDialogStyles();
  const sticky = stickyFooter !== undefined ? stickyFooter : isMobile;

  return (
    <DialogActions
      className={clsx(className, sticky && responsiveClasses.actionsSticky)}
      {...rest}
    />
  );
}
