export const MARCADOR_SOPORTE_MAGNETICO = '[Modalidad requerida: Soportes magnéticos o digitales (CD/DVD/USB)]';

export interface ModalidadEntregaOrigen {
  formatoDigital?: boolean | null;
  formatoFisico?: boolean | null;
  copiaSimple?: boolean | null;
  copiaCertificada?: boolean | null;
  descripcion?: string | null;
}

/** Labels of the creation form, read from the flags the server stored. */
export function formatosEntregaSolicitados(solicitud: ModalidadEntregaOrigen | null | undefined): string[] {
  if (!solicitud) return [];
  const selected: string[] = [];
  if (solicitud.formatoDigital) selected.push('Correo electrónico');
  if (solicitud.copiaSimple) selected.push('Copia simple / fotocopia');
  if (solicitud.copiaCertificada) selected.push('Copia certificada');
  const magnetico = (solicitud.descripcion ?? '').includes(MARCADOR_SOPORTE_MAGNETICO)
    || (!!solicitud.formatoFisico && !solicitud.copiaSimple && !solicitud.copiaCertificada);
  if (magnetico) selected.push('Soportes magnéticos o digitales');
  return selected;
}
