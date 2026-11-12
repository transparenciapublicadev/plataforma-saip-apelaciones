import '@angular/compiler';
import '../../../test-setup';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import {
  BorradorInstitucional,
  PaginaReporte,
  ReportesInstitucionalesService,
  ResumenInstitucional
} from '../../services/reportes-institucionales.service';
import { ReportesInstitucionalesComponent } from './reportes-institucionales.component';

try {
  getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // already initialized
}

describe('ReportesInstitucionalesComponent', () => {
  const currentYear = new Date().getFullYear();
  const desde = `${currentYear}-01-01`;
  const hasta = `${currentYear}-12-31`;

  const resumenMock: ResumenInstitucional = {
    modo: 'entidad',
    ambito: 'ENTIDAD',
    entidadId: 5,
    entidad: 'Municipalidad Distrital de San Isidro',
    desde,
    hasta,
    consultado: '2026-11-08T10:00:00',
    total: 45,
    conActuacion: 40,
    estados: [{ etiqueta: 'RESPONDIDA', cantidad: 40 }, { etiqueta: 'EN_REVISION', cantidad: 5 }],
    porMes: [
      { etiqueta: '2026-01', cantidad: 10 },
      { etiqueta: '2026-02', cantidad: 15 },
      { etiqueta: '2026-03', cantidad: 20 }
    ],
    resultados: [{ etiqueta: 'ENTREGA_TOTAL', cantidad: 38 }, { etiqueta: 'ENTREGA_PARCIAL', cantidad: 2 }],
    alcance: 'Ámbito institucional autorizado'
  };

  const borradorMock: BorradorInstitucional = {
    id: 'borrador-1',
    modo: 'entidad',
    desde,
    hasta,
    version: 3,
    actualizado: '2026-11-08T09:00:00',
    operacionId: 'uuid-123',
    estado: 'BORRADOR',
    resumen: resumenMock,
    cualitativo: {
      factores: 'Alta demanda en el primer trimestre',
      frasaiNombre: 'Juan Perez',
      frasaiCargo: 'Oficial de Información'
    }
  };

  const paginaDetalleMock: PaginaReporte<any> = {
    content: [
      { id: 1, expediente: 'SAIP-2026-00001', fecha: '2026-01-15', asunto: 'Asunto', entidad: 'San Isidro', estado: 'RESPONDIDA', resultado: 'ENTREGA_TOTAL', actuacionRegistrada: true }
    ],
    totalElements: 1,
    totalPages: 1,
    number: 0,
    size: 15
  };

  const paginaHistorialMock: PaginaReporte<BorradorInstitucional> = {
    content: [borradorMock],
    totalElements: 1,
    totalPages: 1,
    number: 0,
    size: 15
  };

  const mockReportesService = {
    resumen: vi.fn(),
    borrador: vi.fn(),
    detalle: vi.fn(),
    historial: vi.fn(),
    guardar: vi.fn()
  };

  const mockAuthService = {
    estaLogueado: vi.fn(() => true),
    getTipoUsuario: vi.fn(() => 'FUNCIONARIO'),
    obtenerSesion: vi.fn(() => ({
      usuarioId: 10,
      funcionarioId: 10,
      nombre: 'Carlos Sanchez',
      entidadId: 5,
      entidadNombre: 'Municipalidad Distrital de San Isidro',
      token: 'jwt-token-123'
    })),
    cambiosSesion: vi.fn(() => 1)
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockReportesService.resumen.mockReturnValue(of(resumenMock));
    mockReportesService.borrador.mockReturnValue(of(borradorMock));
    mockReportesService.detalle.mockReturnValue(of(paginaDetalleMock));
    mockReportesService.historial.mockReturnValue(of(paginaHistorialMock));
    mockReportesService.guardar.mockReturnValue(of({ ok: true, version: 4 }));

    TestBed.overrideComponent(ReportesInstitucionalesComponent, {
      set: { template: '', styles: [] }
    });

    await TestBed.configureTestingModule({
      imports: [ReportesInstitucionalesComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: {} // default entidad mode
            }
          }
        },
        { provide: ReportesInstitucionalesService, useValue: mockReportesService },
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('se inicializa en modo entidad por defecto y consulta el periodo', () => {
    const fixture = TestBed.createComponent(ReportesInstitucionalesComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    expect(comp.modo).toBe('entidad');
    expect(comp.panel).toBe('/funcionario');
    expect(mockReportesService.resumen).toHaveBeenCalledWith('entidad', desde, hasta);
    expect(mockReportesService.borrador).toHaveBeenCalledWith('entidad', desde, hasta);
    expect(comp.estado()).toBe('listo');
    expect(comp.resumen()).toEqual(resumenMock);
  });

  it('el título refleja la entidad del resumen o sesión', () => {
    const fixture = TestBed.createComponent(ReportesInstitucionalesComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    expect(comp.titulo).toBe('Informe de solicitudes · Municipalidad Distrital de San Isidro');
  });

  it('permite cambiar entre las 4 pestañas: resumen, informe, detalle, historial', () => {
    const fixture = TestBed.createComponent(ReportesInstitucionalesComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    expect(comp.tab()).toBe('resumen');

    comp.tab.set('informe');
    fixture.detectChanges();
    expect(comp.tab()).toBe('informe');

    comp.tab.set('detalle');
    fixture.detectChanges();
    expect(comp.tab()).toBe('detalle');

    comp.tab.set('historial');
    fixture.detectChanges();
    expect(comp.tab()).toBe('historial');
  });

  it('precarga datos del funcionario en campos FRASAI si el borrador viene vacío', () => {
    const borradorVacio: BorradorInstitucional = {
      id: 'borrador-2',
      modo: 'entidad',
      desde,
      hasta,
      version: 1,
      actualizado: '2026-11-08T09:00:00',
      operacionId: 'uuid-vacio',
      estado: 'BORRADOR',
      resumen: resumenMock,
      cualitativo: {}
    };
    mockReportesService.borrador.mockReturnValue(of(borradorVacio));

    const fixture = TestBed.createComponent(ReportesInstitucionalesComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    expect(comp.cualitativo['frasaiNombre']).toBe('Carlos Sanchez');
    expect(comp.cualitativo['frasaiCargo']).toBe('Responsable de Acceso a la Información Pública');
  });

  it('ejecuta guardado optimista con UUID y version anterior', () => {
    const fixture = TestBed.createComponent(ReportesInstitucionalesComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    comp.cualitativo['factores'] = 'Nuevos factores agregados';
    comp.guardar();

    expect(mockReportesService.guardar).toHaveBeenCalledWith(
      'entidad',
      desde,
      hasta,
      expect.objectContaining({
        version: 3,
        cualitativo: expect.objectContaining({
          factores: 'Nuevos factores agregados'
        })
      })
    );
  });

  it('nombra las pestañas como en el informe de la entidad', () => {
    const fixture = TestBed.createComponent(ReportesInstitucionalesComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.tabs.map((t) => t.label)).toEqual([
      'Resumen', 'Informe ANTAIP', 'Detalle', 'Historial',
    ]);
  });

  it('consulta el primer semestre al cambiar el tipo de periodo', () => {
    const fixture = TestBed.createComponent(ReportesInstitucionalesComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    comp.cambiarTipo('semestre');

    expect(comp.desde).toBe(`${currentYear}-01-01`);
    expect(comp.hasta).toBe(`${currentYear}-06-30`);
    expect(mockReportesService.resumen).toHaveBeenLastCalledWith('entidad', `${currentYear}-01-01`, `${currentYear}-06-30`);
  });

  it('prepara Excel y PDF del periodo consultado aunque no exista borrador', () => {
    mockReportesService.borrador.mockReturnValue(of(null));
    const fixture = TestBed.createComponent(ReportesInstitucionalesComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    expect(comp.borrador()).toBeNull();
    expect(comp.puedeExportar()).toBe(true);
    expect(comp.documentoConsulta()).toEqual(expect.objectContaining({
      id: '',
      desde,
      hasta,
      resumen: resumenMock,
    }));
  });

  it('maneja error cuando el usuario no está autenticado o no tiene rol adecuado', () => {
    mockAuthService.estaLogueado.mockReturnValue(false);
    const fixture = TestBed.createComponent(ReportesInstitucionalesComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    expect(comp.estado()).toBe('error');
    expect(comp.error()).toContain('Inicia sesión');
  });

  it('calcula fundados y en trámite con las resoluciones registradas', () => {
    const fixture = TestBed.createComponent(ReportesInstitucionalesComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    comp.resumen.set({
      ...resumenMock,
      modo: 'ttaip',
      total: 7,
      conActuacion: 4,
      resultados: [
        { etiqueta: 'FUNDADO', cantidad: 2 },
        { etiqueta: 'FUNDADO_EN_PARTE', cantidad: 1 },
        { etiqueta: 'INFUNDADO', cantidad: 1 },
      ],
    });

    expect(comp.fundados()).toBe(3);
    expect(comp.tasaFundados()).toBe(75);
    expect(comp.enTramite()).toBe(3);
    expect(comp.tasaAtencion()).toBe('57%');
  });
});
