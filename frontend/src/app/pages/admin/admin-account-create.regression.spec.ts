import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { AdminUserCreateFormComponent } from './admin-user-create-form.component';
import { UsuarioService } from '../../services/usuario.service';

describe('Administrative creation without an explicit password', () => {
  it('never submits a shared credential when the administrator has not supplied one', async () => {
    const crear = vi.fn(() => of({ id: 81, email: 'new@example.invalid', tipoUsuario: 'CIUDADANO', activo: true }));
    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: UsuarioService, useValue: { crear } }],
    }).compileComponents();
    const init = vi.spyOn(AdminDashboardComponent.prototype, 'ngOnInit').mockImplementation(() => {});
    const fixture = TestBed.createComponent(AdminDashboardComponent);
    const c = fixture.componentInstance;
    // Both the published dashboard and the pending redesign use this creation form.
    (c.abrirModalUsuario as (mode?: string) => void)('create');
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(AdminUserCreateFormComponent)).componentInstance as AdminUserCreateFormComponent;
    form.form.patchValue({ nombre: 'Synthetic account', email: 'new@example.invalid', tipoUsuario: 'CIUDADANO' });
    form.submit();
    // Inspect only the count: a RED failure must never print credential-bearing call arguments.
    expect(crear.mock.calls.length).toBe(0);
    fixture.destroy();
    init.mockRestore();
  });
});
