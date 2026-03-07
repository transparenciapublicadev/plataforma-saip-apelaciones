/**
 * ============================================================
 *  MiSAIP — Script de configuración completa de Firebase
 * ============================================================
 *
 *  Este script realiza TODO desde la terminal:
 *    1. Crea 9 usuarios en Firebase Authentication
 *    2. Siembra 9 documentos en colección `usuarios`
 *    3. Siembra 8 documentos en colección `entidades`
 *    4. Siembra 7 documentos en colección `solicitudes`
 *    5. Siembra 4 documentos en colección `apelaciones`
 *    6. Siembra documentos en colección `expedientes` (RF-EXP-01)
 *    7. Siembra documentos en colección `cedulas` (RF-NOT-01)
 *    8. Siembra 6+ documentos en colección `notificaciones`
 *
 *  Prerrequisito:
 *    - Descargar la clave privada del Service Account desde:
 *      Firebase Console > Project Settings > Service Accounts > Generate new private key
 *    - Guardar el archivo JSON descargado como:
 *      firebase-setup/service-account-key.json
 *
 *  Uso:
 *    cd firebase-setup
 *    npm install
 *    node setup-firebase.js
 *
 * ============================================================
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ─── Verificar clave de servicio ───────────────────────────
const keyPath = path.join(__dirname, 'service-account-key.json');
if (!fs.existsSync(keyPath)) {
  console.error('\n❌ ERROR: No se encontró el archivo service-account-key.json');
  console.error('');
  console.error('   Para obtenerlo:');
  console.error('   1. Ve a https://console.firebase.google.com/project/misaip/settings/serviceaccounts/adminsdk');
  console.error('   2. Click en "Generate new private key"');
  console.error('   3. Guarda el archivo descargado como:');
  console.error(`      ${keyPath}`);
  console.error('');
  process.exit(1);
}

// ─── Inicializar Firebase Admin ────────────────────────────
const serviceAccount = require(keyPath);

console.log(`   Project ID (del service account): ${serviceAccount.project_id}`);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Conectar a la base de datos con nombre 'misaipdb' (no es la default)
const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore('misaipdb');
const auth = admin.auth();

// ─── Colores para consola ──────────────────────────────────
const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function log(emoji, msg) { console.log(`  ${emoji} ${msg}`); }
function header(title) {
  console.log('');
  console.log(`${C.cyan}${C.bold}${'═'.repeat(60)}${C.reset}`);
  console.log(`${C.cyan}${C.bold}  ${title}${C.reset}`);
  console.log(`${C.cyan}${C.bold}${'═'.repeat(60)}${C.reset}`);
}

// ╔══════════════════════════════════════════════════════════╗
// ║  DATOS DE USUARIOS (Auth + Firestore)                   ║
// ╚══════════════════════════════════════════════════════════╝
const USUARIOS = [
  {
    email: '12345678@misaip.gob.pe',
    password: 'ciudadano123',
    displayName: 'Juan Carlos García Pérez',
    firestoreData: {
      tipo: 'CIUDADANO',
      nombre: 'Juan Carlos García Pérez',
      dni: '12345678',
      usuario: null,
      email: 'juan.garcia@email.com',
      telefono: '987654321',
      direccion: 'Av. Arequipa 1234, Lima',
      entidad: null,
      entidadId: null,
      cargo: null,
      estaActivo: true,
    }
  },
  {
    email: '87654321@misaip.gob.pe',
    password: 'ciudadano123',
    displayName: 'María López Ríos',
    firestoreData: {
      tipo: 'CIUDADANO',
      nombre: 'María López Ríos',
      dni: '87654321',
      usuario: null,
      email: 'maria.lopez@email.com',
      telefono: '912345678',
      direccion: 'Jr. Cusco 567, Lima',
      entidad: null,
      entidadId: null,
      cargo: null,
      estaActivo: true,
    }
  },
  {
    email: 'func_minedu@misaip.gob.pe',
    password: 'minedu123',
    displayName: 'Carlos Rodríguez',
    firestoreData: {
      tipo: 'FUNCIONARIO',
      nombre: 'Carlos Rodríguez',
      dni: '45678901',
      usuario: 'func_minedu',
      email: 'carlos.rodriguez@minedu.gob.pe',
      telefono: '(01) 615-5800 Anexo 201',
      direccion: 'Calle del Comercio 193, San Borja, Lima',
      entidad: 'Ministerio de Educación (MINEDU)',
      entidadId: 'minedu',
      cargo: 'Jefe de Transparencia',
      estaActivo: true,
    }
  },
  {
    email: 'func_minsa@misaip.gob.pe',
    password: 'minsa123',
    displayName: 'Ana Torres',
    firestoreData: {
      tipo: 'FUNCIONARIO',
      nombre: 'Ana Torres',
      dni: '56789012',
      usuario: 'func_minsa',
      email: 'ana.torres@minsa.gob.pe',
      telefono: '(01) 315-6600 Anexo 305',
      direccion: 'Av. Salaverry 801, Jesús María, Lima',
      entidad: 'Ministerio de Salud (MINSA)',
      entidadId: 'minsa',
      cargo: 'Coordinadora SAIP',
      estaActivo: true,
    }
  },
  {
    email: 'func_mef@misaip.gob.pe',
    password: 'mef123456',
    displayName: 'Luis Fernández',
    firestoreData: {
      tipo: 'FUNCIONARIO',
      nombre: 'Luis Fernández',
      dni: '67890123',
      usuario: 'func_mef',
      email: 'luis.fernandez@mef.gob.pe',
      telefono: '(01) 311-5930 Anexo 102',
      direccion: 'Jr. Junín 319, Cercado de Lima',
      entidad: 'Ministerio de Economía y Finanzas (MEF)',
      entidadId: 'mef',
      cargo: 'Jefe de Transparencia',
      estaActivo: true,
    }
  },
  {
    email: 'func_mtc@misaip.gob.pe',
    password: 'mtc123456',
    displayName: 'Patricia Vargas',
    firestoreData: {
      tipo: 'FUNCIONARIO',
      nombre: 'Patricia Vargas',
      dni: '78901234',
      usuario: 'func_mtc',
      email: 'patricia.vargas@mtc.gob.pe',
      telefono: '(01) 615-7800 Anexo 108',
      direccion: 'Jr. Zorritos 1203, Cercado de Lima',
      entidad: 'Ministerio de Transportes y Comunicaciones (MTC)',
      entidadId: 'mtc',
      cargo: 'Jefe de Transparencia',
      estaActivo: true,
    }
  },
  {
    email: 'ttaip_001@misaip.gob.pe',
    password: 'ttaip123',
    displayName: 'Dr. Roberto Mendoza',
    firestoreData: {
      tipo: 'TTAIP',
      nombre: 'Dr. Roberto Mendoza',
      dni: '34567890',
      usuario: 'ttaip_001',
      email: 'roberto.mendoza@ttaip.gob.pe',
      telefono: '(01) 204-8585 Anexo 401',
      direccion: 'Av. Abancay cdra. 5 s/n, Cercado de Lima',
      entidad: 'Tribunal de Transparencia y Acceso a la Información Pública',
      entidadId: null,
      cargo: 'Funcionario Resolutor TTAIP',
      estaActivo: true,
    }
  },
  {
    email: 'ttaip_002@misaip.gob.pe',
    password: 'ttaip123',
    displayName: 'Dra. Carmen Silva',
    firestoreData: {
      tipo: 'TTAIP',
      nombre: 'Dra. Carmen Silva',
      dni: '23456789',
      usuario: 'ttaip_002',
      email: 'carmen.silva@ttaip.gob.pe',
      telefono: '(01) 204-8585 Anexo 402',
      direccion: 'Av. Abancay cdra. 5 s/n, Cercado de Lima',
      entidad: 'Tribunal de Transparencia y Acceso a la Información Pública',
      entidadId: null,
      cargo: 'Funcionaria Calificadora TTAIP',
      estaActivo: true,
    }
  },
  {
    email: 'admin@misaip.gob.pe',
    password: 'admin12345',
    displayName: 'Administrador del Sistema',
    firestoreData: {
      tipo: 'ADMIN',
      nombre: 'Administrador del Sistema',
      dni: '00000001',
      usuario: 'admin',
      email: 'admin@misaip.gob.pe',
      telefono: '(01) 204-8585 Anexo 100',
      direccion: 'Av. Abancay cdra. 5 s/n, Cercado de Lima',
      entidad: 'Sistema SAIP Nacional',
      entidadId: null,
      cargo: 'Administrador General',
      estaActivo: true,
    }
  },
];

// ╔══════════════════════════════════════════════════════════╗
// ║  DATOS DE ENTIDADES PÚBLICAS                            ║
// ╚══════════════════════════════════════════════════════════╝
const ENTIDADES = [
  { id: 'minedu', nombre: 'Ministerio de Educación', sector: 'Educación', siglas: 'MINEDU', ruc: '20131370998', direccion: 'Calle del Comercio 193, San Borja, Lima', telefono: '(01) 615-5800', email: 'transparencia@minedu.gob.pe', sitioWeb: 'https://www.gob.pe/minedu', nivelGobierno: 'NACIONAL', activa: true },
  { id: 'minsa', nombre: 'Ministerio de Salud', sector: 'Salud', siglas: 'MINSA', ruc: '20131373237', direccion: 'Av. Salaverry 801, Jesús María, Lima', telefono: '(01) 315-6600', email: 'transparencia@minsa.gob.pe', sitioWeb: 'https://www.gob.pe/minsa', nivelGobierno: 'NACIONAL', activa: true },
  { id: 'mef', nombre: 'Ministerio de Economía y Finanzas', sector: 'Economía', siglas: 'MEF', ruc: '20131370645', direccion: 'Jr. Junín 319, Cercado de Lima', telefono: '(01) 311-5930', email: 'transparencia@mef.gob.pe', sitioWeb: 'https://www.gob.pe/mef', nivelGobierno: 'NACIONAL', activa: true },
  { id: 'mtc', nombre: 'Ministerio de Transportes y Comunicaciones', sector: 'Transportes', siglas: 'MTC', ruc: '20131379944', direccion: 'Jr. Zorritos 1203, Cercado de Lima', telefono: '(01) 615-7800', email: 'transparencia@mtc.gob.pe', sitioWeb: 'https://www.gob.pe/mtc', nivelGobierno: 'NACIONAL', activa: true },
  { id: 'mininter', nombre: 'Ministerio del Interior', sector: 'Seguridad', siglas: 'MININTER', ruc: '20131366966', direccion: 'Plaza 30 de Agosto s/n, San Isidro, Lima', telefono: '(01) 418-4030', email: 'transparencia@mininter.gob.pe', sitioWeb: 'https://www.gob.pe/mininter', nivelGobierno: 'NACIONAL', activa: true },
  { id: 'produce', nombre: 'Ministerio de la Producción', sector: 'Producción', siglas: 'PRODUCE', ruc: '20504794637', direccion: 'Calle Uno Oeste 060, San Isidro, Lima', telefono: '(01) 616-2222', email: 'transparencia@produce.gob.pe', sitioWeb: 'https://www.gob.pe/produce', nivelGobierno: 'NACIONAL', activa: true },
  { id: 'minam', nombre: 'Ministerio del Ambiente', sector: 'Ambiente', siglas: 'MINAM', ruc: '20492969658', direccion: 'Av. Antonio Miroquesada 425, Magdalena, Lima', telefono: '(01) 611-6000', email: 'transparencia@minam.gob.pe', sitioWeb: 'https://www.gob.pe/minam', nivelGobierno: 'NACIONAL', activa: true },
  { id: 'mincetur', nombre: 'Ministerio de Comercio Exterior y Turismo', sector: 'Comercio', siglas: 'MINCETUR', ruc: '20504794637', direccion: 'Calle Uno Oeste 050, San Isidro, Lima', telefono: '(01) 513-6100', email: 'transparencia@mincetur.gob.pe', sitioWeb: 'https://www.gob.pe/mincetur', nivelGobierno: 'NACIONAL', activa: true },
];

// ╔══════════════════════════════════════════════════════════╗
// ║  FUNCIONES PRINCIPALES                                  ║
// ╚══════════════════════════════════════════════════════════╝

/**
 * Paso 1: Crear usuarios en Firebase Auth y guardar sus UIDs
 */
async function crearUsuariosAuth() {
  header('PASO 1/5 — Creando usuarios en Firebase Authentication');

  const uids = {};

  for (const u of USUARIOS) {
    try {
      // Intentar obtener usuario existente
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(u.email);
        log('⚡', `${C.yellow}Ya existe:${C.reset} ${u.email} → UID: ${C.dim}${userRecord.uid}${C.reset}`);
      } catch (e) {
        if (e.code === 'auth/user-not-found') {
          userRecord = await auth.createUser({
            email: u.email,
            password: u.password,
            displayName: u.displayName,
            emailVerified: true,
          });
          log('✅', `${C.green}Creado:${C.reset} ${u.email} → UID: ${C.dim}${userRecord.uid}${C.reset}`);
        } else {
          throw e;
        }
      }

      uids[u.email] = userRecord.uid;
    } catch (err) {
      log('❌', `${C.red}Error creando ${u.email}: ${err.message}${C.reset}`);
    }
  }

  // Guardar UIDs para referencia
  const uidsPath = path.join(__dirname, 'generated-uids.json');
  fs.writeFileSync(uidsPath, JSON.stringify(uids, null, 2));
  log('💾', `UIDs guardados en ${C.cyan}generated-uids.json${C.reset}`);

  return uids;
}

/**
 * Paso 2: Sembrar colección `usuarios` en Firestore
 */
async function testFirestoreConnection() {
  header('TEST — Verificando conexión a Firestore');
  try {
    // Intentar una lectura simple para verificar conexión
    const testRef = db.collection('_test_connection').doc('ping');
    await testRef.set({ timestamp: Date.now(), test: true });
    await testRef.delete();
    log('✅', `${C.green}Conexión a Firestore OK${C.reset}`);
  } catch (err) {
    log('❌', `${C.red}No se pudo conectar a Firestore: ${err.message}${C.reset}`);
    console.error('');
    console.error('   Posibles causas:');
    console.error('   1. Firestore no tiene la API habilitada');
    console.error('   2. El service account no tiene permisos de Firestore');
    console.error('   3. La base de datos Firestore no existe en modo Native');
    console.error('');
    throw err;
  }
}

async function sembrarUsuarios(uids) {
  header('PASO 2/5 — Sembrando colección "usuarios" en Firestore');

  const now = Date.now();
  let count = 0;

  for (const u of USUARIOS) {
    const uid = uids[u.email];
    if (!uid) {
      log('⚠️', `${C.yellow}Saltando ${u.email} — no tiene UID${C.reset}`);
      continue;
    }

    await db.collection('usuarios').doc(uid).set({
      id: uid,
      ...u.firestoreData,
      fechaRegistro: now,
      ultimaModificacion: now,
    }, { merge: true });

    log('📄', `${u.firestoreData.nombre} (${u.firestoreData.tipo})`);
    count++;
  }

  log('✅', `${C.green}${count} usuarios sembrados en Firestore${C.reset}`);
  return uids;
}

/**
 * Paso 3: Sembrar colección `entidades`
 */
async function sembrarEntidades() {
  header('PASO 3/5 — Sembrando colección "entidades" en Firestore');

  const now = Date.now();

  for (const e of ENTIDADES) {
    await db.collection('entidades').doc(e.id).set({ ...e, ultimaModificacion: now }, { merge: true });
    log('🏛️', `${e.siglas} — ${e.nombre}`);
  }

  log('✅', `${C.green}${ENTIDADES.length} entidades sembradas en Firestore${C.reset}`);
}

/**
 * Paso 4: Sembrar colección `solicitudes`
 */
async function sembrarSolicitudes(uids) {
  header('PASO 4/5 — Sembrando colección "solicitudes" en Firestore');

  const uidCiudadano1 = uids['12345678@misaip.gob.pe'];
  const uidCiudadano2 = uids['87654321@misaip.gob.pe'];

  const solicitudes = [
    {
      id: 'sol_saip_00512',
      expediente: 'SAIP-2025-00512',
      tipo: 'ACCESO_INFORMACION',
      entidad: 'Ministerio de Educación (MINEDU)',
      entidadId: 'minedu',
      usuarioId: uidCiudadano1,
      solicitanteNombre: 'Juan Carlos García Pérez',
      solicitanteDni: '12345678',
      solicitanteEmail: 'juan.garcia@email.com',
      solicitanteTelefono: '987654321',
      solicitanteDireccion: 'Av. Arequipa 1234, Lima',
      asunto: 'Acceso a actas de sesiones del Consejo Nacional de Educación',
      descripcion: 'Solicito copias certificadas de las actas de sesiones ordinarias y extraordinarias del Consejo Nacional de Educación correspondientes al periodo enero-diciembre 2024.',
      fechaCreacion: 1735862400000,
      fechaLimite: 1737072000000,
      estado: 'Denegada',
      diasRestantes: 0,
      prioridad: 'ALTA',
      silencioAdministrativo: false,
      respuestaFecha: 1736553600000,
      respuestaFuncionario: 'Carlos Rodríguez',
      respuestaTipo: 'DENEGACION_TOTAL',
      respuestaFundamentacion: 'La información solicitada se encuentra clasificada como información confidencial según el artículo 17 de la Ley de Transparencia N° 27806, ya que contiene datos personales sensibles de los miembros del Consejo.',
      respuestaArchivos: [],
      timeline: [
        { fecha: 1735862400000, evento: 'Solicitud recepcionada', tipo: 'recepcion', completado: true },
        { fecha: 1735948800000, evento: 'Solicitud asignada a Carlos Rodríguez', tipo: 'asignacion', completado: true },
        { fecha: 1736208000000, evento: 'En revisión por el funcionario', tipo: 'revision', completado: true },
        { fecha: 1736553600000, evento: 'Solicitud DENEGADA - Información clasificada', tipo: 'denegacion', completado: true },
      ],
      sincronizado: true,
      pendienteSubida: false,
      ultimaModificacion: 1736553600000,
    },
    {
      id: 'sol_saip_00498',
      expediente: 'SAIP-2025-00498',
      tipo: 'ACCESO_INFORMACION',
      entidad: 'Ministerio de Economía y Finanzas (MEF)',
      entidadId: 'mef',
      usuarioId: uidCiudadano1,
      solicitanteNombre: 'Juan Carlos García Pérez',
      solicitanteDni: '12345678',
      solicitanteEmail: 'juan.garcia@email.com',
      solicitanteTelefono: '987654321',
      solicitanteDireccion: 'Av. Arequipa 1234, Lima',
      asunto: 'Presupuesto ejecutado en programas sociales 2024',
      descripcion: 'Solicito información sobre el presupuesto ejecutado en programas sociales durante el año fiscal 2024, incluyendo montos asignados y ejecutados por programa.',
      fechaCreacion: 1735603200000,
      fechaLimite: 1736812800000,
      estado: 'Respondida',
      diasRestantes: 0,
      prioridad: 'MEDIA',
      silencioAdministrativo: false,
      respuestaFecha: 1736380800000,
      respuestaFuncionario: 'Luis Fernández',
      respuestaTipo: 'ENTREGA_TOTAL',
      respuestaFundamentacion: 'Se adjunta la información solicitada sobre el presupuesto ejecutado en programas sociales 2024.',
      respuestaArchivos: ["Acta_Oct_2024.pdf", "Acta_Nov_2024.pdf", "Acta_Dic_2024.pdf", "Constancia_Entrega.pdf"],
      timeline: [
        { fecha: 1735603200000, evento: 'Solicitud recepcionada', tipo: 'recepcion', completado: true },
        { fecha: 1735689600000, evento: 'Asignada a Luis Fernández', tipo: 'asignacion', completado: true },
        { fecha: 1735948800000, evento: 'En revisión', tipo: 'revision', completado: true },
        { fecha: 1736380800000, evento: 'Información entregada - Entrega total', tipo: 'entrega', completado: true },
        { fecha: 1736380800000, evento: 'Solicitud concluida satisfactoriamente', tipo: 'conclusion', completado: true },
      ],
      sincronizado: true,
      pendienteSubida: false,
      ultimaModificacion: 1736380800000,
    },
    {
      id: 'sol_saip_00520',
      expediente: 'SAIP-2025-00520',
      tipo: 'ACCESO_INFORMACION',
      entidad: 'Ministerio de Salud (MINSA)',
      entidadId: 'minsa',
      usuarioId: uidCiudadano2,
      solicitanteNombre: 'María López Ríos',
      solicitanteDni: '87654321',
      solicitanteEmail: 'maria.lopez@email.com',
      solicitanteTelefono: '912345678',
      solicitanteDireccion: 'Jr. Cusco 567, Lima',
      asunto: 'Informe de vacunación COVID-19 por regiones 2024',
      descripcion: 'Solicito el informe estadístico de vacunación COVID-19 desglosado por regiones del Perú para el año 2024.',
      fechaCreacion: 1738886400000,
      fechaLimite: 1740096000000,
      estado: 'En Revisión',
      diasRestantes: 8,
      prioridad: 'MEDIA',
      silencioAdministrativo: false,
      respuestaFecha: null,
      respuestaFuncionario: null,
      respuestaTipo: null,
      respuestaFundamentacion: null,
      respuestaArchivos: null,
      timeline: [
        { fecha: 1738886400000, evento: 'Solicitud recepcionada', tipo: 'recepcion', completado: true },
        { fecha: 1738972800000, evento: 'Asignada a Ana Torres', tipo: 'asignacion', completado: true },
        { fecha: 1739059200000, evento: 'En revisión por la funcionaria', tipo: 'revision', completado: true },
      ],
      sincronizado: true,
      pendienteSubida: false,
      ultimaModificacion: 1739059200000,
    },
    {
      id: 'sol_saip_00505',
      expediente: 'SAIP-2025-00505',
      tipo: 'ACCESO_INFORMACION',
      entidad: 'Ministerio de Transportes y Comunicaciones (MTC)',
      entidadId: 'mtc',
      usuarioId: uidCiudadano2,
      solicitanteNombre: 'María López Ríos',
      solicitanteDni: '87654321',
      solicitanteEmail: 'maria.lopez@email.com',
      solicitanteTelefono: '912345678',
      solicitanteDireccion: 'Jr. Cusco 567, Lima',
      asunto: 'Estado de proyectos viales en la región Cusco',
      descripcion: 'Solicito información detallada sobre el avance y estado de los proyectos viales en la región Cusco para el período 2024-2025.',
      fechaCreacion: 1737504000000,
      fechaLimite: 1738713600000,
      estado: 'Vencida',
      diasRestantes: -7,
      prioridad: 'ALTA',
      silencioAdministrativo: true,
      respuestaFecha: null,
      respuestaFuncionario: null,
      respuestaTipo: null,
      respuestaFundamentacion: null,
      respuestaArchivos: null,
      timeline: [
        { fecha: 1737504000000, evento: 'Solicitud recepcionada', tipo: 'recepcion', completado: true },
        { fecha: 1737590400000, evento: 'Asignada a Patricia Vargas', tipo: 'asignacion', completado: true },
        { fecha: 1738713600000, evento: '⚠️ PLAZO VENCIDO - Sin respuesta de la entidad', tipo: 'vencimiento', completado: true },
      ],
      sincronizado: true,
      pendienteSubida: false,
      ultimaModificacion: 1738713600000,
    },
    // ─── sol_5: DENEGADA sin apelación (MINSA, ciudadano 1) ───
    {
      id: 'sol_saip_00530',
      expediente: 'SAIP-2025-00530',
      tipo: 'ACCESO_INFORMACION',
      entidad: 'Ministerio de Salud (MINSA)',
      entidadId: 'minsa',
      usuarioId: uidCiudadano1,
      solicitanteNombre: 'Juan Carlos García Pérez',
      solicitanteDni: '12345678',
      solicitanteEmail: 'juan.garcia@email.com',
      solicitanteTelefono: '987654321',
      solicitanteDireccion: 'Av. Arequipa 1234, Lima',
      asunto: 'Contratos de adquisición de equipos médicos 2024',
      descripcion: 'Solicito información sobre los contratos de adquisición de equipos médicos celebrados por el MINSA durante el año 2024, incluyendo montos, proveedores y especificaciones técnicas.',
      fechaCreacion: 1739145600000,
      fechaLimite: 1740355200000,
      estado: 'Denegada',
      diasRestantes: 0,
      prioridad: 'ALTA',
      silencioAdministrativo: false,
      respuestaFecha: 1739836800000,
      respuestaFuncionario: 'Ana Torres',
      respuestaTipo: 'DENEGACION_TOTAL',
      respuestaFundamentacion: 'La información solicitada se encuentra en etapa de investigación por la Contraloría General de la República, por lo que su divulgación podría afectar el proceso de control en curso, conforme al artículo 17 de la Ley N° 27806.',
      respuestaArchivos: [],
      timeline: [
        { fecha: 1739145600000, evento: 'Solicitud recepcionada', tipo: 'recepcion', completado: true },
        { fecha: 1739232000000, evento: 'Asignada a Ana Torres', tipo: 'asignacion', completado: true },
        { fecha: 1739491200000, evento: 'En revisión por la funcionaria', tipo: 'revision', completado: true },
        { fecha: 1739836800000, evento: 'Solicitud DENEGADA - Información bajo investigación CGR', tipo: 'denegacion', completado: true },
      ],
      sincronizado: true,
      pendienteSubida: false,
      ultimaModificacion: 1739836800000,
    },
    // ─── sol_6: RECEPCIONADA (MINEDU, ciudadano 2) ───
    {
      id: 'sol_saip_00535',
      expediente: 'SAIP-2025-00535',
      tipo: 'INFORMACION_ESPECIFICA',
      entidad: 'Ministerio de Educación (MINEDU)',
      entidadId: 'minedu',
      usuarioId: uidCiudadano2,
      solicitanteNombre: 'María López Ríos',
      solicitanteDni: '87654321',
      solicitanteEmail: 'maria.lopez@email.com',
      solicitanteTelefono: '912345678',
      solicitanteDireccion: 'Jr. Cusco 567, Lima',
      asunto: 'Estadísticas de deserción escolar 2024 por regiones',
      descripcion: 'Solicito las estadísticas oficiales de deserción escolar para el año 2024, desglosadas por región y nivel educativo (primaria, secundaria).',
      fechaCreacion: 1739750400000,
      fechaLimite: 1740960000000,
      estado: 'Recepcionada',
      diasRestantes: 9,
      prioridad: 'MEDIA',
      silencioAdministrativo: false,
      respuestaFecha: null,
      respuestaFuncionario: null,
      respuestaTipo: null,
      respuestaFundamentacion: null,
      respuestaArchivos: null,
      timeline: [
        { fecha: 1739750400000, evento: 'Solicitud recepcionada', tipo: 'recepcion', completado: true },
      ],
      sincronizado: true,
      pendienteSubida: false,
      ultimaModificacion: 1739750400000,
    },
    // ─── sol_7: VENCIDA (MININTER, ciudadano 2) ───
    {
      id: 'sol_saip_00510',
      expediente: 'SAIP-2025-00510',
      tipo: 'ACCESO_INFORMACION',
      entidad: 'Ministerio del Interior (MININTER)',
      entidadId: 'mininter',
      usuarioId: uidCiudadano2,
      solicitanteNombre: 'María López Ríos',
      solicitanteDni: '87654321',
      solicitanteEmail: 'maria.lopez@email.com',
      solicitanteTelefono: '912345678',
      solicitanteDireccion: 'Jr. Cusco 567, Lima',
      asunto: 'Estadísticas de denuncias de comisarías en Lima Metropolitana',
      descripcion: 'Solicito las estadísticas consolidadas de denuncias recibidas en las comisarías de Lima Metropolitana durante el periodo enero-diciembre 2024.',
      fechaCreacion: 1737504000000,
      fechaLimite: 1738713600000,
      estado: 'Vencida',
      diasRestantes: -5,
      prioridad: 'ALTA',
      silencioAdministrativo: true,
      respuestaFecha: null,
      respuestaFuncionario: null,
      respuestaTipo: null,
      respuestaFundamentacion: null,
      respuestaArchivos: null,
      timeline: [
        { fecha: 1737504000000, evento: 'Solicitud recepcionada', tipo: 'recepcion', completado: true },
        { fecha: 1737590400000, evento: 'Sin asignación de funcionario', tipo: 'alerta', completado: true },
        { fecha: 1738713600000, evento: '⚠️ PLAZO VENCIDO - Silencio Administrativo Negativo', tipo: 'vencimiento', completado: true },
      ],
      sincronizado: true,
      pendienteSubida: false,
      ultimaModificacion: 1738713600000,
    },
  ];

  for (const s of solicitudes) {
    await db.collection('solicitudes').doc(s.id).set(s, { merge: true });
    log('📋', `${s.expediente} — ${s.estado} (${s.entidad})`);
  }
  log('✅', `${C.green}7 solicitudes sembradas en Firestore${C.reset}`);
}

/**
 * Paso 5: Sembrar colección `apelaciones`
 */
async function sembrarApelaciones(uids) {
  header('PASO 5/7 — Sembrando colección "apelaciones"');

  const uidCiudadano1 = uids['12345678@misaip.gob.pe'];
  const uidCiudadano2 = uids['87654321@misaip.gob.pe'];
  const uidFuncMinedu = uids['func_minedu@misaip.gob.pe'];
  const uidFuncMtc = uids['func_mtc@misaip.gob.pe'];
  const uidTtaip1 = uids['ttaip_001@misaip.gob.pe'];

  // ─── Apelaciones ──────────────────────────────────────────
  const apelaciones = [
    {
      id: 'apel_ttaip_00145',
      expediente: '00145-2025-JUS/TTAIP',
      expedienteSAIP: 'SAIP-2025-00512',
      usuarioId: uidCiudadano1,
      apelanteNombre: 'Juan Carlos García Pérez',
      apelanteDni: '12345678',
      apelanteEmail: 'juan.garcia@email.com',
      entidad: 'Ministerio de Educación (MINEDU)',
      entidadId: 'minedu',
      asunto: 'Apelación contra denegación de acceso a actas del CNE',
      fundamentoLegal: 'Artículo 2, inciso 5 de la Constitución Política del Perú; Artículo 10 del TUO de la Ley N° 27806',
      exposicionHechos: 'Con fecha 03/01/2025 presenté la solicitud SAIP-2025-00512 ante el Ministerio de Educación, solicitando copias certificadas de las actas de sesiones del CNE. La entidad denegó mi solicitud alegando información confidencial.',
      pretension: 'Solicito al Tribunal de Transparencia que ordene al MINEDU la entrega de las actas de sesiones del CNE correspondientes al periodo enero-diciembre 2024.',
      fechaPresentacion: 1736985600000,
      estado: 'Resuelto - Fundado',
      funcionarioTTAIP: 'Dr. Roberto Mendoza',
      primeraCalificacion: {
        fecha: 1737590400000,
        funcionario: 'Dr. Roberto Mendoza',
        resultado: 'FUNDADO',
        fundamentacion: 'Se declara FUNDADA la apelación. Las actas de sesiones de órganos colegiados constituyen información pública por mandato legal. Se ORDENA al MINEDU proporcionar la información en 5 días hábiles.',
        resolucion: 'Resolución N° 045-2025-TTAIP/SD',
        cedulaCiudadano: 'N° 145-C-2025',
        cedulaEntidad: 'N° 145-E-2025',
      },
      segundaCalificacion: null,
      subsanacion: null,
      timeline: [
        { fecha: 1736985600000, evento: 'Apelación presentada ante el TTAIP', tipo: 'recepcion', completado: true },
        { fecha: 1737072000000, evento: 'Asignada a Dr. Roberto Mendoza', tipo: 'asignacion', completado: true },
        { fecha: 1737244800000, evento: 'En calificación por el TTAIP', tipo: 'calificacion', completado: true },
        { fecha: 1737590400000, evento: 'Primera calificación: FUNDADO', tipo: 'calificacion', completado: true },
        { fecha: 1737590400000, evento: 'Resolución N° 045-2025-TTAIP/SD emitida', tipo: 'resolucion', completado: true },
      ],
      diasHabiles: 7, diasRestantes: 0,
      informeOralSolicitado: false, timerPausado: false,
      sincronizado: true, pendienteSubida: false,
      ultimaModificacion: 1737590400000,
    },
    {
      id: 'apel_ttaip_00245',
      expediente: '00245-2025-JUS/TTAIP',
      expedienteSAIP: 'SAIP-2025-00520',
      usuarioId: uidCiudadano2,
      apelanteNombre: 'María López Ríos',
      apelanteDni: '87654321',
      apelanteEmail: 'maria.lopez@email.com',
      entidad: 'Ministerio de Salud (MINSA)',
      entidadId: 'minsa',
      asunto: 'Apelación por demora en entrega de informe de vacunación',
      fundamentoLegal: 'Artículo 11 del TUO de la Ley N° 27806',
      exposicionHechos: 'Habiendo transcurrido el plazo legal sin obtener respuesta completa del MINSA.',
      pretension: 'Solicito al TTAIP ordene al MINSA la entrega completa del informe estadístico de vacunación.',
      fechaPresentacion: 1739232000000,
      estado: 'En Calificación',
      funcionarioTTAIP: 'Dr. Roberto Mendoza',
      primeraCalificacion: null,
      segundaCalificacion: null,
      subsanacion: null,
      timeline: [
        { fecha: 1739232000000, evento: 'Apelación presentada ante el TTAIP', tipo: 'recepcion', completado: true },
        { fecha: 1739318400000, evento: 'Asignada a Dr. Roberto Mendoza', tipo: 'asignacion', completado: true },
        { fecha: 1739404800000, evento: 'En calificación por el TTAIP', tipo: 'calificacion', completado: false },
      ],
      diasHabiles: 2, diasRestantes: 5,
      informeOralSolicitado: false, timerPausado: false,
      sincronizado: true, pendienteSubida: false,
      ultimaModificacion: 1739404800000,
    },
    {
      id: 'apel_ttaip_00234',
      expediente: '00234-2025-JUS/TTAIP',
      expedienteSAIP: 'SAIP-2025-00505',
      usuarioId: uidCiudadano2,
      apelanteNombre: 'María López Ríos',
      apelanteDni: '87654321',
      apelanteEmail: 'maria.lopez@email.com',
      entidad: 'Ministerio de Transportes y Comunicaciones (MTC)',
      entidadId: 'mtc',
      asunto: 'Apelación por falta de respuesta sobre proyectos viales',
      fundamentoLegal: 'Artículo 11 del TUO de la Ley N° 27806',
      exposicionHechos: 'Solicité información sobre proyectos viales y no obtuve respuesta dentro del plazo legal.',
      pretension: 'Ordene la entrega de la información solicitada.',
      fechaPresentacion: 1738022400000,
      estado: 'Resuelto - Inadmisible',
      funcionarioTTAIP: 'Dra. Carmen Silva',
      primeraCalificacion: {
        fecha: 1738368000000,
        funcionario: 'Dra. Carmen Silva',
        resultado: 'SUBSANACION_REQUERIDA',
        fundamentacion: 'Se requiere al apelante especificar con exactitud la información requerida.',
        resolucion: null,
        cedulaCiudadano: 'N° 234-C-2025',
        cedulaEntidad: null,
      },
      segundaCalificacion: {
        fecha: 1738886400000,
        funcionario: 'Dra. Carmen Silva',
        resultado: 'INADMISIBLE',
        fundamentacion: 'Vencido el plazo de 3 días hábiles sin subsanación. Se declara INADMISIBLE.',
        resolucion: 'Resolución N° 078-2025-TTAIP/SD',
        cedulaCiudadano: 'N° 234-C2-2025',
        cedulaEntidad: null,
      },
      subsanacion: null,
      timeline: [
        { fecha: 1738022400000, evento: 'Apelación presentada ante el TTAIP', tipo: 'recepcion', completado: true },
        { fecha: 1738108800000, evento: 'Asignada a Dra. Carmen Silva', tipo: 'asignacion', completado: true },
        { fecha: 1738368000000, evento: 'Primera calificación: Requiere subsanación', tipo: 'calificacion', completado: true },
        { fecha: 1738886400000, evento: 'Segunda calificación: INADMISIBLE', tipo: 'calificacion', completado: true },
        { fecha: 1738886400000, evento: 'Resolución N° 078-2025-TTAIP/SD emitida', tipo: 'resolucion', completado: true },
      ],
      diasHabiles: 7, diasRestantes: 0,
      informeOralSolicitado: false, timerPausado: false,
      sincronizado: true, pendienteSubida: false,
      ultimaModificacion: 1738886400000,
    },
    {
      id: 'apel_ttaip_00112',
      expediente: '00112-2025-JUS/TTAIP',
      expedienteSAIP: 'SAIP-2025-00510',
      usuarioId: uidCiudadano2,
      apelanteNombre: 'María López Ríos',
      apelanteDni: '87654321',
      apelanteEmail: 'maria.lopez@email.com',
      entidad: 'Ministerio del Interior (MININTER)',
      entidadId: 'mininter',
      asunto: 'Apelación contra denegación de información de seguridad nacional',
      fundamentoLegal: 'Artículo 2 inciso 5 de la Constitución Política del Perú',
      exposicionHechos: 'Solicité información sobre operativos del Ministerio del Interior que me fue denegada por razones de seguridad nacional.',
      pretension: 'Ordene la entrega de la información solicitada.',
      fechaPresentacion: 1734566400000,
      estado: 'Resuelto - Infundado',
      funcionarioTTAIP: 'Dra. Carmen Silva',
      primeraCalificacion: {
        fecha: 1735171200000,
        funcionario: 'Dra. Carmen Silva',
        resultado: 'INFUNDADO',
        fundamentacion: 'Se declara INFUNDADA. La información está exceptuada conforme al artículo 15, inciso 1 de la Ley de Transparencia por razones de seguridad nacional.',
        resolucion: 'Resolución N° 023-2025-TTAIP/SD',
        cedulaCiudadano: 'N° 112-C-2025',
        cedulaEntidad: 'N° 112-E-2025',
      },
      segundaCalificacion: null,
      subsanacion: null,
      timeline: [
        { fecha: 1734566400000, evento: 'Apelación presentada ante el TTAIP', tipo: 'recepcion', completado: true },
        { fecha: 1734652800000, evento: 'Asignada a Dra. Carmen Silva', tipo: 'asignacion', completado: true },
        { fecha: 1735171200000, evento: 'Primera calificación: INFUNDADO', tipo: 'calificacion', completado: true },
        { fecha: 1735171200000, evento: 'Resolución N° 023-2025-TTAIP/SD emitida', tipo: 'resolucion', completado: true },
      ],
      diasHabiles: 7, diasRestantes: 0,
      informeOralSolicitado: false, timerPausado: false,
      sincronizado: true, pendienteSubida: false,
      ultimaModificacion: 1735171200000,
    },
  ];

  for (const a of apelaciones) {
    await db.collection('apelaciones').doc(a.id).set(a, { merge: true });
    log('⚖️', `${a.expediente} — ${a.estado}`);
  }
  log('✅', `${C.green}4 apelaciones sembradas${C.reset}`);
}

/**
 * Paso 6: Sembrar colección `expedientes` (RF-EXP-01, RF-EXP-02)
 * Formato: NNNNN-AAAA-JUS/TTAIP
 */
async function sembrarExpedientes(uids) {
  header('PASO 6/7 — Sembrando colección "expedientes" (RF-EXP-01)');

  const uidCiudadano1 = uids['12345678@misaip.gob.pe'];
  const uidCiudadano2 = uids['87654321@misaip.gob.pe'];

  const expedientes = [
    {
      id: 'exp_00145',
      numero: '00145-2025-JUS/TTAIP',
      apelacionId: 'apel_ttaip_00145',
      expedienteSAIP: 'SAIP-2025-00512',
      recurrenteId: uidCiudadano1,
      recurrenteNombre: 'Juan Carlos García Pérez',
      entidad: 'Ministerio de Educación (MINEDU)',
      entidadId: 'minedu',
      sala: 'Primera Sala',
      vocalPonente: 'Tatiana Azucena Valverde Alvarado',
      estado: 'RESUELTO',
      asunto: 'Apelación contra denegación de acceso a actas del CNE',
      fechaCreacion: 1736985600000,
      fechaElevacion: 1737072000000,
      fechaCalificacion1: 1737590400000,
      fechaCalificacion2: null,
      fechaDescargos: null,
      fechaInstruccion: null,
      fechaResolucion: 1737590400000,
      resolucionFinal: 'FUNDADO',
      resolucionNumero: 'Resolución N° 045-2025-TTAIP/SD',
      firmante: 'José Ángel Dávila Córdova',
      diasHabilesTotal: 7,
      timerPausado: false,
      motivoPausa: null,
      ultimaModificacion: 1737590400000,
    },
    {
      id: 'exp_00245',
      numero: '00245-2025-JUS/TTAIP',
      apelacionId: 'apel_ttaip_00245',
      expedienteSAIP: 'SAIP-2025-00520',
      recurrenteId: uidCiudadano2,
      recurrenteNombre: 'María López Ríos',
      entidad: 'Ministerio de Salud (MINSA)',
      entidadId: 'minsa',
      sala: 'Primera Sala',
      vocalPonente: 'Luis Guillermo Agurto Villegas',
      estado: 'EN_CALIFICACION_1',
      asunto: 'Apelación por demora en entrega de informe de vacunación',
      fechaCreacion: 1739232000000,
      fechaElevacion: 1739318400000,
      fechaCalificacion1: null,
      fechaCalificacion2: null,
      fechaDescargos: null,
      fechaInstruccion: null,
      fechaResolucion: null,
      resolucionFinal: null,
      resolucionNumero: null,
      firmante: 'José Ángel Dávila Córdova',
      diasHabilesTotal: 2,
      timerPausado: false,
      motivoPausa: null,
      ultimaModificacion: 1739404800000,
    },
    {
      id: 'exp_00234',
      numero: '00234-2025-JUS/TTAIP',
      apelacionId: 'apel_ttaip_00234',
      expedienteSAIP: 'SAIP-2025-00505',
      recurrenteId: uidCiudadano2,
      recurrenteNombre: 'María López Ríos',
      entidad: 'Ministerio de Transportes y Comunicaciones (MTC)',
      entidadId: 'mtc',
      sala: 'Segunda Sala',
      vocalPonente: 'Junior Pichón De la Cruz',
      estado: 'RESUELTO',
      asunto: 'Apelación por falta de respuesta sobre proyectos viales',
      fechaCreacion: 1738022400000,
      fechaElevacion: 1738108800000,
      fechaCalificacion1: 1738368000000,
      fechaCalificacion2: 1738886400000,
      fechaDescargos: null,
      fechaInstruccion: null,
      fechaResolucion: 1738886400000,
      resolucionFinal: 'INADMISIBLE',
      resolucionNumero: 'Resolución N° 078-2025-TTAIP/SD',
      firmante: 'José Ángel Dávila Córdova',
      diasHabilesTotal: 7,
      timerPausado: false,
      motivoPausa: null,
      ultimaModificacion: 1738886400000,
    },
    {
      id: 'exp_00112',
      numero: '00112-2025-JUS/TTAIP',
      apelacionId: 'apel_ttaip_00112',
      expedienteSAIP: 'SAIP-2025-00510',
      recurrenteId: uidCiudadano2,
      recurrenteNombre: 'María López Ríos',
      entidad: 'Ministerio del Interior (MININTER)',
      entidadId: 'mininter',
      sala: 'Segunda Sala',
      vocalPonente: 'Jessica Martha Rojas Barrueta',
      estado: 'RESUELTO',
      asunto: 'Apelación contra denegación de información de seguridad nacional',
      fechaCreacion: 1734566400000,
      fechaElevacion: 1734652800000,
      fechaCalificacion1: 1735171200000,
      fechaCalificacion2: null,
      fechaDescargos: null,
      fechaInstruccion: null,
      fechaResolucion: 1735171200000,
      resolucionFinal: 'INFUNDADO',
      resolucionNumero: 'Resolución N° 023-2025-TTAIP/SD',
      firmante: 'José Ángel Dávila Córdova',
      diasHabilesTotal: 7,
      timerPausado: false,
      motivoPausa: null,
      ultimaModificacion: 1735171200000,
    },
  ];

  for (const e of expedientes) {
    await db.collection('expedientes').doc(e.id).set(e, { merge: true });
    log('📁', `${e.numero} — ${e.estado} (${e.sala})`);
  }
  log('✅', `${C.green}${expedientes.length} expedientes sembrados${C.reset}`);
}

/**
 * Paso 7: Sembrar colecciones `cedulas` y `notificaciones`
 * RF-NOT-01: Formato NOTIFICACION [Correlativo]-[Año]-TTAIP
 * RF-NOT-02: Reprocesos generan nueva cédula
 */
async function sembrarCedulasYNotificaciones(uids) {
  header('PASO 7/7 — Sembrando "cedulas" y "notificaciones"');

  const uidCiudadano1 = uids['12345678@misaip.gob.pe'];
  const uidCiudadano2 = uids['87654321@misaip.gob.pe'];
  const uidFuncMinedu = uids['func_minedu@misaip.gob.pe'];
  const uidFuncMtc = uids['func_mtc@misaip.gob.pe'];
  const uidTtaip1 = uids['ttaip_001@misaip.gob.pe'];

  // ─── Cédulas de Notificación (RF-NOT-01) ──────────────────
  log('📜', 'Sembrando cédulas de notificación...');

  const cedulas = [
    // Apelación FUNDADA (exp_00145) → Cédula al ciudadano
    {
      id: 'ced_00145_c1',
      numero: 'NOTIFICACION 017300-2025-TTAIP',
      expedienteId: 'exp_00145',
      apelacionId: 'apel_ttaip_00145',
      expedienteNumero: '00145-2025-JUS/TTAIP',
      resolucionNumero: 'Resolución N° 045-2025-TTAIP/SD',
      destinatario: 'CIUDADANO',
      destinatarioId: uidCiudadano1,
      destinatarioNombre: 'Juan Carlos García Pérez',
      entidad: 'Ministerio de Educación (MINEDU)',
      entidadId: 'minedu',
      contenido: 'Se le notifica la Resolución N° 045-2025-TTAIP/SD que declara FUNDADA su apelación. Se ordena al MINEDU la entrega de información en 5 días hábiles.',
      fechaNotificacion: 1737590400000,
      modalidad: 'VIRTUAL',
      estado: 'NOTIFICADO',
      fechaRecepcion: 1737676800000,
      documentosAdjuntos: ['Resolución_045-2025.pdf', 'Cédula_017300.pdf'],
      firmante: 'José Ángel Dávila Córdova',
      reprocesoDe: null,
      ultimaModificacion: 1737676800000,
    },
    // Apelación FUNDADA (exp_00145) → Cédula a la entidad
    {
      id: 'ced_00145_e1',
      numero: 'NOTIFICACION 017301-2025-TTAIP',
      expedienteId: 'exp_00145',
      apelacionId: 'apel_ttaip_00145',
      expedienteNumero: '00145-2025-JUS/TTAIP',
      resolucionNumero: 'Resolución N° 045-2025-TTAIP/SD',
      destinatario: 'ENTIDAD',
      destinatarioId: uidFuncMinedu,
      destinatarioNombre: 'Ministerio de Educación (MINEDU)',
      entidad: 'Ministerio de Educación (MINEDU)',
      entidadId: 'minedu',
      contenido: 'Se notifica la Resolución N° 045-2025-TTAIP/SD que declara FUNDADA la apelación del ciudadano. Se ordena la entrega de información en 5 días hábiles bajo apercibimiento.',
      fechaNotificacion: 1737590400000,
      modalidad: 'VIRTUAL',
      estado: 'NOTIFICADO',
      fechaRecepcion: 1737676800000,
      documentosAdjuntos: ['Resolución_045-2025.pdf', 'Expediente_completo.pdf', 'Cédula_017301.pdf'],
      firmante: 'José Ángel Dávila Córdova',
      reprocesoDe: null,
      ultimaModificacion: 1737676800000,
    },
    // Apelación INADMISIBLE (exp_00234) → Cédula subsanación al ciudadano
    {
      id: 'ced_00234_c1',
      numero: 'NOTIFICACION 017250-2025-TTAIP',
      expedienteId: 'exp_00234',
      apelacionId: 'apel_ttaip_00234',
      expedienteNumero: '00234-2025-JUS/TTAIP',
      resolucionNumero: null,
      destinatario: 'CIUDADANO',
      destinatarioId: uidCiudadano2,
      destinatarioNombre: 'María López Ríos',
      entidad: 'Ministerio de Transportes y Comunicaciones (MTC)',
      entidadId: 'mtc',
      contenido: 'Se requiere subsanación del recurso de apelación. Debe especificar con exactitud la información requerida. Plazo: 3 días hábiles.',
      fechaNotificacion: 1738368000000,
      modalidad: 'VIRTUAL',
      estado: 'NOTIFICADO',
      fechaRecepcion: 1738454400000,
      documentosAdjuntos: ['Resolución_subsanación.pdf', 'Cédula_017250.pdf'],
      firmante: 'José Ángel Dávila Córdova',
      reprocesoDe: null,
      ultimaModificacion: 1738454400000,
    },
    // Apelación INADMISIBLE (exp_00234) → Cédula resolución final al ciudadano
    {
      id: 'ced_00234_c2',
      numero: 'NOTIFICACION 017280-2025-TTAIP',
      expedienteId: 'exp_00234',
      apelacionId: 'apel_ttaip_00234',
      expedienteNumero: '00234-2025-JUS/TTAIP',
      resolucionNumero: 'Resolución N° 078-2025-TTAIP/SD',
      destinatario: 'CIUDADANO',
      destinatarioId: uidCiudadano2,
      destinatarioNombre: 'María López Ríos',
      entidad: 'Ministerio de Transportes y Comunicaciones (MTC)',
      entidadId: 'mtc',
      contenido: 'Se le notifica la Resolución N° 078-2025-TTAIP/SD que declara INADMISIBLE su apelación por no subsanar en plazo.',
      fechaNotificacion: 1738886400000,
      modalidad: 'VIRTUAL',
      estado: 'NOTIFICADO',
      fechaRecepcion: 1738972800000,
      documentosAdjuntos: ['Resolución_078-2025.pdf', 'Cédula_017280.pdf'],
      firmante: 'José Ángel Dávila Córdova',
      reprocesoDe: null,
      ultimaModificacion: 1738972800000,
    },
    // Apelación INFUNDADO (exp_00112) → Cédula al ciudadano
    {
      id: 'ced_00112_c1',
      numero: 'NOTIFICACION 017100-2025-TTAIP',
      expedienteId: 'exp_00112',
      apelacionId: 'apel_ttaip_00112',
      expedienteNumero: '00112-2025-JUS/TTAIP',
      resolucionNumero: 'Resolución N° 023-2025-TTAIP/SD',
      destinatario: 'CIUDADANO',
      destinatarioId: uidCiudadano2,
      destinatarioNombre: 'María López Ríos',
      entidad: 'Ministerio del Interior (MININTER)',
      entidadId: 'mininter',
      contenido: 'Se le notifica la Resolución N° 023-2025-TTAIP/SD que declara INFUNDADA su apelación. La información está exceptuada por razones de seguridad nacional.',
      fechaNotificacion: 1735171200000,
      modalidad: 'VIRTUAL',
      estado: 'NOTIFICADO',
      fechaRecepcion: 1735257600000,
      documentosAdjuntos: ['Resolución_023-2025.pdf', 'Cédula_017100.pdf'],
      firmante: 'José Ángel Dávila Córdova',
      reprocesoDe: null,
      ultimaModificacion: 1735257600000,
    },
    // Apelación INFUNDADO (exp_00112) → Cédula a la entidad
    {
      id: 'ced_00112_e1',
      numero: 'NOTIFICACION 017101-2025-TTAIP',
      expedienteId: 'exp_00112',
      apelacionId: 'apel_ttaip_00112',
      expedienteNumero: '00112-2025-JUS/TTAIP',
      resolucionNumero: 'Resolución N° 023-2025-TTAIP/SD',
      destinatario: 'ENTIDAD',
      destinatarioId: null,
      destinatarioNombre: 'Ministerio del Interior (MININTER)',
      entidad: 'Ministerio del Interior (MININTER)',
      entidadId: 'mininter',
      contenido: 'Se notifica la Resolución N° 023-2025-TTAIP/SD que declara INFUNDADA la apelación del ciudadano.',
      fechaNotificacion: 1735171200000,
      modalidad: 'VIRTUAL',
      estado: 'NOTIFICADO',
      fechaRecepcion: 1735257600000,
      documentosAdjuntos: ['Resolución_023-2025.pdf', 'Cédula_017101.pdf'],
      firmante: 'José Ángel Dávila Córdova',
      reprocesoDe: null,
      ultimaModificacion: 1735257600000,
    },
  ];

  for (const c of cedulas) {
    await db.collection('cedulas').doc(c.id).set(c, { merge: true });
    log('📜', `${c.numero} → ${c.destinatario} (${c.estado})`);
  }
  log('✅', `${C.green}${cedulas.length} cédulas sembradas${C.reset}`);

  // ─── Notificaciones ───────────────────────────────────────
  console.log('');
  log('🔔', 'Sembrando notificaciones...');

  const notificaciones = [
    { tipo: 'RESOLUCION', titulo: 'Apelación 00145-2025-JUS/TTAIP declarada FUNDADA', mensaje: 'Su apelación ha sido declarada FUNDADA. El MINEDU debe entregar la información en 5 días hábiles.', fecha: 1737590400000, leida: false, expediente: '00145-2025-JUS/TTAIP', usuarioId: uidCiudadano1, sincronizado: true },
    { tipo: 'CEDULA', titulo: 'Cédula de Notificación N° 145-C-2025', mensaje: 'Se le notifica la Resolución N° 045-2025-TTAIP/SD que declara FUNDADA su apelación.', fecha: 1737590400000, leida: false, expediente: '00145-2025-JUS/TTAIP', usuarioId: uidCiudadano1, sincronizado: true },
    { tipo: 'RESPUESTA', titulo: 'Solicitud SAIP-2025-00498 respondida', mensaje: 'El MEF ha respondido su solicitud con entrega total de la información. 4 archivos adjuntos.', fecha: 1736380800000, leida: true, expediente: 'SAIP-2025-00498', usuarioId: uidCiudadano1, sincronizado: true },
    { tipo: 'ORDEN_TTAIP', titulo: 'Orden de entrega del TTAIP — SAIP-2025-00512', mensaje: 'El TTAIP ha ordenado la entrega de información. Plazo: 5 días hábiles bajo apercibimiento.', fecha: 1737590400000, leida: false, expediente: 'SAIP-2025-00512', usuarioId: uidFuncMinedu, sincronizado: true },
    { tipo: 'VENCIMIENTO', titulo: '⚠️ SOLICITUD VENCIDA — SAIP-2025-00505', mensaje: 'La solicitud ha superado el plazo legal de 10 días hábiles. Retraso: 7 días. Silencio administrativo positivo.', fecha: 1738713600000, leida: false, expediente: 'SAIP-2025-00505', usuarioId: uidFuncMtc, sincronizado: true },
    { tipo: 'NUEVA_APELACION', titulo: 'Nueva apelación requiere calificación', mensaje: 'Se ha asignado la apelación 00245-2025-JUS/TTAIP para su calificación. Días restantes: 5.', fecha: 1739318400000, leida: false, expediente: '00245-2025-JUS/TTAIP', usuarioId: uidTtaip1, sincronizado: true },
  ];

  for (const n of notificaciones) {
    await db.collection('notificaciones').doc().set(n);
    log('🔔', `→ ${n.titulo.substring(0, 50)}...`);
  }
  log('✅', `${C.green}6 notificaciones sembradas${C.reset}`);
}

// ╔══════════════════════════════════════════════════════════╗
// ║  EJECUCIÓN PRINCIPAL                                    ║
// ╚══════════════════════════════════════════════════════════╝
async function main() {
  console.log('');
  console.log(`${C.bold}${C.cyan}🔥 MiSAIP — Configuración completa de Firebase${C.reset}`);
  console.log(`${C.dim}   Proyecto: misaip${C.reset}`);
  console.log(`${C.dim}   Fecha: ${new Date().toLocaleDateString('es-PE')}${C.reset}`);

  const startTime = Date.now();

  try {
    const uids = await crearUsuariosAuth();
    await testFirestoreConnection();
    await sembrarUsuarios(uids);
    await sembrarEntidades();
    await sembrarSolicitudes(uids);
    await sembrarApelaciones(uids);
    await sembrarExpedientes(uids);
    await sembrarCedulasYNotificaciones(uids);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('');
    console.log(`${C.green}${C.bold}${'═'.repeat(60)}${C.reset}`);
    console.log(`${C.green}${C.bold}  ✅ ¡CONFIGURACIÓN COMPLETA! (${elapsed}s)${C.reset}`);
    console.log(`${C.green}${C.bold}${'═'.repeat(60)}${C.reset}`);
    console.log('');
    console.log('  📊 Resumen:');
    console.log('     • 9 usuarios en Firebase Auth');
    console.log('     • 9 documentos en colección "usuarios"');
    console.log('     • 8 documentos en colección "entidades"');
    console.log('     • 7 documentos en colección "solicitudes"');
    console.log('     • 4 documentos en colección "apelaciones"');
    console.log('     • 4 documentos en colección "expedientes"');
    console.log('     • 6 documentos en colección "cedulas"');
    console.log('     • 6 documentos en colección "notificaciones"');
    console.log('');
    console.log(`  ${C.yellow}Siguiente paso:${C.reset}`);
    console.log(`     npx firebase deploy --only firestore:rules,firestore:indexes`);
    console.log('');

    // Guardar credenciales de acceso
    const credsPath = path.join(__dirname, 'credenciales-generadas.txt');
    let creds = '=== CREDENCIALES DE ACCESO MiSAIP ===\n\n';
    creds += 'NOTA: En la app Android:\n';
    creds += '  - Ciudadanos inician sesión con su DNI (ej: 12345678)\n';
    creds += '  - Funcionarios/TTAIP/Admin inician sesión con su usuario (ej: func_minedu)\n\n';
    for (const u of USUARIOS) {
      const uid = uids[u.email] || 'N/A';
      creds += `${u.displayName}\n`;
      creds += `  Auth Email: ${u.email}\n`;
      if (u.firestoreData.tipo === 'CIUDADANO') {
        creds += `  Login (DNI): ${u.firestoreData.dni}\n`;
      } else {
        creds += `  Login (Usuario): ${u.firestoreData.usuario}\n`;
      }
      creds += `  Pass:  ${u.password}\n`;
      creds += `  Tipo:  ${u.firestoreData.tipo}\n`;
      creds += `  UID:   ${uid}\n\n`;
    }
    fs.writeFileSync(credsPath, creds);
    console.log(`  💾 Credenciales guardadas en ${C.cyan}credenciales-generadas.txt${C.reset}`);
    console.log('');

  } catch (err) {
    console.error(`\n${C.red}❌ Error fatal: ${err.message}${C.reset}`);
    console.error(err.stack);
    process.exit(1);
  }

  process.exit(0);
}

main();
