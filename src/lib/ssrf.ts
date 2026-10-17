import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata.aws.internal',
]);

const MAX_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export interface SsrfCheckResult {
  allowed: boolean;
  reason?: string;
  resolvedIps?: string[];
}

export interface SafeTextResponse {
  readonly status: number;
  readonly statusText: string;
  readonly ok: boolean;
  readonly headers: Headers;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
}

export class SafeFetchError extends Error {
  constructor(message: string, readonly code: 'SSRF_BLOCKED' | 'TIMEOUT' | 'TOO_LARGE' | 'REDIRECT' | 'NETWORK' = 'NETWORK') {
    super(message);
    this.name = 'SafeFetchError';
  }
}

/** Validate an HTTP(S) URL, resolve all addresses, and reject non-public targets. */
export async function isUrlSafe(input: string): Promise<SsrfCheckResult> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { allowed: false, reason: 'Invalid URL' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { allowed: false, reason: 'Only HTTP and HTTPS URLs are supported' };
  }
  if (url.username || url.password) {
    return { allowed: false, reason: 'URL credentials are not allowed' };
  }

  const expectedPort = url.protocol === 'https:' ? '443' : '80';
  if (url.port && url.port !== expectedPort) {
    return { allowed: false, reason: 'Non-standard destination ports are not allowed' };
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost') ||
      /\.(?:local|internal|lan|home)$/.test(hostname)) {
    return { allowed: false, reason: 'Local and internal hostnames are not allowed' };
  }

  const ipVersion = isIP(hostname);
  if (ipVersion) {
    if (isPrivateIp(hostname)) {
      return { allowed: false, reason: 'Private, reserved, or local IP addresses are not allowed' };
    }
    return { allowed: true, resolvedIps: [hostname] };
  }

  const resolvedIps = await resolveHostname(hostname);
  if (resolvedIps.length === 0) {
    return { allowed: false, reason: `DNS resolution failed for ${hostname}` };
  }
  if (resolvedIps.some(isPrivateIp)) {
    return { allowed: false, reason: `Hostname ${hostname} resolves to a private or reserved IP` };
  }
  return { allowed: true, resolvedIps };
}

/**
 * Determine whether an IP is non-public. Invalid IP inputs are rejected too,
 * so callers can use this as a fail-closed check on DNS answers.
 */
export function isPrivateIp(input: string): boolean {
  const ip = input.replace(/^\[|\]$/g, '').split('%')[0];
  const version = isIP(ip);
  if (version === 0) return true;

  if (version === 4) {
    const octets = ip.split('.').map(Number);
    const [a, b] = octets;
    return a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 198 && (b === 18 || b === 19)) || // benchmarking
      (a === 192 && b === 0) || // IETF protocol assignments
      (a === 192 && b === 0 && octets[2] === 2) || // documentation
      (a === 198 && b === 51 && octets[2] === 100) || // documentation
      (a === 203 && b === 0 && octets[2] === 113) || // documentation
      a >= 224; // multicast and reserved
  }

  const bytes = expandIpv6(ip);
  if (!bytes) return true;

  const allZero = bytes.every((byte) => byte === 0);
  const loopback = bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1;
  if (allZero || loopback) return true;

  // IPv4-mapped and IPv4-compatible IPv6 addresses.
  const mapped = bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
  const compatible = bytes.slice(0, 12).every((byte) => byte === 0);
  if (mapped || compatible) return isPrivateIp(bytesToIpv4(bytes.slice(12)));

  // IPv6 unique-local, link-local, multicast, and documentation ranges.
  if ((bytes[0] & 0xfe) === 0xfc) return true; // fc00::/7
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true; // fe80::/10
  if (bytes[0] === 0xff) return true; // ff00::/8
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) return true; // 2001:db8::/32

  // Well-known NAT64 and 6to4 can encode an otherwise blocked IPv4 target.
  if (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b &&
      bytes.slice(4, 12).every((byte) => byte === 0)) {
    return isPrivateIp(bytesToIpv4(bytes.slice(12)));
  }
  if (bytes[0] === 0x20 && bytes[1] === 0x02) {
    return isPrivateIp(bytesToIpv4(bytes.slice(2, 6)));
  }
  // Teredo is a tunnelling mechanism whose embedded addresses are easy to misuse.
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0 && bytes[3] === 0) return true;
  return false;
}

/**
 * Resolve and pin DNS answers before connecting. Redirects are never followed,
 * response bodies are bounded, and only standard HTTP(S) ports are permitted.
 * This closes the common DNS-rebinding gap in validate-then-fetch patterns.
 */
export async function safeFetchText(
  input: string,
  init: RequestInit & { timeoutMs?: number; maxResponseBytes?: number } = {},
): Promise<SafeTextResponse> {
  const validation = await isUrlSafe(input);
  if (!validation.allowed || !validation.resolvedIps?.length) {
    throw new SafeFetchError(validation.reason || 'URL is not allowed', 'SSRF_BLOCKED');
  }

  const url = new URL(input);
  const timeoutMs = Math.min(Math.max(init.timeoutMs ?? 10_000, 1), MAX_TIMEOUT_MS);
  const maxResponseBytes = Math.min(Math.max(init.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES, 1), 10 * 1024 * 1024);
  const requestBody = await toRequestBody(init.body);
  if (requestBody && requestBody.byteLength > 512 * 1024) {
    throw new SafeFetchError('Request body exceeds the outbound request size limit', 'TOO_LARGE');
  }

  const headers = new Headers(init.headers);
  if (!headers.has('user-agent')) headers.set('user-agent', 'MarketingOS-SafeFetcher/1.0');
  headers.set('accept-encoding', 'identity');
  if (requestBody && !headers.has('content-length')) headers.set('content-length', String(requestBody.byteLength));

  const method = (init.method || (requestBody ? 'POST' : 'GET')).toUpperCase();
  const transport = url.protocol === 'https:' ? httpsRequest : httpRequest;
  const { timeoutMs: _timeoutMs, maxResponseBytes: _maxBytes, ...requestInit } = init;
  void _timeoutMs;
  void _maxBytes;

  return new Promise<SafeTextResponse>((resolve, reject) => {
    let settled = false;
    let request: ReturnType<typeof httpRequest>;
    let abortListener: (() => void) | undefined;
    const finishError = (error: Error) => {
      if (settled) return;
      settled = true;
      if (init.signal && abortListener) init.signal.removeEventListener('abort', abortListener);
      reject(error);
    };

    const addresses = validation.resolvedIps!;
    const pinnedLookup = (
      _hostname: string,
      options: { family?: number; all?: boolean },
      callback: (...args: any[]) => void,
    ) => {
      const candidates = addresses.filter((address) => !options.family || isIP(address) === options.family);
      if (candidates.length === 0) {
        callback(new Error('No validated DNS address is available for the requested address family'));
        return;
      }
      if (options.all) {
        callback(null, candidates.map((address) => ({ address, family: isIP(address) })));
      } else {
        callback(null, candidates[0], isIP(candidates[0]));
      }
    };

    try {
      request = transport(url, {
        method,
        headers: Object.fromEntries(headers.entries()),
        lookup: pinnedLookup,
      } as any);
    } catch (error) {
      finishError(new SafeFetchError(error instanceof Error ? error.message : 'Request setup failed'));
      return;
    }

    const timeout = setTimeout(() => {
      request.destroy(new SafeFetchError('Outbound request timed out', 'TIMEOUT'));
    }, timeoutMs);
    timeout.unref?.();

    const cleanup = () => {
      clearTimeout(timeout);
      if (init.signal && abortListener) init.signal.removeEventListener('abort', abortListener);
    };

    request.on('error', (error) => {
      cleanup();
      finishError(error instanceof SafeFetchError ? error : new SafeFetchError(error.message, 'NETWORK'));
    });

    request.on('response', (response) => {
      const status = response.statusCode || 0;
      if (status >= 300 && status < 400) {
        response.resume();
        cleanup();
        finishError(new SafeFetchError('Redirect responses are not followed', 'REDIRECT'));
        return;
      }

      const declaredLength = Number(response.headers['content-length'] || 0);
      if (declaredLength > maxResponseBytes) {
        response.destroy();
        cleanup();
        finishError(new SafeFetchError('Response exceeds the configured size limit', 'TOO_LARGE'));
        return;
      }

      const chunks: Buffer[] = [];
      let total = 0;
      response.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.byteLength;
        if (total > maxResponseBytes) {
          response.destroy(new SafeFetchError('Response exceeds the configured size limit', 'TOO_LARGE'));
          return;
        }
        chunks.push(buffer);
      });
      response.on('error', (error) => {
        cleanup();
        finishError(error instanceof SafeFetchError ? error : new SafeFetchError(error.message, 'NETWORK'));
      });
      response.on('end', () => {
        if (settled) return;
        settled = true;
        cleanup();
        const body = Buffer.concat(chunks).toString('utf8');
        const responseHeaders = new Headers();
        for (const [name, value] of Object.entries(response.headers)) {
          if (value === undefined) continue;
          for (const item of Array.isArray(value) ? value : [value]) responseHeaders.append(name, String(item));
        }
        const result: SafeTextResponse = {
          status,
          statusText: response.statusMessage || '',
          ok: status >= 200 && status < 300,
          headers: responseHeaders,
          text: async () => body,
          json: async <T = unknown>() => JSON.parse(body) as T,
        };
        resolve(result);
      });
    });

    if (init.signal) {
      abortListener = () => request.destroy(new SafeFetchError('Outbound request aborted', 'TIMEOUT'));
      if (init.signal.aborted) {
        abortListener();
        return;
      }
      init.signal.addEventListener('abort', abortListener, { once: true });
    }

    request.end(requestBody);
    // Prevent unused fields from being forwarded by accident in future edits.
    void requestInit;
  });
}

async function toRequestBody(body: BodyInit | null | undefined): Promise<Buffer | undefined> {
  if (body == null) return undefined;
  if (typeof body === 'string') return Buffer.from(body, 'utf8');
  if (body instanceof URLSearchParams) return Buffer.from(body.toString(), 'utf8');
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (ArrayBuffer.isView(body)) return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  if (body instanceof Blob) return Buffer.from(await body.arrayBuffer());
  throw new SafeFetchError('Unsupported outbound request body type', 'NETWORK');
}

async function resolveHostname(hostname: string): Promise<string[]> {
  try {
    const records = await Promise.race([
      dnsLookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error('DNS lookup timed out')), 3000);
        timer.unref?.();
      }),
    ]);
    return [...new Set(records.map((record) => record.address))];
  } catch {
    return [];
  }
}

function expandIpv6(ip: string): number[] | null {
  let normalized = ip.toLowerCase();
  if (normalized.includes('%')) return null;

  if (normalized.includes('.')) {
    const lastColon = normalized.lastIndexOf(':');
    if (lastColon < 0) return null;
    const octets = normalized.slice(lastColon + 1).split('.').map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null;
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    normalized = `${normalized.slice(0, lastColon)}:${high}:${low}`;
  }

  const halves = normalized.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  if ([...left, ...right].some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;

  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const words = [...left, ...Array(missing).fill('0'), ...right].map((word) => parseInt(word, 16));
  if (words.length !== 8) return null;
  return words.flatMap((word) => [(word >> 8) & 0xff, word & 0xff]);
}

function bytesToIpv4(bytes: number[]): string {
  return bytes.slice(0, 4).join('.');
}
