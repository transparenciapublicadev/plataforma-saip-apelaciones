import { PortalMiembroTtaip } from '../../services/portal-publico.service';

export interface PublicIndicators {
  saipPresentadas: number | null; respondidas: number | null; apelaciones: number | null;
  entidades: number | null; personasApelantes: number | null; tasaResolucion: number | null;
}
export const emptyIndicators = (): PublicIndicators => ({ saipPresentadas: null, respondidas: null,
  apelaciones: null, entidades: null, personasApelantes: null, tasaResolucion: null });

const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;

// Validate the public projection without manufacturing missing values or deriving new metrics.
export function readPublicPortal(payload: unknown) {
  const raw = object(payload), metrics = object(raw['metricas']);
  const indicadores = emptyIndicators();
  for (const key of ['saipPresentadas', 'respondidas', 'apelaciones', 'entidades', 'personasApelantes'] as const) {
    indicadores[key] = count(metrics[key]);
  }
  const rate = metrics['tasaResolucion'];
  const validRate = typeof rate === 'number' && Number.isFinite(rate) && rate >= 0 && rate <= 100;
  indicadores.tasaResolucion = validRate && indicadores.saipPresentadas !== null && indicadores.saipPresentadas > 0 ? rate : null;
  let incompleto = Object.values(indicadores).slice(0, 5).some(value => value === null) || !validRate;
  function rows<T>(value: unknown, parse: (row: Record<string, unknown>) => T | null) {
    if (!Array.isArray(value)) { incompleto = true; return { datos: [] as T[], disponible: false }; }
    const parsed = value.map(row => parse(object(row)));
    const disponible = parsed.every(row => row !== null);
    if (!disponible) incompleto = true;
    return { datos: parsed.filter((row): row is T => row !== null), disponible };
  }
  const entidades = rows(raw['apelacionesPorEntidad'], row => {
    const d = text(row['etiqueta']), v = count(row['valor']);
    return d && v !== null ? { d, v } : null;
  });
  const tendencia = rows(raw['tendenciaMensual'], row => {
    const mes = count(row['mes']), m = text(row['etiqueta']);
    const s = count(row['solicitudes']), a = count(row['apelaciones']);
    return mes !== null && mes >= 1 && mes <= 12 && m && s !== null && a !== null ? { m, s, a } : null;
  });
  const ejemplos = rows(raw['ejemplosSolicitud'], row => {
    const texto = text(row['texto']);
    return texto ? { icono: text(row['icono']), texto } : null;
  });
  const memberIds = new Set<number>();
  const miembros = rows<PortalMiembroTtaip>(raw['miembrosTTAIP'], row => {
    const id = count(row['id']), nombre = text(row['nombre']);
    if (id === null || id === 0 || !nombre || memberIds.has(id)) return null;
    memberIds.add(id);
    return { id, nombre, cargo: text(row['cargo']), sala: text(row['sala']), especialidad: text(row['especialidad']),
      periodoInicio: text(row['periodoInicio']), periodoFin: text(row['periodoFin']),
      presidenteTribunal: row['presidenteTribunal'] === true };
  });
  return { indicadores, entidades, tendencia, ejemplos, miembros, incompleto };
}
