import React from "react";
import Drawer from "@material-ui/core/Drawer";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import { makeStyles, alpha } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  paper: (props) => ({
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: props.maxHeight || "50vh",
    height: "auto",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    paddingBottom: `env(safe-area-inset-bottom, 0px)`,
  }),
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: alpha(theme.palette.text.primary, 0.2),
    margin: theme.spacing(1.25, "auto", 0.5),
    flexShrink: 0,
  },
  title: {
    padding: theme.spacing(0.5, 2, 1),
    fontWeight: 600,
    fontSize: "0.9375rem",
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
    WebkitOverflowScrolling: "touch",
  },
}));

/**
 * Bottom sheet contextual do composer (estilo WhatsApp).
 */
export default function ComposerBottomSheet({
  open,
  onClose,
  title,
  maxHeight = "50vh",
  children,
  contentClassName,
}) {
  const classes = useStyles({ maxHeight });

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{ className: classes.paper, elevation: 16 }}
    >
      <Box className={classes.handle} aria-hidden />
      {title ? (
        <Typography component="div" className={classes.title}>
          {title}
        </Typography>
      ) : null}
      <Box className={`${classes.content} ${contentClassName || ""}`.trim()}>
        {children}
      </Box>
    </Drawer>
  );
}
