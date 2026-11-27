import { SuspensionPlazoTtaip } from '../../models/resolucion.model';

export type EstadoInformeOral =
  | 'NO_SOLICITADA'
  | 'SOLICITADA'
  | 'CONCEDIDA_PROGRAMADA'
  | 'REPROGRAMADA'
  | 'REALIZADA'
  | 'NO_REALIZADA'
  | 'DESISTIDA'
  | 'PRESCINDIDA_DENEGADA';

export type SolicitanteInformeOral = 'CIUDADANO' | 'ENTIDAD_PUBLICA' | 'AMBAS_PARTES' | 'TTAIP';

export type PlataformaVirtual = 'TEAMS' | 'MEET' | 'ZOOM' | 'SALA_MINJUS';

export interface AudienciaInformeOral {
  id?: number;
  expedienteTtaipId: number;
  numeroExpediente: string;
  estado: EstadoInformeOral;
  solicitante: SolicitanteInformeOral;
  solicitanteNombre?: string;
  motivoSolicitud: string;
  fechaSolicitud: string;

  // Datos de programación
  fechaAudiencia?: string;
  horaInicio?: string;
  horaFin?: string;
  plataforma?: PlataformaVirtual;
  enlaceVirtual?: string;
  duracionMinutosParte?: number;
  salaNombre?: string;

  // Datos de reprogramación
  motivoReprogramacion?: string;
  fechaReprogramadaAnterior?: string;

  // Datos de realización y acta
  fechaRealizacion?: string;
  asistioRecurrente?: boolean;
  letradoRecurrenteNombre?: string;
  colegiaturaLetrado?: string;
  asistioEntidad?: boolean;
  representanteEntidadNombre?: string;
  resumenAlegatos?: string;
  incidencias?: string;
  actaDocumentoId?: number;
  actaDocumentoUrl?: string;

  // Desistimiento / Prescindencia
  motivoDesistimiento?: string;
  fundamentoPrescindencia?: string;

  // Auditoría y suspensión asociada
  suspensionId?: number;
  diasSuspendidos: number;
  responsable: string;
  trazabilidad?: string;
}

export interface ProgramarAudienciaPayload {
  fechaAudiencia: string;
  horaInicio: string;
  horaFin: string;
  plataforma: PlataformaVirtual;
  enlaceVirtual: string;
  duracionMinutosParte?: number;
  salaNombre?: string;
  responsable: string;
  indicaciones?: string;
}

export interface RegistrarActaAudienciaPayload {
  asistioRecurrente: boolean;
  letradoRecurrenteNombre?: string;
  colegiaturaLetrado?: string;
  asistioEntidad: boolean;
  representanteEntidadNombre?: string;
  resumenAlegatos: string;
  incidencias?: string;
  actaDocumentoId?: number;
  responsable: string;
}

export interface ReprogramarAudienciaPayload {
  motivo: string;
  nuevaFechaAudiencia: string;
  nuevaHoraInicio: string;
  nuevaHoraFin: string;
  nuevoEnlaceVirtual: string;
  responsable: string;
}

export interface DesistirPrescindirPayload {
  motivo: string;
  responsable: string;
}

export const ESTADOS_INFORME_ORAL_CONFIG: Record<
  EstadoInformeOral,
  { label: string; tone: 'brand' | 'gold' | 'success' | 'info' | 'rose' | 'amber' | 'slate' | 'dark'; description: string }
> = {
  NO_SOLICITADA: {
    label: 'Sin solicitud de informe oral',
    tone: 'slate',
    description: 'El trámite no cuenta con solicitud de informe oral registrada.',
  },
  SOLICITADA: {
    label: 'Informe oral solicitado',
    tone: 'amber',
    description: 'Solicitud presentada pendiente de calificación y programación por la Sala.',
  },
  CONCEDIDA_PROGRAMADA: {
    label: 'Audiencia programada',
    tone: 'info',
    description: 'Audiencia virtual programada con fecha, hora y enlace oficial asignados.',
  },
  REPROGRAMADA: {
    label: 'Audiencia reprogramada',
    tone: 'amber',
    description: 'Audiencia pospuesta con nueva fecha y enlace virtual notificados.',
  },
  REALIZADA: {
    label: 'Audiencia realizada · Al voto',
    tone: 'success',
    description: 'Informe oral rendido ante el colegiado. Acta de audiencia incorporada al expediente.',
  },
  NO_REALIZADA: {
    label: 'Audiencia no realizada · Inasistencia',
    tone: 'rose',
    description: 'La parte solicitante no concurrió a la audiencia; expediente expedito para resolver.',
  },
  DESISTIDA: {
    label: 'Solicitud desistida',
    tone: 'slate',
    description: 'La parte solicitante retiró formalmente el pedido de informe oral.',
  },
  PRESCINDIDA_DENEGADA: {
    label: 'Informe oral prescindido',
    tone: 'dark',
    description: 'El Tribunal consideró innecesaria la audiencia por mérito probatorio documental suficiente.',
  },
};

export const TRANSICIONES_INFORME_ORAL: Record<EstadoInformeOral, EstadoInformeOral[]> = {
  NO_SOLICITADA: ['SOLICITADA'],
  SOLICITADA: ['CONCEDIDA_PROGRAMADA', 'DESISTIDA', 'PRESCINDIDA_DENEGADA'],
  CONCEDIDA_PROGRAMADA: ['REALIZADA', 'NO_REALIZADA', 'REPROGRAMADA', 'DESISTIDA'],
  REPROGRAMADA: ['REALIZADA', 'NO_REALIZADA', 'REPROGRAMADA', 'DESISTIDA'],
  REALIZADA: [],
  NO_REALIZADA: [],
  DESISTIDA: [],
  PRESCINDIDA_DENEGADA: []
};

export function puedeTransicionarInformeOral(actual: EstadoInformeOral, destino: EstadoInformeOral): boolean {
  const permitidas = TRANSICIONES_INFORME_ORAL[actual] || [];
  return permitidas.includes(destino);
}

export function esEstadoTerminalInformeOral(estado: EstadoInformeOral): boolean {
  return ['REALIZADA', 'NO_REALIZADA', 'DESISTIDA', 'PRESCINDIDA_DENEGADA'].includes(estado);
}

export function validarSolicitudInformeOral(solicitante: string, motivo: string, responsable: string): { valido: boolean; errores: string[] } {
  const errores: string[] = [];
  const solicitantesValidos: SolicitanteInformeOral[] = ['CIUDADANO', 'ENTIDAD_PUBLICA', 'AMBAS_PARTES', 'TTAIP'];
  if (!solicitantesValidos.includes(solicitante as SolicitanteInformeOral)) {
    errores.push('Seleccione un solicitante válido (Ciudadano, Entidad pública, Ambas partes o TTAIP).');
  }
  if (!motivo || motivo.trim().length < 8) {
    errores.push('El motivo de la solicitud debe contener al menos 8 caracteres justificativos.');
  }
  if (!responsable || !responsable.trim()) {
    errores.push('El responsable del registro es obligatorio.');
  }
  return { valido: errores.length === 0, errores };
}

export const DOMINIOS_AUDIENCIA_REGEX = /^https:\/\/(?:[a-zA-Z0-9-]+\.)*(?:teams\.microsoft\.com|teams\.live\.com|meet\.google\.com)(?:\/[^\s]*)?$/i;

export function validarProgramacionAudiencia(payload: Partial<ProgramarAudienciaPayload>): { valido: boolean; errores: string[] } {
  const errores: string[] = [];
  if (!payload.fechaAudiencia || !/^\d{4}-\d{2}-\d{2}$/.test(payload.fechaAudiencia) || Number.isNaN(Date.parse(payload.fechaAudiencia))) {
    errores.push('La fecha de la audiencia debe tener formato válido YYYY-MM-DD.');
  }
  if (!payload.horaInicio || !/^\d{2}:\d{2}$/.test(payload.horaInicio)) {
    errores.push('La hora de inicio debe tener formato HH:mm.');
  }
  if (!payload.horaFin || !/^\d{2}:\d{2}$/.test(payload.horaFin)) {
    errores.push('La hora de fin debe tener formato HH:mm.');
  }
  if (payload.horaInicio && payload.horaFin && payload.horaInicio >= payload.horaFin) {
    errores.push('La hora de fin debe ser posterior a la hora de inicio.');
  }
  const plataformas: PlataformaVirtual[] = ['TEAMS', 'MEET', 'ZOOM', 'SALA_MINJUS'];
  if (!payload.plataforma || !plataformas.includes(payload.plataforma)) {
    errores.push('Seleccione una plataforma virtual válida (Teams, Meet, Zoom o Sala MINJUS).');
  }
  if (!payload.enlaceVirtual || !DOMINIOS_AUDIENCIA_REGEX.test(payload.enlaceVirtual.trim())) {
    errores.push('El enlace virtual debe pertenecer a un dominio institucional autorizado (Teams o Google Meet) y comenzar con https://.');
  }
  if (!payload.responsable || !payload.responsable.trim()) {
    errores.push('El responsable de la programación es obligatorio.');
  }
  return { valido: errores.length === 0, errores };
}

export function validarReprogramacionAudiencia(payload: Partial<ReprogramarAudienciaPayload>): { valido: boolean; errores: string[] } {
  const errores: string[] = [];
  if (!payload.motivo || payload.motivo.trim().length < 10) {
    errores.push('El motivo de la reprogramación debe tener al menos 10 caracteres justificativos.');
  }
  if (!payload.nuevaFechaAudiencia || !/^\d{4}-\d{2}-\d{2}$/.test(payload.nuevaFechaAudiencia) || Number.isNaN(Date.parse(payload.nuevaFechaAudiencia))) {
    errores.push('La nueva fecha de la audiencia debe tener formato válido YYYY-MM-DD.');
  }
  if (!payload.nuevaHoraInicio || !/^\d{2}:\d{2}$/.test(payload.nuevaHoraInicio)) {
    errores.push('La nueva hora de inicio debe tener formato HH:mm.');
  }
  if (!payload.nuevaHoraFin || !/^\d{2}:\d{2}$/.test(payload.nuevaHoraFin)) {
    errores.push('La nueva hora de fin debe tener formato HH:mm.');
  }
  if (payload.nuevaHoraInicio && payload.nuevaHoraFin && payload.nuevaHoraInicio >= payload.nuevaHoraFin) {
    errores.push('La nueva hora de fin debe ser posterior a la nueva hora de inicio.');
  }
  if (!payload.nuevoEnlaceVirtual || !DOMINIOS_AUDIENCIA_REGEX.test(payload.nuevoEnlaceVirtual.trim())) {
    errores.push('El enlace virtual debe pertenecer a un dominio institucional autorizado (Teams o Google Meet) y comenzar con https://.');
  }
  if (!payload.responsable || !payload.responsable.trim()) {
    errores.push('El responsable de la reprogramación es obligatorio.');
  }
  return { valido: errores.length === 0, errores };
}

export function validarActaAudiencia(payload: Partial<RegistrarActaAudienciaPayload>): { valido: boolean; errores: string[] } {
  const errores: string[] = [];
  if (payload.asistioRecurrente && payload.letradoRecurrenteNombre?.trim() && (!payload.colegiaturaLetrado || !payload.colegiaturaLetrado.trim())) {
    errores.push('Si concurre letrado del recurrente, debe registrar el número de colegiatura profesional.');
  }
  if (!payload.resumenAlegatos || payload.resumenAlegatos.trim().length < 15) {
    errores.push('El resumen de alegatos orales debe contener al menos 15 caracteres con el sustento de fondo.');
  }
  if (!payload.responsable || !payload.responsable.trim()) {
    errores.push('El relator o responsable del acta es obligatorio.');
  }
  return { valido: errores.length === 0, errores };
}

export function validarDesistirPrescindir(payload: Partial<DesistirPrescindirPayload>): { valido: boolean; errores: string[] } {
  const errores: string[] = [];
  if (!payload.motivo || payload.motivo.trim().length < 10) {
    errores.push('Debe registrar el fundamento o motivo formal (mínimo 10 caracteres).');
  }
  if (!payload.responsable || !payload.responsable.trim()) {
    errores.push('El responsable es obligatorio.');
  }
  return { valido: errores.length === 0, errores };
}

export function programarAudiencia(actual: AudienciaInformeOral, payload: ProgramarAudienciaPayload): AudienciaInformeOral {
  if (!puedeTransicionarInformeOral(actual.estado, 'CONCEDIDA_PROGRAMADA')) {
    throw new Error(`No se puede programar una audiencia en estado ${actual.estado}`);
  }
  const val = validarProgramacionAudiencia(payload);
  if (!val.valido) throw new Error(val.errores.join(' '));

  return {
    ...actual,
    estado: 'CONCEDIDA_PROGRAMADA',
    fechaAudiencia: payload.fechaAudiencia,
    horaInicio: payload.horaInicio,
    horaFin: payload.horaFin,
    plataforma: payload.plataforma,
    enlaceVirtual: payload.enlaceVirtual,
    duracionMinutosParte: payload.duracionMinutosParte ?? 10,
    salaNombre: payload.salaNombre || actual.salaNombre,
    responsable: payload.responsable,
    trazabilidad: `${actual.trazabilidad ? actual.trazabilidad + ' | ' : ''}Audiencia programada para el ${payload.fechaAudiencia} (${payload.horaInicio}-${payload.horaFin}) vía ${payload.plataforma} por ${payload.responsable}.`
  };
}

export function reprogramarAudiencia(actual: AudienciaInformeOral, payload: ReprogramarAudienciaPayload): AudienciaInformeOral {
  if (!puedeTransicionarInformeOral(actual.estado, 'REPROGRAMADA')) {
    throw new Error(`No se puede reprogramar una audiencia en estado ${actual.estado}`);
  }
  const val = validarReprogramacionAudiencia(payload);
  if (!val.valido) throw new Error(val.errores.join(' '));

  return {
    ...actual,
    estado: 'REPROGRAMADA',
    fechaReprogramadaAnterior: actual.fechaAudiencia,
    motivoReprogramacion: payload.motivo,
    fechaAudiencia: payload.nuevaFechaAudiencia,
    horaInicio: payload.nuevaHoraInicio,
    horaFin: payload.nuevaHoraFin,
    enlaceVirtual: payload.nuevoEnlaceVirtual,
    responsable: payload.responsable,
    trazabilidad: `${actual.trazabilidad ? actual.trazabilidad + ' | ' : ''}Audiencia reprogramada de ${actual.fechaAudiencia ?? 'fecha anterior'} a ${payload.nuevaFechaAudiencia}: ${payload.motivo}.`
  };
}

export function registrarRealizacionAudiencia(actual: AudienciaInformeOral, payload: RegistrarActaAudienciaPayload): AudienciaInformeOral {
  if (!puedeTransicionarInformeOral(actual.estado, 'REALIZADA')) {
    throw new Error(`No se puede marcar como realizada una audiencia en estado ${actual.estado}`);
  }
  const val = validarActaAudiencia(payload);
  if (!val.valido) throw new Error(val.errores.join(' '));

  return {
    ...actual,
    estado: 'REALIZADA',
    fechaRealizacion: new Date().toISOString().slice(0, 10),
    asistioRecurrente: payload.asistioRecurrente,
    letradoRecurrenteNombre: payload.letradoRecurrenteNombre,
    colegiaturaLetrado: payload.colegiaturaLetrado,
    asistioEntidad: payload.asistioEntidad,
    representanteEntidadNombre: payload.representanteEntidadNombre,
    resumenAlegatos: payload.resumenAlegatos,
    incidencias: payload.incidencias,
    actaDocumentoId: payload.actaDocumentoId,
    responsable: payload.responsable,
    trazabilidad: `${actual.trazabilidad ? actual.trazabilidad + ' | ' : ''}Audiencia realizada. Acta suscrita y expediente al voto por ${payload.responsable}.`
  };
}

export function registrarInasistenciaAudiencia(actual: AudienciaInformeOral, motivo: string, responsable: string): AudienciaInformeOral {
  if (!puedeTransicionarInformeOral(actual.estado, 'NO_REALIZADA')) {
    throw new Error(`No se puede marcar inasistencia en estado ${actual.estado}`);
  }
  return {
    ...actual,
    estado: 'NO_REALIZADA',
    incidencias: motivo || 'Inasistencia de la parte solicitante',
    responsable,
    trazabilidad: `${actual.trazabilidad ? actual.trazabilidad + ' | ' : ''}Audiencia declarada no realizada por inasistencia. Expediente expedito para resolver.`
  };
}

export function desistirInformeOral(actual: AudienciaInformeOral, payload: DesistirPrescindirPayload): AudienciaInformeOral {
  if (!puedeTransicionarInformeOral(actual.estado, 'DESISTIDA')) {
    throw new Error(`No se puede desistir una solicitud en estado ${actual.estado}`);
  }
  const val = validarDesistirPrescindir(payload);
  if (!val.valido) throw new Error(val.errores.join(' '));

  return {
    ...actual,
    estado: 'DESISTIDA',
    motivoDesistimiento: payload.motivo,
    responsable: payload.responsable,
    trazabilidad: `${actual.trazabilidad ? actual.trazabilidad + ' | ' : ''}Solicitud desistida: ${payload.motivo}.`
  };
}

export function prescindirInformeOral(actual: AudienciaInformeOral, payload: DesistirPrescindirPayload): AudienciaInformeOral {
  if (!puedeTransicionarInformeOral(actual.estado, 'PRESCINDIDA_DENEGADA')) {
    throw new Error(`No se puede prescindir una solicitud en estado ${actual.estado}`);
  }
  const val = validarDesistirPrescindir(payload);
  if (!val.valido) throw new Error(val.errores.join(' '));

  return {
    ...actual,
    estado: 'PRESCINDIDA_DENEGADA',
    fundamentoPrescindencia: payload.motivo,
    responsable: payload.responsable,
    trazabilidad: `${actual.trazabilidad ? actual.trazabilidad + ' | ' : ''}Informe oral prescindido por Sala: ${payload.motivo}.`
  };
}

export function serializarAudienciaEnSuspension(audiencia: AudienciaInformeOral): string {
  return JSON.stringify({
    __tipo: 'AUDIENCIA_INFORME_ORAL_V1',
    audiencia
  });
}

export function deserializarAudienciaDesdeSuspension(
  suspension: SuspensionPlazoTtaip,
  fallbackExpedienteId: number,
  fallbackNumero: string
): AudienciaInformeOral {
  if (suspension.observacion && suspension.observacion.includes('"__tipo":"AUDIENCIA_INFORME_ORAL_V1"')) {
    try {
      const parsed = JSON.parse(suspension.observacion);
      if (parsed?.audiencia && parsed.audiencia.estado) {
        return {
          ...parsed.audiencia,
          suspensionId: suspension.id,
          expedienteTtaipId: suspension.expedienteTtaipId ?? fallbackExpedienteId,
          numeroExpediente: suspension.numeroExpediente ?? fallbackNumero,
          diasSuspendidos: suspension.diasSuspendidos ?? 3
        };
      }
    } catch {
      // Continuar con derivación estándar
    }
  }

  const estadoDerivado: EstadoInformeOral = suspension.estadoSuspension === 'CANCELADA' ? 'DESISTIDA' : 'SOLICITADA';
  return {
    id: suspension.id,
    suspensionId: suspension.id,
    expedienteTtaipId: suspension.expedienteTtaipId ?? fallbackExpedienteId,
    numeroExpediente: suspension.numeroExpediente ?? fallbackNumero,
    estado: estadoDerivado,
    solicitante: (suspension.solicitante as SolicitanteInformeOral) || 'CIUDADANO',
    motivoSolicitud: suspension.motivoDetalle || suspension.observacion || 'Solicitud de informe oral en apelación',
    fechaSolicitud: suspension.fechaSolicitud || suspension.fechaInicioSuspension || new Date().toISOString().slice(0, 10),
    diasSuspendidos: suspension.diasSuspendidos ?? 3,
    responsable: suspension.responsable || 'Secretaría Técnica TTAIP',
    trazabilidad: suspension.trazabilidad || undefined
  };
}

export function extraerAudienciaDeSuspensiones(
  suspensiones: SuspensionPlazoTtaip[] | undefined | null,
  expedienteTtaipId: number,
  numeroExpediente: string
): AudienciaInformeOral | null {
  if (!Array.isArray(suspensiones) || suspensiones.length === 0) return null;
  const suspensionOral = suspensiones.find(s => s.motivoSuspension === 'INFORME_ORAL');
  if (!suspensionOral) return null;
  return deserializarAudienciaDesdeSuspension(suspensionOral, expedienteTtaipId, numeroExpediente);
}
