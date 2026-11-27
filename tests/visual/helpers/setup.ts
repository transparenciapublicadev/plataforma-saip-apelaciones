import { Page, expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export const REF_BASE_URL = 'http://localhost:5173';
export const CAND_BASE_URL = 'http://localhost:4200';

/* ─────────────────────────────────────────────────────────────────────────────
 * Synthetic Data Fixtures for Mocking
 * ───────────────────────────────────────────────────────────────────────────── */

export const SYNTHETIC_USER = {
  ciudadano: {
    token: 'mock-jwt-ciudadano-token',
    id: 1,
    usuarioId: 1,
    ciudadanoId: 1,
    email: 'ciudadano@test.gob.pe',
    tipoUsuario: 'CIUDADANO',
    nombre: 'Daniel Mendoza',
    nombreCompleto: 'Daniel Mendoza',
    numeroDocumento: '72345678',
    dni: '72345678',
    tipoDocumento: 'DNI',
    tipoPersona: 'NATURAL' as const,
  },
  funcionario: {
    token: 'mock-jwt-funcionario-token',
    id: 2,
    usuarioId: 2,
    funcionarioId: 2,
    entidadId: 1,
    entidad: 'Organismo Supervisor de la Inversión en Energía y Minería',
    entidadNombre: 'Organismo Supervisor de la Inversión en Energía y Minería',
    email: 'funcionario@osinergmin.gob.pe',
    tipoUsuario: 'FUNCIONARIO',
    nombre: 'Carlos Alberto Huamán Torres',
    nombreCompleto: 'Carlos Alberto Huamán Torres',
    sigla: 'OSINERGMIN',
    area: 'Gerencia de Atención al Ciudadano',
  },
  ttaip: {
    token: 'mock-jwt-ttaip-token',
    id: 3,
    usuarioId: 3,
    miembroId: 3,
    email: 'ttaip@minjus.gob.pe',
    tipoUsuario: 'TTAIP',
    nombre: 'Dra. María Elena Delgado',
    nombreCompleto: 'Dra. María Elena Delgado',
    sala: 'Sala 1',
  },
  admin: {
    token: 'mock-jwt-admin-token',
    id: 4,
    usuarioId: 4,
    administradorId: 4,
    email: 'admin@saip.gob.pe',
    tipoUsuario: 'ADMINISTRADOR',
    nombre: 'Administrador General',
    nombreCompleto: 'Administrador General',
  },
};

export const SYNTHETIC_SOLICITUDES = [
  {
    id: 1,
    expediente: 'EXP-2026-0001',
    numeroExpediente: 'EXP-2026-0001',
    ciudadanoId: 1,
    entidadId: 1,
    asunto: 'Copia de contratos de concesión eléctrica 2024-2025',
    descripcion: 'Solicito copia en formato digital de los contratos y adendas suscritos con empresas distribuidoras.',
    entidad: 'Organismo Supervisor de la Inversión en Energía y Minería',
    entidadNombre: 'Organismo Supervisor de la Inversión en Energía y Minería',
    entidadSigla: 'OSINERGMIN',
    fechaPresentacion: '2026-11-08T09:00:00Z',
    fechaLimite: '2026-11-20T23:59:59Z',
    estado: 'EN_TRAMITE',
    etapa: 'EN_TRAMITE',
    diasRestantes: 9,
    diasHabilesTranscurridos: 1,
    canalEntrega: 'DIGITAL',
    formaEntrega: 'CORREO_ELECTRONICO',
    ciudadanoNombre: 'Daniel Mendoza',
    ciudadanoEmail: 'ciudadano@test.gob.pe',
    ciudadanoDni: '72345678',
    prorrogaSolicitada: false,
    subsanacionRequerida: false,
    timeline: [
      { titulo: 'Solicitud presentada', fecha: '2026-11-03', completado: true },
      { titulo: 'Revisión y admisibilidad', fecha: '2026-11-04', completado: true },
      { titulo: 'Búsqueda en áreas técnicas', fecha: '2026-11-06', completado: true },
      { titulo: 'Emisión de respuesta', fecha: '2026-11-17', completado: false },
    ],
  },
  {
    id: 2,
    expediente: 'EXP-2026-0002',
    numeroExpediente: 'EXP-2026-0002',
    ciudadanoId: 1,
    entidadId: 2,
    asunto: 'Informe de fiscalización ambiental Lote 192',
    descripcion: 'Solicitud de informe final y anexos de la supervisión ambiental realizada en el periodo 2025.',
    entidad: 'Ministerio de Energía y Minas',
    entidadNombre: 'Ministerio de Energía y Minas',
    entidadSigla: 'MINEM',
    fechaPresentacion: '2026-11-01T10:15:00Z',
    fechaLimite: '2026-11-15T23:59:59Z',
    estado: 'ENTREGA_TOTAL',
    etapa: 'ATENDIDA',
    diasRestantes: 0,
    diasHabilesTranscurridos: 10,
    canalEntrega: 'DIGITAL',
    formaEntrega: 'DESCARGA_WEB',
    ciudadanoNombre: 'Daniel Mendoza',
    ciudadanoEmail: 'ciudadano@test.gob.pe',
    ciudadanoDni: '72345678',
    prorrogaSolicitada: false,
    subsanacionRequerida: false,
  },
];

export const SYNTHETIC_APELACIONES = [
  {
    id: 1,
    expediente: 'TTAIP-2026-0001',
    numeroExpediente: 'TTAIP-2026-0001',
    saipNumeroExpediente: 'EXP-2026-0001',
    solicitudExpediente: 'EXP-2026-0001',
    solicitudId: 1,
    ciudadanoId: 1,
    entidadId: 1,
    administrado: 'Daniel Mendoza',
    ciudadanoNombre: 'Daniel Mendoza',
    entidad: 'Organismo Supervisor de la Inversión en Energía y Minería',
    entidadNombre: 'Organismo Supervisor de la Inversión en Energía y Minería',
    asunto: 'Apelación por denegatoria injustificada de información tarifaria',
    fundamentos: 'La entidad invocó indebidamente causal de reserva comercial sin acreditación fehaciente.',
    fechaPresentacion: '2026-11-05T14:30:00Z',
    fechaApelacion: '2026-11-05T14:30:00Z',
    fechaLimite: '2026-11-19T23:59:59Z',
    estado: 'EN_CALIFICACION_1',
    etapa: 'PRIMERA_CALIFICACION',
    sala: 'Sala 1',
    vocalPonente: 'Dra. María Elena Delgado',
    diasRestantes: 5,
    diasHabilesTranscurridos: 2,
  },
];

export const SYNTHETIC_ENTIDADES = [
  { id: 1, nombre: 'Organismo Supervisor de la Inversión en Energía y Minería', sigla: 'OSINERGMIN', activa: true },
  { id: 2, nombre: 'Ministerio de Salud', sigla: 'MINSA', activa: true },
  { id: 3, nombre: 'Ministerio de Educación', sigla: 'MINEDU', activa: true },
  { id: 4, nombre: 'Ministerio de Justicia y Derechos Humanos', sigla: 'MINJUS', activa: true },
  { id: 5, nombre: 'Presidencia del Consejo de Ministros', sigla: 'PCM', activa: true },
];

export const SYNTHETIC_CALENDARIO_CONFIG = {
  version: 1,
  semanaSanta: true,
  tarifas: { copiaSimple: 0.10, copiaCertificada: 0.50, soporteDigital: 1.00 },
  plazos: {
    SAIP_OBSERVACION: 2,
    SAIP_SUBSANACION: 2,
    SAIP_ATENCION: 10,
    SAIP_PRORROGA_COMUNICACION: 2,
    SAIP_CRONOGRAMA_UMBRAL: 30,
    SAIP_ENCAUZAMIENTO: 4,
    SAIP_LIQUIDACION_PAGO: 30,
    SAIP_RECOJO: 30,
    APELACION_PLAZO: 15,
    TTAIP_ELEVACION: 2,
    TTAIP_CALIFICACION_1: 7,
    TTAIP_SUBSANACION: 2,
    TTAIP_CALIFICACION_2: 10,
    TTAIP_DESCARGOS: 7,
    TTAIP_INFORME_ORAL: 3,
    TTAIP_INFO_COMPLEMENTARIA: 3,
    TTAIP_RESOLUCION: 10,
    TTAIP_CUMPLIMIENTO: 7,
  },
  feriados: [
    { id: 'nac-01-01', nombre: 'Año Nuevo', tipo: 'feriado', recurrente: true, mmdd: '01-01', activo: true, origen: 'sistema' },
    { id: 'nac-05-01', nombre: 'Día del Trabajo', tipo: 'feriado', recurrente: true, mmdd: '05-01', activo: true, origen: 'sistema' },
    { id: 'nac-07-28', nombre: 'Fiestas Patrias', tipo: 'feriado', recurrente: true, mmdd: '07-28', activo: true, origen: 'sistema' },
    { id: 'nac-07-29', nombre: 'Fiestas Patrias', tipo: 'feriado', recurrente: true, mmdd: '07-29', activo: true, origen: 'sistema' },
    { id: 'nac-12-25', nombre: 'Navidad', tipo: 'feriado', recurrente: true, mmdd: '12-25', activo: true, origen: 'sistema' },
  ],
  historial: [],
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Route Interceptors
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Intercepts any outbound Supabase requests from design-reference.
 * Prevents network calls to external cloud Supabase, fulfills requests in-memory.
 */
export async function mockSupabaseRoutes(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('saip_tour_citizen', '1');
      window.localStorage.setItem('saip_tour_entity', '1');
      window.localStorage.setItem('saip_tour_ttaip', '1');
      window.localStorage.setItem('saip_tour_admin', '1');

      const citizenAuth = JSON.stringify({
        access_token: 'mock-sb-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        user: {
          id: 'usr-1',
          email: 'ciudadano@test.gob.pe',
          user_metadata: {
            role: 'ciudadano',
            name: 'Daniel Mendoza',
            tipoAdministrado: 'natural',
            docTipo: 'DNI',
            docNumero: '72345678',
          },
        },
      });
      window.localStorage.setItem('sb-dlvnnuhtuhmrknldfotx-auth-token', citizenAuth);
      window.localStorage.setItem('sb-test-auth-token', citizenAuth);
    } catch {}
  });

  await page.route(/supabase\.co/, async (route) => {
    const url = route.request().url();

    if (url.includes('/functions/v1/make-server-29a920c7/stats')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          presentadas: 1420,
          atendidas: 1285,
          apelaciones: 340,
          resueltas: 312,
          porcentajeResueltas: 91.8,
          apelantes: 890,
          porEntidad: [
            { d: 'OSINERGMIN', v: 450 },
            { d: 'MINSA', v: 380 },
            { d: 'MINEDU', v: 310 },
            { d: 'MINJUS', v: 180 },
            { d: 'PCM', v: 100 },
          ],
          porMes: [
            { m: 'May', s: 120, a: 30 },
            { m: 'Jun', s: 140, a: 35 },
            { m: 'Jul', s: 160, a: 40 },
            { m: 'Ago', s: 180, a: 45 },
            { m: 'Set', s: 200, a: 50 },
            { m: 'Oct', s: 220, a: 55 },
          ],
        }),
      });
      return;
    }

    if (url.includes('/functions/v1/make-server-29a920c7/state')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          seeded: true,
          citizen: SYNTHETIC_SOLICITUDES.map((s) => ({
            id: s.numeroExpediente,
            asunto: s.asunto,
            ciudadano: s.ciudadanoNombre,
            dni: s.ciudadanoDni,
            email: s.ciudadanoEmail,
            entidad: s.entidad,
            fechaPresentacion: s.fechaPresentacion.slice(0, 10),
            fechaLimite: s.fechaLimite.slice(0, 10),
            estado: s.estado,
            progreso: 60,
            canalEntrega: s.canalEntrega,
            timeline: s.timeline,
          })),
          entity: SYNTHETIC_SOLICITUDES.map((s) => ({
            expediente: s.numeroExpediente,
            ciudadano: s.ciudadanoNombre,
            iniciales: 'DM',
            asunto: s.asunto,
            fechaPresentacion: s.fechaPresentacion.slice(0, 10),
            fechaLimite: s.fechaLimite.slice(0, 10),
            diasHabilesTranscurridos: s.diasHabilesTranscurridos,
            estado: s.estado,
            prioridad: 'alta',
            tema: 'Energía',
            entidad: s.entidad,
          })),
          tribunal: SYNTHETIC_APELACIONES.map((a) => ({
            expediente: a.numeroExpediente,
            saipId: a.saipNumeroExpediente,
            administrado: a.administrado,
            entidad: a.entidad,
            asunto: a.asunto,
            fechaElevacion: a.fechaPresentacion.slice(0, 10),
            fechaLimite: a.fechaLimite.slice(0, 10),
            diasHabilesTranscurridos: a.diasHabilesTranscurridos,
            estado: a.estado,
            sala: a.sala,
            vocalPonente: a.vocalPonente,
          })),
        }),
      });
      return;
    }

    if (url.includes('/functions/v1/make-server-29a920c7/catalogs')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          entidades: SYNTHETIC_ENTIDADES.map((e) => ({ id: String(e.id), nombre: e.nombre, sigla: e.sigla })),
          temas: [{ id: '1', nombre: 'Energía y Minería' }, { id: '2', nombre: 'Salud Pública' }],
          materias: [{ id: '1', nombre: 'Acceso a la información pública' }],
          vocales: [{ nombre: 'Dra. María Elena Delgado', cargo: 'Vocal Presidente' }],
        }),
      });
      return;
    }

    if (url.includes('/functions/v1/make-server-29a920c7/config')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SYNTHETIC_CALENDARIO_CONFIG),
      });
      return;
    }

    if (url.includes('/functions/v1/make-server-29a920c7/saip')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { expediente: 'EXP-2026-0001' }, expediente: 'EXP-2026-0001' }),
      });
      return;
    }

    if (url.includes('/functions/v1/make-server-29a920c7/admin/users')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          users: [
            { id: '1', nombre: 'Daniel Mendoza', email: 'ciudadano@test.gob.pe', tipo: 'Ciudadano', solicitudes: 2, solicitudesGestionadas: 0, apelacionesResueltas: 0, estado: 'Activo' },
            { id: '2', nombre: 'Carlos Alberto Huamán Torres', email: 'funcionario@osinergmin.gob.pe', tipo: 'Funcionario', entidad: 'OSINERGMIN', solicitudes: 0, solicitudesGestionadas: 15, apelacionesResueltas: 0, estado: 'Activo' },
            { id: '3', nombre: 'Dra. María Elena Delgado', email: 'ttaip@minjus.gob.pe', tipo: 'TTAIP', solicitudes: 0, solicitudesGestionadas: 0, apelacionesResueltas: 28, estado: 'Activo' },
          ],
        }),
      });
      return;
    }

    if (url.includes('/functions/v1/make-server-29a920c7/auth/resolve')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          email: 'ciudadano@test.gob.pe',
          profile: {
            email: 'ciudadano@test.gob.pe',
            name: 'Daniel Mendoza',
            role: 'ciudadano',
            tipoAdministrado: 'natural',
            docTipo: 'DNI',
            docNumero: '72345678',
          },
        }),
      });
      return;
    }

    if (url.includes('/auth/v1/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-sb-access-token',
          token_type: 'bearer',
          expires_in: 3600,
          user: {
            id: 'usr-1',
            email: 'ciudadano@test.gob.pe',
            user_metadata: {
              role: 'ciudadano',
              name: 'Daniel Mendoza',
              tipoAdministrado: 'natural',
              docTipo: 'DNI',
              docNumero: '72345678',
            },
          },
        }),
      });
      return;
    }

    // Default 200 for any other supabase route
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
}

/**
 * Pre-seeds Angular localStorage authentication state.
 */
export async function seedAngularAuth(page: Page, role: 'CIUDADANO' | 'FUNCIONARIO' | 'TTAIP' | 'ADMINISTRADOR') {
  const user =
    role === 'CIUDADANO' ? SYNTHETIC_USER.ciudadano :
    role === 'FUNCIONARIO' ? SYNTHETIC_USER.funcionario :
    role === 'TTAIP' ? SYNTHETIC_USER.ttaip :
    SYNTHETIC_USER.admin;

  await page.addInitScript((userData) => {
    try {
      window.localStorage.setItem('usuario', JSON.stringify(userData));
      window.localStorage.setItem('token', userData.token);
    } catch {}
  }, user);
}

/**
 * Mocks Angular backend REST API endpoints (`/api/*` or `http://localhost:8080/api/*`).
 */
export async function mockAngularBackendRoutes(page: Page) {
  await page.route(/\/api\//, async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/solicitudes/recepciones') && method === 'POST') {
      const postData = route.request().postData() || '';
      const getField = (name: string) => {
        const m = postData.match(new RegExp(`name="${name}"(?:\\r\\n|\\n){2}([^\r\n]+)`));
        return m ? m[1].trim() : null;
      };

      const clave = getField('claveOperacion') || 'mock-saip-op-key';
      const entidadId = Number(getField('entidadId')) || 1;
      const asunto = getField('asunto') || 'Copia de contratos de concesión eléctrica 2024-2025';
      const descripcion = getField('descripcion') || 'Solicito copia en formato digital de los contratos y adendas suscritos con empresas distribuidoras.';
      const canalNotificacion = getField('canalNotificacion') || 'CORREO_ELECTRONICO';
      const formatoDigital = getField('formatoDigital') === 'true';
      const formatoFisico = getField('formatoFisico') === 'true';
      const copiaSimple = getField('copiaSimple') === 'true';
      const copiaCertificada = getField('copiaCertificada') === 'true';
      const consentimiento = getField('consentimientoDatosPersonales') === 'true';
      const veracidad = getField('declaraVeracidad') === 'true';
      const tipoInfo = getField('tipoInformacion');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          claveOperacion: clave,
          declaraVeracidad: veracidad,
          fechaRecepcion: new Date().toISOString(),
          solicitud: {
            id: 1,
            expediente: 'EXP-2026-0001',
            ciudadanoId: 1,
            entidadId: entidadId,
            asunto: asunto,
            descripcion: descripcion,
            consentimientoDatosPersonales: consentimiento,
            canalNotificacion: canalNotificacion,
            formatoDigital: formatoDigital,
            formatoFisico: formatoFisico,
            copiaSimple: copiaSimple,
            copiaCertificada: copiaCertificada,
            tipoInformacion: tipoInfo,
          },
          documentos: [],
        }),
      });
      return;
    }

    if (url.includes('/solicitudes/consultar') || url.includes('/solicitudes/publica/expediente')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SYNTHETIC_SOLICITUDES[0]),
      });
      return;
    }

    if (url.includes('/solicitudes/expediente/EXP-2026-0001') || url.endsWith('/solicitudes/1')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SYNTHETIC_SOLICITUDES[0]),
      });
      return;
    }

    if (url.includes('/solicitudes/expediente/EXP-2026-0002') || url.endsWith('/solicitudes/2')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SYNTHETIC_SOLICITUDES[1]),
      });
      return;
    }

    if (url.includes('/panel/solicitudes') || url.includes('/solicitudes')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          contenido: SYNTHETIC_SOLICITUDES,
          content: SYNTHETIC_SOLICITUDES,
          pagina: 0,
          tamano: 10,
          totalElementos: SYNTHETIC_SOLICITUDES.length,
          totalPaginas: 1,
          totalElements: SYNTHETIC_SOLICITUDES.length,
          totalPages: 1,
          size: 10,
          number: 0,
          ultima: true,
          resumen: {
            total: SYNTHETIC_SOLICITUDES.length,
            porEstado: { EN_TRAMITE: 1, ENTREGA_TOTAL: 1 },
            porEtapa: { EN_TRAMITE: 1, ATENDIDA: 1 },
          },
          entidades: [
            { id: 1, nombre: 'Organismo Supervisor de la Inversión en Energía y Minería', total: 1 },
            { id: 2, nombre: 'Ministerio de Energía y Minas', total: 1 },
          ],
          alcance: 'CIUDADANO',
        }),
      });
      return;
    }

    if (url.includes('/panel/apelaciones') || url.includes('/apelaciones')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          contenido: SYNTHETIC_APELACIONES,
          content: SYNTHETIC_APELACIONES,
          pagina: 0,
          tamano: 10,
          totalElementos: SYNTHETIC_APELACIONES.length,
          totalPaginas: 1,
          totalElements: SYNTHETIC_APELACIONES.length,
          totalPages: 1,
          size: 10,
          number: 0,
          ultima: true,
          resumen: {
            total: SYNTHETIC_APELACIONES.length,
            porEstado: { EN_CALIFICACION_1: 1 },
            porEtapa: { PRIMERA_CALIFICACION: 1 },
          },
          entidades: [
            { id: 1, nombre: 'Organismo Supervisor de la Inversión en Energía y Minería', total: 1 },
          ],
          alcance: 'TTAIP',
        }),
      });
      return;
    }

    if (url.includes('/entidades')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SYNTHETIC_ENTIDADES),
      });
      return;
    }

    if (url.includes('/calendario') || url.includes('/configuracion')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SYNTHETIC_CALENDARIO_CONFIG),
      });
      return;
    }

    if (url.includes('/reportes')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalSolicitudes: 120,
          atendidasEnPlazo: 105,
          atendidasExtemporaneas: 10,
          pendientes: 5,
          tasaCumplimiento: 87.5,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
}

/**
 * Freezes animations, transitions, and blinking carets for deterministic snapshots.
 */
export async function freezeVisualElements(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        -moz-animation: none !important;
        -webkit-animation: none !important;
        animation: none !important;
        -moz-transition: none !important;
        -webkit-transition: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
  });
}

/**
 * Dual-Track Visual Parity Comparator
 * Compares design-reference (Port 5173) against Angular (Port 4200)
 */
export async function compareDualTrack(
  page: Page,
  options: {
    viewId: string;
    referencePath: string;
    candidatePath: string;
    role?: 'CIUDADANO' | 'FUNCIONARIO' | 'TTAIP' | 'ADMINISTRADOR';
    prepareReference?: (page: Page) => Promise<void>;
    prepareCandidate?: (page: Page) => Promise<void>;
    maxDiffPixelRatio?: number;
  }
) {
  const projectName = test.info().project.name;

  // Track A: Capture Reference Snapshot from design-reference
  const refPage = await page.context().newPage();
  await mockSupabaseRoutes(refPage);

  try {
    const refUrl = `${REF_BASE_URL}${options.referencePath}`;
    await refPage.goto(refUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Wait for main DOM content to be present and non-empty
    await refPage.waitForSelector('main, #contenido, [role="main"], header', { state: 'visible', timeout: 10000 }).catch(() => {});
    await refPage.waitForTimeout(500); // Allow framer-motion entrance transition to finish
    await freezeVisualElements(refPage);

    // Apply dark class to html if Dark project
    if (projectName.includes('Dark')) {
      await refPage.evaluate(() => document.documentElement.classList.add('dark'));
    }

    if (options.prepareReference) {
      await options.prepareReference(refPage);
    }

    // Wait a brief moment for layout settling
    await refPage.waitForTimeout(200);

    const refBuffer = await refPage.screenshot({ fullPage: false });

    // Store reference buffer as baseline snapshot for this project
    const snapshotDir = path.join(process.cwd(), 'tests', 'visual', 'snapshots', projectName);
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }
    const snapshotFile = path.join(snapshotDir, `${options.viewId}.png`);
    fs.writeFileSync(snapshotFile, refBuffer);
  } finally {
    await refPage.close();
  }

  // Track B: Capture Candidate Snapshot from Angular Frontend
  if (options.role) {
    await seedAngularAuth(page, options.role);
  }
  await mockAngularBackendRoutes(page);

  const candUrl = `${CAND_BASE_URL}${options.candidatePath}`;
  await page.goto(candUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('main, #contenido, [role="main"], app-root', { state: 'visible', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
  await freezeVisualElements(page);

  if (projectName.includes('Dark')) {
    await page.evaluate(() => document.documentElement.classList.add('dark'));
  }

  if (options.prepareCandidate) {
    await options.prepareCandidate(page);
  }

  await page.waitForTimeout(300);

  const candBuffer = await page.screenshot({ fullPage: false });

  // Compare candidate screenshot against saved reference snapshot
  expect(candBuffer).toMatchSnapshot(`${options.viewId}.png`, {
    maxDiffPixelRatio: options.maxDiffPixelRatio ?? 0.10,
  });
}
