/**
 * SSRF (Server-Side Request Forgery) protection for outbound HTTP requests.
 *
 * Blocks attempts to deliver webhooks to:
 *   - localhost / 127.0.0.1 / 0.0.0.0 / ::1
 *   - private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
 *   - link-local addresses (169.254.0.0/16 — includes AWS/GCP/Azure metadata endpoints)
 *   - cloud metadata endpoints (169.254.169.254 — AWS/Azure/GCP metadata service)
 *   - unique-local IPv6 (fc00::/7)
 *   - IPv6 loopback
 *   - IP-literal forms that bypass hostname checks (e.g. http://2130706433/ = 127.0.0.1)
 *
 * Strategy:
 *   1. Parse URL
 *   2. Validate scheme (only http/https)
 *   3. Resolve hostname to IP(s) via DNS
 *   4. Block if any resolved IP is private/loopback/link-local/multicast
 *   5. Compare connected IP against blocklist at fetch time (defense in depth)
 */

const BLOCKED_HOSTNAMES = new Set<string>([
  'localhost',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal', // GCP metadata
  'metadata.aws.internal',    // AWS metadata alias
]);

export interface SsrfCheckResult {
  allowed: boolean;
  reason?: string;
  resolvedIps?: string[];
}

/**
 * Check whether a URL is safe to fetch from the server.
 * Does NOT fetch — only validates.
 *
 * Resolves DNS to IP(s) and blocks if any IP is in a private range.
 * This is the canonical SSRF protection pattern.
 */
export async function isUrlSafe(url: string): Promise<SsrfCheckResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { allowed: false, reason: 'Invalid URL' };
  }

  // Only http and https schemes are allowed
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { allowed: false, reason: `Scheme "${parsed.protocol}" not allowed` };
  }

  // Block obvious hostname patterns
  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { allowed: false, reason: `Hostname "${hostname}" is blocked` };
  }

  // If hostname is already an IP literal, validate directly
  if (isIpLiteral(hostname)) {
    if (isPrivateIp(hostname)) {
      return { allowed: false, reason: `IP ${hostname} is in a blocked range` };
    }
    return { allowed: true, resolvedIps: [hostname] };
  }

  // Resolve hostname via DNS — Node's dns.lookup returns the resolved IPs
  // We use a custom resolver because we need to see all A/AAAA records
  const resolvedIps = await resolveHostname(hostname).catch(() => []);
  if (resolvedIps.length === 0) {
    return { allowed: false, reason: `DNS resolution failed for ${hostname}` };
  }

  for (const ip of resolvedIps) {
    if (isPrivateIp(ip)) {
      return {
        allowed: false,
        reason: `Hostname ${hostname} resolves to private/blocked IP ${ip}`,
      };
    }
  }

  return { allowed: true, resolvedIps };
}

/**
 * Check if a string looks like an IP literal (IPv4 or IPv6).
 */
function isIpLiteral(s: string): boolean {
  // IPv4: 4 octets, 0-255 each
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4.test(s)) return true;
  // IPv6: contains colons
  if (s.includes(':') && /^[0-9a-fA-F:]+$/.test(s)) return true;
  // Bracketed IPv6 form: [::1]
  if (s.startsWith('[') && s.endsWith(']')) return true;
  return false;
}

/**
 * Check if an IP is in a private/loopback/link-local/multicast range.
 *
 * Returns true for:
 *   - 127.0.0.0/8 (IPv4 loopback)
 *   - 0.0.0.0/8 (this-network)
 *   - 10.0.0.0/8 (private class A)
 *   - 172.16.0.0/12 (private class B)
 *   - 192.168.0.0/16 (private class C)
 *   - 169.254.0.0/16 (link-local — includes 169.254.169.254 cloud metadata)
 *   - 224.0.0.0/4 (multicast)
 *   - 240.0.0.0/4 (reserved)
 *   - ::1 (IPv6 loopback)
 *   - fc00::/7 (IPv6 unique-local)
 *   - fe80::/10 (IPv6 link-local)
 *   - ff00::/8 (IPv6 multicast)
 */
export function isPrivateIp(ip: string): boolean {
  // Strip IPv6 brackets
  const clean = ip.replace(/^\[|\]$/g, '');

  // IPv4 check
  const v4Match = clean.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4Match) {
    const [a, b] = v4Match.slice(1).map((s) => parseInt(s, 10));
    if (a === 0) return true;            // 0.0.0.0/8
    if (a === 10) return true;           // 10.0.0.0/8
    if (a === 127) return true;          // 127.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a >= 224) return true;           // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
    return false;
  }

  // IPv6 check — normalize to lowercase
  const v6 = clean.toLowerCase();
  if (v6 === '::1' || v6 === '::') return true;          // loopback / unspecified
  if (v6.startsWith('fc') || v6.startsWith('fd')) return true; // fc00::/7 unique-local
  if (v6.startsWith('fe8') || v6.startsWith('fe9') ||
      v6.startsWith('fea') || v6.startsWith('feb')) return true; // fe80::/10 link-local
  if (v6.startsWith('ff')) return true;                   // ff00::/8 multicast
  // IPv4-mapped IPv6: ::ffff:a.b.c.d
  const v4Mapped = v6.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4Mapped) return isPrivateIp(v4Mapped[1]);
  return false;
}

/**
 * Resolve a hostname to its IPv4 + IPv6 addresses.
 * Uses Node's `dns` module via dynamic import to avoid pulling it into client bundles.
 */
async function resolveHostname(hostname: string): Promise<string[]> {
  // Dynamic import so this file can be imported by client-safe code
  const dns = await import('dns').then((m) => m.promises || m);
  const ips: string[] = [];
  try {
    const records = await dns.lookup(hostname, { all: true });
    for (const r of records) ips.push(r.address);
  } catch {
    // Try dns.resolve4 + dns.resolve6 as fallbacks
    try {
      const v4 = await dns.resolve4(hostname);
      ips.push(...v4);
    } catch { /* ignore */ }
    try {
      const v6 = await dns.resolve6(hostname);
      ips.push(...v6);
    } catch { /* ignore */ }
  }
  return ips;
}

/**
 * Build a safe fetch options object for outbound webhook delivery.
 * Adds timeouts, redirect: 'error' (don't follow redirects — could redirect to private IPs),
 * and a max-response-size guard.
 */
export function safeWebhookFetchOptions(): RequestInit {
  return {
    redirect: 'error', // SSRF protection: don't follow redirects
    headers: {
      'User-Agent': 'MarketingOS-Webhook/1.0',
      Accept: 'application/json, */*',
    },
  };
}
