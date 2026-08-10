import React, { useState, useEffect, createContext } from "react";
import { useHistory } from "react-router-dom";
import useIsMobile from "../../hooks/useIsMobile";

import { buildTicketConversationLocation } from "../../utils/ticketConversationRoute";

const TicketsContext = createContext();

/** Setter estável: consumidores não re-renderizam quando só `currentTicket` muda (ex.: lista de tickets). */
const TicketsSetContext = createContext();

const TicketsContextProvider = ({ children }) => {
	const [currentTicket, setCurrentTicket] = useState({ id: null, code: null });
	const [inboxSubTab, setInboxSubTab] = useState("open");
    const history = useHistory();
    const isMobile = useIsMobile();

    /** Desktop: seleção na lista atualiza a URL. Mobile: navegação explícita em TicketListItemCustom. */
    useEffect(() => {
        if (isMobile) return;
        if (currentTicket.id !== null && currentTicket.uuid) {
            history.push(
              buildTicketConversationLocation(currentTicket.uuid, { fromInbox: true })
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTicket, isMobile]);

	return (
		<TicketsSetContext.Provider value={setCurrentTicket}>
			<TicketsContext.Provider
				value={{
					currentTicket,
					setCurrentTicket,
					inboxSubTab,
					setInboxSubTab,
				}}
			>
				{children}
			</TicketsContext.Provider>
		</TicketsSetContext.Provider>
	);
};

export { TicketsContext, TicketsSetContext, TicketsContextProvider };
