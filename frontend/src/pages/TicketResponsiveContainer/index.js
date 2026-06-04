import React from "react";

import Tickets from "../TicketsCustom";
import TicketAdvanced from "../TicketsAdvanced";
import useIsMobile from "../../hooks/useIsMobile";

function TicketResponsiveContainer() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <TicketAdvanced />;
  }

  return <Tickets />;
}

export default TicketResponsiveContainer;
