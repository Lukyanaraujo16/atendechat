import React, { useState } from "react";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Chip from "@material-ui/core/Chip";
import Box from "@material-ui/core/Box";
import { i18n } from "../../translate/i18n";

const RATINGS = ["good", "bad", "neutral"];
const TAGS = [
  "invented_information",
  "too_long",
  "too_short",
  "wrong_tone",
  "should_call_human",
  "unnecessary_handoff",
  "useful",
  "other",
];

export default function SimulatorReviewDialog({ open, onClose, onSubmit, initialReview }) {
  const [rating, setRating] = useState(initialReview?.rating || "good");
  const [tags, setTags] = useState(initialReview?.tags || []);
  const [note, setNote] = useState(initialReview?.note || "");

  const toggleTag = (tag) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = () => {
    onSubmit({ rating, tags, note });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{i18n.t("aiAgent.simulator.review.title")}</DialogTitle>
      <DialogContent>
        <FormControl fullWidth margin="dense" variant="outlined">
          <InputLabel>{i18n.t("aiAgent.simulator.review.rating")}</InputLabel>
          <Select
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            label={i18n.t("aiAgent.simulator.review.rating")}
          >
            {RATINGS.map((item) => (
              <MenuItem key={item} value={item}>
                {i18n.t(`aiAgent.simulator.review.ratings.${item}`)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box mt={2} mb={1}>
          <Box display="flex" flexWrap="wrap" gridGap={8}>
            {TAGS.map((tag) => (
              <Chip
                key={tag}
                size="small"
                label={i18n.t(`aiAgent.simulator.review.tags.${tag}`)}
                color={tags.includes(tag) ? "primary" : "default"}
                onClick={() => toggleTag(tag)}
              />
            ))}
          </Box>
        </Box>
        <TextField
          fullWidth
          multiline
          minRows={2}
          margin="dense"
          variant="outlined"
          label={i18n.t("aiAgent.simulator.review.note")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{i18n.t("aiAgent.buttons.cancel")}</Button>
        <Button color="primary" variant="contained" onClick={handleSubmit}>
          {i18n.t("aiAgent.simulator.review.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
