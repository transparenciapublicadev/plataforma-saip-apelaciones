export const MARCADOR_SOPORTE_MAGNETICO = '[Modalidad requerida: Soportes magnéticos o digitales (CD/DVD/USB)]';
const NOTA_OFICINA = /\[Oficina destinataria:\s*[^\]]*\]/gi;
const NOTA_MODALIDAD = /\[Modalidad requerida:\s*[^\]]*\]/gi;

export const PREFIJOS_EVIDENCIA_RECOJO = ['cargo-entrega-', 'comprobante-pago-', 'dni-receptor-'] as const;

export function esEvidenciaRecojo(nombre: string | null | undefined): boolean {
  const normalizado = (nombre ?? '').trim().toLowerCase();
  return PREFIJOS_EVIDENCIA_RECOJO.some(prefijo => normalizado.startsWith(prefijo));
}

export interface ModalidadEntregaOrigen {
  formatoDigital?: boolean | null;
  formatoFisico?: boolean | null;
  copiaSimple?: boolean | null;
  copiaCertificada?: boolean | null;
  descripcion?: string | null;
}

/** Magnetic media has no column. The marker is the record; a physical request without copies uses the same reading. */
export function pideSoporteMagnetico(solicitud: ModalidadEntregaOrigen | null | undefined): boolean {
  if (!solicitud) return false;
  return (solicitud.descripcion ?? '').includes(MARCADOR_SOPORTE_MAGNETICO)
    || (!!solicitud.formatoFisico && !solicitud.copiaSimple && !solicitud.copiaCertificada);
}

export function requiereCuponReproduccion(solicitud: ModalidadEntregaOrigen | null | undefined): boolean {
  if (!solicitud) return false;
  return solicitud.copiaSimple === true || solicitud.copiaCertificada === true || pideSoporteMagnetico(solicitud);
}

/** The filing notes are stored with the description. The screen shows the citizen's own text. */
export function descripcionSinNotasInternas(descripcion: string | null | undefined): string {
  return (descripcion ?? '')
    .replace(NOTA_OFICINA, '')
    .replace(NOTA_MODALIDAD, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Labels of the creation form, read from the flags the server stored. */
export function formatosEntregaSolicitados(solicitud: ModalidadEntregaOrigen | null | undefined): string[] {
  if (!solicitud) return [];
  const selected: string[] = [];
  if (solicitud.formatoDigital) selected.push('Correo electrónico');
  if (solicitud.copiaSimple) selected.push('Copia simple / fotocopia');
  if (solicitud.copiaCertificada) selected.push('Copia certificada');
  if (pideSoporteMagnetico(solicitud)) selected.push('Soportes magnéticos o digitales');
  return selected;
}

/** Copia, soporte magnético u otro formato físico, notificado en el domicilio. */
export function entregaFisicaSinPublicacionDigital(
  solicitud: (ModalidadEntregaOrigen & { canalNotificacion?: string | null }) | null | undefined
): boolean {
  if (!solicitud) return false;
  const soporteFisico = solicitud.formatoFisico === true
    || solicitud.copiaSimple === true
    || solicitud.copiaCertificada === true
    || (solicitud.descripcion ?? '').includes(MARCADOR_SOPORTE_MAGNETICO);
  return soporteFisico && (solicitud.canalNotificacion ?? '').toUpperCase() === 'FISICA';
}
