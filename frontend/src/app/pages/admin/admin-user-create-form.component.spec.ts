import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { AdminUserCreateFormComponent } from './admin-user-create-form.component';

describe('AdminUserCreateFormComponent', () => {
  let fixture: ComponentFixture<AdminUserCreateFormComponent>;
  let component: AdminUserCreateFormComponent;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/usuarios`;
  const syntheticPassword = ' Synthetic-test-only-81 ';
  const result = { id: 81, email: 'new@example.invalid', tipoUsuario: 'FUNCIONARIO', activo: true, nombre: 'Synthetic account', fechaRegistro: '2026-10-23', entidadId: 7 };

  function fill(): void {
    component.form.setValue({ nombre: 'Synthetic account', email: result.email, tipoUsuario: 'FUNCIONARIO', entidadId: 7, password: syntheticPassword, confirmation: syntheticPassword });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminUserCreateFormComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminUserCreateFormComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => { http.verify(); fixture.destroy(); });

  it('starts without a password or confirmation and never supplies a default', () => {
    expect(component.form.controls.password.value).toBe('');
    expect(component.form.controls.confirmation.value).toBe('');
    const inputs = fixture.nativeElement.querySelectorAll('input[type=password]');
    expect([...inputs].every((input: HTMLInputElement) => input.value === '')).toBe(true);
    component.submit();
    http.expectNone(url);
  });

  it.each(['', '       ', 'short', 'a'.repeat(73)])('rejects invalid password case %# without a request', (password) => {
    fill();
    component.form.patchValue({ password, confirmation: password });
    component.submit();
    expect(component.form.invalid).toBe(true);
    http.expectNone(url);
  });

  it('requires matching confirmation and a valid email', () => {
    fill();
    component.form.patchValue({ confirmation: 'does-not-match' });
    component.submit();
    expect(component.form.hasError('passwordMismatch')).toBe(true);
    component.form.patchValue({ confirmation: syntheticPassword, email: 'invalid' });
    component.submit();
    http.expectNone(url);
  });

  it('matches the existing BCrypt byte limit for non-ASCII passwords', () => {
    fill();
    component.form.patchValue({ password: 'ñ'.repeat(36), confirmation: 'ñ'.repeat(36) });
    expect(component.form.valid).toBe(true);
    component.form.patchValue({ password: 'ñ'.repeat(36) + 'a', confirmation: 'ñ'.repeat(36) + 'a' });
    component.submit();
    expect(component.form.controls.password.hasError('passwordBytes')).toBe(true);
    http.expectNone(url);
  });

  it('sends the explicit password once with the selected role/entity and confirms only the server result', () => {
    const created = vi.fn();
    component.created.subscribe(created);
    const localWrite = vi.spyOn(localStorage, 'setItem');
    const sessionWrite = vi.spyOn(sessionStorage, 'setItem');
    fill();
    component.submit();
    component.submit();
    const request = http.expectOne(url);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: result.email, nombre: result.nombre, tipoUsuario: 'FUNCIONARIO', entidadId: 7, password: syntheticPassword });
    expect(created.mock.calls.length).toBe(0);
    request.flush(result);
    expect(created).toHaveBeenCalledExactlyOnceWith(result);
    expect(component.form.controls.password.value).toBe('');
    expect(component.form.controls.confirmation.value).toBe('');
    expect(localWrite.mock.calls.length).toBe(0);
    expect(sessionWrite.mock.calls.length).toBe(0);
    localWrite.mockRestore(); sessionWrite.mockRestore();
  });

  it.each([400, 401, 403, 404, 409, 500])('keeps the form open without success after HTTP %i', (status) => {
    fill();
    const created = vi.fn(); const cancelled = vi.fn();
    component.created.subscribe(created); component.cancelled.subscribe(cancelled);
    component.submit();
    http.expectOne(url).flush({ detail: 'Untrusted server detail' }, { status, statusText: 'Rejected' });
    expect(created.mock.calls.length).toBe(0); expect(cancelled.mock.calls.length).toBe(0);
    expect(component.error()).not.toContain('Untrusted');
    expect(component.error().length).toBeGreaterThan(0);
    expect(component.form.controls.email.value).toBe(result.email);
    expect(component.form.controls.password.value).toBe('');
    expect(component.form.controls.confirmation.value).toBe('');
    expect(component.saving()).toBe(false);
  });

  it('treats network failure as unconfirmed and permits an explicit retry after checking the listing', () => {
    fill(); component.submit();
    http.expectOne(url).error(new ProgressEvent('error'));
    expect(component.error()).toContain('Consulte el listado');
    component.submit(); http.expectNone(url);
    component.form.patchValue({ password: syntheticPassword, confirmation: syntheticPassword });
    component.submit(); http.expectOne(url).flush(result);
  });

  it.each([null, { ...result, id: 0 }, { ...result, email: 'another@example.invalid' }])('does not confirm an invalid response %#', (response) => {
    const created = vi.fn(); component.created.subscribe(created);
    fill(); component.submit(); http.expectOne(url).flush(response);
    expect(created.mock.calls.length).toBe(0);
    expect(component.error()).toContain('No se pudo confirmar');
    expect(component.form.controls.password.value).toBe('');
  });

  it('clears secrets and cancels the pending subscription on cancel', () => {
    const cancelled = vi.fn(); const created = vi.fn();
    component.cancelled.subscribe(cancelled); component.created.subscribe(created);
    fill(); component.submit(); const request = http.expectOne(url);
    component.cancel();
    expect(request.cancelled).toBe(true);
    expect(component.form.controls.password.value).toBe('');
    expect(component.form.controls.confirmation.value).toBe('');
    expect(cancelled.mock.calls.length).toBe(1); expect(created.mock.calls.length).toBe(0);
    component.submit(); http.expectNone(url);
  });

  it('clears secrets and prevents a late result after leaving the form', () => {
    const created = vi.fn(); component.created.subscribe(created);
    fill(); component.submit(); const request = http.expectOne(url);
    fixture.destroy();
    expect(request.cancelled).toBe(true);
    expect(component.form.controls.password.value).toBe('');
    expect(component.form.controls.confirmation.value).toBe('');
    expect(created.mock.calls.length).toBe(0);
  });
});
