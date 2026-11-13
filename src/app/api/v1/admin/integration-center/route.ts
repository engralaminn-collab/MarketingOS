/**
 * GET /api/v1/admin/integration-center — global super admin integration center
 *   (provider registry health, free/paid tier monitoring, global audit logs)
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, ok, forbidden } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin && ctx.role !== 'company_owner' && ctx.role !== 'admin') {
    return forbidden('Super admin or company admin access required');
  }
  const [providers, integrations, globalAuditLogs, costEvents] = await Promise.all([
    db.dataProvider.findMany({ orderBy: { sourceReliability: 'desc' }, take: 50 }),
    db.integration.findMany({
      where: ctx.isSuperAdmin ? {} : { companyId: ctx.companyId },
      include: { secrets: true, healthChecks: { orderBy: { checkedAt: 'desc' }, take: 1 } },
      take: 50,
    }),
    db.auditLog.findMany({
      where: ctx.isSuperAdmin ? {} : { companyId: ctx.companyId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    db.costEvent.findMany({
      where: ctx.isSuperAdmin ? {} : { companyId: ctx.companyId },
      orderBy: { timestamp: 'desc' },
      take: 20,
    }),
  ]);

  // Mask secrets before returning
  const maskedIntegrations = integrations.map(i => ({
    ...i,
    secrets: i.secrets.map(s => ({ ...s, ciphertext: '[REDACTED]', maskedValue: s.maskedValue })),
  }));

  return ok({
    providers,
    integrations: maskedIntegrations,
    recentAuditLogs: globalAuditLogs,
    recentCostEvents: costEvents,
    isGlobalView: ctx.isSuperAdmin,
  });
}
