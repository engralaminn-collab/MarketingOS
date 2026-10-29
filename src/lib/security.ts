// ─── MarketingOS Security Utilities ────────────────────────────────────
// Rate limiting, input sanitization, audit logging, permission checks
// ───────────────────────────────────────────────────────────────────────────────

import { db } from "@/lib/db";

// ─── Rate Limiter ──────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const rateLimitCleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 60_000);
rateLimitCleanup.unref?.();

export interface RateLimitOptions {
  maxRequests?: number;
  windowMs?: number;
}

export function rateLimiter(
  ip: string,
  options: RateLimitOptions = {}
): { allowed: boolean; retryAfterMs: number } {
  const { maxRequests = 100, windowMs = 60_000 } = options;
  const key = `rl:${ip}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

// ─── Input Sanitization ────────────────────────────────────────────────────────

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bon\w+\s*=\s*\S+/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/data\s*:/gi, "")
    .replace(/vbscript\s*:/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ─── Audit Logging ─────────────────────────────────────────────────────────────

export interface AuditLogData {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: object;
  ipAddress?: string;
}

export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: data.userId || null,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId || null,
        details: data.details ? JSON.stringify(data.details) : null,
        ipAddress: data.ipAddress || null,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

// ─── Permission Validation ─────────────────────────────────────────────────────

export function validatePermission(
  userPermissions: Record<string, boolean>,
  requiredPermission: string
): boolean {
  if (userPermissions["super_admin"]) return true;
  return Boolean(userPermissions[requiredPermission]);
}

// ─── IP Extraction ─────────────────────────────────────────────────────────────

export function ipFromRequest(request: Request): string {
  const headers = [
    "x-forwarded-for",
    "x-real-ip",
    "cf-connecting-ip",
    "x-client-ip",
    "true-client-ip",
  ];
  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      return value.split(",")[0].trim();
    }
  }
  return "127.0.0.1";
}
