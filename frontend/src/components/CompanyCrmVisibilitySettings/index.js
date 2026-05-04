import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";
import useCompanies from "../../hooks/useCompanies";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

const useStyles = makeStyles((theme) => ({
  root: { marginTop: theme.spacing(1) },
  actions: { marginTop: theme.spacing(2) },
}));

export default function CompanyCrmVisibilitySettings({ company, onSaved, canEdit }) {
  const classes = useStyles();
  const { updateCrmVisibility } = useCompanies();
  const [value, setValue] = useState(company?.crmVisibilityMode || "all");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(company?.crmVisibilityMode || "all");
  }, [company?.crmVisibilityMode, company?.id]);

  const handleSave = useCallback(async () => {
    if (!company?.id || !canEdit) return;
    setSaving(true);
    try {
      const updated = await updateCrmVisibility(company.id, value);
      toast.success(i18n.t("settings.company.crmVisibility.saved"));
      if (onSaved) onSaved(updated);
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  }, [company?.id, value, canEdit, updateCrmVisibility, onSaved]);

  if (!company?.id) return null;

  return (
    <Box className={classes.root}>
      <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
        {i18n.t("settings.company.crmVisibility.title")}
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph style={{ marginTop: 8 }}>
        {i18n.t("settings.company.crmVisibility.description")}
      </Typography>
      <FormControl component="fieldset" variant="standard" disabled={!canEdit}>
        <FormLabel component="legend">{i18n.t("settings.company.crmVisibility.label")}</FormLabel>
        <RadioGroup
          value={value}
          onChange={(e) => setValue(e.target.value)}
        >
          <FormControlLabel
            value="all"
            control={<Radio color="primary" />}
            label={i18n.t("settings.company.crmVisibility.optionAll")}
          />
          <FormControlLabel
            value="assigned"
            control={<Radio color="primary" />}
            label={i18n.t("settings.company.crmVisibility.optionAssigned")}
          />
        </RadioGroup>
      </FormControl>
      {canEdit ? (
        <Box className={classes.actions}>
          <Button
            variant="contained"
            color="primary"
            size="small"
            disabled={saving || value === (company.crmVisibilityMode || "all")}
            onClick={handleSave}
          >
            {i18n.t("settings.company.crmVisibility.save")}
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}
