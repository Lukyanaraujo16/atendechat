import React from "react";
import { useHistory, useParams, useLocation } from "react-router-dom";
import Box from "@material-ui/core/Box";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";
import { makeStyles } from "@material-ui/core/styles";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import AiAgentWizard from "../../components/AiAgentWizard";
import { i18n } from "../../translate/i18n";
import { AI_AGENT_ROUTE_PATH } from "../../config/aiAgentFeature";

const useStyles = makeStyles((theme) => ({
  subtitle: {
    marginTop: theme.spacing(0.5),
    color: theme.palette.text.secondary,
  },
  backButton: {
    marginRight: theme.spacing(1),
  },
}));

/**
 * Wizard create (/ai-agent/new|/ai-agent/wizard) ou edit (/ai-agent/:agentRef/wizard).
 */
export default function AiAgentWizardPage() {
  const classes = useStyles();
  const history = useHistory();
  const location = useLocation();
  const { agentRef: rawRef, agentId: legacyId } = useParams();
  const agentRef = String(rawRef || legacyId || "").trim();
  const isCreateRoute =
    location.pathname === "/ai-agent/new" ||
    (location.pathname === "/ai-agent/wizard" && !agentRef);
  const mode = isCreateRoute ? "create" : agentRef ? "edit" : "create";

  return (
    <MainContainer>
      <MainHeader>
        <Box display="flex" alignItems="center">
          <IconButton
            className={classes.backButton}
            onClick={() => history.push(AI_AGENT_ROUTE_PATH)}
            aria-label={i18n.t("aiAgent.wizard.buttons.backToList")}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Title>
              {mode === "edit"
                ? i18n.t("aiAgent.wizard.pageTitleEdit")
                : i18n.t("aiAgent.wizard.pageTitleCreate")}
            </Title>
            <Typography variant="body2" className={classes.subtitle}>
              {i18n.t("aiAgent.wizard.pageSubtitle")}
            </Typography>
          </Box>
        </Box>
      </MainHeader>

      <AiAgentWizard mode={mode} agentRef={agentRef || null} />
    </MainContainer>
  );
}
