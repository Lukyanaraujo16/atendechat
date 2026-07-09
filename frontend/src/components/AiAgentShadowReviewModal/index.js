import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Chip,
  Box,
  CircularProgress,
} from "@material-ui/core";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import { upsertAiAgentShadowSuggestionReview } from "../../services/aiAgentApi";
import {
  REVIEW_RATING_OPTIONS,
  REVIEW_TAG_OPTIONS,
} from "../../config/aiAgentShadowObservability";

const AiAgentShadowReviewModal = ({ open, onClose, row, onSaved }) => {
  const [rating, setRating] = useState("good");
  const [tags, setTags] = useState([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !row) return;
    setRating(row.review?.rating || "good");
    setTags(Array.isArray(row.review?.tags) ? row.review.tags : []);
    setNote(row.review?.note || "");
  }, [open, row]);

  const handleSubmit = async () => {
    if (!row?.id) return;
    setSubmitting(true);
    try {
      await upsertAiAgentShadowSuggestionReview(row.id, { rating, tags, note: note.trim() || null });
      toast.success(i18n.t("aiAgent.shadowSection.review.toastSaved"));
      onSaved();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>{i18n.t("aiAgent.shadowSection.review.title")}</DialogTitle>
      <DialogContent dividers>
        <FormControl fullWidth variant="outlined" margin="dense">
          <InputLabel>{i18n.t("aiAgent.shadowSection.review.ratingLabel")}</InputLabel>
          <Select
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            label={i18n.t("aiAgent.shadowSection.review.ratingLabel")}
          >
            {REVIEW_RATING_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {i18n.t(opt.labelKey)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth variant="outlined" margin="dense">
          <InputLabel>{i18n.t("aiAgent.shadowSection.review.tagsLabel")}</InputLabel>
          <Select
            multiple
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            label={i18n.t("aiAgent.shadowSection.review.tagsLabel")}
            renderValue={(selected) => (
              <Box display="flex" flexWrap="wrap" gridGap={4}>
                {selected.map((value) => {
                  const opt = REVIEW_TAG_OPTIONS.find((item) => item.value === value);
                  return (
                    <Chip
                      key={value}
                      size="small"
                      label={opt ? i18n.t(opt.labelKey) : value}
                    />
                  );
                })}
              </Box>
            )}
          >
            {REVIEW_TAG_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {i18n.t(opt.labelKey)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          fullWidth
          multiline
          rows={3}
          variant="outlined"
          margin="dense"
          label={i18n.t("aiAgent.shadowSection.review.noteLabel")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          {i18n.t("aiAgent.buttons.cancel")}
        </Button>
        <Button color="primary" variant="contained" onClick={handleSubmit} disabled={submitting}>
          {submitting ? <CircularProgress size={20} /> : i18n.t("aiAgent.buttons.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AiAgentShadowReviewModal;
