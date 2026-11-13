import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ipFromRequest, rateLimiter } from '@/lib/security';
import { readJson, requireServiceToken } from '@/lib/setup-bot/request';
import { importSetup, parseImportPayload } from '@/lib/setup-bot/import';
import { payloadFingerprint } from '@/lib/setup-bot/handoff';
import { SetupError } from '@/lib/setup-bot/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Project IDs are MarketingOS company IDs. This is a trusted server-to-server endpoint. */
export async function POST(req: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const limit = rateLimiter(`setup-import:${ipFromRequest(req)}`, { maxRequests: 20, windowMs: 60_000 });
    if (!limit.allowed) throw new SetupError('Too many requests.', 429);
    requireServiceToken(req);
    const { projectId } = await context.params;
    if (!projectId || projectId.length > 128) throw new SetupError('Invalid project.', 400);
    const payload = parseImportPayload(await readJson(req));
    const company = await db.company.findUnique({ where: { id: projectId }, select: { id: true, isActive: true } });
    if (!company?.isActive) throw new SetupError('Project not found.', 404);
    const user = await db.user.findFirst({
      where: {
        OR: [{ email: payload.client_id.toLowerCase() }, { phone: payload.client_id }],
        isActive: true, companyUsers: { some: { companyId: projectId } },
      }, select: { id: true },
    });
    if (!user) throw new SetupError('The client is not a member of this project.', 403);
    const key = req.headers.get('idempotency-key');
    if (key && !/^[a-f0-9]{64}$/.test(key)) throw new SetupError('Invalid idempotency key.');
    const fingerprint = key ? payloadFingerprint(payload) : null;
    // External claims of verification are never trusted. The receiving project
    // stores credentials encrypted but does not activate any provider account.
    const duplicate = await db.$transaction(async (tx) => {
      const previous = key ? await tx.setupHandoffReceipt.findUnique({ where: { companyId_idempotencyKey: { companyId: projectId, idempotencyKey: key } } }) : null;
      if (previous) {
        if (previous.payloadFingerprint !== fingerprint) throw new SetupError('Idempotency key was reused for different data.', 409);
        return true;
      }
      await importSetup(tx, projectId, payload, 'unverified', false);
      if (key && fingerprint) await tx.setupHandoffReceipt.create({ data: { companyId: projectId, idempotencyKey: key, payloadFingerprint: fingerprint } });
      await tx.auditLog.create({ data: {
        companyId: projectId, userId: user.id, action: 'setup.service_import', resource: 'setup',
        details: 'Setup received from trusted service; provider connections remain unverified.',
      } });
      return false;
    });
    return NextResponse.json({ success: true, verification: 'unverified' }, { status: duplicate ? 200 : 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    // Import payloads contain credentials: do not log exception details.
    return NextResponse.json({ error: error instanceof SetupError ? error.message : 'Setup import failed.' }, { status: error instanceof SetupError ? error.status : 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
