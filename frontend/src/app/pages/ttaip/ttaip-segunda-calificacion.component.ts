import { ChangeDetectionStrategy, Component, ElementRef, OnInit, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { ApelacionService } from '../../services/apelacion.service';
import { TtaipService } from '../../services/ttaip.service';
import { AuthService } from '../../services/auth.service';
import { DocumentoService } from '../../services/documento.service';
import { Apelacion } from '../../models/apelacion.model';
import { DocumentoMetadata, DocumentoRelation } from '../../models/documento.model';
import { ReferenceConfirmModalComponent, ReferenceConfirmSummary, ReferenceConfirmWarning } from '../../shared/reference-confirm-modal.component';
import { ReferenceSuccessMeta, ReferenceSuccessModalComponent, ReferenceSuccessNextStep, ReferenceSuccessTone } from '../../shared/reference-success-modal.component';
import { DocumentPreviewModalComponent, DocumentPreviewTarget } from '../../shared/document-preview-modal.component';
import { falloConsulta } from '../../utils/consulta-remota.util';
import { OfficialDocsSectionComponent } from './shared/official-docs-section.component';
import { OfficialPreviewComponent } from './shared/official-preview.component';
import { DocContext, CedulaVariant, cedulaVariantForStage } from './shared/official-docs.util';
import { positiveId, apelacionCompatible, documentosRelacionados } from './ttaip-calificar.model';
import { SegundaDecision, SegundaOperacion, segundaCompatible, segundaOpciones, requerimientoConsultado, segundaConsultada, contextoSegunda, relojConsultado } from './ttaip-segunda-calificacion.model';
import { consultarRecepcionInstitucional, sinConsultaRecepcion, motivoRecepcion } from './recepcion-institucional.model';
import { RecepcionInstitucionalComponent } from './recepcion-institucional.component';
import { LucideArrowLeft, LucideCheckCircle2, LucideFileText, LucideXCircle, LucideInfo, LucideEye, LucideEyeOff,
  LucideDownload, LucideSearch, LucideChevronDown } from '@lucide/angular';

interface DocumentGroup { label: string; relation: DocumentoRelation; documents: DocumentoMetadata[]; }
@Component({
  selector: 'app-ttaip-segunda-calificacion',
  imports: [CommonModule, FormsModule, RouterLink, ReferenceConfirmModalComponent, ReferenceSuccessModalComponent,
    OfficialDocsSectionComponent, OfficialPreviewComponent, DocumentPreviewModalComponent, RecepcionInstitucionalComponent, LucideArrowLeft,
    LucideCheckCircle2, LucideFileText, LucideXCircle, LucideInfo, LucideEye, LucideEyeOff, LucideDownload, LucideSearch, LucideChevronDown],
  templateUrl: './ttaip-segunda-calificacion.component.html', styleUrl: './ttaip-segunda-calificacion.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TtaipSegundaCalificacionComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly apelacionService = inject(ApelacionService);
  private readonly ttaipService = inject(TtaipService);
  private readonly documentoService = inject(DocumentoService);
  private readonly authService = inject(AuthService);
  private routeSub = new Subscription();
  private reads = new Subscription();
  private writes = new Subscription();
  private operation: SegundaOperacion | null = null;
  private docReads = new Subscription();
  private downloads = new Subscription();
  private generation = 0;
  private destroyed = false;
  private initialized = false;
  private requested = '';
  private session = '';
  private revision = -1;
  private previousId: number | null = null;
  private previousRequirement: number | null = null;
  private docsLoaded = false;
  readonly apelacion = signal<Apelacion | null>(null);
  readonly loadingApelacion = signal(true);
  readonly loadError = signal('');
  readonly error = signal('');
  readonly confirmModalAbierto = signal(false);
  /** A consulted persisted act, never a confirmation of a new submission. */
  readonly successModalAbierto = signal(false);
  readonly activeTab = signal<'subsanacion' | 'adjuntos'>('subsanacion');
  readonly selectedDecision = signal<SegundaDecision | null>(null);
  readonly showPreview = signal(false);
  readonly previewTarget = signal<DocumentPreviewTarget | null>(null);
  readonly documentGroups = signal<DocumentGroup[]>([]);
  readonly documentSearch = signal('');
  readonly documentFilter = signal('');
  readonly closedGroups = signal<Record<string, boolean>>({});
  readonly loadingDocuments = signal(false);
  readonly documentError = signal('');
  readonly downloadError = signal('');
  readonly downloadingId = signal<number | null>(null);
  readonly recepcion = signal(sinConsultaRecepcion());
  readonly loading = signal(false);
  readonly resultadoIncierto = signal(false);
  readonly resultadoConfirmado = signal(false);
  readonly registroObservado = signal<number | null>(null);
  readonly rechazoBloqueante = signal(false);
  readonly tabs = [{ id: 'subsanacion' as const, label: 'Subsanación' }, { id: 'adjuntos' as const, label: 'Documentos del expediente' }];
  readonly options = segundaOpciones;
  readonly selectedOption = computed(() => this.options.find(option => option.id === this.selectedDecision()));
  readonly requerimiento = computed(() => requerimientoConsultado(this.apelacion()));
  readonly segundaActuacion = computed(() => segundaConsultada(this.apelacion()));
  readonly contexto = computed(() => contextoSegunda(this.apelacion()));
  readonly relojTexto = computed(() => relojConsultado(this.apelacion()));
  readonly cedulaVariant = computed<CedulaVariant>(() => cedulaVariantForStage('segunda', this.selectedDecision() || undefined));
  readonly docCtx = computed<Partial<DocContext>>(() => ({
    expediente: this.apelacion()?.expediente || '', recurrente: this.apelacion()?.ciudadanoNombre || 'No registrado',
    entidad: this.apelacion()?.entidadNombre || this.apelacion()?.entidadExternaNombre || 'No registrada',
    sumilla: this.apelacion()?.solicitudAsunto || this.apelacion()?.resumenSolicitudOriginal || 'No registrada',
  }));
  readonly documentCount = computed(() => this.documentGroups().reduce((sum, group) => sum + group.documents.length, 0));
  readonly visibleGroups = computed(() => {
    const norm = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');
    const query = norm(this.documentSearch().trim());
    return this.documentGroups().filter(group => !this.documentFilter() || this.documentFilter() === group.label)
      .map(group => ({ ...group, total: group.documents.length, documents: group.documents.filter(doc => !query
        || norm([doc.nombreOriginal, doc.tipoDocumento, doc.contentType, doc.fechaCreacion, group.label].filter(Boolean).join(' ')).includes(query)) }))
      .filter(group => group.documents.length > 0);
  });
  fundamentos = '';
  constructor() {
    effect(() => {
      const revision = this.authService.cambiosSesion();
      if (this.initialized && revision !== this.revision) untracked(() => this.cargarApelacion(this.requested));
    });
  }
  private sessionKey(): string {
    try { const s = this.authService.obtenerSesion(); return JSON.stringify([s?.token, s?.usuarioId, s?.tipoUsuario, s?.miembroId]); }
    catch { return ''; }
  }
  contextoVigente(): boolean { return !this.destroyed && this.session === this.sessionKey(); }
  private current(generation: number): boolean { return generation === this.generation && this.contextoVigente(); }
  ngOnInit(): void { this.initialized = true; this.routeSub = this.route.paramMap.subscribe(params => this.cargarApelacion(params.get('expediente') || '')); }
  ngOnDestroy(): void { this.destroyed = true; this.generation++; this.routeSub.unsubscribe(); this.cancelarLecturas(); }
  private cancelarLecturas(): void {
    this.reads.unsubscribe(); this.writes.unsubscribe(); this.docReads.unsubscribe(); this.downloads.unsubscribe();
    this.reads = new Subscription(); this.writes = new Subscription(); this.docReads = new Subscription(); this.downloads = new Subscription();
  }
  private limpiarBorrador(): void { this.selectedDecision.set(null); this.fundamentos = ''; this.showPreview.set(false); this.confirmModalAbierto.set(false); }
  cargarApelacion(expediente: string): void {
    if (this.destroyed) return;
    const same = expediente === this.requested && this.session === this.sessionKey();
    if (same && this.operation) { if (!this.loading()) this.recuperarResultado(); return; }
    if (same && this.loadingApelacion() && this.generation > 0) return;
    this.cancelarLecturas(); const generation = ++this.generation;
    this.requested = expediente; this.session = this.sessionKey(); this.revision = this.authService.cambiosSesion();
    this.apelacion.set(null); this.recepcion.set(sinConsultaRecepcion()); this.loading.set(false); this.rechazoBloqueante.set(false);
    this.loadingApelacion.set(true); this.loadError.set(''); this.error.set('');
    this.confirmModalAbierto.set(false); this.successModalAbierto.set(false); this.showPreview.set(false); this.previewTarget.set(null);
    this.documentGroups.set([]); this.documentSearch.set(''); this.documentFilter.set(''); this.closedGroups.set({});
    this.documentError.set(''); this.downloadError.set(''); this.loadingDocuments.set(false); this.downloadingId.set(null); this.docsLoaded = false;
    if (!same) { this.operation = null; this.resultadoIncierto.set(false); this.resultadoConfirmado.set(false); this.registroObservado.set(null); this.previousId = null; this.previousRequirement = null; this.limpiarBorrador(); this.activeTab.set('subsanacion'); }
    let account; try { account = this.authService.obtenerSesion(); } catch { account = null; }
    if (!account?.token || !positiveId(account.usuarioId) || !['TTAIP', 'ADMINISTRADOR'].includes(account.tipoUsuario || '')) {
      this.loadingApelacion.set(false); this.loadError.set('La sesión no permite consultar el Tribunal. Utilice el acceso interno.'); return;
    }
    if (!expediente) { this.loadingApelacion.set(false); this.loadError.set('No se recibió un expediente.'); return; }
    this.reads.add(this.apelacionService.findByExpediente(expediente).subscribe({
      next: ap => {
        if (!this.current(generation)) return;
        if (!apelacionCompatible(ap, expediente) || (this.previousId != null && ap.id !== this.previousId)) {
          this.loadError.set('La respuesta está incompleta o no identifica el expediente solicitado.'); this.loadingApelacion.set(false); return;
        }
        const requirement = requerimientoConsultado(ap)?.id ?? null;
        if (this.previousRequirement !== requirement) this.limpiarBorrador();
        this.previousId = ap.id; this.previousRequirement = requirement; this.apelacion.set(ap); this.loadingApelacion.set(false);
        if (requirement != null) this.reads.add(consultarRecepcionInstitucional(this.ttaipService, ap, requirement)
          .subscribe(value => { if (this.current(generation)) this.recepcion.set(value); }));
      },
      error: err => { if (this.current(generation)) { this.loadError.set(falloConsulta(err, 'la apelación').mensaje); this.loadingApelacion.set(false); } }
    }));
  }
  reintentarConsulta(): void { this.cargarApelacion(this.requested); }
  puedePrepararBorrador(): boolean { return this.contextoVigente() && !this.loadingApelacion() && !this.loadError() && this.contexto() === 'borrador' && !this.operation && !this.loading(); }
  motivoNoDisponible(): string {
    if (!this.contextoVigente() || this.loadingApelacion() || this.loadError()) return this.loadError() || 'Consulte el contexto actual.';
    if (this.resultadoIncierto()) return 'Resultado incierto: consulte sin repetir el comando.';
    if (this.rechazoBloqueante()) return 'El servidor rechazó el acceso o la transición. Consulte nuevamente.';
    if (this.contexto() !== 'borrador') return this.motivoContexto();
    return motivoRecepcion(this.apelacion()!, this.requerimiento()!.id!, this.recepcion());
  }
  puedeEmitirSegundaCalificacion(): boolean { return !this.motivoNoDisponible(); }
  canSubmit(): boolean { return this.puedeEmitirSegundaCalificacion() && !this.operation && !this.loading() && !this.validacionBorrador(); }
  seleccionarDecision(decision: SegundaDecision): void {
    if (!this.puedePrepararBorrador() || decision === 'no_presentado') return;
    this.confirmModalAbierto.set(false); this.showPreview.set(false); this.previewTarget.set(null);
    this.downloads.unsubscribe(); this.downloads = new Subscription(); this.downloadingId.set(null);
    this.selectedDecision.set(decision); this.error.set('');
  }
  validacionBorrador(): string {
    if (!this.selectedDecision() || this.selectedDecision() === 'no_presentado') return 'Seleccione una opción de segunda calificación para el borrador.';
    if (!this.fundamentos.trim()) return 'Complete los fundamentos de revisión local.';
    return this.fundamentos.trim().length <= 5000 ? '' : 'Los fundamentos no pueden exceder 5000 caracteres.';
  }
  abrirConfirmacionCalificacion(): void {
    if (!this.canSubmit()) { this.error.set((this.motivoNoDisponible() || this.validacionBorrador()) + ' No se ha enviado ningún comando; consulte el expediente.'); return; }
    this.confirmModalAbierto.set(true);
  }
  enviarCalificacion(): void {
    if (this.destroyed || this.loading() || this.operation) return;
    if (!this.canSubmit()) { this.error.set((this.motivoNoDisponible() || this.validacionBorrador()) + ' No se ha enviado ningún comando; consulte el expediente.'); return; }
    const ap = this.apelacion()!, decision = this.selectedDecision() as 'admitido' | 'improcedente', generation = this.generation;
    const miembroId = this.authService.obtenerSesion()?.miembroId;
    const op: SegundaOperacion = { apelacionId: ap.id, expediente: ap.expediente, expedienteTtaipId: ap.expedienteTtaip!.id!,
      requerimientoId: this.requerimiento()!.id!, decision, fundamentos: this.fundamentos.trim(), ...(positiveId(miembroId) ? { miembroId } : {}) };
    this.operation = op; this.loading.set(true); this.error.set('');
    const payload = { fundamentos: op.fundamentos, ...(op.miembroId != null ? { miembroId: op.miembroId } : {}) };
    const command = decision === 'admitido' ? this.ttaipService.admitirApelacion(ap.id, payload) : this.ttaipService.inadmitirApelacion(ap.id, payload);
    this.writes.add(command.subscribe({ next: updated => {
      if (!this.current(generation) || this.operation !== op) return;
      this.confirmModalAbierto.set(false);
      if (!segundaCompatible(updated, op)) { this.marcarIncierto('La respuesta no identifica una segunda actuación compatible. Consulte sin repetir la escritura.'); return; }
      op.resolucionId = updated.resolucionSegundaCalificacion!.id; this.consultarOperacion(op, generation);
    }, error: err => {
      if (!this.current(generation) || this.operation !== op) return;
      this.loading.set(false); this.confirmModalAbierto.set(false);
      if ([400, 401, 403, 404, 409, 422].includes(err?.status)) {
        this.operation = null; this.rechazoBloqueante.set([401, 403, 404, 409].includes(err.status));
        this.error.set(falloConsulta(err, 'el registro de segunda calificación').mensaje);
      } else this.marcarIncierto('No se pudo confirmar el registro. El servidor puede haberlo aceptado. Consulte sin repetir la escritura.');
    } }));
  }
  private marcarIncierto(message: string): void {
    this.loading.set(false); this.confirmModalAbierto.set(false); this.successModalAbierto.set(false); this.resultadoIncierto.set(true); this.error.set(message);
  }
  recuperarResultado(): void { if (this.operation && !this.loading() && this.contextoVigente()) this.consultarOperacion(this.operation, this.generation); }
  private consultarOperacion(op: SegundaOperacion, generation: number): void {
    this.loading.set(true);
    this.writes.add(this.apelacionService.findByExpediente(op.expediente).subscribe({ next: ap => {
      if (!this.current(generation) || this.operation !== op) return;
      this.loading.set(false);
      if (!apelacionCompatible(ap, op.expediente) || ap.id !== op.apelacionId || requerimientoConsultado(ap)?.id !== op.requerimientoId) {
        this.marcarIncierto('La consulta no corresponde al recurso y requerimiento enviados.'); return;
      }
      if (op.resolucionId != null && this.selectedDecision() === op.decision && segundaCompatible(ap, op)) {
        this.apelacion.set(ap); this.operation = null; this.resultadoIncierto.set(false); this.error.set(''); this.resultadoConfirmado.set(true); this.successModalAbierto.set(true); return;
      }
      this.registroObservado.set(segundaConsultada(ap)?.id ?? null);
      this.marcarIncierto(op.resolucionId == null ? 'Consulta realizada. Sin un ID devuelto por el envío no se atribuye una actuación posterior por coincidencia de texto. Revise el expediente.'
        : 'La actuación recuperada no coincide con el ID y contenido confirmados. No se repite el comando.');
    }, error: () => { if (this.current(generation) && this.operation === op) this.marcarIncierto('No se pudo recuperar la actuación. Los fundamentos se conservan; consulte sin reenviar.'); } }));
  }
  togglePreview(): void { if (this.contextoVigente() && this.selectedDecision() && this.selectedDecision() !== 'no_presentado') this.showPreview.update(value => !value); }
  getObservaciones(): string[] { const value = this.requerimiento()?.observaciones; return typeof value === 'string' ? value.split(/\r?\n/).map(line => line.trim()).filter(Boolean) : []; }
  getOriginalFundamentos(): string { return this.apelacion()?.fundamentos || ''; }
  getDecisionLabel(value: string | null): string { return this.options.find(option => option.id === value)?.label || 'Decisión local no seleccionada'; }
  getEstadoDisplay(value: string | undefined): string { return value?.replaceAll('_', ' ') || 'No informado'; }
  fechaVisible(value: unknown): string | null { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) && Number.isFinite(Date.parse(value)) ? value : null; }
  motivoContexto(): string {
    if (this.contexto() === 'registrada') return 'Hay una segunda actuación registrada. No se habilita otra calificación; consulte su ID y sus notificaciones.';
    if (this.contexto() === 'incompleto') return 'Información incompleta o asociaciones incompatibles de primera calificación, requerimiento o segunda actuación.';
    if (this.contexto() === 'incompatible') return 'Estado incompatible con la preparación de segunda calificación: ' + this.getEstadoDisplay(this.apelacion()?.estado) + '.';
    return 'Revise la recepción del requerimiento antes de registrar la segunda calificación. Los borradores no son documentos emitidos.';
  }
  cambiarTab(tab: 'subsanacion' | 'adjuntos'): void { this.activeTab.set(tab); if (tab === 'adjuntos' && !this.docsLoaded) this.cargarDocumentos(); }
  onTabKey(event: KeyboardEvent, tab: 'subsanacion' | 'adjuntos'): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); const next = event.key === 'Home' ? 'subsanacion' : event.key === 'End' ? 'adjuntos' : tab === 'subsanacion' ? 'adjuntos' : 'subsanacion';
    this.cambiarTab(next); this.host.nativeElement.querySelector<HTMLElement>('#second-tab-' + next)?.focus();
  }
  cargarDocumentos(): void {
    const ap = this.apelacion(); if (!ap || !this.contextoVigente() || this.loadingApelacion() || this.loadingDocuments() || this.loadError()) return;
    const generation = this.generation, groups: Omit<DocumentGroup, 'documents'>[] = [];
    if (positiveId(ap.solicitudId)) groups.push({ label: 'Solicitud de origen referenciada', relation: { solicitudId: ap.solicitudId } });
    groups.push({ label: 'Apelación · sin atribuir recepción', relation: { apelacionId: ap.id } });
    const requirement = this.requerimiento();
    if (requirement) groups.push({ label: 'Primera calificación y requerimiento', relation: { resolucionId: requirement.id! } });
    const second = this.segundaActuacion();
    if (second) groups.push({ label: 'Segunda actuación consultada', relation: { resolucionId: second.id! } });
    const aggregate = ap.expedienteTtaip;
    if (positiveId(aggregate?.id) && aggregate?.numeroExpediente === ap.expediente) groups.push({ label: 'Expediente TTAIP', relation: { expedienteTtaipId: aggregate.id } });
    this.docReads.unsubscribe(); this.docReads = new Subscription(); this.loadingDocuments.set(true);
    this.documentError.set(''); this.documentGroups.set([]); this.previewTarget.set(null);
    this.docReads.add(forkJoin(groups.map(group => this.documentoService.listByRelation(group.relation))).subscribe({
      next: values => {
        if (!this.current(generation)) return;
        const result = groups.map((group, index) => ({ ...group, documents: documentosRelacionados(values[index], group.relation) }));
        const ids = new Set<number>();
        if (result.some(group => group.documents === null || group.documents.some(doc => ids.has(doc.id!) || !ids.add(doc.id!))))
          this.documentError.set('Datos documentales incompletos o asociados a otro recurso. No se muestran archivos sustitutos.');
        else { this.documentGroups.set(result as DocumentGroup[]); this.docsLoaded = true; }
        this.loadingDocuments.set(false);
      },
      error: err => { if (this.current(generation)) { this.loadingDocuments.set(false); this.documentError.set(falloConsulta(err, 'los documentos').mensaje); } }
    }));
  }
  private documentoActual(doc: DocumentoMetadata): boolean { return this.contextoVigente() && this.documentGroups().some(group => group.documents.some(item => item === doc && positiveId(item.id))); }
  verDocumento(doc: DocumentoMetadata): void {
    if (this.documentoActual(doc)) this.previewTarget.set({ id: doc.id, nombre: this.nombreDocumento(doc), tipo: doc.contentType, expediente: this.apelacion()!.expediente });
  }
  descargarDocumento(doc: DocumentoMetadata): void {
    if (!this.documentoActual(doc) || this.downloadingId() != null) { this.downloadError.set('Consulte un archivo identificado del recurso actual.'); return; }
    const generation = this.generation, decision = this.selectedDecision();
    this.downloadingId.set(doc.id!); this.downloadError.set('');
    this.downloads.add(this.documentoService.download(doc.id!, this.nombreDocumento(doc)).subscribe({
      next: ({ blob, filename }) => {
        if (!this.current(generation) || this.selectedDecision() !== decision) return;
        this.downloadingId.set(null); const url = URL.createObjectURL(blob);
        try { const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.rel = 'noopener'; anchor.click(); }
        finally { URL.revokeObjectURL(url); }
      },
      error: err => { if (this.current(generation)) { this.downloadingId.set(null); this.downloadError.set(falloConsulta(err, 'el documento').mensaje); } }
    }));
  }
  nombreDocumento(doc: DocumentoMetadata): string { return doc.nombreOriginal || 'Nombre no informado'; }
  documentGroupId(group: DocumentGroup): string { const [key, id] = Object.entries(group.relation)[0]; return 'second-docs-' + key + '-' + id; }
  groupOpen(label: string): boolean { return !!this.documentSearch().trim() || !!this.documentFilter() || !this.closedGroups()[label]; }
  toggleDocumentGroup(label: string): void { if (!this.documentSearch().trim() && !this.documentFilter()) this.closedGroups.update(groups => ({ ...groups, [label]: !groups[label] })); }
  segundaConfirmSummary(): ReferenceConfirmSummary[] {
    return [{ label: 'Expediente consultado', value: this.apelacion()?.expediente || '—', mono: true },
      { label: 'Requerimiento · ID', value: this.requerimiento()?.id?.toString() || 'No identificado', mono: true },
      { label: 'Decisión que se registrará', value: this.getDecisionLabel(this.selectedDecision()) },
      { label: 'Fundamentos locales', value: String(this.fundamentos.trim().length) + ' caracteres' }];
  }
  segundaWarning(): ReferenceConfirmWarning { return { label: 'Registro de actuación', detail: 'El servidor comprobará las precondiciones. Registrar no acredita notificación eficaz, firma ni emisión documental.' }; }
  verActuacionRegistrada(): void { if (this.contextoVigente() && this.segundaActuacion() && !this.loadError()) this.successModalAbierto.set(true); }
  segundaSuccessTone(): ReferenceSuccessTone { return 'warning'; }
  segundaSuccessTitle(): string { return (this.resultadoConfirmado() ? 'Segunda calificación registrada y recuperada · ' : 'Segunda calificación consultada · ') + (this.segundaActuacion()?.decision || 'No identificada'); }
  segundaSuccessMetadata(): ReferenceSuccessMeta[] {
    const r = this.segundaActuacion();
    return [{ label: 'Actuación · ID', value: r?.id?.toString() || 'No informado', mono: true },
      { label: 'Decisión registrada', value: r?.decision || 'No informada' }, { label: 'Fecha registrada', value: r?.fechaResolucion || 'No informada' },
      { label: 'Estado del expediente', value: this.apelacion()?.estado || 'No informado' }];
  }
  segundaNextSteps(): ReferenceSuccessNextStep[] {
    if (this.segundaActuacion()?.decision === 'IMPROCEDENTE') return [
      { label: 'Improcedencia registrada en segunda calificación. No acredita emisión documental, firma ni notificación eficaz.' },
      { label: 'Consulte las actuaciones y las notificaciones del expediente; no se habilita otra segunda calificación.' }
    ];
    return [{ label: 'La segunda admisión registrada no acredita el avance a resolución. Este exige ambas notificaciones eficaces de esa actuación, al recurrente y a la entidad.' },
      { label: 'Consulte la pestaña Notificaciones del expediente. La fecha base del plazo final continúa pendiente de definición de dominio.' }];
  }
  irPanelTtaip(): void { if (this.contextoVigente()) void this.router.navigate(['/ttaip']); }
  irExpediente(): void { if (this.contextoVigente() && this.apelacion()) void this.router.navigate(['/ttaip/apelacion', this.apelacion()!.expediente]); }
}
