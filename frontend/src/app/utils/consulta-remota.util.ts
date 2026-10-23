import { HttpErrorResponse } from '@angular/common/http';

export type EstadoConsulta = 'cargando' | 'disponible' | 'vacio' | 'validacion' |
  'autenticacion' | 'autorizacion' | 'inexistente' | 'servidor' | 'red' | 'error';

/** Mensajes públicos: no mostrar detalles internos ni datos de otro recurso. */
export function falloConsulta(error: unknown, recurso: string): {
  estado: EstadoConsulta; mensaje: string; reintentable: boolean;
} {
  const status = error instanceof HttpErrorResponse ? error.status : undefined;
  switch (status) {
    case 400: case 422:
      return { estado: 'validacion', mensaje: `No se pudo consultar ${recurso}: revise los datos de la solicitud.`, reintentable: false };
    case 401:
      return { estado: 'autenticacion', mensaje: 'Su sesión no es válida. Inicie sesión nuevamente.', reintentable: false };
    case 403:
      return { estado: 'autorizacion', mensaje: `No tiene permiso para acceder a ${recurso}.`, reintentable: false };
    case 404:
      return { estado: 'inexistente', mensaje: `No se encontró ${recurso}.`, reintentable: false };
    case 0:
      return { estado: 'red', mensaje: `No se pudo conectar con el servidor para consultar ${recurso}. Compruebe su conexión y reintente.`, reintentable: true };
    default:
      return status && status >= 500
        ? { estado: 'servidor', mensaje: `El servidor no pudo recuperar ${recurso}. Inténtelo nuevamente.`, reintentable: true }
        : { estado: 'error', mensaje: `No se pudo recuperar ${recurso}. Inténtelo nuevamente.`, reintentable: true };
  }
}
