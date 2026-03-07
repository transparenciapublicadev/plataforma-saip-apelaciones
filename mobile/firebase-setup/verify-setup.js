/**
 * ============================================================
 *  MiSAIP — Script de verificación de Firebase
 * ============================================================
 *
 *  Verifica que todos los datos fueron creados correctamente:
 *    - Usuarios en Firebase Auth
 *    - Documentos en cada colección de Firestore
 *
 *  Uso:
 *    cd firebase-setup
 *    node verify-setup.js
 * ============================================================
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

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
  yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m', dim: '\x1b[2m',
};

// ─── Emails esperados ──────────────────────────────────────
const EXPECTED_EMAILS = [
  'juan.garcia@email.com',
  'maria.lopez@email.com',
  'carlos.rodriguez@entidad1.test',
  'ana.torres@entidad2.test',
  'luis.fernandez@entidad3.test',
  'patricia.vargas@entidad4.test',
  'roberto.mendoza@ttaip.test',
  'carmen.silva@ttaip.test',
  'admin@misaip.test',
];

// ─── Colecciones esperadas ─────────────────────────────────
const EXPECTED_COLLECTIONS = {
  'usuarios': 9,
  'entidades': 8,
  'solicitudes': 4,
  'apelaciones': 4,
  'notificaciones': 6,
};

async function main() {
  console.log('');
  console.log(`${C.bold}${C.cyan}🔍 MiSAIP — Verificación de Firebase${C.reset}`);
  console.log('');

  let allOk = true;

  // ─── Verificar Auth ────────────────────────────────────
  console.log(`${C.bold}📋 Firebase Authentication${C.reset}`);
  console.log(`${'─'.repeat(50)}`);

  for (const email of EXPECTED_EMAILS) {
    try {
      const user = await auth.getUserByEmail(email);
      console.log(`  ✅ ${C.green}${email}${C.reset} → UID: ${C.dim}${user.uid}${C.reset}`);
    } catch (e) {
      console.log(`  ❌ ${C.red}${email} — NO ENCONTRADO${C.reset}`);
      allOk = false;
    }
  }

  console.log('');

  // ─── Verificar Firestore ───────────────────────────────
  console.log(`${C.bold}📋 Firestore Collections${C.reset}`);
  console.log(`${'─'.repeat(50)}`);

  for (const [col, expectedCount] of Object.entries(EXPECTED_COLLECTIONS)) {
    try {
      const snapshot = await db.collection(col).get();
      const count = snapshot.size;
      const ok = count >= expectedCount;
      const icon = ok ? '✅' : '⚠️';
      const color = ok ? C.green : C.yellow;
      console.log(`  ${icon} ${color}${col}${C.reset}: ${count} documentos (esperados: ${expectedCount})`);

      if (count > 0) {
        const sample = snapshot.docs[0].data();
        const keys = Object.keys(sample).slice(0, 5).join(', ');
        console.log(`     ${C.dim}Campos muestra: ${keys}...${C.reset}`);
      }

      if (!ok) allOk = false;
    } catch (e) {
      console.log(`  ❌ ${C.red}${col}: Error — ${e.message}${C.reset}`);
      allOk = false;
    }
  }

  // ─── Resumen ───────────────────────────────────────────
  console.log('');
  if (allOk) {
    console.log(`${C.green}${C.bold}✅ ¡Verificación exitosa! Todo está configurado correctamente.${C.reset}`);
  } else {
    console.log(`${C.yellow}${C.bold}⚠️ Verificación incompleta. Revisa los items marcados arriba.${C.reset}`);
  }
  console.log('');

  process.exit(allOk ? 0 : 1);
}

main();
