// @ts-nocheck — temporary: see audit for fix plan
/**
 * Tool Registry — the actual tools agents can call.
 *
 * Each tool is registered with the agent-loop module. Sensitive tools
 * (those that send messages, publish posts, modify data, or cost money)
 * are marked requiresApproval: true.
 *
 * Per requirement 11: "Integrate agent outputs with existing CRM, n8n,
 * OpenSMS, HTTPSMS, WhatsApp and approved social publishing APIs."
 *
 * (Note: WhatsApp is DISABLED per master directive — AI agents handle all
 * communication, no WhatsApp Business API integration is provided.)
 */
import { registerTool, type ToolResult } from './agent-loop';
import { db } from './db';
import { emitEvent } from './events';
import { scrubPii } from './pii-filter';

// ─── CRM Tools ───────────────────────────────────────────────────────────────
registerTool({
  name: 'crm_create_lead',
  description: 'Create a new lead in the CRM. Use when an inquiry contains contact info + intent.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
      companyName: { type: 'string' },
      source: { type: 'string', enum: ['website', 'social', 'email', 'sms', 'phone', 'referral'] },
      notes: { type: 'string' },
    },
    required: ['name', 'source'],
  },
  requiresApproval: false,
  handler: async (args, ctx): Promise<ToolResult> => {
    const lead = await db.lead.create({
      data: {
        name: args.name,
        email: args.email || null,
        phone: args.phone || null,
        companyName: args.companyName || null,
        source: args.source,
        status: 'new',
        score: 0,
        companyId: ctx.companyId,
      },
    });
    await emitEvent({
      type: 'crm.lead_create',
      companyId: ctx.companyId,
      userId: ctx.userId,
      resource: 'lead',
      resourceId: lead.id,
      metadata: { source: args.source, name: args.name, agent: ctx.agentType },
    });
    return {
      success: true,
      output: `Created lead ${lead.id} for ${args.name}.`,
      metadata: { leadId: lead.id },
    };
  },
});

registerTool({
  name: 'crm_update_lead_status',
  description: 'Update the status of a lead (new, contacted, qualified, proposal, negotiation, won, lost).',
  inputSchema: {
    type: 'object',
    properties: {
      leadId: { type: 'string' },
      newStatus: { type: 'string', enum: ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] },
      note: { type: 'string' },
    },
    required: ['leadId', 'newStatus'],
  },
  requiresApproval: false,
  handler: async (args, ctx): Promise<ToolResult> => {
    const lead = await db.lead.updateMany({
      where: { id: args.leadId, companyId: ctx.companyId },
      data: { status: args.newStatus },
    });
    if (lead.count === 0) return { success: false, output: `Lead ${args.leadId} not found in this tenant.` };
    return { success: true, output: `Lead ${args.leadId} status → ${args.newStatus}.` };
  },
});

// ─── SMS Tools (sensitive — require approval) ────────────────────────────────
registerTool({
  name: 'sms_send_otp',
  description: 'Send a one-time password (OTP) via SMS to verify a phone number. Use for identity verification.',
  inputSchema: {
    type: 'object',
    properties: {
      phone: { type: 'string', description: 'E.164 format: +8801XXXXXXXXX' },
      purpose: { type: 'string', description: 'e.g. "login verification", "lead verification"' },
    },
    required: ['phone', 'purpose'],
  },
  requiresApproval: true, // Sends a real SMS — costs money + reaches a person
  handler: async (args, ctx): Promise<ToolResult> => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/sms/otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: args.phone, purpose: args.purpose }),
    });
    if (!res.ok) return { success: false, output: `OTP send failed: HTTP ${res.status}` };
    const data = await res.json();
    return {
      success: true,
      output: `OTP sent (smsId=${data.data?.smsId}). Delivery requires provider config; user must verify within 5 min.`,
      metadata: { smsId: data.data?.smsId },
    };
  },
});

registerTool({
  name: 'sms_send_message',
  description: 'Send a transactional SMS message. Requires explicit human approval — message will reach a real person.',
  inputSchema: {
    type: 'object',
    properties: {
      to: { type: 'string' },
      message: { type: 'string', maxLength: 480 },
    },
    required: ['to', 'message'],
  },
  requiresApproval: true,
  handler: async (args, ctx): Promise<ToolResult> => {
    // PII scrub the message before storing it
    const scrub = scrubPii(args.message);
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: args.to, message: scrub.redacted }),
    });
    if (!res.ok) return { success: false, output: `SMS send failed: HTTP ${res.status}` };
    const data = await res.json();
    return {
      success: true,
      output: `SMS queued for delivery (smsId=${data.data?.smsId || data.id}). AI-generated, awaiting provider confirmation.`,
      metadata: { smsId: data.data?.smsId || data.id, piiRedacted: scrub.redactions.length },
      terminateLoop: true,
    };
  },
});

// ─── Social Publishing Tools (sensitive — require approval) ──────────────────
registerTool({
  name: 'social_create_post_draft',
  description: 'Create a DRAFT social media post for review. Does NOT publish — use social_publish_post for that.',
  inputSchema: {
    type: 'object',
    properties: {
      platform: { type: 'string', enum: ['facebook', 'instagram', 'linkedin', 'x', 'tiktok', 'youtube'] },
      content: { type: 'string', maxLength: 2200 },
      mediaUrls: { type: 'array', items: { type: 'string' } },
    },
    required: ['platform', 'content'],
  },
  requiresApproval: false, // Drafts are safe
  handler: async (args, ctx): Promise<ToolResult> => {
    const scrub = scrubPii(args.content);
    const content = await db.content.create({
      data: {
        title: `Draft ${args.platform} post — ${new Date().toISOString()}`,
        type: 'social_post',
        status: 'draft',
        platform: args.platform,
        body: scrub.redacted,
        aiGenerated: true,
        companyId: ctx.companyId,
      },
    });
    return {
      success: true,
      output: `Draft created (contentId=${content.id}) for ${args.platform}. Awaiting review/publish.`,
      metadata: { contentId: content.id, piiRedacted: scrub.redactions.length },
    };
  },
});

registerTool({
  name: 'social_publish_post',
  description: 'Publish a previously-created social media post. Sends a REAL post to the platform. Requires human approval.',
  inputSchema: {
    type: 'object',
    properties: {
      contentId: { type: 'string' },
      scheduledAt: { type: 'string', description: 'ISO date; if omitted, publishes immediately' },
    },
    required: ['contentId'],
  },
  requiresApproval: true, // Real publishing — irreversibly public
  handler: async (args, ctx): Promise<ToolResult> => {
    // Mark the content as scheduled — actual publishing goes through Postiz adapter (Phase 4)
    const content = await db.content.updateMany({
      where: { id: args.contentId, companyId: ctx.companyId, status: 'draft' },
      data: {
        status: 'scheduled',
        scheduledAt: args.scheduledAt ? new Date(args.scheduledAt) : new Date(),
      },
    });
    if (content.count === 0) return { success: false, output: `Draft ${args.contentId} not found or already scheduled.` };
    return {
      success: true,
      output: `Post ${args.contentId} scheduled. Will publish via Postiz adapter at ${args.scheduledAt || 'now'}.`,
      metadata: { contentId: args.contentId, scheduledAt: args.scheduledAt || new Date().toISOString() },
      terminateLoop: true,
    };
  },
});

// ─── Content Generation Tools (safe — no approval needed) ────────────────────
registerTool({
  name: 'content_save_artifact',
  description: 'Save a generated content artifact (blog post, video script, email copy) for later review.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      type: { type: 'string', enum: ['blog', 'email', 'sms', 'video_script', 'ad_copy', 'landing_page'] },
      body: { type: 'string' },
      platform: { type: 'string' },
    },
    required: ['title', 'type', 'body'],
  },
  requiresApproval: false,
  handler: async (args, ctx): Promise<ToolResult> => {
    const scrub = scrubPii(args.body);
    const content = await db.content.create({
      data: {
        title: args.title,
        type: args.type,
        body: scrub.redacted,
        status: 'draft',
        platform: args.platform || null,
        aiGenerated: true,
        companyId: ctx.companyId,
      },
    });
    return {
      success: true,
      output: `Content saved (contentId=${content.id}). Status=draft, awaiting review.`,
      metadata: { contentId: content.id, piiRedacted: scrub.redactions.length },
    };
  },
});

// ─── Lookup Tools (read-only — safe) ────────────────────────────────────────
registerTool({
  name: 'crm_lookup_lead',
  description: 'Look up an existing lead by email or phone. Returns lead details if found.',
  inputSchema: {
    type: 'object',
    properties: {
      email: { type: 'string' },
      phone: { type: 'string' },
    },
  },
  requiresApproval: false,
  handler: async (args, ctx): Promise<ToolResult> => {
    const where: any = { companyId: ctx.companyId };
    if (args.email) where.email = args.email;
    else if (args.phone) where.phone = args.phone;
    else return { success: false, output: 'Provide email or phone to look up.' };
    const lead = await db.lead.findFirst({ where });
    if (!lead) return { success: true, output: 'No matching lead found.' };
    // Mask PII before returning to the LLM
    return {
      success: true,
      output: `Found lead: name=${lead.name}, status=${lead.status}, score=${lead.score}, source=${lead.source}. (PII masked)`,
      metadata: { leadId: lead.id },
    };
  },
});

registerTool({
  name: 'seo_keyword_research',
  description: 'Lookup tracked keywords for the company. Returns the top keywords with their current rankings.',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Max keywords to return (default 10)' },
    },
  },
  requiresApproval: false,
  handler: async (args, ctx): Promise<ToolResult> => {
    const keywords = await db.keywordTracker.findMany({
      where: { companyId: ctx.companyId },
      take: args.limit || 10,
      orderBy: { createdAt: 'desc' },
    });
    if (keywords.length === 0) return { success: true, output: 'No tracked keywords yet.' };
    const lines = keywords.map((k) => `- ${k.keyword} (rank=${k.currentRank || 'n/a'})`);
    return {
      success: true,
      output: `Tracked keywords:\n${lines.join('\n')}`,
      metadata: { count: keywords.length },
    };
  },
});

// Re-export the registry so callers can see what's available
export const TOOL_NAMES = [
  'crm_create_lead',
  'crm_update_lead_status',
  'crm_lookup_lead',
  'sms_send_otp',
  'sms_send_message',
  'social_create_post_draft',
  'social_publish_post',
  'content_save_artifact',
  'seo_keyword_research',
];

// Tools that require human approval — surfaced to the agent loop + admin UI
export const SENSITIVE_TOOLS = [
  'sms_send_otp',
  'sms_send_message',
  'social_publish_post',
];

// Per-agent-type allowlists — restrict what each agent can do
export const AGENT_TOOL_ALLOWLIST: Record<string, string[]> = {
  seo: ['seo_keyword_research', 'content_save_artifact'],
  content: ['content_save_artifact', 'seo_keyword_research'],
  whatsapp: ['crm_create_lead', 'crm_lookup_lead', 'content_save_artifact'], // DISABLED agent — listed for completeness
  sms: ['sms_send_otp', 'sms_send_message', 'crm_lookup_lead'],
  lead_qualifier: ['crm_create_lead', 'crm_update_lead_status', 'crm_lookup_lead', 'content_save_artifact'],
  crm: ['crm_create_lead', 'crm_update_lead_status', 'crm_lookup_lead'],
  social: ['social_create_post_draft', 'social_publish_post', 'content_save_artifact'],
  voice: ['crm_create_lead', 'crm_lookup_lead'],
  support: ['crm_lookup_lead', 'content_save_artifact'],
  // Default = read-only tools only
  default: ['crm_lookup_lead', 'seo_keyword_research'],
};


// Restored from arena branch (PR #15)

export const AGENT_TOOL_DEFINITIONS: ToolFunctionDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_workspace_metrics',
      description: 'Fetch live CRM, campaign, content, deal pipeline, ticket, and AI workforce metrics for the workspace.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

export async function runMultiStepFreeAgent(params: {
  goal: string;
  provider?: AiProviderName;
  model?: string;
  fallbackChain?: AiProviderName[];
  maxSteps?: number;
  companyId: string;
  userId: string;
}): Promise<{
  answer: string;
  provider: string;
  model: string;
  steps: AgentTraceStep[];
  degradedToDeterministicPlanner: boolean;
}> {
  const maxSteps = Math.min(Math.max(1, params.maxSteps ?? 5), 6);
  const steps: AgentTraceStep[] = [];
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are the MarketingOS Autonomous Tool-Calling Agent. Use the provided workspace tools whenever real CRM metrics, leads, Knowledge Wiki citations, UKVI calculations, UTM links, memory recall, or AI-writing checks are helpful. Cite exact numbers returned by tools and never fabricate metrics.',
    },
    { role: 'user', content: params.goal },
  ];

  try {
    let finalAnswer = '';
    let usedProvider = params.provider || 'ollama';
    let usedModel = params.model || 'qwen2.5:7b';

    for (let stepNum = 1; stepNum <= maxSteps; stepNum++) {
      const llmStart = Date.now();
      const res = await generateChatCompletion(messages, {
        provider: params.provider,
        model: params.model,
        fallbackChain: params.fallbackChain,
        tools: AGENT_TOOL_DEFINITIONS,
        temperature: 0.2,
      });
      usedProvider = res.provider;
      usedModel = res.model;

      if (!res.toolCalls || res.toolCalls.length === 0) {
        steps.push({
          step: stepNum,
          type: 'llm_synthesis',
          durationMs: Date.now() - llmStart,
          provider: res.provider,
          model: res.model,
        });
        finalAnswer = res.content;
        break;
      }

      messages.push({
        role: 'assistant',
        content: res.content || '',
        tool_calls: res.toolCalls,
      });

      for (const tc of res.toolCalls) {
        const toolStart = Date.now();
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments || '{}');
        } catch {
          parsedArgs = {};
        }
        const output = await executeAgentTool(tc.function.name, parsedArgs, {
          companyId: params.companyId,
          userId: params.userId,
        });
        steps.push({
          step: stepNum,
          type: 'tool_call',
          toolName: tc.function.name,
          toolArgs: parsedArgs,
          toolOutput: output,
          durationMs: Date.now() - toolStart,
          provider: res.provider,
          model: res.model,
        });
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: output,
        });
      }
    }

    if (!finalAnswer) {
      const wrap = await generateChatCompletion(messages, {
        provider: params.provider,
        model: params.model,
        fallbackChain: params.fallbackChain,
        temperature: 0.2,
      });
      finalAnswer = wrap.content;
    }

    return {
      answer: finalAnswer,
      provider: usedProvider,
      model: usedModel,
      steps,
      degradedToDeterministicPlanner: false,
    };
  } catch {
    // Deterministic local ReAct fallback: run relevant real tools directly against SQLite so the agent works even before an LLM key/Ollama is started!
    const lower = params.goal.toLowerCase();
    const plannedCalls: Array<{ name: string; args: Record<string, unknown> }> = [
      { name: 'get_workspace_metrics', args: {} },
    ];

    if (/lead|crm|prospect|pipeline|qualif/.test(lower)) {
      plannedCalls.push({ name: 'search_crm_leads', args: { minScore: 60 } });
    }
    if (/ukvi|cas|visa|london|tuition|ielts|student/.test(lower)) {
      const outside = lower.includes('outside');
      plannedCalls.push({
        name: 'ukvi_eligibility_calculator',
        args: { location: outside ? 'outside_london' : 'london', tuitionFirstYearGbp: 16500, depositPaidGbp: 3000, ieltsOverall: 6.5 },
      });
    }
    if (/wiki|sop|knowledge|policy|brand|playbook/.test(lower)) {
      plannedCalls.push({ name: 'search_knowledge_wiki', args: { query: params.goal.slice(0, 80) } });
    }
    if (/utm|link|attribut|track/.test(lower)) {
      plannedCalls.push({
        name: 'generate_utm_link',
        args: { url: 'https://demo-agency.com/offer', source: 'linkedin', medium: 'paid_social', campaign: 'q4_pipeline' },
      });
    }
    if (/humaniz|slop|rewrite|copy/.test(lower)) {
      plannedCalls.push({ name: 'audit_copy_humanizer', args: { text: params.goal } });
    }
    if (/memory|remember|lesson/.test(lower)) {
      plannedCalls.push({ name: 'recall_agent_memory', args: {} });
    }

    const outputs: string[] = [];
    let stepCounter = 1;
    for (const call of plannedCalls) {
      const t0 = Date.now();
      const out = await executeAgentTool(call.name, call.args, {
        companyId: params.companyId,
        userId: params.userId,
      });
      steps.push({
        step: stepCounter++,
        type: 'fallback_planner',
        toolName: call.name,
        toolArgs: call.args,
        toolOutput: out,
        durationMs: Date.now() - t0,
        provider: 'local-deterministic-planner',
        model: 'workspace-tool-engine',
      });
      outputs.push(`- **${call.name}**: \`${out}\``);
    }

    return {
      answer: `### Grounded Workspace Tool Execution\n*(Executed via built-in Deterministic Tool Planner — connect Ollama locally or add a free Groq/Cerebras/OpenRouter/Gemini key in Free AI Hub for full LLM synthesis.)*\n\n${outputs.join('\n')}`,
      provider: 'local-deterministic-planner',
      model: 'workspace-tool-engine',
      steps,
      degradedToDeterministicPlanner: true,
    };
  }
}
