import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ProfileDialogService } from '../services/profile-dialog.service';
import { ProfileDialogComponent } from './profile-dialog.component';
import { authInterceptor } from '../interceptors/auth.interceptor';

describe('Perfil propio — consulta respaldada y límites', () => {
  const base = 'http://localhost:8080/api';
  const account = { usuarioId: 7, email: 'synthetic@example.test', tipoUsuario: 'CIUDADANO', activo: true };
  const citizen = { id: 7, email: account.email, activo: true, nombreCompleto: 'Persona sintética',
    telefono: '900000001', direccion: 'Dirección sintética', dni: '00000007' };
  let auth: AuthService;
  let http: HttpTestingController;
  let dialog: ProfileDialogService;
  let f: ComponentFixture<ProfileDialogComponent> | undefined;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService); http = TestBed.inject(HttpTestingController); dialog = TestBed.inject(ProfileDialogService);
    auth.guardarSesion({ success: true, token: 'synthetic-A', usuarioId: 7, tipoUsuario: 'CIUDADANO', nombre: 'Dato obsoleto de sesión' });
  });
  afterEach(() => { f?.destroy(); f = undefined; http.verify(); localStorage.clear(); });
  function open() { dialog.abrir(); f = TestBed.createComponent(ProfileDialogComponent); f.detectChanges(); return f.componentInstance; }
  function complete() {
    http.expectOne(base + '/auth/me/7').flush(account); http.expectOne(base + '/ciudadanos/7').flush(citizen); f!.detectChanges();
  }
  function body() { return f!.nativeElement as HTMLElement; }

  it('queries the current account and own citizen key with Bearer; displays server fields, no mutation or session rewrite', () => {
    const before = localStorage.getItem('usuario'); const c = open();
    const me = http.expectOne(base + '/auth/me/7'); expect(me.request.method).toBe('GET'); expect(me.request.headers.get('Authorization')).toBe('Bearer synthetic-A'); me.flush(account);
    const own = http.expectOne(base + '/ciudadanos/7'); expect(own.request.headers.get('Authorization')).toBe('Bearer synthetic-A'); own.flush(citizen); f!.detectChanges();
    expect(c.perfil()?.nombre).toBe(citizen.nombreCompleto);
    expect((body().querySelector('#own-profile-name') as HTMLInputElement).value).toBe(citizen.nombreCompleto);
    expect(body().textContent).not.toContain('Dato obsoleto');
    expect(localStorage.getItem('usuario')).toBe(before); expect(http.match(r => r.method !== 'GET')).toHaveLength(0);
  });

  it('edits contact fields and saves them with PUT, without a password field', () => {
    const c = open(); complete();
    const fields = Array.from(body().querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea'));
    expect(fields.length).toBeGreaterThan(4); expect(fields.every(x => !x.readOnly)).toBe(true);
    expect(body().querySelector('input[type="password"]')).toBeNull();
    expect(body().textContent).toContain('El documento y la contraseña no se cambian aquí');
    const name = body().querySelector<HTMLInputElement>('#own-profile-name')!;
    name.value = 'Nombre actualizado'; name.dispatchEvent(new Event('input')); f!.detectChanges();
    const save = Array.from(body().querySelectorAll('button')).find(b => b.textContent?.includes('Guardar'))!;
    expect(save.disabled).toBe(false); save.click();
    const put = http.expectOne(base + '/ciudadanos/7');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual(expect.objectContaining({
      nombreCompleto: 'Nombre actualizado', email: account.email, telefono: citizen.telefono
    }));
    put.flush({ ...citizen, nombreCompleto: 'Nombre actualizado' }); f!.detectChanges();
    expect(dialog.abierto()).toBe(false);
    expect(auth.obtenerSesion()?.nombreCompleto).toBe('Nombre actualizado');
    expect(c.perfil()).toBeNull();
  });

  it('keeps the form open and shows the server reason when the save is rejected', () => {
    open(); complete();
    const save = Array.from(body().querySelectorAll('button')).find(b => b.textContent?.includes('Guardar'))!;
    save.click();
    http.expectOne(base + '/ciudadanos/7').flush(
      { detail: 'Ya existe una cuenta con ese correo.' }, { status: 409, statusText: 'Conflict' });
    f!.detectChanges();
    expect(dialog.abierto()).toBe(true);
    expect(body().textContent).toContain('Ya existe una cuenta con ese correo.');
    expect(body().textContent).not.toContain('PRIVATE');
  });

  it('does not infer natural/company type, RUC, representative, location or verification from login claims', () => {
    auth.guardarSesion({ success: true, token: 'synthetic-A', usuarioId: 7, tipoUsuario: 'CIUDADANO', tipoPersona: 'JURIDICA', ruc: 'invented-ruc', representanteNombreCompleto: 'Inventado' });
    open(); http.expectOne(base + '/auth/me/7').flush(account); http.expectOne(base + '/ciudadanos/7').flush({ ...citizen, dni: null, nombreCompleto: null, telefono: null, direccion: null }); f!.detectChanges();
    expect(body().textContent).toContain('No informado en esta consulta'); expect(body().textContent).toContain('no identifica el tipo de persona');
    expect(body().textContent).not.toContain('invented-ruc'); expect(body().textContent).not.toContain('Inventado');
    expect((body().querySelector('#own-profile-name') as HTMLInputElement).value).toBe('');
  });

  it.each([null, {}, { ...account, usuarioId: 8 }, { ...account, tipoUsuario: 'ADMINISTRADOR' }, { ...account, activo: false }, { ...account, email: '' }])('rejects absent/incoherent account data before querying a citizen (%j)', result => {
    const c = open(); http.expectOne(base + '/auth/me/7').flush(result); f!.detectChanges();
    expect(c.perfil()).toBeNull(); expect(body().textContent).toContain('incompleta'); expect(http.match(base + '/ciudadanos/7')).toHaveLength(0);
  });

  it.each([null, {}, { ...citizen, id: 8 }, { ...citizen, activo: false }, { ...citizen, email: 'other@example.test' }])('never renders citizen data with an incompatible relationship (%j)', result => {
    const c = open(); http.expectOne(base + '/auth/me/7').flush(account); http.expectOne(base + '/ciudadanos/7').flush(result); f!.detectChanges();
    expect(c.perfil()).toBeNull(); expect(body().querySelector('#own-profile-email')).toBeNull(); expect(body().textContent).toContain('incompleta');
  });

  for (const stage of ['account', 'citizen']) {
    it.each([400, 401, 403, 404, 422, 500, 503, 0])(`sanitizes ${stage} query error %s without fallback or success`, status => {
      const c = open(); let req = http.expectOne(base + '/auth/me/7');
      if (stage === 'citizen') { req.flush(account); req = http.expectOne(base + '/ciudadanos/7'); }
      if (status === 0) req.error(new ProgressEvent('error')); else req.flush({ detail: 'PRIVATE-SERVER-DETAIL' }, { status, statusText: 'Synthetic failure' });
      f!.detectChanges(); expect(c.perfil()).toBeNull(); expect(c.loading()).toBe(false); expect(body().querySelector('[role="alert"]')).toBeTruthy();
      expect(body().textContent).not.toContain('PRIVATE-SERVER-DETAIL'); expect(body().querySelector('#own-profile-name')).toBeNull();
      expect(c.retry()).toBe(status === 0 || status >= 500); expect(http.match(r => r.method !== 'GET')).toHaveLength(0);
    });
  }

  it('clears old fields while reloading; retry only reads and recovers confirmed server data', () => {
    const c = open(); complete(); c.cargar(); f!.detectChanges();
    expect(c.perfil()).toBeNull(); expect(body().querySelector('#own-profile-name')).toBeNull();
    http.expectOne(base + '/auth/me/7').flush(null, { status: 500, statusText: 'Failure' }); f!.detectChanges();
    body().querySelector<HTMLButtonElement>('[role="alert"] button')!.click(); complete(); expect(c.perfil()?.email).toBe(account.email);
    expect(http.match(r => r.method !== 'GET')).toHaveLength(0);
  });

  it('cancels the previous read during a new read and uses only the last result', () => {
    const c = open(); const first = http.expectOne(base + '/auth/me/7'); c.cargar(); expect(first.cancelled).toBe(true); complete();
    expect(c.perfil()?.nombre).toBe(citizen.nombreCompleto);
  });

  it.each(['account', 'citizen'])('closing during %s cancels it and prevents later writes or reads', stage => {
    const c = open(); let req = http.expectOne(base + '/auth/me/7');
    if (stage === 'citizen') { req.flush(account); req = http.expectOne(base + '/ciudadanos/7'); }
    c.cerrar(); expect(req.cancelled).toBe(true); c.cargar(); expect(c.perfil()).toBeNull(); expect(dialog.abierto()).toBe(false); http.expectNone(() => true);
  });

  it('discards an account callback after closing, even if its producer ignores cancellation', () => {
    const source = new Subject<any>(); vi.spyOn(auth, 'getUsuarioActual').mockReturnValue(source); const c = open(); c.cerrar(); source.next(account);
    expect(c.perfil()).toBeNull(); http.expectNone(base + '/ciudadanos/7');
  });

  it('does not start the next query if session changes before the account response', () => {
    const c = open(); const req = http.expectOne(base + '/auth/me/7'); auth.guardarSesion({ success: true, token: 'synthetic-B', usuarioId: 8, tipoUsuario: 'CIUDADANO' });
    req.flush(account); expect(c.perfil()).toBeNull(); http.expectNone(base + '/ciudadanos/7'); f!.detectChanges(); expect(dialog.abierto()).toBe(false);
  });

  it('does not transfer an opening to a session that arrives before the global host mounts', () => {
    dialog.abrir(); auth.guardarSesion({ success: true, token: 'synthetic-B', usuarioId: 8, tipoUsuario: 'CIUDADANO' });
    f = TestBed.createComponent(ProfileDialogComponent); f.detectChanges();
    expect(dialog.abierto()).toBe(false); expect(f.componentInstance.perfil()).toBeNull(); http.expectNone(() => true);
  });

  it('does not expose old profile before render following a session change', () => {
    const c = open(); complete(); auth.guardarSesion({ success: true, token: 'synthetic-B', usuarioId: 7, tipoUsuario: 'CIUDADANO' });
    expect(c.perfil()).toBeNull(); f!.detectChanges(); expect(dialog.abierto()).toBe(false);
  });

  it('discards the opening on a session revision even if the stored token and user ID are unchanged', () => {
    const c = open(); complete(); auth.guardarSesion({ success: true, token: 'synthetic-A', usuarioId: 7, tipoUsuario: 'CIUDADANO' });
    expect(c.perfil()).toBeNull(); f!.detectChanges(); expect(dialog.abierto()).toBe(false);
  });

  it('invalidates and cancels when the account role changes', () => {
    const c = open(); const req = http.expectOne(base + '/auth/me/7'); auth.guardarSesion({ success: true, token: 'synthetic-A', usuarioId: 7, tipoUsuario: 'ADMINISTRADOR' });
    f!.detectChanges(); expect(c.perfil()).toBeNull(); expect(req.cancelled).toBe(true); expect(dialog.abierto()).toBe(false);
  });

  it('clears confirmed personal data on logout without changing global/per-session revocation', () => {
    const c = open(); complete(); void auth.cerrarSesion(); expect(c.perfil()).toBeNull(); f!.detectChanges();
    expect(dialog.abierto()).toBe(false); http.expectOne(base + '/auth/logout').flush(null); expect(auth.getToken()).toBeNull();
  });

  it('destruction cancels the read and prevents future loads', () => {
    const c = open(); const req = http.expectOne(base + '/auth/me/7'); f!.destroy(); f = undefined; expect(req.cancelled).toBe(true); c.cargar(); http.expectNone(() => true);
  });

  it('reopening reads again instead of using cached personal/session data', () => {
    open(); complete(); f!.destroy(); f = undefined; const c = open(); expect(c.perfil()).toBeNull(); complete();
  });

  it('names the dialog, focuses close, contains Tab/Shift+Tab, closes on Escape and restores the opener', async () => {
    const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
    open(); complete(); await Promise.resolve(); const panel = body().querySelector<HTMLElement>('[role="dialog"]')!;
    // jsdom 27.4 misorders grouped selectors after dynamic insertion (independent
    // reproduction recorded locally). Model standard DOM order ONLY on this panel;
    // do not change production focus logic, dependencies or global DOM behavior.
    const query = panel.querySelectorAll.bind(panel);
    vi.spyOn(panel, 'querySelectorAll').mockImplementation(((selector: string) => {
      const ordered = Array.from(query(selector)).sort((a, b) => a === b ? 0 :
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
      return ordered as unknown as NodeListOf<Element>;
    }) as typeof panel.querySelectorAll);
    expect(panel.getAttribute('aria-modal')).toBe('true'); expect(body().querySelector('#' + panel.getAttribute('aria-labelledby'))?.textContent).toBe('Mi perfil');
    const close = panel.querySelector<HTMLButtonElement>('[aria-label="Cerrar perfil"]')!; expect(document.activeElement).toBe(close);
    const last = Array.from(panel.querySelectorAll<HTMLButtonElement>('button')).filter(x => !x.disabled).at(-1)!; last.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true })); expect(document.activeElement).toBe(close);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true, bubbles: true })); expect(document.activeElement).toBe(last);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); expect(dialog.abierto()).toBe(false);
    f!.destroy(); f = undefined; expect(document.activeElement).toBe(trigger); trigger.remove();
  });

  it('treats long values as text, without generating links or executable markup', () => {
    open(); http.expectOne(base + '/auth/me/7').flush(account); http.expectOne(base + '/ciudadanos/7').flush({ ...citizen, nombreCompleto: '<script>invalid()</script>' + 'x'.repeat(500) }); f!.detectChanges();
    expect(body().querySelector('script')).toBeNull(); expect((body().querySelector('#own-profile-name') as HTMLInputElement).value).toContain('<script>');
  });

  it.each(['FUNCIONARIO', 'TTAIP', 'ADMINISTRADOR', '', undefined])('does not open the citizen overlay for role %s', tipoUsuario => {
    auth.guardarSesion({ success: true, token: 'synthetic', usuarioId: 7, tipoUsuario }); dialog.abrir(); expect(dialog.abierto()).toBe(false); http.expectNone(() => true);
  });

  it.each([0, -1, 1.5, undefined])('does not open for an invalid own ID %s', usuarioId => {
    auth.guardarSesion({ success: true, token: 'synthetic', usuarioId, tipoUsuario: 'CIUDADANO' }); dialog.abrir(); expect(dialog.abierto()).toBe(false);
  });

  it('unreadable or absent session does not trigger a profile query', () => {
    localStorage.setItem('usuario', '{'); expect(() => dialog.abrir()).not.toThrow(); expect(dialog.abierto()).toBe(false);
    localStorage.removeItem('usuario'); dialog.abrir(); expect(dialog.abierto()).toBe(false); http.expectNone(() => true);
  });
});
