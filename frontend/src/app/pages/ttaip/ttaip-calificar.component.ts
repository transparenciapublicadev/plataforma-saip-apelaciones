import { InformacionComplementariaComponent } from './shared/informacion-complementaria.component';
import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, ElementRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { ApelacionService } from '../../services/apelacion.service';
import { SolicitudService } from '../../services/solicitud.service';
import { TtaipService } from '../../services/ttaip.service';
import { AuthService } from '../../services/auth.service';
import { YaikuCargandoComponent } from '../../shared/yaiku-cargando.component';
import { Apelacion } from '../../models/apelacion.model';
import { Solicitud } from '../../models/solicitud.model';
import { DocumentoMetadata, DocumentoRelation } from '../../models/documento.model';
import { ReferenceConfirmModalComponent, ReferenceConfirmSummary, ReferenceConfirmWarning } from '../../shared/reference-confirm-modal.component';
import { ReferenceSuccessMeta, ReferenceSuccessModalComponent, ReferenceSuccessNextStep, ReferenceSuccessTone } from '../../shared/reference-success-modal.component';
import { DocumentPreviewModalComponent, DocumentPreviewTarget } from '../../shared/document-preview-modal.component';
import { DocumentoService } from '../../services/documento.service';
import { falloConsulta } from '../../utils/consulta-remota.util';
import { OfficialDocsSectionComponent } from './shared/official-docs-section.component';
import { OfficialPreviewComponent } from './shared/official-preview.component';
import { DocContext, CedulaVariant, cedulaVariantForStage } from './shared/official-docs.util';
import { CalificacionDecision, CalificacionOperacion, calificacionOpciones, positiveId, apelacionCompatible, motivoPrimera, actuacionCompatible, documentosRelacionados } from './ttaip-calificar.model';
import { LucideEye, LucideEyeOff, LucideXCircle, LucideCheckCircle2, LucideAlertCircle,
  LucideArrowLeft, LucideFileText, LucideDownload, LucideSend, LucideSearch, LucideChevronDown } from '@lucide/angular';

interface DocumentGroup { label: string; relation: DocumentoRelation; documents: DocumentoMetadata[]; }
@Component({
  selector: 'app-ttaip-calificar',
  imports: [CommonModule, FormsModule, RouterLink, YaikuCargandoComponent, ReferenceConfirmModalComponent, ReferenceSuccessModalComponent,
    InformacionComplementariaComponent, OfficialDocsSectionComponent, OfficialPreviewComponent, DocumentPreviewModalComponent, LucideEye, LucideEyeOff,
    LucideXCircle, LucideCheckCircle2, LucideAlertCircle, LucideArrowLeft, LucideFileText, LucideDownload, LucideSend, LucideSearch, LucideChevronDown],
  templateUrl: './ttaip-calificar.component.html', styleUrl: './ttaip-calificar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TtaipCalificarComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly apelacionService = inject(ApelacionService);
  private readonly solicitudService = inject(SolicitudService);
  private readonly ttaipService = inject(TtaipService);
  private readonly documentoService = inject(DocumentoService);
  private readonly authService = inject(AuthService);
  private routeSub = new Subscription();
  private reads = new Subscription();
  private writes = new Subscription();
  private docReads = new Subscription();
  private downloads = new Subscription();
  private generation = 0;
  private destroyed = false;
  private initialized = false;
  private session = '';
  private revision = -1;
  private requested = '';
  private operation: CalificacionOperacion | null = null;
  private docsLoaded = false;
  readonly apelacion = signal<Apelacion | null>(null);
  readonly expedienteActuacion = computed(() => {
    const ap = this.apelacion(), exp = ap?.expedienteTtaip;
    return positiveId(exp?.id) && exp?.numeroExpediente === ap?.expediente ? exp.id : null;
  });
  readonly solicitudOrigen = signal<Solicitud | null>(null);
  readonly loading = signal(false);
  readonly loadingApelacion = signal(true);
  readonly error = signal('');
  readonly loadError = signal('');
  readonly mensaje = signal('');
  readonly resultadoIncierto = signal(false);
  readonly registroObservado = signal<number | null>(null);
  readonly confirmModalAbierto = signal(false);
  readonly successModalAbierto = signal(false);
  readonly activeTab = signal<'apelacion' | 'adjuntos' | 'subprocesos'>('apelacion');
  readonly selectedDecision = signal<CalificacionDecision | null>(null);
  readonly showPreview = signal(false);
  readonly previewTarget = signal<DocumentPreviewTarget | null>(null);
  readonly documentGroups = signal<DocumentGroup[]>([]);
  readonly documentSearch = signal('');
  readonly documentFilter = signal('');
  readonly closedGroups = signal<Record<string, boolean>>({});
  readonly documentCount = computed(() => this.documentGroups().reduce((sum, group) => sum + group.documents.length, 0));
  readonly visibleGroups = computed(() => {
    const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');
    const search = normalize(this.documentSearch().trim());
    return this.documentGroups().filter(group => !this.documentFilter() || group.label === this.documentFilter()).map(group => ({ ...group,
      total: group.documents.length, documents: group.documents.filter(doc => !search || normalize([
        doc.nombreOriginal, doc.tipoDocumento, doc.contentType, doc.fechaCreacion, group.label].filter(Boolean).join(' ')).includes(search))
    })).filter(group => group.documents.length > 0);
  });
  readonly loadingDocuments = signal(false);
  readonly documentError = signal('');
  readonly downloadError = signal('');
  readonly downloadingId = signal<number | null>(null);
  readonly validationAttempted = signal(false);
  readonly rechazoBloqueante = signal(false);
  fundamentos = '';
  observacionesList = signal<string[]>(['']);
  readonly diasSubsanacion = 2;
  readonly tabs = [{ id: 'apelacion' as const, label: 'Apelación' }, { id: 'adjuntos' as const, label: 'Documentos del expediente' }, { id: 'subprocesos' as const, label: 'Subprocesos' }];
  readonly options = calificacionOpciones;
  readonly selectedOption = computed(() => this.options.find(option => option.id === this.selectedDecision()));
  efectoCalificacion(): string {
    switch (this.selectedDecision()) {
      case 'admisible': return 'La apelación cumple con todos los requisitos formales. Pasará a la etapa de Resolución Final donde se emitirá un fallo sobre el fondo (10 días hábiles).';
      case 'inadmisible': return 'La apelación presenta observaciones a subsanar. Se notificará al ciudadano para que subsane en 2 días hábiles. Si no subsana, se resuelve como TENER POR NO PRESENTADO.';
      case 'improcedente': return 'La apelación no cumple los requisitos legales. El proceso se archiva y no continúa.';
      default: return '';
    }
  }
  readonly cedulaVariant = computed<CedulaVariant>(() => cedulaVariantForStage('primera', this.selectedDecision() || undefined));
  readonly docCtx = computed<Partial<DocContext>>(() => ({
    expediente: this.apelacion()?.expediente || '', recurrente: this.apelacion()?.ciudadanoNombre || 'No registrado',
    entidad: this.apelacion()?.entidadNombre || this.apelacion()?.entidadExternaNombre || 'No registrada',
    sumilla: this.solicitudOrigen()?.asunto || this.apelacion()?.solicitudAsunto || this.apelacion()?.resumenSolicitudOriginal || 'No registrada',
  }));
  constructor() {
    effect(() => {
      const revision = this.authService.cambiosSesion();
      if (this.initialized && revision !== this.revision) untracked(() => this.cargarApelacion(this.requested));
    });
    effect(() => {
      const decision = this.selectedDecision();
      untracked(() => {
        if (this.operation && decision !== this.operation.decision) {
          this.writes.unsubscribe(); this.writes = new Subscription(); this.loading.set(false);
          this.marcarIncierto('La decisión cambió mientras se esperaba el registro. Consulte el resultado del envío anterior antes de otra operación.');
        }
      });
    });
  }
  private sessionKey(): string {
    try { const s = this.authService.obtenerSesion(); return JSON.stringify([s?.token, s?.usuarioId, s?.tipoUsuario, s?.miembroId]); }
    catch { return ''; }
  }
  contextoVigente(): boolean { return !this.destroyed && this.session === this.sessionKey(); }
  private current(generation: number): boolean { return generation === this.generation && this.contextoVigente(); }
  ngOnInit(): void {
    this.initialized = true;
    this.routeSub = this.route.paramMap.subscribe(params => this.cargarApelacion(params.get('expediente') || ''));
  }
  ngOnDestroy(): void {
    this.destroyed = true; this.generation++; this.routeSub.unsubscribe(); this.cancelarConsultas();
  }
  private cancelarConsultas(): void {
    this.reads.unsubscribe(); this.writes.unsubscribe(); this.docReads.unsubscribe(); this.downloads.unsubscribe();
    this.reads = new Subscription(); this.writes = new Subscription(); this.docReads = new Subscription(); this.downloads = new Subscription();
  }
  cargarApelacion(expediente: string): void {
    if (this.destroyed) return;
    const same = this.requested === expediente && this.session === this.sessionKey();
    if (same && this.operation) { this.recuperarResultado(); return; }
    if (same && this.loadingApelacion() && this.generation > 0) return;
    this.cancelarConsultas(); const generation = ++this.generation;
    this.requested = expediente; this.session = this.sessionKey(); this.revision = this.authService.cambiosSesion();
    this.apelacion.set(null); this.solicitudOrigen.set(null); this.loadingApelacion.set(true); this.loading.set(false);
    this.loadError.set(''); this.error.set(''); this.mensaje.set(''); this.rechazoBloqueante.set(false);
    this.confirmModalAbierto.set(false); this.successModalAbierto.set(false); this.showPreview.set(false); this.previewTarget.set(null);
    this.documentGroups.set([]); this.documentError.set(''); this.downloadError.set(''); this.docsLoaded = false;
    this.documentSearch.set(''); this.documentFilter.set(''); this.closedGroups.set({});
    this.loadingDocuments.set(false); this.downloadingId.set(null);
    if (!same) {
      this.operation = null; this.resultadoIncierto.set(false); this.registroObservado.set(null);
      this.selectedDecision.set(null); this.fundamentos = ''; this.observacionesList.set(['']); this.activeTab.set('apelacion'); this.validationAttempted.set(false);
    }
    let account; try { account = this.authService.obtenerSesion(); } catch { account = null; }
    if (!account?.token || !positiveId(account.usuarioId) || !['TTAIP', 'ADMINISTRADOR'].includes(account.tipoUsuario || '')) {
      this.loadError.set('La sesión no permite consultar primera calificación. Utilice el acceso interno TTAIP.'); this.loadingApelacion.set(false); return;
    }
    if (!expediente) { this.loadError.set('No se recibió un expediente para calificar.'); this.loadingApelacion.set(false); return; }
    this.reads.add(this.apelacionService.findByExpediente(expediente).subscribe({
      next: data => {
        if (!this.current(generation)) return;
        if (!apelacionCompatible(data, expediente)) { this.loadError.set('La respuesta está incompleta o pertenece a otro expediente.'); this.loadingApelacion.set(false); return; }
        this.apelacion.set(data);
        if (positiveId(data.solicitudId)) this.cargarOrigen(data, generation);
        else if (data.tipoOrigen === 'SAIP_INTERNA') { this.loadError.set('Falta el identificador de la SAIP de origen.'); this.loadingApelacion.set(false); }
        else this.loadingApelacion.set(false);
      },
      error: err => { if (this.current(generation)) { this.loadError.set(falloConsulta(err, 'la apelación').mensaje); this.loadingApelacion.set(false); } }
    }));
  }
  private cargarOrigen(ap: Apelacion, generation: number): void {
    this.reads.add(this.solicitudService.findById(ap.solicitudId).subscribe({
      next: sol => {
        if (!this.current(generation)) return;
        if (!sol || sol.id !== ap.solicitudId || (ap.solicitudExpediente && sol.expediente !== ap.solicitudExpediente)
          || (sol.ciudadanoId != null && sol.ciudadanoId !== ap.ciudadanoId)
          || (sol.respuesta && (sol.respuesta as { solicitudId?: number }).solicitudId != null
            && (sol.respuesta as { solicitudId?: number }).solicitudId !== sol.id)) this.loadError.set('Los antecedentes no corresponden a la solicitud de origen.');
        else this.solicitudOrigen.set(sol);
        this.loadingApelacion.set(false);
      },
      error: err => { if (this.current(generation)) { this.loadError.set(falloConsulta(err, 'la solicitud de origen').mensaje); this.loadingApelacion.set(false); } }
    }));
  }
  motivoNoDisponible(): string {
    const ap = this.apelacion();
    if (this.loadError()) return this.loadError();
    if (!ap) return 'No se ha recuperado la apelación.';
    if (!this.contextoVigente()) return 'La sesión cambió. Consulte con la cuenta actual.';
    if (this.loadingApelacion()) return 'Cargando antecedentes.';
    if (this.resultadoIncierto()) return 'El envío anterior tiene resultado incierto. Consulte antes de otra operación.';
    if (this.rechazoBloqueante()) return 'El servidor rechazó el acceso o la transición. Consulte nuevamente el expediente.';
    return motivoPrimera(ap);
  }
  puedeCalificar(): boolean { return !this.motivoNoDisponible(); }
  private observacionesTexto(): string { return this.observacionesList().map(value => value.trim()).filter(Boolean).join('\n'); }
  validacionTexto(): string {
    if (!this.selectedDecision()) return 'Seleccione una decisión de primera calificación.';
    if (!this.fundamentos.trim()) return 'Los fundamentos son obligatorios.';
    if (this.fundamentos.trim().length > 5000) return 'Los fundamentos no pueden exceder 5000 caracteres.';
    if (this.selectedDecision() === 'inadmisible') {
      if (!this.observacionesTexto()) return 'Ingrese al menos una observación para subsanar.';
      if (this.observacionesTexto().length > 2000) return 'Las observaciones no pueden exceder 2000 caracteres en conjunto.';
    }
    return '';
  }
  canSubmit(): boolean { return this.puedeCalificar() && !this.loading() && !this.operation && !this.loadingDocuments() && !this.documentError() && !this.validacionTexto(); }
  setObs(index: number, value: string): void { if (!this.loading() && !this.resultadoIncierto()) this.observacionesList.update(list => list.map((item, i) => i === index ? value : item)); }
  addObs(): void { if (!this.loading() && !this.resultadoIncierto()) this.observacionesList.update(list => [...list, '']); }
  removeObs(index: number): void { if (!this.loading() && !this.resultadoIncierto()) this.observacionesList.update(list => list.length > 1 ? list.filter((_, i) => i !== index) : list); }
  seleccionarCalificacion(decision: CalificacionDecision): void {
    if (!this.puedeCalificar() || this.loading() || this.operation || !this.options.some(option => option.id === decision)) return;
    this.confirmModalAbierto.set(false); this.showPreview.set(false); this.previewTarget.set(null);
    this.downloads.unsubscribe(); this.downloads = new Subscription(); this.downloadingId.set(null);
    this.selectedDecision.set(decision); this.error.set(''); this.validationAttempted.set(false);
  }
  abrirConfirmacionCalificacion(): void {
    this.validationAttempted.set(true);
    if (!this.canSubmit()) { this.error.set(this.motivoNoDisponible() || this.validacionTexto() || 'Revise la consulta de documentos.'); return; }
    this.confirmModalAbierto.set(true);
  }
  enviarCalificacion(): void {
    if (this.loading() || this.operation || this.destroyed) return;
    this.validationAttempted.set(true);
    if (!this.canSubmit()) { this.error.set(this.motivoNoDisponible() || this.validacionTexto() || 'Revise la consulta de documentos.'); return; }
    const ap = this.apelacion()!, decision = this.selectedDecision()!, generation = this.generation;
    const operation: CalificacionOperacion = { apelacionId: ap.id, expediente: ap.expediente, decision, fundamentos: this.fundamentos.trim(),
      ...(decision === 'inadmisible' ? { observaciones: this.observacionesTexto() } : {}) };
    this.operation = operation; this.loading.set(true); this.error.set('');
    const payload = { fundamentos: operation.fundamentos, ...(decision === 'inadmisible' ? { observaciones: operation.observaciones, diasSubsanacion: this.diasSubsanacion } : {}) };
    const command = decision === 'admisible' ? this.ttaipService.admitirApelacion(ap.id, payload)
      : decision === 'inadmisible' ? this.ttaipService.requerirSubsanacion(ap.id, payload) : this.ttaipService.inadmitirApelacion(ap.id, payload);
    this.writes.add(command.subscribe({
      next: updated => {
        if (!this.current(generation) || this.selectedDecision() !== decision) return;
        this.confirmModalAbierto.set(false);
        if (!apelacionCompatible(updated, operation.expediente) || updated.id !== operation.apelacionId
          || updated.estado !== this.options.find(item => item.id === decision)!.estado || !actuacionCompatible(updated, operation)) {
          this.marcarIncierto('No se recibió una confirmación compatible de la actuación; consulte el expediente antes de repetir la operación.'); return;
        }
        operation.resolucionId = updated.resolucionPrimeraCalificacion!.id;
        this.consultarOperacion(operation, generation);
      },
      error: err => {
        if (!this.current(generation)) return;
        this.confirmModalAbierto.set(false); this.loading.set(false);
        if ([400, 401, 403, 404, 409, 422].includes(err?.status)) {
          this.operation = null; this.rechazoBloqueante.set([401, 403, 404, 409].includes(err.status));
          this.error.set(err.status === 409 ? 'La transición fue rechazada: consulte la actuación y el estado actuales antes de registrar.' :
            [400, 422].includes(err.status) ? 'El servidor rechazó la calificación. Revise los fundamentos y observaciones.' : falloConsulta(err, 'la apelación').mensaje);
        } else this.marcarIncierto('No se pudo confirmar el registro. El servidor puede haberlo aceptado. Consulte el resultado sin repetir la escritura.');
      }
    }));
  }
  private marcarIncierto(message: string): void {
    this.loading.set(false); this.confirmModalAbierto.set(false); this.successModalAbierto.set(false); this.resultadoIncierto.set(true); this.error.set(message);
  }
  recuperarResultado(): void {
    if (this.destroyed || this.loading() || !this.contextoVigente() || !this.operation) return;
    this.consultarOperacion(this.operation, this.generation);
  }
  private consultarOperacion(operation: CalificacionOperacion, generation: number): void {
    this.loading.set(true);
    this.writes.add(this.apelacionService.findByExpediente(operation.expediente).subscribe({
      next: ap => {
        if (!this.current(generation) || this.operation !== operation) return;
        this.loading.set(false);
        if (!apelacionCompatible(ap, operation.expediente) || ap.id !== operation.apelacionId) {
          this.marcarIncierto('La consulta no devolvió el recurso esperado. No se confirma el registro.'); return;
        }
        if (this.selectedDecision() !== operation.decision) {
          this.marcarIncierto('La consulta corresponde a la decisión del envío anterior, no a la selección actual. Revise el expediente sin otra escritura.'); return;
        }
        if (operation.resolucionId != null && actuacionCompatible(ap, operation)) {
          this.apelacion.set(ap); this.operation = null; this.resultadoIncierto.set(false); this.error.set('');
          this.mensaje.set('Primera calificación registrada y recuperada del servidor.'); this.successModalAbierto.set(true);
          return;
        }
        const resolution = ap.resolucionPrimeraCalificacion;
        this.registroObservado.set(positiveId(resolution?.id) && resolution?.tipoResolucion === 'PRIMERA_CALIFICACION' ? resolution.id : null);
        this.marcarIncierto(operation.resolucionId == null
          ? 'Consulta realizada. Sin un identificador devuelto por el envío no es posible atribuirle una actuación posterior, aunque coincidan sus textos. Revise el expediente.'
          : 'La actuación recuperada no coincide con el identificador y contenido confirmados. Revise el expediente; no se repite el comando.');
      },
      error: () => { if (this.current(generation) && this.operation === operation) this.marcarIncierto('No se pudo recuperar la actuación. Los fundamentos se conservan; consulte nuevamente sin reenviar el comando.'); }
    }));
  }
  cambiarTab(tab: 'apelacion' | 'adjuntos' | 'subprocesos'): void {
    this.activeTab.set(tab); if (tab === 'adjuntos' && !this.docsLoaded && !this.loadingDocuments()) this.cargarDocumentos();
  }
  onTabKey(event: KeyboardEvent, tab: 'apelacion' | 'adjuntos' | 'subprocesos'): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const i = this.tabs.findIndex(t => t.id === tab);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? this.tabs.length - 1
      : (i + (event.key === 'ArrowLeft' ? -1 : 1) + this.tabs.length) % this.tabs.length;
    const next = this.tabs[index].id;
    this.cambiarTab(next); this.host.nativeElement.querySelector<HTMLElement>('#qual-tab-' + next)?.focus();
  }
  cargarDocumentos(): void {
    const ap = this.apelacion(); if (!ap || !this.contextoVigente() || this.loadingDocuments() || this.loadingApelacion() || this.loadError()) return;
    const generation = this.generation, relations: Omit<DocumentGroup, 'documents'>[] = [];
    const origin = this.solicitudOrigen();
    if (origin) {
      relations.push({ label: 'Solicitud SAIP de origen', relation: { solicitudId: origin.id } });
      const response = origin.respuesta;
      if (positiveId(response?.id) && ((response as { solicitudId?: number }).solicitudId == null || (response as { solicitudId?: number }).solicitudId === origin.id))
        relations.push({ label: 'Respuesta de la entidad', relation: { respuestaId: response.id } });
    }
    relations.push({ label: 'Apelación', relation: { apelacionId: ap.id } });
    const aggregate = ap.expedienteTtaip;
    if (positiveId(aggregate?.id) && aggregate?.numeroExpediente === ap.expediente) relations.push({ label: 'Expediente TTAIP', relation: { expedienteTtaipId: aggregate.id } });
    this.loadingDocuments.set(true); this.documentError.set(''); this.documentGroups.set([]); this.previewTarget.set(null);
    this.docReads.unsubscribe(); this.docReads = new Subscription();
    this.docReads.add(forkJoin(relations.map(group => this.documentoService.listByRelation(group.relation))).subscribe({
      next: values => {
        if (!this.current(generation)) return;
        const groups = relations.map((group, index) => ({ ...group, documents: documentosRelacionados(values[index], group.relation) }));
        const seen = new Set<number>();
        if (groups.some(group => group.documents === null || group.documents.some(doc => seen.has(doc.id!) || !seen.add(doc.id!)))) {
          this.documentError.set('La información documental está incompleta o contiene asociaciones incompatibles. No se ofrecen archivos de otro recurso.');
        } else { this.documentGroups.set(groups as DocumentGroup[]); this.docsLoaded = true; }
        this.loadingDocuments.set(false);
      },
      error: err => { if (this.current(generation)) { this.loadingDocuments.set(false); this.documentError.set(falloConsulta(err, 'los documentos del expediente').mensaje); } }
    }));
  }
  private documentoActual(doc: DocumentoMetadata): boolean { return this.contextoVigente() && this.documentGroups().some(group => group.documents.some(item => item === doc && positiveId(item.id))); }
  verDocumento(doc: DocumentoMetadata): void {
    if (!this.documentoActual(doc)) return;
    this.previewTarget.set({ id: doc.id, nombre: this.nombreDocumento(doc), tipo: doc.contentType, expediente: this.apelacion()!.expediente });
  }
  descargarDocumento(doc: DocumentoMetadata): void {
    if (!this.documentoActual(doc) || this.downloadingId() != null) { this.downloadError.set('Consulte un documento identificado del expediente actual.'); return; }
    const generation = this.generation, decision = this.selectedDecision();
    this.downloadingId.set(doc.id!); this.downloadError.set('');
    this.downloads.add(this.documentoService.download(doc.id!, this.nombreDocumento(doc)).subscribe({
      next: ({ blob, filename }) => {
        if (!this.current(generation) || this.selectedDecision() !== decision) return;
        this.downloadingId.set(null);
        const url = URL.createObjectURL(blob);
        try { const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.rel = 'noopener'; anchor.click(); }
        finally { URL.revokeObjectURL(url); }
      },
      error: err => { if (this.current(generation)) { this.downloadingId.set(null); this.downloadError.set(falloConsulta(err, 'el documento').mensaje); } }
    }));
  }
  nombreDocumento(doc: DocumentoMetadata): string { return doc.nombreOriginal || 'Documento sin nombre informado'; }
  documentGroupId(group: DocumentGroup): string { const [key, id] = Object.entries(group.relation)[0]; return 'qualification-docs-' + key + '-' + id; }
  groupOpen(label: string): boolean { return !!this.documentSearch().trim() || !!this.documentFilter() || !this.closedGroups()[label]; }
  toggleDocumentGroup(label: string): void {
    if (!this.documentSearch().trim() && !this.documentFilter()) this.closedGroups.update(groups => ({ ...groups, [label]: !groups[label] }));
  }
  togglePreview(): void { if (this.contextoVigente() && this.selectedDecision()) this.showPreview.update(value => !value); }
  getEstadoDisplay(value: string | null | undefined): string { return value?.replaceAll('_', ' ') || 'No informado'; }
  reintentarConsulta(): void { this.cargarApelacion(this.requested); }
  getInitials(name: string | undefined): string { return name?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '—'; }
  fechaVisible(value: unknown): string | null { return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null; }
  viaIngreso(): string {
    const ap = this.apelacion(), elevation = ap?.elevacion;
    if (elevation && elevation.apelacionId === ap?.id) return elevation.estadoElevacion === 'ELEVADA' ? 'Elevada por entidad'
      : elevation.estadoElevacion === 'ADMITIDA_EXCEPCIONALMENTE' ? 'Admisión excepcional registrada' : 'Presentada ante entidad · ' + elevation.estadoElevacion;
    return ap?.tipoOrigen === 'EXTERNA' ? 'Apelación externa · vía no informada' : 'Vía de ingreso no informada';
  }
  causalOrigen(): string {
    const ap = this.apelacion(), response = this.solicitudOrigen()?.respuesta;
    return response?.tipoRespuesta || ap?.tipoDenegatoria || 'Tipo de respuesta o denegatoria no informado';
  }
  calificacionConfirmSummary(): ReferenceConfirmSummary[] {
    return [{ label: 'Expediente', value: this.apelacion()?.expediente || '—', mono: true },
      { label: 'Calificación', value: this.selectedOption()?.label || '—' }, { label: 'Efecto', value: this.selectedOption()?.description || '—' },
      { label: 'Fundamentos', value: String(this.fundamentos.trim().length) + ' caracteres' },
      ...(this.selectedDecision() === 'inadmisible' ? [{ label: 'Observaciones', value: String(this.observacionesList().filter(o => o.trim()).length) + ' punto(s)' }] : [])];
  }
  calificacionWarning(): ReferenceConfirmWarning {
    return { label: 'Registro de actuación', detail: 'No acredita firma, emisión documental, entrega ni notificación eficaz. Los borradores no se incorporan mediante este comando.' };
  }
  calificacionSuccessTone(): ReferenceSuccessTone { return this.selectedDecision() === 'admisible' ? 'success' : this.selectedDecision() === 'inadmisible' ? 'warning' : 'brand'; }
  calificacionSuccessTitle(): string { return 'Primera calificación ' + (this.apelacion()?.resolucionPrimeraCalificacion?.decision || 'registrada'); }
  idPrimera(): number | undefined { return this.apelacion()?.resolucionPrimeraCalificacion?.id; }
  numeroPrimera(): string { return this.apelacion()?.resolucionPrimeraCalificacion?.numeroResolucion || 'Sin numeración registrada'; }
  calificacionSuccessMetadata(): ReferenceSuccessMeta[] {
    const r = this.apelacion()?.resolucionPrimeraCalificacion;
    return [{ label: 'Numeración', value: r?.numeroResolucion || 'Sin numeración registrada', mono: true },
      { label: 'Decisión', value: r?.decision || 'No informada' }, { label: 'Fecha registrada', value: r?.fechaResolucion || 'No informada' },
      { label: 'Miembro registrado', value: r?.miembroTTAIPNombre || 'No informado' }];
  }
  calificacionNextSteps(): ReferenceSuccessNextStep[] {
    return [{ label: 'Consulte los documentos registrados y la evidencia de notificación en el expediente.' },
      { label: this.selectedDecision() === 'inadmisible' ? 'El plazo de subsanación comienza solo con eficacia acreditada del requerimiento al recurrente.'
        : 'Los plazos y actuaciones siguientes se comprueban en el servidor; este registro no los acredita por sí solo.' }];
  }
  cerrarResultado(): void {
    this.successModalAbierto.set(false);
    queueMicrotask(() => { if (this.contextoVigente()) this.host.nativeElement.querySelector<HTMLElement>('#qualification-result')?.focus(); });
  }
  irPanelTtaip(): void { if (this.contextoVigente()) void this.router.navigate(['/ttaip']); }
  irNotificaciones(): void {
    const expediente = this.apelacion()?.expediente;
    if (expediente && this.contextoVigente()) {
      void this.router.navigate(['/ttaip/apelacion', expediente], { queryParams: { tab: 'notificaciones' } });
    }
  }
  irExpediente(): void { if (this.contextoVigente() && this.apelacion()) void this.router.navigate(['/ttaip/apelacion', this.apelacion()!.expediente]); }
}
