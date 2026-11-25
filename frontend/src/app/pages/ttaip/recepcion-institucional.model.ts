import { Observable, catchError, map, of, startWith } from 'rxjs';
import type { ConsultaRecepcionSubsanacionTtaipDTO } from '../../api/types';
import { Apelacion } from '../../models/apelacion.model';
import { TtaipService } from '../../services/ttaip.service';
import { falloConsulta } from '../../utils/consulta-remota.util';
import { documentosRelacionados, positiveId } from './ttaip-calificar.model';

export type RecepcionInstitucional = ConsultaRecepcionSubsanacionTtaipDTO;
export interface ConsultaRecepcion {
  estado: 'sin-consultar' | 'cargando' | 'ausente' | 'disponible' | 'incompleto' | 'incompatible' | 'error';
  datos?: RecepcionInstitucional;
  mensaje: string;
}
export const sinConsultaRecepcion = (): ConsultaRecepcion => ({ estado: 'sin-consultar', mensaje: 'Recepción institucional pendiente de consulta.' });

export function recepcionCompatible(data: RecepcionInstitucional, ap: Apelacion, req: number): boolean {
  if (!data || data.apelacionId !== ap.id || data.requerimientoId !== req || data.expediente !== ap.expediente
    || !positiveId(ap.expedienteTtaip?.id) || data.expedienteTtaipId !== ap.expedienteTtaip.id || !Array.isArray(data.documentos)) return false;
  if (data.estado === 'AUSENTE') return data.recepcionId === null && data.fechaRecepcion === null
    && data.fundamentosAdicionales === null && data.documentos.length === 0;
  if (data.estado !== 'RECIBIDA' || !positiveId(data.recepcionId) || typeof data.fechaRecepcion !== 'string'
    || !/^\d{4}-\d{2}-\d{2}/.test(data.fechaRecepcion) || !Number.isFinite(Date.parse(data.fechaRecepcion))
    || typeof data.fundamentosAdicionales !== 'string' || !data.fundamentosAdicionales.trim()) return false;
  const docs = documentosRelacionados(data.documentos, { apelacionId: ap.id });
  return docs !== null && docs.every(doc => doc.tipoDocumento === 'SUBSANACION');
}

export function consultarRecepcionInstitucional(service: TtaipService, ap: Apelacion, req: number): Observable<ConsultaRecepcion> {
  if (!positiveId(ap.expedienteTtaip?.id) || !positiveId(req))
    return of({ estado: 'incompleto', mensaje: 'Información incompleta del expediente o del requerimiento para consultar la recepción.' });
  if (ap.expedienteTtaip.numeroExpediente !== ap.expediente)
    return of({ estado: 'incompatible', mensaje: 'El agregado no corresponde al expediente consultado.' });
  return service.consultarRecepcionSubsanacion(ap.expedienteTtaip.id, req).pipe(
    map((data): ConsultaRecepcion => {
      if (!data || !positiveId(data.apelacionId) || !positiveId(data.expedienteTtaipId) || !positiveId(data.requerimientoId)
        || typeof data.expediente !== 'string' || !Array.isArray(data.documentos)
        || !['RECIBIDA', 'AUSENTE'].includes(data.estado)
        || data.recepcionId === undefined || data.fechaRecepcion === undefined || data.fundamentosAdicionales === undefined)
        return { estado: 'incompleto', mensaje: 'La consulta no proporcionó información completa de la recepción.' };
      return recepcionCompatible(data, ap, req) ? { estado: data.estado === 'RECIBIDA' ? 'disponible' : 'ausente', datos: data,
        mensaje: data.estado === 'RECIBIDA' ? 'Recepción registrada consultada por requerimiento.' : 'No hay una subsanación presentada para este requerimiento.' }
        : { estado: 'incompatible', mensaje: 'La consulta de recepción contiene datos incompletos o relaciones incompatibles.' };
    }),
    catchError(error => of<ConsultaRecepcion>({ estado: 'error', mensaje: falloConsulta(error, 'la recepción de subsanación').mensaje })),
    startWith<ConsultaRecepcion>({ estado: 'cargando', mensaje: 'Consultando la recepción de subsanación…' }),
  );
}

export function motivoRecepcion(ap: Apelacion, req: number, consulta?: ConsultaRecepcion): string {
  return consulta?.estado === 'disponible' && consulta.datos && recepcionCompatible(consulta.datos, ap, req)
    ? '' : consulta?.mensaje || 'No se ha consultado la recepción institucional del requerimiento.';
}
