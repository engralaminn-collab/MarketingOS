import { decryptSecret, encryptSecret } from '@/lib/credentials';
import { BASE_STEPS, type HealthCheck, type SetupSnapshot, type SetupStep } from './contract';
import type { Answers } from './validation';
import { SetupError } from './validation';

export const IDLE_MS = 30 * 60_000;

export interface SetupData {
  schema: 1;
  customSteps: SetupStep[];
  answers: Answers;
  checks: HealthCheck[];
  lastCheckedAt: string | null;
  returnToReview: boolean;
  handoff: 'verified' | 'partial' | null;
  handoffTarget: 'local' | 'remote' | null;
}

export interface SessionRow {
  id: string;
  companyId: string;
  userId: string;
  currentStep: string;
  status: string;
  encryptedData: string;
  version: number;
  lastActivityAt: Date;
  completedAt: Date | null;
}

function configuredCustomSteps(): SetupStep[] {
  const raw = process.env.SETUP_CUSTOM_FIELDS?.trim();
  if (!raw) return [];
  let entries: unknown;
  try { entries = JSON.parse(raw); } catch { throw new SetupError('SETUP_CUSTOM_FIELDS must be valid JSON.', 503); }
  if (!Array.isArray(entries) || entries.length > 12) throw new SetupError('SETUP_CUSTOM_FIELDS must be an array of at most 12 fields.', 503);
  const ids = new Set<string>();
  return entries.map((entry: unknown): SetupStep => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new SetupError('Invalid custom setup field configuration.', 503);
    const field = entry as Record<string, unknown>;
    const key = typeof field.key === 'string' ? field.key : '';
    const en = typeof field.labelEn === 'string' ? field.labelEn.trim() : '';
    const bn = typeof field.labelBn === 'string' ? field.labelBn.trim() : en;
    if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(key) || !en || en.length > 120 || !bn || bn.length > 120 || ids.has(key.toLowerCase())) {
      throw new SetupError('Custom field keys must be unique, and labels must be present and at most 120 characters.', 503);
    }
    ids.add(key.toLowerCase());
    if (field.secret !== undefined && typeof field.secret !== 'boolean') throw new SetupError('Custom field secret must be true or false.', 503);
    const allowedKinds = ['text', 'numeric_id', 'phone', 'url'];
    if (field.kind !== undefined && (typeof field.kind !== 'string' || !allowedKinds.includes(field.kind))) {
      throw new SetupError('Invalid custom field kind.', 503);
    }
    const secret = field.secret === true;
    return {
      id: `custom_${key}`, group: 'extra', kind: secret ? 'secret' : (field.kind as SetupStep['kind'] || 'text'), secret,
      label: { bn, en },
      hint: { bn: 'প্রযোজ্য না হলে স্কিপ করুন। সংরক্ষিত তথ্য এনক্রিপ্ট করা হবে।', en: 'Skip if not applicable. Saved values are encrypted.' },
    };
  });
}

export function newSetupData(): SetupData {
  return { schema: 1, customSteps: configuredCustomSteps(), answers: {}, checks: [], lastCheckedAt: null, returnToReview: false, handoff: null, handoffTarget: null };
}

export function encodeData(data: SetupData): string {
  try { return encryptSecret(JSON.stringify(data)); } catch { throw new SetupError('Secure setup storage is unavailable. Configure CREDENTIAL_ENCRYPTION_KEY.', 503); }
}

export function decodeData(encrypted: string): SetupData {
  try {
    const value = JSON.parse(decryptSecret(encrypted)) as SetupData;
    if (value.schema !== 1 || !Array.isArray(value.customSteps) || !value.answers || !Array.isArray(value.checks)) throw new Error('Invalid setup data');
    return value;
  } catch {
    throw new SetupError('The setup draft cannot be decrypted. Check the credential encryption key.', 503);
  }
}

export function stepsFor(data: SetupData): SetupStep[] { return [...BASE_STEPS, ...data.customSteps]; }

export function toSnapshot(row: SessionRow, data: SetupData): SetupSnapshot {
  const steps = stepsFor(data);
  const answers = steps.flatMap((step) => {
    const answer = data.answers[step.id];
    if (!answer) return [];
    return [{ stepId: step.id, status: answer.status, value: step.secret ? null : answer.value, isSecret: Boolean(step.secret), note: answer.note }];
  });
  return {
    status: row.status as SetupSnapshot['status'],
    currentStep: row.currentStep,
    steps,
    answers,
    checks: data.checks,
    lastCheckedAt: data.lastCheckedAt,
    completedAt: row.completedAt?.toISOString() || null,
    lastActivityAt: row.lastActivityAt.toISOString(),
    version: row.version,
    handoff: data.handoff,
    handoffTarget: data.handoffTarget || null,
  };
}

export function firstUnanswered(data: SetupData): string | null {
  return stepsFor(data).find((step) => !data.answers[step.id])?.id || null;
}

/** Invalidate checks when a dependency changes, so old success cannot be reused. */
export function invalidateChecks(data: SetupData, changedId: string): void {
  data.checks = [];
  data.lastCheckedAt = null;
  const relatedIdentity: Record<string, string> = { pageToken: 'pageId', whatsappToken: 'phoneId', webhookToken: 'webhookUrl' };
  const identity = data.answers[relatedIdentity[changedId]];
  if (identity?.value) {
    identity.status = 'format_valid';
    identity.note = 'Format checked; the related connection must be verified again.';
  }
  const dependents: Record<string, string[]> = {
    pageId: ['pageToken'], phoneId: ['whatsappToken'], webhookUrl: ['webhookToken'],
    appId: ['pageToken', 'whatsappToken', 'messengerToken'], appSecret: ['pageToken', 'whatsappToken', 'messengerToken'],
    crmProvider: ['crmKey'], paymentProvider: ['paymentAccountId', 'paymentSecret'],
  };
  for (const id of dependents[changedId] || []) {
    const answer = data.answers[id];
    if (answer?.value) {
      answer.status = 'unverified';
      answer.note = 'A related field changed; verify this integration again.';
    }
  }
}

/**
 * Never replay an existing secret to a newly selected destination or provider.
 * When one changes, require the user to explicitly provide/skip its dependent
 * fields again rather than silently handing the old credential to it.
 */
export function clearChangedDestinations(data: SetupData, id: string, previous: string | null, next: string | null): void {
  if (!previous || previous === next) return;
  const dependents: Record<string, string[]> = {
    webhookUrl: ['webhookToken'],
    crmProvider: ['crmKey'],
    paymentProvider: ['paymentAccountId', 'paymentSecret'],
  };
  for (const dependent of dependents[id] || []) delete data.answers[dependent];
}
