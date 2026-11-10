/* ────────────────────────────────────────────────────────────────────────────
 *  CALENDARIO OFICIAL Y PLAZOS PARAMETRIZABLES — fuente única de verdad
 *
 *  · Días hábiles: lunes a viernes, excluyendo feriados nacionales, días no
 *    laborables del sector público y suspensiones de plazos declaradas.
 *  · Feriados: base nacional (D. Leg. N.° 713 y modificatorias) + Semana Santa
 *    calculada cada año + lo que registre el administrador.
 *  · Plazos: valores del Mapa Integral (pág. 9) que el administrador puede
 *    actualizar cuando cambie la norma («los plazos operativos deben
 *    parametrizarse», Mapa pág. 9).
 * ──────────────────────────────────────────────────────────────────────── */

export type TipoInhabil = 'feriado' | 'no_laborable' | 'suspension';

export interface Feriado {
  id: string;
  nombre: string;
  tipo: TipoInhabil;
  /** true -> se repite todos los años en `mmdd`. */
  recurrente: boolean;
  /** Fecha ISO (YYYY-MM-DD) de un día único o inicio de un rango. */
  fecha?: string;
  /** Fin del rango (solo suspensiones de plazos de varios días). */
  hasta?: string;
  /** MM-DD para los feriados recurrentes. */
  mmdd?: string;
  baseLegal?: string;
  activo: boolean;
  origen: 'sistema' | 'admin';
  /** Solo suspensiones: entidades a las que se limita. Vacío = alcance nacional. */
  entidades?: { id: string; nombre: string }[];
}

export type PlazoClave =
  | 'SAIP_OBSERVACION' | 'SAIP_SUBSANACION' | 'SAIP_ATENCION' | 'SAIP_PRORROGA_COMUNICACION'
  | 'SAIP_CRONOGRAMA_UMBRAL' | 'SAIP_ENCAUZAMIENTO' | 'SAIP_LIQUIDACION_PAGO' | 'SAIP_RECOJO'
  | 'APELACION_PLAZO'
  | 'TTAIP_ELEVACION' | 'TTAIP_CALIFICACION_1' | 'TTAIP_SUBSANACION' | 'TTAIP_CALIFICACION_2'
  | 'TTAIP_DESCARGOS' | 'TTAIP_INFORME_ORAL' | 'TTAIP_INFO_COMPLEMENTARIA' | 'TTAIP_RESOLUCION'
  | 'TTAIP_CUMPLIMIENTO';

export interface PlazoMeta {
  clave: PlazoClave;
  etiqueta: string;
  descripcion: string;
  instancia: 'primera' | 'segunda';
  unidad: 'habiles' | 'calendario';
  /** legal: fijado por norma · operativo: parametrizable · umbral: límite de control. */
  naturaleza: 'legal' | 'operativo' | 'umbral';
  porDefecto: number;
  min: number;
  max: number;
  referencia: string;
  aplicaEn: string;
}

export interface Tarifas {
  /** Copia simple por folio (S/). */
  copiaSimple: number;
  /** Copia certificada por folio (S/). */
  copiaCertificada: number;
  /** Soporte digital (CD/DVD/USB) por unidad (S/). */
  soporteDigital: number;
}

export interface CambioCalendario {
  fecha: string;
  usuario?: string;
  detalle: string;
  norma?: string;
}

export interface CalendarioConfig {
  version: 1;
  feriados: Feriado[];
  /** Calcula Jueves y Viernes Santo de cada año automáticamente. */
  semanaSanta: boolean;
  plazos: Partial<Record<PlazoClave, number>>;
  tarifas: Tarifas;
  historial: CambioCalendario[];
  actualizado?: { fecha: string; usuario?: string };
}

/* ── Catálogo de plazos (Mapa Integral SAIP-TTAIP, pág. 1-9) ───────────── */
export const PLAZOS_META: PlazoMeta[] = [
  // Primera instancia (entidad)
  {
    clave: 'SAIP_OBSERVACION',
    etiqueta: 'Observación de requisitos',
    instancia: 'primera',
    unidad: 'habiles',
    naturaleza: 'legal',
    porDefecto: 2,
    min: 1,
    max: 10,
    descripcion: 'La entidad observa la SAIP desde el día siguiente de recibida. Si no la observa, opera la admisión automática a trámite.',
    referencia: 'Mapa Integral pág. 2 · D.S. N.° 007-2024-JUS',
    aplicaEn: 'Admisión automática y bandeja de la entidad'
  },
  {
    clave: 'SAIP_SUBSANACION',
    etiqueta: 'Subsanación de la SAIP (administrado)',
    instancia: 'primera',
    unidad: 'habiles',
    naturaleza: 'legal',
    porDefecto: 2,
    min: 1,
    max: 10,
    descripcion: 'Se computa desde el día hábil siguiente de la notificación de la observación. Si no subsana, la SAIP se archiva.',
    referencia: 'Mapa Integral pág. 1-2',
    aplicaEn: 'Formulario de precisión y archivo automático'
  },
  {
    clave: 'SAIP_ATENCION',
    etiqueta: 'Atención de la SAIP',
    instancia: 'primera',
    unidad: 'habiles',
    naturaleza: 'legal',
    porDefecto: 10,
    min: 1,
    max: 30,
    descripcion: 'Desde el día siguiente de la presentación; se reinicia el día hábil siguiente de la subsanación. Vencido sin respuesta: silencio administrativo negativo.',
    referencia: 'Ley N.° 27806, art. 11 · Mapa pág. 2, 9',
    aplicaEn: 'Fecha límite, semáforos, silencio administrativo y reportes'
  },
  {
    clave: 'SAIP_PRORROGA_COMUNICACION',
    etiqueta: 'Comunicación de la prórroga',
    instancia: 'primera',
    unidad: 'habiles',
    naturaleza: 'legal',
    porDefecto: 2,
    min: 1,
    max: 10,
    descripcion: 'La ampliación del plazo de atención se comunica al administrado hasta este día hábil.',
    referencia: 'Mapa Integral pág. 2, 8, 9',
    aplicaEn: 'Vía «Ampliar el plazo» de la entidad'
  },
  {
    clave: 'SAIP_CRONOGRAMA_UMBRAL',
    etiqueta: 'Umbral del cronograma de entrega',
    instancia: 'primera',
    unidad: 'habiles',
    naturaleza: 'umbral',
    porDefecto: 30,
    min: 5,
    max: 120,
    descripcion: 'Si la ampliación supera este número de días hábiles, el cronograma de entregas parciales es obligatorio.',
    referencia: 'Mapa Integral pág. 2',
    aplicaEn: 'Tipo de ampliación (registrada / programada)'
  },
  {
    clave: 'SAIP_ENCAUZAMIENTO',
    etiqueta: 'Encauzamiento a la entidad competente',
    instancia: 'primera',
    unidad: 'habiles',
    naturaleza: 'legal',
    porDefecto: 4,
    min: 1,
    max: 15,
    descripcion: 'Remisión a la entidad competente y comunicación al solicitante. Después de este plazo se registra como encauzamiento extemporáneo.',
    referencia: 'Mapa Integral pág. 2, 9',
    aplicaEn: 'Resultado temporal del encauzamiento'
  },
  {
    clave: 'SAIP_LIQUIDACION_PAGO',
    etiqueta: 'Acreditación del pago de la liquidación',
    instancia: 'primera',
    unidad: 'calendario',
    naturaleza: 'legal',
    porDefecto: 30,
    min: 1,
    max: 90,
    descripcion: 'Desde el día siguiente de la notificación de la liquidación. Vencido sin pago, se archiva por falta de acreditación de pago.',
    referencia: 'Mapa Integral pág. 3, 9',
    aplicaEn: 'Cupón de pago y archivo automático'
  },
  {
    clave: 'SAIP_RECOJO',
    etiqueta: 'Recojo de la información puesta a disposición',
    instancia: 'primera',
    unidad: 'calendario',
    naturaleza: 'legal',
    porDefecto: 30,
    min: 1,
    max: 90,
    descripcion: 'Desde el día siguiente de la puesta a disposición. Vencido sin recojo, se archiva por no recojo.',
    referencia: 'Mapa Integral pág. 3, 9',
    aplicaEn: 'Fecha límite de recojo'
  },
  {
    clave: 'APELACION_PLAZO',
    etiqueta: 'Interposición de la apelación',
    instancia: 'primera',
    unidad: 'habiles',
    naturaleza: 'legal',
    porDefecto: 15,
    min: 1,
    max: 30,
    descripcion: 'Aplica a la denegatoria expresa. Ante silencio administrativo (denegatoria tácita) no existe plazo perentorio para apelar.',
    referencia: 'Mapa Integral pág. 1, 4, 9',
    aplicaEn: 'Caducidad del derecho a apelar'
  },

  // Segunda instancia (TTAIP)
  {
    clave: 'TTAIP_ELEVACION',
    etiqueta: 'Elevación del recurso por la entidad',
    instancia: 'segunda',
    unidad: 'habiles',
    naturaleza: 'legal',
    porDefecto: 2,
    min: 1,
    max: 10,
    descripcion: 'La entidad remite el recurso presentado ante ella sin calificación previa.',
    referencia: 'Mapa Integral pág. 4',
    aplicaEn: 'Etapa «Pendiente de elevación» y bandeja de la entidad'
  },
  {
    clave: 'TTAIP_CALIFICACION_1',
    etiqueta: 'Primera calificación',
    instancia: 'segunda',
    unidad: 'habiles',
    naturaleza: 'legal',
    porDefecto: 7,
    min: 1,
    max: 30,
    descripcion: 'Todas las vías de ingreso convergen en la primera calificación del recurso.',
    referencia: 'Mapa Integral pág. 4, 9',
    aplicaEn: 'Pipeline del Tribunal y vista del administrado'
  },
  {
    clave: 'TTAIP_SUBSANACION',
    etiqueta: 'Subsanación del recurso',
    instancia: 'segunda',
    unidad: 'habiles',
    naturaleza: 'legal',
    porDefecto: 2,
    min: 1,
    max: 10,
    descripcion: 'Plazo del recurrente desde el día hábil siguiente de la notificación. Si no subsana: tener por no presentado.',
    referencia: 'Mapa Integral pág. 4, 9',
    aplicaEn: 'Subsanación ante el Tribunal'
  },
  {
    clave: 'TTAIP_CALIFICACION_2',
    etiqueta: 'Segunda calificación',
    instancia: 'segunda',
    unidad: 'habiles',
    naturaleza: 'operativo',
    porDefecto: 10,
    min: 1,
    max: 30,
    descripcion: 'Plazo operativo parametrizable: la norma no fija un segundo plazo autónomo.',
    referencia: 'Mapa Integral pág. 4, 8 (ítem 12)',
    aplicaEn: 'Pipeline del Tribunal'
  },
  {
    clave: 'TTAIP_DESCARGOS',
    etiqueta: 'Descargos de la entidad',
    instancia: 'segunda',
    unidad: 'habiles',
    naturaleza: 'legal',
    porDefecto: 7,
    min: 1,
    max: 30,
    descripcion: 'Suspende el plazo para resolver, aunque la entidad no presente descargos.',
    referencia: 'Mapa Integral pág. 1, 5, 9',
    aplicaEn: 'Traslado de descargos y regla del contador'
  },
  {
    clave: 'TTAIP_INFORME_ORAL',
    etiqueta: 'Suspensión por informe oral',
    instancia: 'segunda',
    unidad: 'habiles',
    naturaleza: 'legal',
    porDefecto: 3,
    min: 1,
    max: 15,
    descripcion: 'Solo si una de las partes solicita informe oral.',
    referencia: 'Mapa Integral pág. 5, 9',
    aplicaEn: 'Regla del contador'
  },
  {
    clave: 'TTAIP_INFO_COMPLEMENTARIA',
    etiqueta: 'Suspensión por información complementaria',
    instancia: 'segunda',
    unidad: 'habiles',
    naturaleza: 'legal',
    porDefecto: 3,
    min: 1,
    max: 15,
    descripcion: 'Solo si el Tribunal requiere información complementaria; también es el plazo por defecto del requerimiento.',
    referencia: 'Mapa Integral pág. 5, 9',
    aplicaEn: 'Regla del contador y requerimientos del Tribunal'
  },
  {
    clave: 'TTAIP_RESOLUCION',
    etiqueta: 'Resolución del recurso (días efectivos)',
    instancia: 'segunda',
    unidad: 'habiles',
    naturaleza: 'legal',
    porDefecto: 10,
    min: 1,
    max: 30,
    descripcion: 'Días hábiles efectivos: el cómputo se suspende durante descargos, informe oral e información complementaria.',
    referencia: 'Mapa Integral pág. 1, 5, 9',
    aplicaEn: 'Contador del Tribunal y reportes'
  },
  {
    clave: 'TTAIP_CUMPLIMIENTO',
    etiqueta: 'Cumplimiento de resoluciones fundadas',
    instancia: 'segunda',
    unidad: 'habiles',
    naturaleza: 'legal',
    porDefecto: 7,
    min: 1,
    max: 30,
    descripcion: 'Solo para FUNDADO y FUNDADO EN PARTE: la entidad acredita el cumplimiento de lo ordenado.',
    referencia: 'Mapa Integral pág. 5, 7, 9',
    aplicaEn: 'Seguimiento de cumplimiento'
  }
];

export const PLAZO_META_POR_CLAVE: Record<PlazoClave, PlazoMeta> = Object.fromEntries(
  PLAZOS_META.map((m) => [m.clave, m])
) as Record<PlazoClave, PlazoMeta>;

/* ── Feriados nacionales por defecto ───────────────────────────────────── */
const BASE_FERIADOS = 'D. Leg. N.° 713 y modificatorias';
const RECURRENTES: [string, string][] = [
  ['01-01', 'Año Nuevo'],
  ['05-01', 'Día del Trabajo'],
  ['06-07', 'Batalla de Arica y Día de la Bandera'],
  ['06-29', 'San Pedro y San Pablo'],
  ['07-23', 'Día de la Fuerza Aérea del Perú'],
  ['07-28', 'Fiestas Patrias'],
  ['07-29', 'Fiestas Patrias'],
  ['08-06', 'Batalla de Junín'],
  ['08-30', 'Santa Rosa de Lima'],
  ['10-08', 'Combate de Angamos'],
  ['11-01', 'Día de Todos los Santos'],
  ['12-08', 'Inmaculada Concepción'],
  ['12-09', 'Batalla de Ayacucho'],
  ['12-25', 'Navidad']
];

export function feriadosPorDefecto(): Feriado[] {
  const nacionales: Feriado[] = RECURRENTES.map(([mmdd, nombre]) => ({
    id: `nac-${mmdd}`,
    nombre,
    tipo: 'feriado',
    recurrente: true,
    mmdd,
    baseLegal: BASE_FERIADOS,
    activo: true,
    origen: 'sistema'
  }));

  const noLaborables: Feriado[] = [
    {
      id: 'nl-2026-01-02',
      nombre: 'Día no laborable para el sector público',
      tipo: 'no_laborable',
      recurrente: false,
      fecha: '2026-01-02',
      baseLegal: 'Decreto Supremo (PCM)',
      activo: true,
      origen: 'sistema'
    },
    {
      id: 'nl-2026-07-27',
      nombre: 'Día no laborable para el sector público',
      tipo: 'no_laborable',
      recurrente: false,
      fecha: '2026-07-27',
      baseLegal: 'D.S. N.° 075-2026-PCM',
      activo: true,
      origen: 'sistema'
    }
  ];

  return [...nacionales, ...noLaborables];
}

export const TARIFAS_POR_DEFECTO: Tarifas = {
  copiaSimple: 0.10,
  copiaCertificada: 0.50,
  soporteDigital: 1.00
};

export function configPorDefecto(): CalendarioConfig {
  return {
    version: 1,
    feriados: feriadosPorDefecto(),
    semanaSanta: true,
    plazos: {},
    tarifas: { ...TARIFAS_POR_DEFECTO },
    historial: []
  };
}

export function normalizarCalendario(raw?: Partial<CalendarioConfig> | null): CalendarioConfig {
  const base = configPorDefecto();
  if (!raw || typeof raw !== 'object') return base;

  const guardados = Array.isArray(raw.feriados)
    ? raw.feriados.filter((f) => f && typeof f.nombre === 'string')
    : [];
  const ids = new Set(guardados.map((f) => f.id));
  const feriados = [...guardados, ...base.feriados.filter((f) => !ids.has(f.id))];

  const plazos: Partial<Record<PlazoClave, number>> = {};
  for (const m of PLAZOS_META) {
    const v = Number((raw.plazos ?? {})[m.clave]);
    if (Number.isFinite(v) && v >= m.min && v <= m.max) {
      plazos[m.clave] = Math.round(v);
    }
  }

  const t = raw.tarifas ?? base.tarifas;
  const num = (v: unknown, d: number) =>
    Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d;

  return {
    version: 1,
    feriados,
    semanaSanta: raw.semanaSanta !== false,
    plazos,
    tarifas: {
      copiaSimple: num(t.copiaSimple, base.tarifas.copiaSimple),
      copiaCertificada: num(t.copiaCertificada, base.tarifas.copiaCertificada),
      soporteDigital: num(t.soporteDigital, base.tarifas.soporteDigital)
    },
    historial: Array.isArray(raw.historial) ? raw.historial.slice(0, 100) : [],
    actualizado: raw.actualizado
  };
}

/* ── Utilidades de fecha (ISO YYYY-MM-DD, aritmética en UTC) ───────────── */
const MS_DIA = 86400000;
const aUTC = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const deUTC = (t: number) => new Date(t).toISOString().slice(0, 10);

export function sumarDias(iso: string, n: number): string {
  return deUTC(aUTC(iso) + n * MS_DIA);
}

export function diaSemana(iso: string): number {
  return new Date(aUTC(iso)).getUTCDay();
}

export function hoyLima(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  } catch {
    return new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
  }
}

export function aISO(f?: string | null): string | null {
  if (!f) return null;
  const s = String(f).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

export function aDMY(iso?: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '—';
}

const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'
];
const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function fechaLarga(iso?: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${DIAS_LARGO[diaSemana(iso)]} ${d} de ${MESES_LARGO[m - 1]} de ${y}`;
}

export const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

/* ── Feriados de un año ─────────────────────────────────────────────────── */
export function domingoPascua(y: number): string {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export interface DiaInhabil {
  fecha: string;
  nombre: string;
  tipo: TipoInhabil;
  movil?: boolean;
  feriadoId?: string;
  baseLegal?: string;
}

export function inhabilesDelAnio(anio: number, cfg: CalendarioConfig = configPorDefecto()): DiaInhabil[] {
  const out: DiaInhabil[] = [];
  for (const f of cfg.feriados) {
    if (!f.activo) continue;
    if (f.entidades?.length) continue;
    if (f.recurrente && f.mmdd) {
      out.push({
        fecha: `${anio}-${f.mmdd}`,
        nombre: f.nombre,
        tipo: f.tipo,
        feriadoId: f.id,
        baseLegal: f.baseLegal
      });
    } else if (f.fecha) {
      const fin = f.hasta && f.hasta >= f.fecha ? f.hasta : f.fecha;
      for (let d = f.fecha, guard = 0; d <= fin && guard < 400; d = sumarDias(d, 1), guard++) {
        if (Number(d.slice(0, 4)) === anio) {
          out.push({
            fecha: d,
            nombre: f.nombre,
            tipo: f.tipo,
            feriadoId: f.id,
            baseLegal: f.baseLegal
          });
        }
      }
    }
  }

  if (cfg.semanaSanta) {
    const pascua = domingoPascua(anio);
    out.push({
      fecha: sumarDias(pascua, -3),
      nombre: 'Jueves Santo',
      tipo: 'feriado',
      movil: true,
      baseLegal: BASE_FERIADOS
    });
    out.push({
      fecha: sumarDias(pascua, -2),
      nombre: 'Viernes Santo',
      tipo: 'feriado',
      movil: true,
      baseLegal: BASE_FERIADOS
    });
  }

  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

const normEntidad = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export function esHabil(iso: string, cfg: CalendarioConfig = configPorDefecto(), entidad?: string | null): boolean {
  const dw = diaSemana(iso);
  if (dw === 0 || dw === 6) return false;

  const anio = Number(iso.slice(0, 4));
  const inhabiles = inhabilesDelAnio(anio, cfg);
  if (inhabiles.some((d) => d.fecha === iso)) return false;

  if (entidad) {
    const clave = normEntidad(entidad);
    for (const f of cfg.feriados) {
      if (!f.activo || f.tipo !== 'suspension' || !f.entidades?.length || !f.fecha) continue;
      if (!f.entidades.some((e) => normEntidad(e.id) === clave || normEntidad(e.nombre) === clave)) continue;
      const fin = f.hasta && f.hasta >= f.fecha ? f.hasta : f.fecha;
      if (iso >= f.fecha && iso <= fin) return false;
    }
  }

  return true;
}

export function siguienteHabil(iso: string, cfg: CalendarioConfig = configPorDefecto(), entidad?: string | null): string {
  let d = sumarDias(iso, 1);
  for (let g = 0; !esHabil(d, cfg, entidad) && g < 400; g++) {
    d = sumarDias(d, 1);
  }
  return d;
}

export function recepcionEfectiva(iso: string, cfg: CalendarioConfig = configPorDefecto(), entidad?: string | null): string {
  return esHabil(iso, cfg, entidad) ? iso : siguienteHabil(iso, cfg, entidad);
}

export function sumarHabiles(iso: string, n: number, cfg: CalendarioConfig = configPorDefecto(), entidad?: string | null): string {
  let d = iso;
  for (let c = 0, g = 0; c < n && g < 2000; g++) {
    d = sumarDias(d, 1);
    if (esHabil(d, cfg, entidad)) c++;
  }
  return d;
}

export function habilesEntre(desde?: string | null, hasta?: string | null, cfg: CalendarioConfig = configPorDefecto(), entidad?: string | null): number {
  if (!desde || !hasta || hasta <= desde) return 0;
  let c = 0;
  for (let d = desde, g = 0; d < hasta && g < 4000; g++) {
    d = sumarDias(d, 1);
    if (esHabil(d, cfg, entidad)) c++;
  }
  return c;
}

export interface EstadoPlazo {
  inicio: string | null;
  limite: string | null;
  transcurridos: number;
  restantes: number;
  vencido: boolean;
  venceHoy: boolean;
}

export interface FilaSAIPPlazo {
  fechaPresentacion?: string;
  fechaLimite?: string;
  precision?: { respuesta?: string; fechaRespuesta?: string; resultado?: string } | null;
  entidad?: string | null;
}

export function plazoAtencionSAIP(
  s: FilaSAIPPlazo,
  cfg: CalendarioConfig = configPorDefecto(),
  hoy = hoyLima()
): EstadoPlazo {
  const pres = aISO(s.fechaPresentacion);
  if (!pres) {
    return { inicio: null, limite: aISO(s.fechaLimite), transcurridos: 0, restantes: 0, vencido: false, venceHoy: false };
  }
  const ent = s.entidad ?? null;
  const subsanada = s.precision?.respuesta ? aISO(s.precision.fechaRespuesta) : null;
  const inicio = subsanada ?? recepcionEfectiva(pres, cfg, ent);
  const diasAtencion = cfg.plazos['SAIP_ATENCION'] ?? 10;
  const calculado = sumarHabiles(inicio, diasAtencion, cfg, ent);
  const guardado = aISO(s.fechaLimite);
  const limite = guardado && guardado > calculado ? guardado : calculado;

  return {
    inicio,
    limite,
    transcurridos: habilesEntre(inicio, hoy, cfg, ent),
    restantes: habilesEntre(hoy, limite, cfg, ent),
    vencido: hoy > limite,
    venceHoy: hoy === limite
  };
}
