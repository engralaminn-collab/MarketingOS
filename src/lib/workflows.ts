// Manual workflow execution is deliberately limited to local, transactional
// operations. Event triggers, network actions, delays and background retries
// are not implemented; an unknown step must never be reported as successful.
export const EXECUTABLE_WORKFLOW_STEPS = ['log_activity', 'create_notification', 'email'] as const;
export type ExecutableWorkflowStep = (typeof EXECUTABLE_WORKFLOW_STEPS)[number];

export interface WorkflowStep {
  type: string;
  label?: string;
  config?: Record<string, unknown>;
}

export function readWorkflowSteps(value: unknown): { steps: WorkflowStep[]; error?: string } {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    return { steps: [], error: 'A workflow requires 1–20 steps.' };
  }
  if (JSON.stringify(value).length > 32_000) return { steps: [], error: 'Workflow steps exceed the size limit.' };
  const steps: WorkflowStep[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { steps: [], error: 'Every step must be an object.' };
    const step = item as Record<string, unknown>;
    if (typeof step.type !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(step.type)) return { steps: [], error: 'Each step must have a valid type.' };
    if (step.label !== undefined && (typeof step.label !== 'string' || step.label.length > 200)) return { steps: [], error: 'Step labels must be at most 200 characters.' };
    if (step.config !== undefined && (!step.config || typeof step.config !== 'object' || Array.isArray(step.config))) return { steps: [], error: 'Step config must be an object.' };
    steps.push({ type: step.type, ...(step.label !== undefined ? { label: step.label as string } : {}), ...(step.config !== undefined ? { config: step.config as Record<string, unknown> } : {}) });
  }
  return { steps };
}

export function parseStoredWorkflowSteps(raw: string): { steps: WorkflowStep[]; error?: string } {
  try {
    return readWorkflowSteps(JSON.parse(raw));
  } catch {
    return { steps: [], error: 'Stored workflow steps are not valid JSON.' };
  }
}

export function validateExecutableSteps(steps: WorkflowStep[]): string | null {
  for (let i = 0; i < steps.length; i++) {
    const { type, config = {} } = steps[i];
    if (!(EXECUTABLE_WORKFLOW_STEPS as readonly string[]).includes(type)) {
      return `Step ${i + 1} (${type}) is not implemented. No steps were executed.`;
    }
    const allowed = type === 'email' ? ['subject', 'body'] : type === 'create_notification' ? ['title', 'message', 'recipientId'] : ['description'];
    for (const [key, value] of Object.entries(config)) {
      if (!allowed.includes(key) || typeof value !== 'string' || value.length > (key === 'body' ? 100_000 : 2_000)) {
        return `Step ${i + 1} has an invalid ${key} setting. No steps were executed.`;
      }
    }
  }
  return null;
}
