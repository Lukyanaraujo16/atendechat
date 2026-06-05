import React, { useState, useEffect } from "react";
import {
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  CircularProgress,
  Typography,
  Box,
  Button,
} from "@material-ui/core";
import PersonAddIcon from "@material-ui/icons/PersonAdd";
import RemoveCircleIcon from "@material-ui/icons/RemoveCircle";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import ConfirmationModal from "../ConfirmationModal";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
  AppPrimaryButton,
  AppSecondaryButton,
} from "../../ui";

const SetorMembersModal = ({ open, onClose, queue, onMembersChange }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState({ open: false, user: null });

  const fetchMembers = async () => {
    if (!queue?.id) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/queue/${queue.id}/users`);
      setMembers(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && queue?.id) {
      fetchMembers();
    }
  }, [open, queue?.id]);

  const handleOpenAddModal = async () => {
    setAddModalOpen(true);
    setLoadingUsers(true);
    try {
      const { data: allUsers } = await api.get("/users/list");
      const memberIds = members.map((m) => m.id);
      const available = allUsers.filter((u) => !memberIds.includes(u.id));
      setAvailableUsers(available);
    } catch (err) {
      toastError(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAddUser = async (user) => {
    try {
      const { data: fullUser } = await api.get(`/users/${user.id}`);
      const userQueueIds = fullUser.queues?.map((q) => q.id) || [];
      const newQueueIds = userQueueIds.includes(queue.id)
        ? userQueueIds
        : [...userQueueIds, queue.id];
      await api.put(`/users/${user.id}`, {
        name: fullUser.name,
        email: fullUser.email,
        profile: fullUser.profile,
        allTicket: fullUser.allTicket || "disabled",
        queueIds: newQueueIds,
      });
      toast.success(i18n.t("userModal.success"));
      setAddModalOpen(false);
      fetchMembers();
      if (typeof onMembersChange === "function") onMembersChange();
    } catch (err) {
      toastError(err);
    }
  };

  const handleRemoveUser = async (user) => {
    try {
      const { data: fullUser } = await api.get(`/users/${user.id}`);
      const userQueueIds = fullUser.queues?.map((q) => q.id) || [];
      const newQueueIds = userQueueIds.filter((id) => id !== queue.id);
      await api.put(`/users/${user.id}`, {
        name: fullUser.name,
        email: fullUser.email,
        profile: fullUser.profile,
        allTicket: fullUser.allTicket || "disabled",
        queueIds: newQueueIds,
      });
      toast.success(i18n.t("userModal.success"));
      setRemoveConfirm({ open: false, user: null });
      fetchMembers();
      if (typeof onMembersChange === "function") onMembersChange();
    } catch (err) {
      toastError(err);
    }
  };

  if (!queue) return null;

  return (
    <>
      <AppDialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <AppDialogTitle>
          Membros do setor: {queue.name}
        </AppDialogTitle>
        <AppDialogContent dividers>
          {loading ? (
            <Box display="flex" justifyContent="center" py={3}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Box
                display="flex"
                flexDirection={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", sm: "center" }}
                mb={2}
                gridGap={8}
              >
                <Typography variant="body2" color="textSecondary">
                  {members.length} membro(s)
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  fullWidth
                  startIcon={<PersonAddIcon />}
                  onClick={handleOpenAddModal}
                >
                  Adicionar usuário
                </Button>
              </Box>
              {members.length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                  Nenhum membro neste setor. Clique em "Adicionar usuário" para incluir.
                </Typography>
              ) : (
                <List dense>
                  {members.map((user) => (
                    <ListItem key={user.id}>
                      <ListItemText primary={user.name} secondary={user.email} />
                      <ListItemSecondaryAction>
                        <IconButton
                          size="small"
                          edge="end"
                          onClick={() => setRemoveConfirm({ open: true, user })}
                          aria-label="Remover"
                        >
                          <RemoveCircleIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </>
          )}
        </AppDialogContent>
        <AppDialogActions>
          <AppPrimaryButton onClick={onClose}>
            Fechar
          </AppPrimaryButton>
        </AppDialogActions>
      </AppDialog>

      <AppDialog open={addModalOpen} onClose={() => setAddModalOpen(false)} maxWidth="xs" fullWidth>
        <AppDialogTitle>Adicionar usuário ao setor</AppDialogTitle>
        <AppDialogContent dividers>
          {loadingUsers ? (
            <Box display="flex" justifyContent="center" py={3}>
              <CircularProgress />
            </Box>
          ) : availableUsers.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              Todos os usuários já estão neste setor.
            </Typography>
          ) : (
            <List dense>
              {availableUsers.map((user) => (
                <ListItem
                  key={user.id}
                  button
                  onClick={() => handleAddUser(user)}
                >
                  <ListItemText primary={user.name} secondary={user.email} />
                </ListItem>
              ))}
            </List>
          )}
        </AppDialogContent>
        <AppDialogActions>
          <AppSecondaryButton onClick={() => setAddModalOpen(false)}>
            Cancelar
          </AppSecondaryButton>
        </AppDialogActions>
      </AppDialog>

      <ConfirmationModal
        title={`Remover ${removeConfirm.user?.name} deste setor?`}
        open={removeConfirm.open}
        onClose={() => setRemoveConfirm({ open: false, user: null })}
        onConfirm={() => handleRemoveUser(removeConfirm.user)}
      >
        O usuário será removido do setor, mas continuará na empresa.
      </ConfirmationModal>
    </>
  );
};

export default SetorMembersModal;
