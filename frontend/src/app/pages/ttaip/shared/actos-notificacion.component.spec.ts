import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { it, expect } from 'vitest';
import { environment } from '../../../../environments/environment';
import type { ActoNotificacion } from '../../../services/ttaip-actuaciones.service';
import { ActosNotificacionComponent } from './actos-notificacion.component';

it('separa los actos por etapa y muestra los anexos de la apelación en orden de envío', () => {
  TestBed.configureTestingModule({
    imports: [ActosNotificacionComponent],
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(ActosNotificacionComponent);
  fixture.componentRef.setInput('expedienteId', 41);
  fixture.componentRef.setInput('expediente', '00015-2026-JUS/TTAIP');
  fixture.detectChanges();

  const acto: ActoNotificacion = {
    id: 1, etapa: 'PRIMERA_CALIFICACION', destinatario: 'CIUDADANO', numero: '001',
    resolucionId: 11, numeroResolucion: '012', decision: 'INADMISIBLE', nombre: 'Administrado',
    tipo: 'CEDULA', medio: 'CORREO_ELECTRONICO', direccion: null, estado: 'VALIDADA', fechaEficacia: null,
    publicada: true, historica: false, requiereExpediente: false, firmado: null, cargo: null, acuse: null,
    anexos: [
      { id: 54, apelacionId: 2, tipoDocumento: 'DOCUMENTO_ADJUNTO', nombreOriginal: 'anexo.pdf', fechaCreacion: '2026-11-22T10:00:00' },
      { id: 51, apelacionId: 2, tipoDocumento: 'RECURSO_APELACION', nombreOriginal: 'recurso.pdf', fechaCreacion: '2026-11-21T09:00:00' },
    ],
  };
  http.expectOne(`${environment.apiUrl}/ttaip/expedientes/41/actos-notificacion`).flush([
    { ...acto, id: 4, etapa: 'RESOLUCION_FINAL', anexos: [] },
    { ...acto, id: 2, etapa: 'SEGUNDA_CALIFICACION', anexos: [] },
    acto,
    { ...acto, id: 3, etapa: 'SEGUNDA_CALIFICACION', destinatario: 'ENTIDAD_PUBLICA', anexos: [] },
  ]);
  fixture.detectChanges();

  const root = fixture.nativeElement as HTMLElement;
  const etapas = Array.from(root.querySelectorAll('[role="tab"]'));
  expect(etapas.map(h => h.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
    'Primera calificación Completa', 'Segunda calificación Completa', 'Resolución final Completa',
  ]);
  const primera = root.querySelector('section[aria-label="Primera calificación"]')!;
  expect(primera.querySelectorAll('article')).toHaveLength(1);
  expect(primera.querySelector('[class*="xl:grid-cols-2"]')).toBeNull();
  (etapas[1] as HTMLButtonElement).click();
  fixture.detectChanges();
  expect(root.querySelector('section[aria-label="Segunda calificación"]')!.querySelectorAll('article')).toHaveLength(2);
  (etapas[0] as HTMLButtonElement).click();
  fixture.detectChanges();
  const anexos = root.querySelector('section[aria-label="Primera calificación"]')!.querySelector('section[aria-label="Apelación"]')!;
  expect(anexos.textContent).toContain('Anexo de la apelación');
  const botones = Array.from(anexos.querySelectorAll('button'));
  expect(botones.map(b => b.getAttribute('aria-label'))).toEqual(['Previsualizar recurso.pdf', 'Previsualizar anexo.pdf']);
  botones[1].click();
  expect(fixture.componentInstance.preview()?.id).toBe(54);
  http.verify();
  TestBed.resetTestingModule();
});

it('confirma el cargo registrado y deja de pedir ese archivo', () => {
  TestBed.configureTestingModule({
    imports: [ActosNotificacionComponent],
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(ActosNotificacionComponent);
  fixture.componentRef.setInput('expedienteId', 41);
  fixture.componentRef.setInput('expediente', '00015-2026-JUS/TTAIP');
  fixture.componentRef.setInput('tribunal', true);
  fixture.detectChanges();
  const acto: ActoNotificacion = {
    id: 7, etapa: 'RESOLUCION_FINAL', destinatario: 'CIUDADANO', numero: 'C-7',
    resolucionId: 11, numeroResolucion: '012', decision: 'FUNDADO', nombre: 'Administrado',
    tipo: 'CEDULA', medio: 'CORREO_ELECTRONICO', direccion: 'persona@ejemplo.pe', estado: 'PENDIENTE', fechaEficacia: null,
    publicada: true, historica: false, requiereExpediente: false,
    firmado: { id: 8, nombreOriginal: 'cedula.pdf' }, cargo: null, acuse: null, anexos: [],
  };
  const url = `${environment.apiUrl}/ttaip/expedientes/41/actos-notificacion`;
  http.expectOne(url).flush([acto]);
  fixture.detectChanges();
  const archivos = [new File(['cargo'], 'cargo.pdf', { type: 'application/pdf' })];
  const files = Object.assign(() => archivos, { set: (valor: File[]) => { archivos.splice(0, archivos.length, ...valor); } });
  fixture.componentInstance.subir(acto, 'CARGO', { files } as never);
  const registrado = { ...acto, cargo: { id: 9, nombreOriginal: 'cargo.pdf' } };
  http.expectOne(`${url}/7/archivos/CARGO`).flush(registrado);
  http.expectOne(url).flush([registrado]);
  fixture.detectChanges();
  expect(fixture.componentInstance.confirmado()?.tipo).toBe('CARGO');
  const paso = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
    .find(boton => boton.textContent?.includes('Listo · Cargo'));
  paso?.click();
  fixture.detectChanges();
  const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
  expect(texto).toContain('Cargo registrado');
  expect(texto).not.toContain('Subir cargo');
  http.verify();
  TestBed.resetTestingModule();
});
