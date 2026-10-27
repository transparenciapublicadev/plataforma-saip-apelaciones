import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AyudaComponent } from './ayuda.component';
import { routes } from '../../app.routes';
import { AuthService } from '../../services/auth.service';

@Component({ template: '<h1>Destino de prueba</h1>' })
class DestinationComponent {}

describe('AyudaPage — orientación y navegación reales', () => {
  let fragment: BehaviorSubject<string | null>;
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    fragment = new BehaviorSubject<string | null>(null);
    TestBed.configureTestingModule({ imports: [AyudaComponent], providers: [provideRouter([]),
      provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { fragment: fragment.asObservable() } }] });
  });
  afterEach(() => {
    try { TestBed.inject(HttpTestingController).verify(); }
    finally { TestBed.resetTestingModule(); localStorage.clear(); sessionStorage.clear(); }
  });
  function page() { const f = TestBed.createComponent(AyudaComponent); f.detectChanges(); return f; }
  it('da nombre accesible al buscador local', () => {
    const f = page(), input = f.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(f.nativeElement.querySelector(`label[for="${input.id}"]`)?.textContent).toContain('Buscar');
  });
  it('no publica contactos de demostración y explica la ausencia de soporte configurado', () => {
    const f = page();
    expect(f.nativeElement.textContent).not.toMatch(/630-2000|saip-tesis\.edu|Universidad · Lima/);
    expect(f.nativeElement.textContent).toContain('No hay un canal de soporte verificado configurado');
    expect(f.nativeElement.querySelector('a[href^="mailto:"],a[href^="tel:"]')).toBeNull();
  });
  it('no promete enviar un enlace de recuperación de contraseña inexistente', () => {
    const c = page().componentInstance;
    const faq = c.faqCategories.flatMap(cat => cat.questions).find(q => /contraseña.*qué hago/.test(q.q));
    expect(faq).toBeDefined(); expect(faq!.a).not.toMatch(/se enviará un enlace/i);
    expect(faq!.a).toContain('no dispone de restablecimiento de contraseña');
  });
  it('orienta sobre los requisitos diferentes de precisión y subsanación, sin inferir archivos obligatorios TTAIP', () => {
    const c = page().componentInstance;
    const text = c.faqCategories.flatMap(cat => cat.questions).map(q => q.a).join(' ');
    expect(text).toContain('un archivo requerido'); expect(text).toContain('adjuntos son opcionales');
    expect(text).toMatch(/no muestra el asunto/i);
  });
  it('ofrece una ruta real protegida para presentar SAIP', () => {
    const f = page();
    const link = Array.from(f.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>)
      .find(a => a.textContent?.includes('Presentar una SAIP'));
    expect(link?.getAttribute('href')).toBe('/ciudadano/nueva-saip');
  });
  it('abre la sección indicada por el enlace #faq', () => {
    fragment.next('faq'); const f = page(); expect(f.componentInstance.tab()).toBe('faq');
  });
  it('expone la expansión y la respuesta controlada por cada pregunta', () => {
    const f = page(); f.componentInstance.setTab('faq'); f.detectChanges();
    const button = Array.from(f.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(b => b.textContent?.includes('¿Qué es una solicitud SAIP?'))!;
    expect(button.getAttribute('aria-expanded')).toBe('false'); button.click(); f.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(f.nativeElement.querySelector(`#${button.getAttribute('aria-controls')}`)).not.toBeNull();
  });
  it.each(['  PRECISION  ', 'precisión'])('filtra localmente ignorando espacios, mayúsculas y tildes: %s', value => {
    const f = page(); f.componentInstance.onSearch(value); f.detectChanges();
    expect(f.componentInstance.tab()).toBe('faq');
    expect(f.nativeElement.querySelector('#help-question-subsanacion-precision')).not.toBeNull();
    expect(f.componentInstance.matchingQuestions()).toBeGreaterThan(0);
    expect(f.nativeElement.querySelector('[role="status"]')?.textContent).toContain('preguntas encontradas');
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
  it('buscar el nombre de una categoría incluye sus preguntas', () => {
    const c = page().componentInstance; c.onSearch('CUENTA Y REGISTRO');
    expect(c.currentFaqList().map(cat => cat.id)).toEqual(['cuenta']);
    expect(c.currentFaqList()[0].questions.some(q => q.id === 'password')).toBe(true);
  });
  it('una consulta sin coincidencias es un resultado vacío, no un error', () => {
    const f = page(); f.componentInstance.onSearch('zzzz-sin-coincidencias'); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Sin resultados');
    expect(f.nativeElement.querySelector('[role="status"]')?.textContent).toContain('0 preguntas encontradas');
    expect(f.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });
  it('los espacios solos no ocultan la sección que se estaba leyendo', () => {
    const f = page(); f.componentInstance.setTab('estados'); f.componentInstance.onSearch('   '); f.detectChanges();
    expect(f.componentInstance.isSearching()).toBe(false);
    expect(f.nativeElement.textContent).toContain('Estados de su apelación');
    expect(f.nativeElement.textContent).not.toContain('Sin resultados');
  });
  it('limpiar desde el resultado vacío restaura el buscador y devuelve el foco', () => {
    const f = page(); document.body.appendChild(f.nativeElement);
    try {
      const input = f.nativeElement.querySelector('#help-search') as HTMLInputElement;
      input.value = 'sin-coincidencias-zzz'; input.dispatchEvent(new Event('input')); f.detectChanges();
      const clear = Array.from(f.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
        .find(b => b.textContent?.includes('Limpiar búsqueda'))!;
      clear.focus(); clear.click(); f.detectChanges();
      expect(document.activeElement).toBe(input); expect(input.value).toBe('');
      expect(f.componentInstance.isSearching()).toBe(false);
    } finally { f.nativeElement.remove(); }
  });
  it('cada sección declara su selección y conserva botones nativos', () => {
    const f = page(); const group = f.nativeElement.querySelector('[role="group"]');
    const buttons = Array.from(group.querySelectorAll('button') as NodeListOf<HTMLButtonElement>);
    expect(buttons).toHaveLength(3); expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    buttons[2].focus(); buttons[2].click(); f.detectChanges();
    expect(buttons[2].type).toBe('button'); expect(buttons[2].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('false');
  });
  it('seleccionar una categoría abre su panel y cierra el anterior', () => {
    const f = page(); f.componentInstance.setTab('faq'); f.detectChanges();
    const card = Array.from(f.nativeElement.querySelectorAll('button[aria-pressed]') as NodeListOf<HTMLButtonElement>)
      .find(b => b.textContent?.includes('Apelaciones TTAIP'))!;
    card.click(); f.detectChanges();
    expect(card.getAttribute('aria-pressed')).toBe('true');
    expect(f.nativeElement.querySelector('#help-category-panel-apelaciones').hidden).toBe(false);
    expect(f.nativeElement.querySelector('#help-category-panel-saip').hidden).toBe(true);
  });
  it('el encabezado de categoría permite colapsar y expandir su contenido', () => {
    const f = page(); f.componentInstance.setTab('faq'); f.detectChanges();
    const trigger = f.nativeElement.querySelector('#help-category-saip') as HTMLButtonElement;
    trigger.click(); f.detectChanges(); expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(f.nativeElement.querySelector('#help-category-panel-saip').hidden).toBe(true);
    trigger.click(); f.detectChanges(); expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });
  it('el acordeón conserva nombre y relación, cierra la respuesta anterior y permite cerrarla', () => {
    const f = page(); f.componentInstance.setTab('faq'); f.detectChanges();
    const first = f.nativeElement.querySelector('#help-question-saip-definicion') as HTMLButtonElement;
    const second = f.nativeElement.querySelector('#help-question-saip-presentacion') as HTMLButtonElement;
    first.click(); f.detectChanges(); second.click(); f.detectChanges();
    const answer = f.nativeElement.querySelector('#help-answer-saip-presentacion');
    expect(first.getAttribute('aria-expanded')).toBe('false'); expect(second.getAttribute('aria-expanded')).toBe('true');
    expect(answer.hidden).toBe(false); expect(answer.getAttribute('aria-labelledby')).toBe(second.id);
    second.click(); f.detectChanges(); expect(answer.hidden).toBe(true);
  });
  it('filtrar no reutiliza la respuesta abierta de otra pregunta ni cambia su identidad', () => {
    const f = page(); f.componentInstance.setTab('faq'); f.detectChanges();
    const original = f.nativeElement.querySelector('#help-question-saip-costos') as HTMLButtonElement;
    original.click(); f.detectChanges(); f.componentInstance.onSearch('costo'); f.detectChanges();
    const filtered = f.nativeElement.querySelector('#help-question-saip-costos') as HTMLButtonElement;
    expect(filtered).not.toBeNull(); expect(filtered.getAttribute('aria-expanded')).toBe('false');
    expect(f.componentInstance.openQuestion()).toBeNull();
  });
  it('los IDs de respuestas son únicos y todas las relaciones de los acordeones existen', () => {
    const f = page(); f.componentInstance.setTab('faq'); f.detectChanges();
    const ids = Array.from(f.nativeElement.querySelectorAll('[id]') as NodeListOf<HTMLElement>).map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const button of Array.from(f.nativeElement.querySelectorAll('[aria-controls]') as NodeListOf<HTMLElement>)) {
      expect(f.nativeElement.querySelector(`#${button.getAttribute('aria-controls')}`)).not.toBeNull();
    }
  });
  it.each(['faq', 'estados', 'recorrido', 'pagina-ausente'])('atiende cambios de ancla %s sin dejar la búsqueda anterior', anchor => {
    const f = page(); f.componentInstance.onSearch('costo'); fragment.next(anchor); f.detectChanges();
    expect(f.componentInstance.searchQuery()).toBe(''); expect(f.componentInstance.openQuestion()).toBeNull();
    expect(f.componentInstance.tab()).toBe(anchor === 'faq' || anchor === 'estados' ? anchor : 'recorrido');
  });
  it('destruir la página cancela la observación del ancla', () => {
    const f = page(), c = f.componentInstance; f.destroy(); fragment.next('faq');
    expect(c.tab()).toBe('recorrido'); expect(fragment.observed).toBe(false);
  });
  it('interpola una búsqueda con marcado como texto sin ejecutarlo', () => {
    const f = page(), query = '<script>contenido-sintetico</script>'; f.componentInstance.onSearch(query); f.detectChanges();
    expect(f.nativeElement.textContent).toContain(query); expect(f.nativeElement.querySelector('script')).toBeNull();
  });
  it('cada enlace corresponde a una ruta registrada; no ofrece páginas o canales inexistentes', () => {
    const f = page(); const links = Array.from(f.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>);
    expect(links.map(a => a.getAttribute('href'))).toEqual(['/', '/ciudadano/nueva-saip', '/consultar']);
    for (const link of links) expect(routes.some(r => '/' + r.path === link.getAttribute('href'))).toBe(true);
  });
  it('explica incertidumbre, borradores y la ambigüedad de plazos sin resolverla', () => {
    const c = page().componentInstance, answers = c.faqCategories.flatMap(cat => cat.questions);
    expect(answers.find(q => /resultado.*incierto/.test(q.q))?.a).toContain('Recuperar recepción');
    expect(answers.find(q => /borrador/.test(q.q))?.a).toContain('no acreditan emisión');
    const appealDeadline = answers.find(q => /plazo.*apelación/.test(q.q))?.a;
    expect(appealDeadline).toContain('contradicción'); expect(appealDeadline).toContain('no elige');
  });
  it.each([null, 'CIUDADANO', 'TTAIP'])('la acción de alta conserva el guard existente para %s', async role => {
    const original = routes.find(r => r.path === 'ciudadano/nueva-saip')!;
    TestBed.configureTestingModule({ providers: [provideRouter([
      { path: 'ciudadano/nueva-saip', component: DestinationComponent, canActivate: original.canActivate },
      { path: 'login', component: DestinationComponent }, { path: '', component: DestinationComponent }
    ])] });
    if (role) TestBed.inject(AuthService).guardarSesion({ success: true, token: 'sesion-sintetica-ayuda',
      usuarioId: 9001, ciudadanoId: 9001, tipoUsuario: role });
    const f = page();
    const link = f.nativeElement.querySelector('a[href="/ciudadano/nueva-saip"]') as HTMLAnchorElement;
    link.click(); await f.whenStable();
    expect(TestBed.inject(Router).url).toBe(role === 'CIUDADANO' ? '/ciudadano/nueva-saip' : role ? '/' : '/login');
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
