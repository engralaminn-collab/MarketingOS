// @ts-nocheck
/**
 * TASK 2: Public Service Plane — Customer Portal API
 *
 * GET /api/v1/customer/portal — returns customer's portal data
 * (their projects, API keys, usage, service catalog)
 *
 * Customers see ONLY their own data. No internal workforce info.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, ok } from '@/lib/v1-middleware';
import { sanitizedJson } from '@/lib/sanitization';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  // Get customer's data only (scoped to companyId)
  const [apiKeyCount, integrationCount, campaignCount, contentCount, leadCount] = await Promise.all([
    db.apiKey.count({ where: { companyId: ctx.companyId } }),
    db.integration.count({ where: { companyId: ctx.companyId } }),
    db.campaign.count({ where: { companyId: ctx.companyId } }),
    db.content.count({ where: { companyId: ctx.companyId } }),
    db.lead.count({ where: { companyId: ctx.companyId } }),
  ]);

  // Service catalog — what services are available
  const services = [
    { id: 'ai_chat', name: 'AI Chat', description: 'Conversational AI for customer support', available: true },
    { id: 'ai_content', name: 'AI Content Generation', description: 'Automated content creation', available: true },
    { id: 'ai_knowledge', name: 'AI Knowledge Search', description: 'Semantic search over documents', available: true },
    { id: 'ai_leads', name: 'AI Lead Scoring', description: 'Predictive lead qualification', available: true },
    { id: 'ai_voice', name: 'AI Voice Assistant', description: 'Bangla + English voice AI', available: false },
    { id: 'ai_automation', name: 'AI Workflow Automation', description: 'Event-driven automation', available: true },
    { id: 'ai_predictions', name: 'Predictive Analytics', description: 'ML-powered marketing predictions', available: true },
    { id: 'ai_discovery', name: 'AI Project Discovery', description: 'Automatic capability assessment', available: true },
  ];

  // Customer portal data — NO internal workforce info
  return sanitizedJson({
    portal: {
      companyId: ctx.companyId,
      user: { email: ctx.email, role: ctx.role },
      stats: {
        apiKeys: apiKeyCount,
        integrations: integrationCount,
        campaigns: campaignCount,
        content: contentCount,
        leads: leadCount,
      },
      services,
      usage: {
        aiMinutesUsed: 0, // tracked in AgentUsageDaily
        storageMb: 0,
        apiCallsThisMonth: 0,
      },
    },
    // Explicitly NOT including: agentCount, agentProfiles, modelRegistry,
    // internal prompts, toolDefinitions, workforceHierarchy
  });
}
