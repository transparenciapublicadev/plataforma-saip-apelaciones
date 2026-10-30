/** Exact runtime hostnames for Angular's SSR request validation, never a wildcard. */
export function serverAllowedHosts(publicOrigin: string | undefined): string[] {
  const hosts = ['localhost', '127.0.0.1'];
  if (!publicOrigin) return hosts; // CLI/build and loopback health checks.

  const origin = new URL(publicOrigin);
  if (origin.protocol !== 'https:' || origin.username || origin.password ||
      origin.pathname !== '/' || origin.search || origin.hash || origin.hostname.includes('*')) {
    throw new Error('PUBLIC_ORIGIN must be one HTTPS origin without credentials, path or wildcard');
  }
  return [...new Set([...hosts, origin.hostname])];
}
