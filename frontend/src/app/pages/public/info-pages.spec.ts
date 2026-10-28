import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Title } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { routes } from '../../app.routes';
import { LandingFooterComponent } from '../home/landing-footer.component';
import { InfoPagesComponent } from './info-pages.component';
import { AuthService } from '../../services/auth.service';
import { App } from '../../app';
import { UxMotionService } from '../../services/ux-motion.service';

@Component({ template: '<h1>Destino existente</h1>' })
class ExistingDestination {}

const actualInfoRoutes = routes.filter(r => ['documentacion', 'acerca'].includes(r.path ?? ''));
const testRoutes = [...actualInfoRoutes,
  ...routes.filter(r => ['', 'login', 'registro', 'ayuda', 'consultar', 'ciudadano/nueva-saip'].includes(r.path ?? ''))
    .map(({ loadComponent, ...r }) => ({ ...r, component: ExistingDestination })),
];

describe('Páginas informativas propias', () => {
  it.each(['documentacion', 'acerca'])('%s tiene una ruta propia, no el fallback al inicio', path => {
    const route = routes.find(r => r.path === path);
    expect(route).toBeDefined(); expect(route?.redirectTo).toBeUndefined(); expect(route?.loadComponent).toBeTypeOf('function');
  });

  it('el pie enlaza documentación, guía y acerca con destinos propios', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const f = TestBed.createComponent(LandingFooterComponent); f.detectChanges();
    for (const href of ['/documentacion', '/documentacion#guia', '/acerca']) expect(f.nativeElement.querySelector(`a[href="${href}"]`)).toBeTruthy();
  });
});

describe('Documentación y acerca — navegación y contenido respaldado', () => {
  let harness: RouterTestingHarness;
  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(testRoutes), provideHttpClient(), provideHttpClientTesting()] });
    TestBed.inject(Title).setTitle('Título previo sintético');
    harness = await RouterTestingHarness.create();
  });
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); TestBed.resetTestingModule(); localStorage.clear(); vi.restoreAllMocks(); });
  async function page(url: string) {
    const c = await harness.navigateByUrl(url, InfoPagesComponent); harness.detectChanges(); await harness.fixture.whenStable(); return c;
  }
  function body() { return harness.routeNativeElement!; }

  it.each([
    ['/documentacion', 'Cómo funciona Yaiku', 'Documentación | Yaiku'],
    ['/acerca', 'Dos instancias, una sola plataforma.', 'Acerca de Yaiku'],
  ])('acceso directo anónimo %s: contenido propio, título y foco inicial sin consultas HTTP', async (url, heading, title) => {
    await page(url); expect(body().querySelectorAll('h1')).toHaveLength(1);
    expect(body().querySelector('h1')!.textContent?.replace(/\s+/g, ' ').trim()).toBe(heading);
    expect(TestBed.inject(Title).getTitle()).toBe(title); expect(document.activeElement).toBe(body().querySelector('h1'));
    expect(TestBed.inject(Router).url).toBe(url); TestBed.inject(HttpTestingController).expectNone(() => true);
  });

  it.each(['CIUDADANO', 'FUNCIONARIO', 'TTAIP', 'ADMINISTRADOR'])('el contenido público no cambia ni escribe en la sesión %s', async tipoUsuario => {
    TestBed.inject(AuthService).guardarSesion({ success: true, token: 'synthetic', usuarioId: 7, tipoUsuario }); const before = localStorage.getItem('usuario');
    await page('/documentacion'); expect(body().querySelectorAll('ol li')).toHaveLength(5); await page('/acerca');
    expect(localStorage.getItem('usuario')).toBe(before); TestBed.inject(HttpTestingController).expectNone(() => true);
  });

  it('conserva la diferencia entre consulta pública y detalle autorizado, con rutas existentes', async () => {
    await page('/documentacion'); const section = body().querySelector('[aria-labelledby="consulta"]')!;
    expect(section.textContent).toContain('no muestra el asunto'); expect(section.textContent).toContain('ni proporciona acceso a los documentos');
    expect(section.querySelector('a[href="/consultar"]')).toBeTruthy(); expect(section.querySelector('a[href="/login"]')).toBeTruthy();
  });

  it('separa precisión SAIP con archivo requerido de TTAIP con fundamentos y adjuntos opcionales', async () => {
    await page('/documentacion'); const section = body().querySelector('[aria-labelledby="requerimientos"]')!;
    const cards = Array.from(section.querySelectorAll('article'));
    expect(cards.find(c => c.querySelector('h3')?.textContent?.includes('Precisión'))?.textContent).toContain('archivo requerido');
    expect(cards.find(c => c.querySelector('h3')?.textContent?.includes('Subsanación'))?.textContent).toContain('fundamentos');
    expect(cards.find(c => c.querySelector('h3')?.textContent?.includes('Subsanación'))?.textContent).toContain('adjuntos son opcionales');
    expect(section.textContent).not.toMatch(/\d+ días|\d+%/);
  });

  it('describe apelación vinculada y externa sin inventar códigos ni recursos de ejemplo', async () => {
    await page('/documentacion'); expect(body().textContent).toContain('apelación externa'); expect(body().textContent).toContain('vinculado a tu solicitud');
    expect(body().querySelector('a[href*="/solicitud/"],a[href*="/precision/"],a[href*="/subsanacion/"]')).toBeNull();
  });

  it('explica recepción e incertidumbre sin equiparar registro a entrega, notificación, firma o emisión', async () => {
    await page('/documentacion'); const section = body().querySelector('[aria-labelledby="alcance"]')!;
    expect(section.textContent).toContain('no demuestra entrega'); expect(section.textContent).toContain('antes de repetirlo');
    expect(section.textContent).toContain('no acreditan firma digital'); expect(section.textContent).toContain('edición segura de contacto');
    expect(section.querySelector('button,form,input,a[download]')).toBeNull();
  });

  it.each(['/documentacion', '/acerca'])('%s no ofrece descargas inexistentes, soporte demo, credenciales o endpoints privados', async url => {
    await page(url); expect(body().querySelector('a[download],a[href^="mailto:"],a[href^="tel:"],form,input,iframe')).toBeNull();
    expect(body().textContent).not.toMatch(/\/api\/|Bearer|authVersion|password|consultas@|yaiku\.gob\.pe/);
    expect(body().querySelector('a[href$=".pdf"],a[href$=".docx"]')).toBeNull();
  });

  it('distingue objetivos de resultados y no publica cargos, integrantes o certificaciones del prototipo', async () => {
    await page('/acerca'); expect(body().textContent).toContain('no se presenta como plataforma oficial');
    expect(body().textContent).toContain('No se presentan resultados medidos'); expect(body().textContent).toContain('no se declara conformidad certificada');
    expect(body().textContent).not.toContain('Cofundadores');
    expect(body().textContent).not.toMatch(/\b(?:CEO|CTO)\b|WCAG 2\.[12]|\d+%|plazos que se cumplen/i);
    expect(body().querySelector('img')).toBeNull();
  });

  it.each(['/documentacion', '/acerca'])('%s conserva semántica, secciones nombradas y enlaces descriptivos reales', async url => {
    await page(url); const headings = Array.from(body().querySelectorAll<HTMLElement>('h2[id]'));
    expect(headings.length).toBeGreaterThan(3); expect(new Set(headings.map(h => h.id)).size).toBe(headings.length);
    for (const section of Array.from(body().querySelectorAll('section[aria-labelledby]'))) expect(section.querySelector('#' + section.getAttribute('aria-labelledby'))).toBeTruthy();
    for (const a of Array.from(body().querySelectorAll<HTMLAnchorElement>('a'))) {
      expect(a.textContent?.trim()).not.toBe(''); const href = a.getAttribute('href')!; expect(href).not.toBe('#');
      expect(routes.some(r => '/' + r.path === href.split('#')[0])).toBe(true);
      expect(a.hasAttribute('onclick')).toBe(false);
    }
  });

  it.each(['modulos', 'guia', 'consulta', 'requerimientos', 'alcance'])('el fragmento documental #%s existe y recibe el foco', async fragment => {
    await page('/documentacion#' + fragment); expect(document.activeElement).toBe(body().querySelector('#' + fragment));
    expect(TestBed.inject(Router).url).toBe('/documentacion#' + fragment);
  });

  it.each(['proposito', 'capacidades', 'nombre', 'proyecto'])('el fragmento de acerca #%s utiliza su sección propia', async fragment => {
    await page('/acerca#' + fragment); expect(document.activeElement).toBe(body().querySelector('#' + fragment));
  });

  it('el enlace de guía actualiza fragmento y foco sin sustituir la página por el inicio', async () => {
    const c = await page('/documentacion'); body().querySelector<HTMLAnchorElement>('a[href="/documentacion#guia"]')!.click();
    await harness.fixture.whenStable(); harness.detectChanges(); await harness.fixture.whenStable();
    expect(c.page()).toBe('documentacion'); expect(TestBed.inject(Router).url).toBe('/documentacion#guia'); expect(document.activeElement?.id).toBe('guia');
  });

  it('un fragmento desconocido se trata literalmente y no selecciona elementos ajenos', async () => {
    await page('/documentacion#%5Bautofocus%5D'); expect(document.activeElement).toBe(body().querySelector('h1')); expect(body().querySelector('#guia')).toBeTruthy();
  });

  it('cambiar de página limpia el contexto de fragmento y utiliza el nuevo título y foco', async () => {
    await page('/documentacion#guia'); const old = body().querySelector('#guia')!; await page('/acerca');
    expect(old.isConnected).toBe(false); expect(body().querySelector('#guia')).toBeNull(); expect(TestBed.inject(Title).getTitle()).toBe('Acerca de Yaiku');
    expect(document.activeElement).toBe(body().querySelector('h1'));
  });

  it('el retorno explícito vuelve al inicio y restaura el título previo para rutas sin título', async () => {
    await page('/documentacion'); body().querySelector<HTMLAnchorElement>('a[href="/"]')!.click(); await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/'); expect(TestBed.inject(Title).getTitle()).toBe('Título previo sintético');
  });

  it('una entrada SSR con título informativo no deja ese título en una ruta sin título', async () => {
    TestBed.inject(Title).setTitle('Acerca de Yaiku'); await page('/acerca'); await harness.navigateByUrl('/', ExistingDestination);
    expect(TestBed.inject(Title).getTitle()).toBe('TTAIP - Sistema de Acceso a la Información Pública');
  });

  it('presentar SAIP conserva el guard y acceso ciudadano sin crear una sesión', async () => {
    await page('/documentacion'); body().querySelector<HTMLAnchorElement>('a[href="/ciudadano/nueva-saip"]')!.click();
    await harness.fixture.whenStable(); expect(TestBed.inject(Router).url).toBe('/login'); expect(TestBed.inject(AuthService).getToken()).toBeNull();
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });

  it('las páginas legales continúan sin rutas implementadas en esta entrega', () => {
    for (const path of ['privacidad', 'terminos', 'accesibilidad']) expect(routes.find(r => r.path === path)).toBeUndefined();
  });
});

describe('Pies y navegación compartida de InfoPages', () => {
  beforeEach(() => {
    localStorage.clear(); sessionStorage.setItem('saip_splash_shown', 'true'); vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter(testRoutes), provideHttpClient(), provideHttpClientTesting(),
      { provide: UxMotionService, useValue: { animateShell: vi.fn(), animateRoute: vi.fn(), dispose: vi.fn() } }] });
  });
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); TestBed.resetTestingModule(); localStorage.clear(); vi.restoreAllMocks(); });
  async function shell(url: string) {
    const f = TestBed.createComponent(App); f.detectChanges(); await TestBed.inject(Router).navigateByUrl(url); f.detectChanges(); await f.whenStable(); return f;
  }
  it.each(['/documentacion', '/acerca'])('%s utiliza un solo pie Yaiku y conserva accesos y destinos pendientes', async url => {
    const f = await shell(url); const el = f.nativeElement as HTMLElement;
    expect(el.querySelectorAll('footer')).toHaveLength(1); expect(el.querySelector('app-landing-footer')).toBeTruthy();
    expect(el.querySelector('header a[href="/login"]')).toBeTruthy(); expect(el.querySelector('footer')?.textContent).toContain('Privacidad — no disponible');
    expect(el.querySelector('footer a[href="/privacidad"],footer a[href="#"]')).toBeNull();
  });
  it('cabecera de marca y pie usan identificadores SVG distintos sin duplicar imágenes externas', async () => {
    const f = await shell('/acerca'); const logos = Array.from(f.nativeElement.querySelectorAll('app-yaiku-logo [role="img"]') as NodeListOf<HTMLElement>);
    expect(logos).toHaveLength(2); expect(logos.every(x => x.getAttribute('aria-label') === 'Yaiku')).toBe(true);
    const ids = Array.from(f.nativeElement.querySelectorAll('app-yaiku-logo linearGradient[id]') as NodeListOf<Element>).map(x => x.id);
    expect(new Set(ids).size).toBe(2);
  });
  it('el pie legado cambia solo los destinos de documentación, guía y acerca', async () => {
    const f = await shell('/ayuda'); const footer = f.nativeElement.querySelector('footer.saip-footer') as HTMLElement;
    expect(footer).toBeTruthy(); for (const href of ['/documentacion', '/documentacion#guia', '/acerca']) expect(footer.querySelector(`a[href="${href}"]`)).toBeTruthy();
    expect(f.nativeElement.querySelector('app-landing-footer')).toBeNull();
  });

  it('el shell no sobrescribe el foco del fragmento documental al navegar al mismo recorrido', async () => {
    const f = await shell('/documentacion'); const target = f.nativeElement.querySelector('#guia') as HTMLElement;
    const scroll = vi.fn(); Object.defineProperty(target, 'scrollIntoView', { configurable: true, value: scroll });
    await TestBed.inject(Router).navigateByUrl('/documentacion#guia'); f.detectChanges(); await f.whenStable();
    expect(document.activeElement).toBe(target); expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' });
  });
});
