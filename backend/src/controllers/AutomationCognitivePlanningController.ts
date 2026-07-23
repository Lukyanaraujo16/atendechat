import { Request, Response } from "express";
import AppError from "../errors/AppError";

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  return id;
}

export const dashboard = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetCognitivePlanningDashboardService } = await import(
    "../services/AutomationOrchestrator/cognitive/CognitivePlanningAdminServices"
  );
  return res.json(await GetCognitivePlanningDashboardService({ companyId }));
};

export const metrics = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetCognitivePlanningMetricsService } = await import(
    "../services/AutomationOrchestrator/cognitive/CognitivePlanningAdminServices"
  );
  return res.json(await GetCognitivePlanningMetricsService({ companyId }));
};

export const analyzeGoal = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const text = String(req.body?.text || req.body?.message || "").trim();
  if (!text) throw new AppError("ERR_VALIDATION_ERROR", 400, "text obrigatório.");
  const { AnalyzeGoalService } = await import(
    "../services/AutomationOrchestrator/cognitive/CognitivePlanningAdminServices"
  );
  return res.json(
    await AnalyzeGoalService({
      companyId,
      text,
      ticketId: req.body?.ticketId ? Number(req.body.ticketId) : undefined,
      contactId: req.body?.contactId ? Number(req.body.contactId) : undefined
    })
  );
};

export const generatePlan = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GeneratePlanService } = await import(
    "../services/AutomationOrchestrator/cognitive/CognitivePlanningAdminServices"
  );
  return res.json(
    await GeneratePlanService({
      companyId,
      text: req.body?.text || req.body?.message,
      goal: req.body?.goal
    })
  );
};

export const dependencies = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { InspectDependenciesService } = await import(
    "../services/AutomationOrchestrator/cognitive/CognitivePlanningAdminServices"
  );
  return res.json(
    await InspectDependenciesService({
      companyId,
      planId: req.body?.planId || req.query?.planId,
      text: req.body?.text || (req.query?.text as string)
    })
  );
};

export const validate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { SimulateValidationService } = await import(
    "../services/AutomationOrchestrator/cognitive/CognitivePlanningAdminServices"
  );
  return res.json(
    await SimulateValidationService({
      companyId,
      text: req.body?.text,
      planId: req.body?.planId,
      outcomes: req.body?.outcomes
    })
  );
};

export const recovery = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { SimulateRecoveryService } = await import(
    "../services/AutomationOrchestrator/cognitive/CognitivePlanningAdminServices"
  );
  return res.json(
    await SimulateRecoveryService({
      companyId,
      text: req.body?.text,
      outcomes: req.body?.outcomes
    })
  );
};

export const replay = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const text = String(req.body?.text || "").trim();
  if (!text) throw new AppError("ERR_VALIDATION_ERROR", 400, "text obrigatório.");
  const { ReplayPlanService } = await import(
    "../services/AutomationOrchestrator/cognitive/CognitivePlanningAdminServices"
  );
  return res.json(
    await ReplayPlanService({
      companyId,
      text,
      ticketId: req.body?.ticketId ? Number(req.body.ticketId) : undefined,
      contactId: req.body?.contactId ? Number(req.body.contactId) : undefined,
      simulatedOutcomes: req.body?.simulatedOutcomes || req.body?.outcomes
    })
  );
};

export const evaluate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { EvaluatePlanService } = await import(
    "../services/AutomationOrchestrator/cognitive/evaluation/PlanEvaluationAdminServices"
  );
  return res.json(
    await EvaluatePlanService({
      companyId,
      text: req.body?.text || req.body?.message,
      goal: req.body?.goal,
      plan: req.body?.plan
    })
  );
};

export const listEvaluations = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { ListPlanEvaluationsService } = await import(
    "../services/AutomationOrchestrator/cognitive/evaluation/PlanEvaluationAdminServices"
  );
  return res.json(
    await ListPlanEvaluationsService({
      companyId,
      limit: req.query?.limit ? Number(req.query.limit) : 20
    })
  );
};

export const showEvaluation = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = String(req.params.id || "");
  if (!id) throw new AppError("ERR_VALIDATION_ERROR", 400, "id obrigatório.");
  const { GetPlanEvaluationService } = await import(
    "../services/AutomationOrchestrator/cognitive/evaluation/PlanEvaluationAdminServices"
  );
  return res.json(await GetPlanEvaluationService({ companyId, id }));
};

export const evaluationDashboard = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetPlanEvaluationDashboardService } = await import(
    "../services/AutomationOrchestrator/cognitive/evaluation/PlanEvaluationAdminServices"
  );
  return res.json(
    await GetPlanEvaluationDashboardService({ companyId })
  );
};

export const evaluationConfig = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  if (req.method === "PUT" || req.method === "POST") {
    const { UpsertPlanEvaluationConfigService } = await import(
      "../services/AutomationOrchestrator/cognitive/evaluation/PlanEvaluationAdminServices"
    );
    return res.json(
      await UpsertPlanEvaluationConfigService({
        companyId,
        config: req.body?.config || req.body || {}
      })
    );
  }
  const { getPlanEvaluationConfig } = await import(
    "../services/AutomationOrchestrator/cognitive/evaluation/PlanEvaluationConfig"
  );
  return res.json({ config: getPlanEvaluationConfig(companyId) });
};

export const planDiff = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { DiffPlansService } = await import(
    "../services/AutomationOrchestrator/cognitive/evaluation/PlanEvaluationAdminServices"
  );
  return res.json(
    await DiffPlansService({
      companyId,
      previousText: req.body?.previousText,
      nextText: req.body?.nextText,
      previousPlan: req.body?.previousPlan,
      nextPlan: req.body?.nextPlan
    })
  );
};
