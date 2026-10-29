import { db } from '@/lib/db';
import {
  generateChatCompletion,
  generateEmbeddingVector,
  type AiProviderName,
  type ChatMessage,
  type ToolFunctionDefinition,
} from '@/lib/ai-provider';
import { analyzeAiWritingTells } from '@/lib/ai-extensions';
import { cosineSimilarity } from '@/lib/free-ai-stack';

export interface AgentTraceStep {
  step: number;
  type: 'tool_call' | 'llm_synthesis' | 'fallback_planner';
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolOutput?: string;
  durationMs: number;
  provider?: string;
  model?: string;
}

export const AGENT_TOOL_DEFINITIONS: ToolFunctionDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_workspace_metrics',
      description: 'Fetch live CRM, campaign, content, deal pipeline, ticket, and AI workforce metrics for the workspace.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_crm_leads',
      description: 'Search workspace CRM leads by keyword, status, or minimum lead score.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Optional name, email, or company keyword' },
          status: { type: 'string', description: 'Optional status filter: new, contacted, qualified, converted, lost' },
          minScore: { type: 'number', description: 'Minimum lead score (0-100)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_knowledge_wiki',
      description: 'Semantic + keyword RAG search over workspace Knowledge Wiki nodes and SOPs with citations.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search question or topic' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_agent_memory',
      description: 'Unavailable: agent-managed memory requires governance and approval.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Memory category: episodic, procedural, preference, brand_rule' },
          content: { type: 'string', description: 'Concise factual note to remember' },
        },
        required: ['category', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recall_agent_memory',
      description: 'Retrieve previously stored workspace agent memories.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Optional category filter' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'audit_copy_humanizer',
      description: 'Detect AI-writing tells (blader/humanizer 24 rules) and return slop score + deterministic rewrite.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Draft copy to inspect' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_utm_link',
      description: 'Build a clean campaign attribution URL with utm_source, utm_medium, utm_campaign, and utm_content.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          source: { type: 'string' },
          medium: { type: 'string' },
          campaign: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['url', 'source', 'medium', 'campaign'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ukvi_eligibility_calculator',
      description: 'Calculate UK Student Route CAS maintenance funds (London vs Outside London), 28-day rule, and IELTS check.',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'london or outside_london' },
          tuitionFirstYearGbp: { type: 'number' },
          depositPaidGbp: { type: 'number' },
          ieltsOverall: { type: 'number' },
          degreeLevel: { type: 'string', description: 'foundation, undergraduate, or postgraduate' },
        },
        required: ['location', 'tuitionFirstYearGbp'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_weather_open_meteo',
      description: 'Get live weather for any city via Open-Meteo (free, keyless API) for geo-targeted campaigns.',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string' },
        },
        required: ['city'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compress_context_window',
      description: 'Compress long raw text or tool logs into high-signal bullet sentences (context-mode algorithm).',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          maxSentences: { type: 'number' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_content_draft',
      description: 'Save a new marketing draft (blog, email, post, ad) directly into the MarketingOS Content Library.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          type: { type: 'string', description: 'blog, post, email, ad' },
          body: { type: 'string' },
        },
        required: ['title', 'body'],
      },
    },
  },
];

export function compressContextText(text: string, maxSentences = 6) {
  const clean = text.replace(/\s+/g, ' ').trim();
  const originalChars = clean.length;
  const originalTokensEst = Math.ceil(originalChars / 4);
  const sentences = clean.split(/(?<=[.!?])\s+/).filter((s) => s.length > 15);
  if (sentences.length <= maxSentences) {
    return {
      compressed: clean,
      originalTokensEst,
      compressedTokensEst: originalTokensEst,
      savedPercent: 0,
    };
  }

  // Score sentences by term frequency + numeric/entity density + lead/tail position
  const freq = new Map<string, number>();
  for (const w of clean.toLowerCase().match(/[a-z]{4,}/g) || []) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  const scored = sentences.map((s, idx) => {
    const words = s.toLowerCase().match(/[a-z]{4,}/g) || [];
    let score = words.reduce((acc, w) => acc + Math.min(freq.get(w) || 0, 5), 0) / Math.max(1, words.length);
    if (/\d+%|\$\d+|£\d+|\b202\d\b/.test(s)) score += 2.2;
    if (idx === 0 || idx === sentences.length - 1) score += 1.5;
    return { idx, s, score };
  });

  const picked = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.idx - b.idx)
    .map((x) => x.s)
    .join(' ');
  const compressedTokensEst = Math.ceil(picked.length / 4);
  const savedPercent = Math.max(0, Math.round(((originalTokensEst - compressedTokensEst) / Math.max(1, originalTokensEst)) * 100));

  return {
    compressed: picked,
    originalTokensEst,
    compressedTokensEst,
    savedPercent,
  };
}

export async function executeAgentTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: { companyId: string; userId: string },
): Promise<string> {
  switch (toolName) {
    case 'get_workspace_metrics': {
      const [leads, contacts, deals, campaigns, contents, tickets, employees, wikiNodes] = await Promise.all([
        db.lead.count({ where: { companyId: ctx.companyId } }),
        db.contact.count({ where: { companyId: ctx.companyId } }),
        db.deal.aggregate({ where: { companyId: ctx.companyId }, _count: true, _sum: { value: true } }),
        db.campaign.count({ where: { companyId: ctx.companyId } }),
        db.content.count({ where: { companyId: ctx.companyId } }),
        db.ticket.count({ where: { companyId: ctx.companyId, status: { not: 'closed' } } }),
        db.employee.count({ where: { companyId: ctx.companyId } }),
        db.knowledgeNode.count({ where: { companyId: ctx.companyId, accessLevel: { in: ['public', 'company'] } } }),
      ]);
      return JSON.stringify({
        leads,
        contacts,
        dealsCount: deals._count,
        crmDealValueAllStages: deals._sum.value ?? 0,
        currency: 'unspecified',
        provenance: 'CRM entries, not verified revenue or campaign attribution',
        campaigns,
        contentItems: contents,
        openTickets: tickets,
        aiWorkforceEmployees: employees,
        knowledgeWikiNodes: wikiNodes,
      });
    }

    case 'search_crm_leads': {
      const q = typeof args.query === 'string' ? args.query.trim() : '';
      const status = typeof args.status === 'string' ? args.status.trim() : '';
      const minScore = typeof args.minScore === 'number' ? args.minScore : 0;
      const rows = await db.lead.findMany({
        where: {
          companyId: ctx.companyId,
          ...(status ? { status } : {}),
          ...(minScore > 0 ? { score: { gte: minScore } } : {}),
          ...(q
            ? {
                OR: [
                  { name: { contains: q } },
                  { email: { contains: q } },
                  { companyName: { contains: q } },
                ],
              }
            : {}),
        },
        orderBy: { score: 'desc' },
        take: 8,
        select: { id: true, name: true, email: true, companyName: true, status: true, score: true, source: true },
      });
      return JSON.stringify({ count: rows.length, leads: rows });
    }

    case 'search_knowledge_wiki': {
      const query = String(args.query || '').trim();
      const [nodes, sops, qEmbed] = await Promise.all([
        db.knowledgeNode.findMany({ where: { companyId: ctx.companyId, accessLevel: { in: ['public', 'company'] } }, take: 80 }),
        db.sop.findMany({ where: { companyId: ctx.companyId, departmentId: null, applicableRoles: '[]', isActive: true }, take: 30 }),
        generateEmbeddingVector(query),
      ]);
      const docs = [
        ...nodes.map((n) => ({ id: n.id, kind: 'wiki', title: n.title, category: n.category, text: n.content })),
        ...sops.map((s) => ({ id: s.id, kind: 'sop', title: s.name, category: s.category, text: `${s.description || ''}\n${s.steps}` })),
      ];
      const ranked = await Promise.all(
        docs.map(async (d) => {
          const dEmbed = await generateEmbeddingVector(`${d.title} ${d.text.slice(0, 600)}`);
          const sim = cosineSimilarity(qEmbed.vector, dEmbed.vector);
          const kwBoost = d.title.toLowerCase().includes(query.toLowerCase()) ? 0.25 : 0;
          return {
            citation: `[[${d.title}]]`,
            kind: d.kind,
            category: d.category,
            score: Number((sim + kwBoost).toFixed(3)),
            excerpt: d.text.slice(0, 260),
          };
        }),
      );
      ranked.sort((a, b) => b.score - a.score);
      return JSON.stringify({ topCitations: ranked.slice(0, 4) });
    }

    case 'save_agent_memory':
    case 'recall_agent_memory':
      return JSON.stringify({ error: 'Agent-managed memory is disabled until approval and access controls are implemented.' });

    case 'audit_copy_humanizer': {
      const report = analyzeAiWritingTells(String(args.text || ''));
      return JSON.stringify({
        aiSlopScore: report.aiSlopScore,
        detectedRuleCount: report.hits.length,
        hits: report.hits.map((h) => ({ rule: h.rule, matches: h.matches })),
        cleanRewrite: report.rewrittenDeterministic,
      });
    }

    case 'generate_utm_link': {
      try {
        const u = new URL(String(args.url || 'https://example.com'));
        u.searchParams.set('utm_source', String(args.source || 'linkedin').toLowerCase().replace(/\s+/g, '_'));
        u.searchParams.set('utm_medium', String(args.medium || 'social').toLowerCase().replace(/\s+/g, '_'));
        u.searchParams.set('utm_campaign', String(args.campaign || 'q4_launch').toLowerCase().replace(/\s+/g, '_'));
        if (args.content) {
          u.searchParams.set('utm_content', String(args.content).toLowerCase().replace(/\s+/g, '_'));
        }
        return JSON.stringify({ utmUrl: u.toString() });
      } catch {
        return JSON.stringify({ error: 'Invalid destination URL' });
      }
    }

    case 'ukvi_eligibility_calculator': {
      const isLondon = String(args.location || 'london').toLowerCase().includes('london') &&
        !String(args.location || '').toLowerCase().includes('outside');
      const monthlyRateGbp = isLondon ? 1334 : 1023; // UKVI Student Route 9-month maintenance
      const livingMaintenanceGbp = monthlyRateGbp * 9;
      const tuition = Math.max(0, Number(args.tuitionFirstYearGbp) || 16500);
      const deposit = Math.max(0, Number(args.depositPaidGbp) || 0);
      const unpaidTuitionGbp = Math.max(0, tuition - deposit);
      const totalBankFundsRequiredGbp = unpaidTuitionGbp + livingMaintenanceGbp;
      const ielts = Number(args.ieltsOverall) || 6.0;
      const degree = String(args.degreeLevel || 'postgraduate').toLowerCase();
      const minIelts = degree === 'foundation' ? 5.0 : 6.0;
      return JSON.stringify({
        studyLocation: isLondon ? 'Inner/Greater London' : 'Outside London',
        monthlyMaintenanceRateGbp: monthlyRateGbp,
        nineMonthMaintenanceGbp: livingMaintenanceGbp,
        remainingFirstYearTuitionGbp: unpaidTuitionGbp,
        totalCasBankFundsRequiredGbp: totalBankFundsRequiredGbp,
        twentyEightDayRule: 'Funds must be held continuously for at least 28 consecutive days; bank statement closing date must be within 31 days of visa application.',
        ihsEstimatePerYearGbp: 776,
        visaFeeOutsideUkGbp: 490,
        ieltsCheck: ielts >= minIelts ? `Meets typical CEFR B2 (${ielts} >= ${minIelts})` : `Below typical threshold (${ielts} < ${minIelts}) — consider Pre-Sessional English`,
      });
    }

    case 'get_weather_open_meteo': {
      const city = String(args.city || 'London').trim();
      try {
        const geoResp = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
          { signal: AbortSignal.timeout(4_000) },
        );
        if (geoResp.ok) {
          const geo = (await geoResp.json()) as { results?: Array<{ name: string; country: string; latitude: number; longitude: number }> };
          const loc = geo.results?.[0];
          if (loc) {
            const wxResp = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,wind_speed_10m`,
              { signal: AbortSignal.timeout(4_000) },
            );
            if (wxResp.ok) {
              const wx = (await wxResp.json()) as { current?: { temperature_2m?: number; wind_speed_10m?: number } };
              return JSON.stringify({
                city: loc.name,
                country: loc.country,
                temperatureC: wx.current?.temperature_2m,
                windKmh: wx.current?.wind_speed_10m,
                source: 'open-meteo-live',
              });
            }
          }
        }
      } catch {
        // Outbound host restricted in offline/sandboxed mode
      }
      return JSON.stringify({
        city,
        note: 'Open-Meteo outbound host restricted in current network; connect internet egress to fetch live telemetry.',
        source: 'offline-guard',
      });
    }

    case 'compress_context_window': {
      return JSON.stringify(
        compressContextText(String(args.text || ''), Number(args.maxSentences) || 5),
      );
    }

    case 'create_content_draft': {
      const title = String(args.title || 'Agent Draft').slice(0, 160);
      const type = ['blog', 'post', 'email', 'ad'].includes(String(args.type)) ? String(args.type) : 'post';
      const body = String(args.body || '').slice(0, 10_000);
      const created = await db.content.create({
        data: {
          title,
          type,
          status: 'draft',
          body,
          aiGenerated: true,
          creatorId: ctx.userId,
          companyId: ctx.companyId,
        },
        select: { id: true, title: true, type: true, status: true },
      });
      return JSON.stringify({ saved: true, content: created });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

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
