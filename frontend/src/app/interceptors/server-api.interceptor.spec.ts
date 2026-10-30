import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SERVER_API_ORIGIN, serverApiInterceptor } from './server-api.interceptor';

describe('server API origin', () => {
  let http: HttpClient;
  let requests: HttpTestingController;
  let configured: string | undefined;

  beforeEach(() => {
    configured = undefined;
    TestBed.configureTestingModule({ providers: [
      { provide: SERVER_API_ORIGIN, useFactory: () => configured },
      provideHttpClient(withInterceptors([serverApiInterceptor])), provideHttpClientTesting(),
    ] });
    http = TestBed.inject(HttpClient);
    requests = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { requests.verify(); });

  it('resolves a relative API request and query against the configured private origin', () => {
    configured = 'http://backend:8080';
    http.get('/api/public/ayuda?categoria=saip').subscribe();
    const request = requests.expectOne('http://backend:8080/api/public/ayuda?categoria=saip');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('preserves the method, body and explicit headers without obtaining a browser session', () => {
    configured = 'https://private-api.invalid';
    const body = { consulta: 'sintetica' };
    http.post('/api/example', body, { headers: { 'X-Request-ID': 'fixture' } }).subscribe();
    const request = requests.expectOne('https://private-api.invalid/api/example');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    expect(request.request.headers.get('X-Request-ID')).toBe('fixture');
    request.flush({});
  });

  it('does not rewrite absolute URLs or paths outside the API boundary', () => {
    configured = undefined;
    for (const url of ['https://another.invalid/api/test', '/assets/logo.svg', '/apiary']) {
      http.get(url).subscribe(); requests.expectOne(url).flush({});
    }
  });

  it('fails explicitly without an SSR origin rather than requesting the public host', () => {
    configured = undefined;
    let error: Error | undefined;
    http.get('/api/public/ayuda').subscribe({ error: e => error = e });
    expect(error?.message).toContain('API_INTERNAL_ORIGIN');
    requests.expectNone('/api/public/ayuda');
  });

  it.each(['file:///tmp/api', 'https://user:password@host.invalid', 'https://host.invalid/api',
    'https://host.invalid?route=api', 'https://host.invalid/#api'])('rejects unsafe origin %s', origin => {
    configured = origin;
    let error: Error | undefined;
    http.get('/api/public/ayuda').subscribe({ error: e => error = e });
    expect(error).toBeInstanceOf(Error);
    requests.expectNone(r => r.url.includes('/api'));
  });
});
