import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { setupActor } from '@/lib/setup-bot/request';
import { eraseManagedSetup } from '@/lib/setup-bot/privacy';
import { SetupError } from '@/lib/setup-bot/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Explicit company-wide erasure; remote project copies require separate removal. */
export async function DELETE(req: Request) {
  try {
    const actor = await setupActor(req);
    if (!['super_admin', 'superadmin', 'company_owner', 'admin'].includes(actor.role)) throw new SetupError('Only a company administrator can erase imported setup.', 403);
    if (req.headers.get('x-confirm-setup-erasure') !== 'yes') throw new SetupError('Explicit erasure confirmation is required.', 400);
    await db.$transaction(async (tx) => {
      const exporting = await tx.setupSession.count({ where: { companyId: actor.companyId, status: 'exporting' } });
      if (exporting) throw new SetupError('A handoff is in progress. Wait before deleting setup data.', 409);
      await eraseManagedSetup(tx, actor.companyId);
      await tx.auditLog.create({ data: {
        companyId: actor.companyId, userId: actor.userId, action: 'setup.erased', resource: 'setup',
        details: 'Local setup data and unchanged setup-managed credentials erased. Remote copies require separate erasure.',
      } });
    });
    return NextResponse.json({ success: true, remoteDeletionRequired: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof SetupError ? error.message : 'Unable to erase setup data. Contact an administrator.' }, { status: error instanceof SetupError ? error.status : 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
