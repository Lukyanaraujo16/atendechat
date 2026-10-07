import React from "react";
import { Box, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import { i18n } from "../../../translate/i18n";
import {
  SALE_WIZARD_ACTIVE_STEPS,
  saleWizardStepIndex,
} from "./saleWizardSteps";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "center",
    marginBottom: theme.spacing(2),
  },
  step: {
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.75, 1.25),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    color: theme.palette.text.secondary,
    fontSize: "0.875rem",
  },
  active: {
    borderColor: theme.palette.primary.main,
    color: theme.palette.primary.main,
    fontWeight: 600,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(0,0,0,0.03)",
  },
  done: {
    color: theme.palette.text.primary,
  },
  sep: {
    color: theme.palette.text.disabled,
    userSelect: "none",
  },
}));

const STEP_LABEL_KEYS = {
  customer: "inventorySales.sales.wizard.steps.customer",
  products: "inventorySales.sales.wizard.steps.products",
  payment: "inventorySales.sales.wizard.steps.payment",
  review: "inventorySales.sales.wizard.steps.review",
  delivery: "inventorySales.sales.wizard.steps.delivery",
};

export default function SaleWizardStepper({ currentStep }) {
  const classes = useStyles();
  const currentIdx = saleWizardStepIndex(currentStep);

  return (
    <Box className={classes.root} data-testid="sale-wizard-stepper" role="navigation">
      {SALE_WIZARD_ACTIVE_STEPS.map((stepId, index) => {
        const active = stepId === currentStep;
        const done = currentIdx > index;
        return (
          <React.Fragment key={stepId}>
            {index > 0 ? (
              <Typography className={classes.sep} aria-hidden>
                →
              </Typography>
            ) : null}
            <Box
              className={`${classes.step} ${active ? classes.active : ""} ${
                done ? classes.done : ""
              }`}
              aria-current={active ? "step" : undefined}
              data-testid={`sale-wizard-step-${stepId}`}
            >
              <span>
                {index + 1}. {i18n.t(STEP_LABEL_KEYS[stepId] || stepId)}
              </span>
            </Box>
          </React.Fragment>
        );
      })}
    </Box>
  );
}
