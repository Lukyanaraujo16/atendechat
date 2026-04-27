import React from "react";
import { makeStyles, alpha } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import CardActions from "@material-ui/core/CardActions";
import Chip from "@material-ui/core/Chip";
import IconButton from "@material-ui/core/IconButton";
import Button from "@material-ui/core/Button";
import Divider from "@material-ui/core/Divider";
import CircularProgress from "@material-ui/core/CircularProgress";
import EditOutlinedIcon from "@material-ui/icons/EditOutlined";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EventIcon from "@material-ui/icons/Event";
import FilterListIcon from "@material-ui/icons/FilterList";
import { i18n } from "../../translate/i18n";
import {
  canEditAppointment,
  formatEventWhen,
  visibilityLabelKey,
  participantStatusKey,
  appointmentOverlapsToday,
} from "./agendaUtils";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(2),
    minHeight: 360,
    maxHeight: "calc(100vh - 340px)",
    overflow: "auto",
    ...theme.scrollbarStylesSoft,
  },
  groupTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(1.5),
    marginTop: theme.spacing(2),
    color: theme.palette.text.secondary,
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    "&:first-of-type": {
      marginTop: 0,
    },
  },
  loadingBox: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 320,
  },
  emptyCard: {
    textAlign: "center",
    padding: theme.spacing(6, 3),
    backgroundColor:
      theme.palette.type === "dark" ? theme.palette.background.default : theme.palette.grey[50],
    border: `1px dashed ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
  },
  emptyIcon: {
    fontSize: 48,
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2),
    opacity: 0.6,
  },
  card: {
    marginBottom: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    transition: theme.transitions.create(["box-shadow", "border-color"], {
      duration: theme.transitions.duration.short,
    }),
    "&:hover": {
      boxShadow: theme.shadows[4],
      borderColor: theme.palette.primary.main + "40",
    },
  },
  cardToday: {
    borderLeft: `4px solid ${theme.palette.primary.main}`,
    backgroundColor: alpha(theme.palette.primary.main, theme.palette.type === "dark" ? 0.12 : 0.06),
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  meta: {
    color: theme.palette.text.secondary,
    fontSize: "0.875rem",
    marginTop: theme.spacing(0.5),
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.75),
    marginTop: theme.spacing(1.5),
  },
  participants: {
    marginTop: theme.spacing(1),
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
  },
  actions: {
    justifyContent: "flex-end",
    padding: theme.spacing(1, 2, 2),
    gap: theme.spacing(0.5),
  },
}));

const renderCard = (a, classes, user, elevated, locale, onOpenEvent, onDeleteRequest) => {
  const canEdit = canEditAppointment(a, user?.id, elevated);
  const isMine = Number(a.createdBy) === Number(user?.id);
  const creatorName = a.creator?.name || a.creator?.email || `#${a.createdBy}`;
  const todayOverlap = appointmentOverlapsToday(a);

  return (
    <Card
      key={a.id}
      className={`${classes.card} ${todayOverlap ? classes.cardToday : ""}`}
      elevation={0}
    >
      <CardContent>
        <Box className={classes.cardHeader}>
          <Box flex={1} minWidth={0}>
            <Box display="flex" alignItems="center" flexWrap="wrap" gap={0.75}>
              <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                {a.title || "—"}
              </Typography>
              {todayOverlap ? (
                <Chip size="small" label={i18n.t("agenda.list.todayBadge")} color="primary" />
              ) : null}
            </Box>
            <Typography className={classes.meta}>{formatEventWhen(a, locale)}</Typography>
          </Box>
          <Box display="flex" gap={0.5}>
            {canEdit && (
              <IconButton size="small" aria-label="edit" onClick={() => onOpenEvent(a)}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            )}
            {canEdit && (
              <IconButton size="small" aria-label="delete" onClick={() => onDeleteRequest(a)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Box>
        <Box className={classes.chips}>
          <Chip
            size="small"
            label={
              a.isCollective
                ? i18n.t("agenda.legend.collective")
                : i18n.t("agenda.legend.individual")
            }
            color={a.isCollective ? "primary" : "default"}
            variant={a.isCollective ? "default" : "outlined"}
          />
          <Chip
            size="small"
            label={
              isMine
                ? i18n.t("agenda.details.createdByMe")
                : i18n.t("agenda.details.createdByOther")
            }
            variant="outlined"
          />
          <Chip
            size="small"
            label={i18n.t(visibilityLabelKey(a.visibility))}
            variant="outlined"
          />
        </Box>
        {a.description ? (
          <Typography variant="body2" color="textSecondary" style={{ marginTop: 12 }}>
            {a.description}
          </Typography>
        ) : null}
        <Typography className={classes.participants}>
          <strong>{i18n.t("agenda.form.participants")}:</strong>{" "}
          {a.isCollective && (a.participants || []).length > 0
            ? (a.participants || [])
                .map((p) => {
                  const name = p.user?.name || p.user?.email || `#${p.userId}`;
                  const st = i18n.t(participantStatusKey(p.status));
                  return `${name} (${st})`;
                })
                .join(" · ")
            : i18n.t("agenda.list.noParticipants")}
        </Typography>
        <Typography variant="caption" display="block" color="textSecondary" style={{ marginTop: 8 }}>
          {i18n.t("agenda.details.creator")}: {creatorName}
        </Typography>
      </CardContent>
      <Divider />
      <CardActions className={classes.actions}>
        <Button size="small" color="primary" onClick={() => onOpenEvent(a)}>
          {i18n.t("agenda.list.viewDetails")}
        </Button>
      </CardActions>
    </Card>
  );
};

const AgendaListView = ({
  listGroups,
  loading,
  user,
  elevated,
  onOpenEvent,
  onDeleteRequest,
  onCreateClick,
  locale,
  hasRawAppointments,
}) => {
  const classes = useStyles();

  if (loading) {
    return (
      <Box className={classes.loadingBox}>
        <CircularProgress size={44} />
      </Box>
    );
  }

  const totalItems = listGroups.reduce((n, g) => n + g.items.length, 0);

  if (!totalItems && hasRawAppointments) {
    return (
      <Box className={classes.root}>
        <Box className={classes.emptyCard}>
          <FilterListIcon className={classes.emptyIcon} />
          <Typography variant="h6" gutterBottom>
            {i18n.t("agenda.filters.emptyFilteredTitle")}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {i18n.t("agenda.filters.emptyFilteredSubtitle")}
          </Typography>
        </Box>
      </Box>
    );
  }

  if (!totalItems) {
    return (
      <Box className={classes.root}>
        <Box className={classes.emptyCard}>
          <EventIcon className={classes.emptyIcon} />
          <Typography variant="h6" gutterBottom>
            {i18n.t("agenda.list.emptyTitle")}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {i18n.t("agenda.list.emptySubtitle")}
          </Typography>
          <Box mt={2}>
            <Button variant="outlined" color="primary" size="small" onClick={onCreateClick}>
              {i18n.t("agenda.newEvent")}
            </Button>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box className={classes.root}>
      {listGroups.map((group) => (
        <Box key={group.id}>
          <Typography className={classes.groupTitle} component="div">
            {i18n.t(`agenda.list.group.${group.id}`)}
          </Typography>
          {group.items.map((a) =>
            renderCard(a, classes, user, elevated, locale, onOpenEvent, onDeleteRequest)
          )}
        </Box>
      ))}
    </Box>
  );
};

export default AgendaListView;
