// @ts-nocheck
/**
 * TASK 5: AI Gap Analysis — recommends ALO LABS services based on discovery results.
 *
 * POST /api/v1/discovery/recommend
 * Body: { capabilities: [...], projectType: "website|crm|ecommerce|saas" }
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { sanitizedJson } from '@/lib/sanitization';

export const dynamic = 'force-dynamic';

const SERVICE_CATALOG = [
  { service: 'AI Chat', addresses: ['AI Chat / Conversation', 'AI Endpoint: /api/ai/chat'], description: 'Conversational AI for customer support and sales' },
  { service: 'AI Content Generation', addresses: ['AI Content Generation', 'AI Endpoint: /api/ai/generate'], description: 'Automated content creation for blogs, social, email' },
  { service: 'AI Knowledge Search', addresses: ['AI Knowledge Search', 'AI Knowledge'], description: 'Semantic search over business documents' },
  { service: 'AI Lead Scoring', addresses: ['AI Lead Scoring', 'Lead Classification'], description: 'Predictive lead qualification and scoring' },
  { service: 'AI Voice Assistant', addresses: ['AI Voice Assistant', 'AI Voice'], description: 'Bangla + English voice AI for calls' },
  { service: 'AI Workflow Automation', addresses: ['AI Workflow Automation', 'AI Endpoint: /api/ai/agents'], description: 'Event-driven marketing automation' },
  { service: 'Predictive Analytics', addresses: ['Predictive Analytics', 'Business Intelligence'], description: 'ML-powered marketing predictions' },
  { service: 'AI CRM Assistant', addresses: ['CRM', 'Customer Intelligence'], description: 'AI-powered CRM management' },
  { service: 'AI Project Discovery', addresses: ['Project Discovery'], description: 'Automatic AI capability assessment' },
  { service: 'AI Business Intelligence', addresses: ['Business Intelligence', 'Analytics'], description: 'Marketing intelligence dashboard' },
];

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.capabilities) return badRequest('capabilities array required');

  const foundCapabilities = body.capabilities.map((c: any) => c.capability || c);
  const recommendations: any[] = [];

  for (const service of SERVICE_CATALOG) {
    const hasCapability = service.addresses.some(a => foundCapabilities.some((f: string) => f.includes(a)));
    if (!hasCapability) {
      recommendations.push({
        service: service.service,
        description: service.description,
        reason: `Missing: ${service.addresses.join(', ')}`,
        priority: recommendations.length + 1,
        estimatedImpact: service.service.includes('Voice') ? 'HIGH' : service.service.includes('Predictive') ? 'HIGH' : 'MEDIUM',
      });
    }
  }

  const integrationPlan = {
    phase1: recommendations.filter(r => r.priority <= 3).map(r => `Connect ${r.service}`),
    phase2: recommendations.filter(r => r.priority > 3 && r.priority <= 6).map(r => `Connect ${r.service}`),
    phase3: recommendations.filter(r => r.priority > 6).map(r => `Connect ${r.service}`),
  };

  return sanitizedJson({
    projectType: body.projectType || 'unknown',
    analyzedAt: new Date().toISOString(),
    foundCapabilities: foundCapabilities.length,
    missingCapabilities: recommendations.length,
    recommendations,
    integrationPlan,
    approvalRequired: 'All integrations require customer authorization before execution',
  });
}
