import { Calendar } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

/**
 * Calendário com arrastar/redimensionar (addon oficial do react-big-calendar).
 * Não requer react-dnd: o addon usa contexto e seleção próprios.
 */
const AgendaCalendarDnD = withDragAndDrop(Calendar);

export default AgendaCalendarDnD;
