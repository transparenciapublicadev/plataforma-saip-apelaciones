# Diagnostico de API con Newman

Esta guia define como ejecutar la coleccion Postman del proyecto SAIP/TTAIP con Newman para detectar errores HTTP 4xx, 5xx, problemas de environment, desalineacion con el seed SQL y errores reales del backend.

## Contexto

- Coleccion oficial: `postman/SAIP-API-Collection-Complete.json`.
- Base de datos local: `database/script_saip_db.sql`.
- Backend esperado: `http://localhost:8080/api`.
- La carpeta `reports/` debe contener salidas generadas por Newman y no debe usarse como fuente funcional.

## Objetivo

1. Ejecutar la coleccion completa por CLI.
2. Generar reportes JSON y JUnit.
3. Clasificar errores por causa probable:
   - Environment incompleto o variable incorrecta.
   - Seed SQL no cargado o IDs no existentes.
   - Token ausente, vencido o con rol incorrecto.
   - Validacion de payload esperada.
   - Error real del backend.
4. Verificar que los errores 4xx y 5xx del backend usen Problem Details compatible con RFC 9457.

## Comandos recomendados

Desde la carpeta `postman/`:

```bash
npm install --save-dev newman
npx newman run SAIP-API-Collection-Complete.json \
  -e environments/SAIP-Local.postman_environment.json \
  --working-dir . \
  --timeout-request 15000 \
  --timeout-script 10000 \
  --delay-request 50 \
  -r cli,json,junit \
  --reporter-json-export reports/newman-report.json \
  --reporter-junit-export reports/newman-report.xml
```

Para diagnostico sin cortar en el primer fallo:

```bash
npx newman run SAIP-API-Collection-Complete.json \
  -e environments/SAIP-Local.postman_environment.json \
  --working-dir . \
  --timeout-request 15000 \
  --timeout-script 10000 \
  --delay-request 50 \
  --suppress-exit-code \
  -r cli,json,junit \
  --reporter-json-export reports/newman-report.json \
  --reporter-junit-export reports/newman-report.xml
```

## Environment local minimo

Crear `postman/environments/SAIP-Local.postman_environment.json` con variables no secretas de desarrollo. La password demo definida por el seed local es `Saip2026*`.

Variables minimas:

- `baseUrl`: `http://localhost:8080/api`
- `ciudadanoUsername`: `ciudadano01@gmail.com`
- `ciudadanoPassword`: `Saip2026*`
- `funcionarioLoginUsername`: `func.minedu@minedu.gob.pe`
- `funcionarioLoginPassword`: `Saip2026*`
- `ttaipUsername`: `ttaip01@minjus.gob.pe`
- `ttaipPassword`: `Saip2026*`
- `adminUsername`: `admin@saip.gob.pe`
- `adminPassword`: `Saip2026*`

## Test global recomendado para la coleccion

Agregar un test de coleccion que valide estado HTTP, JSON y Problem Details para errores.

```javascript
const status = pm.response.code;
const contentType = pm.response.headers.get('Content-Type') || '';
const method = pm.request.method;
const requestName = pm.info.requestName;

pm.test(`[${status}] ${method} ${requestName} responde HTTP valido`, function () {
  pm.expect(status).to.be.within(100, 599);
});

if (status >= 200 && status < 300) {
  pm.test('Respuesta 2xx no debe incluir formato de error', function () {
    if (contentType.includes('application/json')) {
      const body = pm.response.json();
      pm.expect(body).to.not.have.property('status', status);
      pm.expect(body).to.not.have.property('type');
    }
  });
}

if (status >= 400) {
  pm.test('Error HTTP usa Problem Details compatible con RFC 9457', function () {
    pm.expect(contentType).to.include('application/problem+json');
    const problem = pm.response.json();
    pm.expect(problem).to.have.property('type').that.is.a('string');
    pm.expect(problem).to.have.property('title').that.is.a('string');
    pm.expect(problem).to.have.property('status', status);
    pm.expect(problem).to.have.property('detail').that.is.a('string');
    pm.expect(problem).to.have.property('instance').that.is.a('string');
  });
}

if (status >= 500) {
  pm.test('5xx nunca debe exponer stacktrace ni detalles internos', function () {
    const text = pm.response.text();
    pm.expect(text).to.not.include('java.lang.');
    pm.expect(text).to.not.include('org.springframework');
    pm.expect(text).to.not.include('SQLSyntaxErrorException');
    pm.expect(text).to.not.include('StackTrace');
  });
}
```

## Reglas de diagnostico

- Si falla `401` en logins: revisar credenciales del environment contra `database/script_saip_db.sql`.
- Si falla `401` fuera de login: revisar que la carpeta `01. Autenticacion` se ejecute primero y que se guarden tokens.
- Si falla `403`: revisar rol requerido por endpoint y token usado.
- Si falla `404` con IDs: revisar que el seed SQL haya sido cargado y que las variables ID apunten a registros existentes.
- Si falla `400` con payload valido: revisar DTO, Bean Validation y reglas de negocio del backend.
- Si falla `409`: validar conflicto esperado de negocio, por ejemplo duplicados o transicion de estado no permitida.
- Si falla `500`: tratar como bug del backend hasta demostrar lo contrario.

## Buenas practicas backend para errores

- Responder errores con `application/problem+json`.
- Incluir `type`, `title`, `status`, `detail` e `instance`.
- Para validaciones, incluir un arreglo `errors` o `invalidParams` con campo y motivo.
- No exponer stacktraces, queries SQL, rutas internas ni nombres de clases.
- Mantener codigos HTTP correctos:
  - `400` para request mal formado o validacion general.
  - `401` para no autenticado.
  - `403` para autenticado sin permiso.
  - `404` para recurso inexistente.
  - `409` para conflicto de negocio o estado.
  - `422` para entidad semanticamente invalida si el proyecto decide separarlo de `400`.
  - `500` solo para errores inesperados.

## Flujo local recomendado

1. Cargar base de datos con `database/script_saip_db.sql`.
2. Levantar backend local.
3. Ejecutar primero la carpeta `01. Autenticacion`.
4. Ejecutar coleccion completa con Newman.
5. Revisar `reports/newman-report.json` y `reports/newman-report.xml`.
6. Corregir primero environment/seed/coleccion; luego backend si el error persiste.
