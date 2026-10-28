/**
 * Agency operating model seed.
 *
 * Brings the workspace to the full agency specification:
 *   - 100 departments (top-up, existing rows are never removed)
 *   - one SOP per department + cross-functional SOPs
 *   - 100 isolated department model runtimes (local, no hosted fallback)
 *   - 2,000 agent specifications (100 departments x 20 roles)
 *   - per-client configuration, a default brand voice and a persona example
 *
 * Idempotent: every write is an upsert or a guarded create, so re-running is safe.
 *
 * Usage: npx tsx prisma/seed-agency.ts
 */
import { db as prisma } from '../src/lib/db';
import { AGENCY_DEPARTMENTS, CORE_DEPARTMENTS, type AgencyDepartment } from './departments';

// ── 46 additional departments (54 already exist -> 100) ─────────────────────



// ── 20 role archetypes -> 2,000 agent specs ─────────────────────────────────
const ROLE_ARCHETYPES: Array<{
  role: string;
  level: string;
  tier: string;
  autonomy: string;
  mission: (dept: string) => string;
  skills: string[];
  tools: string[];
}> = [
  { role: 'Department Director', level: 'director', tier: 'reasoning', autonomy: 'supervised', mission: (d) => `Own the strategy, budget and quality bar for ${d}`, skills: ['strategy', 'forecasting', 'stakeholder_management'], tools: ['analytics', 'crm', 'reporting'] },
  { role: 'Operations Manager', level: 'manager', tier: 'balanced', autonomy: 'semi_autonomous', mission: (d) => `Run the day-to-day delivery queue for ${d}`, skills: ['planning', 'capacity_management', 'sla_management'], tools: ['workflow', 'tasks', 'notifications'] },
  { role: 'Quality Reviewer', level: 'supervisor', tier: 'reasoning', autonomy: 'supervised', mission: (d) => `Gate every ${d} deliverable against the SOP and brand voice`, skills: ['qa', 'brand_voice', 'fact_checking'], tools: ['brand_voice', 'knowledge'] },
  { role: 'Senior Specialist', level: 'specialist', tier: 'reasoning', autonomy: 'semi_autonomous', mission: (d) => `Handle complex ${d} work end to end`, skills: ['deep_expertise', 'problem_solving'], tools: ['ai_chat', 'knowledge', 'files'] },
  { role: 'Specialist', level: 'specialist', tier: 'balanced', autonomy: 'semi_autonomous', mission: (d) => `Produce the core ${d} deliverables`, skills: ['execution', 'documentation'], tools: ['ai_chat', 'templates'] },
  { role: 'Research Analyst', level: 'specialist', tier: 'reasoning', autonomy: 'semi_autonomous', mission: (d) => `Gather evidence before any ${d} decision`, skills: ['research', 'synthesis', 'citation'], tools: ['scraper', 'knowledge', 'feeds'] },
  { role: 'Data Analyst', level: 'specialist', tier: 'balanced', autonomy: 'semi_autonomous', mission: (d) => `Measure ${d} performance and surface anomalies`, skills: ['analytics', 'sql', 'statistics'], tools: ['analytics', 'reporting'] },
  { role: 'Copywriter', level: 'specialist', tier: 'balanced', autonomy: 'semi_autonomous', mission: (d) => `Write ${d} copy in the approved brand voice`, skills: ['copywriting', 'editing', 'seo_writing'], tools: ['ai_chat', 'grammar', 'brand_voice'] },
  { role: 'Visual Designer', level: 'specialist', tier: 'vision', autonomy: 'semi_autonomous', mission: (d) => `Design ${d} visuals that match the brand system`, skills: ['layout', 'typography', 'colour'], tools: ['image_generation', 'brand_kit'] },
  { role: 'Video Producer', level: 'specialist', tier: 'vision', autonomy: 'semi_autonomous', mission: (d) => `Produce ${d} video deliverables`, skills: ['storyboarding', 'editing', 'captions'], tools: ['video', 'transcribe', 'captions'] },
  { role: 'Audio Producer', level: 'specialist', tier: 'balanced', autonomy: 'semi_autonomous', mission: (d) => `Produce ${d} audio and voice deliverables`, skills: ['voice_direction', 'audio_editing'], tools: ['tts', 'voice', 'transcribe'] },
  { role: 'SEO Strategist', level: 'specialist', tier: 'balanced', autonomy: 'semi_autonomous', mission: (d) => `Make ${d} output findable in search`, skills: ['keyword_research', 'on_page', 'schema'], tools: ['seo', 'crawler', 'keywords'] },
  { role: 'Publishing Coordinator', level: 'worker', tier: 'fast', autonomy: 'supervised', mission: (d) => `Schedule and publish ${d} output on the right channel`, skills: ['scheduling', 'channel_ops'], tools: ['scheduler', 'social_accounts'] },
  { role: 'Community Responder', level: 'worker', tier: 'fast', autonomy: 'supervised', mission: (d) => `Answer community messages for ${d} within SLA`, skills: ['conversation', 'de_escalation'], tools: ['inbox', 'knowledge', 'sms'] },
  { role: 'Campaign Coordinator', level: 'specialist', tier: 'balanced', autonomy: 'semi_autonomous', mission: (d) => `Coordinate ${d} campaigns across channels`, skills: ['campaign_management', 'budgeting'], tools: ['campaigns', 'analytics'] },
  { role: 'Automation Engineer', level: 'specialist', tier: 'coding', autonomy: 'semi_autonomous', mission: (d) => `Automate repetitive ${d} work reliably`, skills: ['workflow_design', 'api_integration'], tools: ['workflow', 'webhooks', 'api'] },
  { role: 'Compliance Checker', level: 'supervisor', tier: 'reasoning', autonomy: 'supervised', mission: (d) => `Check ${d} output against policy, privacy and claims rules`, skills: ['compliance', 'risk_assessment'], tools: ['knowledge', 'audit'] },
  { role: 'Client Liaison', level: 'specialist', tier: 'balanced', autonomy: 'supervised', mission: (d) => `Keep the client informed about ${d} progress`, skills: ['communication', 'reporting'], tools: ['messages', 'crm', 'email'] },
  { role: 'Reporting Analyst', level: 'specialist', tier: 'fast', autonomy: 'semi_autonomous', mission: (d) => `Produce ${d} performance reports with commentary`, skills: ['reporting', 'data_storytelling'], tools: ['analytics', 'reporting'] },
  { role: 'Knowledge Curator', level: 'worker', tier: 'fast', autonomy: 'semi_autonomous', mission: (d) => `Keep ${d} SOPs, templates and learnings current`, skills: ['documentation', 'taxonomy'], tools: ['knowledge', 'wiki'] },
];

const LOCAL_MODELS = ['qwen2.5:7b', 'llama3.1:8b', 'mistral:7b', 'qwen2.5-coder:7b', 'llava:7b'];

const TIER_MODEL: Record<string, string> = {
  fast: 'qwen2.5:7b',
  balanced: 'llama3.1:8b',
  reasoning: 'qwen2.5:7b',
  coding: 'qwen2.5-coder:7b',
  vision: 'llava:7b',
  specialised: 'mistral:7b',
};

/** Standard delivery SOP shape, tailored per department. */
function departmentSop(dept: AgencyDepartment) {
  const steps = [
    { order: 1, title: 'Intake and brief confirmation', description: `Confirm the request, owner, deadline and success measure for ${dept.name}.` },
    { order: 2, title: 'Research and context', description: `Check the knowledge base, client brand voice and prior ${dept.name} work before drafting.` },
    { order: 3, title: 'Plan the deliverable', description: `List the assets required to produce ${dept.deliverable}, with owners and dependencies.` },
    { order: 4, title: 'Produce first draft', description: `Create the ${dept.deliverable} inside the approved templates and tool guardrails.` },
    { order: 5, title: 'Quality gate', description: 'Check facts, spelling, brand voice, accessibility, claims and licence of every asset.' },
    { order: 6, title: 'Client or manager approval', description: 'Record the decision and any change requests against the deliverable.' },
    { order: 7, title: 'Deliver and measure', description: `Deliver ${dept.deliverable}, then record the outcome so the next cycle improves.` },
  ];
  return {
    name: `${dept.name} delivery SOP`,
    description: `End-to-end procedure for ${dept.name}: ${dept.description}.`,
    category: dept.code.toLowerCase(),
    triggerConditions: JSON.stringify([{ departmentCode: dept.code }, { deliverable: dept.deliverable }]),
    steps: JSON.stringify(steps),
    preconditions: JSON.stringify(['brief_approved', 'brand_voice_loaded', 'asset_rights_confirmed']),
    applicableRoles: JSON.stringify(['director', 'manager', 'supervisor', 'specialist', 'worker']),
    applicableTasks: JSON.stringify([dept.code, 'content_production', 'review']),
  };
}

const CROSS_FUNCTIONAL_SOPS = [
  { key: 'client-onboarding', name: 'New client onboarding SOP', category: 'client_onboarding', description: 'Configure a new client workspace without writing code.', steps: ['Contract and scope signed', 'Create workspace and invite users', 'Collect channel access (client login or managed)', 'Capture brand voice and asset rights', 'Build the 90-day plan', 'Confirm reporting cadence', 'Hand over to account management'] },
  { key: 'brand-voice', name: 'Brand voice capture SOP', category: 'brand_voice', description: 'Turn client inputs into a reusable voice profile.', steps: ['Collect 5+ approved samples', 'Extract tone, rhythm and vocabulary', 'Agree do/don’t list and banned phrases', 'Publish voice to every channel template', 'Review quarterly against live copy'] },
  { key: 'social-publish', name: 'Social publishing SOP', category: 'publishing', description: 'Publish approved content with a safe session model.', steps: ['Confirm the approved asset and caption', 'Verify channel, audience and timing', 'Open a short-lived session with client credentials', 'Publish and capture the post URL', 'Close the session and record the audit entry'] },
  { key: 'seo-content', name: 'SEO content production SOP', category: 'seo', description: 'Produce content that can rank and be cited.', steps: ['Keyword and intent research', 'Outline and entity coverage', 'Draft with brand voice', 'On-page and schema pass', 'Editorial and fact review', 'Publish and request indexing', 'Track rankings and refresh'] },
  { key: 'creative-production', name: 'Image, video and audio production SOP', category: 'media', description: 'Produce media inside local runtime limits.', steps: ['Confirm output specs per channel', 'Choose local model or template', 'Generate and log the prompt version', 'Review quality, safety and rights', 'Export variants per platform', 'Archive source files'] },
  { key: 'persona-consent', name: 'Face agent consent SOP', category: 'persona', description: 'Build a virtual persona only from client-owned photos with recorded consent.', steps: ['Collect signed likeness permission', 'Record photo sources and rights', 'Create persona record and voice mapping', 'Render a watermarked proof', 'Client approval', 'Activate with usage scope and review date'] },
  { key: 'sms-outreach', name: 'SMS outreach SOP', category: 'sms', description: 'Send compliant SMS at scale.', steps: ['Confirm consent and opt-out list', 'Select template and personalisation', 'Send via the configured gateway', 'Handle failures and retries', 'Record delivery and stop signals'] },
  { key: 'lead-handling', name: 'Lead handling SOP', category: 'lead_qualification', description: 'Qualify and route inbound leads.', steps: ['Capture and de-duplicate', 'Enrich and score', 'Route by segment and geography', 'First contact within SLA', 'Log outcome and next step'] },
  { key: 'invoice', name: 'Invoicing and reconciliation SOP', category: 'billing', description: 'Produce an accurate final invoice per client.', steps: ['Reconcile delivered scope against contract', 'Reconcile media spend and receipts', 'Apply approved change requests', 'Issue invoice with tax treatment', 'Track payment and escalate overdue'] },
  { key: 'backup', name: 'Backup and continuity SOP', category: 'continuity', description: 'Keep client work recoverable.', steps: ['Run the scheduled backup', 'Verify checksum and integrity', 'Record the backup in the register', 'Replicate off-host', 'Run a restore drill quarterly'] },
  { key: 'access-offboarding', name: 'Access and offboarding SOP', category: 'security', description: 'Handle client credentials and session hygiene.', steps: ['Collect only the minimum scopes', 'Store secrets in the credential vault', 'Enforce short session lifetime and auto-logout', 'Rotate on schedule or on demand', 'Revoke everything at offboarding'] },
  { key: 'reporting', name: 'Monthly client reporting SOP', category: 'reporting', description: 'Produce a defensible monthly report.', steps: ['Validate data sources and date ranges', 'Compare against targets and prior month', 'Explain variance with evidence', 'Write recommendations', 'Client review and actions'] },
];

async function main() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!company) throw new Error('Run prisma/seed.ts first — no company found.');
  const companyId = company.id;

  // ── 1. Departments ────────────────────────────────────────────────────────
  const existing = await prisma.department.findMany({ where: { companyId } });
  const byCode = new Map(existing.map((d) => [d.code ?? d.id, d]));
  // The full 100-department catalog: 54 core departments plus the 46
  // specialist ones. Seeding only this seed's half used to leave the workspace
  // at 46 departments, which also capped the agent fleet at 920.
  const catalog: AgencyDepartment[] = [
    ...CORE_DEPARTMENTS.map((dept) => ({ ...dept, deliverable: `${dept.name} deliverables` })),
    ...AGENCY_DEPARTMENTS,
  ];
  let added = 0;
  for (const [index, dept] of catalog.entries()) {
    if (byCode.has(dept.code)) continue;
    const parentId = dept.parent ? byCode.get(dept.parent)?.id ?? null : null;
    const created = await prisma.department.create({
      data: {
        name: dept.name,
        code: dept.code,
        description: dept.description,
        parentId,
        level: dept.level,
        sortOrder: 100 + index,
        icon: dept.icon,
        color: dept.color,
        companyId,
      },
    });
    byCode.set(dept.code, created);
    added += 1;
  }
  const departments = await prisma.department.findMany({ where: { companyId } });
  console.log(`🏢 Departments: ${existing.length} existing + ${added} added = ${departments.length}`);

  const deptMeta = new Map<string, AgencyDepartment | undefined>(AGENCY_DEPARTMENTS.map((d) => [d.code, d]));
  const describe = (d: { name: string; code: string | null; description: string | null }) =>
    deptMeta.get(d.code ?? '')?.deliverable ?? d.description ?? `${d.name} deliverables`;

  // ── 2. SOPs: one per department + cross-functional ────────────────────────
  let sopCount = 0;
  for (const dept of departments) {
    const code = (dept.code ?? dept.name).toLowerCase();
    const def: AgencyDepartment = deptMeta.get(dept.code ?? '') ?? {
      code: dept.code ?? dept.name,
      name: dept.name,
      parent: null,
      level: dept.level,
      icon: dept.icon ?? 'Circle',
      color: dept.color ?? '#64748b',
      description: dept.description ?? dept.name,
      deliverable: `${dept.name} deliverables`,
    };
    const sop = departmentSop(def);
    await prisma.sop.upsert({
      where: { id: `sop-dept-${code}` },
      update: { ...sop, departmentId: dept.id, isActive: true },
      create: { id: `sop-dept-${code}`, ...sop, departmentId: dept.id, companyId, isActive: true, version: 1 },
    });
    sopCount += 1;
  }
  for (const sop of CROSS_FUNCTIONAL_SOPS) {
    const payload = {
      name: sop.name,
      description: sop.description,
      category: sop.category,
      triggerConditions: JSON.stringify([{ category: sop.category }]),
      steps: JSON.stringify(sop.steps.map((title, index) => ({ order: index + 1, title, description: `${title} — completed and recorded.` }))),
      preconditions: JSON.stringify(['owner_assigned', 'client_scope_confirmed']),
      applicableRoles: JSON.stringify(['director', 'manager', 'specialist']),
      applicableTasks: JSON.stringify([sop.category]),
    };
    await prisma.sop.upsert({
      where: { id: `sop-x-${sop.key}` },
      update: { ...payload, isActive: true },
      create: { id: `sop-x-${sop.key}`, ...payload, companyId, isActive: true, version: 1 },
    });
    sopCount += 1;
  }
  const totalSops = await prisma.sop.count({ where: { companyId } });
  console.log(`📋 SOPs: ${totalSops} active (${departments.length} department + ${CROSS_FUNCTIONAL_SOPS.length} cross-functional)`);

  // ── 2b. Knowledge base: one operational reference per cross-functional SOP ─
  // The readiness audit requires at least one knowledge node; a fresh workspace
  // had none unless the unrelated workforce seed was run. Derived from the SOP
  // catalog so the content is real procedure text, not placeholder prose.
  for (const sop of CROSS_FUNCTIONAL_SOPS) {
    await prisma.knowledgeNode.upsert({
      where: { id: `kn-x-${sop.key}` },
      update: {},
      create: {
        id: `kn-x-${sop.key}`,
        title: sop.name,
        summary: sop.description,
        content: `${sop.description}\n\nSteps:\n${sop.steps.map((step: string, index: number) => `${index + 1}. ${step}`).join('\n')}`,
        nodeType: 'guideline',
        tags: JSON.stringify([sop.category, 'sop', 'agency']),
        category: sop.category,
        accessLevel: 'company',
        accessRoles: JSON.stringify(['executive', 'director', 'manager', 'supervisor', 'specialist', 'worker']),
        companyId,
      },
    });
  }
  const totalKnowledge = await prisma.knowledgeNode.count({ where: { companyId } });
  console.log(`📚 Knowledge nodes: ${totalKnowledge} (${CROSS_FUNCTIONAL_SOPS.length} SOP references ensured)`);

  // ── 3. Department runtimes: one isolated local model per department ───────
  for (const dept of departments) {
    const meta = deptMeta.get(dept.code ?? '');
    const tier = dept.level === 0 ? 'reasoning' : meta ? 'balanced' : 'balanced';
    const modelName = TIER_MODEL[tier] ?? LOCAL_MODELS[0];
    const deptSop = await prisma.sop.findFirst({ where: { companyId, departmentId: dept.id }, select: { id: true } });
    const guardrails = [
      'Never invent client facts, prices or regulatory claims.',
      'Use only the brand voice approved for this client.',
      'Escalate to a human when confidence is low or the request is out of scope.',
      'Never send data to a hosted provider: this department runs locally.',
    ];
    await prisma.departmentRuntime.upsert({
      where: { departmentId: dept.id },
      update: { departmentCode: dept.code ?? dept.name, modelName, modelTier: tier },
      create: {
        departmentId: dept.id,
        departmentCode: dept.code ?? dept.name,
        modelName,
        modelTier: tier,
        provider: 'ollama',
        temperature: dept.level === 0 ? 0.3 : 0.5,
        maxTokens: 4096,
        systemPrompt: `You are the ${dept.name} department of a digital marketing agency. ${dept.description ?? ''} You operate as an independent specialist model: you own your deliverables (${describe(dept)}), your SOP, and your quality bar. Be concrete, cite internal knowledge where relevant, and refuse work outside your remit instead of guessing.`,
        isolationMode: 'local',
        fallbackPolicy: 'none',
        toolPolicy: JSON.stringify({ allowed: ['ai_chat', 'knowledge', 'analytics', 'reporting', 'workflow'], denyExternal: true }),
        knowledgeScope: JSON.stringify([dept.code ?? dept.name, 'brand_voice', 'sop']),
        guardrails: JSON.stringify(guardrails),
        sopIds: JSON.stringify(deptSop ? [deptSop.id] : []),
        isActive: true,
      },
    });
  }
  const runtimes = await prisma.departmentRuntime.count();
  console.log(`🧠 Department runtimes: ${runtimes} (isolation=local, fallback=none)`);

  // ── 4. 2,000 agent specs = departments x 20 roles ─────────────────────────
  // Codes are deterministic (AGT-0001 … AGT-2000), so a partially seeded
  // database must be topped up by code rather than by count: re-running the
  // seed with only "count < target" as the guard re-created existing codes and
  // aborted on the AgentSpec.code unique constraint.
  const expectedAgents = departments.length * ROLE_ARCHETYPES.length;
  const existingCodes = new Set(
    (await prisma.agentSpec.findMany({ where: { companyId }, select: { code: true } })).map((agent) => agent.code),
  );
  if (existingCodes.size >= expectedAgents) {
    console.log(`🤖 Agent specs already present: ${existingCodes.size}`);
  } else {
    const sopsByDept = new Map(
      (await prisma.sop.findMany({ where: { companyId, departmentId: { not: null } }, select: { id: true, departmentId: true } }) ).map((s) => [s.departmentId as string, s.id])
    );
    let index = 0;
    let created = 0;
    let batch: any[] = [];
    const flush = async () => {
      if (batch.length === 0) return;
      // SQLite has no skipDuplicates option; the batch is pre-filtered by
      // existing code, so a duplicate here is a genuine bug worth surfacing.
      const result = await prisma.agentSpec.createMany({ data: batch });
      created += result.count;
      batch = [];
    };
    for (const dept of departments) {
      for (const role of ROLE_ARCHETYPES) {
        index += 1;
        const code = `AGT-${String(index).padStart(4, '0')}`;
        if (existingCodes.has(code)) continue;
        batch.push({
          code,
          name: `${dept.name} · ${role.role}`,
          departmentId: dept.id,
          departmentCode: dept.code ?? dept.name,
          role: role.role,
          level: role.level,
          mission: role.mission(dept.name),
          modelTier: role.tier,
          modelName: TIER_MODEL[role.tier] ?? LOCAL_MODELS[0],
          skills: JSON.stringify(role.skills),
          capabilities: JSON.stringify([describe(dept), role.role.toLowerCase().replace(/\s+/g, '_')]),
          tools: JSON.stringify(role.tools),
          sopId: sopsByDept.get(dept.id) ?? null,
          autonomy: role.autonomy,
          guardrails: JSON.stringify(['no_hosted_provider', 'brand_voice_required', 'human_review_for_publishing']),
          inputChannels: JSON.stringify(['chat', 'task', 'email', 'webhook']),
          outputChannels: JSON.stringify(['task', 'document', 'report']),
          isEnabled: true,
          companyId,
        });
        if (batch.length >= 400) await flush();
      }
    }
    await flush();
    const totalAgents = await prisma.agentSpec.count({ where: { companyId } });
    console.log(`🤖 Agent specs seeded: ${created} new → ${totalAgents} total`);
  }

  // ── 5. Staff every department (rebalance, never delete) ───────────────────
  // Target: AGENCY_TARGETS.employees (2,000) spread over 100 departments.
  // Filling only *empty* departments (8 each) left the workspace at 800 staff,
  // so the documented single `agency:seed` command could never satisfy the
  // readiness audit's own 2,000-employee target.
  const EMPLOYEE_TARGET = 2000; // same target the readiness audit checks (src/lib/agency.ts)
  const STAFFING_PER_DEPARTMENT = Math.ceil(EMPLOYEE_TARGET / Math.max(departments.length, 1));
  const employeeCount = await prisma.employee.count({ where: { companyId } });
  const covered = await prisma.employee.groupBy({ by: ['departmentId'], where: { companyId }, _count: true });
  const headcountByDept = new Map(covered.map((row) => [row.departmentId, row._count]));
  const gaps = departments
    .map((dept) => ({ dept, deficit: Math.max(0, STAFFING_PER_DEPARTMENT - (headcountByDept.get(dept.id) ?? 0)) }))
    .filter((entry) => entry.deficit > 0);
  if (gaps.length > 0) {
    const titleByLevel: Record<string, string> = {
      worker: 'Associate', specialist: 'Specialist', supervisor: 'Team Lead', manager: 'Manager', director: 'Director', executive: 'Executive',
    };
    // Sequential ids must continue past the highest id in use, not past the
    // row count: a deletion would otherwise re-issue an existing EMP-#### and
    // fail on the unique constraint.
    const allEmployeeIds = await prisma.employee.findMany({ select: { employeeId: true } });
    const highestSeq = allEmployeeIds.reduce((max, row) => {
      const digits = Number((row.employeeId.match(/(\d+)$/) || [0, '0'])[1]);
      return Number.isFinite(digits) ? Math.max(max, digits) : max;
    }, 0);
    let seq = Math.max(highestSeq, employeeCount);
    const LEVEL_CYCLE = ['worker', 'worker', 'specialist', 'specialist', 'specialist', 'supervisor', 'manager', 'director'];
    const data = gaps.flatMap(({ dept, deficit }) =>
      Array.from({ length: deficit }, (_, offset) => {
        seq += 1;
        const level = LEVEL_CYCLE[offset % LEVEL_CYCLE.length];
        return {
          employeeId: `EMP-${String(seq).padStart(4, '0')}`,
          name: `${dept.name.split(' ')[0]} ${titleByLevel[level]} ${seq}`,
          title: `${dept.name} ${titleByLevel[level]}`,
          level,
          status: 'idle',
          mission: `Deliver ${describe(dept)} for ${dept.name}.`,
          constitution: JSON.stringify({ rules: ['follow_sop', 'brand_voice', 'no_hosted_provider'] }),
          departmentId: dept.id,
          skills: JSON.stringify(['department_sop', 'brand_voice', 'local_model']),
          capabilities: JSON.stringify([describe(dept)]),
          tools: JSON.stringify(['ai_chat', 'knowledge', 'workflow']),
          preferredModel: TIER_MODEL.balanced,
          modelTier: 'balanced',
          modelConfig: JSON.stringify({ temperature: 0.6, departmentRuntime: true }),
          kpis: JSON.stringify([{ name: 'on_time_delivery', target: 95, unit: '%' }]),
          companyId,
        };
      })
    );
    await prisma.employee.createMany({ data });
    console.log(`👥 Employees added: ${data.length} across ${gaps.length} under-staffed departments (target ${STAFFING_PER_DEPARTMENT} each)`);
  }
  const finalEmployees = await prisma.employee.count({ where: { companyId } });
  console.log(`👥 Employees total: ${finalEmployees}`);

  // ── 6. Client workspace configuration ─────────────────────────────────────
  const channels = ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'whatsapp', 'sms', 'email', 'google_ads', 'meta_ads'];
  await prisma.clientConfig.upsert({
    where: { companyId },
    update: {},
    create: {
      companyId,
      credentialMode: 'client_login',
      autoLogoutMinutes: 15,
      passwordRotationDays: 90,
      allowedChannels: JSON.stringify(channels),
      channelCredentials: JSON.stringify(Object.fromEntries(channels.map((c) => [c, { mode: 'client_login', reference: null }]))),
      personaLimit: 3,
      onboardingStatus: 'configured',
      dataRegion: 'local',
      notes: 'Demo workspace. Client signs in with their own credentials; the session is closed automatically after the job.',
    },
  });
  console.log('🏷️  Client configuration: configured (client_login, 15 min auto-logout)');

  // ── 7. Brand voice + persona example ──────────────────────────────────────
  const voiceId = 'voice-demo-brand';
  await prisma.brandVoice.upsert({
    where: { id: voiceId },
    update: {},
    create: {
      id: voiceId,
      name: `${company.name} house voice`,
      companyId,
      tone: 'warm-professional',
      personaLine: 'A knowledgeable guide who explains clearly and never oversells.',
      readingLevel: 'general',
      doList: JSON.stringify(['lead with the benefit', 'use concrete numbers', 'keep sentences short', 'name the next step']),
      dontList: JSON.stringify(['no hype adjectives', 'no fake urgency', 'no unverifiable claims', 'no all-caps']),
      lexicon: JSON.stringify(['students', 'applicants', 'counsellors']),
      bannedPhrases: JSON.stringify(['revolutionary', 'game-changing', 'guaranteed visa', 'act now']),
      ctaStyle: 'direct',
      sampleCopy: 'Book a free eligibility check. We will review your grades, budget and target intake, then send a written plan within two working days.',
      isDefault: true,
    },
  });
  const personaId = 'persona-demo-presenter';
  await prisma.brandPersona.upsert({
    where: { id: personaId },
    update: {},
    create: {
      id: personaId,
      name: 'Aisha — Student Advisor Presenter',
      companyId,
      role: 'presenter',
      description: 'Client-owned virtual presenter for short explainer videos and welcome messages.',
      voiceId: 'voice-default',
      brandVoiceId: voiceId,
      assets: JSON.stringify([
        { id: 'asset-1', label: 'Front portrait', source: 'client_supplied', licence: 'client_owned', status: 'pending_upload' },
        { id: 'asset-2', label: 'Three-quarter portrait', source: 'client_supplied', licence: 'client_owned', status: 'pending_upload' },
      ]),
      consentOwner: 'Demo workspace owner',
      consentGranted: true,
      consentProof: 'DEMO-RECORD — replace with the signed likeness permission before production use.',
      usageScope: JSON.stringify(['website', 'youtube', 'instagram', 'linkedin']),
      likenessPolicy: 'client_owned',
      status: 'ready',
    },
  });
  console.log('🎭 Brand voice + demo persona seeded (consent recorded as DEMO)');

  console.log('\n✅ Agency seed complete.');
}

main()
  .catch((error) => {
    console.error('❌ Agency seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
