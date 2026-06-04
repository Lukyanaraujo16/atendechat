import { styled } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";

/** Wrapper legado; mobile usa layout flex direto em TicketsAdvanced. */
const TicketAdvancedLayout = styled(Paper)({
  display: "flex",
  flexDirection: "column",
  flex: 1,
  minHeight: 0,
  height: "100%",
  maxHeight: "100dvh",
  width: "100%",
  maxWidth: "100%",
  overflow: "hidden",
  boxShadow: "none",
  backgroundColor: "transparent",
  "@supports not (height: 100dvh)": {
    maxHeight: "100vh",
    height: "100vh",
  },
});

export default TicketAdvancedLayout;
