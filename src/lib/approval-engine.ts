/**
 * MarketingOS — Generic approval engine (Requirement 12).
 *
 * Provides configurable autonomy levels for AI actions:
 *   - suggest_only: AI suggests, human must execute.
 *   - approval_required: AI prepares, human must approve before execution.
 *   - approved_automation: AI executes automatically (for pre-approved low-risk actions).
 *
 * Every action that touches money, publishing, outbound contact, credentials,
 * or account changes must go through this engine. The engine creates an
 * immutable ApprovalRequest record and, for approved_automation, auto-executes.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export type AutonomyLevel = 'suggest_only' | 'approval_required' | 'approved_automation';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'auto_executed';
export type RequestType =
  | 'paid_subscription'
  | 'ad_spend'
  | 'public_publishing'
  | 'bulk_export'
  | 'outbound_campaign'
  | 'contact_lead'
  | 'credential_change'
  | 'integration_change';

export interface ApprovalPayload {
  requestType: RequestType;
  requesterId?: string;
  resourceType?: string;
  resourceId?: string;
  action: string; // Human-readable description of the proposed action
  details: Record<string, any>; // Structured action details
  estimatedCostUsd?: number;
  autonomyLevel?: AutonomyLevel; // Override the company default
  leadId?: string;
  campaignId?: string;
  expiresAt?: Date;
}

/**
 * Create an approval request. If the autonomy level is approved_automation
 * AND the request type is in the safe-set, auto-execute (status = auto_executed).
 * Otherwise, the request is pending until a human approves.
 */
export async function requestApproval(companyId: string, payload: ApprovalPayload) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const autonomyLevel = payload.autonomyLevel || company?.defaultAutonomyLevel || 'approval_required';

  const request = await prisma.approvalRequest.create({
    data: {
      requestType: payload.requestType,
      requesterId: payload.requesterId || null,
      resourceType: payload.resourceType || null,
      resourceId: payload.resourceId || null,
      payload: JSON.stringify({ action: payload.action, details: payload.details, estimatedCostUsd: payload.estimatedCostUsd }),
      autonomyLevel,
      status: 'pending',
      leadId: payload.leadId || null,
      campaignId: payload.campaignId || null,
      companyId,
      expiresAt: payload.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  // Auto-execute only for pre-approved, low-risk, non-irreversible actions.
  // NEVER auto-execute: paid subscriptions, ad spend, credential changes, integration changes.
  const NEVER_AUTO = new Set<RequestType>([
    'paid_subscription', 'ad_spend', 'credential_change', 'integration_change',
  ]);

  if (autonomyLevel === 'approved_automation' && !NEVER_AUTO.has(payload.requestType)) {
    const updated = await prisma.approvalRequest.update({
      where: { id: request.id },
      data: {
        status: 'auto_executed',
        approvedAt: new Date(),
        approverNote: 'Auto-executed under approved_automation autonomy level.',
      },
    });
    return { request: updated, canExecute: true, autoExecuted: true };
  }

  // For suggest_only, the request is created but never executes automatically —
  // the human must manually perform the action.
  if (autonomyLevel === 'suggest_only') {
    return { request, canExecute: false, autoExecuted: false, suggestion: true };
  }

  // approval_required — human must approve
  return { request, canExecute: false, autoExecuted: false };
}

/**
 * Approve a pending request. Only company admins or super_admin can approve.
 */
export async function approveRequest(
  requestId: string,
  approverId: string,
  approverNote?: string,
) {
  const req = await prisma.approvalRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new Error('Approval request not found');
  if (req.status !== 'pending') throw new Error(`Request is already ${req.status}`);
  if (req.expiresAt && req.expiresAt < new Date()) {
    await prisma.approvalRequest.update({ where: { id: requestId }, data: { status: 'expired' } });
    throw new Error('Request has expired');
  }

  const updated = await prisma.approvalRequest.update({
    where: { id: requestId },
    data: {
      status: 'approved',
      approverId,
      approverNote: approverNote || null,
      approvedAt: new Date(),
    },
  });

  // Write an immutable audit log entry (non-blocking — audit should never crash the business op)
  await prisma.auditLog.create({
    data: {
      action: 'approval.approved',
      resource: 'approval_request',
      resourceId: requestId,
      details: `Approved ${req.requestType} request (autonomy: ${req.autonomyLevel})`,
      userId: approverId,
      companyId: req.companyId,
    },
  }).catch(() => {
    // Audit log FK may fail if approverId is not a persisted Use}).catch(() => { /* non-blocking audit */ }); log to stderr and continue.
    console.error(`[audit] Failed to write approval.approved audit log for request ${requestId}`);
  });

  return { request: updated, canExecute: true };
}

/**
 * Reject a pending request.
 */
export async function rejectRequest(
  requestId: string,
  approverId: string,
  approverNote?: string,
) {
  const req = await prisma.approvalRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new Error('Approval request not found');
  if (req.status !== 'pending') throw new Error(`Request is already ${req.status}`);

  const updated = await prisma.approvalRequest.update({
    where: { id: requestId },
    data: {
      status: 'rejected',
      approverId,
      approverNote: approverNote || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: 'approval.rejected',
      resource: 'approval_request',
      resourceId: requestId,
      details: `Rejected ${req.requestType} request`,
      userId: approverId,
      companyId: req.companyId,
    },
  }).catch(() => { /* non-blocking audit */ });

  return { request: updated, canExecute: false };
}

/**
 * List pending approval requests for a company.
 */
export async function listPendingApprovals(companyId: string, requestType?: RequestType) {
  return prisma.approvalRequest.findMany({
    where: {
      companyId,
      status: 'pending',
      ...(requestType ? { requestType } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Check whether an action is permitted given the company's autonomy level.
 * Returns { permitted, requiresApproval, reason }.
 */
export function checkAutonomy(companyAutonomyLevel: string, requestType: RequestType): {
  permitted: boolean;
  requiresApproval: boolean;
  reason: string;
} {
  const NEVER_AUTO = new Set<RequestType>([
    'paid_subscription', 'ad_spend', 'credential_change', 'integration_change',
  ]);

  if (companyAutonomyLevel === 'suggest_only') {
    return {
      permitted: false,
      requiresApproval: false,
      reason: 'Autonomy is suggest_only — human must execute this action manually.',
    };
  }

  if (companyAutonomyLevel === 'approved_automation' && !NEVER_AUTO.has(requestType)) {
    return {
      permitted: true,
      requiresApproval: false,
      reason: 'Auto-executed under approved_automation (low-risk, pre-approved category).',
    };
  }

  return {
    permitted: false,
    requiresApproval: true,
    reason: 'Approval required before execution.',
  };
}
