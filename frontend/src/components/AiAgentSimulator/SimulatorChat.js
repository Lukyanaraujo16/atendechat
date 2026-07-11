import React, { useRef, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import CircularProgress from "@material-ui/core/CircularProgress";
import SimulatorMessage from "./SimulatorMessage";
import SimulatorEmptyState from "./SimulatorEmptyState";

const useStyles = makeStyles((theme) => ({
  root: {
    flex: 1,
    overflowY: "auto",
    padding: theme.spacing(2),
    minHeight: 280,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.02)"
        : "rgba(0,0,0,0.02)",
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
  },
  loading: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(2),
  },
}));

export default function SimulatorChat({
  messages,
  loading,
  onCopy,
  onReview,
  onRepeat,
}) {
  const classes = useStyles();
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  return (
    <Box className={classes.root}>
      {!messages.length && !loading ? <SimulatorEmptyState /> : null}
      {messages.map((message) => (
        <SimulatorMessage
          key={message.id || `${message.role}-${message.createdAt}`}
          message={message}
          onCopy={onCopy}
          onReview={onReview}
          onRepeat={onRepeat}
        />
      ))}
      {loading ? (
        <div className={classes.loading}>
          <CircularProgress size={24} />
        </div>
      ) : null}
      <div ref={bottomRef} />
    </Box>
  );
}
