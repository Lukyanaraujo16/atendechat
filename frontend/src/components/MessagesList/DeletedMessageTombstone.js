import React from "react";
import { Block } from "@material-ui/icons";
import { i18n } from "../../translate/i18n";

export function DeletedMessageTombstone({ className, iconClassName }) {
  return (
    <span
      className={className || "message-deleted"}
      data-testid="deleted-message-tombstone"
    >
      {i18n.t("messagesList.messageDeleted")}
      &nbsp;
      <Block color="disabled" fontSize="small" className={iconClassName} />
    </span>
  );
}

export default DeletedMessageTombstone;
