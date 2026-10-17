import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@material-ui/core";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import Alert from "@material-ui/lab/Alert";
import SearchIcon from "@material-ui/icons/Search";
import EditOutlined from "@material-ui/icons/EditOutlined";
import LockOutlined from "@material-ui/icons/LockOutlined";
import ExitToApp from "@material-ui/icons/ExitToApp";
import Block from "@material-ui/icons/Block";
import CheckCircleOutline from "@material-ui/icons/CheckCircleOutline";
import Tune from "@material-ui/icons/Tune";
import { toast } from "react-toastify";

import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import useCompanies from "../../../hooks/useCompanies";
import { useDate } from "../../../hooks/useDate";
import { SocketContext } from "../../../context/Socket/SocketContext";
import { i18n } from "../../../translate/i18n";
import ConfirmationModal from "../../../components/ConfirmationModal";
import ModalUsers from "../../../components/ModalUsers";
import {
  AppEmptyState,
  AppPrimaryButton,
  AppSecondaryButton,
  AppSectionCard,
} from "../../../ui";
import AppTableContainer from "../../../ui/components/AppTableContainer";
import {
  CompanyUserFormDialog,
  CompanyUserPasswordFormDialog,
  companyUserErrorMessage,
  profileLabel,
} from "./CompanyUserDialogs";

const useStyles = makeStyles((theme) => ({
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
  },
  search: {
    flex: "1 1 240px",
    minWidth: 200,
  },
  sectionTitle: {
    fontWeight: 600,
    fontSize: "1rem",
    marginBottom: theme.spacing(0.5),
  },
  actionsCell: {
    display: "flex",
    flexWrap: "nowrap",
    justifyContent: "flex-end",
    gap: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
    marginRight: theme.spacing(1),
  },
  nameCell: {
    minWidth: 160,
  },
}));

/**
 * Aba Usuários: gestão dos usuários da empresa via /saas/companies/:companyId/users.
 * Sem exclusão física (desativação). Trata 409 ERR_LAST_ADMIN.
 */
export default function TabUsuarios({ company }) {
  const classes = useStyles();
  const theme = useTheme();
  const { datetimeToClient } = useDate();
  const socketManager = useContext(SocketContext);
  const companyId = company?.id;
  const {
    listCompanyUsers,
    createCompanyUser,
    updateCompanyUser,
    setCompanyUserActive,
    setCompanyUserPassword,
  } = useCompanies();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [count, setCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [formUser, setFormUser] = useState(undefined); // undefined = fechado; null = novo
  const [passwordUser, setPasswordUser] = useState(null);
  const [toggleCtx, setToggleCtx] = useState(null);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [logoutUser, setLogoutUser] = useState(null);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [advancedUserId, setAdvancedUserId] = useState(null);

  const requestSeq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPageNumber(1);
  }, [debouncedSearch]);

  const refresh = useCallback(() => {
    setPageNumber(1);
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!companyId) return undefined;
    let alive = true;
    const seq = ++requestSeq.current;
    setLoading(true);
    listCompanyUsers(companyId, { searchParam: debouncedSearch, pageNumber })
      .then((data) => {
        if (!alive || seq !== requestSeq.current) return;
        const page = Array.isArray(data?.users) ? data.users : [];
        setUsers((prev) => (pageNumber === 1 ? page : [...prev, ...page.filter((u) => !prev.some((p) => p.id === u.id))]));
        setCount(Number(data?.count) || 0);
        setHasMore(Boolean(data?.hasMore));
        setLoadError(null);
      })
      .catch((err) => {
        if (!alive || seq !== requestSeq.current) return;
        setLoadError(
          err?.response?.status === 404 && !err?.response?.data?.error
            ? "O serviço de usuários da empresa ainda não está disponível neste servidor."
            : "Não foi possível carregar os usuários da empresa."
        );
        toastError(err);
      })
      .finally(() => {
        if (alive && seq === requestSeq.current) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [companyId, debouncedSearch, pageNumber, reloadKey, listCompanyUsers]);

  const patchUser = useCallback((userId, patch) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...patch } : u)));
  }, []);

  /* Atualização em tempo real (online/ativo), como no formulário antigo. */
  useEffect(() => {
    if (!companyId || !socketManager?.getSocket) return undefined;
    const cid = String(companyId);
    const socket = socketManager.getSocket(cid);
    const onUserEvent = (data) => {
      if (!data?.user?.id) return;
      if (data.action === "update") {
        patchUser(data.user.id, {
          name: data.user.name,
          email: data.user.email,
          profile: data.user.profile,
          active: data.user.active !== false,
          online: data.user.online === true,
        });
      }
    };
    socket.on(`company-${cid}-user`, onUserEvent);
    return () => {
      socket.off(`company-${cid}-user`, onUserEvent);
    };
  }, [companyId, socketManager, patchUser]);

  const handleApiError = (err) => {
    const msg = companyUserErrorMessage(err);
    if (msg) {
      toast.error(msg);
      if (err?.response?.data?.error === "ERR_USER_NOT_FOUND") refresh();
    } else {
      toastError(err);
    }
  };

  const handleSubmitUser = async (values) => {
    const isEdit = Boolean(formUser?.id);
    try {
      if (isEdit) {
        const payload = {};
        ["name", "email", "profile"].forEach((k) => {
          const v = String(values[k] || "").trim();
          if (v !== String(formUser[k] || "")) payload[k] = v;
        });
        if (!Object.keys(payload).length) {
          setFormUser(undefined);
          return;
        }
        const saved = await updateCompanyUser(companyId, formUser.id, payload);
        patchUser(formUser.id, saved && saved.id ? saved : payload);
        toast.success("Usuário atualizado.");
      } else {
        await createCompanyUser(companyId, {
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
          profile: values.profile,
        });
        toast.success("Usuário criado.");
        refresh();
      }
      setFormUser(undefined);
    } catch (err) {
      handleApiError(err);
    }
  };

  const handleSubmitPassword = async (password) => {
    if (!passwordUser) return;
    try {
      await setCompanyUserPassword(companyId, passwordUser.id, password);
      toast.success("Senha definida. O usuário deverá trocá-la no próximo acesso.");
      setPasswordUser(null);
    } catch (err) {
      handleApiError(err);
    }
  };

  const handleConfirmToggle = async () => {
    if (!toggleCtx) return;
    const { user: target, nextActive } = toggleCtx;
    setToggleLoading(true);
    try {
      const data = await setCompanyUserActive(companyId, target.id, nextActive);
      patchUser(target.id, {
        active: data && typeof data.active === "boolean" ? data.active : nextActive,
        online: nextActive ? target.online : false,
      });
      toast.success(nextActive ? "Usuário ativado." : "Usuário desativado.");
      setToggleCtx(null);
    } catch (err) {
      handleApiError(err);
      setToggleCtx(null);
    } finally {
      setToggleLoading(false);
    }
  };

  /** Encerrar sessões: mantém a ação existente (PUT /users/:id { forceLogout }). */
  const handleConfirmLogout = async () => {
    if (!logoutUser) return;
    setLogoutLoading(true);
    try {
      const { data } = await api.put(`/users/${logoutUser.id}`, { forceLogout: true });
      toast.success(i18n.t("settings.company.form.usersForceLogoutSuccess"));
      patchUser(logoutUser.id, { online: data?.online === true });
      setLogoutUser(null);
    } catch (err) {
      toastError(err);
    } finally {
      setLogoutLoading(false);
    }
  };

  const busy = toggleLoading || logoutLoading;
  const primaryAdmin = company?.primaryAdmin;

  return (
    <Box display="flex" flexDirection="column" style={{ gap: 16 }}>
      <AppSectionCard>
        <Typography className={classes.sectionTitle} component="h2">
          Administrador principal
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {primaryAdmin
            ? `${primaryAdmin.name || "—"} (${primaryAdmin.email || "—"})`
            : i18n.t("settings.company.form.noPrimaryAdmin")}
        </Typography>
      </AppSectionCard>

      <AppSectionCard>
        <Typography className={classes.sectionTitle} component="h2">
          {i18n.t("settings.company.form.usersSectionTitle")}
          {count ? (
            <Typography component="span" variant="body2" color="textSecondary">
              {" "}
              ({count})
            </Typography>
          ) : null}
        </Typography>
        <Typography variant="body2" color="textSecondary" style={{ marginBottom: 12 }}>
          Crie, edite, ative/desative usuários e redefina senhas. Usuários não são excluídos —
          desative-os para bloquear o acesso.
        </Typography>

        <Box className={classes.toolbar}>
          <TextField
            className={classes.search}
            size="small"
            variant="outlined"
            placeholder="Buscar por nome ou e-mail"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
          <AppPrimaryButton type="button" onClick={() => setFormUser(null)}>
            {i18n.t("settings.company.form.usersNewButton")}
          </AppPrimaryButton>
        </Box>

        {loadError && !users.length ? (
          <Alert
            severity="error"
            action={
              <AppSecondaryButton size="small" onClick={refresh}>
                Tentar novamente
              </AppSecondaryButton>
            }
          >
            {loadError}
          </Alert>
        ) : loading && !users.length ? (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress size={32} />
          </Box>
        ) : !users.length ? (
          <AppEmptyState
            title={debouncedSearch ? "Nenhum usuário encontrado para a busca." : i18n.t("settings.company.form.usersEmpty")}
          />
        ) : (
          <AppTableContainer nested>
            <Table size="small" aria-label="Usuários da empresa">
              <TableHead>
                <TableRow>
                  <TableCell>{i18n.t("users.table.name")}</TableCell>
                  <TableCell>{i18n.t("users.table.profile")}</TableCell>
                  <TableCell>{i18n.t("settings.company.form.usersAccountStatus")}</TableCell>
                  <TableCell>{i18n.t("users.table.online")}</TableCell>
                  <TableCell>Criado em</TableCell>
                  <TableCell align="right">{i18n.t("users.table.actions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => {
                  const inactive = u.active === false;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className={classes.nameCell}>
                        <Typography variant="body2" style={{ fontWeight: 500 }}>
                          {u.name || "—"}
                          {u.super ? (
                            <Chip size="small" label="Super Admin" style={{ marginLeft: 6, height: 20 }} />
                          ) : null}
                        </Typography>
                        <Typography variant="caption" color="textSecondary" style={{ wordBreak: "break-all" }}>
                          {u.email || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={profileLabel(u.profile)}
                          color={u.profile === "admin" ? "primary" : "default"}
                          variant={u.profile === "admin" ? "default" : "outlined"}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={
                            inactive
                              ? i18n.t("settings.company.form.usersInactive")
                              : i18n.t("settings.company.form.usersActive")
                          }
                          color={inactive ? "default" : "primary"}
                          variant={inactive ? "outlined" : "default"}
                        />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <Box
                            className={classes.onlineDot}
                            style={{
                              backgroundColor: u.online ? theme.palette.success.main : theme.palette.grey[400],
                            }}
                            aria-hidden
                          />
                          <Typography variant="body2" color="textSecondary" component="span">
                            {u.online ? i18n.t("users.online.yes") : i18n.t("users.online.no")}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="textSecondary">
                          {u.createdAt ? datetimeToClient(u.createdAt) : "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box className={classes.actionsCell}>
                          <Tooltip title={i18n.t("users.buttons.edit")}>
                            <span>
                              <IconButton size="small" disabled={busy} onClick={() => setFormUser(u)} aria-label="Editar usuário">
                                <EditOutlined fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={i18n.t("settings.company.form.usersChangePasswordAction")}>
                            <span>
                              <IconButton size="small" disabled={busy} onClick={() => setPasswordUser(u)} aria-label="Trocar senha">
                                <LockOutlined fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={i18n.t("settings.company.form.usersForceLogoutAction")}>
                            <span>
                              <IconButton size="small" disabled={busy} onClick={() => setLogoutUser(u)} aria-label="Encerrar sessões">
                                {logoutLoading && logoutUser?.id === u.id ? (
                                  <CircularProgress size={18} />
                                ) : (
                                  <ExitToApp fontSize="small" />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Filas, permissões e configurações avançadas">
                            <span>
                              <IconButton size="small" disabled={busy} onClick={() => setAdvancedUserId(u.id)} aria-label="Configurações avançadas do usuário">
                                <Tune fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip
                            title={
                              inactive
                                ? i18n.t("settings.company.form.usersActivateAction")
                                : i18n.t("settings.company.form.usersDeactivateAction")
                            }
                          >
                            <span>
                              <IconButton
                                size="small"
                                disabled={busy}
                                onClick={() => setToggleCtx({ user: u, nextActive: inactive })}
                                aria-label={inactive ? "Ativar usuário" : "Desativar usuário"}
                              >
                                {toggleLoading && toggleCtx?.user?.id === u.id ? (
                                  <CircularProgress size={18} />
                                ) : inactive ? (
                                  <CheckCircleOutline fontSize="small" />
                                ) : (
                                  <Block fontSize="small" />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </AppTableContainer>
        )}

        {hasMore && users.length ? (
          <Box display="flex" justifyContent="center" mt={2}>
            <AppSecondaryButton
              type="button"
              disabled={loading}
              onClick={() => setPageNumber((p) => p + 1)}
            >
              {loading ? <CircularProgress size={18} /> : "Carregar mais"}
            </AppSecondaryButton>
          </Box>
        ) : null}
      </AppSectionCard>

      <CompanyUserFormDialog
        open={formUser !== undefined}
        user={formUser || null}
        onClose={() => setFormUser(undefined)}
        onSubmit={handleSubmitUser}
      />
      <CompanyUserPasswordFormDialog
        open={Boolean(passwordUser)}
        user={passwordUser}
        onClose={() => setPasswordUser(null)}
        onSubmit={handleSubmitPassword}
      />
      <ConfirmationModal
        title={
          toggleCtx?.nextActive
            ? i18n.t("settings.company.form.usersActivateTitle")
            : i18n.t("settings.company.form.usersDeactivateTitle")
        }
        open={Boolean(toggleCtx)}
        onClose={() => !toggleLoading && setToggleCtx(null)}
        onConfirm={handleConfirmToggle}
        loading={toggleLoading}
        asyncConfirm
        destructive={!toggleCtx?.nextActive}
        confirmText={
          toggleCtx?.nextActive
            ? i18n.t("settings.company.form.usersActivateAction")
            : i18n.t("settings.company.form.usersDeactivateAction")
        }
      >
        {toggleCtx?.nextActive
          ? i18n.t("settings.company.form.usersActivateMessage", {
              name: toggleCtx?.user?.name || toggleCtx?.user?.email,
            })
          : i18n.t("settings.company.form.usersDeactivateMessage", {
              name: toggleCtx?.user?.name || toggleCtx?.user?.email,
            })}
      </ConfirmationModal>
      <ConfirmationModal
        title={i18n.t("settings.company.form.usersForceLogoutTitle")}
        open={Boolean(logoutUser)}
        onClose={() => !logoutLoading && setLogoutUser(null)}
        onConfirm={handleConfirmLogout}
        loading={logoutLoading}
        asyncConfirm
        confirmText={i18n.t("settings.company.form.usersForceLogoutAction")}
      >
        {i18n.t("settings.company.form.usersForceLogoutMessage", {
          name: logoutUser?.name || logoutUser?.email,
        })}
      </ConfirmationModal>
      <ModalUsers
        userId={advancedUserId}
        companyId={companyId}
        open={Boolean(advancedUserId)}
        onClose={() => setAdvancedUserId(null)}
        onSaved={() => refresh()}
      />
    </Box>
  );
}
