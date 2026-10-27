import { ChangeDetectionStrategy, Component, ElementRef, OnInit, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { ApelacionService } from '../../services/apelacion.service';
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
import { SegundaDecision, RECEPCION_INSTITUCIONAL_NO_DISPONIBLE, segundaOpciones, requerimientoConsultado, segundaConsultada, contextoSegunda, relojConsultado } from './ttaip-segunda-calificacion.model';
import { LucideArrowLeft, LucideCheckCircle2, LucideFileText, LucideXCircle, LucideInfo, LucideEye, LucideEyeOff,
  LucideDownload, LucideSearch, LucideChevronDown } from '@lucide/angular';

interface DocumentGroup { label: string; relation: DocumentoRelation; documents: DocumentoMetadata[]; }
@Component({
  selector: 'app-ttaip-segunda-calificacion',
  imports: [CommonModule, FormsModule, RouterLink, ReferenceConfirmModalComponent, ReferenceSuccessModalComponent,
    OfficialDocsSectionComponent, OfficialPreviewComponent, DocumentPreviewModalComponent, LucideArrowLeft,
    LucideCheckCircle2, LucideFileText, LucideXCircle, LucideInfo, LucideEye, LucideEyeOff, LucideDownload, LucideSearch, LucideChevronDown],
  templateUrl: './ttaip-segunda-calificacion.component.html', styleUrl: './ttaip-segunda-calificacion.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TtaipSegundaCalificacionComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly apelacionService = inject(ApelacionService);
  private readonly documentoService = inject(DocumentoService);
  private readonly authService = inject(AuthService);
  private routeSub = new Subscription();
  private reads = new Subscription();
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
  readonly recepcionNoDisponible = RECEPCION_INSTITUCIONAL_NO_DISPONIBLE;
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
    this.reads.unsubscribe(); this.docReads.unsubscribe(); this.downloads.unsubscribe();
    this.reads = new Subscription(); this.docReads = new Subscription(); this.downloads = new Subscription();
  }
  private limpiarBorrador(): void { this.selectedDecision.set(null); this.fundamentos = ''; this.showPreview.set(false); this.confirmModalAbierto.set(false); }
  cargarApelacion(expediente: string): void {
    if (this.destroyed) return;
    const same = expediente === this.requested && this.session === this.sessionKey();
    if (same && this.loadingApelacion() && this.generation > 0) return;
    this.cancelarLecturas(); const generation = ++this.generation;
    this.requested = expediente; this.session = this.sessionKey(); this.revision = this.authService.cambiosSesion();
    this.apelacion.set(null); this.loadingApelacion.set(true); this.loadError.set(''); this.error.set('');
    this.confirmModalAbierto.set(false); this.successModalAbierto.set(false); this.showPreview.set(false); this.previewTarget.set(null);
    this.documentGroups.set([]); this.documentSearch.set(''); this.documentFilter.set(''); this.closedGroups.set({});
    this.documentError.set(''); this.downloadError.set(''); this.loadingDocuments.set(false); this.downloadingId.set(null); this.docsLoaded = false;
    if (!same) { this.previousId = null; this.previousRequirement = null; this.limpiarBorrador(); this.activeTab.set('subsanacion'); }
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
      },
      error: err => { if (this.current(generation)) { this.loadError.set(falloConsulta(err, 'la apelación').mensaje); this.loadingApelacion.set(false); } }
    }));
  }
  reintentarConsulta(): void { this.cargarApelacion(this.requested); }
  puedePrepararBorrador(): boolean { return this.contextoVigente() && !this.loadingApelacion() && !this.loadError() && this.contexto() === 'borrador'; }
  /** No institutional receipt read exists in the current contract: fail closed instead of guessing. */
  puedeEmitirSegundaCalificacion(): boolean { return false; }
  canSubmit(): boolean { return false; }
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
    if (!this.puedePrepararBorrador() || this.validacionBorrador()) { this.error.set(this.validacionBorrador() || 'Revise el contexto del expediente.'); return; }
    this.confirmModalAbierto.set(true);
  }
  enviarCalificacion(): void {
    if (this.destroyed) return;
    this.confirmModalAbierto.set(false);
    this.error.set('Registro no disponible: falta una consulta institucional de recepción vinculada; consulte el expediente. No se ha enviado ningún comando.');
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
    return 'Preparación local de borradores. El registro sigue no disponible hasta disponer de consulta institucional de recepción.';
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
      { label: 'Selección local para borrador', value: this.getDecisionLabel(this.selectedDecision()) },
      { label: 'Fundamentos locales', value: String(this.fundamentos.trim().length) + ' caracteres' }];
  }
  segundaWarning(): ReferenceConfirmWarning { return { label: 'Solo revisión local', detail: 'Cerrar esta revisión no registra ni notifica una actuación. El envío no está disponible; falta consultar la recepción del requerimiento.' }; }
  verActuacionRegistrada(): void { if (this.contextoVigente() && this.segundaActuacion() && !this.loadError()) this.successModalAbierto.set(true); }
  segundaSuccessTone(): ReferenceSuccessTone { return 'warning'; }
  segundaSuccessTitle(): string { return 'Segunda calificación consultada · ' + (this.segundaActuacion()?.decision || 'No identificada'); }
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
