/**
 * ============================================================
 *  MiSAIP — Script de limpieza de Firebase
 * ============================================================
 *
 *  PRECAUCIÓN: Este script ELIMINA todos los datos:
 *    - Todos los documentos de las 5 colecciones de Firestore
 *    - Todos los usuarios de Firebase Authentication
 *
 *  Úsalo para reiniciar la base de datos antes de re-sembrar.
 *
 *  Uso:
 *    cd firebase-setup
 *    node clean-firestore.js
 * ============================================================
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// ─── Inicializar ───────────────────────────────────────────
const keyPath = path.join(__dirname, 'service-account-key.json');
if (!fs.existsSync(keyPath)) {
  console.error('❌ No se encontró service-account-key.json');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(keyPath)),
  });
}

const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore('misaipdb');
const auth = admin.auth();

const C = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m',
};

const COLLECTIONS = ['usuarios', 'entidades', 'solicitudes', 'apelaciones', 'expedientes', 'cedulas', 'notificaciones', 'feriados'];

/**
 * Confirmar antes de eliminar
 */
function confirmar(mensaje) {
  return new Promise((resolve) => {
    // Si se pasa --force, no preguntar
    if (process.argv.includes('--force')) {
      resolve(true);
      return;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`\n${C.yellow}⚠️ ${mensaje} (s/N): ${C.reset}`, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 's' || answer.toLowerCase() === 'si');
    });
  });
}

/**
 * Eliminar todos los documentos de una colección
 */
async function eliminarColeccion(nombre) {
  const snapshot = await db.collection(nombre).get();
  if (snapshot.empty) {
    console.log(`  ⏭️  ${nombre}: vacía (0 docs)`);
    return 0;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  console.log(`  🗑️  ${C.red}${nombre}${C.reset}: ${snapshot.size} documentos eliminados`);
  return snapshot.size;
}

/**
 * Eliminar todos los usuarios de Auth
 */
async function eliminarUsuarios() {
  const listResult = await auth.listUsers(100);
  if (listResult.users.length === 0) {
    console.log(`  ⏭️  Firebase Auth: 0 usuarios`);
    return 0;
  }

  const uids = listResult.users.map((u) => u.uid);
  const result = await auth.deleteUsers(uids);

  console.log(`  🗑️  ${C.red}Firebase Auth${C.reset}: ${result.successCount} usuarios eliminados`);
  if (result.failureCount > 0) {
    console.log(`  ⚠️  ${result.failureCount} usuarios no se pudieron eliminar`);
  }
  return result.successCount;
}

async function main() {
  console.log('');
  console.log(`${C.bold}${C.red}🧹 MiSAIP — Limpieza completa de Firebase${C.reset}`);
  console.log(`${C.red}   Proyecto: misaip${C.reset}`);
  console.log('');

  const ok = await confirmar('¿Estás seguro de que deseas ELIMINAR TODOS los datos?');
  if (!ok) {
    console.log('\n  Cancelado. No se eliminó nada.\n');
    process.exit(0);
  }

  console.log('');
  console.log(`${C.bold}Eliminando colecciones de Firestore...${C.reset}`);

  let totalDocs = 0;
  for (const col of COLLECTIONS) {
    totalDocs += await eliminarColeccion(col);
  }

  console.log('');
  console.log(`${C.bold}Eliminando usuarios de Firebase Auth...${C.reset}`);
  const totalUsers = await eliminarUsuarios();

  // Eliminar archivo de UIDs generados si existe
  const uidsPath = path.join(__dirname, 'generated-uids.json');
  const credsPath = path.join(__dirname, 'credenciales-generadas.txt');
  if (fs.existsSync(uidsPath)) fs.unlinkSync(uidsPath);
  if (fs.existsSync(credsPath)) fs.unlinkSync(credsPath);

  console.log('');
  console.log(`${C.green}${C.bold}✅ Limpieza completa.${C.reset}`);
  console.log(`   ${totalDocs} documentos eliminados`);
  console.log(`   ${totalUsers} usuarios eliminados`);
  console.log('');
  console.log(`   Para re-sembrar: ${C.cyan}npm run setup${C.reset}`);
  console.log('');

  process.exit(0);
}

main();
