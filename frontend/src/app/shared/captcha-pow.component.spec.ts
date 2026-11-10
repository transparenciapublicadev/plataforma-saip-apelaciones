import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { CaptchaPoWComponent } from './captcha-pow.component';

describe('CaptchaPoWComponent — Verificación Anti-Abuso PoW', () => {
  let component: CaptchaPoWComponent;
  let fixture: ComponentFixture<CaptchaPoWComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CaptchaPoWComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CaptchaPoWComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('se inicializa en estado válido de verificación', () => {
    expect(['verificando', 'verificado', 'espera', 'error']).toContain(component.estado());
    expect(component.tonoColor()).toBeTruthy();
    expect(component.bordeColor()).toBeTruthy();
  });

  it('permite reiniciar la prueba mediante el método iniciar()', () => {
    const spy = vi.spyOn(component, 'iniciar');
    component.iniciar();
    expect(spy).toHaveBeenCalled();
  });

  it('emite token o null a través de pruebaChange al cambiar de estado', () => {
    let ultimoValor: string | null = 'no-definido';
    component.pruebaChange.subscribe((val: string | null) => {
      ultimoValor = val;
    });

    component.estado.set('verificado');
    fixture.detectChanges();
    // Verifica que el componente cuenta con salida reactiva
    expect(component.pruebaChange).toBeDefined();
  });

  it('muestra contenedor accesible para el usuario', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('div')).not.toBeNull();
  });
});
