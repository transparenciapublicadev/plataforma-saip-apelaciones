import { describe, expect, it } from 'vitest';
import { serverAllowedHosts } from './server-hosts';

describe('SSR runtime hosts', () => {
  it('keeps explicit loopback health hosts when no public origin is configured', () => {
    expect(serverAllowedHosts(undefined)).toEqual(['localhost', '127.0.0.1']);
  });

  it('authorizes only the configured canonical hostname, independently of the port', () => {
    const hosts = serverAllowedHosts('https://Yaiku.test:9443');
    expect(hosts).toContain('yaiku.test');
    expect(hosts).not.toContain('*');
    expect(hosts).not.toContain('other.yaiku.test');
    expect(hosts).not.toContain('https://yaiku.test:9443');
  });

  it.each(['http://yaiku.test', 'https://*.yaiku.test', 'https://user:secret@yaiku.test',
    'https://yaiku.test/path', 'https://yaiku.test?host=other.test',
    'https://yaiku.test/#host', 'not-an-origin'])('rejects unsafe public origin %s', origin => {
    expect(() => serverAllowedHosts(origin)).toThrow();
  });
});
