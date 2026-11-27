import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import express from 'express';
import { describe, expect, it } from 'vitest';
import { proxyBrowserApi } from './server-api-proxy';

async function listen(server: Server): Promise<number> {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing port');
  return address.port;
}

describe('browser API proxy', () => {
  it('forwards /api, including the body, and leaves other paths on the web app', async () => {
    const seen: { path?: string; method?: string; body?: string } = {};
    const upstream = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        seen.path = req.url;
        seen.method = req.method;
        seen.body = Buffer.concat(chunks).toString('utf8');
        res.statusCode = 201;
        res.setHeader('content-type', 'application/json');
        res.end('{"ok":true}');
      });
    });
    const upstreamPort = await listen(upstream);
    const app = express();
    app.use(proxyBrowserApi(`http://127.0.0.1:${upstreamPort}`));
    app.get('/login', (_req, res) => res.status(200).type('text/plain').send('web'));
    const web = createServer(app);
    const webPort = await listen(web);
    try {
      const forwarded = await fetch(`http://127.0.0.1:${webPort}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"identificador":"demo"}',
      });
      expect(forwarded.status).toBe(201);
      expect(await forwarded.json()).toEqual({ ok: true });
      expect(seen).toEqual({ path: '/api/auth/login', method: 'POST', body: '{"identificador":"demo"}' });

      const page = await fetch(`http://127.0.0.1:${webPort}/login`);
      expect(page.status).toBe(200);
      expect(await page.text()).toBe('web');
      expect(seen.path).toBe('/api/auth/login');
    } finally {
      web.close();
      upstream.close();
    }
  });

  it('rejects a browser API call when the origin is missing', async () => {
    const app = express();
    app.use(proxyBrowserApi(undefined));
    app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).type('text/plain').send(error.message);
    });
    const web = createServer(app);
    const webPort = await listen(web);
    try {
      const response = await fetch(`http://127.0.0.1:${webPort}/api/public/ayuda`);
      expect(response.status).toBe(500);
      expect(await response.text()).toContain('API_INTERNAL_ORIGIN');
    } finally {
      web.close();
    }
  });
});
