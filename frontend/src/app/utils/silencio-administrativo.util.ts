export interface SolicitudSilencioContext {
  estado?: string | null;
  diasRestantes?: number | null;
  respuesta?: {
    tipoRespuesta?: string | null;
  } | null;
}

/**
 * Regla BR-SAIP-005: si vence el plazo sin respuesta, aplica silencio administrativo.
 */
export function isSilencioAdministrativo(context: SolicitudSilencioContext | null | undefined): boolean {
  if (!context) {
    return false;
  }

  const tipoRespuesta = context.respuesta?.tipoRespuesta?.toUpperCase();
  if (tipoRespuesta === 'SILENCIO_ADMINISTRATIVO') {
    return true;
  }

  if ((context.estado ?? '').toUpperCase() === 'VENCIDA') {
    return true;
  }

  return (context.diasRestantes ?? 0) < 0;
}

/**
 * Una respuesta manual del funcionario solo procede si aún no aplica silencio
 * y no existe una respuesta registrada.
 */
export function canSendManualResponse(context: SolicitudSilencioContext | null | undefined): boolean {
  if (!context) {
    return false;
  }

  if (isSilencioAdministrativo(context)) {
    return false;
  }

  const estado = (context.estado ?? '').toUpperCase();
  if (estado !== 'RECEPCIONADA' && estado !== 'EN_REVISION') {
    return false;
  }

  return !context.respuesta?.tipoRespuesta;
}
