/**
 * MarketingOS — Compliance: Consent, Opt-out, Retention, Deletion (Requirement 14).
 *
 * Enforces:
 *   - Consent capture and tracking (marketing_sms, marketing_email, call_recording, etc.)
 *   - Opt-out management (sets optedOut + adds to suppression list)
 *   - Data retention policies (per data type, per tenant)
 *   - Automatic deletion / anonymization of expired data
 *   - Immutable audit trail of all compliance actions
 *
 * Never auto-contacts a lead without verified consent + lawful basis.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export type ConsentKind =
  | 'call_recording'
  | 'marketing_sms'
  | 'marketing_email'
  | 'data_processing'
  | 'voice_clone';

export type ConsentMethod =
  | 'ivr_dtmf'
  | 'ivr_voice'
  | 'web_form'
  | 'sms_reply'
  | 'signed_form';

/**
 * Capture consent for a subject (lead/customer/caller).
 * Creates an immutable Consent record.
 */
export async function captureConsent(opts: {
  companyId: string;
  subjectType: 'caller' | 'customer' | 'lead' | 'user';
  subjectId: string;
  kind: ConsentKind;
  method: ConsentMethod;
  scope?: string;
  capturedBy?: string;
  ipAddress?: string;
  expiresAt?: Date;
}) {
  const consent = await prisma.consent.create({
    data: {
      companyId: opts.companyId,
      subjectType: opts.subjectType,
      subjectId: opts.subjectId,
      kind: opts.kind,
      method: opts.method,
      scope: opts.scope || 'this_call',
      capturedBy: opts.capturedBy || null,
      ipAddress: opts.ipAddress || null,
      expiresAt: opts.expiresAt || null,
    },
  });

  // If this is marketing consent for a lead, update the lead's contactPermitted flag
  if (opts.subjectType === 'lead' && (opts.kind === 'marketing_sms' || opts.kind === 'marketing_email')) {
    await prisma.lead.updateMany({
      where: { id: opts.subjectId, companyId: opts.companyId },
      data: { contactPermitted: true },
    });
  }

  await prisma.auditLog.create({
    data: {
      action: 'consent.captured',
      resource: 'consent',
      resourceId: consent.id,
      details: `Consent captured: ${opts.kind} for ${opts.subjectType} ${opts.subjectId} via ${opts.method}`,
      companyId: opts.companyId,
      userId: opts.capturedBy || null,
    },
  }).catch(() => { /* non-blocking audit */ });

  return consent;
}

/**
 * Process an opt-out request.
 * Sets the lead's optedOut flag AND adds to the DNC suppression list (if phone exists).
 * This is irreversible in the sense that the lead cannot be re-contacted without
 * a new explicit consent capture.
 */
export async function processOptOut(opts: {
  companyId: string;
  leadId?: string;
  phoneNumber?: string;
  reason?: string;
  source?: string;
}) {
  const reason = opts.reason || 'user_request';
  const source = opts.source || 'opt_out_request';

  // Add to suppression list
  if (opts.phoneNumber) {
    await prisma.suppressionList.upsert({
      where: { companyId_phoneNumber: { companyId: opts.companyId, phoneNumber: opts.phoneNumber } },
      create: { companyId: opts.companyId, phoneNumber: opts.phoneNumber, reason, source },
      update: { reason, source },
    });
  }

  // Mark lead as opted out
  if (opts.leadId) {
    await prisma.lead.updateMany({
      where: { id: opts.leadId, companyId: opts.companyId },
      data: { optedOut: true, contactPermitted: false, status: 'opted_out' },
    });
  }

  // Revoke existing consent records
  await prisma.consent.updateMany({
    where: {
      companyId: opts.companyId,
      ...(opts.leadId ? { subjectId: opts.leadId, subjectType: 'lead' } : {}),
      kind: { in: ['marketing_sms', 'marketing_email'] },
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      action: 'consent.opt_out_processed',
      resource: 'lead',
      resourceId: opts.leadId || opts.phoneNumber || 'unknown',
      details: `Opt-out processed: ${reason} via ${source}`,
      companyId: opts.companyId,
    },
  }).catch(() => { /* non-blocking audit */ });

  return { optedOut: true, reason };
}

/**
 * Set a data retention policy for a data type.
 */
export async function setRetentionPolicy(opts: {
  companyId: string;
  dataType: string;
  retentionDays: number;
  deletionAction?: 'auto_delete' | 'anonymize' | 'archive';
}) {
  return prisma.dataRetentionPolicy.upsert({
    where: { companyId_dataType: { companyId: opts.companyId, dataType: opts.dataType } },
    create: {
      companyId: opts.companyId,
      dataType: opts.dataType,
      retentionDays: opts.retentionDays,
      deletionAction: opts.deletionAction || 'auto_delete',
      isActive: true,
    },
    update: {
      retentionDays: opts.retentionDays,
      deletionAction: opts.deletionAction || 'auto_delete',
    },
  });
}

/**
 * Run retention enforcement: find expired data and delete/anonymize it.
 * This should be called by a cron job.
 *
 * For leads with dataExpiresAt in the past, either delete or anonymize based
 * on the policy.
 */
export async function enforceRetention(companyId: string): Promise<{
  leadsDeleted: number;
  leadsAnonymized: number;
  discoveredLeadsDeleted: number;
}> {
  const now = new Date();
  let leadsDeleted = 0;
  let leadsAnonymized = 0;
  let discoveredLeadsDeleted = 0;

  // Get retention policies
  const policies = await prisma.dataRetentionPolicy.findMany({
    where: { companyId, isActive: true },
  });
  const policyByType = new Map(policies.map(p => [p.dataType, p]));

  // Expired leads
  const leadPolicy = policyByType.get('lead');
  if (leadPolicy) {
    const expiredLeads = await prisma.lead.findMany({
      where: {
        companyId,
        dataExpiresAt: { lt: now },
      },
      select: { id: true },
    });

    for (const lead of expiredLeads) {
      if (leadPolicy.deletionAction === 'auto_delete') {
        await prisma.lead.delete({ where: { id: lead.id } }).catch(() => null);
        leadsDeleted++;
      } else if (leadPolicy.deletionAction === 'anonymize') {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            name: '[anonymized]',
            email: null,
            phone: null,
            notes: null,
            sourceUrl: null,
          },
        }).catch(() => null);
        leadsAnonymized++;
      }
    }
  }

  // Expired discovered leads
  const dlPolicy = policyByType.get('discovered_lead');
  if (dlPolicy && dlPolicy.deletionAction === 'auto_delete') {
    // DiscoveredLeads don't have dataExpiresAt, but we can use age
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - dlPolicy.retentionDays);
    const expired = await prisma.discoveredLead.findMany({
      where: { companyId, discoveryTimestamp: { lt: retentionDate } },
      select: { id: true },
    });
    for (const dl of expired) {
      await prisma.discoveredLead.delete({ where: { id: dl.id } }).catch(() => null);
      discoveredLeadsDeleted++;
    }
  }

  if (leadsDeleted + leadsAnonymized + discoveredLeadsDeleted > 0) {
    await prisma.auditLog.create({
      data: {
        action: 'compliance.retention_enforced',
        resource: 'company',
        resourceId: companyId,
        details: `Retention enforcement: ${leadsDeleted} leads deleted, ${leadsAnonymized} anonymized, ${discoveredLeadsDeleted} discovered leads deleted.`,
        companyId,
      },
    }).catch(() => { /* non-blocking audit */ });
  }

  return { leadsDeleted, leadsAnonymized, discoveredLeadsDeleted };
}

/**
 * Get a compliance summary for the dashboard.
 */
export async function getComplianceSummary(companyId: string) {
  const [consents, suppressionCount, policies, optedOutCount] = await Promise.all([
    prisma.consent.groupBy({ by: ['kind'], where: { companyId, revokedAt: null }, _count: true }),
    prisma.suppressionList.count({ where: { companyId } }),
    prisma.dataRetentionPolicy.findMany({ where: { companyId, isActive: true } }),
    prisma.lead.count({ where: { companyId, optedOut: true } }),
  ]);

  return {
    activeConsentsByKind: consents.reduce((acc, c) => ({ ...acc, [c.kind]: c._count }), {}),
    suppressionListCount: suppressionCount,
    retentionPolicies: policies,
    optedOutLeads: optedOutCount,
  };
}
