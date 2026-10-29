import { randomBytes } from 'node:crypto';
import { safeFetchText, type SafeTextResponse } from '@/lib/ssrf';
import type { FieldStatus, HealthCheck, SetupStep } from './contract';

export class SetupError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'SetupError';
  }
}

export type VerificationResult = { status: FieldStatus; note: string };
export type Answers = Record<string, { value: string | null; status: FieldStatus; note?: string }>;

type TextFetcher = (url: string, init?: RequestInit & { timeoutMs?: number; maxResponseBytes?: number }) => Promise<SafeTextResponse>;

function graphBase(): string {
  const version = process.env.META_GRAPH_API_VERSION || 'v19.0';
  if (!/^v\d{1,2}\.\d$/.test(version)) throw new SetupError('The Meta Graph API version is not configured correctly.', 503);
  return `https://graph.facebook.com/${version}`;
}

/** Validate the value itself before making any provider requests. */
export function validateField(step: SetupStep, raw: unknown): string {
  if (typeof raw !== 'string') throw new SetupError('Enter a value or choose Skip.');
  const value = raw.trim();
  if (!value) throw new SetupError('Enter a value or choose Skip.');
  if (value.length > (step.secret ? 8192 : 2048) || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new SetupError('The value is too long or contains invalid characters.');
  }
  if (step.kind === 'page_id' && !/^\d{15,16}$/.test(value)) {
    throw new SetupError('The Facebook Page ID must contain 15–16 digits.');
  }
  if (step.kind === 'numeric_id' && !/^\d{5,32}$/.test(value)) {
    throw new SetupError('Enter the numeric ID (5–32 digits), not a phone number or name.');
  }
  if (step.kind === 'phone' && !/^\+[1-9]\d{1,14}$/.test(value)) {
    throw new SetupError('Enter a phone number in E.164 format, for example +8801712345678.');
  }
  if (step.kind === 'choice' && !step.choices?.includes(value)) {
    throw new SetupError('Choose one of the listed providers or skip this step.');
  }
  if (step.kind === 'url') {
    let url: URL;
    try { url = new URL(value); } catch { throw new SetupError('Enter a valid public HTTPS URL.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) {
      throw new SetupError('Use an HTTPS URL without credentials, a non-standard port, query string, or fragment.');
    }
    return url.toString();
  }
  // Access tokens are sent in an Authorization header; reject whitespace to
  // prevent header errors and accidental multi-line credential submissions.
  if (['pageToken', 'whatsappToken', 'messengerToken'].includes(step.id) && /\s/.test(value)) {
    throw new SetupError('An access token cannot contain whitespace.');
  }
  return value;
}

async function metaGet(path: string, token: string, fetcher: typeof fetch): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetcher(`${graphBase()}${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
      cache: 'no-store',
    });
  } catch (error) {
    if (error instanceof SetupError) throw error;
    throw new SetupError('Meta could not be reached. Try again or skip this integration.', 503);
  }
  if (!response.ok) {
    if (response.status === 429 || response.status >= 500) {
      throw new SetupError('Meta is temporarily unavailable or rate-limited. Try again later.', 503);
    }
    throw new SetupError('Meta rejected this token or its permissions. Check the credential and API version.', 422);
  }
  const json = await response.json().catch(() => null);
  if (!json || typeof json !== 'object' || Array.isArray(json) || typeof json.id !== 'string') {
    throw new SetupError('Meta did not return an identity for this credential.', 422);
  }
  return json as Record<string, unknown>;
}

/**
 * Meta's debug_token endpoint requires input_token in its query string. Never
 * log the URL or provider response. Failure to introspect is NOT proof that a
 * token is long-lived; report the lifetime as unknown instead.
 */
async function inspectTokenLifetime(token: string, answers: Answers, fetcher: typeof fetch): Promise<string> {
  const appId = answers.appId?.value;
  const appSecret = answers.appSecret?.value;
  if (!appId || !appSecret) return 'Token lifetime was not checked (Meta App ID and secret are needed).';
  let data: Record<string, unknown> | null = null;
  try {
    const url = `${graphBase()}/debug_token?input_token=${encodeURIComponent(token)}`;
    const response = await fetcher(url, {
      headers: { Authorization: `Bearer ${appId}|${appSecret}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000), redirect: 'error', cache: 'no-store',
    });
    if (!response.ok) return 'Meta accepted the token, but its lifetime could not be checked.';
    const result = await response.json() as { data?: unknown };
    if (result?.data && typeof result.data === 'object' && !Array.isArray(result.data)) data = result.data as Record<string, unknown>;
  } catch {
    return 'Meta accepted the token, but its lifetime could not be checked.';
  }
  if (!data || typeof data.is_valid !== 'boolean') return 'Meta accepted the token, but its lifetime could not be checked.';
  if (!data.is_valid) throw new SetupError('Meta reports that this token is not valid. Please replace it.', 422);
  if (data.app_id && String(data.app_id) !== appId) throw new SetupError('The token belongs to a different Meta app. Check the App ID and token.', 422);
  const expires = typeof data.expires_at === 'number' ? data.expires_at : null;
  const issued = typeof data.issued_at === 'number' ? data.issued_at : null;
  if (expires === 0) return 'Meta reports no token expiry; permissions can still be revoked.';
  if (expires !== null && expires > 0) {
    if (issued !== null && expires - issued <= 24 * 60 * 60) {
      throw new SetupError('Meta reports a short-lived token. Use Meta’s access-token tools and select Extend Access Token, then try again.', 422);
    }
    if (expires * 1000 - Date.now() <= 24 * 60 * 60 * 1000) {
      throw new SetupError('This Meta token expires within 24 hours. Renew or replace it before continuing.', 422);
    }
    return `Meta reports an expiry on ${new Date(expires * 1000).toISOString().slice(0, 10)}; permissions can still be revoked.`;
  }
  return 'Meta accepted the token, but its lifetime could not be checked.';
}

export async function verifyMetaToken(
  stepId: 'pageToken' | 'whatsappToken' | 'messengerToken',
  token: string,
  answers: Answers,
  fetcher: typeof fetch = fetch,
): Promise<VerificationResult> {
  const phoneId = answers.phoneId?.value;
  const path = stepId === 'whatsappToken' && phoneId
    ? `/${encodeURIComponent(phoneId)}?fields=id,quality_rating`
    : '/me?fields=id,name';
  const identity = await metaGet(path, token, fetcher);
  const expected = stepId === 'pageToken' ? answers.pageId?.value : stepId === 'whatsappToken' ? phoneId : null;
  if (expected && identity.id !== expected) {
    throw new SetupError(stepId === 'pageToken'
      ? 'The token is not for the supplied Facebook Page ID.'
      : 'The token did not return the supplied WhatsApp Phone Number ID.', 422);
  }
  const lifetime = await inspectTokenLifetime(token, answers, fetcher);
  if (!expected && stepId !== 'messengerToken') {
    return { status: 'unverified', note: `Meta accepted the token, but its corresponding ID was skipped. ${lifetime}` };
  }
  return { status: 'verified', note: `Meta accepted the credential. ${lifetime}` };
}

export async function verifyWebhook(url: string, token: string, fetcher: TextFetcher = safeFetchText): Promise<VerificationResult> {
  const challenge = randomBytes(20).toString('hex');
  const target = new URL(url);
  target.searchParams.set('hub.mode', 'subscribe');
  target.searchParams.set('hub.verify_token', token);
  target.searchParams.set('hub.challenge', challenge);
  let response: SafeTextResponse;
  try {
    // safeFetchText re-resolves and pins a public IP, blocks redirects and
    // private addresses, limits the response, and does not log the URL.
    response = await fetcher(target.toString(), { method: 'GET', timeoutMs: 8000, maxResponseBytes: 1024 });
  } catch {
    throw new SetupError('Webhook is unreachable or is not a permitted public HTTPS destination.', 503);
  }
  if (response.status !== 200 || await response.text() !== challenge) {
    throw new SetupError('Webhook must return HTTP 200 with the exact hub.challenge for this verify token.', 422);
  }
  return { status: 'verified', note: 'The HTTPS webhook returned the expected verification challenge.' };
}

export async function verifyField(step: SetupStep, value: string, answers: Answers): Promise<VerificationResult> {
  if (step.id === 'pageToken' || step.id === 'whatsappToken' || step.id === 'messengerToken') {
    return verifyMetaToken(step.id, value, answers);
  }
  if (step.id === 'webhookToken') {
    const url = answers.webhookUrl?.value;
    if (!url) throw new SetupError('Enter a webhook URL before adding a verify token, or skip this step.');
    return verifyWebhook(url, value);
  }
  if (step.id === 'crmKey' && !answers.crmProvider?.value) throw new SetupError('Choose a CRM provider first, or skip this step.');
  if ((step.id === 'paymentAccountId' || step.id === 'paymentSecret') && !answers.paymentProvider?.value) {
    throw new SetupError('Choose a payment provider first, or skip this step.');
  }
  if (step.id === 'webhookUrl') return { status: 'format_valid', note: 'HTTPS format checked; reachability will be checked with the verify token.' };
  if (step.secret) return { status: 'stored', note: 'Encrypted and saved; live verification is not available for this field.' };
  return { status: 'format_valid', note: 'Format checked; provider ownership has not been verified.' };
}

export async function runHealthChecks(answers: Answers): Promise<HealthCheck[]> {
  const checkedAt = new Date().toISOString();
  const tasks = [
    { id: 'facebook' as const, present: Boolean(answers.pageId?.value && answers.pageToken?.value), run: () => verifyMetaToken('pageToken', answers.pageToken!.value!, answers) },
    { id: 'whatsapp' as const, present: Boolean(answers.phoneId?.value && answers.whatsappToken?.value), run: () => verifyMetaToken('whatsappToken', answers.whatsappToken!.value!, answers) },
    { id: 'webhook' as const, present: Boolean(answers.webhookUrl?.value && answers.webhookToken?.value), run: () => verifyWebhook(answers.webhookUrl!.value!, answers.webhookToken!.value!) },
    { id: 'messenger' as const, present: Boolean(answers.messengerToken?.value), run: () => verifyMetaToken('messengerToken', answers.messengerToken!.value!, answers) },
  ];
  return Promise.all(tasks.map(async (task): Promise<HealthCheck> => {
    if (!task.present) return { id: task.id, status: 'skipped', detail: 'Not configured or a required field was skipped.', checkedAt };
    try {
      const result = await task.run();
      return { id: task.id, status: result.status === 'verified' ? 'verified' : 'failed', detail: result.note, checkedAt };
    } catch (error) {
      return {
        id: task.id,
        status: error instanceof SetupError && error.status === 503 ? 'unavailable' : 'failed',
        detail: error instanceof SetupError ? error.message : 'Verification could not be completed.',
        checkedAt,
      };
    }
  }));
}
