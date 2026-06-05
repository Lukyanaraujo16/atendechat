import React from "react";
import Button from "@material-ui/core/Button";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
} from "../../ui";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import Typography from "@material-ui/core/Typography";

import { i18n } from "../../translate/i18n";

export default function CrmOpenDealsChoiceDialog({
  open,
  onClose,
  deals = [],
  onSelectDeal,
  onCreateNew,
}) {
  return (
    <AppDialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <AppDialogTitle>{i18n.t("crm.ticket.existingOpenTitle")}</AppDialogTitle>
      <AppDialogContent>
        <Typography variant="body2" color="textSecondary" paragraph>
          {i18n.t("crm.ticket.duplicateHint")}
        </Typography>
        <List dense>
          {deals.map((d) => (
            <ListItem
              button
              key={d.id}
              onClick={() => onSelectDeal(d.id)}
            >
              <ListItemText
                primary={d.title || "—"}
                secondary={d.stage?.name || d.pipeline?.name || ""}
              />
            </ListItem>
          ))}
        </List>
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={onClose} color="default">
          {i18n.t("crm.common.cancel")}
        </Button>
        <Button onClick={onCreateNew} color="primary">
          {i18n.t("crm.ticket.createNewAnyway")}
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
}
