import React from "react";
import moment from "moment-timezone";
import { makeStyles } from "@material-ui/core/styles";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import TextField from "@material-ui/core/TextField";
import FormControl from "@material-ui/core/FormControl";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import FormLabel from "@material-ui/core/FormLabel";
import RadioGroup from "@material-ui/core/RadioGroup";
import Radio from "@material-ui/core/Radio";
import Switch from "@material-ui/core/Switch";
import Autocomplete from "@material-ui/lab/Autocomplete";
import Chip from "@material-ui/core/Chip";
import Button from "@material-ui/core/Button";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Divider from "@material-ui/core/Divider";
import IconButton from "@material-ui/core/IconButton";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import FileCopyOutlinedIcon from "@material-ui/icons/FileCopyOutlined";
import CheckIcon from "@material-ui/icons/Check";
import CloseIcon from "@material-ui/icons/Close";
import { i18n } from "../../translate/i18n";
import {
  formatEventWhen,
  visibilityLabelKey,
  participantStatusKey,
  GOOGLE_CALENDAR_PALETTE,
  normalizeHexColor,
} from "./agendaUtils";

const useStyles = makeStyles((theme) => ({
  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    paddingRight: theme.spacing(0.5),
  },
  detailBlock: {
    backgroundColor:
      theme.palette.type === "dark" ? theme.palette.background.default : theme.palette.grey[50],
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
  },
  detailLabel: {
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: theme.palette.text.secondary,
    fontWeight: 600,
    marginBottom: theme.spacing(0.25),
  },
  readOnlyHint: {
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.action.hover,
    marginBottom: theme.spacing(2),
  },
  participantRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    "&:last-child": { borderBottom: "none" },
  },
  colorRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.75),
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
    alignItems: "center",
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: `2px solid ${theme.palette.divider}`,
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
    transition: theme.transitions.create(["transform", "box-shadow"], {
      duration: theme.transitions.duration.short,
    }),
    "&:hover": {
      transform: "scale(1.06)",
      boxShadow: theme.shadows[2],
    },
  },
}));

const AgendaEventModal = ({
  open,
  onClose,
  editing,
  form,
  setForm,
  user,
  elevated,
  participantOptions,
  canEdit,
  isCreate,
  locale,
  timezone,
  onSave,
  onDeleteClick,
  onDuplicateClick,
  onRespond,
  responding,
}) => {
  const classes = useStyles();

  const myParticipant = !isCreate
    ? (editing?.participants || []).find((p) => Number(p.userId) === Number(user?.id))
    : null;
  const canRespond =
    !isCreate &&
    editing?.isCollective &&
    myParticipant &&
    myParticipant.status === "pending" &&
    Number(editing?.createdBy) !== Number(user?.id);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="body">
      <DialogTitle disableTypography>
        <Box className={classes.titleRow}>
          <Typography variant="h6" component="span">
            {isCreate ? i18n.t("agenda.form.create") : i18n.t("agenda.form.edit")}
          </Typography>
          {!isCreate && canEdit && (
            <>
              {typeof onDuplicateClick === "function" && (
                <IconButton
                  size="small"
                  onClick={onDuplicateClick}
                  aria-label="duplicate"
                  title={i18n.t("agenda.duplicate.action")}
                >
                  <FileCopyOutlinedIcon />
                </IconButton>
              )}
              <IconButton
                size="small"
                onClick={onDeleteClick}
                aria-label="delete"
                color="secondary"
              >
                <DeleteOutlineIcon />
              </IconButton>
            </>
          )}
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {!isCreate && editing && (
          <Box className={classes.detailBlock}>
            <Typography className={classes.detailLabel}>
              {i18n.t("agenda.details.sectionTitle")}
            </Typography>
            <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
              {editing.title}
            </Typography>
            <Typography variant="body2" color="textSecondary" style={{ marginTop: 8 }}>
              {formatEventWhen(editing, locale, timezone)}
            </Typography>
            {editing.description ? (
              <Typography variant="body2" style={{ marginTop: 12 }}>
                {editing.description}
              </Typography>
            ) : null}
            <Box display="flex" flexWrap="wrap" gap={1} mt={2}>
              <Chip
                size="small"
                label={
                  editing.isCollective
                    ? i18n.t("agenda.legend.collective")
                    : i18n.t("agenda.legend.individual")
                }
                color={editing.isCollective ? "primary" : "default"}
              />
              <Chip
                size="small"
                label={i18n.t(visibilityLabelKey(editing.visibility))}
                variant="outlined"
              />
            </Box>
            <Typography variant="body2" color="textSecondary" style={{ marginTop: 12 }}>
              <strong>{i18n.t("agenda.details.creator")}:</strong>{" "}
              {editing.creator?.name || editing.creator?.email || `#${editing.createdBy}`}
            </Typography>
            {editing.isCollective && (editing.participants || []).length > 0 && (
              <Box mt={2}>
                <Typography className={classes.detailLabel}>
                  {i18n.t("agenda.form.participants")}
                </Typography>
                {(editing.participants || []).map((p) => (
                  <Box key={p.id || `${p.userId}-${p.status}`} className={classes.participantRow}>
                    <Typography variant="body2">
                      {p.user?.name || p.user?.email || `#${p.userId}`}
                    </Typography>
                    <Chip
                      size="small"
                      label={i18n.t(participantStatusKey(p.status))}
                      variant="outlined"
                    />
                  </Box>
                ))}
              </Box>
            )}
            {canRespond && (
              <Box mt={2} display="flex" gap={1} flexWrap="wrap">
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  startIcon={<CheckIcon />}
                  disabled={responding}
                  onClick={() => onRespond("accepted")}
                >
                  {i18n.t("agenda.respond.accept")}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<CloseIcon />}
                  disabled={responding}
                  onClick={() => onRespond("declined")}
                >
                  {i18n.t("agenda.respond.decline")}
                </Button>
              </Box>
            )}
          </Box>
        )}

        {!canEdit && !isCreate && (
          <Box className={classes.readOnlyHint}>
            <Typography variant="body2" color="textSecondary">
              {i18n.t("agenda.details.readOnlyHint")}
            </Typography>
          </Box>
        )}

        {(canEdit || isCreate) && (
          <>
            {!isCreate && <Divider style={{ marginBottom: 16 }} />}
            <Typography variant="subtitle2" gutterBottom style={{ fontWeight: 600 }}>
              {i18n.t("agenda.details.fieldsSection")}
            </Typography>
            <TextField
              fullWidth
              margin="normal"
              label={i18n.t("agenda.form.title")}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
            <TextField
              fullWidth
              margin="normal"
              label={i18n.t("agenda.form.description")}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              multiline
              minRows={2}
            />
            <TextField
              fullWidth
              margin="normal"
              type="datetime-local"
              label={i18n.t("agenda.form.start")}
              value={form.startAt}
              onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              disabled={form.allDay}
            />
            <TextField
              fullWidth
              margin="normal"
              type="datetime-local"
              label={i18n.t("agenda.form.end")}
              value={form.endAt}
              onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              disabled={form.allDay}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.allDay}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setForm((f) => {
                      if (on) {
                        const base =
                          f.startAt ||
                          moment.tz(timezone || "America/Sao_Paulo").format("YYYY-MM-DDTHH:mm");
                        const d = base.split("T")[0];
                        return {
                          ...f,
                          allDay: true,
                          startAt: `${d}T00:00`,
                          endAt: `${d}T23:59`,
                        };
                      }
                      return { ...f, allDay: false };
                    });
                  }}
                  color="primary"
                />
              }
              label={i18n.t("agenda.form.allDay")}
            />
            {(canEdit || isCreate) && (
              <Box>
                <Typography className={classes.detailLabel} style={{ marginTop: 8 }}>
                  {i18n.t("agenda.form.color")}
                </Typography>
                <Typography variant="caption" color="textSecondary" display="block">
                  {i18n.t("agenda.form.colorHint")}
                </Typography>
                <Box className={classes.colorRow}>
                  {GOOGLE_CALENDAR_PALETTE.map((p) => {
                    const active = normalizeHexColor(form.color) === p.hex;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        className={classes.colorSwatch}
                        style={{
                          backgroundColor: p.hex,
                          boxShadow: active ? `0 0 0 2px ${p.hex}, 0 0 0 4px #fff` : undefined,
                        }}
                        title={i18n.t(`agenda.form.palette.${p.key}`)}
                        aria-label={i18n.t(`agenda.form.palette.${p.key}`)}
                        onClick={() => setForm((f) => ({ ...f, color: p.hex }))}
                      />
                    );
                  })}
                  <Button
                    size="small"
                    onClick={() => setForm((f) => ({ ...f, color: "" }))}
                  >
                    {i18n.t("agenda.form.colorClear")}
                  </Button>
                </Box>
              </Box>
            )}
            {elevated && (!editing || editing.isCollective) && (
              <>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.isCollective}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          isCollective: e.target.checked,
                          visibility: e.target.checked ? f.visibility : "private",
                        }))
                      }
                      color="primary"
                    />
                  }
                  label={i18n.t("agenda.form.collective")}
                />
                {form.isCollective && (
                  <FormControl component="fieldset" margin="normal" fullWidth>
                    <FormLabel component="legend">{i18n.t("agenda.form.visibility")}</FormLabel>
                    <RadioGroup
                      value={form.visibility}
                      onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value }))}
                    >
                      <FormControlLabel
                        value="private"
                        control={<Radio color="primary" />}
                        label={i18n.t("agenda.form.visPrivate")}
                      />
                      <FormControlLabel
                        value="team"
                        control={<Radio color="primary" />}
                        label={i18n.t("agenda.form.visTeam")}
                      />
                      <FormControlLabel
                        value="company"
                        control={<Radio color="primary" />}
                        label={i18n.t("agenda.form.visCompany")}
                      />
                    </RadioGroup>
                  </FormControl>
                )}
                {form.isCollective && (
                  <Autocomplete
                    multiple
                    options={participantOptions}
                    getOptionLabel={(o) => o.label}
                    value={participantOptions.filter((o) =>
                      (form.participantUserIds || []).includes(o.id)
                    )}
                    onChange={(_, v) =>
                      setForm((f) => ({
                        ...f,
                        participantUserIds: (v || []).map((x) => x.id),
                      }))
                    }
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip label={option.label} {...getTagProps({ index })} size="small" />
                      ))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        margin="normal"
                        label={i18n.t("agenda.form.participants")}
                      />
                    )}
                  />
                )}
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{i18n.t("agenda.form.cancel")}</Button>
        {(canEdit || isCreate) && (
          <Button color="primary" variant="contained" onClick={onSave}>
            {i18n.t("agenda.form.save")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AgendaEventModal;
