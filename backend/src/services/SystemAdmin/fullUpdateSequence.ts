import { isSystemUpdateAction, SystemUpdateAction } from "./SafeCommandRunner";

export const FULL_UPDATE_JOB_ACTION = "full_update" as const;

export type SystemUpdateJobAction = SystemUpdateAction | typeof FULL_UPDATE_JOB_ACTION;

export type FullUpdateStepDef = {
  action: SystemUpdateAction;
  stepLabel: string;
};

/** Sequência fixa — não aceita input do frontend. */
export const FULL_UPDATE_SEQUENCE: FullUpdateStepDef[] = [
  { action: "git_status", stepLabel: "Git status" },
  { action: "git_pull", stepLabel: "Git pull --ff-only" },
  { action: "backend_npm_install", stepLabel: "npm install (backend)" },
  { action: "backend_build", stepLabel: "npm run build (backend)" },
  { action: "backend_migrate", stepLabel: "npm run db:migrate (backend)" },
  { action: "frontend_npm_install", stepLabel: "npm install (frontend)" },
  { action: "frontend_build", stepLabel: "npm run build (frontend)" },
  { action: "backend_restart", stepLabel: "Restart backend" }
];

export function isSystemUpdateJobAction(value: string): value is SystemUpdateJobAction {
  return value === FULL_UPDATE_JOB_ACTION || isSystemUpdateAction(value);
}
