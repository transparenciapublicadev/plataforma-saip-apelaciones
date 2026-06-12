import { HttpErrorResponse } from '@angular/common/http';

interface ProblemDetailsBody {
  title?: unknown;
  detail?: unknown;
  mensaje?: unknown;
}

export function problemDetailsMessage(
  error: unknown,
  fallback = 'No se pudo completar la operación.'
): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  const body = error.error as ProblemDetailsBody | string | null;
  if (typeof body === 'string' && body.trim()) {
    return body;
  }

  if (body && typeof body === 'object') {
    if (typeof body.detail === 'string' && body.detail.trim()) {
      return body.detail;
    }
    if (typeof body.title === 'string' && body.title.trim()) {
      return body.title;
    }
    if (typeof body.mensaje === 'string' && body.mensaje.trim()) {
      return body.mensaje;
    }
  }

  if (error.status === 401) {
    return 'Su sesión venció. Inicie sesión nuevamente.';
  }
  if (error.status === 403) {
    return 'No tiene permisos para realizar esta acción.';
  }
  if (error.status === 404) {
    return 'El documento solicitado no existe o ya no está disponible.';
  }
  if (error.status === 413) {
    return 'El archivo supera el tamaño permitido.';
  }
  if (error.status === 415) {
    return 'Tipo de archivo no permitido.';
  }

  return fallback;
}
