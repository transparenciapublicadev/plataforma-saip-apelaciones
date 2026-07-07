import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Solicitud } from '../../models/solicitud.model';
import { Respuesta } from '../../models/respuesta.model';
import { AuthService } from '../../services/auth.service';
import { DocumentoService } from '../../services/documento.service';
import { RespuestaService } from '../../services/respuesta.service';
import { SolicitudService } from '../../services/solicitud.service';
import { FuncionarioResponderComponent } from './funcionario-responder.component';

describe('FuncionarioResponderComponent document flow', () => {
  const solicitudService = {
    findByExpediente: vi.fn()
  };
  const respuestaService = {
    aceptarSolicitud: vi.fn(),
    denegarSolicitud: vi.fn(),
    getCausalesDenegacion: vi.fn()
  };
  const documentoService = {
    upload: vi.fn()
  };
  const authService = {
    obtenerSesion: vi.fn(() => ({ funcionarioId: 5, nombre: 'Funcionario' }))
  };
  const router = {
    navigate: vi.fn()
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    respuestaService.getCausalesDenegacion.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [FuncionarioResponderComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
        { provide: Router, useValue: router },
        { provide: SolicitudService, useValue: solicitudService },
        { provide: RespuestaService, useValue: respuestaService },
        { provide: DocumentoService, useValue: documentoService },
        { provide: AuthService, useValue: authService }
      ]
    })
      .overrideComponent(FuncionarioResponderComponent, { set: { template: '' } })
      .compileComponents();
  });

  it('creates the response and then uploads its document using respuestaId', async () => {
    const fixture = TestBed.createComponent(FuncionarioResponderComponent);
    const component = fixture.componentInstance;
    const file = new File(['respuesta'], 'respuesta.pdf', { type: 'application/pdf' });
    const respuesta = { id: 44, tipoRespuesta: 'ENTREGA_TOTAL' } as Respuesta;
    respuestaService.aceptarSolicitud.mockReturnValue(of(respuesta));
    documentoService.upload.mockReturnValue(of({
      id: 71,
      respuestaId: 44,
      nombreOriginal: file.name
    }));

    prepareValidResponse(component, file);
    component.enviarRespuesta();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(documentoService.upload).toHaveBeenCalledWith(
      file,
      'RESPUESTA_ENTIDAD',
      { respuestaId: 44 }
    );
    expect(component.documentUploadWarning()).toBe('');
    expect(component.successModalAbierto()).toBe(true);
  });

  it('reports partial success when the response is saved but its document upload fails', async () => {
    const fixture = TestBed.createComponent(FuncionarioResponderComponent);
    const component = fixture.componentInstance;
    const file = new File(['respuesta'], 'respuesta.pdf', { type: 'application/pdf' });
    respuestaService.aceptarSolicitud.mockReturnValue(of({
      id: 44,
      tipoRespuesta: 'ENTREGA_TOTAL'
    } as Respuesta));
    documentoService.upload.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 422,
      error: {
        title: 'Documento inválido',
        detail: 'El archivo no pudo almacenarse.'
      }
    })));

    prepareValidResponse(component, file);
    component.enviarRespuesta();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(component.solicitud()?.estado).toBe('RESPONDIDA');
    expect(component.documentUploadWarning()).toContain('El archivo no pudo almacenarse.');
    expect(component.respuestaSuccessTone()).toBe('warning');
    expect(component.successModalAbierto()).toBe(true);
  });

  function prepareValidResponse(
    component: FuncionarioResponderComponent,
    file: File
  ): void {
    component.solicitud.set({
      id: 12,
      expediente: 'SAIP-2026-00012',
      estado: 'EN_REVISION',
      diasRestantes: 5,
      respuesta: null
    } as Solicitud);
    component.decision.set('entrega_total');
    component.descripcionAceptacion = 'Se entrega la información solicitada.';
    component.documentosEntrega.set([file]);
  }
});
