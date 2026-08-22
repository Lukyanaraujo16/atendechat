import React from "react";
import { Badge } from "@material-ui/core";
import { i18n } from "../translate/i18n";

export function AttendanceUnreadMenuBadge({ count, children }) {
  const n = Number(count) || 0;
  return (
    <Badge
      color="error"
      badgeContent={n}
      max={99}
      invisible={n <= 0}
      overlap="rectangular"
      aria-label={
        n > 0
          ? i18n.t("mainDrawer.attendanceUnreadBadge", { count: n })
          : undefined
      }
    >
      {children}
    </Badge>
  );
}

export default AttendanceUnreadMenuBadge;
