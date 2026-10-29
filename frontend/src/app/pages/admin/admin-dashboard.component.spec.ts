import { By } from '@angular/platform-browser';
import { AdminUserCreateFormComponent } from './admin-user-create-form.component';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { of, throwError, Subject } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { EntidadService } from '../../services/entidad.service';
import { SolicitudService } from '../../services/solicitud.service';
import { ApelacionService } from '../../services/apelacion.service';
import { UsuarioService } from '../../services/usuario.service';
import { EstadisticasService } from '../../services/estadisticas.service';
import { ReportesService } from '../../services/reportes.service';
import { SystemConfigService, DEFAULT_CONFIG } from '../../services/system-config.service';
import { GuidedTourService } from '../../core/guided-tour/guided-tour.service';
import { Solicitud } from '../../models/solicitud.model';
import { Apelacion } from '../../models/apelacion.model';
import { Entidad } from '../../models/entidad.model';

describe('AdminDashboardComponent', () => {
  let component: AdminDashboardComponent;
  let fixture: ComponentFixture<AdminDashboardComponent>;

  let entidadServiceMock: Partial<EntidadService>;
  let solicitudServiceMock: Partial<SolicitudService>;
  let apelacionServiceMock: Partial<ApelacionService>;
  let usuarioServiceMock: Partial<UsuarioService>;
  let estadisticasServiceMock: Partial<EstadisticasService>;
  let reportesServiceMock: Partial<ReportesService>;
  let configService: SystemConfigService;
  let tourService: GuidedTourService;

  const mockEntidades: any[] = [
    { id: 1, nombre: 'Ministerio de Justicia', acronimo: 'MINJUS', activa: true, solicitudesAsignadas: 0, pendientes: 0, respondidas: 0, vencidas: 0, tasaCumplimiento: 0 },
    { id: 2, nombre: 'Ministerio de Salud', acronimo: 'MINSA', activa: true, solicitudesAsignadas: 0, pendientes: 0, respondidas: 0, vencidas: 0, tasaCumplimiento: 0 },
  ];

  const mockSolicitudes: Solicitud[] = [
    {
      id: 1,
      expediente: 'SAIP-2026-00001',
      entidadId: 1,
      entidadNombre: 'Ministerio de Justicia',
      entidadAcronimo: 'MINJUS',
      ciudadanoId: 10,
      ciudadanoNombre: 'Juan Perez',
      estado: 'RESPONDIDA',
      fechaPresentacion: '2026-03-01',
    } as any,
    {
      id: 2,
      expediente: 'SAIP-2026-00002',
      entidadId: 1,
      entidadNombre: 'Ministerio de Justicia',
      entidadAcronimo: 'MINJUS',
      ciudadanoId: 11,
      ciudadanoNombre: 'Maria Lopez',
      estado: 'EN_REVISION',
      fechaPresentacion: '2026-03-05',
    } as any,
    {
      id: 3,
      expediente: 'SAIP-2026-00003',
      entidadId: 2,
      entidadNombre: 'Ministerio de Salud',
      entidadAcronimo: 'MINSA',
      ciudadanoId: 12,
      ciudadanoNombre: 'Carlos Ruiz',
      estado: 'VENCIDA',
      fechaPresentacion: '2026-02-15',
    } as any,
  ];

  const mockApelaciones: Apelacion[] = [
    {
      id: 1,
      expediente: '00001-2026-JUS/TTAIP',
      solicitudExpediente: 'SAIP-2026-00001',
      entidadNombre: 'Ministerio de Justicia',
      estado: 'RESUELTO_FUNDADO',
      fechaApelacion: '2026-03-10',
    } as any,
    {
      id: 2,
      expediente: '00002-2026-JUS/TTAIP',
      solicitudExpediente: 'SAIP-2026-00003',
      entidadNombre: 'Ministerio de Salud',
      estado: 'EN_CALIFICACION_1',
      fechaApelacion: '2026-03-12',
    } as any,
  ];

  const mockUsuarios = [
    { id: 10, nombre: 'Juan Perez', email: 'juan@example.com', tipoUsuario: 'CIUDADANO', activo: true, fechaRegistro: '2026-01-01' },
    { id: 20, nombre: 'Dra. Ana Gomez', email: 'ana@minjus.gob.pe', tipoUsuario: 'FUNCIONARIO', activo: true, entidadId: 1, fechaRegistro: '2026-01-10' },
    { id: 30, nombre: 'Vocal Tribunal', email: 'vocal@ttaip.gob.pe', tipoUsuario: 'TTAIP', activo: true, fechaRegistro: '2026-01-15' },
    { id: 40, nombre: 'Super Admin', email: 'admin@gob.pe', tipoUsuario: 'ADMINISTRADOR', activo: true, fechaRegistro: '2026-01-20' },
  ];

  beforeEach(async () => {
    entidadServiceMock = {
      findAll: vi.fn().mockReturnValue(of(mockEntidades)),
      crear: vi.fn().mockImplementation((ent) => of({ id: 99, ...ent, activa: true })),
      actualizar: vi.fn().mockImplementation((id, ent) => of({ id, ...ent, activa: true })),
      cambiarEstado: vi.fn().mockImplementation((id, estado) => of({ id, estado, activa: estado === 'Activa' })),
      eliminar: vi.fn().mockReturnValue(of(void 0)),
    };

    solicitudServiceMock = {
      findAll: vi.fn().mockReturnValue(of(mockSolicitudes)),
    };

    apelacionServiceMock = {
      findAll: vi.fn().mockReturnValue(of(mockApelaciones)),
    };

    usuarioServiceMock = {
      findAll: vi.fn().mockReturnValue(of(mockUsuarios)),
      crear: vi.fn().mockImplementation((u) => of({ id: 88, ...u, activo: true, fechaRegistro: '2026-03-01' })),
      actualizar: vi.fn().mockImplementation((id, u) => of({ id, ...u, fechaRegistro: '2026-03-01' })),
      cambiarEstado: vi.fn().mockReturnValue(of(void 0)),
      eliminar: vi.fn().mockReturnValue(of(void 0)),
    };

    estadisticasServiceMock = {
      getActividadReciente: vi.fn().mockReturnValue(of([])),
      getApelacionesEstadisticas: vi.fn().mockReturnValue(of({ resueltosFundado: 1, resueltosInfundado: 0, resueltosFundadoEnParte: 0, resueltosInfundadoEnParte: 0, resueltosImprocedente: 0, resueltosEsteseALoResuelto: 0, resueltosNulidadActo: 0, tenerPorNoPresentado: 0, conclusionSustraccion: 0, conclusionDesistimiento: 0 } as any)),
      getTtaipEstadisticas: vi.fn().mockReturnValue(of({ pendientesAdmision: 0, pendientesElevacion: 0, enProceso: 1, enSubsanacion: 0, resueltas: 1 } as any)),
      getGeneral: vi.fn().mockReturnValue(of({ totalSolicitudes: 3, solicitudesPendientes: 1, solicitudesRespondidas: 1, solicitudesVencidas: 1, totalApelaciones: 2, apelacionesResueltas: 1, totalEntidades: 2, totalUsuarios: 4, tiempoPromedioRespuestaDias: 4.5 } as any)),
      getRankingEntidades: vi.fn().mockReturnValue(of([
        { entidadId: 1, entidadNombre: 'Ministerio de Justicia', acronimo: 'MINJUS', totalSolicitudes: 2, respondidas: 1, pendientes: 1 },
        { entidadId: 2, entidadNombre: 'Ministerio de Salud', acronimo: 'MINSA', totalSolicitudes: 1, respondidas: 0, pendientes: 0 },
      ])),
      getDistribucionEstados: vi.fn().mockReturnValue(of({} as any)),
    };

    reportesServiceMock = {
      getReporteSolicitudes: vi.fn().mockReturnValue(of({ datos: [] } as any)),
      getReporteApelaciones: vi.fn().mockReturnValue(of({ datos: [] } as any)),
      getReporteEntidades: vi.fn().mockReturnValue(of({ datos: [] } as any)),
      getReporteFuncionarios: vi.fn().mockReturnValue(of({ datos: [] } as any)),
      getReporteCiudadanos: vi.fn().mockReturnValue(of({ datos: [] } as any)),
      getResumenEjecutivo: vi.fn().mockReturnValue(of({} as any)),
    };

    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: EntidadService, useValue: entidadServiceMock },
        { provide: SolicitudService, useValue: solicitudServiceMock },
        { provide: ApelacionService, useValue: apelacionServiceMock },
        { provide: UsuarioService, useValue: usuarioServiceMock },
        { provide: EstadisticasService, useValue: estadisticasServiceMock },
        { provide: ReportesService, useValue: reportesServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    configService = TestBed.inject(SystemConfigService);
    TestBed.inject(HttpTestingController).expectOne('http://localhost:8080/api/configuracion').flush(DEFAULT_CONFIG);
    tourService = TestBed.inject(GuidedTourService);

    // Mock DOM download trigger to prevent browser popup during test
    vi.spyOn(component, 'downloadFile').mockImplementation(() => {});
    // Mock pdfPro and pdfInforme if necessary or let them run
  });

  it('should create and load data on initialization', () => {
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(component.solicitudes().length).toBe(3);
    expect(component.apelaciones().length).toBe(2);
    expect(component.entidadesRaw().length).toBe(2);
    expect(component.usuariosRaw().length).toBe(4);
    expect(component.loading()).toBe(false);
  });

  it('V6: cada paso revela una sección real sin borrar filtros, guardar ni exportar', () => {
    fixture.detectChanges(); component.searchTerm.set('Filtro conservado'); component.entPage.set(2); component.userPage.set(3);
    for (const step of component.tourSteps) {
      step.onEnter?.(); fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll(step.selector), step.selector).toHaveLength(1);
    }
    expect(component.searchTerm()).toBe('Filtro conservado'); expect(component.entPage()).toBe(2); expect(component.userPage()).toBe(3);
    expect(entidadServiceMock.crear).not.toHaveBeenCalled(); expect(entidadServiceMock.actualizar).not.toHaveBeenCalled();
    expect(usuarioServiceMock.crear).not.toHaveBeenCalled(); expect(usuarioServiceMock.actualizar).not.toHaveBeenCalled();
    expect(reportesServiceMock.getReporteSolicitudes).not.toHaveBeenCalled();
    TestBed.inject(HttpTestingController).expectNone(req => req.method !== 'GET');
    const end = vi.spyOn(tourService, 'endTourFor'); fixture.destroy(); expect(end).toHaveBeenCalledWith('saip_tour_admin');
  });

  it('does not present a failed users query as an empty registry and can retry', () => {
    (usuarioServiceMock.findAll as any).mockReturnValue(throwError(() => ({ status: 403 })));
    fixture.detectChanges();
    component.cambiarTab('users');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No tiene permiso');
    expect(fixture.nativeElement.textContent).not.toContain('No se encontraron usuarios');
    (usuarioServiceMock.findAll as any).mockReturnValue(of(mockUsuarios));
    component.cargarDatos();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Juan Perez');
  });

  it('keeps an entity form and its values after a failed write', () => {
    (entidadServiceMock.crear as any).mockReturnValue(throwError(() => ({ status: 500 })));
    component.abrirModalEntidad('create');
    component.entFormNombre.set('Entidad sintética');
    component.entFormAcronimo.set('TEST');
    component.guardarEntidad();
    expect(component.entModal()?.mode).toBe('create');
    expect(component.entFormNombre()).toBe('Entidad sintética');
    expect(component.mensaje()).toBe('');
  });

  it('does not export cached records when a report query fails', () => {
    fixture.detectChanges();
    (reportesServiceMock.getReporteSolicitudes as any).mockReturnValue(throwError(() => ({ status: 500 })));
    component.exportarReporte('solicitudes', 'csv');
    expect(component.downloadFile).not.toHaveBeenCalled();
    expect(component.mensaje()).toBe('');
    expect(component.error()).toContain('No se pudo');
  });

  it('should compute real platform metrics correctly without hardcoded coefficients', () => {
    fixture.detectChanges();

    expect(component.totalSolicitudes()).toBe(3);
    expect(component.enProceso()).toBe(1);
    expect(component.respondidas()).toBe(1);
    expect(component.vencidas()).toBe(1);
    expect(component.totalApelaciones()).toBe(2);
    expect(component.apelacionesResueltas()).toBe(1);
    expect(component.totalEntidades()).toBe(2);
    expect(component.totalUsuarios()).toBe(4);
  });

  it('should aggregate entity statistics reactively from real requests', () => {
    fixture.detectChanges();

    const entities = component.entidades();
    const minjus = entities.find((e) => e.acronimo === 'MINJUS');
    const minsa = entities.find((e) => e.acronimo === 'MINSA');

    expect(minjus).toBeDefined();
    expect(minjus!.solicitudesAsignadas).toBe(2);
    expect(minjus!.respondidas).toBe(1);
    expect(minjus!.pendientes).toBe(1);
    expect(minjus!.vencidas).toBe(0);
    expect(minjus!.tasaCumplimiento).toBe(50); // 1 respondida out of 2 = 50%

    expect(minsa).toBeDefined();
    expect(minsa!.solicitudesAsignadas).toBe(1);
    expect(minsa!.vencidas).toBe(1);
    expect(minsa!.tasaCumplimiento).toBe(0);
  });

  it('uses the backend RESPONDIDA definition instead of counting every conclusion as a response', () => {
    fixture.detectChanges();
    component.solicitudes.set([...mockSolicitudes, { ...mockSolicitudes[0], id: 90, estado: 'CONCLUIDA', respuesta: null }]);
    const entity = component.entidades().find(e => e.id === '1')!;
    expect(entity.solicitudesAsignadas).toBe(3);
    expect(entity.respondidas).toBe(1);
    expect(entity.tasaCumplimiento).toBe(33);
  });

  it('should support switching tabs across all 5 navigation areas', () => {
    fixture.detectChanges();

    expect(component.activeTab()).toBe('overview');
    component.cambiarTab('entities');
    expect(component.activeTab()).toBe('entities');
    component.cambiarTab('users');
    expect(component.activeTab()).toBe('users');
    component.cambiarTab('reports');
    expect(component.activeTab()).toBe('reports');
    component.cambiarTab('settings');
    expect(component.activeTab()).toBe('settings');
    component.cambiarTab('overview');
    expect(component.activeTab()).toBe('overview');
  });

  it('should filter entities and compute pagination ranges', () => {
    fixture.detectChanges();

    expect(component.filteredEntities().length).toBe(2);
    component.searchTerm.set('Salud');
    expect(component.filteredEntities().length).toBe(1);
    expect(component.filteredEntities()[0].acronimo).toBe('MINSA');

    component.searchTerm.set('');
    expect(component.filteredEntities().length).toBe(2);
    expect(component.totalPagesEntidades()).toBe(1);
    expect(component.rangeFromEntidades()).toBe(1);
    expect(component.rangeToEntidades()).toBe(2);
  });

  it('should filter users by query and user type', () => {
    fixture.detectChanges();

    expect(component.filteredUsers().length).toBe(4);

    component.filterUserType.set('Funcionario');
    expect(component.filteredUsers().length).toBe(1);
    expect(component.filteredUsers()[0].tipo).toBe('Funcionario');

    component.filterUserType.set('todos');
    component.searchTerm.set('vocal@ttaip');
    expect(component.filteredUsers().length).toBe(1);
    expect(component.filteredUsers()[0].nombre).toBe('Vocal Tribunal');
  });

  it('should calculate user initials reliably for badges', () => {
    expect(component.userInitials('Juan Perez')).toBe('JP');
    expect(component.userInitials('Carlos')).toBe('CA');
    expect(component.userInitials('')).toBe('US');
    expect(component.userInitials('Maria Elena Cruz Gomez')).toBe('ME');
  });

  it('should open and handle entity create modal', () => {
    fixture.detectChanges();

    component.abrirModalEntidad('create');
    expect(component.entModal()).toEqual({ mode: 'create', data: null });

    component.entFormNombre.set('Contraloria General');
    component.entFormAcronimo.set('CGR');
    component.entFormEstado.set('Activa');

    component.guardarEntidad();

    expect(entidadServiceMock.crear).toHaveBeenCalledWith({
      nombre: 'Contraloria General',
      acronimo: 'CGR',
      estado: 'Activa',
    });
    expect(component.entModal()).toBeNull();
    expect(component.entidades().some((e) => e.acronimo === 'CGR')).toBe(true);
  });

  it('does not create through the edit handler without an explicit initial password', () => {
    component.abrirModalUsuario('create');
    component.userFormNombre.set('Nuevo Funcionario');
    component.userFormEmail.set('funcionario@example.invalid');
    component.guardarUsuario();
    expect((usuarioServiceMock.crear as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    expect(component.userModal()?.mode).toBe('create');
  });

  it('should confirm and handle entity deletion', () => {
    fixture.detectChanges();

    const entityToDelete = component.entidades()[0];
    component.eliminarEntidad(entityToDelete);

    expect(component.confirm()).not.toBeNull();
    expect(component.confirm()!.titulo).toContain('Dar de baja');

    // Execute ok callback
    component.confirm()!.onOk();

    expect(entidadServiceMock.cambiarEstado).toHaveBeenCalledWith(Number(entityToDelete.id), 'Inactiva');
    expect(component.confirm()).toBeNull();
    expect(component.entidades().find((e) => e.id === entityToDelete.id)?.estado).toBe('Inactiva');
  });

  it('should export standard and custom reports without throwing errors', () => {
    fixture.detectChanges();

    expect(() => component.exportEntidadesCSV()).not.toThrow();
    expect(() => component.exportUsuariosCSV()).not.toThrow();
    expect(() => component.exportarReporte('solicitudes', 'csv')).not.toThrow();
    expect(() => component.exportarReporte('entidades', 'csv')).not.toThrow();
    expect(() => component.exportarReporte('consolidado', 'csv')).not.toThrow();

    // Custom report builder
    component.crDataset.set('solicitudes');
    component.crFormato.set('csv');
    expect(() => component.generateCustom()).not.toThrow();
  });

  it('should integrate with system config service for save and cancel actions', () => {
    fixture.detectChanges();

    const saveSpy = vi.spyOn(configService, 'save').mockReturnValue(of(true));
    const cancelSpy = vi.spyOn(configService, 'cancel');

    component.guardarConfiguracion();
    expect(saveSpy).toHaveBeenCalled();

    component.cancelarConfiguracion();
    expect(cancelSpy).toHaveBeenCalled();
  });

  it('preserves the backend ranking order and limits its displayed results to five', () => {
    fixture.detectChanges();

    const ranking = component.rankingEntidades();
    expect(ranking.length).toBeLessThanOrEqual(5);
    expect(ranking.length).toBe(2);
    expect(ranking[0].acronimo).toBe('MINJUS');
    expect(ranking[0].tasaCumplimiento).toBe(50);
    expect(ranking[1].acronimo).toBe('MINSA');
    expect(ranking[1].tasaCumplimiento).toBe(0);
  });

  it('should compute entidadesConVencidas filtering only entities with vencidas > 0 sorted descending', () => {
    fixture.detectChanges();

    const vencidasList = component.entidadesConVencidas();
    expect(vencidasList.length).toBe(1);
    expect(vencidasList[0].acronimo).toBe('MINSA');
    expect(vencidasList[0].vencidas).toBe(1);
  });

  it('should validate date ranges and empty results when generating custom reports', () => {
    fixture.detectChanges();

    component.crDataset.set('solicitudes');
    component.crFormato.set('csv');

    // Inverted date range
    component.crDesde.set('2026-03-10');
    component.crHasta.set('2026-03-01');
    component.generateCustom();
    expect(component.error()).toBe('La fecha inicial no puede ser posterior a la fecha final');

    // Reset dates to valid range with no matching rows
    component.crDesde.set('2020-01-01');
    component.crHasta.set('2020-01-02');
    component.generateCustom();
    expect(component.error()).toBe('No hay registros coincidentes con los filtros seleccionados');
  });

  it('should update and deactivate entities via EntidadService', () => {
    fixture.detectChanges();

    // Create an entity
    const newEnt = { id: 77, nombre: 'Municipalidad de Lima', acronimo: 'MML', activa: true, estado: 'Activa' };
    (entidadServiceMock.crear as any).mockReturnValue(of(newEnt));

    component.abrirModalEntidad('create');
    component.entFormNombre.set('Municipalidad de Lima');
    component.entFormAcronimo.set('MML');
    component.entFormEstado.set('Activa');
    component.guardarEntidad();

    const created = component.entidades().find((e) => e.acronimo === 'MML');
    expect(created).toBeDefined();

    // Edit the created entity
    const updatedEnt = { ...newEnt, nombre: 'Municipalidad Metropolitana de Lima', acronimo: 'MML-GOB' };
    (entidadServiceMock.actualizar as any).mockReturnValue(of(updatedEnt));

    component.abrirModalEntidad('edit', created);
    component.entFormNombre.set('Municipalidad Metropolitana de Lima');
    component.entFormAcronimo.set('MML-GOB');
    component.guardarEntidad();

    const updated = component.entidades().find((e) => e.id === '77');
    expect(updated).toBeDefined();
    expect(updated!.nombre).toBe('Municipalidad Metropolitana de Lima');
    expect(updated!.acronimo).toBe('MML-GOB');

    // Deactivate the entity
    (entidadServiceMock.cambiarEstado as any).mockReturnValue(of({ ...updatedEnt, estado: 'Inactiva', activa: false }));
    component.eliminarEntidad(updated!);
    expect(component.confirm()).not.toBeNull();
    component.confirm()!.onOk();

    expect(entidadServiceMock.cambiarEstado).toHaveBeenCalledWith(77, 'Inactiva');
    expect(component.entidades().find((e) => e.id === '77')?.estado).toBe('Inactiva');
  });

  it('should update and delete users via UsuarioService', () => {
    fixture.detectChanges();

    // Create a user
    const newUserAdmin = {
      id: 88,
      nombre: 'Carlos Tester',
      email: 'carlos.tester@test.gob.pe',
      tipoUsuario: 'FUNCIONARIO',
      activo: true,
      fechaRegistro: '2026-03-01',
    };
    (usuarioServiceMock.crear as any).mockReturnValue(of(newUserAdmin));

    component.abrirModalUsuario('create');
    fixture.detectChanges();
    const createForm = fixture.debugElement.query(By.directive(AdminUserCreateFormComponent)).componentInstance as AdminUserCreateFormComponent;
    createForm.form.patchValue({ nombre: 'Carlos Tester', email: 'carlos.tester@test.gob.pe', tipoUsuario: 'FUNCIONARIO', password: 'Synthetic-only-test-88', confirmation: 'Synthetic-only-test-88' });
    createForm.submit();

    const createdUser = component.usuarios().find((u) => u.email === 'carlos.tester@test.gob.pe');
    expect(createdUser).toBeDefined();

    // Edit the created user
    const updatedUserAdmin = {
      ...newUserAdmin,
      nombre: 'Carlos Updated',
      activo: false,
    };
    (usuarioServiceMock.actualizar as any).mockReturnValue(of(updatedUserAdmin));

    component.abrirModalUsuario('edit', createdUser);
    component.userFormNombre.set('Carlos Updated');
    component.userFormEstado.set('Inactivo');
    component.guardarUsuario();

    const updatedUser = component.usuarios().find((u) => u.id === '88');
    expect(updatedUser).toBeDefined();
    expect(updatedUser!.nombre).toBe('Carlos Updated');
    expect(updatedUser!.estado).toBe('Inactivo');

    // Delete the created user
    component.eliminarUsuario(updatedUser!);
    expect(component.confirm()).not.toBeNull();
    component.confirm()!.onOk();

    expect(usuarioServiceMock.eliminar).toHaveBeenCalledWith(88);
    expect(component.usuarios().some((u) => u.id === '88')).toBe(false);
  });

  it('should start guided tour through tourService', () => {
    fixture.detectChanges();

    const startSpy = vi.spyOn(tourService, 'startTour');
    component.startTour();
    expect(startSpy).toHaveBeenCalledWith('saip_tour_admin', component.tourSteps);
  });

  it('should compute KPIs prioritizing backend estadisticasGenerales and distribucionEstados when available', () => {
    fixture.detectChanges();

    component.estadisticasGenerales.set({
      totalSolicitudes: 50,
      solicitudesPendientes: 10,
      solicitudesRespondidas: 35,
      solicitudesDenegadas: 2,
      solicitudesVencidas: 5,
      totalApelaciones: 12,
      apelacionesPendientes: 4,
      apelacionesResueltas: 8,
      totalEntidades: 15,
      totalCiudadanos: 80,
      totalFuncionarios: 20,
      totalUsuarios: 105,
      tiempoPromedioRespuestaDias: 4.5,
    });
    component.distribucionEstados.set({
      RECEPCIONADA: 3,
      EN_REVISION: 4,
      PENDIENTE_INFORMACION: 3,
      RESPONDIDA: 30,
      CONCLUIDA: 5,
      VENCIDA: 5,
    });

    expect(component.totalSolicitudes()).toBe(50);
    expect(component.enProceso()).toBe(10);
    expect(component.respondidas()).toBe(35);
    expect(component.vencidas()).toBe(5);
    expect(component.totalApelaciones()).toBe(12);
    expect(component.totalEntidades()).toBe(15);
    expect(component.totalUsuarios()).toBe(105);
    expect(component.promedioDias()).toBe(4.5);
  });

  it('should delegate report export requests to ReportesService', () => {
    fixture.detectChanges();

    const pdfSpy = vi.spyOn(component, 'pdfPro').mockImplementation(() => {});

    component.exportarReporte('solicitudes', 'pdf');
    expect(reportesServiceMock.getReporteSolicitudes).toHaveBeenCalled();

    component.exportarReporte('entidades', 'xlsx');
    expect(reportesServiceMock.getReporteEntidades).toHaveBeenCalled();

    component.exportarReporte('apelaciones', 'csv');
    expect(reportesServiceMock.getReporteApelaciones).toHaveBeenCalled();

    component.exportarReporte('consolidado', 'pdf');
    expect(reportesServiceMock.getResumenEjecutivo).toHaveBeenCalled();

    component.exportarReporte('usuarios', 'csv');
    expect(usuarioServiceMock.findAll).toHaveBeenCalledTimes(2);
  });

  it('should prioritize rankingEntidadesApi when provided from backend', () => {
    fixture.detectChanges();

    component.rankingEntidadesApi.set([
      { entidadId: 2, entidadNombre: 'Ministerio de Salud', acronimo: 'MINSA', totalSolicitudes: 20, respondidas: 18, pendientes: 2 },
      { entidadId: 1, entidadNombre: 'Ministerio de Justicia', acronimo: 'MINJUS', totalSolicitudes: 10, respondidas: 7, pendientes: 3 },
    ]);

    const ranking = component.rankingEntidades();
    expect(ranking.length).toBe(2);
    expect(ranking[0].acronimo).toBe('MINSA');
    expect(ranking[0].tasaCumplimiento).toBe(90); // 18 / 20 = 90%
    expect(ranking[1].acronimo).toBe('MINJUS');
    expect(ranking[1].tasaCumplimiento).toBe(70); // 7 / 10 = 70%
  });

  it.each([0, 400, 401, 403, 404, 500])('does not show a failed registry as empty for status %s', status => {
    (usuarioServiceMock.findAll as any).mockReturnValue(throwError(() => ({ status })));
    fixture.detectChanges(); component.cambiarTab('users'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Sin usuarios');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
    expect(component.usuariosRaw()).toEqual([]);
  });

  it('shows a confirmed empty registry and keeps an empty backend ranking empty', () => {
    (usuarioServiceMock.findAll as any).mockReturnValue(of([]));
    fixture.detectChanges(); component.cambiarTab('users'); fixture.detectChanges();
    expect(component.ready('usuarios')).toBe(true);
    expect(fixture.nativeElement.querySelector('table')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    component.rankingEntidadesApi.set([]);
    expect(component.rankingEntidades()).toEqual([]);
  });

  it('waits for all queries and cancels obsolete reads on reload', () => {
    const first = new Subject<any[]>(), second = new Subject<any[]>();
    (usuarioServiceMock.findAll as any).mockReturnValueOnce(first).mockReturnValueOnce(second);
    fixture.detectChanges();
    expect(component.loading()).toBe(true);
    expect(component.ready('usuarios')).toBe(false);
    component.cargarDatos();
    first.next(mockUsuarios); first.complete();
    expect(component.usuariosRaw()).toEqual([]);
    second.next([mockUsuarios[0]]); second.complete();
    expect(component.loading()).toBe(false);
    expect(component.usuariosRaw()).toEqual([mockUsuarios[0]]);
  });

  it('counts citizens by inherited account ID, without name matching or global tribunal attribution', () => {
    fixture.detectChanges();
    component.solicitudes.set([...mockSolicitudes, { ...mockSolicitudes[0], id: 91, ciudadanoId: 999, ciudadanoNombre: mockUsuarios[0].nombre }]);
    expect(component.usuarios().find(u => u.id === '10')?.solicitudes).toBe(1);
    expect(component.usuarios().find(u => u.id === '30')?.apelacionesResueltas).toBeNull();
    component.cambiarTab('users'); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No disponible');
  });

  it('does not populate an empty report from another loaded dataset', () => {
    fixture.detectChanges();
    component.exportarReporte('solicitudes', 'csv');
    expect(component.downloadFile).toHaveBeenCalledTimes(1);
    expect((component.downloadFile as any).mock.calls[0][0]).not.toContain('SAIP-2026-00001');
  });

  it('labels partial server statistics as unavailable instead of showing substituted metrics', () => {
    (estadisticasServiceMock.getGeneral as any).mockReturnValue(of({ totalSolicitudes: 8 }));
    fixture.detectChanges();
    expect(component.resourceStates()['general']).toBe('unavailable');
    expect(fixture.nativeElement.querySelector('[data-tour="a-kpis"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Indicadores no disponibles');
  });

  it('does not export cached users when the fresh registry query fails', () => {
    fixture.detectChanges();
    (usuarioServiceMock.findAll as any).mockReturnValue(throwError(() => ({ status: 500 })));
    component.exportarReporte('usuarios', 'csv');
    expect(component.downloadFile).not.toHaveBeenCalled();
    expect(component.mensaje()).toBe('');
  });

  it('exports all account roles from a fresh authorized registry response', () => {
    fixture.detectChanges();
    component.exportarReporte('usuarios', 'csv');
    const csv = (component.downloadFile as any).mock.calls[0][0];
    for (const user of mockUsuarios) expect(csv).toContain(user.email);
    expect(csv).toContain('ADMINISTRADOR');
    expect(csv).toContain('TTAIP');
  });

  it('preserves pending edits, prevents duplicate submission and waits for the persisted response', async () => {
    const request = new Subject<any>();
    (usuarioServiceMock.actualizar as any).mockReturnValue(request);
    fixture.detectChanges();
    component.abrirModalUsuario('edit', component.usuarios()[0]);
    component.userFormNombre.set('Nombre actualizado');
    component.guardarUsuario(); component.guardarUsuario();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('input[name="uNombre"]').disabled).toBe(true);
    expect(usuarioServiceMock.actualizar).toHaveBeenCalledTimes(1);
    expect(component.userModal()?.mode).toBe('edit');
    expect(component.mensaje()).toBe('');
    request.next({ ...mockUsuarios[0], nombre: 'Nombre actualizado' }); request.complete();
    expect(component.userModal()).toBeNull();
    expect(component.usuariosRaw()[0].nombre).toBe('Nombre actualizado');
  });

  it('does not report success for an update response belonging to another user', () => {
    (usuarioServiceMock.actualizar as any).mockReturnValue(of({ ...mockUsuarios[0], id: 999 }));
    fixture.detectChanges();
    component.abrirModalUsuario('edit', component.usuarios()[0]);
    component.guardarUsuario();
    expect(component.userModal()).not.toBeNull();
    expect(component.usuariosRaw()[0].id).toBe(10);
    expect(component.mensaje()).toBe('');
  });

  it('delegates creation to the unchanged secure form and clears secrets on closing the dialog', () => {
    fixture.detectChanges(); component.abrirModalUsuario('create'); fixture.detectChanges();
    const child = fixture.debugElement.query(By.directive(AdminUserCreateFormComponent)).componentInstance as AdminUserCreateFormComponent;
    expect(child.form.controls.password.value).toBe('');
    child.form.patchValue({ password: 'Synthetic-only-test', confirmation: 'Synthetic-only-test' });
    component.cerrarModalUsuario(); fixture.detectChanges();
    expect(child.form.controls.password.value).toBe('');
    expect(child.form.controls.confirmation.value).toBe('');
    expect(usuarioServiceMock.crear).not.toHaveBeenCalled();
  });

  it('cancels late responses when the dashboard is destroyed', () => {
    const request = new Subject<any[]>();
    (usuarioServiceMock.findAll as any).mockReturnValue(request);
    fixture.detectChanges(); fixture.destroy();
    request.next(mockUsuarios); request.complete();
    expect(component.usuariosRaw()).toEqual([]);
  });

  it('names the dialog, contains keyboard focus, closes with Escape and restores focus', async () => {
    fixture.detectChanges(); component.cambiarTab('users'); fixture.detectChanges();
    const opener = Array.from(fixture.nativeElement.querySelectorAll('button')).find((b: any) => b.textContent.includes('Nuevo usuario')) as HTMLButtonElement;
    opener.focus(); opener.click(); fixture.detectChanges(); await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(fixture.nativeElement.querySelector('#' + dialog.getAttribute('aria-labelledby')).textContent).toContain('Nuevo usuario');
    expect(dialog.contains(document.activeElement)).toBe(true);
    const buttons = dialog.querySelectorAll('button');
    buttons[buttons.length - 1].focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(buttons[0]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); fixture.detectChanges();
    expect(component.userModal()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
