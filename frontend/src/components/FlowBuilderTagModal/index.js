import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import {
  makeStyles,
  Button,
  MenuItem,
  Select,
} from "@material-ui/core";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
} from "../../ui";

import { Stack, CircularProgress } from "@mui/material";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
}));

const FlowBuilderTagModal = ({ open, onSave, data, onUpdate, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);
  const [activeModal, setActiveModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tags, setTags] = useState([]);
  const [selectedTag, setTagSelected] = useState("");

  useEffect(() => {
    if (open === "edit" || open === "create") {
      (async () => {
        setLoading(true);
        try {
          const { data: resData } = await api.get("/tags/list");
          const tagsList = Array.isArray(resData)
            ? resData
            : resData?.tags || resData?.records || [];
          setTags(tagsList);
          if (open === "edit" && data?.data) {
            const tag = tagsList.find(
              (item) => item.id === (data.data?.tag?.id ?? data.data?.id)
            );
            if (tag) setTagSelected(tag.id);
          } else {
            setTagSelected("");
          }
          setActiveModal(true);
        } catch (error) {
          toastError(error);
        } finally {
          setLoading(false);
        }
      })();
    }
    return () => {
      isMounted.current = false;
    };
  }, [open]);

  const handleClose = () => {
    close(null);
    setActiveModal(false);
  };

  const handleSave = () => {
    if (loading) {
      toast.error("Aguarde o carregamento das tags.");
      return;
    }
    const list = Array.isArray(tags) ? tags : [];
    if (list.length === 0) {
      toast.error("Nenhuma tag cadastrada. Crie tags no Kanban antes de usar este nó.");
      return;
    }
    if (!selectedTag) {
      toast.error("Selecione uma tag");
      return;
    }
    const tag = tags.find((item) => item.id === selectedTag);
    if (!tag) return;
    if (open === "edit") {
      onUpdate({ ...data, data: { tag } });
    } else {
      onSave({ data: { tag } });
    }
    handleClose();
  };

  return (
    <div className={classes.root}>
      <AppDialog open={activeModal} onClose={handleClose} fullWidth maxWidth="sm" scroll="paper">
        <AppDialogTitle>
          {open === "create" ? "Adicionar Tag Kanban" : "Editar Tag Kanban"}
        </AppDialogTitle>
        <Stack>
          <AppDialogContent dividers>
            {loading ? (
              <Stack alignItems="center" py={2}>
                <CircularProgress size={32} />
              </Stack>
            ) : (
              <Select
                value={selectedTag}
                style={{ width: "100%" }}
                onChange={(e) => setTagSelected(e.target.value)}
                displayEmpty
                renderValue={(v) => {
                  if (!v) return "Selecione uma tag";
                  const t = tags.find((w) => w.id === v);
                  return t ? t.name : "Selecione uma tag";
                }}
              >
                <MenuItem value="">
                  <em>Selecione uma tag</em>
                </MenuItem>
                {(Array.isArray(tags) ? tags : []).map((tag) => (
                  <MenuItem key={tag.id} value={tag.id}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        backgroundColor: tag.color || "#6366f1",
                        marginRight: 8,
                        verticalAlign: "middle",
                      }}
                    />
                    {tag.name}
                  </MenuItem>
                ))}
              </Select>
            )}
          </AppDialogContent>
          <AppDialogActions>
            <Button onClick={handleClose} color="secondary" variant="outlined">
              {i18n.t("contactModal.buttons.cancel")}
            </Button>
            <Button
              color="primary"
              variant="contained"
              onClick={handleSave}
              disabled={loading}
            >
              {open === "create" ? "Adicionar" : "Editar"}
            </Button>
          </AppDialogActions>
        </Stack>
      </AppDialog>
    </div>
  );
};

export default FlowBuilderTagModal;
