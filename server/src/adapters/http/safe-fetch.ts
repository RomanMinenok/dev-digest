import { lookup as dnsLookup } from 'node:dns/promises';

/**
 * Guarded fetch for the Intent Layer's "external links" source
 * (docs/plan/intent_layer_plan.md §0.5, §8 SSRF risk). Pure adapter — no
 * imports from modules/. NEVER throws: every failure mode (disallowed host,
 * private/loopback/link-local IP, timeout, oversize body, non-text
 * content-type, non-2xx) resolves to `null` so callers can degrade
 * gracefully instead of failing the whole intent-resolution flow.
 */

/**
 * Host suffixes allowed to be fetched. Anything else is reference-only
 * upstream. Suffix matching (rather than an exact-host Set) lets us cover
 * Notion workspaces (`foo.notion.so`) and GitHub pages/CDNs without listing
 * every subdomain.
 */
const ALLOWED_HOST_SUFFIXES = [
  'github.com',
  'githubusercontent.com',
  'docs.google.com',
  'notion.so',
  'notion.site',
];

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`) || host.endsWith(suffix));
}

const TIMEOUT_MS = 5_000;
const MAX_BYTES = 256 * 1024;

/** Minimal shape of `dns/promises`' `lookup(host, { all: true })` — injectable for tests. */
export interface DnsResolver {
  lookup(hostname: string): Promise<{ address: string; family: number }[]>;
}

/** Default resolver backed by node:dns/promises (resolves all A/AAAA records). */
const defaultResolver: DnsResolver = {
  lookup(hostname: string) {
    return dnsLookup(hostname, { all: true });
  },
};

/**
 * True when `ip` is a private, loopback, link-local, unique-local, or
 * unspecified address (IPv4 or IPv6) — i.e. anything that must never be
 * reached from a server-side fetch triggered by untrusted PR-body text.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  // IPv6
  if (ip.includes(':')) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true; // loopback / unspecified
    if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
      return true; // fe80::/10 link-local
    }
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7 unique-local
    // IPv4-mapped IPv6 (::ffff:a.b.c.d) — check the embedded IPv4 address.
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateOrReservedIp(mapped[1]!);
    return false;
  }

  // IPv4
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return true; // malformed — treat as unsafe rather than risk a bypass
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  return false;
}

/** Rewrite a Google Docs view URL to its plain-text export endpoint, if recognized. */
function rewriteGoogleDocsUrl(url: URL): URL {
  const m = url.pathname.match(/^\/document\/d\/([^/]+)/);
  if (!m) return url;
  return new URL(`https://docs.google.com/document/d/${m[1]}/export?format=txt`);
}

function isTextContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const type = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return (
    type.startsWith('text/') ||
    type === 'application/json' ||
    type === 'application/xml' ||
    type.endsWith('+xml') ||
    type.endsWith('+json')
  );
}

/**
 * Fetch `rawUrl` only if its host is allowlisted and every resolved IP is
 * public/routable. Returns the response body as text (capped at ~256KB), or
 * `null` on ANY failure — disallowed host, private IP, timeout, oversize,
 * non-text content-type, non-2xx, or a malformed URL. Never throws.
 */
export async function safeFetch(rawUrl: string, resolver: DnsResolver = defaultResolver): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const hostname = url.hostname.toLowerCase();
  if (!isAllowedHost(hostname)) return null;

  if (hostname === 'docs.google.com') {
    url = rewriteGoogleDocsUrl(url);
  }

  try {
    const addrs = await resolver.lookup(hostname);
    if (addrs.length === 0) return null;
    if (addrs.some((a) => isPrivateOrReservedIp(a.address))) return null;
  } catch {
    return null; // DNS resolution failure — fail closed
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Follow a single HTTPS redirect so raw.githubusercontent / Notion CDN
    // hops still resolve. The initial host already passed the allowlist + DNS
    // private-IP check above.
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!res.ok) return null;
    if (!isTextContentType(res.headers.get('content-type'))) return null;

    const body = await readCapped(res, MAX_BYTES);
    return body;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Read a Response body as UTF-8 text, aborting once more than `maxBytes` have been read. */
async function readCapped(res: Response, maxBytes: number): Promise<string | null> {
  if (!res.body) {
    const text = await res.text();
    return text.length > maxBytes ? null : text;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          return null;
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
}
