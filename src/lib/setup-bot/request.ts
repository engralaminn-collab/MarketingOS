import { createHash, timingSafeEqual } from 'node:crypto';
import { getSessionUser, type SessionUser } from '@/lib/auth';
import { isSecureTransport, rateLimiter } from '@/lib/security';
import { SetupError } from './validation';

const ROLES = new Set(['super_admin', 'superadmin', 'company_owner', 'admin', 'client_user']);

/** In production the trusted reverse proxy must terminate HTTPS and set this header. */
function requireSecureTransport(req: Request): void {
  if (!isSecureTransport(req)) throw new SetupError('A secure HTTPS connection is required.', 426);
}

export async function setupActor(req: Request): Promise<SessionUser> {
  requireSecureTransport(req);
  // Only browser sessions, not long-lived API keys or ambient cookies, may edit
  // an onboarding draft. The explicit Authorization header also prevents CSRF.
  if (!/^Bearer\s+\S+$/i.test(req.headers.get('authorization') || '')) throw new SetupError('Please sign in to continue.', 401);
  const actor = await getSessionUser(req);
  if (!actor?.userId || !actor.companyId || !actor.sessionId) throw new SetupError('Please sign in with an active company account.', 401);
  if (!ROLES.has(actor.role)) throw new SetupError('Only a client or company administrator can manage setup.', 403);
  const limit = rateLimiter(`setup-bot:${actor.userId}`, { maxRequests: 60, windowMs: 60_000 });
  if (!limit.allowed) throw new SetupError('Too many setup requests. Please wait a moment.', 429);
  return actor;
}

/** Read a bounded request body even when Content-Length is absent or forged. */
export async function readJson(req: Request, limit = 64 * 1024): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > limit) throw new SetupError('Request is too large.', 413);
  if (!req.body) throw new SetupError('A JSON body is required.');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new SetupError('Request is too large.', 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new SetupError('A valid JSON body is required.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SetupError('A JSON object is required.');
  return value as Record<string, unknown>;
}

export function requireKeys(body: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(body).some((key) => !allowed.includes(key))) throw new SetupError('Unsupported request field.');
}

/** Constant-time token check. No service token is exposed to the browser. */
export function requireServiceToken(req: Request): void {
  requireSecureTransport(req);
  const configured = process.env.ADMIN_SERVICE_TOKEN || '';
  if (configured.length < 32) throw new SetupError('ADMIN_SERVICE_TOKEN is not configured.', 503);
  const supplied = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || '';
  const digest = (value: string) => createHash('sha256').update(value).digest();
  if (!supplied || !timingSafeEqual(digest(configured), digest(supplied))) throw new SetupError('Unauthorized.', 401);
}
