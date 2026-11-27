# R2: borradores y registros documentales TTAIP

Entrega local del 2026-10-23. Corrige la presentación Angular; no implementa
numeración, firma digital, certificación de copias ni emisión documental formal.

## Comportamiento y alcance

- `official-docs-section.component` solo compone **borradores**. Reserva, emisión
  y archivo final están deshabilitados con un motivo visible y accesible. Se
  eliminaron las asignaciones locales `reservado`/`emitido`/`archivado`, la subida
  que solo guardaba el nombre del archivo y la propagación de números a los padres.
- `official-docs.util` ya no calcula correlativos del expediente. PDF y Word llevan
  `Borrador_` en el nombre y una advertencia dentro del contenido; el PDF la repite
  en cada página. Fechas ausentes, folios y enlaces permanecen explícitamente sin
  información. No hay vocales ni secretario predeterminados ni afirmación de firma.
- `official-preview.component` conserva la hoja, logos y estilos de la referencia,
  con aviso de borrador también en vista ampliada. Retira la leyenda de copia
  auténtica y reinicia pestaña/ampliación cuando cambia el contexto.
- Primera/segunda calificación y resolución final dejan de generar los supuestos
  números `expediente-C1`, `-C2` y `-RF`. Los mensajes usan exclusivamente
  `numeroResolucion` del DTO correspondiente o indican que no está registrado.
  Los comandos existentes se presentan como **registro de una actuación**, sin
  prometer firma documental. Una respuesta vacía o de otra apelación no confirma
  el registro y requiere consultar antes de repetir una operación incierta.
- El detalle distingue el borrador generado de los archivos registrados. Estos
  siguen en las listas de documentos de cada resolución/cédula, con sus IDs reales.
  Una consulta nueva limpia el borrador previo; respuestas tardías o de otra
  apelación no lo repueblan. Fallar al generar/descargar no confirma emisión.
- Un archivo seleccionado se identifica como tal, sin dar su nombre por prueba
  de recepción o de firma. La coordinación completa de la decisión final y sus
  subidas separadas sigue fuera de esta corrección; puede existir registro de la
  decisión sin todos los archivos. Consultar metadatos/bytes antes de afirmar lo
  contrario; no repetir el comando de decisión para reintentar una subida.

Los activos de `public/assets/oficial/` se conservan íntegros. Son recursos de las
plantillas, no documentos concretos de un expediente ni evidencia de autenticidad.

## Backend y discrepancias

La revisión de controladores/servicios no encontró un comando equivalente a los
botones de reserva/emisión/archivo final del prototipo React/Supabase.
`TTAIPService.guardarResolucionConDocumentos` persiste la resolución y llama a
`ExpedienteTtaipService.registrarResolucion`: genera metadatos, cédulas e historial
(incluido el evento de dominio `RESOLUCION_EMITIDA`). Ese registro de actuación no
es una certificación del PDF que Angular compone localmente. No se sustituye ese
comando por otro genérico ni se cambian sus reglas o precondiciones.

`DocumentoRestController` permite consulta por relación, metadatos y descarga por
ID. `DocumentoService` verifica el acceso al recurso antes de listar/descargar.
No se modificaron estas autorizaciones ni se añadió una API documental formal.

Conflicto encontrado: `design-reference/src/app/components/OfficialDocuments.tsx`
propone **10 días hábiles** para cumplimiento en su artículo de resolución fundada;
[las reglas consolidadas](../docs/business-rules/SAIP_TTAIP_REGLAS_NEGOCIO.md)
describen **7**. La plantilla Angular ya no elige 10 por defecto: remite al acto
registrado e identifica el dato pendiente. Los mensajes finales tampoco presentan
duraciones locales como plazos acreditados. No se cambia el calendario, el reloj
de subsanación ni el seguimiento de cumplimiento del backend. La decisión y base
de este último siguen pendientes según [el alcance de cumplimiento](CUMPLIMIENTO_TTAIP_REAL.md).

Los snapshots OpenAPI parciales, tipos API, migraciones y Kotlin permanecen sin
cambios. No se declara sincronización global ni integración Android verificada.

## Archivos de esta entrega y preservación

Se modifican 13 archivos preexistentes: los tres componentes/helpers compartidos
(`official-docs-section.component.ts`, `official-preview.component.ts`,
`official-docs.util.ts`) y `official-docs.util.spec.ts`; TS/HTML de
`ttaip-calificar`, `ttaip-segunda-calificacion`, `ttaip-resolver`; TS/HTML/spec del
detalle `ttaip-resolucion-detalle`. Se añaden este informe y tres specs:
`official-drafts`, `official-document-consumers`, `official-registered-documents`.
Todos residen en frontend; los specs nuevos están en `pages/ttaip/shared/`.

Se guardó el estado inicial, copia de los 13 originales y hashes de 959 archivos
versionados/no ignorados (incluidos los nuevos anteriores). La comparación final
conserva otros **946 sin cambios**, sin archivos eliminados; los cambios propios
se revisan contra esas copias, no contra un HEAD que omita entregas previas. No se
tocan instrucciones/configuración global, exclusiones Git ni permisos.

## Evidencia y reproducción

Antes de corregir: **6/6 pruebas RED** reprodujeron numeración local, emisión local,
defaults y falsa presentación oficial; después **6 fallos y 3 aprobadas** en los
consumidores demostraron los números inventados y la confirmación con respuesta
vacía. Se sustituyeron tres tests que exigían correlativos ficticios por evidencia
del comportamiento honesto. No se cuentan como regresiones que deban preservarse.

Verificación final: **473/473 en 39 archivos**, una ejecución completa serial;
`tsc` de aplicación y specs aprobados. La ejecución afectada intermedia pasó 37
casos. Hubo un intento completo detenido en compilación por acceso privado desde
un fixture y otro con 454 aprobadas/4 fallos por usar JSON donde el mock HTTP exigía
Blob; ambos fixtures se corrigieron. No se suman reejecuciones a la suite final.

Las pruebas usan componentes y servicio/interceptor reales con HTTP o servicios
simulados, FileReader y DOM de pruebas. Verifican borradores, IDs, bytes recibidos,
errores 401/403/404/500, cambios de expediente y respuestas incompatibles. No son
pruebas de JWT válido, PostgreSQL, almacenamiento real ni firma criptográfica.
Estas suites backend no se repiten al no modificar backend, esquema o contrato.
JSDOM informa sus límites de scroll/navegación; no constituye prueba de navegador.

Comandos desde raíz, con dependencias existentes y sin instalaciones:

```powershell
$env:CI='true'; $env:NG_CLI_ANALYTICS='false'
$r2Runner = Join-Path ([IO.Path]::GetTempPath()) ('yaiku-r2-'+[guid]::NewGuid().ToString('N')+'.mjs')
Set-Content $r2Runner 'export default { test: { maxWorkers: 1, fileParallelism: false } };'
pnpm.cmd --config.manage-package-manager-versions=false --config.auto-install=false --dir frontend test --watch=false --runner-config="$r2Runner"
pnpm.cmd --config.manage-package-manager-versions=false --config.auto-install=false --dir frontend exec tsc --noEmit -p tsconfig.app.json
pnpm.cmd --config.manage-package-manager-versions=false --config.auto-install=false --dir frontend exec tsc --noEmit -p tsconfig.spec.json
pnpm.cmd --config.manage-package-manager-versions=false --config.auto-install=false --dir frontend run build
```

Gestor declarado/disponible y opt-ins: [verificación reproducible](../backend/VERIFICACION.md).
Build productivo/SSR aprobado (382 s, una ruta estática prerenderizada). Advertencias:
bundle inicial 878,97 kB frente al umbral de aviso de 550 kB (sin superar el error
de 1 MB) y dependencias CommonJS de jspdf/canvg. No se alteraron presupuestos ni
dependencias para silenciarlas. El navegador se intentó de nuevo: falló el puente
de conexión antes de abrir la aplicación. No se modificaron
permisos, configuración ni herramientas para sortearlo. Paridad visual no medida.

## Comprobación manual pendiente

1. Con acceso TTAIP autorizado y un expediente sintético, abrir
   `/ttaip/calificar/:expediente`, segunda calificación o resolver según su estado.
   Verificar etiquetas de borrador, reserva/emisión deshabilitadas y su explicación.
2. Abrir resolución/cédulas, ampliar y descargar PDF/Word. Deben decir BORRADOR,
   conservar el expediente y no inventar número, fecha, folios, enlace o firmante.
   Revisar también claro/oscuro, teclado y tamaños de pantalla.
3. En `/ttaip/apelacion/:expediente`, comparar borrador con los documentos de
   Notificaciones: estos deben usar los IDs y bytes autorizados del servidor, sin
   inferir firma/autenticidad de un nombre de archivo o imagen.
4. Provocar error de consulta/descarga, cambiar expediente y reintentar: no debe
   aparecer un sustituto ni una confirmación de emisión. Si una escritura queda
   incierta, consultar el expediente antes de repetirla.

Quedan pendientes la emisión formal con numeración concurrente persistente,
autoría/versionado, documento final, firma verificable, autenticidad y trazabilidad
documental completa. Esta corrección de presentación no cierra todo R2 ni R1/R3/R4.
