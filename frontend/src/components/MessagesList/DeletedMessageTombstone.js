import React from "react";
import { Block } from "@material-ui/icons";
import { i18n } from "../../translate/i18n";

export function getDeletedMessageIndicatorLabel(fromMe) {
  if (fromMe) {
    return i18n.t("messagesList.messageDeleted");
  }
  return i18n.t("messagesList.messageDeletedByContact");
}

export function DeletedMessageTombstone({ className, iconClassName, fromMe }) {
  return (
    <span
      className={className || "message-deleted"}
      data-testid="deleted-message-tombstone"
    >
      <Block color="disabled" fontSize="small" className={iconClassName} />
      {getDeletedMessageIndicatorLabel(fromMe)}
    </span>
  );
}

export default DeletedMessageTombstone;
