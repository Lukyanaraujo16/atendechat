import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import TextField from "@material-ui/core/TextField";
import IconButton from "@material-ui/core/IconButton";
import SendIcon from "@material-ui/icons/Send";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    gap: theme.spacing(1),
    alignItems: "flex-end",
    marginTop: theme.spacing(2),
    paddingBottom: theme.spacing(1),
  },
  input: {
    flex: 1,
  },
}));

export default function SimulatorComposer({
  value,
  onChange,
  onSend,
  disabled,
}) {
  const classes = useStyles();

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!disabled && value.trim()) onSend();
    }
  };

  return (
    <div className={classes.root}>
      <TextField
        className={classes.input}
        multiline
        minRows={1}
        maxRows={6}
        variant="outlined"
        size="small"
        placeholder={i18n.t("aiAgent.simulator.composer.placeholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <IconButton color="primary" onClick={onSend} disabled={disabled || !value.trim()}>
        <SendIcon />
      </IconButton>
    </div>
  );
}
