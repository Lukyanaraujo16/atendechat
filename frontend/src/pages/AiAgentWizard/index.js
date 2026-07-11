import React from "react";
import { useHistory, useParams } from "react-router-dom";
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

export default function AiAgentWizardPage() {
  const classes = useStyles();
  const history = useHistory();
  const { agentId } = useParams();
  const isEdit = Boolean(agentId);

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
              {isEdit
                ? i18n.t("aiAgent.wizard.pageTitleEdit")
                : i18n.t("aiAgent.wizard.pageTitleCreate")}
            </Title>
            <Typography variant="body2" className={classes.subtitle}>
              {i18n.t("aiAgent.wizard.pageSubtitle")}
            </Typography>
          </Box>
        </Box>
      </MainHeader>

      <AiAgentWizard agentId={agentId ? Number(agentId) : null} mode={isEdit ? "edit" : "create"} />
    </MainContainer>
  );
}
