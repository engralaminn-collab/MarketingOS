import { createHmac } from 'node:crypto';
import { decryptSecret } from '@/lib/credentials';
import { safeFetchText, type SafeTextResponse } from '@/lib/ssrf';
import type { SetupPayload } from './import';
import type { Answers } from './validation';
import { SetupError } from './validation';

type TextFetcher = (url: string, init?: RequestInit & { timeoutMs?: number; maxResponseBytes?: number }) => Promise<SafeTextResponse>;

/** Only administrator-controlled environment values can choose a destination. */
export function externalHandoffConfigured(): boolean {
  return Boolean(process.env.SETUP_HANDOFF_BASE_URL?.trim());
}

function handoffConfig(companyId: string): { url: string; token: string } {
  const base = process.env.SETUP_HANDOFF_BASE_URL?.trim() || '';
  const token = process.env.ADMIN_SERVICE_TOKEN || '';
  if (token.length < 32 || /[\u0000-\u0020\u007f]/.test(token)) throw new SetupError('External handoff requires a valid ADMIN_SERVICE_TOKEN.', 503);
  let origin: URL;
  try { origin = new URL(base); } catch { throw new SetupError('SETUP_HANDOFF_BASE_URL must be an HTTPS origin.', 503); }
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.port || origin.search || origin.hash || origin.pathname !== '/') {
    throw new SetupError('SETUP_HANDOFF_BASE_URL must be an HTTPS origin without a path or credentials.', 503);
  }
  let mapping: unknown;
  try { mapping = JSON.parse(process.env.SETUP_HANDOFF_PROJECT_MAP || '{}'); } catch { throw new SetupError('SETUP_HANDOFF_PROJECT_MAP is invalid.', 503); }
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) throw new SetupError('SETUP_HANDOFF_PROJECT_MAP is invalid.', 503);
  const projectId = (mapping as Record<string, unknown>)[companyId];
  if (typeof projectId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(projectId)) throw new SetupError('This workspace has no external handoff project mapping.', 503);
  return { url: `${origin.origin}/api/v1/projects/${encodeURIComponent(projectId)}/import-setup`, token };
}

/** Stable across retries of the same draft, without exposing any credential in the key. */
export function handoffIdempotencyKey(sessionId: string, answers: Answers): string {
  const token = process.env.ADMIN_SERVICE_TOKEN || '';
  return createHmac('sha256', token).update(sessionId).update('\0').update(JSON.stringify(answers)).digest('hex');
}

/** Used by the receiving service to reject a reused idempotency key with different data. */
export function payloadFingerprint(payload: SetupPayload): string {
  const value = JSON.parse(JSON.stringify(payload)) as SetupPayload;
  value.setup_completed_at = '';
  const data = value.integrations;
  if (data.facebook.app_secret_encrypted) data.facebook.app_secret_encrypted = decryptSecret(data.facebook.app_secret_encrypted);
  if (data.crm.api_key_encrypted) data.crm.api_key_encrypted = decryptSecret(data.crm.api_key_encrypted);
  if (data.payment.secret_encrypted) data.payment.secret_encrypted = decryptSecret(data.payment.secret_encrypted);
  for (const field of Object.values(data.custom)) {
    if (field.value_encrypted) field.value_encrypted = decryptSecret(field.value_encrypted);
  }
  return createHmac('sha256', process.env.ADMIN_SERVICE_TOKEN || '').update(JSON.stringify(value)).digest('hex');
}

/**
 * Sends only after confirmation, over pinned public HTTPS. The service token is
 * in a header, never browser state or logs. A success acknowledgement is
 * required; timeout/rejection must not be mistaken for a completed handoff.
 */
export async function sendExternalHandoff(
  companyId: string,
  sessionId: string,
  answers: Answers,
  payload: SetupPayload,
  fetcher: TextFetcher = safeFetchText,
): Promise<void> {
  const { url, token } = handoffConfig(companyId);
  const json = JSON.stringify(payload);
  if (Buffer.byteLength(json, 'utf8') > 64 * 1024) throw new SetupError('Setup payload is too large for handoff.', 413);
  let response: SafeTextResponse;
  try {
    response = await fetcher(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': handoffIdempotencyKey(sessionId, answers) },
      body: json, timeoutMs: 12_000, maxResponseBytes: 4096,
    });
  } catch {
    throw new SetupError('The main project could not be reached. Your setup is saved; retry the handoff.', 502);
  }
  if (response.status !== 200 && response.status !== 201) {
    throw new SetupError('The main project did not accept the setup. Your draft is saved; retry the handoff.', 502);
  }
  const result = await response.json().catch(() => null) as { success?: unknown } | null;
  if (result?.success !== true) throw new SetupError('The main project did not acknowledge the setup. Your draft is saved.', 502);
}
