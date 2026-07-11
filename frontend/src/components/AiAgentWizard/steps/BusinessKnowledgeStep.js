import React from "react";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import { AI_AGENT_PROFILE_LIMITS } from "../../../config/aiAgentProfileOptions";
import { createEmptyFaqItem } from "../aiAgentWizardDefaults";
import { i18n } from "../../../translate/i18n";

export default function BusinessKnowledgeStep({ formState, onChange, errors = {} }) {
  const handleField = (field) => (event) => {
    onChange({ [field]: event.target.value });
  };

  const updateFaq = (index, patch) => {
    const list = [...(formState.frequentlyAskedQuestions || [])];
    list[index] = { ...list[index], ...patch };
    onChange({ frequentlyAskedQuestions: list });
  };

  const addFaq = () => {
    const list = [...(formState.frequentlyAskedQuestions || [])];
    if (list.length >= AI_AGENT_PROFILE_LIMITS.faqMaxItems) return;
    list.push(createEmptyFaqItem());
    onChange({ frequentlyAskedQuestions: list });
  };

  const removeFaq = (index) => {
    const list = [...(formState.frequentlyAskedQuestions || [])];
    list.splice(index, 1);
    onChange({
      frequentlyAskedQuestions: list.length ? list : [createEmptyFaqItem()],
    });
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <TextField
          fullWidth
          multiline
          minRows={4}
          label={i18n.t("aiAgent.wizard.fields.productsAndServices")}
          value={formState.productsAndServices}
          onChange={handleField("productsAndServices")}
          helperText={i18n.t("aiAgent.wizard.hints.productsAndServices")}
        />
      </Grid>

      <Grid item xs={12}>
        <TextField
          fullWidth
          multiline
          minRows={3}
          label={i18n.t("aiAgent.wizard.fields.importantInformation")}
          value={formState.importantInformation}
          onChange={handleField("importantInformation")}
          helperText={i18n.t("aiAgent.wizard.hints.importantInformation")}
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label={i18n.t("aiAgent.wizard.fields.businessHours")}
          value={formState.businessHours}
          onChange={handleField("businessHours")}
        />
      </Grid>

      <Grid item xs={12}>
        <Typography variant="subtitle2" gutterBottom>
          {i18n.t("aiAgent.wizard.sections.faq")}
        </Typography>
        {(formState.frequentlyAskedQuestions || []).map((item, index) => (
          <Box
            key={`faq-${index}`}
            border={1}
            borderColor="divider"
            borderRadius={4}
            p={2}
            mb={2}
          >
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="body2" color="textSecondary">
                {i18n.t("aiAgent.wizard.labels.faqItem", { index: index + 1 })}
              </Typography>
              <IconButton size="small" onClick={() => removeFaq(index)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
            <TextField
              fullWidth
              label={i18n.t("aiAgent.wizard.fields.faqQuestion")}
              value={item.question}
              onChange={(event) => updateFaq(index, { question: event.target.value })}
              error={Boolean(errors[`faq_${index}`] || errors[`faq_${index}_question`])}
              style={{ marginBottom: 12 }}
            />
            <TextField
              fullWidth
              multiline
              minRows={2}
              label={i18n.t("aiAgent.wizard.fields.faqAnswer")}
              value={item.answer}
              onChange={(event) => updateFaq(index, { answer: event.target.value })}
              error={Boolean(errors[`faq_${index}`] || errors[`faq_${index}_answer`])}
            />
          </Box>
        ))}
        <Button
          variant="outlined"
          color="primary"
          onClick={addFaq}
          disabled={
            (formState.frequentlyAskedQuestions || []).length >=
            AI_AGENT_PROFILE_LIMITS.faqMaxItems
          }
        >
          {i18n.t("aiAgent.wizard.buttons.addFaq")}
        </Button>
      </Grid>
    </Grid>
  );
}
