import { HttpErrorResponse } from '@angular/common/http';
import { problemDetailsMessage } from './problem-details.util';

describe('problemDetailsMessage', () => {
  it('prefers the RFC 9457 detail field', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: {
        title: 'Solicitud inválida',
        detail: 'El documento no cumple el tipo permitido.'
      }
    });

    expect(problemDetailsMessage(error)).toBe('El documento no cumple el tipo permitido.');
  });

  it('maps authorization failures without exposing response internals', () => {
    const error = new HttpErrorResponse({ status: 403 });

    expect(problemDetailsMessage(error)).toBe('No tiene permisos para realizar esta acción.');
  });

  it('maps unsupported media type responses', () => {
    const error = new HttpErrorResponse({ status: 415 });

    expect(problemDetailsMessage(error)).toBe('Tipo de archivo no permitido.');
  });
});
