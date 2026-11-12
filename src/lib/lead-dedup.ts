/**
 * MarketingOS — Automatic lead deduplication (Requirement 8).
 *
 * Computes a normalized dedup hash from business name + website + location,
 * so the same business discovered from different sources is linked rather
 * than duplicated. Tenant-scoped.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Normalize a business name: lowercase, strip legal suffixes, collapse spaces.
 */
export function normalizeBusinessName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|limited|corp|corporation|co|company|plc|gmbh|sarl|sa|pvt|private)\b\.?/g, '')
    .replace(/\b(the|and|&)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize a website URL: strip protocol, www, trailing slash.
 */
export function normalizeWebsite(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .trim();
}

/**
 * Compute a dedup hash from business identity fields (tenant-scoped).
 * Includes companyId so the same business discovered by two different tenants
 * doesn't collide on the globally-unique dedupHash field.
 * Prioritizes website (strongest unique identifier) when available — if two
 * records share the same business name + website, they are the same business
 * regardless of how the location was formatted. Falls back to name + location
 * when no website is available.
 */
export function computeDedupHash(opts: {
  businessName: string;
  website?: string | null;
  location?: string | null;
  email?: string | null;
  companyId: string;
}): string {
  const namePart = normalizeBusinessName(opts.businessName);
  const websitePart = opts.website ? normalizeWebsite(opts.website) : '';
  const locationPart = (opts.location || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const emailPart = (opts.email || '').toLowerCase().trim();

  // Primary key: tenant + name + website (most stable). Fallback: tenant + name + location + email.
  const raw = websitePart
    ? `${opts.companyId}|${namePart}|${websitePart}`
    : `${opts.companyId}|${namePart}|${locationPart}|${emailPart}`;
  // Simple deterministic hash (djb2) — sufficient for dedup keys
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash + raw.charCodeAt(i)) & 0xffffffff;
  }
  return `dedup_${(hash >>> 0).toString(16)}`;
}

/**
 * Check for an existing lead or discovered lead with the same dedup hash.
 * Returns the existing record if found, null otherwise.
 */
export async function findDuplicate(companyId: string, dedupHash: string) {
  const [existingLead, existingDiscovered] = await Promise.all([
    prisma.lead.findUnique({ where: { dedupHash } }).catch(() => null),
    prisma.discoveredLead.findUnique({ where: { dedupHash } }).catch(() => null),
  ]);
  // Ensure tenant match
  if (existingLead && existingLead.companyId !== companyId) return null;
  if (existingDiscovered && existingDiscovered.companyId !== companyId) return null;
  return existingDiscovered || existingLead || null;
}

/**
 * Mark a lead as a duplicate of another (sets status to "duplicate").
 */
export async function markAsDuplicate(leadId: string, canonicalLeadId: string, companyId: string) {
  return prisma.lead.updateMany({
    where: { id: leadId, companyId },
    data: { status: 'duplicate', notes: `Duplicate of lead ${canonicalLeadId}` },
  });
}
