import React, { useState, useCallback, useContext, useMemo, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import Box from "@material-ui/core/Box";
import CircularProgress from "@material-ui/core/CircularProgress";
import InputAdornment from "@material-ui/core/InputAdornment";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import CardActions from "@material-ui/core/CardActions";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Tooltip from "@material-ui/core/Tooltip";
import Chip from "@material-ui/core/Chip";
import LinearProgress from "@material-ui/core/LinearProgress";
import Switch from "@material-ui/core/Switch";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Autocomplete from "@material-ui/lab/Autocomplete";

import RefreshIcon from "@material-ui/icons/Refresh";
import ExitToAppIcon from "@material-ui/icons/ExitToApp";
import SearchIcon from "@material-ui/icons/Search";
import GroupIcon from "@material-ui/icons/Group";
import ForumIcon from "@material-ui/icons/Forum";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";
import PersonAddIcon from "@material-ui/icons/PersonAdd";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import GroupImportParticipantsModal from "../../components/GroupImportParticipantsModal";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import useQueues from "../../hooks/useQueues";
import useIsMobile from "../../hooks/useIsMobile";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
  AppPrimaryButton,
  AppSecondaryButton,
  MobileEntityCard,
  MobileCardList,
  MobileActionsMenu,
} from "../../ui";
import VisibilityIcon from "@material-ui/icons/Visibility";
import VisibilityOffIcon from "@material-ui/icons/VisibilityOff";
import EditIcon from "@material-ui/icons/Edit";

const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    borderRadius: 12,
  },
  filterRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    alignItems: "center",
    marginBottom: theme.spacing(2),
  },
  connectionSelect: {
    minWidth: 260,
  },
  connectionSelectMobile: {
    width: "100%",
    minWidth: 0,
  },
  filterRowMobile: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  mobileSearchField: {
    width: "100%",
  },
  mobileCardChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.5),
    maxWidth: "100%",
  },
  tabPanel: {
    paddingTop: theme.spacing(2),
  },
  emptyWrap: {
    textAlign: "center",
    padding: theme.spacing(5, 2),
    color: theme.palette.text.secondary,
  },
  emptyIcon: {
    fontSize: 56,
    opacity: 0.35,
    marginBottom: theme.spacing(1),
  },
  groupCard: {
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    transition: theme.transitions.create(["box-shadow", "border-color"], {
      duration: theme.transitions.duration.shorter,
    }),
    "&:hover": {
      borderColor: theme.palette.primary.main,
      boxShadow: theme.shadows[2],
    },
  },
  cardTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(0.5),
  },
  cardMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.75),
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  adminLine: {
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
    lineHeight: 1.45,
  },
  jidHint: {
    fontSize: "0.75rem",
    color: theme.palette.text.disabled,
    marginTop: theme.spacing(1),
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  leaveDialogPaper: {
    borderRadius: 12,
    backgroundColor: theme.palette.background.paper,
  },
  leaveDialogTitle: {
    borderBottom: `1px solid ${theme.palette.divider}`,
    paddingBottom: theme.spacing(1),
  },
  leaveDialogActions: {
    padding: theme.spacing(2),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  listGrid: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
  },
}));

function TabPanel({ children, value, index }) {
  if (value !== index) return null;
  return <div role="tabpanel">{children}</div>;
}

const GroupManager = () => {
  const classes = useStyles();
  const isMobile = useIsMobile();
  const history = useHistory();
  const { whatsApps, loading: loadingWhats } = useContext(WhatsAppsContext);
  const { user } = useContext(AuthContext);
  const { findAll: findAllQueues } = useQueues();

  const [whatsappId, setWhatsappId] = useState("");
  const [tab, setTab] = useState(0);
  const [groups, setGroups] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");

  const [createName, setCreateName] = useState("");
  const [createParticipants, setCreateParticipants] = useState("");
  const [creating, setCreating] = useState(false);

  const [inviteInput, setInviteInput] = useState("");
  const [joining, setJoining] = useState(false);

  const [leaveModal, setLeaveModal] = useState({ open: false, group: null });
  const [importModal, setImportModal] = useState({ open: false, group: null });
  const closeImportModal = useCallback(() => {
    setImportModal({ open: false, group: null });
  }, []);
  const [leaving, setLeaving] = useState(false);
  const [openingGroupId, setOpeningGroupId] = useState(null);
  const [companyQueues, setCompanyQueues] = useState([]);
  const [savingQueuesFor, setSavingQueuesFor] = useState(null);
  const [sectorsDialog, setSectorsDialog] = useState({
    open: false,
    group: null,
    queueIds: [],
  });

  const connectedList = useMemo(
    () =>
      (Array.isArray(whatsApps) ? whatsApps : []).filter((w) => w.status === "CONNECTED"),
    [whatsApps]
  );

  const fetchGroups = useCallback(async () => {
    if (!whatsappId) {
      setGroups([]);
      return;
    }
    setLoadingList(true);
    try {
      const { data } = await api.get(`/groups/${whatsappId}`);
      setGroups(Array.isArray(data.groups) ? data.groups : []);
    } catch (err) {
      toastError(err);
      setGroups([]);
    } finally {
      setLoadingList(false);
    }
  }, [whatsappId]);

  const canManageVisibility = useMemo(() => {
    return user?.profile === "admin" || user?.profile === "supervisor" || user?.supportMode === true;
  }, [user]);

  const canImportParticipants = user?.effectiveUserFeatures?.["team.export_group_participants"] === true;

  const handleToggleGroupVisible = async (g) => {
    if (!g?.contactId) return;
    try {
      const next = !Boolean(g.groupVisible);
      await api.put(`/contacts/${g.contactId}/group-visibility`, { groupVisible: next });
      setGroups((prev) =>
        (Array.isArray(prev) ? prev : []).map((x) =>
          x.id === g.id ? { ...x, groupVisible: next } : x
        )
      );
      toast.success(
        next
          ? i18n.t("groups.visibility.toastEnabled")
          : i18n.t("groups.visibility.toastDisabled")
      );
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    if (whatsappId) {
      fetchGroups();
    } else {
      setGroups([]);
    }
  }, [whatsappId, fetchGroups]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await findAllQueues();
        if (!cancelled) setCompanyQueues(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setCompanyQueues([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [findAllQueues]);

  const resolveQueueChips = useCallback(
    (g) => {
      if (g.groupVisible !== true) {
        return [{ key: "hidden", label: i18n.t("groups.visibility.hiddenChip") }];
      }
      const ids = Array.isArray(g.authorizedQueueIds) ? g.authorizedQueueIds : [];
      if (!ids.length) {
        return [{ key: "all", label: i18n.t("groups.queues.allSectors") }];
      }
      return ids.map((id) => {
        const q = companyQueues.find((x) => Number(x.id) === Number(id));
        return {
          key: `q-${id}`,
          label: q?.name || `#${id}`,
        };
      });
    },
    [companyQueues]
  );

  const handleSaveGroupQueues = async (g, nextQueueIds) => {
    if (!g?.contactId) return;
    setSavingQueuesFor(g.id);
    try {
      const { data } = await api.put(`/contacts/${g.contactId}/group-queues`, {
        queueIds: nextQueueIds,
      });
      const saved = Array.isArray(data?.queueIds) ? data.queueIds : nextQueueIds;
      setGroups((prev) =>
        (Array.isArray(prev) ? prev : []).map((x) =>
          x.id === g.id ? { ...x, authorizedQueueIds: saved } : x
        )
      );
      toast.success(i18n.t("groups.queues.toastSaved"));
    } catch (err) {
      toastError(err);
    } finally {
      setSavingQueuesFor(null);
    }
  };

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        (g.name || "").toLowerCase().includes(q) ||
        (g.id || "").toLowerCase().includes(q)
    );
  }, [groups, search]);

  const handleOpenConversation = async (g) => {
    if (!whatsappId) {
      toast.warning(i18n.t("groups.manager.selectConnection"));
      return;
    }
    setOpeningGroupId(g.id);
    try {
      const { data } = await api.post("/groups/open-conversation", {
        whatsappId: Number(whatsappId),
        groupId: g.id,
      });
      if (data?.uuid) {
        toast.success(i18n.t("groups.manager.openingConversation"));
        history.push(`/tickets/${data.uuid}?inboxTab=groups`);
      }
    } catch (err) {
      toastError(err);
    } finally {
      setOpeningGroupId(null);
    }
  };

  const handleCreate = async () => {
    if (!whatsappId) {
      toast.warning(i18n.t("groups.manager.selectConnection"));
      return;
    }
    const lines = createParticipants
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!createName.trim() || lines.length < 1) {
      toast.warning(i18n.t("groups.manager.createMissingFields"));
      return;
    }
    setCreating(true);
    try {
      await api.post("/groups/create", {
        whatsappId: Number(whatsappId),
        name: createName.trim(),
        participants: lines,
      });
      toast.success(i18n.t("groups.manager.createSuccess"));
      setCreateName("");
      setCreateParticipants("");
      setTab(0);
      await fetchGroups();
    } catch (err) {
      toastError(err);
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!whatsappId) {
      toast.warning(i18n.t("groups.manager.selectConnection"));
      return;
    }
    if (!inviteInput.trim()) {
      toast.warning(i18n.t("groups.manager.inviteRequired"));
      return;
    }
    setJoining(true);
    try {
      await api.post("/groups/join", {
        whatsappId: Number(whatsappId),
        inviteCode: inviteInput.trim(),
      });
      toast.success(i18n.t("groups.manager.joinSuccess"));
      setInviteInput("");
      setTab(0);
      await fetchGroups();
    } catch (err) {
      toastError(err);
    } finally {
      setJoining(false);
    }
  };

  const confirmLeave = async () => {
    const g = leaveModal.group;
    if (!g || !whatsappId) return;
    setLeaving(true);
    try {
      await api.post("/groups/leave", {
        whatsappId: Number(whatsappId),
        groupId: g.id,
      });
      toast.success(i18n.t("groups.manager.leaveSuccess"));
      setLeaveModal({ open: false, group: null });
      await fetchGroups();
    } catch (err) {
      toastError(err);
    } finally {
      setLeaving(false);
    }
  };

  const renderAdminSummary = (g) => {
    const count = g.adminCount ?? 0;
    const preview = Array.isArray(g.adminPreview) ? g.adminPreview : [];
    if (count === 0) return "Sem administradores listados.";
    if (preview.length === 0) {
      return `${count} admin(s) — nomes não disponíveis no WhatsApp.`;
    }
    const more = count > preview.length ? ` (+${count - preview.length})` : "";
    return `Admins: ${preview.join(", ")}${more}`;
  };

  const selectedConnectionName = useMemo(() => {
    const conn = connectedList.find((w) => String(w.id) === String(whatsappId));
    return conn?.name || (whatsappId ? `Conexão ${whatsappId}` : "");
  }, [connectedList, whatsappId]);

  const openSectorsDialog = (g) => {
    setSectorsDialog({
      open: true,
      group: g,
      queueIds: Array.isArray(g.authorizedQueueIds)
        ? g.authorizedQueueIds.map((id) => Number(id))
        : [],
    });
  };

  const saveSectorsDialog = async () => {
    if (!sectorsDialog.group) return;
    await handleSaveGroupQueues(sectorsDialog.group, sectorsDialog.queueIds);
    setSectorsDialog({ open: false, group: null, queueIds: [] });
  };

  const buildGroupActionItems = (g) => {
    const items = [
      {
        key: "open",
        label: i18n.t("groups.manager.openConversation"),
        icon:
          openingGroupId === g.id ? (
            <CircularProgress size={18} />
          ) : (
            <ForumIcon fontSize="small" />
          ),
        disabled: loadingList || openingGroupId === g.id,
        onClick: () => handleOpenConversation(g),
      },
    ];

    if (canManageVisibility && g.contactId) {
      items.push({
        key: "visibility",
        label: i18n.t("groups.mobile.toggleVisibility"),
        icon: g.groupVisible ? (
          <VisibilityOffIcon fontSize="small" />
        ) : (
          <VisibilityIcon fontSize="small" />
        ),
        onClick: () => handleToggleGroupVisible(g),
      });
      if (g.groupVisible === true) {
        items.push({
          key: "sectors",
          label: i18n.t("groups.mobile.editSectors"),
          icon: <EditIcon fontSize="small" />,
          onClick: () => openSectorsDialog(g),
        });
      }
    }

    if (canImportParticipants) {
      items.push({
        key: "import-participants",
        label: i18n.t("groups.importParticipants.action"),
        icon: <PersonAddIcon fontSize="small" />,
        disabled: loadingList || openingGroupId === g.id,
        onClick: () => setImportModal({ open: true, group: g }),
      });
    }

    items.push({ key: "leave-divider", divider: true });
    items.push({
      key: "leave",
      label: i18n.t("groups.manager.leave"),
      icon: <ExitToAppIcon fontSize="small" />,
      danger: true,
      disabled: loadingList || !!openingGroupId,
      onClick: () => setLeaveModal({ open: true, group: g }),
    });

    return items;
  };

  const renderGroupMobileCard = (g) => (
    <MobileEntityCard
      key={g.id}
      leading={<GroupIcon color="action" />}
      title={g.name || "—"}
      subtitle={
        selectedConnectionName
          ? `${selectedConnectionName} · ${i18n.t("groups.manager.participantsChip", { count: g.participantCount ?? 0 })}`
          : i18n.t("groups.manager.participantsChip", { count: g.participantCount ?? 0 })
      }
      badges={
        <MobileActionsMenu
          items={buildGroupActionItems(g)}
          ariaLabel={i18n.t("groups.mobile.actions")}
        />
      }
    >
      <Box className={classes.mobileCardChips}>
        <Chip
          size="small"
          label={i18n.t("groups.manager.adminsChip", { count: g.adminCount ?? 0 })}
          variant="outlined"
        />
        {resolveQueueChips(g).map((chip) => (
          <Chip
            key={chip.key}
            size="small"
            color={chip.key === "hidden" ? "default" : "primary"}
            variant="outlined"
            label={chip.label}
          />
        ))}
        {canManageVisibility ? (
          <Chip
            size="small"
            variant="outlined"
            color={g.groupVisible ? "primary" : "default"}
            label={
              g.groupVisible
                ? i18n.t("groups.visibility.label")
                : i18n.t("groups.visibility.hiddenChip")
            }
          />
        ) : null}
      </Box>
      <Typography className={classes.adminLine}>{renderAdminSummary(g)}</Typography>
    </MobileEntityCard>
  );

  const leaveDialogBody = (
    <Typography variant="body2" color="textSecondary">
      {leaveModal.group
        ? `Sair de "${leaveModal.group.name || "grupo"}"? Você deixará de receber mensagens deste grupo nesta conexão. Esta ação não pode ser desfeita pelo sistema.`
        : ""}
    </Typography>
  );

  const leaveDialogActions = (
    <>
      <Button
        onClick={() => !leaving && setLeaveModal({ open: false, group: null })}
        disabled={leaving}
        variant="outlined"
      >
        Cancelar
      </Button>
      <Button
        onClick={confirmLeave}
        disabled={leaving}
        variant="contained"
        color="secondary"
      >
        {leaving ? <CircularProgress size={22} color="inherit" /> : "Sair do grupo"}
      </Button>
    </>
  );

  return (
    <MainContainer>
      {isMobile ? (
        <AppDialog
          open={sectorsDialog.open}
          onClose={() =>
            !savingQueuesFor &&
            setSectorsDialog({ open: false, group: null, queueIds: [] })
          }
          maxWidth="sm"
        >
          <AppDialogTitle>{i18n.t("groups.mobile.sectorsDialogTitle")}</AppDialogTitle>
          <AppDialogContent>
            <Autocomplete
              multiple
              size="small"
              options={companyQueues}
              getOptionLabel={(opt) => opt?.name || ""}
              value={companyQueues.filter((q) =>
                (sectorsDialog.queueIds || []).includes(Number(q.id))
              )}
              onChange={(_e, newValue) => {
                setSectorsDialog((prev) => ({
                  ...prev,
                  queueIds: (newValue || []).map((q) => Number(q.id)),
                }));
              }}
              disabled={savingQueuesFor === sectorsDialog.group?.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="outlined"
                  label={i18n.t("groups.queues.label")}
                  placeholder={i18n.t("groups.queues.placeholder")}
                  fullWidth
                />
              )}
            />
          </AppDialogContent>
          <AppDialogActions>
            <AppSecondaryButton
              onClick={() =>
                setSectorsDialog({ open: false, group: null, queueIds: [] })
              }
              disabled={savingQueuesFor === sectorsDialog.group?.id}
            >
              Cancelar
            </AppSecondaryButton>
            <AppPrimaryButton
              onClick={saveSectorsDialog}
              disabled={savingQueuesFor === sectorsDialog.group?.id}
            >
              {savingQueuesFor === sectorsDialog.group?.id ? (
                <CircularProgress size={22} color="inherit" />
              ) : (
                i18n.t("groups.mobile.saveSectors")
              )}
            </AppPrimaryButton>
          </AppDialogActions>
        </AppDialog>
      ) : null}

      {isMobile ? (
        <AppDialog
          open={leaveModal.open}
          onClose={() => !leaving && setLeaveModal({ open: false, group: null })}
          maxWidth="xs"
        >
          <AppDialogTitle id="gm-leave-title">Sair do grupo</AppDialogTitle>
          <AppDialogContent>{leaveDialogBody}</AppDialogContent>
          <AppDialogActions>{leaveDialogActions}</AppDialogActions>
        </AppDialog>
      ) : (
        <Dialog
          open={leaveModal.open}
          onClose={() => !leaving && setLeaveModal({ open: false, group: null })}
          maxWidth="xs"
          fullWidth
          PaperProps={{ className: classes.leaveDialogPaper }}
        >
          <DialogTitle className={classes.leaveDialogTitle} id="gm-leave-title">
            Sair do grupo
          </DialogTitle>
          <DialogContent>{leaveDialogBody}</DialogContent>
          <DialogActions className={classes.leaveDialogActions}>
            {leaveDialogActions}
          </DialogActions>
        </Dialog>
      )}

      <GroupImportParticipantsModal
        open={importModal.open}
        group={importModal.group}
        whatsappId={whatsappId}
        onClose={closeImportModal}
      />

      <MainHeader>
        <Title>Gerenciar grupos (WhatsApp)</Title>
      </MainHeader>

      <Paper className={classes.paper} elevation={0}>
        <Typography variant="body2" color="textSecondary" paragraph>
          Gerencie grupos da conexão selecionada. Não cria tickets nem dispara automações — apenas comandos
          nativos do WhatsApp. A abertura de conversa na inbox só cria/atualiza o registro operacional do grupo
          (sem chatbot).
        </Typography>
        <div
          className={`${classes.filterRow} ${isMobile ? classes.filterRowMobile : ""}`}
        >
          <FormControl
            variant="outlined"
            size="small"
            className={isMobile ? classes.connectionSelectMobile : classes.connectionSelect}
            fullWidth={isMobile}
          >
            <InputLabel id="gm-conn-label">Conexão WhatsApp</InputLabel>
            <Select
              labelId="gm-conn-label"
              label="Conexão WhatsApp"
              value={whatsappId}
              onChange={(e) => setWhatsappId(e.target.value)}
              disabled={loadingWhats}
            >
              <MenuItem value="">
                <em>Selecione</em>
              </MenuItem>
              {connectedList.map((w) => (
                <MenuItem key={w.id} value={String(w.id)}>
                  {w.name || `Conexão ${w.id}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {loadingWhats && <CircularProgress size={24} />}
        </div>

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          indicatorColor="primary"
          textColor="primary"
          variant={isMobile ? "scrollable" : "standard"}
          scrollButtons={isMobile ? "auto" : undefined}
        >
          <Tab icon={<GroupIcon />} label="Meus grupos" />
          <Tab label="Criar grupo" />
          <Tab label="Entrar no grupo" />
        </Tabs>

        <TabPanel value={tab} index={0}>
          <div className={classes.tabPanel}>
            <Box
              display="flex"
              flexWrap="wrap"
              alignItems="center"
              mb={2}
              style={{ gap: isMobile ? 8 : 16 }}
            >
              <TextField
                size="small"
                variant="outlined"
                placeholder="Buscar por nome ou ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                }}
                className={isMobile ? classes.mobileSearchField : undefined}
                style={isMobile ? undefined : { minWidth: 240 }}
                fullWidth={isMobile}
                disabled={!whatsappId}
              />
              <Button
                variant="contained"
                color="primary"
                fullWidth={isMobile}
                startIcon={loadingList ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
                onClick={fetchGroups}
                disabled={!whatsappId || loadingList}
              >
                {i18n.t("groups.manager.refresh")}
              </Button>
            </Box>
            {whatsappId && loadingList && (
              <Box mb={2}>
                <LinearProgress />
                <Typography variant="caption" color="textSecondary" paragraph style={{ marginTop: 8 }}>
                  {i18n.t("groups.manager.loading")}
                </Typography>
              </Box>
            )}
            {!whatsappId && (
              <div className={classes.emptyWrap}>
                <GroupIcon className={classes.emptyIcon} />
                <Typography variant="body1">{i18n.t("groups.manager.emptySelectTitle")}</Typography>
                <Typography variant="body2" style={{ marginTop: 8 }}>
                  {i18n.t("groups.manager.emptySelectSubtitle")}
                </Typography>
              </div>
            )}
            {whatsappId && !loadingList && filteredGroups.length === 0 && (
              <div className={classes.emptyWrap}>
                <ForumIcon className={classes.emptyIcon} />
                <Typography variant="body1">{i18n.t("groups.manager.emptyNoGroupsTitle")}</Typography>
                <Typography variant="body2" style={{ marginTop: 8 }}>
                  {i18n.t("groups.manager.emptyNoGroupsSubtitle")}
                </Typography>
              </div>
            )}
            {whatsappId && !loadingList && filteredGroups.length > 0 && isMobile ? (
              <MobileCardList>
                {filteredGroups.map((g) => renderGroupMobileCard(g))}
              </MobileCardList>
            ) : null}
            {whatsappId && !loadingList && filteredGroups.length > 0 && !isMobile ? (
              <div className={classes.listGrid}>
                {filteredGroups.map((g) => (
                  <Card key={g.id} className={classes.groupCard} elevation={0}>
                    <CardContent>
                      <Typography className={classes.cardTitle} variant="subtitle1" component="h3">
                        {g.name || "—"}
                      </Typography>
                      <div className={classes.cardMeta}>
                        <Chip size="small" label={i18n.t("groups.manager.participantsChip", { count: g.participantCount ?? 0 })} variant="outlined" />
                        <Chip size="small" label={i18n.t("groups.manager.adminsChip", { count: g.adminCount ?? 0 })} variant="outlined" />
                        {resolveQueueChips(g).map((chip) => (
                          <Chip
                            key={chip.key}
                            size="small"
                            color={chip.key === "hidden" ? "default" : "primary"}
                            variant="outlined"
                            label={chip.label}
                          />
                        ))}
                      </div>
                      <Typography className={classes.adminLine}>{renderAdminSummary(g)}</Typography>
                      <Tooltip title={g.id || ""} placement="top">
                        <Typography className={classes.jidHint} component="div">
                          <InfoOutlinedIcon fontSize="inherit" />
                          <span>{i18n.t("groups.manager.idHint")}</span>
                        </Typography>
                      </Tooltip>
                    </CardContent>
                    <CardActions style={{ padding: "8px 16px 16px", flexWrap: "wrap", gap: 8 }}>
                      {canManageVisibility && (
                        <Box display="flex" flexDirection="column" style={{ gap: 8, minWidth: 260 }}>
                          <Tooltip
                            title={
                              g.groupVisible
                                ? i18n.t("groups.visibility.hideTooltip")
                                : i18n.t("groups.visibility.showTooltip")
                            }
                          >
                            <FormControlLabel
                              control={
                                <Switch
                                  color="primary"
                                  checked={Boolean(g.groupVisible)}
                                  onChange={() => handleToggleGroupVisible(g)}
                                  disabled={!g.contactId}
                                />
                              }
                              label={i18n.t("groups.visibility.label")}
                            />
                          </Tooltip>
                          {g.contactId && g.groupVisible === true ? (
                            <Autocomplete
                              multiple
                              size="small"
                              options={companyQueues}
                              getOptionLabel={(opt) => opt?.name || ""}
                              value={companyQueues.filter((q) =>
                                (Array.isArray(g.authorizedQueueIds) ? g.authorizedQueueIds : []).includes(
                                  Number(q.id)
                                )
                              )}
                              onChange={(_e, newValue) => {
                                handleSaveGroupQueues(
                                  g,
                                  (newValue || []).map((q) => Number(q.id))
                                );
                              }}
                              disabled={savingQueuesFor === g.id}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  variant="outlined"
                                  label={i18n.t("groups.queues.label")}
                                  placeholder={i18n.t("groups.queues.placeholder")}
                                />
                              )}
                            />
                          ) : null}
                        </Box>
                      )}
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        startIcon={
                          openingGroupId === g.id ? (
                            <CircularProgress size={18} color="inherit" />
                          ) : (
                            <ForumIcon />
                          )
                        }
                        onClick={() => handleOpenConversation(g)}
                        disabled={loadingList || openingGroupId === g.id}
                      >
                        {i18n.t("groups.manager.openConversation")}
                      </Button>
                      {canImportParticipants ? (
                        <Button
                          size="small"
                          variant="outlined"
                          color="primary"
                          startIcon={<PersonAddIcon />}
                          onClick={() => setImportModal({ open: true, group: g })}
                          disabled={loadingList || !!openingGroupId}
                        >
                          {i18n.t("groups.importParticipants.action")}
                        </Button>
                      ) : null}
                      <Button
                        size="small"
                        variant="outlined"
                        color="secondary"
                        startIcon={<ExitToAppIcon />}
                        onClick={() => setLeaveModal({ open: true, group: g })}
                        disabled={loadingList || !!openingGroupId}
                      >
                        {i18n.t("groups.manager.leave")}
                      </Button>
                    </CardActions>
                  </Card>
                ))}
              </div>
            ) : null}
          </div>
        </TabPanel>

        <TabPanel value={tab} index={1}>
          <div className={classes.tabPanel}>
            <TextField
              fullWidth
              margin="normal"
              label="Nome do grupo"
              variant="outlined"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              disabled={!whatsappId}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Números dos participantes"
              placeholder="Um por linha ou separados por vírgula (DDI + DDD + número)"
              variant="outlined"
              multiline
              minRows={4}
              value={createParticipants}
              onChange={(e) => setCreateParticipants(e.target.value)}
              disabled={!whatsappId}
              helperText="Inclua código do país (ex.: 5511999998888). É necessário pelo menos um contato."
            />
            <Box mt={2}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleCreate}
                disabled={!whatsappId || creating}
              >
                {creating ? <CircularProgress size={22} /> : "Criar grupo"}
              </Button>
            </Box>
          </div>
        </TabPanel>

        <TabPanel value={tab} index={2}>
          <div className={classes.tabPanel}>
            <TextField
              fullWidth
              margin="normal"
              label="Link ou código do convite"
              placeholder="https://chat.whatsapp.com/..."
              variant="outlined"
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              disabled={!whatsappId}
              helperText="Cole o link completo ou só o código após chat.whatsapp.com/"
            />
            <Box mt={2}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleJoin}
                disabled={!whatsappId || joining}
              >
                {joining ? <CircularProgress size={22} /> : "Entrar no grupo"}
              </Button>
            </Box>
          </div>
        </TabPanel>
      </Paper>
    </MainContainer>
  );
};

export default GroupManager;
