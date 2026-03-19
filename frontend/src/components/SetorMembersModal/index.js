import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  CircularProgress,
  Typography,
} from "@material-ui/core";
import PersonAddIcon from "@material-ui/icons/PersonAdd";
import PersonRemoveIcon from "@material-ui/icons/PersonRemove";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import ConfirmationModal from "../ConfirmationModal";

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
      onMembersChange?.();
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
      onMembersChange?.();
    } catch (err) {
      toastError(err);
    }
  };

  if (!queue) return null;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          Membros do setor: {queue.name}
        </DialogTitle>
        <DialogContent dividers>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
              <CircularProgress />
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Typography variant="body2" color="textSecondary">
                  {members.length} membro(s)
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  startIcon={<PersonAddIcon />}
                  onClick={handleOpenAddModal}
                >
                  Adicionar usuário
                </Button>
              </div>
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
                          <PersonRemoveIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="primary">
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addModalOpen} onClose={() => setAddModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Adicionar usuário ao setor</DialogTitle>
        <DialogContent dividers>
          {loadingUsers ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
              <CircularProgress />
            </div>
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddModalOpen(false)}>Cancelar</Button>
        </DialogActions>
      </Dialog>

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
