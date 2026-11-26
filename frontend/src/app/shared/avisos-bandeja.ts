import { PanelApelacion, PanelSolicitud } from '../models/panel-query.model';

export type IconoAviso = 'alerta' | 'bandeja' | 'balanza' | 'mazo' | 'reloj' | 'ok';

export interface Aviso {
  id: string;
  titulo: string;
  detalle: string;
  ruta: string;
  segmentos: string[];
  urgente: boolean;
  icono: IconoAviso;
  expediente?: string;
  cuando?: string;
}

const TOPE = 12;

export interface AlertasFuncionario {
  vencidas: boolean;
  proximos: boolean;
  umbralProximo: number;
}

/** Un aviso por expediente autorizado. No calcula plazos ni acredita notificación eficaz. */
export function avisosDelActor(
  rol: 'CIUDADANO' | 'FUNCIONARIO' | 'TTAIP',
  solicitudes: readonly PanelSolicitud[],
  apelaciones: readonly PanelApelacion[],
  alertas?: AlertasFuncionario,
): Aviso[] {
  const items = rol === 'CIUDADANO'
    ? [...solicitudes.map(avisoCiudadano), ...apelaciones.map(avisoApelacionCiudadano)]
    : rol === 'FUNCIONARIO'
      ? [...solicitudes.map(solicitud => avisoFuncionario(solicitud, alertas)), ...apelaciones.map(avisoApelacionFuncionario)]
      : apelaciones.map(avisoTtaip);
  const vistos = new Set<string>();
  return items
    .filter((aviso): aviso is Aviso => !!aviso && !vistos.has(aviso.id) && !!vistos.add(aviso.id))
    .sort((a, b) => (b.cuando ?? '').localeCompare(a.cuando ?? '') || Number(b.urgente) - Number(a.urgente))
    .slice(0, TOPE);
}

function avisoCiudadano(solicitud: PanelSolicitud): Aviso | null {
  const expediente = texto(solicitud.expediente);
  if (!expediente) return null;
  const detalle = linea(texto(solicitud.entidadNombre) || 'Su entidad', expediente, solicitud.fechaLimite);
  const observaciones = solicitud.observaciones ?? [];
  if (observaciones.some(item => item.estado === 'PENDIENTE_SUBSANACION')) {
    return aviso(`saip:${expediente}:precision`, 'Precisión pendiente', detalle, ['/ciudadano/precision', expediente], true);
  }
  const apelacion = solicitud.apelacion;
  const expedienteApelacion = texto(apelacion?.expediente);
  if (apelacion?.estado === 'EN_SUBSANACION' && expedienteApelacion) {
    return aviso(`apel:${expedienteApelacion}:subsanar`, 'Subsanación ante el Tribunal', detalle, ['/ciudadano/subsanacion', expedienteApelacion], true);
  }
  if (solicitud.estado === 'DENEGADA' || solicitud.respuesta?.tipoRespuesta === 'DENEGACION_TOTAL') {
    return aviso(`saip:${expediente}:denegada`, 'Solicitud denegada', `${detalle}. Revise si corresponde apelar.`, ['/ciudadano/solicitud', expediente], true);
  }
  if (solicitud.estado === 'VENCIDA') {
    return aviso(`saip:${expediente}:vencida`, 'Plazo de atención vencido', `${detalle}. Revise el expediente antes de apelar.`, ['/ciudadano/solicitud', expediente], true);
  }
  if (solicitud.estado === 'RESPONDIDA' || solicitud.respuesta?.tipoRespuesta) {
    return aviso(
      `saip:${expediente}:respuesta:${solicitud.respuesta?.tipoRespuesta || solicitud.estado}`,
      tituloRespuesta(solicitud.respuesta?.tipoRespuesta),
      detalle,
      ['/ciudadano/solicitud', expediente],
      false);
  }
  if (solicitud.encauzamientoAlcance === 'TOTAL') {
    return aviso(`saip:${expediente}:encauzada`, 'Solicitud encauzada', `${detalle}. La atención continúa en la entidad de destino.`, ['/ciudadano/solicitud', expediente], false);
  }
  if (solicitud.plazoAmpliado) {
    return aviso(`saip:${expediente}:ampliada`, 'Plazo ampliado', detalle, ['/ciudadano/solicitud', expediente], false);
  }
  if (solicitud.estado === 'RECEPCIONADA' || solicitud.estado === 'EN_REVISION' || solicitud.estado === 'PENDIENTE_INFORMACION') {
    return aviso(`saip:${expediente}:atencion`, 'Solicitud en atención', detalle, ['/ciudadano/solicitud', expediente], false);
  }
  return null;
}

function avisoApelacionCiudadano(apelacion: PanelApelacion): Aviso | null {
  const expediente = texto(apelacion.expediente);
  if (!expediente) return null;
  const detalle = linea(texto(apelacion.entidadNombre) || 'Tribunal', expediente);
  if (apelacion.estado === 'EN_SUBSANACION') {
    return aviso(`apel:${expediente}:subsanar`, 'Subsanación ante el Tribunal', detalle, ['/ciudadano/subsanacion', expediente], true, 'alerta', apelacion.fechaApelacion);
  }
  const saip = texto(apelacion.solicitudExpediente);
  if (!saip) return null;
  if (apelacion.resuelta || apelacion.estado?.startsWith('RESUELTO')) {
    return aviso(`apel:${expediente}:resuelta`, 'Resolución del Tribunal', detalle, ['/ciudadano/solicitud', saip], false, 'ok', apelacion.fechaApelacion);
  }
  if (apelacion.estado) {
    return aviso(`apel:${expediente}:tramite`, 'Su apelación sigue en el Tribunal', detalle, ['/ciudadano/solicitud', saip], false, 'balanza', apelacion.fechaApelacion);
  }
  return null;
}

function avisoFuncionario(solicitud: PanelSolicitud, alertas?: AlertasFuncionario): Aviso | null {
  const expediente = texto(solicitud.expediente);
  if (!expediente) return null;
  const detalle = linea(texto(solicitud.ciudadanoNombre) || 'Administrado', expediente, solicitud.fechaLimite);
  const observaciones = solicitud.observaciones ?? [];
  const pendiente = observaciones.some(item => item.estado === 'PENDIENTE_SUBSANACION');
  const subsanada = observaciones.some(item => item.estado === 'SUBSANADA');
  if (subsanada && !pendiente && solicitud.estado !== 'RESPONDIDA' && solicitud.estado !== 'DENEGADA') {
    return aviso(`ent:${expediente}:precision`, 'Precisión recibida', detalle, ['/funcionario/solicitud', expediente], true);
  }
  if (!solicitud.respuesta && (solicitud.estado === 'VENCIDA' || solicitud.etapa === 'san')) {
    if (alertas && !alertas.vencidas && solicitud.estado === 'VENCIDA' && solicitud.etapa !== 'san') return null;
    return aviso(`ent:${expediente}:atender`, 'Solicitud por atender', detalle, ['/funcionario/responder', expediente], true);
  }
  if (!solicitud.respuesta && (solicitud.estado === 'RECEPCIONADA' || solicitud.estado === 'EN_REVISION')) {
    const dias = solicitud.diasRestantes;
    const umbral = alertas?.umbralProximo ?? 0;
    if (alertas?.proximos && typeof dias === 'number' && dias >= 1 && dias <= umbral) {
      return aviso(`ent:${expediente}:proximo`, 'Plazo próximo', detalle, ['/funcionario/responder', expediente], true, 'reloj');
    }
    return aviso(`ent:${expediente}:tramite`, 'Solicitud en atención', detalle, ['/funcionario/responder', expediente], false);
  }
  return null;
}

function avisoApelacionFuncionario(apelacion: PanelApelacion): Aviso | null {
  const expediente = texto(apelacion.expediente);
  if (!expediente) return null;
  const detalle = linea(texto(apelacion.ciudadanoNombre) || 'Administrado', expediente);
  const ruta = ['/funcionario/apelaciones', expediente];
  if (apelacion.estado === 'PENDIENTE_ELEVACION') {
    return aviso(`apel:${expediente}:elevar`, 'Apelación por elevar', detalle, ruta, true, 'bandeja', apelacion.fechaApelacion);
  }
  if (apelacion.estado === 'EN_CUMPLIMIENTO' || apelacion.plazoCumplimiento) {
    return aviso(`apel:${expediente}:cumplir`, 'Cumplimiento de la resolución', detalle, ruta, true, 'reloj', apelacion.plazoCumplimiento?.fechaLimite);
  }
  if (apelacion.descargosPendientes) {
    return aviso(`apel:${expediente}:descargos`, 'Descargos por presentar', detalle, ruta, true, 'alerta', apelacion.fechaApelacion);
  }
  if (apelacion.informacionComplementariaPendiente) {
    return aviso(`apel:${expediente}:complemento`, 'Información complementaria pendiente', detalle, ruta, true, 'alerta', apelacion.fechaApelacion);
  }
  if (apelacion.resuelta || apelacion.estado?.startsWith('RESUELTO') || apelacion.estado === 'NOTIFICACION_RESOLUCION_FINAL') {
    return aviso(`apel:${expediente}:resuelta`, 'Resolución del Tribunal registrada', detalle, ruta, false, 'ok', apelacion.fechaApelacion);
  }
  return null;
}

function avisoTtaip(apelacion: PanelApelacion): Aviso | null {
  const expediente = texto(apelacion.expediente);
  if (!expediente) return null;
  const detalle = linea(texto(apelacion.ciudadanoNombre) || 'Administrado', expediente);
  const ruta = (segmento: string) => ['/ttaip/' + segmento, expediente];
  const cuando = apelacion.fechaApelacion;
  switch (apelacion.estado) {
    case 'EN_CALIFICACION_1':
      return apelacion.calificacionPrimera
        ? aviso(`apel:${expediente}:calificada`, 'Primera calificación registrada', detalle, ruta('apelacion'), false, 'balanza', cuando)
        : aviso(`apel:${expediente}:calificar`, 'Calificación pendiente', detalle, ruta('calificar'), true, 'balanza', cuando);
    case 'EN_SUBSANACION':
      return aviso(`apel:${expediente}:subsanacion`, 'En subsanación del administrado', detalle, ruta('apelacion'), false, 'reloj', cuando);
    case 'EN_CALIFICACION_2':
      return aviso(`apel:${expediente}:segunda`, 'Segunda calificación pendiente', detalle, ruta('segunda-calificacion'), true, 'balanza', cuando);
    case 'NOTIFICACION_SEGUNDA_CALIFICACION':
      return aviso(`apel:${expediente}:segunda-registrada`, 'Segunda calificación registrada', detalle, ruta('resolver'), true, 'mazo', cuando);
    case 'EN_RESOLUCION':
      return apelacion.actosNotificacionPendientes
        ? aviso(`apel:${expediente}:actos`, 'Actos de notificación pendientes', detalle, ruta('apelacion'), true, 'alerta', cuando)
        : aviso(`apel:${expediente}:resolver`, 'Resolución pendiente', detalle, ruta('resolver'), true, 'mazo', cuando);
    case 'EN_CUMPLIMIENTO':
      return aviso(`apel:${expediente}:cumplimiento`, 'Cumplimiento pendiente de la entidad', detalle, ruta('apelacion'), false, 'reloj', cuando);
    case 'NOTIFICACION_RESOLUCION_FINAL':
      return aviso(`apel:${expediente}:actos-final`, 'Actos de la resolución final', detalle, ruta('apelacion'), true, 'alerta', cuando);
    case 'PENDIENTE_ELEVACION':
      return aviso(`apel:${expediente}:elevacion`, 'Pendiente de elevación de la entidad', detalle, ruta('apelacion'), false, 'bandeja', cuando);
    default:
      return apelacion.actosNotificacionPendientes
        ? aviso(`apel:${expediente}:actos`, 'Actos de notificación pendientes', detalle, ruta('apelacion'), true, 'alerta', cuando)
        : null;
  }
}

function tituloRespuesta(tipo?: string): string {
  if (tipo === 'ENTREGA_TOTAL') return 'Información entregada';
  if (tipo === 'ENTREGA_PARCIAL') return 'Entrega parcial registrada';
  return 'Respuesta registrada';
}

function aviso(
  id: string, titulo: string, detalle: string, segmentos: string[], urgente: boolean,
  icono: IconoAviso = urgente ? 'alerta' : 'bandeja', cuando?: string | null,
): Aviso {
  const ruta = segmentos.length === 2 ? `${segmentos[0]}/${encodeURIComponent(segmentos[1])}` : segmentos[0];
  const expediente = segmentos.length === 2 ? segmentos[1] : undefined;
  const fecha = cuando && /^\d{4}-\d{2}-\d{2}/.test(cuando) ? cuando.slice(0, 10) : undefined;
  return { id, titulo, detalle, ruta, segmentos, urgente, icono, expediente, cuando: fecha };
}

function linea(quien: string, expediente: string, fechaLimite?: string | null): string {
  const fecha = fechaVisible(fechaLimite);
  return fecha ? `${quien} · ${expediente} · fecha límite ${fecha}` : `${quien} · ${expediente}`;
}

function fechaVisible(valor?: string | null): string {
  if (!valor || !/^\d{4}-\d{2}-\d{2}/.test(valor)) return '';
  const [anio, mes, dia] = valor.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

function texto(valor: string | null | undefined): string {
  return valor?.trim() ?? '';
}
