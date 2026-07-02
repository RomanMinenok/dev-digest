import { describe, it, expect, vi, afterEach } from 'vitest';
import { safeFetch, isPrivateOrReservedIp, type DnsResolver } from './safe-fetch.js';

function makeResolver(addresses: string[]): DnsResolver {
  return {
    async lookup() {
      return addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
    },
  };
}

describe('isPrivateOrReservedIp', () => {
  it.each([
    ['10.0.0.5', true],
    ['172.16.0.1', true],
    ['172.31.255.255', true],
    ['192.168.1.1', true],
    ['127.0.0.1', true],
    ['169.254.1.1', true],
    ['0.0.0.0', true],
    ['::1', true],
    ['fe80::1', true],
    ['fd00::1', true],
    ['::ffff:127.0.0.1', true],
    ['8.8.8.8', false],
    ['140.82.112.3', false],
  ])('%s → %s', (ip, expected) => {
    expect(isPrivateOrReservedIp(ip)).toBe(expected);
  });

  it('treats a malformed IPv4 as unsafe (fail closed)', () => {
    expect(isPrivateOrReservedIp('999.999.999.999')).toBe(true);
  });
});

describe('safeFetch', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');

  afterEach(() => {
    fetchSpy.mockReset();
  });

  it('returns null for a non-allowlisted host without any network call', async () => {
    const resolver = makeResolver(['8.8.8.8']);
    const result = await safeFetch('https://evil.example.com/steal', resolver);
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null for a malformed URL', async () => {
    const result = await safeFetch('not a url');
    expect(result).toBeNull();
  });

  it('returns null for a non-http(s) protocol', async () => {
    const result = await safeFetch('file:///etc/passwd');
    expect(result).toBeNull();
  });

  it('returns null when an allowlisted host resolves to a private IP (anti-SSRF)', async () => {
    const resolver = makeResolver(['127.0.0.1']);
    const result = await safeFetch('https://github.com/acme/widgets/issues/1', resolver);
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null when DNS resolution fails (fail closed)', async () => {
    const resolver: DnsResolver = {
      async lookup() {
        throw new Error('ENOTFOUND');
      },
    };
    const result = await safeFetch('https://github.com/acme/widgets', resolver);
    expect(result).toBeNull();
  });

  it('fetches text content from an allowlisted host with a public IP', async () => {
    const resolver = makeResolver(['140.82.112.3']);
    fetchSpy.mockResolvedValue(
      new Response('spec content', { status: 200, headers: { 'content-type': 'text/plain' } }),
    );

    const result = await safeFetch('https://raw.githubusercontent.com/acme/widgets/main/spec.md', resolver);
    expect(result).toBe('spec content');
  });

  it('returns null for a non-text content-type', async () => {
    const resolver = makeResolver(['140.82.112.3']);
    fetchSpy.mockResolvedValue(
      new Response('binary', { status: 200, headers: { 'content-type': 'application/octet-stream' } }),
    );

    const result = await safeFetch('https://raw.githubusercontent.com/acme/widgets/main/blob.bin', resolver);
    expect(result).toBeNull();
  });

  it('returns null for a non-2xx response', async () => {
    const resolver = makeResolver(['140.82.112.3']);
    fetchSpy.mockResolvedValue(new Response('not found', { status: 404 }));

    const result = await safeFetch('https://raw.githubusercontent.com/acme/widgets/main/missing.md', resolver);
    expect(result).toBeNull();
  });

  it('returns null when the body exceeds the size cap', async () => {
    const resolver = makeResolver(['140.82.112.3']);
    const oversized = 'x'.repeat(300 * 1024); // > 256KB cap
    fetchSpy.mockResolvedValue(
      new Response(oversized, { status: 200, headers: { 'content-type': 'text/plain' } }),
    );

    const result = await safeFetch('https://raw.githubusercontent.com/acme/widgets/main/huge.md', resolver);
    expect(result).toBeNull();
  });

  it('rewrites a Google Docs URL to its plain-text export endpoint', async () => {
    const resolver = makeResolver(['142.250.0.100']);
    fetchSpy.mockResolvedValue(
      new Response('doc content', { status: 200, headers: { 'content-type': 'text/plain' } }),
    );

    await safeFetch('https://docs.google.com/document/d/abc123/edit', resolver);
    const calledUrl = fetchSpy.mock.calls[0]![0] as URL;
    expect(calledUrl.toString()).toBe('https://docs.google.com/document/d/abc123/export?format=txt');
  });

  it('returns null instead of throwing when fetch itself rejects', async () => {
    const resolver = makeResolver(['140.82.112.3']);
    fetchSpy.mockRejectedValue(new Error('network error'));

    const result = await safeFetch('https://github.com/acme/widgets', resolver);
    expect(result).toBeNull();
  });
});
