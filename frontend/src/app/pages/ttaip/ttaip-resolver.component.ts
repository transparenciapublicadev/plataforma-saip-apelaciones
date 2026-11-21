import { MultiFileUploadZoneComponent } from '../../shared/multi-file-upload-zone.component';
import { InformacionComplementariaComponent } from './shared/informacion-complementaria.component';
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
import { DocumentoMetadata, DocumentoRelation, validarDocumento } from '../../models/documento.model';
import { ReferenceConfirmModalComponent, ReferenceConfirmSummary, ReferenceConfirmWarning } from '../../shared/reference-confirm-modal.component';
import { ReferenceSuccessModalComponent, ReferenceSuccessMeta, ReferenceSuccessNextStep, ReferenceSuccessTone } from '../../shared/reference-success-modal.component';
import { DocumentPreviewModalComponent, DocumentPreviewTarget } from '../../shared/document-preview-modal.component';
import { OfficialDocsSectionComponent } from './shared/official-docs-section.component';
import { OfficialPreviewComponent } from './shared/official-preview.component';
import { DocContext, CedulaVariant, cedulaVariantForStage } from './shared/official-docs.util';
import { positiveId, apelacionCompatible, documentosRelacionados } from './ttaip-calificar.model';
import { finalOpciones, FinalSelection, FinalOperacion, ArchivoFinal, finalConsultada, admisionFinal, motivoFinal, eficaciaAdmision, descargosConsultados, estadoDescargos, finalCompatible, archivoCompatible, fechaRegistrada, relacionesFinalCoherentes, ETAPAS_RETROACCION, EtapaRetroaccionId } from './ttaip-resolver.model';
import { falloConsulta } from '../../utils/consulta-remota.util';
import { requerimientoConsultado } from './ttaip-segunda-calificacion.model';
import { consultarRecepcionInstitucional, sinConsultaRecepcion } from './recepcion-institucional.model';
import { RecepcionInstitucionalComponent } from './recepcion-institucional.component';
import { LucideArrowLeft, LucideGavel, LucideCheckCircle2, LucideFileText, LucideSend, LucideInfo, LucideXCircle, LucideMinusCircle, LucideEye, LucideEyeOff, LucideDownload, LucideSearch, LucideChevronDown } from '@lucide/angular';

type ResolverTab = 'apelacion' | 'descargos' | 'adjuntos' | 'subprocesos';
interface DocumentGroup { label: string; relation: DocumentoRelation; documents: DocumentoMetadata[]; }
@Component({
  selector: 'app-ttaip-resolver',
  imports: [MultiFileUploadZoneComponent, CommonModule, FormsModule, RouterLink, ReferenceConfirmModalComponent, ReferenceSuccessModalComponent, DocumentPreviewModalComponent,
    InformacionComplementariaComponent, OfficialDocsSectionComponent, OfficialPreviewComponent, RecepcionInstitucionalComponent, LucideArrowLeft, LucideGavel, LucideCheckCircle2, LucideFileText, LucideSend, LucideInfo,
    LucideXCircle, LucideMinusCircle, LucideEye, LucideEyeOff, LucideDownload, LucideSearch, LucideChevronDown],
  templateUrl: './ttaip-resolver.component.html', styleUrl: './ttaip-resolver.component.css', changeDetection: ChangeDetectionStrategy.OnPush
})
export class TtaipResolverComponent implements OnInit, OnDestroy {
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
  private docReads = new Subscription();
  private downloads = new Subscription();
  private generation = 0;
  private initialized = false;
  private destroyed = false;
  private requested = '';
  private session = '';
  private revision = -1;
  private previousId: number | null = null;
  private previousContext = '';
  private docsLoaded = false;
  private operation: FinalOperacion | null = null;
  readonly apelacion = signal<Apelacion | null>(null);
  readonly expedienteActuacion = computed(() => {
    const ap = this.apelacion(), exp = ap?.expedienteTtaip;
    return positiveId(exp?.id) && exp?.numeroExpediente === ap?.expediente ? exp.id : null;
  });
  readonly recepcion = signal(sinConsultaRecepcion());
  readonly loadingApelacion = signal(true);
  readonly loadError = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');
  readonly resultadoIncierto = signal(false);
  readonly registroObservado = signal<number | null>(null);
  readonly resultadoConfirmado = signal(false);
  readonly rechazoBloqueante = signal(false);
  readonly confirmModalAbierto = signal(false);
  readonly successModalAbierto = signal(false);
  readonly activeTab = signal<ResolverTab>('apelacion');
  readonly selectedDecision = signal<FinalSelection | null>(null);
  readonly causal = signal<'confirmar' | 'revocar' | null>(null);
  readonly showPreview = signal(false);
  readonly documentosSeleccionados = signal<File[]>([]);
  readonly archivos = signal<ArchivoFinal[]>([]);
  readonly previewTarget = signal<DocumentPreviewTarget | null>(null);
  readonly documentGroups = signal<DocumentGroup[]>([]);
  readonly loadingDocuments = signal(false);
  readonly documentError = signal('');
  readonly downloadError = signal('');
  readonly downloadingId = signal<number | null>(null);
  readonly documentSearch = signal('');
  readonly documentFilter = signal('');
  readonly closedGroups = signal<Record<string, boolean>>({});
  readonly tabs = [{ id: 'apelacion' as const, label: 'Apelación' }, { id: 'descargos' as const, label: 'Descargos de la entidad' }, { id: 'adjuntos' as const, label: 'Documentos del expediente' }, { id: 'subprocesos' as const, label: 'Subprocesos' }];
  readonly options = [...finalOpciones, { id: 'no_presentado' as const, label: 'TENER POR NO PRESENTADO', description: 'No es resolución final: requiere EN_SUBSANACION, ausencia de recepción y reloj acreditado', accent: 'var(--muted-foreground)' }];
  readonly selectedOption = computed(() => this.options.find(o => o.id === this.selectedDecision()));
  readonly decisionDocumental = computed(() => finalOpciones.find(o => o.id === this.selectedDecision())?.decision);
  efectoResolucion(): string {
    switch (this.selectedDecision()) {
      case 'fundado': return 'Se ampara totalmente el recurso. Se ordenará a la entidad la entrega de la información solicitada en el plazo establecido.';
      case 'fundado_en_parte': return 'Se ampara parcialmente. La entidad deberá entregar la parte de información que corresponde dentro del plazo.';
      case 'infundado': return 'Se desestima el recurso. La conducta de la entidad queda confirmada.';
      case 'infundado_en_parte': return 'Se desestima parcialmente. Se confirma parte de la conducta de la entidad.';
      case 'improcedente': return 'El recurso no cumple los requisitos formales o de fondo y se archiva.';
      case 'sustraccion_materia': return 'Procede la conclusión por sustracción de la materia: la entidad entregó la información durante el trámite.';
      case 'desistimiento': return 'Procede la conclusión por desistimiento expreso del ciudadano.';
      case 'estese_a_lo_resuelto': return 'Existe un pronunciamiento previo sobre la misma materia. Se resuelve estése a lo ya resuelto.';
      case 'nulidad_del_acto': return 'Se declara la nulidad de lo actuado y se retrotrae el procedimiento al momento del vicio.';
      case 'no_presentado': return 'El recurso no fue subsanado dentro del plazo legal; se tiene por no presentado.';
      default: return '';
    }
  }
  readonly primeraRegistro = computed<Apelacion['resolucionPrimeraCalificacion'] | null>(() => this.apelacion()?.resolucionPrimeraCalificacion ?? null);
  readonly segundaRegistro = computed<Apelacion['resolucionSegundaCalificacion'] | null>(() => this.apelacion()?.resolucionSegundaCalificacion ?? null);
  readonly admision = computed(() => admisionFinal(this.apelacion()));
  readonly resolucionRegistrada = computed(() => finalConsultada(this.apelacion()));
  readonly notificacionesTexto = computed(() => eficaciaAdmision(this.apelacion()));
  readonly descargos = computed(() => descargosConsultados(this.apelacion()));
  readonly descargosTexto = computed(() => estadoDescargos(this.apelacion()));
  readonly showOrden = computed(() => ['fundado', 'fundado_en_parte'].includes(this.selectedDecision() || ''));
  readonly showNulidad = computed(() => this.selectedDecision() === 'nulidad_del_acto');
  readonly cedulaVariant = computed<CedulaVariant>(() => cedulaVariantForStage('final', this.selectedDecision() || undefined));
  readonly docCtx = computed<Partial<DocContext>>(() => ({ expediente: this.apelacion()?.expediente || '', recurrente: this.apelacion()?.ciudadanoNombre || 'No registrado',
    entidad: this.apelacion()?.entidadNombre || this.apelacion()?.entidadExternaNombre || 'No registrada', sumilla: this.apelacion()?.solicitudAsunto || this.apelacion()?.resumenSolicitudOriginal || 'No informada' }));
  readonly documentCount = computed(() => this.documentGroups().reduce((sum, group) => sum + group.documents.length, 0));
  readonly visibleGroups = computed(() => {
    const norm = (v: string) => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es'); const query = norm(this.documentSearch().trim());
    return this.documentGroups().filter(g => !this.documentFilter() || this.documentFilter() === g.label).map(g => ({ ...g, total: g.documents.length,
      documents: g.documents.filter(d => !query || norm([d.nombreOriginal, d.tipoDocumento, d.contentType, g.label].filter(Boolean).join(' ')).includes(query)) })).filter(g => g.documents.length > 0);
  });
  fundamentos = '';
  observacionesResolucion = '';
  momentoVicio = '';
  actuacionOrdenada = '';
  iniciarProcesoDisciplinario = false;
  readonly etapasRetroaccion = ETAPAS_RETROACCION;
  retrotraeA: EtapaRetroaccionId = '';
  plazoDias = 7;
  ordenarEntrega = true;
  constructor() { effect(() => { const revision = this.authService.cambiosSesion(); if (this.initialized && revision !== this.revision) untracked(() => this.cargarApelacion(this.requested)); }); }
  private sessionKey(): string { try { const s = this.authService.obtenerSesion(); return JSON.stringify([s?.token, s?.usuarioId, s?.tipoUsuario, s?.miembroId]); } catch { return ''; } }
  contextoVigente(): boolean { return !this.destroyed && this.session === this.sessionKey(); }
  private current(generation: number): boolean { return generation === this.generation && this.contextoVigente(); }
  ngOnInit(): void { this.initialized = true; this.routeSub = this.route.paramMap.subscribe(p => this.cargarApelacion(p.get('expediente') || '')); }
  ngOnDestroy(): void { this.destroyed = true; this.generation++; this.routeSub.unsubscribe(); this.cancelar(); }
  private cancelar(): void { for (const s of [this.reads, this.writes, this.docReads, this.downloads]) s.unsubscribe(); this.reads = new Subscription(); this.writes = new Subscription(); this.docReads = new Subscription(); this.downloads = new Subscription(); }
  private limpiarBorrador(): void {
    this.selectedDecision.set(null);
    this.causal.set(null);
    this.fundamentos = '';
    this.observacionesResolucion = '';
    this.momentoVicio = '';
    this.actuacionOrdenada = '';
    this.retrotraeA = '';
    this.ordenarEntrega = true;
    this.plazoDias = 7;
    this.iniciarProcesoDisciplinario = false;
    this.documentosSeleccionados.set([]);
    this.archivos.set([]);
  }
  cargarApelacion(expediente: string): void {
    if (this.destroyed) return; const same = this.requested === expediente && this.session === this.sessionKey();
    if (same && this.operation) { if (!this.loading()) this.recuperarResultado(); return; }
    if (same && this.loadingApelacion() && this.generation > 0) return;
    this.cancelar(); const generation = ++this.generation; this.requested = expediente; this.session = this.sessionKey(); this.revision = this.authService.cambiosSesion();
    this.apelacion.set(null); this.recepcion.set(sinConsultaRecepcion()); this.loadingApelacion.set(true); this.loadError.set(''); this.error.set(''); this.mensaje.set(''); this.loading.set(false);
    this.confirmModalAbierto.set(false); this.successModalAbierto.set(false); this.showPreview.set(false); this.previewTarget.set(null);
    this.documentGroups.set([]); this.documentError.set(''); this.downloadError.set(''); this.loadingDocuments.set(false); this.downloadingId.set(null); this.docsLoaded = false;
    this.documentSearch.set(''); this.documentFilter.set(''); this.closedGroups.set({}); this.rechazoBloqueante.set(false);
    if (!same) { this.operation = null; this.resultadoIncierto.set(false); this.resultadoConfirmado.set(false); this.registroObservado.set(null); this.previousId = null; this.previousContext = ''; this.limpiarBorrador(); this.activeTab.set('apelacion'); }
    let account; try { account = this.authService.obtenerSesion(); } catch { account = null; }
    if (!account?.token || !positiveId(account.usuarioId) || !['TTAIP', 'ADMINISTRADOR'].includes(account.tipoUsuario || '')) { this.loadingApelacion.set(false); this.loadError.set('La sesión no permite consultar el Tribunal. Utilice el acceso interno.'); return; }
    if (!expediente) { this.loadingApelacion.set(false); this.loadError.set('No se recibió un expediente.'); return; }
    this.reads.add(this.apelacionService.findByExpediente(expediente).subscribe({ next: ap => {
      if (!this.current(generation)) return;
      if (!apelacionCompatible(ap, expediente) || !relacionesFinalCoherentes(ap) || (this.previousId != null && this.previousId !== ap.id)) { this.loadingApelacion.set(false); this.loadError.set('La consulta no identifica la apelación solicitada o contiene asociaciones incompatibles.'); return; }
      const context = JSON.stringify([ap.resolucionPrimeraCalificacion?.id, ap.resolucionSegundaCalificacion?.id, ap.expedienteTtaip?.id, ap.entidadId, ap.solicitudId]);
      if (this.previousContext && context !== this.previousContext) this.limpiarBorrador();
      this.previousId = ap.id; this.previousContext = context; this.apelacion.set(ap); this.loadingApelacion.set(false);
      const requirement = requerimientoConsultado(ap);
      if (requirement && (ap.resolucionSegundaCalificacion != null || ap.calificacionSegunda != null))
        this.reads.add(consultarRecepcionInstitucional(this.ttaipService, ap, requirement.id!)
          .subscribe(value => { if (this.current(generation)) this.recepcion.set(value); }));
    }, error: err => { if (this.current(generation)) { this.loadingApelacion.set(false); this.loadError.set(falloConsulta(err, 'la apelación').mensaje); } } }));
  }
  consultarEstado(): void { if (this.operation) this.recuperarResultado(); else this.cargarApelacion(this.requested); }
  motivoNoDisponible(): string {
    if (!this.contextoVigente()) return 'La sesión cambió. Consulte con la cuenta actual.';
    if (this.loadingApelacion() || this.loadError()) return this.loadError() || 'Cargando antecedentes.';
    if (this.resultadoIncierto()) return 'Resultado incierto: consulte sin repetir el comando.';
    if (this.rechazoBloqueante()) return 'El servidor rechazó el acceso o la transición. Consulte nuevamente.';
    const reason = motivoFinal(this.apelacion(), this.recepcion()); if (reason) return reason;
    if (!positiveId(this.authService.obtenerSesion()?.miembroId)) return 'El acceso actual no informa un miembro TTAIP verificable. No se asigna un autor predeterminado desde el formulario.';
    return '';
  }
  puedeEmitirResolucion(): boolean { return !this.motivoNoDisponible(); }
  puedePrepararBorrador(): boolean { return this.contextoVigente() && !this.loadingApelacion() && !this.loadError() && !!this.apelacion() && this.apelacion()?.estado === 'EN_RESOLUCION' && !this.resolucionRegistrada() && !this.operation && !this.loading(); }
  private observacionesTexto(): string | undefined {
    if (this.showNulidad()) {
      const etapaObj = ETAPAS_RETROACCION.find(e => e.id === this.retrotraeA);
      const retroStr = etapaObj && etapaObj.id ? `Retroacción ordenada: ${etapaObj.label}` : 'Sin retroacción específica';
      return [
        this.observacionesResolucion.trim(),
        `Momento del vicio: ${this.momentoVicio.trim()}; Actuación ordenada: ${this.actuacionOrdenada.trim()}; ${retroStr}`
      ].filter(Boolean).join('\n');
    }
    if (this.showOrden() && this.ordenarEntrega) {
      return [
        this.observacionesResolucion.trim(),
        `Mandato: Entrega de información ordenada a la entidad en un plazo de ${this.plazoDias} días hábiles contados desde la notificación eficaz.`
      ].filter(Boolean).join('\n');
    }
    return this.selectedDecision() === 'estese_a_lo_resuelto' ? this.observacionesResolucion.trim() || undefined : undefined;
  }
  validacionTexto(): string {
    if (!finalOpciones.some(o => o.id === this.selectedDecision())) return 'Seleccione una decisión final compatible.';
    if (!this.fundamentos.trim()) return 'Los fundamentos son obligatorios.';
    if (this.fundamentos.trim().length > 5000) return 'Los fundamentos no pueden exceder 5000 caracteres.';
    if (this.showNulidad() && (!this.momentoVicio.trim() || !this.actuacionOrdenada.trim())) return 'Indique el momento del vicio y la actuación ordenada.';
    if ((this.observacionesTexto()?.length || 0) > 5000) return 'Las observaciones no pueden exceder 5000 caracteres en conjunto.';
    return '';
  }
  canSubmit(): boolean { return this.puedeEmitirResolucion() && !this.operation && !this.loading() && !this.validacionTexto(); }
  seleccionarCausal(value: 'confirmar' | 'revocar'): void { if (this.puedePrepararBorrador()) this.causal.set(value); }
  seleccionarDecision(value: FinalSelection): void {
    if (!this.puedePrepararBorrador() || value === 'no_presentado') return;
    this.selectedDecision.set(value); this.error.set(''); this.showPreview.set(false); this.confirmModalAbierto.set(false); this.previewTarget.set(null);
    this.downloads.unsubscribe(); this.downloads = new Subscription(); this.downloadingId.set(null);
    if (this.loadingDocuments()) { this.docReads.unsubscribe(); this.docReads = new Subscription(); this.loadingDocuments.set(false); this.docsLoaded = false; this.documentGroups.set([]); }
    if (!this.showOrden()) this.iniciarProcesoDisciplinario = false;
  }
  togglePreview(): void { if (this.contextoVigente() && finalOpciones.some(o => o.id === this.selectedDecision())) this.showPreview.update(v => !v); }
  abrirConfirmacionResolucion(): void { if (this.canSubmit()) this.confirmModalAbierto.set(true); else this.error.set(this.motivoNoDisponible() || this.validacionTexto()); }
  enviarResolucion(): void {
    if (this.loading() || this.operation || this.destroyed) return;
    if (!this.canSubmit()) { this.error.set(this.motivoNoDisponible() || this.validacionTexto()); return; }
    const ap = this.apelacion()!, option = finalOpciones.find(o => o.id === this.selectedDecision())!, generation = this.generation;
    const op: FinalOperacion = {
      apelacionId: ap.id,
      expediente: ap.expediente,
      decision: option.id,
      fundamentos: this.fundamentos.trim(),
      miembroId: this.authService.obtenerSesion()!.miembroId!,
      ...(this.observacionesTexto() ? { observaciones: this.observacionesTexto() } : {}),
      ...(this.showOrden() ? { iniciarProcesoDisciplinario: this.iniciarProcesoDisciplinario, ordenarEntrega: this.ordenarEntrega, plazoDias: this.plazoDias } : {}),
      ...(this.showNulidad() && this.retrotraeA ? { retrotraeA: this.retrotraeA } : {})
    };
    this.operation = op; this.loading.set(true); this.error.set(''); this.archivos.set(this.documentosSeleccionados().map(file => ({ file, estado: 'seleccionado' })));
    const { fundamentos, observaciones, miembroId, iniciarProcesoDisciplinario } = op;
    this.writes.add(this.ttaipService[option.command](ap.id, { fundamentos, observaciones, miembroId, iniciarProcesoDisciplinario }).subscribe({ next: updated => {
      if (!this.current(generation) || this.operation !== op || this.selectedDecision() !== op.decision) return;
      this.confirmModalAbierto.set(false);
      const id = finalConsultada(updated)?.id;
      if (!positiveId(id)) { this.marcarIncierto('No se recibió un ID verificable de resolución; consulte el resultado sin repetir el registro.'); return; }
      const candidate = { ...op, resolucionId: id };
      if (!finalCompatible(updated, candidate)) { this.marcarIncierto('La respuesta no identifica una resolución compatible con el recurso y contenido enviados. Consulte antes de otra operación.'); return; }
      op.resolucionId = id; this.consultarOperacion(op, generation);
    }, error: err => {
      if (!this.current(generation) || this.operation !== op) return;
      this.loading.set(false); this.confirmModalAbierto.set(false);
      if ([400, 401, 403, 404, 409, 422].includes(err?.status)) { this.operation = null; this.archivos.set([]); this.rechazoBloqueante.set([401, 403, 404, 409].includes(err.status)); this.error.set(falloConsulta(err, 'el registro de resolución').mensaje); }
      else this.marcarIncierto('No se pudo confirmar el registro. El servidor puede haberlo aceptado. Consulte sin repetir la escritura.');
    } }));
  }
  private marcarIncierto(message: string): void { this.loading.set(false); this.confirmModalAbierto.set(false); this.successModalAbierto.set(false); this.resultadoIncierto.set(true); this.error.set(message); }
  recuperarResultado(): void { if (this.operation && !this.loading() && this.contextoVigente()) this.consultarOperacion(this.operation, this.generation); }
  private consultarOperacion(op: FinalOperacion, generation: number): void {
    this.loading.set(true);
    this.writes.add(this.apelacionService.findByExpediente(op.expediente).subscribe({ next: ap => {
      if (!this.current(generation) || this.operation !== op) return;
      this.loading.set(false);
      if (!apelacionCompatible(ap, op.expediente) || !relacionesFinalCoherentes(ap) || ap.id !== op.apelacionId || this.selectedDecision() !== op.decision) { this.marcarIncierto('La consulta no corresponde al recurso o decisión del envío. No se confirma el registro.'); return; }
      if (op.resolucionId == null || !finalCompatible(ap, op)) {
        this.registroObservado.set(finalConsultada(ap)?.id || null);
        this.marcarIncierto(op.resolucionId == null ? 'Consulta realizada. Sin ID devuelto por el envío no se puede atribuir una resolución posterior, aunque coincidan los fundamentos. Revise el expediente.' : 'La resolución recuperada no coincide con el ID y contenido devueltos. No se repite el comando.'); return;
      }
      this.apelacion.set(ap); this.resultadoIncierto.set(false); this.error.set('');
      if (!this.resultadoConfirmado()) { this.resultadoConfirmado.set(true); this.subirSiguiente(op, generation); }
      else { this.mensaje.set('Resolución registrada y recuperada. Consulte por separado el estado de los archivos.'); this.successModalAbierto.set(true); }
    }, error: () => { if (this.current(generation) && this.operation === op) this.marcarIncierto('No se pudo recuperar la resolución. Se conserva el contenido en memoria; consulte de nuevo sin reenviar.'); } }));
  }
  seleccionarDocumentos(files: File[]): void {
    if (!this.puedePrepararBorrador()) return;
    const errors: string[] = [];
    const accepted: File[] = [];
    for (const file of files) {
      const error = validarDocumento(file);
      if (error) errors.push(error);
      else accepted.push(file);
    }
    this.documentosSeleccionados.set(accepted);
    this.error.set(errors.join(' '));
  }
  private updateArchivo(entry: ArchivoFinal, values: Partial<ArchivoFinal>): void { Object.assign(entry, values); this.archivos.update(files => [...files]); }
  private subirSiguiente(op: FinalOperacion, generation: number): void {
    if (!this.current(generation) || this.operation !== op || this.selectedDecision() !== op.decision || !this.resultadoConfirmado() || !positiveId(op.resolucionId)) return;
    const entry = this.archivos().find(file => file.estado === 'seleccionado');
    if (!entry) { this.finalizarArchivos(); return; }
    this.loading.set(true); this.updateArchivo(entry, { estado: 'enviando' });
    this.writes.add(this.documentoService.upload(entry.file, 'RESOLUCION_TTAIP', { resolucionId: op.resolucionId }).subscribe({ next: doc => {
      if (!this.current(generation) || this.operation !== op || this.selectedDecision() !== op.decision) return;
      if (!archivoCompatible(doc, op.resolucionId!) || this.archivos().some(other => other !== entry && other.documentoId === doc.id)) { this.updateArchivo(entry, { estado: 'incierto', mensaje: 'La respuesta no acredita un documento distinto de esta resolución. No se repite la subida.' }); this.finalizarArchivos(); return; }
      this.updateArchivo(entry, { documentoId: doc.id! }); this.verificarArchivo(entry, op, generation, () => this.subirSiguiente(op, generation));
    }, error: err => {
      if (!this.current(generation) || this.operation !== op) return;
      const rejected = [400, 401, 403, 404, 409, 422].includes(err?.status);
      this.updateArchivo(entry, { estado: rejected ? 'rechazado' : 'incierto', mensaje: rejected ? falloConsulta(err, 'el archivo').mensaje : 'Resultado de subida incierto, sin ID. Consulte los documentos; no se repite automáticamente.' });
      if (rejected) this.subirSiguiente(op, generation); else this.finalizarArchivos();
    } }));
  }
  private verificarArchivo(entry: ArchivoFinal, op: FinalOperacion, generation: number, next: () => void): void {
    this.writes.add(this.documentoService.getMetadata(entry.documentoId!).subscribe({ next: doc => {
      if (!this.current(generation) || this.operation !== op || this.selectedDecision() !== op.decision) return;
      if (doc?.id === entry.documentoId && archivoCompatible(doc, op.resolucionId!)) this.updateArchivo(entry, { estado: 'registrado', mensaje: 'Documento registrado y recuperado por ID.' });
      else this.updateArchivo(entry, { estado: 'incierto', mensaje: 'No se pudo comprobar la asociación del documento recuperado. No se repite la subida.' });
      next();
    }, error: () => { if (this.current(generation) && this.operation === op) { this.updateArchivo(entry, { estado: 'incierto', mensaje: 'La subida devolvió un ID, pero falló su recuperación. Consulte sin repetir la subida.' }); next(); } } }));
  }
  reintentarArchivos(): void {
    const op = this.operation; if (!op || this.loading() || !this.resultadoConfirmado() || !this.contextoVigente() || this.selectedDecision() !== op.decision) return;
    this.successModalAbierto.set(false); this.archivos().filter(f => f.estado === 'rechazado').forEach(f => this.updateArchivo(f, { estado: 'seleccionado' })); this.subirSiguiente(op, this.generation);
  }
  recuperarArchivo(entry: ArchivoFinal): void {
    const op = this.operation; if (!op || !this.resultadoConfirmado() || this.loading() || !this.contextoVigente() || !positiveId(entry.documentoId) || !this.archivos().includes(entry)) return;
    this.loading.set(true); this.verificarArchivo(entry, op, this.generation, () => this.finalizarArchivos());
  }
  private finalizarArchivos(): void { this.loading.set(false); this.mensaje.set(!this.archivos().length ? 'Resolución registrada y recuperada. No se seleccionaron archivos.' : this.archivos().some(f => f.estado !== 'registrado') ? 'Resolución registrada y recuperada. Hay archivos pendientes o inciertos: no se confirma una recepción documental conjunta.' : 'Resolución registrada y recuperada. Los archivos seleccionados se comprobaron por separado; no es una operación conjunta.'); this.successModalAbierto.set(true); this.docsLoaded = false; }
  cambiarTab(tab: ResolverTab): void { this.activeTab.set(tab); if (tab === 'adjuntos' && !this.docsLoaded) this.cargarDocumentos(); }
  onTabKey(event: KeyboardEvent, tab: ResolverTab): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const index = this.tabs.findIndex(t => t.id === tab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? this.tabs.length - 1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + this.tabs.length) % this.tabs.length;
    this.cambiarTab(this.tabs[next].id); this.host.nativeElement.querySelector<HTMLElement>('#final-tab-' + this.tabs[next].id)?.focus();
  }
  cargarDocumentos(): void {
    const ap = this.apelacion(); if (!ap || !this.contextoVigente() || this.loadingApelacion() || this.loadingDocuments() || this.loadError()) return;
    const generation = this.generation, groups: Omit<DocumentGroup, 'documents'>[] = [{ label: 'Apelación', relation: { apelacionId: ap.id } }];
    if (positiveId(ap.solicitudId)) groups.push({ label: 'Solicitud de origen referenciada', relation: { solicitudId: ap.solicitudId } });
    for (const [label, r] of [['Primera calificación', ap.resolucionPrimeraCalificacion], ['Segunda calificación', ap.resolucionSegundaCalificacion], ['Resolución final', this.resolucionRegistrada()]] as const) if (positiveId(r?.id)) groups.push({ label, relation: { resolucionId: r.id } });
    if (positiveId(ap.expedienteTtaip?.id) && ap.expedienteTtaip?.numeroExpediente === ap.expediente) groups.push({ label: 'Expediente TTAIP', relation: { expedienteTtaipId: ap.expedienteTtaip.id } });
    this.docReads.unsubscribe(); this.docReads = new Subscription(); this.documentGroups.set([]); this.documentError.set(''); this.loadingDocuments.set(true); this.previewTarget.set(null);
    this.docReads.add(forkJoin(groups.map(g => this.documentoService.listByRelation(g.relation))).subscribe({ next: values => {
      if (!this.current(generation)) return; const result = groups.map((g, i) => ({ ...g, documents: documentosRelacionados(values[i], g.relation) })); const ids = new Set<number>();
      if (result.some(g => g.documents == null || g.documents.some(d => ids.has(d.id!) || !ids.add(d.id!)))) this.documentError.set('Información documental incompleta o asociada a otro recurso. No se muestran sustitutos.');
      else { this.documentGroups.set(result as DocumentGroup[]); this.docsLoaded = true; } this.loadingDocuments.set(false);
    }, error: err => { if (this.current(generation)) { this.loadingDocuments.set(false); this.documentError.set(falloConsulta(err, 'los documentos').mensaje); } } }));
  }
  private documentoActual(doc: DocumentoMetadata): boolean { return this.contextoVigente() && this.documentGroups().some(g => g.documents.some(d => d === doc && positiveId(d.id))); }
  verDocumento(doc: DocumentoMetadata): void { if (this.documentoActual(doc)) this.previewTarget.set({ id: doc.id, nombre: doc.nombreOriginal || 'Nombre no informado', tipo: doc.contentType, expediente: this.apelacion()!.expediente }); }
  descargarDocumento(doc: DocumentoMetadata): void {
    if (!this.documentoActual(doc) || this.downloadingId() != null) return; const generation = this.generation, decision = this.selectedDecision(); this.downloadingId.set(doc.id!); this.downloadError.set('');
    this.downloads.add(this.documentoService.download(doc.id!, doc.nombreOriginal || 'documento').subscribe({ next: ({ blob, filename }) => {
      if (!this.current(generation) || this.selectedDecision() !== decision) return; this.downloadingId.set(null); const url = URL.createObjectURL(blob);
      try { const a = document.createElement('a'); a.href = url; a.download = filename; a.rel = 'noopener'; a.click(); } finally { URL.revokeObjectURL(url); }
    }, error: err => { if (this.current(generation)) { this.downloadingId.set(null); this.downloadError.set(falloConsulta(err, 'el documento').mensaje); } } }));
  }
  groupId(g: DocumentGroup): string { const [key, id] = Object.entries(g.relation)[0]; return 'final-docs-' + key + '-' + id; }
  groupOpen(label: string): boolean { return !!this.documentSearch().trim() || !!this.documentFilter() || !this.closedGroups()[label]; }
  toggleGroup(label: string): void { if (!this.documentSearch().trim() && !this.documentFilter()) this.closedGroups.update(g => ({ ...g, [label]: !g[label] })); }
  getEstadoDisplay(value: string | undefined | null): string { return value?.replaceAll('_', ' ') || 'No informado'; }
  fechaVisible(value: unknown): string | null { return fechaRegistrada(value) ? value : null; }
  getInitials(name: string | undefined | null): string { return name?.trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase() || '—'; }
  getDecisionLabel(decision: string | null): string { return this.options.find(o => o.id === decision)?.label || 'No seleccionada'; }
  resolucionConfirmSummary(): ReferenceConfirmSummary[] { return [{ label: 'Expediente', value: this.apelacion()?.expediente || '—', mono: true }, { label: 'Admisión · ID', value: this.admision()?.id?.toString() || 'No identificada', mono: true }, { label: 'Decisión', value: this.getDecisionLabel(this.selectedDecision()) }, { label: 'Fundamentos', value: this.fundamentos.trim().length + ' caracteres' }, { label: 'Archivos seleccionados · subida independiente', value: this.documentosSeleccionados().length.toString() }]; }
  resolucionWarning(): ReferenceConfirmWarning { return { label: 'Registro y documentos son operaciones distintas', detail: 'El registro no acredita emisión formal, firma, entrega, notificación eficaz ni cumplimiento. Los archivos se suben después; sus errores no revierten la decisión. No repita la decisión para reintentar archivos.' }; }
  resolucionSuccessTone(): ReferenceSuccessTone { return this.archivos().some(f => f.estado !== 'registrado') ? 'warning' : 'brand'; }
  resolucionSuccessTitle(): string { return this.resultadoConfirmado() ? 'Resolución registrada y recuperada' : 'Resolución consultada'; }
  resolucionPlazoDias(): number | null { return null; }
  resolucionPlazoDescripcion(): string { return ''; }
  resolucionSuccessMetadata(): ReferenceSuccessMeta[] { const r = this.resolucionRegistrada(); return [{ label: 'Resolución · ID', value: r?.id?.toString() || 'No informado', mono: true }, { label: 'Decisión registrada', value: r?.decision || 'No informada' }, { label: 'Fecha registrada', value: r?.fechaResolucion || 'No informada' }, { label: 'Archivos comprobados por separado', value: this.archivos().filter(f => f.estado === 'registrado').length + ' de ' + this.archivos().length }]; }
  resolucionNextSteps(): ReferenceSuccessNextStep[] { return [{ label: 'Consulte los documentos y la evidencia de notificación de esta resolución en el expediente.' }, { label: 'Registro no equivale a entrega, firma ni cumplimiento. La base acreditada del plazo de cumplimiento continúa pendiente; no se calcula aquí.' }]; }
  verResolucionRegistrada(): void { if (this.contextoVigente() && this.resolucionRegistrada() && !this.loadError()) this.successModalAbierto.set(true); }
  cerrarResultado(): void { const generation = this.generation; this.successModalAbierto.set(false); queueMicrotask(() => { if (this.current(generation)) this.host.nativeElement.querySelector<HTMLElement>('#final-view-record')?.focus(); }); }
  irNotificaciones(): void {
    const expediente = this.apelacion()?.expediente;
    if (expediente && this.contextoVigente()) {
      void this.router.navigate(['/ttaip/apelacion', expediente], { queryParams: { tab: 'notificaciones' } });
    }
  }
  irExpediente(): void { if (this.contextoVigente() && this.apelacion()) void this.router.navigate(['/ttaip/apelacion', this.apelacion()!.expediente]); }
  irPanelTtaip(): void { if (this.contextoVigente()) void this.router.navigate(['/ttaip'], { state: { focusStage: 'resueltos' } }); }
}
