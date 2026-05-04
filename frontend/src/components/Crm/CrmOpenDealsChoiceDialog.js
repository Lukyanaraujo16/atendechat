import React from "react";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
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
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{i18n.t("crm.ticket.existingOpenTitle")}</DialogTitle>
      <DialogContent>
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="default">
          {i18n.t("crm.common.cancel")}
        </Button>
        <Button onClick={onCreateNew} color="primary">
          {i18n.t("crm.ticket.createNewAnyway")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
