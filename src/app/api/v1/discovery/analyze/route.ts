// @ts-nocheck
/**
 * TASK 4: Project AI Discovery — analyzes a customer's authorized API or
 * repository to identify existing AI capabilities.
 *
 * POST /api/v1/discovery/analyze
 * Body: { projectUrl, apiCredentials, repositoryUrl, manifest }
 *
 * Returns: capability report with EXISTING/WORKING/PARTIAL/BROKEN/UNVERIFIED/MISSING
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { sanitizedJson } from '@/lib/sanitization';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body) return badRequest('body required');

  const { projectUrl, apiCredentials, repositoryUrl, manifest } = body;

  const capabilities: any[] = [];

  // Mode A: API Discovery — inspect authorized API endpoints
  if (projectUrl && apiCredentials) {
    try {
      const res = await fetch(`${projectUrl}/api/health`, {
        headers: { Authorization: `Bearer ${apiCredentials}` },
        signal: AbortSignal.timeout(10000),
      });
      capabilities.push({
        capability: 'API Health Check',
        status: res.ok ? 'WORKING' : 'BROKEN',
        evidence: `HTTP ${res.status} from ${projectUrl}/api/health`,
      });

      // Check for common AI endpoints
      const aiEndpoints = ['/api/ai/chat', '/api/ai/generate', '/api/ai/agents', '/api/v1/ai/chat'];
      for (const ep of aiEndpoints) {
        try {
          const r = await fetch(`${projectUrl}${ep}`, {
            headers: { Authorization: `Bearer ${apiCredentials}` },
            signal: AbortSignal.timeout(5000),
          });
          if (r.ok) {
            capabilities.push({ capability: `AI Endpoint: ${ep}`, status: 'EXISTING', evidence: `HTTP ${r.status}` });
          }
        } catch { /* timeout or 404 */ }
      }
    } catch (e: any) {
      capabilities.push({ capability: 'API Connectivity', status: 'BROKEN', evidence: e?.message?.slice(0, 200) });
    }
  }

  // Mode C: Repository Analysis — check manifest
  if (manifest) {
    const aiDeps = ['openai', 'anthropic', 'langchain', 'z-ai-web-dev-sdk', '@google/generative-ai', 'ollama'];
    for (const dep of aiDeps) {
      if (manifest.dependencies && manifest.dependencies[dep]) {
        capabilities.push({ capability: `AI Dependency: ${dep}`, status: 'EXISTING', evidence: `version ${manifest.dependencies[dep]}` });
      }
    }
    const aiRoutes = manifest.routes?.filter((r: string) => r.includes('/ai/') || r.includes('/chat') || r.includes('/voice')) || [];
    for (const route of aiRoutes) {
      capabilities.push({ capability: `AI Route: ${route}`, status: 'UNVERIFIED', evidence: 'Found in manifest' });
    }
  }

  // Mode B: Connector Discovery (placeholder — requires customer SDK)
  if (repositoryUrl) {
    capabilities.push({ capability: 'Repository Analysis', status: 'UNVERIFIED', evidence: 'Repository analysis requires connector SDK' });
  }

  // Identify missing capabilities
  const foundCapabilities = capabilities.map(c => c.capability);
  const missing = [
    'AI Chat / Conversation',
    'AI Content Generation',
    'AI Knowledge Search',
    'AI Lead Scoring',
    'AI Voice Assistant',
    'AI Workflow Automation',
    'Predictive Analytics',
  ].filter(c => !foundCapabilities.some(f => f.includes(c.split(' ')[1] || c)));

  for (const m of missing) {
    capabilities.push({ capability: m, status: 'MISSING', evidence: 'Not detected in authorized discovery' });
  }

  return sanitizedJson({
    projectId: body.projectId || 'unknown',
    analyzedAt: new Date().toISOString(),
    capabilities,
    summary: {
      existing: capabilities.filter(c => c.status === 'EXISTING').length,
      working: capabilities.filter(c => c.status === 'WORKING').length,
      partial: capabilities.filter(c => c.status === 'PARTIAL').length,
      broken: capabilities.filter(c => c.status === 'BROKEN').length,
      unverified: capabilities.filter(c => c.status === 'UNVERIFIED').length,
      missing: capabilities.filter(c => c.status === 'MISSING').length,
    },
  });
}
