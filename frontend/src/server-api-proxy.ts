import type { NextFunction, Request, Response } from 'express';
import { request as httpRequest, type RequestOptions } from 'node:http';
import { request as httpsRequest } from 'node:https';

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade',
]);

/** Same origin rule the SSR interceptor already enforces. */
export function browserApiOrigin(configured: string | undefined): URL {
  if (!configured?.trim()) {
    throw new Error('API_INTERNAL_ORIGIN is required for browser API requests');
  }
  const origin = new URL(configured);
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.username || origin.password || origin.pathname !== '/' ||
    origin.search || origin.hash
  ) {
    throw new Error('API_INTERNAL_ORIGIN must be an HTTP origin without credentials or a path');
  }
  return origin;
}

export function isBrowserApiPath(path: string): boolean {
  return /^\/api(?:\/|\?|$)/.test(path);
}

/** Forward same-origin /api calls to the Spring Boot origin. Bodies are streamed, not logged. */
export function proxyBrowserApi(configured: string | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.originalUrl || req.url;
    if (!isBrowserApiPath(path)) {
      next();
      return;
    }
    let origin: URL;
    try {
      origin = browserApiOrigin(configured);
    } catch (error) {
      next(error);
      return;
    }
    const headers: Record<string, string | string[] | undefined> = {};
    for (const [name, value] of Object.entries(req.headers)) {
      if (!HOP_BY_HOP.has(name.toLowerCase()) && value !== undefined) headers[name] = value;
    }
    headers['host'] = origin.host;
    const options: RequestOptions = {
      protocol: origin.protocol,
      hostname: origin.hostname,
      port: origin.port || undefined,
      method: req.method,
      path,
      headers,
    };
    const transport = origin.protocol === 'https:' ? httpsRequest : httpRequest;
    const upstream = transport(options, (upstreamResponse) => {
      const responseHeaders: Record<string, string | string[] | undefined> = {};
      for (const [name, value] of Object.entries(upstreamResponse.headers)) {
        if (!HOP_BY_HOP.has(name.toLowerCase()) && value !== undefined) responseHeaders[name] = value;
      }
      res.writeHead(upstreamResponse.statusCode ?? 502, responseHeaders);
      upstreamResponse.pipe(res);
    });
    upstream.on('error', (error) => {
      if (!res.headersSent) next(error);
      else res.destroy(error);
    });
    req.pipe(upstream);
  };
}
