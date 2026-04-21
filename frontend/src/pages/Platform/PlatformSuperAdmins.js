import React, { useCallback, useContext, useEffect, useState } from "react";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import MenuItem from "@material-ui/core/MenuItem";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import Chip from "@material-ui/core/Chip";
import { makeStyles } from "@material-ui/core/styles";

import MainContainer from "../../components/MainContainer";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import { AppPageHeader, AppSectionCard, AppPrimaryButton, AppSecondaryButton, AppNeutralButton } from "../../ui";
import { AuthContext } from "../../context/Auth/AuthContext";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  heading: { fontWeight: 600, fontSize: "1.0625rem", marginBottom: theme.spacing(1) },
  tableHead: {
    fontWeight: 600,
    fontSize: "0.7rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: theme.palette.text.secondary,
  },
}));

export default function PlatformSuperAdmins() {
  const classes = useStyles();
  const { user: authUser } = useContext(AuthContext);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [editing, setEditing] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    profile: "admin",
    super: true,
    password: "",
    companyId: "",
  });

  const initialCreateForm = () => ({
    name: "",
    email: "",
    profile: "admin",
    super: true,
    password: "",
    companyId: "",
  });
  const [createForm, setCreateForm] = useState(initialCreateForm);

  const loadCompanies = useCallback(async () => {
    try {
      const { data } = await api.get("/companies/list");
      setCompanies(Array.isArray(data) ? data : []);
    } catch (e) {
      toastError(e);
      setCompanies([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/platform/super-admins");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toastError(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const runSearch = async (q) => {
    const t = q.trim();
    if (t.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data } = await api.get("/platform/super-admins/search", { params: { q: t } });
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (e) {
      toastError(e);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => runSearch(search), 350);
    return () => clearTimeout(id);
  }, [search]);

  const openCreate = () => {
    setCreateForm(initialCreateForm());
    setCreateOpen(true);
  };

  const saveCreate = async () => {
    const pwd = createForm.password?.trim() || "";
    if (
      !createForm.name?.trim() ||
      !createForm.email?.trim() ||
      pwd.length < 5
    ) {
      toast.error(i18n.t("platform.superAdmins.toastCreateValidation"));
      return;
    }
    if (!createForm.super && (createForm.companyId === "" || createForm.companyId == null)) {
      toast.error(i18n.t("platform.superAdmins.toastCompanyRequiredNonSuper"));
      return;
    }
    /** String vazia garante a chave no JSON (alguns proxies/libs removem `null`). */
    const companyIdPayload = createForm.super
      ? createForm.companyId === "" || createForm.companyId == null
        ? ""
        : Number(createForm.companyId)
      : Number(createForm.companyId);
    try {
      await api.post("/platform/super-admins", {
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        password: pwd,
        profile: createForm.profile,
        super: createForm.super,
        companyId: companyIdPayload,
      });
      toast.success(i18n.t("platform.superAdmins.toastCreated"));
      setCreateOpen(false);
      setCreateForm(initialCreateForm());
      await load();
    } catch (e) {
      toastError(e);
    }
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name || "",
      email: row.email || "",
      profile: row.profile || "admin",
      super: row.super !== false,
      password: "",
      companyId:
        row.companyId != null && row.companyId !== ""
          ? String(row.companyId)
          : "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (
      editing.id === authUser?.id &&
      form.super === false &&
      !window.confirm(i18n.t("platform.superAdmins.confirmDemoteSelf"))
    ) {
      return;
    }
    if (!form.super && (form.companyId === "" || form.companyId == null)) {
      toast.error(i18n.t("platform.superAdmins.toastCompanyRequiredNonSuper"));
      return;
    }

    const companyIdPayload = form.super
      ? form.companyId === "" || form.companyId == null
        ? ""
        : Number(form.companyId)
      : Number(form.companyId);

    try {
      await api.put(`/platform/super-admins/${editing.id}`, {
        name: form.name,
        email: form.email,
        profile: form.profile,
        super: form.super,
        companyId: companyIdPayload,
        ...(form.password?.trim() ? { password: form.password.trim() } : {}),
      });
      toast.success(i18n.t("platform.superAdmins.toastSaved"));
      setEditOpen(false);
      setEditing(null);
      await load();
      if (editing.id === authUser?.id) {
        try {
          await api.post("/auth/refresh_token");
        } catch {
          /* ignore */
        }
        window.location.reload();
      }
    } catch (e) {
      toastError(e);
    }
  };

  const promoteUser = async (u) => {
    try {
      await api.put(`/platform/super-admins/${u.id}`, { super: true });
      toast.success(i18n.t("platform.superAdmins.toastPromoted"));
      setPromoteOpen(false);
      setSearch("");
      setSearchResults([]);
      await load();
    } catch (e) {
      toastError(e);
    }
  };

  const header = (
    <>
      <Typography variant="overline" color="textSecondary" display="block" style={{ letterSpacing: "0.06em", marginBottom: 4 }}>
        {i18n.t("platform.shell.eyebrow")}
      </Typography>
      <Typography variant="h5" component="h1" color="primary" style={{ fontWeight: 600 }}>
        {i18n.t("platform.superAdmins.title")}
      </Typography>
    </>
  );

  const subtitle = (
    <Typography variant="body2" color="textSecondary" component="p" style={{ margin: 0 }}>
      {i18n.t("platform.superAdmins.subtitle")}
    </Typography>
  );

  return (
    <MainContainer>
      <Box display="flex" flexDirection="column" style={{ gap: 24 }}>
        <AppPageHeader
          title={header}
          subtitle={subtitle}
          actions={
            <Box display="flex" alignItems="center" style={{ gap: 8, flexWrap: "wrap" }}>
              <AppSecondaryButton onClick={openCreate}>
                {i18n.t("platform.superAdmins.createAction")}
              </AppSecondaryButton>
              <AppPrimaryButton onClick={() => setPromoteOpen(true)}>
                {i18n.t("platform.superAdmins.promoteAction")}
              </AppPrimaryButton>
            </Box>
          }
        />

        <AppSectionCard>
          <Typography className={classes.heading} component="h2">
            {i18n.t("platform.superAdmins.tableTitle")}
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell className={classes.tableHead}>{i18n.t("platform.superAdmins.colName")}</TableCell>
                <TableCell className={classes.tableHead}>{i18n.t("platform.superAdmins.colEmail")}</TableCell>
                <TableCell className={classes.tableHead}>{i18n.t("platform.superAdmins.colSuper")}</TableCell>
                <TableCell className={classes.tableHead}>{i18n.t("platform.superAdmins.colCompany")}</TableCell>
                <TableCell className={classes.tableHead}>{i18n.t("platform.superAdmins.colProfile")}</TableCell>
                <TableCell className={classes.tableHead}>{i18n.t("platform.superAdmins.colOnline")}</TableCell>
                <TableCell className={classes.tableHead} align="right">
                  {i18n.t("platform.superAdmins.colActions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7}>…</TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.name || "—"}</TableCell>
                    <TableCell>{row.email || "—"}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={row.super ? i18n.t("platform.superAdmins.yes") : i18n.t("platform.superAdmins.no")}
                        color={row.super ? "primary" : "default"}
                      />
                    </TableCell>
                    <TableCell>
                      {row.super && (row.companyId == null || row.companyId === "")
                        ? i18n.t("platform.superAdmins.companySaaSOnly")
                        : row.company?.name || "—"}
                    </TableCell>
                    <TableCell>{row.profile || "—"}</TableCell>
                    <TableCell>{row.online ? i18n.t("users.online.yes") : i18n.t("users.online.no")}</TableCell>
                    <TableCell align="right">
                      <AppSecondaryButton size="small" onClick={() => openEdit(row)}>
                        {i18n.t("platform.superAdmins.edit")}
                      </AppSecondaryButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </AppSectionCard>
      </Box>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{i18n.t("platform.superAdmins.createTitle")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" style={{ marginTop: 4 }}>
            {i18n.t("platform.superAdmins.subtitle")}
          </Typography>
          <Grid container spacing={2} style={{ marginTop: 8 }}>
            <Grid item xs={12}>
              <TextField
                label={i18n.t("platform.superAdmins.fieldName")}
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                fullWidth
                variant="outlined"
                margin="dense"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={i18n.t("platform.superAdmins.fieldEmail")}
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                fullWidth
                variant="outlined"
                margin="dense"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                label={i18n.t("platform.superAdmins.fieldProfile")}
                value={createForm.profile}
                onChange={(e) => setCreateForm((f) => ({ ...f, profile: e.target.value }))}
                fullWidth
                variant="outlined"
                margin="dense"
              >
                <MenuItem value="admin">admin</MenuItem>
                <MenuItem value="user">user</MenuItem>
                <MenuItem value="supervisor">supervisor</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={createForm.super}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, super: e.target.checked }))
                    }
                    color="primary"
                  />
                }
                label={i18n.t("platform.superAdmins.fieldSuper")}
              />
              {!createForm.super ? (
                <Typography variant="caption" color="textSecondary" display="block" style={{ marginTop: 4 }}>
                  {i18n.t("platform.superAdmins.createNonSuperNote")}
                </Typography>
              ) : null}
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                label={i18n.t("platform.superAdmins.fieldCompany")}
                value={createForm.companyId}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, companyId: e.target.value }))
                }
                fullWidth
                variant="outlined"
                margin="dense"
                required={!createForm.super}
                disabled={!companies.length}
                helperText={
                  createForm.super
                    ? i18n.t("platform.superAdmins.companyHintSuper")
                    : i18n.t("platform.superAdmins.companyHintNonSuper")
                }
              >
                {createForm.super ? (
                  <MenuItem value="">
                    <em>{i18n.t("platform.superAdmins.companyNoneOption")}</em>
                  </MenuItem>
                ) : (
                  <MenuItem value="">
                    <em>{i18n.t("platform.superAdmins.companySelectPlaceholder")}</em>
                  </MenuItem>
                )}
                {companies.map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={i18n.t("platform.superAdmins.fieldPasswordCreate")}
                value={createForm.password}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, password: e.target.value }))
                }
                fullWidth
                variant="outlined"
                margin="dense"
                type="password"
                required
                helperText={i18n.t("platform.superAdmins.passwordCreateHint")}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <AppNeutralButton onClick={() => setCreateOpen(false)}>
            {i18n.t("platform.superAdmins.cancel")}
          </AppNeutralButton>
          <AppPrimaryButton onClick={saveCreate}>
            {i18n.t("platform.superAdmins.createSave")}
          </AppPrimaryButton>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{i18n.t("platform.superAdmins.editTitle")}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} style={{ marginTop: 4 }}>
            <Grid item xs={12}>
              <TextField
                label={i18n.t("platform.superAdmins.fieldName")}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                fullWidth
                variant="outlined"
                margin="dense"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={i18n.t("platform.superAdmins.fieldEmail")}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                fullWidth
                variant="outlined"
                margin="dense"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                label={i18n.t("platform.superAdmins.fieldProfile")}
                value={form.profile}
                onChange={(e) => setForm((f) => ({ ...f, profile: e.target.value }))}
                fullWidth
                variant="outlined"
                margin="dense"
              >
                <MenuItem value="admin">admin</MenuItem>
                <MenuItem value="user">user</MenuItem>
                <MenuItem value="supervisor">supervisor</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.super}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, super: e.target.checked }))
                    }
                    color="primary"
                  />
                }
                label={i18n.t("platform.superAdmins.fieldSuper")}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                label={i18n.t("platform.superAdmins.fieldCompany")}
                value={form.companyId}
                onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}
                fullWidth
                variant="outlined"
                margin="dense"
                required={!form.super}
                disabled={!companies.length}
                helperText={
                  form.super
                    ? i18n.t("platform.superAdmins.companyHintSuper")
                    : i18n.t("platform.superAdmins.companyHintNonSuper")
                }
              >
                {form.super ? (
                  <MenuItem value="">
                    <em>{i18n.t("platform.superAdmins.companyNoneOption")}</em>
                  </MenuItem>
                ) : (
                  <MenuItem value="">
                    <em>{i18n.t("platform.superAdmins.companySelectPlaceholder")}</em>
                  </MenuItem>
                )}
                {companies.map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={i18n.t("platform.superAdmins.fieldPassword")}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                fullWidth
                variant="outlined"
                margin="dense"
                type="password"
                helperText={i18n.t("platform.superAdmins.passwordHint")}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <AppNeutralButton onClick={() => setEditOpen(false)}>{i18n.t("platform.superAdmins.cancel")}</AppNeutralButton>
          <AppPrimaryButton onClick={saveEdit}>{i18n.t("platform.superAdmins.save")}</AppPrimaryButton>
        </DialogActions>
      </Dialog>

      <Dialog open={promoteOpen} onClose={() => setPromoteOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{i18n.t("platform.superAdmins.promoteTitle")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" paragraph>
            {i18n.t("platform.superAdmins.promoteHint")}
          </Typography>
          <TextField
            fullWidth
            variant="outlined"
            margin="dense"
            placeholder={i18n.t("platform.superAdmins.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Box mt={2}>
            {searching ? (
              <Typography variant="body2">…</Typography>
            ) : (
              searchResults.map((u) => (
                <Box
                  key={u.id}
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  py={1}
                  style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}
                >
                  <Box>
                    <Typography variant="body2" style={{ fontWeight: 600 }}>
                      {u.name} · {u.email}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {u.company?.name || "—"} · {u.super ? i18n.t("platform.superAdmins.alreadySuper") : ""}
                    </Typography>
                  </Box>
                  <AppSecondaryButton
                    size="small"
                    disabled={u.super}
                    onClick={() => promoteUser(u)}
                  >
                    {i18n.t("platform.superAdmins.promote")}
                  </AppSecondaryButton>
                </Box>
              ))
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <AppNeutralButton onClick={() => setPromoteOpen(false)}>{i18n.t("platform.superAdmins.close")}</AppNeutralButton>
        </DialogActions>
      </Dialog>
    </MainContainer>
  );
}
