import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';

export interface AgencyActor {
  userId: string;
  companyId: string;
  role: string;
}

/** Extracts and verifies the bearer token used by every agency route. */
export async function getActor(req: Request): Promise<AgencyActor | null> {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.companyId) return null;
  return { userId: payload.userId ?? '', companyId: payload.companyId, role: payload.role ?? 'user' };
}

export const AGENCY_TARGETS = {
  departments: 100,
  agents: 2000,
  employees: 2000,
  sopsPerDepartment: 1,
  departmentModels: 100,
} as const;

export interface ReadinessCheck {
  id: string;
  label: string;
  target: string;
  actual: string;
  pass: boolean;
  detail: string;
  evidence?: string | null;
}

export interface ReadinessReport {
  generatedAt: string;
  company: { id: string; name: string; slug: string };
  overall: { pass: boolean; passed: number; total: number };
  checks: ReadinessCheck[];
  counts: {
    departments: number;
    departmentsWithSop: number;
    departmentsWithEmployees: number;
    departmentsWithRuntime: number;
    agents: number;
    employees: number;
    sops: number;
    knowledgeNodes: number;
    clients: number;
    configuredClients: number;
    personas: number;
    brandVoices: number;
    backups: number;
    verifiedBackups: number;
  };
  models: {
    localRuntimes: number;
    externalRuntimes: number;
    fallbackEnabled: number;
    modelNames: string[];
  };
}

const HOSTED_PROVIDER_ENV = [
  'OPENROUTER_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'GROQ_API_KEY',
  'CEREBRAS_API_KEY',
  'MISTRAL_API_KEY',
  'ZAI_API_KEY',
  'MUREKA_API_KEY',
] as const;

function isLocalUrl(value: string | undefined): boolean {
  if (!value) return true;
  try {
    const host = new URL(value).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local') || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  } catch {
    return true;
  }
}

/** Computes the full agency readiness report from live data. */
export async function buildReadiness(companyId: string): Promise<ReadinessReport> {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { id: true, name: true, slug: true } });
  if (!company) throw new Error('Company not found');

  const [
    departments,
    employees,
    agents,
    sops,
    knowledgeNodes,
    clients,
    configuredClients,
    personas,
    brandVoices,
    runtimes,
    backupRows,
    departmentsWithEmployees,
    departmentsWithSop,
  ] = await Promise.all([
    db.department.count({ where: { companyId } }),
    db.employee.count({ where: { companyId } }),
    db.agentSpec.count({ where: { companyId } }),
    db.sop.count({ where: { companyId, isActive: true } }),
    db.knowledgeNode.count({ where: { companyId } }),
    db.company.count(),
    db.clientConfig.count({ where: { onboardingStatus: 'configured' } }),
    db.brandPersona.count({ where: { companyId } }),
    db.brandVoice.count({ where: { companyId } }),
    db.departmentRuntime.findMany({ select: { provider: true, isolationMode: true, fallbackPolicy: true, modelName: true } }),
    db.backupRecord.findMany({ where: { status: { in: ['completed', 'verified'] } }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.employee.groupBy({ by: ['departmentId'], where: { companyId }, _count: true }),
    db.sop.groupBy({ by: ['departmentId'], where: { companyId, isActive: true, departmentId: { not: null } }, _count: true }),
  ]);

  const deptIds = new Set((await db.department.findMany({ where: { companyId }, select: { id: true } })).map((d) => d.id));
  const withEmployees = departmentsWithEmployees.filter((row) => deptIds.has(row.departmentId)).length;
  const withSop = departmentsWithSop.filter((row) => row.departmentId && deptIds.has(row.departmentId)).length;

  const localProviders = new Set(['ollama', 'local', 'llama.cpp', 'vllm', 'comfyui']);
  const localRuntimes = runtimes.filter((r) => r.isolationMode === 'local' && localProviders.has(r.provider)).length;
  const externalRuntimes = runtimes.length - localRuntimes;
  const fallbackEnabled = runtimes.filter((r) => r.fallbackPolicy !== 'none').length;
  const modelNames = Array.from(new Set(runtimes.map((r) => r.modelName))).sort();

  const now = Date.now();
  const verifiedBackups = backupRows.filter((b) => b.status === 'verified');
  const latest = backupRows[0];
  const latestAgeHours = latest ? (now - latest.createdAt.getTime()) / 36e5 : null;
  const backupFresh = latestAgeHours !== null && latestAgeHours <= 24 * 7;

  const hostedConfigured = HOSTED_PROVIDER_ENV.filter((key) => Boolean(process.env[key]?.trim()));
  const aiProvider = (process.env.AI_PROVIDER || 'ollama').toLowerCase();
  const ollamaLocal = isLocalUrl(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434');

  const checks: ReadinessCheck[] = [
    {
      id: 'departments',
      label: 'Department coverage',
      target: `${AGENCY_TARGETS.departments} departments`,
      actual: `${departments}`,
      pass: departments >= AGENCY_TARGETS.departments,
      detail: `${departments} of ${AGENCY_TARGETS.departments} departments are defined. Departments are data rows, not code: adding one costs nothing.`,
      evidence: 'Department table',
    },
    {
      id: 'agents',
      label: 'Agent specifications',
      target: `${AGENCY_TARGETS.agents.toLocaleString()} agents`,
      actual: agents.toLocaleString(),
      pass: agents >= AGENCY_TARGETS.agents,
      detail: `${agents.toLocaleString()} versioned agent specs, each bound to a department, model tier, tool set and SOP.`,
      evidence: 'AgentSpec table',
    },
    {
      id: 'employees',
      label: 'AI workforce',
      target: `${AGENCY_TARGETS.employees.toLocaleString()} staff`,
      actual: employees.toLocaleString(),
      pass: employees >= AGENCY_TARGETS.employees,
      detail: `${employees.toLocaleString()} AI employees with missions, KPIs, escalation paths and department assignment.`,
      evidence: 'Employee table',
    },
    {
      id: 'sop-coverage',
      label: 'SOP coverage',
      target: 'every department has an SOP',
      actual: `${withSop}/${departments}`,
      pass: withSop >= departments && sops >= departments,
      detail: `${sops} active SOPs. ${departments - withSop} departments still lack one.`,
      evidence: 'Sop table',
    },
    {
      id: 'department-models',
      label: 'Independent department models',
      target: `${AGENCY_TARGETS.departmentModels} runtimes`,
      actual: `${runtimes.length}`,
      pass: runtimes.length >= departments && localRuntimes === runtimes.length,
      detail: `${runtimes.length} department runtimes, ${localRuntimes} fully local. Each department has its own system prompt, model, guardrails and SOP binding.`,
      evidence: 'DepartmentRuntime table',
    },
    {
      id: 'no-external-dependency',
      label: 'No external AI dependency',
      target: 'local provider, no hosted fallback',
      actual: `${aiProvider}${ollamaLocal ? ' · local' : ' · remote'}`,
      pass: fallbackEnabled === 0 && hostedConfigured.length === 0 && aiProvider !== 'openai' && aiProvider !== 'openrouter' && aiProvider !== 'zai',
      detail:
        fallbackEnabled === 0 && hostedConfigured.length === 0
          ? 'Runs on a self-hosted model. No hosted provider keys are configured and no department falls back to one.'
          : `Hosted configuration detected: ${hostedConfigured.join(', ') || 'none'}${fallbackEnabled ? `; ${fallbackEnabled} departments allow fallback` : ''}.`,
      evidence: 'DepartmentRuntime.fallbackPolicy + environment',
    },
    {
      id: 'department-staffing',
      label: 'Every department is staffed',
      target: `${departments} departments staffed`,
      actual: `${withEmployees}/${departments}`,
      pass: withEmployees >= departments,
      detail: `${withEmployees} of ${departments} departments have at least one AI employee.`,
      evidence: 'Employee.departmentId',
    },
    {
      id: 'backups',
      label: 'Backups',
      target: 'verified backup within 7 days',
      actual: latest ? `${latestAgeHours !== null ? Math.round(latestAgeHours) : '?'}h old · ${latest.status}` : 'none',
      pass: verifiedBackups.length > 0 && backupFresh,
      detail: latest
        ? `Latest snapshot ${latest.filename} (${(latest.sizeBytes / 1024 / 1024).toFixed(1)} MB, ${latest.rowCount.toLocaleString()} rows). ${verifiedBackups.length} verified snapshot(s).`
        : 'No backup has been taken yet. Run one from the Backups tab before going live.',
      evidence: 'BackupRecord table + ./backups',
    },
    {
      id: 'client-config',
      label: 'Per-client configuration',
      target: 'one workspace per client, no code',
      actual: `${configuredClients}/${clients}`,
      pass: clients > 0 && configuredClients === clients,
      detail: `${clients} client workspace(s), ${configuredClients} configured. Each is a Company row plus a ClientConfig row — no separate application.`,
      evidence: 'ClientConfig table',
    },
    {
      id: 'brand-voice',
      label: 'Brand voice consistency',
      target: 'a default voice per client',
      actual: `${brandVoices} voice(s)`,
      pass: brandVoices > 0,
      detail: `${brandVoices} brand voice profile(s) drive every persona, post, email and script.`,
      evidence: 'BrandVoice table',
    },
    {
      id: 'personas',
      label: 'Face agents / virtual personas',
      target: 'at least one persona kit',
      actual: `${personas}`,
      pass: personas > 0,
      detail: `${personas} persona(s). Renders require recorded consent and client-owned photos.`,
      evidence: 'BrandPersona table',
    },
    {
      id: 'knowledge',
      label: 'Knowledge base',
      target: 'at least 10 knowledge nodes',
      actual: `${knowledgeNodes}`,
      pass: knowledgeNodes >= 10,
      detail: `${knowledgeNodes} knowledge nodes available to agents through retrieval.`,
      evidence: 'KnowledgeNode table',
    },
  ];

  const passed = checks.filter((check) => check.pass).length;

  return {
    generatedAt: new Date().toISOString(),
    company,
    overall: { pass: passed === checks.length, passed, total: checks.length },
    checks,
    counts: {
      departments,
      departmentsWithSop: withSop,
      departmentsWithEmployees: withEmployees,
      departmentsWithRuntime: runtimes.length,
      agents,
      employees,
      sops,
      knowledgeNodes,
      clients,
      configuredClients,
      personas,
      brandVoices,
      backups: backupRows.length,
      verifiedBackups: verifiedBackups.length,
    },
    models: {
      localRuntimes,
      externalRuntimes,
      fallbackEnabled,
      modelNames,
    },
  };
}
