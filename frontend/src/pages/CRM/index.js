import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { makeStyles, alpha } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import IconButton from "@material-ui/core/IconButton";
import Menu from "@material-ui/core/Menu";
import Skeleton from "@material-ui/lab/Skeleton";
import Chip from "@material-ui/core/Chip";
import Divider from "@material-ui/core/Divider";

import MoreVertIcon from "@material-ui/icons/MoreVert";
import AddIcon from "@material-ui/icons/Add";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import CrmDealFormDialog from "../../components/Crm/CrmDealFormDialog";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 480,
    padding: theme.spacing(2),
    backgroundColor:
      theme.palette.type === "dark"
        ? alpha(theme.palette.background.default, 0.5)
        : theme.palette.background.default,
  },
  header: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    alignItems: "center",
    marginBottom: theme.spacing(2),
  },
  summary: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    flex: 1,
    minWidth: 0,
  },
  summaryCard: {
    padding: theme.spacing(1.5, 2),
    borderRadius: 12,
    border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
    backgroundColor: theme.palette.background.paper,
    minWidth: 140,
  },
  board: {
    display: "flex",
    gap: theme.spacing(2),
    overflowX: "auto",
    flex: 1,
    paddingBottom: theme.spacing(2),
    ...theme.scrollbarStyles,
  },
  column: {
    width: 300,
    minWidth: 300,
    maxHeight: "calc(100vh - 220px)",
    display: "flex",
    flexDirection: "column",
    borderRadius: 12,
    border: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
    backgroundColor: alpha(theme.palette.background.paper, 0.92),
  },
  columnHeader: {
    padding: theme.spacing(1.5),
    borderTopLeftRadius: 11,
    borderTopRightRadius: 11,
  },
  columnBody: {
    flex: 1,
    overflowY: "auto",
    padding: theme.spacing(1),
    ...theme.scrollbarStyles,
    minHeight: 120,
  },
  dealCard: {
    borderRadius: 10,
    padding: theme.spacing(1.25),
    marginBottom: theme.spacing(1),
    border: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
    backgroundColor: theme.palette.background.paper,
    boxShadow:
      theme.palette.type === "dark"
        ? "none"
        : `0 2px 8px ${alpha(theme.palette.common.black, 0.06)}`,
    cursor: "grab",
  },
  emptyCol: {
    textAlign: "center",
    color: theme.palette.text.secondary,
    padding: theme.spacing(3, 1),
    fontSize: "0.875rem",
  },
  filters: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1.5),
    alignItems: "center",
  },
}));

function formatMoney(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "BRL" });
}

function columnTotals(deals, stages) {
  const byStage = {};
  stages.forEach((s) => {
    byStage[s.id] = { count: 0, sum: 0 };
  });
  (deals || []).forEach((d) => {
    if (!byStage[d.stageId]) {
      byStage[d.stageId] = { count: 0, sum: 0 };
    }
    byStage[d.stageId].count += 1;
    const val = d.value != null ? Number(d.value) : 0;
    if (!Number.isNaN(val)) byStage[d.stageId].sum += val;
  });
  return byStage;
}

export default function CrmBoardPage() {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [pipelines, setPipelines] = useState([]);
  const [pipelineId, setPipelineId] = useState("");
  const [deals, setDeals] = useState([]);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [users, setUsers] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDealId, setEditingDealId] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuDeal, setMenuDeal] = useState(null);

  const selectedPipeline = useMemo(
    () => pipelines.find((p) => String(p.id) === String(pipelineId)),
    [pipelines, pipelineId]
  );

  const stages = useMemo(() => {
    const s = selectedPipeline?.stages || [];
    return [...s].sort((a, b) => a.position - b.position);
  }, [selectedPipeline]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/crm/pipelines");
        const list = Array.isArray(data) ? data : [];
        if (cancelled) return;
        setPipelines(list);
        setPipelineId((prev) => {
          if (prev) return prev;
          if (!list.length) return "";
          const def = list.find((p) => p.isDefault) || list[0];
          return String(def.id);
        });
      } catch (e) {
        if (!cancelled) toastError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadDeals = useCallback(async () => {
    if (!pipelineId) {
      setDeals([]);
      return;
    }
    try {
      const params = { pipelineId };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (assigneeFilter === "unassigned") params.assignedUserId = "unassigned";
      else if (assigneeFilter) params.assignedUserId = assigneeFilter;
      const { data } = await api.get("/crm/deals", { params });
      setDeals(Array.isArray(data) ? data : []);
    } catch (e) {
      toastError(e);
    }
  }, [pipelineId, search, statusFilter, assigneeFilter]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/users/list");
        setUsers(Array.isArray(data) ? data : []);
      } catch {
        setUsers([]);
      }
    })();
  }, []);

  useEffect(() => {
    loadDeals();
  }, [loadDeals]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchDraft), 350);
    return () => clearTimeout(t);
  }, [searchDraft]);

  const totals = useMemo(() => columnTotals(deals, stages), [deals, stages]);

  const globalTotals = useMemo(() => {
    let sum = 0;
    let n = 0;
    deals.forEach((d) => {
      n += 1;
      const v = d.value != null ? Number(d.value) : 0;
      if (!Number.isNaN(v)) sum += v;
    });
    return { sum, n };
  }, [deals]);

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const dealId = Number(result.draggableId);
    const destStageId = Number(result.destination.droppableId);
    const prev = deals;
    setDeals((cur) =>
      cur.map((d) =>
        d.id === dealId ? { ...d, stageId: destStageId } : d
      )
    );
    try {
      await api.put(`/crm/deals/${dealId}/stage`, { stageId: destStageId });
      loadDeals();
    } catch (e) {
      setDeals(prev);
      toastError(e);
    }
  };

  const openNew = () => {
    setEditingDealId(null);
    setDialogOpen(true);
  };

  const openEdit = (id) => {
    setEditingDealId(id);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingDealId(null);
  };

  const handleMenu = (e, deal) => {
    setMenuAnchor(e.currentTarget);
    setMenuDeal(deal);
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuDeal(null);
  };

  const deleteDeal = async () => {
    if (!menuDeal) return;
    try {
      await api.delete(`/crm/deals/${menuDeal.id}`);
      closeMenu();
      loadDeals();
    } catch (e) {
      toastError(e);
    }
  };

  if (loading) {
    return (
      <Box className={classes.root}>
        <Skeleton variant="rect" height={56} style={{ borderRadius: 8 }} />
        <Box display="flex" gap={16} mt={2}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rect" width={300} height={400} style={{ borderRadius: 12 }} />
          ))}
        </Box>
      </Box>
    );
  }

  if (!pipelines.length) {
    return (
      <Box className={classes.root} justifyContent="center" alignItems="center" display="flex">
        <Paper style={{ padding: 32, maxWidth: 420, textAlign: "center", borderRadius: 16 }}>
          <Typography variant="h6" gutterBottom>
            {i18n.t("crm.empty.noPipelineTitle")}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {i18n.t("crm.empty.noPipelineBody")}
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box className={classes.root}>
      <Box className={classes.header}>
        <Box className={classes.summary}>
          <Box className={classes.summaryCard}>
            <Typography variant="caption" color="textSecondary">
              {i18n.t("crm.summary.pipeline")}
            </Typography>
            <FormControl variant="outlined" size="small" fullWidth style={{ marginTop: 6 }}>
              <Select
                value={pipelineId}
                onChange={(e) => setPipelineId(e.target.value)}
              >
                {pipelines.map((p) => (
                  <MenuItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box className={classes.summaryCard}>
            <Typography variant="caption" color="textSecondary">
              {i18n.t("crm.summary.openDeals")}
            </Typography>
            <Typography variant="h5">{globalTotals.n}</Typography>
          </Box>
          <Box className={classes.summaryCard}>
            <Typography variant="caption" color="textSecondary">
              {i18n.t("crm.summary.totalValue")}
            </Typography>
            <Typography variant="h5">{formatMoney(globalTotals.sum)}</Typography>
          </Box>
        </Box>
        <Button
          color="primary"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openNew}
        >
          {i18n.t("crm.actions.newDeal")}
        </Button>
      </Box>

      <Box className={classes.filters} mb={2}>
        <TextField
          size="small"
          variant="outlined"
          label={i18n.t("crm.filters.search")}
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          style={{ minWidth: 220 }}
        />
        <FormControl variant="outlined" size="small" style={{ minWidth: 160 }}>
          <InputLabel>{i18n.t("crm.filters.status")}</InputLabel>
          <Select
            label={i18n.t("crm.filters.status")}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="">{i18n.t("crm.filters.all")}</MenuItem>
            <MenuItem value="open">{i18n.t("crm.status.open")}</MenuItem>
            <MenuItem value="won">{i18n.t("crm.status.won")}</MenuItem>
            <MenuItem value="lost">{i18n.t("crm.status.lost")}</MenuItem>
          </Select>
        </FormControl>
        <FormControl variant="outlined" size="small" style={{ minWidth: 200 }}>
          <InputLabel>{i18n.t("crm.filters.assignee")}</InputLabel>
          <Select
            label={i18n.t("crm.filters.assignee")}
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
          >
            <MenuItem value="">{i18n.t("crm.filters.all")}</MenuItem>
            <MenuItem value="unassigned">{i18n.t("crm.deal.fields.unassigned")}</MenuItem>
            {users.map((u) => (
              <MenuItem key={u.id} value={String(u.id)}>
                {u.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <DragDropContext onDragEnd={onDragEnd}>
        <Box className={classes.board}>
          {stages.map((stage) => {
            const colDeals = deals.filter((d) => d.stageId === stage.id);
            const colMeta = totals[stage.id] || { count: 0, sum: 0 };
            return (
              <Paper key={stage.id} className={classes.column} elevation={0}>
                <Box
                  className={classes.columnHeader}
                  style={{
                    backgroundColor: alpha(stage.color || "#90caf9", 0.28),
                    borderBottom: `3px solid ${stage.color || "#90caf9"}`,
                  }}
                >
                  <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
                    {stage.name}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {colMeta.count} · {formatMoney(colMeta.sum)}
                  </Typography>
                </Box>
                <Droppable droppableId={String(stage.id)}>
                  {(provided, snapshot) => (
                    <Box
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={classes.columnBody}
                      style={{
                        backgroundColor: snapshot.isDraggingOver
                          ? alpha(stage.color || "#90caf9", 0.08)
                          : "transparent",
                      }}
                    >
                      {colDeals.length === 0 ? (
                        <Typography className={classes.emptyCol}>
                          {i18n.t("crm.empty.column")}
                        </Typography>
                      ) : null}
                      {colDeals.map((deal, index) => (
                        <Draggable
                          key={deal.id}
                          draggableId={String(deal.id)}
                          index={index}
                        >
                          {(dragProvided, dragSnapshot) => (
                            <Paper
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={classes.dealCard}
                              elevation={dragSnapshot.isDragging ? 4 : 0}
                            >
                              <Box display="flex" alignItems="flex-start">
                                <Box flex={1} minWidth={0}>
                                  <Typography variant="subtitle2" noWrap>
                                    {deal.title}
                                  </Typography>
                                  {deal.contact ? (
                                    <Typography variant="caption" color="textSecondary" noWrap>
                                      {deal.contact.name}
                                    </Typography>
                                  ) : null}
                                  <Box mt={0.5} display="flex" flexWrap="wrap" gap={0.5}>
                                    <Chip size="small" label={formatMoney(deal.value)} />
                                    <Chip
                                      size="small"
                                      label={i18n.t(`crm.deal.source.${deal.source || "manual"}`)}
                                      variant="outlined"
                                    />
                                    {deal.assignedUser ? (
                                      <Chip
                                        size="small"
                                        label={deal.assignedUser.name}
                                        variant="outlined"
                                      />
                                    ) : null}
                                  </Box>
                                  {deal.ticket ? (
                                    <>
                                      <Divider style={{ margin: "8px 0" }} />
                                      <Typography variant="caption" color="textSecondary" noWrap>
                                        #{deal.ticket.id} · {deal.ticket.lastMessage || "—"}
                                      </Typography>
                                    </>
                                  ) : null}
                                  <Box mt={0.5}>
                                    <Chip
                                      size="small"
                                      label={i18n.t(`crm.status.${deal.status || "open"}`)}
                                      color={
                                        deal.status === "won"
                                          ? "primary"
                                          : deal.status === "lost"
                                            ? "default"
                                            : "default"
                                      }
                                    />
                                  </Box>
                                </Box>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMenu(e, deal);
                                  }}
                                >
                                  <MoreVertIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </Paper>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </Box>
                  )}
                </Droppable>
              </Paper>
            );
          })}
        </Box>
      </DragDropContext>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            if (menuDeal) openEdit(menuDeal.id);
            closeMenu();
          }}
        >
          {i18n.t("crm.actions.edit")}
        </MenuItem>
        <MenuItem onClick={deleteDeal} style={{ color: "#c62828" }}>
          {i18n.t("crm.actions.delete")}
        </MenuItem>
      </Menu>

      <CrmDealFormDialog
        open={dialogOpen}
        onClose={closeDialog}
        dealId={editingDealId}
        defaults={
          editingDealId
            ? {}
            : {
                pipelineId: pipelineId ? Number(pipelineId) : undefined,
                stageId: stages[0]?.id,
              }
        }
        onSaved={() => loadDeals()}
      />
    </Box>
  );
}
