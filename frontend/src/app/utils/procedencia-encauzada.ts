export interface ProcedenciaDocumental {
  expedienteOrigen?: string | null;
  entidadOrigen?: string | null;
}

export function procedenciaEncauzada(doc: ProcedenciaDocumental | null | undefined): string {
  const expediente = doc?.expedienteOrigen?.trim() ?? '';
  const entidad = doc?.entidadOrigen?.trim() ?? '';
  if (!expediente && !entidad) return '';
  if (expediente && entidad) return `Ante ${entidad} · ${expediente}`;
  return expediente ? `Ante ${expediente}` : `Ante ${entidad}`;
}

export function avisoDocumentosEncauzados(
  docs: readonly ProcedenciaDocumental[] | null | undefined,
  audiencia: 'ciudadano' | 'funcionario'
): string {
  const vistos = new Set<string>();
  const partes: string[] = [];
  for (const doc of docs ?? []) {
    const expediente = doc?.expedienteOrigen?.trim() ?? '';
    const entidad = doc?.entidadOrigen?.trim() ?? '';
    if (!expediente && !entidad) continue;
    const clave = `${entidad}|${expediente}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    partes.push([entidad, expediente].filter(Boolean).join(' · '));
  }
  if (partes.length === 0) return '';
  const donde = partes.join('; ');
  return audiencia === 'ciudadano'
    ? `Presentó estos documentos ante ${donde}. Se incorporaron al encauzar la solicitud. La precisión y los anexos corresponden a esa gestión, no a un pedido de esta solicitud.`
    : `El administrado presentó estos documentos ante ${donde}. Llegan con el encauzamiento. La precisión y los anexos corresponden a esa entidad, no a esta solicitud.`;
}
