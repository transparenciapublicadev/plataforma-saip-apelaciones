import { Apelacion } from '../../models/apelacion.model';
import { DocumentoMetadata } from '../../models/documento.model';
import { positiveId, documentosRelacionados } from './ttaip-calificar.model';
import type { NotificacionTtaip } from '../../models/resolucion.model';
import { requerimientoConsultado, segundaConsultada } from './ttaip-segunda-calificacion.model';
import { ConsultaRecepcion, motivoRecepcion } from './recepcion-institucional.model';
type EficaciaConsultada = Partial<Pick<NotificacionTtaip, 'id' | 'estado' | 'resultadoNotificacion' | 'validadaManualmente' | 'fechaValidacionManual' | 'responsableValidacion' | 'observacionValidacion' | 'estadoAcuse' | 'fechaAcuse' | 'acuseAutomatico' | 'medioNotificacion' | 'medio' | 'constanciaEnvio'>>;

export const finalOpciones = [
  { id: 'fundado', label: 'FUNDADO', description: 'Ampara el recurso · no acredita entrega', accent: 'var(--success)', command: 'declararFundado', decision: 'FUNDADO', estado: 'RESUELTO_FUNDADO' },
  { id: 'fundado_en_parte', label: 'FUNDADO EN PARTE', description: 'Amparo parcial · no acredita cumplimiento', accent: 'var(--gold-dark)', command: 'declararFundadoEnParte', decision: 'FUNDADO_EN_PARTE', estado: 'RESUELTO_FUNDADO_EN_PARTE' },
  { id: 'infundado', label: 'INFUNDADO', description: 'Desestima el recurso · confirma conducta', accent: 'var(--brand-700)', command: 'declararInfundado', decision: 'INFUNDADO', estado: 'RESUELTO_INFUNDADO' },
  { id: 'infundado_en_parte', label: 'INFUNDADO EN PARTE', description: 'Desestima parcialmente · confirma parte de la conducta', accent: 'var(--warning)', command: 'declararInfundadoEnParte', decision: 'INFUNDADO_EN_PARTE', estado: 'RESUELTO_INFUNDADO_EN_PARTE' },
  { id: 'improcedente', label: 'IMPROCEDENTE', description: 'Pronunciamiento de improcedencia final', accent: 'var(--muted-foreground)', command: 'declararImprocedente', decision: 'IMPROCEDENTE', estado: 'RESUELTO_IMPROCEDENTE' },
  { id: 'sustraccion_materia', label: 'CONCLUSIÓN POR SUSTRACCIÓN', description: 'Debe sustentarse la satisfacción de la pretensión', accent: 'var(--info)', command: 'declararSustraccionMateria', decision: 'CONCLUSION_SUSTRACCION_MATERIA', estado: 'CONCLUSION_SUSTRACCION_MATERIA' },
  { id: 'desistimiento', label: 'CONCLUSIÓN POR DESISTIMIENTO', description: 'Debe sustentarse el desistimiento del recurrente', accent: 'var(--muted-foreground)', command: 'declararDesistimiento', decision: 'CONCLUSION_DESISTIMIENTO', estado: 'CONCLUSION_DESISTIMIENTO' },
  { id: 'estese_a_lo_resuelto', label: 'ESTÉSE A LO RESUELTO', description: 'Requiere sustento del pronunciamiento previo', accent: 'var(--muted-foreground)', command: 'declararEsteseALoResuelto', decision: 'ESTESE_A_LO_RESUELTO', estado: 'RESUELTO_ESTESE_A_LO_RESUELTO' },
  { id: 'nulidad_del_acto', label: 'NULIDAD DEL ACTO', description: 'Sustentar el vicio y la actuación ordenada', accent: 'var(--warning)', command: 'declararNulidadDelActo', decision: 'NULIDAD_DEL_ACTO', estado: 'RESUELTO_NULIDAD_ACTO' },
] as const;
export type FinalDecision = typeof finalOpciones[number]['id'];
export type FinalSelection = FinalDecision | 'no_presentado';
export interface FinalOperacion { apelacionId: number; expediente: string; decision: FinalDecision; fundamentos: string; observaciones?: string; miembroId: number; iniciarProcesoDisciplinario?: boolean; resolucionId?: number; }
export type ArchivoEstado = 'seleccionado' | 'enviando' | 'registrado' | 'rechazado' | 'incierto';
export interface ArchivoFinal { file: File; estado: ArchivoEstado; documentoId?: number; mensaje?: string; }
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
export const fechaRegistrada = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) && Number.isFinite(Date.parse(v));
export function relacionesFinalCoherentes(ap: Apelacion): boolean {
  if (ap.expedienteTtaip && (!positiveId(ap.expedienteTtaip.id) || ap.expedienteTtaip.numeroExpediente !== ap.expediente)) return false;
  return ([['PRIMERA_CALIFICACION', ap.resolucionPrimeraCalificacion], ['SEGUNDA_CALIFICACION', ap.resolucionSegundaCalificacion], ['RESOLUCION_FINAL', ap.resolucion]] as const)
    .every(([type, r]) => r == null || (positiveId(r.id) && r.tipoResolucion === type
      && ((r as typeof r & { apelacionId?: number }).apelacionId == null || (r as typeof r & { apelacionId?: number }).apelacionId === ap.id)));
}
export function finalConsultada(ap: Apelacion | null) {
  const r = ap?.resolucion, fk = r as typeof r & { apelacionId?: number };
  return ap && positiveId(r?.id) && r?.tipoResolucion === 'RESOLUCION_FINAL'
    && finalOpciones.some(o => o.decision === r.decision) && (fk?.apelacionId == null || fk.apelacionId === ap.id) ? r : null;
}
export function admisionFinal(ap: Apelacion | null) {
  if (!ap) return null;
  const second = ap.resolucionSegundaCalificacion;
  const r = second ?? ap.resolucionPrimeraCalificacion;
  if (!positiveId(r?.id) || !['ADMISIBLE', 'ADMITIDO'].includes(r?.decision || '')) return null;
  if (second ? r?.tipoResolucion !== 'SEGUNDA_CALIFICACION' || ap.calificacionSegunda !== r.decision
    : r?.tipoResolucion !== 'PRIMERA_CALIFICACION' || ap.calificacionPrimera !== r.decision) return null;
  const extra = r as typeof r & { apelacionId?: number };
  return extra?.apelacionId == null || extra.apelacionId === ap.id ? r : null;
}
/** Nested cedulas identify the admission; structured history references mirror the existing backend guard. */
export function eficaciaAdmision(ap: Apelacion | null): string {
  const r = admisionFinal(ap), aggregate = ap?.expedienteTtaip;
  if (!r || !Array.isArray(r.cedulas) || !aggregate || !Array.isArray(aggregate.notificaciones) || !Array.isArray(aggregate.historial)) return 'Información incompleta de notificaciones';
  if (aggregate.notificaciones.some(n => !positiveId(n.id)) || new Set(aggregate.notificaciones.map(n => n.id)).size !== aggregate.notificaciones.length
    || r.cedulas.some(c => !positiveId(c.id)) || new Set(r.cedulas.map(c => c.id)).size !== r.cedulas.length) return 'Información incompleta de notificaciones';
  const history = (id: number | undefined, type: string, reference: string) => positiveId(id) && aggregate.historial!.some(h => positiveId(h.id) && h.tipoEvento === type && h.referencia === `NOTIFICACION-${id}:${reference}`);
  const effective = (n: EficaciaConsultada) => {
    if (n.resultadoNotificacion?.startsWith('ENTREGADA_POR_')) return false;
    if (n.estado === 'VALIDADA' && n.validadaManualmente === true && fechaRegistrada(n.fechaValidacionManual)
      && text(n.responsableValidacion) && text(n.observacionValidacion)) return history(n.id, 'NOTIFICACION_VALIDADA', 'VALIDACION_MANUAL');
    return n.estado === 'ENTREGADA' && n.estadoAcuse === 'ENTREGADO' && fechaRegistrada(n.fechaAcuse) && text(n.acuseAutomatico)
      && (!(n.medioNotificacion ?? n.medio)?.startsWith('CORREO') || text(n.constanciaEnvio))
      && history(n.id, 'ACUSE_NOTIFICACION_REGISTRADO', 'ACUSE:ENTREGADO');
  };
  return ['CIUDADANO', 'ENTIDAD_PUBLICA'].every(dest => aggregate.notificaciones!.some(n => n.destinatario === dest
    && r.cedulas!.some(c => c.id === n.cedulaId && c.destinatario === dest) && effective(n)))
    ? 'Ambas evidencias de eficacia consultadas' : 'No constan ambas notificaciones eficaces de esta admisión';
}
export function descargosConsultados(ap: Apelacion | null) {
  const aggregate = ap?.expedienteTtaip, values = aggregate?.descargosEntidad;
  if (!ap || !aggregate || !Array.isArray(values)) return null;
  const ids = new Set<number>();
  if (values.some(d => !positiveId(d.id) || ids.has(d.id) || !ids.add(d.id) || d.apelacionId !== ap.id
    || d.expedienteTtaipId !== aggregate.id || d.numeroExpediente !== ap.expediente || d.entidadId !== ap.entidadId
    || !['REQUERIDO', 'PRESENTADO', 'PRESENTADO_EXTEMPORANEO', 'VENCIDO_SIN_PRESENTACION', 'CANCELADO'].includes(d.estadoDescargo || ''))) return null;
  return values;
}
export function estadoDescargos(ap: Apelacion | null): string {
  const values = descargosConsultados(ap), r = admisionFinal(ap);
  if (!values || !r || !positiveId(ap?.entidadId) || !fechaRegistrada(r.fechaResolucion)) return 'Información incompleta de descargos';
  if (values.some(d => d.estadoDescargo === 'REQUERIDO')) return 'Descargos pendientes de presentación o procesamiento por el servidor';
  const concluded = values.some(d => fechaRegistrada(d.fechaRequerimiento) && d.fechaRequerimiento.slice(0, 10) >= r.fechaResolucion!.slice(0, 10)
    && (['PRESENTADO', 'PRESENTADO_EXTEMPORANEO'].includes(d.estadoDescargo || '') ? fechaRegistrada(d.fechaPresentacion) && text(d.resumenDescargo)
      : d.estadoDescargo === 'VENCIDO_SIN_PRESENTACION' && fechaRegistrada(d.fechaLimiteDescargo)));
  return concluded ? 'Presentación o vencimiento registrado por el servidor' : 'No consta un requerimiento concluido compatible con la admisión';
}
export function motivoFinal(ap: Apelacion | null, recepcion?: ConsultaRecepcion): string {
  if (!ap) return 'No se ha recuperado la apelación.';
  if (finalConsultada(ap)) return 'Ya existe una resolución final registrada. Consulte la actuación; no se permite otra.';
  if (ap.resolucion !== null || ap.resuelta !== false || ap.resultado !== null || !Array.isArray(ap.resoluciones)
    || ap.resoluciones.some(r => r.tipoResolucion === 'RESOLUCION_FINAL')) return 'Información incompleta o contradictoria de la resolución final previa.';
  if (ap.estado !== 'EN_RESOLUCION') return 'Estado incompatible con resolución final: ' + ap.estado + '.';
  const aggregate = ap.expedienteTtaip;
  if (!positiveId(aggregate?.id) || aggregate?.numeroExpediente !== ap.expediente) return 'Información incompleta del expediente TTAIP.';
  if (ap.resolucionSegundaCalificacion != null || ap.calificacionSegunda != null || ap.resoluciones.some(r => r.tipoResolucion === 'SEGUNDA_CALIFICACION')) {
    const req = requerimientoConsultado(ap);
    if (!req || !segundaConsultada(ap) || !admisionFinal(ap)) return 'Información incompleta de la segunda admisión o su requerimiento.';
    const reason = motivoRecepcion(ap, req.id!, recepcion); if (reason) return reason;
  } else if (ap.resolucionSegundaCalificacion !== null || ap.calificacionSegunda !== null || !admisionFinal(ap)) return 'Información incompleta de la admisión correspondiente.';
  if (eficaciaAdmision(ap) !== 'Ambas evidencias de eficacia consultadas') return eficaciaAdmision(ap);
  if (estadoDescargos(ap) !== 'Presentación o vencimiento registrado por el servidor') return estadoDescargos(ap);
  return '';
}
export function finalCompatible(ap: Apelacion, op: FinalOperacion): boolean {
  const r = finalConsultada(ap), option = finalOpciones.find(o => o.id === op.decision)!;
  return ap.id === op.apelacionId && ap.expediente === op.expediente && ap.estado === option.estado && ap.resultado === option.decision
    && ap.resuelta === true && !!r && r.id === op.resolucionId && r.decision === option.decision && r.fundamentos === op.fundamentos
    && r.miembroTTAIPId === op.miembroId && (op.observaciones == null || r.observaciones === op.observaciones)
    && (op.iniciarProcesoDisciplinario == null || r.iniciarProcesoDisciplinario === op.iniciarProcesoDisciplinario);
}
export function archivoCompatible(value: unknown, resolucionId: number): value is DocumentoMetadata {
  const docs = documentosRelacionados([value], { resolucionId });
  return !!docs && docs[0].tipoDocumento === 'RESOLUCION_TTAIP';
}
