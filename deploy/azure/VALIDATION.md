# Preparación Azure: evidencia y límites

## Detalle SAIP con OSIV deshabilitado — 2026-10-30, base cfc9e0c

**El 500 del detalle se reprodujo y corrigió en la nueva imagen backend.**
Esta revisión actualiza ese bloqueo; conserva las evidencias históricas siguientes.
No acredita producción completa, proveedores externos ni capacidad económica/Azure.

### Causa y frontera de lectura

Árbol/índice iniciales limpios en `cfc9e0c5c0f7d7505c6e47e712b51c466898593b`,
rama autorizada. Se reutilizó exclusivamente el proyecto Docker propio y sintético.
Login real y GET por Nginx/HTTPS con CA explícita reprodujeron 500 tanto por ID
como por el alias privado de expediente en la imagen anterior. La excepción fue
`LazyInitializationException` de `Solicitud.documentos` en `SolicitudDTO.from`:
la transacción de `SolicitudService.findById` ya había terminado cuando el
controlador autorizaba y construía el DTO. No se registraron tokens.

`SolicitudService.obtenerDetalle` y `obtenerDetallePorExpediente` ahora consultan,
autorizan y mapean el agregado dentro de una transacción de lectura. El controlador
recibe el DTO terminado. Se reutiliza la autorización por actor/titularidad/entidad;
las colecciones del detalle se recorren después de autorizar. El DTO conserva su
función de mapeo, sin consultas ni lógica de persistencia añadidas.

Se revisaron documentos propios y de respuesta, observaciones, ampliaciones y
cronograma, encauzamientos, liquidaciones y resumen/requerimiento de apelación.
No cambian relaciones, repositorios, EAGER global, OSIV, configuración de carga
fuera de transacción, calendarios ni contratos. No joins entre múltiples colecciones
ni consulta global para completar el recurso. La prueba de cardinalidad comprueba
igual número de sentencias al pasar de 3 a 23 documentos; no constituye un benchmark
de todos los agregados/listados. Otros endpoints que mapean entidades quedan fuera
de esta corrección y no se declaran verificados por este resultado.

### Pruebas backend

Nueva `SolicitudDetallePostgresIntegrationTest`: HTTP real en puerto aleatorio,
login/JWT/filtro/autorización/JPA/PostgreSQL reales, OSIV explícitamente false,
Flyway original sin seed y `ddl-auto=validate`. Fixtures confirmadas mediante
transacciones separadas; ninguna transacción de test mantiene abierta la sesión
HTTP. LOCAL/MOCK solo en esa suite, con push apagado, no como validación prod.

RED: 1 caso ejecutado, 1 fallo esperado (200 requerido, 500 recibido). El primer
intento sobre el target preexistente y su reintento sin compilación incremental no
pudieron compilar varias clases y no acreditan comportamiento. Se preservó ese
árbol y se usó una copia sin target heredado; sin cambiar dependencias/configuración.
Las fuentes probadas coinciden byte a byte con el candidato del repositorio.

Comando final en la copia de backend: `./mvnw.cmd -o test`, con
`RUN_DETAIL_POSTGRES_TESTS=true` y `DETAIL_POSTGRES_URL` apuntando a una DB nueva
propia loopback `yaiku_e11_closeout_<32 hex>` (usuario de prueba `yaiku_e11_test`).
Una única ejecución: **484 casos, 275 aprobados, 0 fallos, 0 errores, 209 omitidos**,
51 archivos de informe, 4:32 min. Los omitidos corresponden a condiciones/opt-ins
ajenos no activados; no se cuentan como aprobados. Los 6 nuevos casos están incluidos:

- Detalle sin documentos para titular y funcionario de su entidad.
- Documentos activos y metadatos por ID/relación, sin duplicados ni documentos
  eliminados/ajenos; respuesta con sus propios archivos, observación, apelación con
  requerimiento sin reloj iniciado y ampliación/cronograma.
- 401 anónimo, 403 ciudadano/funcionario ajenos antes de cargar colecciones y 404
  inexistente, sin filtrar contenido privado en errores.
- Alias privado autorizado y conservación de la proyección pública minimizada.
- Número de consultas independiente del crecimiento de documentos probado.
- Validación de las 11 migraciones originales y ausencia de sesión de test abierta.

El resto de la suite mezcla unidades con Mockito e integración H2/HTTP/MockMvc;
no se presenta como PostgreSQL completo. No suites Angular ni Android repetidas.

### Imagen final y comprobación Docker por HTTPS

Solo backend reconstruido, linux/amd64, usuario `10001:10001`:
`yaiku-local-backend:detail-cfc9e0c-eb018668`.
ID **`sha256:4cf31bf6a4547772343431113c8080fe028250e19ad576ea3e62040dc9f45cb1`**, 454339511 bytes, build 180.25 s; `RepoDigests=[]` local, sin publicar registry.
JAR inspeccionado: 11 migraciones byte a byte, sin seed/fallback JWT ni secretos
sintéticos; `open-in-view=false` y `validate` conservados.
Frontend `sha256:2922a5a989de9f62a8db31003c58fe5f520f66f766672af793f1ab001c1bc3c3`
y proxy `sha256:a08c65a90308ab04e390f753a10d48729e01a4e21779f23e7571316c8a9856cc`
se reutilizaron sin reconstrucción.

Con prod, PostgreSQL/Flyway/validate, S3/SMTP locales TLS de prueba y push apagado:
arranque separado en DB propia original y DB restaurada conservada, sin sobrescribir
ninguna. La restaurada procede del dump probado en la entrega anterior; esta vez
se comprueba su arranque/lectura, no se atribuye otra ejecución de backup/restore.
En ambas bases, Nginx/TLS y login reales confirmaron:

| Comprobación | Resultado en ambas DB |
|---|---|
| Detalle por ID y alias privado | 200, IDs originales y 3 documentos correctos |
| Titular / funcionario de la entidad | 200, Cache-Control no-store |
| Ciudadano / funcionario de otra entidad | 403 |
| Anónimo / recurso inexistente | 401 / 404 |
| Alta sintética sin adjuntos y lectura de su detalle | 200, ambas listas documentales vacías |
| Recepción previa recuperada | Misma recepción, sin recrearla |
| Descarga de los 3 documentos previos | Bytes/SHA-256 del manifiesto original coinciden |
| Consulta pública sin Bearer | Sin asunto, descripción ni documentos privados |
| Esquema e historial | Arranque validate, 11 migraciones originales |

No navegador ni cambios de pantallas, migraciones, Kotlin o snapshots API. No
modificación de roles, estados, recepción ni autorización documental. Pruebas
externas, cierres 137, dimensionamiento Azure y presupuesto continúan separados.
Los datos/evidencias/secretos permanecen privados; procedimiento local de arranque
identifica la nueva imagen y el override, sin contaminar configuración publicada.

Finalización comprobada: seis servicios del proyecto propio y PostgreSQL de test
separado detenidos; puertos de prueba cerrados, tres volúmenes principales y datos
de test conservados. Sin OOM ni reinicios automáticos. Frontend/S3 volvieron a salir
137 al detenerlos; no se investigó ni corrigió ese pendiente en esta entrega.

---

## Stack Docker local — 2026-10-30, base143216e

**Arranque y escenarios locales comprobados; no listo para producción.**
La aceptación económica no cambió. No recursos Azure/DNS ni proveedores/buckets
externos utilizados. El bucket S3 de esta prueba es local, privado y sintético.

Rama `daniel/feat-public-portal-and-registro-alignment`, HEAD inicial
`143216e3a59699f0a8079a30b8d3b295c7186c81`, árbol/índice inicialmente limpios.
Se preservó el candidato publicado. Serena apareció en catálogo, pero su llamada
inicial no devolvió instrucciones; se usó lectura directa. Sin grafo MCP disponible.
No se repitió el diagnóstico histórico del motor, ni se hicieron cambios globales.

### Imágenes y contenido final

Un único gate confirmó Client/Server29.9.2, contexto localdesktop-linux,
Linux/amd64,4CPU y8278065152bytes RAM. Inventario inicial:0contenedores,
0proyectosCompose,2imágenes. No se modificaron imágenes previas ni servicios ajenos.
Builds secuenciales: backend239.05s, frontend437.93s y luego proxy. El proxy se
reconstruyó después del defecto Host demostrado, sin reconstruir backend/frontend.
Los IDs siguientes son locales; `RepoDigests=[]` para imágenes construidas:
no se publicaron imágenes en un registry ni se atribuye un digest de registry.

| Imagen final linux/amd64 | ID | Tamaño bytes (no espacio exclusivo) |
|---|---|---:|
| backend | `sha256:bf49e4d1d819b405429946a450d316710fb11411901e78065eb5f24a166c3fb7` | 454339255 |
| frontend | `sha256:2922a5a989de9f62a8db31003c58fe5f520f66f766672af793f1ab001c1bc3c3` | 414462863 |
| proxy | `sha256:a08c65a90308ab04e390f753a10d48729e01a4e21779f23e7571316c8a9856cc` | 62099370 |

Se conservaron los tags preparados: Temurin25 resolvió25.0.5; Node24.22.1,
Angular22.1.5/SSR22.1.7 y pnpm12.3.4 congelado real en builder. PostgreSQL18.4
permanece fijado; Nginx1.28.3 observado. El JAR final contiene V1,V3–V12 originales byte a byte, sin seed,
perfilesCI/staging ni fallbackJWT. Se inspeccionaron propiedades, manifiesto y149
archivos del outputfrontend: sin secretos de las fixtures, rutas privadas del host,
gobernanza personal, Serena o design-reference. Allowlist de contextos conservada.
No equivale a una auditoría de vulnerabilidades de todas las dependencias/base OS.

Usuarios observados: JavaUID10001, NodeUID1000, PostgreSQLUID999. Nginx conserva
masterUID0 y workersnginx; no afirmar que todo el conjunto es no root. Java pudo
leer los cinco secretos montados y no recibió DB_ADMIN_PASSWORD. Backend/frontend/
proxy con raíz de solo lectura. Ningún secreto sintético/JWT apareció en los logs
inspeccionados. Secretos, CA/truststore, cuentas, dumps y resultados detallados
permanecen fuera del repositorio y de los contextos Docker.

### Perfil prod y proveedores de prueba

Orden: proveedores locales aislados, PostgreSQL → backend → SSR → Nginx.
`prod`, Flyway original y `ddl-auto=validate`, rol app sin SUPERUSER/CREATEDB/
CREATEROLE, pool5 y límites preparados; no LOCAL/MOCK, seeds ni controles relajados.
Al terminar Flyway había11migraciones correctas y0cuentas/0entidades, antes de las
fixtures operadas. Las cuentas únicas se registraron porHTTP; los funcionarios y
el catálogo se prepararon como datos sintéticos aislados, nunca cuentas reales.

S3 local: SeaweedFS4.51 con credenciales propias y TLS; acceso anónimo403.
SMTP: Mailpit1.32.0 con STARTTLS requerido y autenticación; un comando institucional
real de Spring produjo1mensaje capturado. No relay ni destinatarios reales.
CA de prueba confiada explícitamente por el cliente y por un truststore privado
solo del backend; confianza por defecto rechazó el certificado. No `--insecure`,
`NODE_TLS_REJECT_UNAUTHORIZED=0`, importación global o bucket público.
Esto valida transportes/adaptadores locales, **no Supabase ni entrega externa SMTP**.
La configuración de prueba/CA no se incorpora al Compose de producción ni imágenes.

### Escenarios reales (HTTP, seguridad, JPA y almacenamiento)

| Escenario | Resultado final y alcance |
|---|---|
| `nginx -t`, health y HTTPS | Correctos; configuración comprobada es la generada y usada por el master |
| Home/documentación/login/acceso interno/deep link ciudadano |200HTML con no-store; Node/SSR real y modos Prerender/Client existentes. No navegador ni guard evaluado porDOM |
| API bajo mismo origen | Ayuda200, acceso sinBearer401, Swagger404. TLS válido con confianza explícita |
| Host ajeno |421 en HTML yAPI tras corrección; origen legítimo200 |
| Login y autorización | JWT real; metadatos/descarga del titular y funcionario de su entidad200; ciudadano/entidad ajenos403. No usar esto para dar por aprobado el detalle genérico fallido |
| JWT manipulado / logout individual |401; logout204 y otra sesión del mismo usuario permanece válida |
| Recepción coordinada con3archivos |1solicitud/1recepción/3documentos, IDs y asociaciones explícitas; bytes ySHA256 descargados coinciden |
| Recuperación/repetición/conflicto | GET y POST compatible mantienen IDs; contenido incompatible409;3repeticiones concurrentes conservan1:3:1. No es una nueva prueba de carrera de alta inicial ni de corteHTTP poscommit |
| Límites multipart | Archivo>10MiB y petición>11MiB rechazados413, sin escrituras nuevas |
| Denegación real de escritura S3 |500 y recepción404, sin nuevos registros ni objetos. Se restauró el permiso del proveedor de prueba; no se modificó autorización de la aplicación |
| Backup binario separado |3objetos copiados/verificados;1retirado intencionalmente produjo404 sin sustituto, restaurado bajo la misma key eID con bytes/hash correctos. No reparación duradera automática |
| Parada deliberada backend |Quedóexited conRestartCount0;API502 y datos intactos. No reenvíos del proxy ni escrituras duplicadas observadas; no cliente Angular/browser activo probado |
| `stack.py backup` y `restore` |Dumpcustom/SHA256, DB nueva propia;11versiones/checksums idénticos; backend arrancó convalidate sobre la restaurada y recuperó misma recepción/3descargas. S3 estaba disponible por separado |
| Parada/arranque PostgreSQL |Volumen conservado, mismo1:3:1 y recepción recuperable. No reinicio global del daemon ni simulación de pérdida de VM |
| **Detalle privado SAIP** |**FALLIDO:500**, reproducido también después de restaurar. No ocultado ni corregido fuera de alcance |

Se conservaron evidencias negativas de la preparación: la restricción adicional
`internal:true` del harness impedía entrada loopback aunque los listeners internos
estuvieran listos; al volver a la redapplication del Compose preparado funcionó.
Solo se recreó el proyecto propio, sin borrar volúmenes. No defecto del Composebase.
Una fixture SQL omitió `estado=Activa`; el servidor la rechazó409 sin efectos.
Se corrigió únicamente esa fixture según `Entidad.onCreate`. Tras reiniciar S3,
una lectura demasiado temprana fallóTLS; se esperó su disponibilidad conGET seguros,
sin repetir escrituras ni desactivar validación. No se cuentan como éxitos originales.

### Defecto demostrado y corrección de despliegue

Antes de corregir, `Host: untrusted.test` devolvía400 enHTML pero200 enAPI: la
allowlist de Angular no protegía las rutas proxy/backend. Nginx ahora genera una
allowlist exacta desde PUBLIC_ORIGIN al arrancar, sin usar cabeceras del visitante
como configuración. Rechaza entradas inseguras y Host ajeno con421 en todo el
listenerTLS; health8081 permanece interno. No se cambiaron contratos de operaciones
válidas, autenticación ni upstreams. La plantilla y el entrypoint de la imagen final
se compararon byte a byte con las fuentes revisadas; LF garantizado por atributos.

Ejecución final única, con el opt-in de imagen construido:

```sh
RUN_PROXY_IMAGE_TESTS=true PROXY_TEST_IMAGE=yaiku-local-proxy:RELEASE \
  python -B -m unittest discover -s deploy/azure -p 'test_*.py' -v -f
```

**23/23**,0fallos/omitidos,85.868s:4pruebas Docker reales del entrypoint (con
subcasos de origen/puerto/inyección/raíz read-only) y19locales de cálculo/operación
con mocksCLI y archivos temporales. Sin opt-in, las4deimagen se omiten y deben
reportarse como tales. Las comprobaciones HTTP anteriores son casos de scripts
privados, con reejecuciones explícitas; no se suman como una suite general nueva.
No suites Angular/backend nativas repetidas: su código/contratos no cambiaron.

### Bloqueo de aplicación que conserva el control prod

`GET /api/solicitudes/{id}` del titular devuelve500:
`LazyInitializationException: Solicitud.documentos (no session)` en
[SolicitudDTO.from](../../backend/src/main/java/pe/gob/saip/backend/model/dto/SolicitudDTO.java),
llamado desde
[obtenerPorId](../../backend/src/main/java/pe/gob/saip/backend/controller/SolicitudRestController.java).
El perfilprod publicado ya contiene `open-in-view=false`; esos archivos Java y
propiedades no cambiaron en esta entrega. El DTO se construye fuera de la sesión
que necesita la colección. No es un fallo de proxy, TLS o esquema validate.
Se requiere una corrección transaccional/proyección acotada con sus pruebas de
seguridad y persistencia en una entrega de backend. No se habilitó OSIV, se cambió
el DTO, se fabricó expediente ni se degradó la validación para conseguir200.

### Recursos observados y finalización

Docker Desktop4CPU/8278065152bytes. 143muestras de servicios propios durante
arranque y operaciones: máximo concurrente observado de623.7MiB para los4
principales y701.3MiB conS3/SMTP. Pico de sumaCPU340.55% (aprox.3.41núcleos).
Son muestras de `docker stats`, no suma de máximos individuales ni carga sostenida.
`memory.peak` actual y OOM/restarts se guardaron por contenedor; no OOM ni reinicios
automáticos observados. Dataset mínimo:4cuentas,1solicitud,3documentos.

DBorigen10778303bytes, restaurada10819263bytes; cluster PostgreSQL76MiB
y almacenamiento S3 alrededor de340KiB en ese instante. No tamaño previsto de
producción ni dimensionamiento deWAL/backups/crecimiento. Las tallas de imágenes
no son espacio exclusivo por compartir capas. No se redujeron límites/discos.
**No acredita una VM Azure2vCPU/4GiB**, su OS/daemon, CPU burst, arranque bajo carga,
fallos de disco, RPO/RTO ni recuperación ante crash. La aceptación económica sigue
pendiente conforme aCOSTS; no se eligió otroSKU por estas mediciones.

Al terminar: seis servicios propios detenidos, puertos loopback cerrados,
tres volúmenes propios y ambas DB conservados. Imágenes/CA/dump/binarios/fixtures
privados retenidos para reproducción; no down-v, prune ni servicios ajenos tocados.
Inspección posterior a la parada: backend salió con143; proxy/DB/SMTP con0;
frontend y S3 local con137. Todos con `OOMKilled=false`, `RestartCount=0` y sin
error de estado Docker. No se presenta el137 como OOM ni cierre limpio: queda
pendiente revisar el cierre por señal del SSR y del proveedor de prueba. No se
reinició el conjunto para investigar fuera de esta validación.
Sin navegador, Azure, Android ni despliegue. Pendientes antes de aprobar producción:
resolver el500 del detalle, Supabase/SMTP externos autorizados, TLS/dominio real,
backup externo/recuperación operada, dimensionamiento y presupuesto aceptados.

---


## Revisión 2026-10-30 sobre el candidato60cb405

Rama `daniel/feat-public-portal-and-registro-alignment`,
HEAD inicial `60cb4059fe356a263300cba77aeae4848f376e77`; índice y árbol versionables
inicialmente limpios. Se preserva lo publicado y la evidencia nativa anterior.
No herramientas Serena/grafo disponibles en esta sesión; lectura directa de
configuración/documentación. No recursos Azure/DNS/buckets ni despliegue.

### Motor: comprobación previa fallida, sin builds

| Operación acotada | Resultado actual |
|---|---|
| Archivo cliente Docker | Metadatos de `docker.exe`:29.9.2; no asumir la29.5.3 histórica |
| `docker --version` / `docker compose version` | Cada consulta agotó20s; versión efectiva Compose actual no confirmada |
| `docker context show` | `desktop-linux`, exit0 |
| `docker context inspect desktop-linux --format '{{.Endpoints.docker.Host}}'` | Pipe local `npipe:////./pipe/dockerDesktopLinuxEngine`, exit0 |
| `docker version --format '{{json .Server}}'` | Exit1, Server=null, pipe ausente: `open //./pipe/dockerDesktopLinuxEngine: El sistema no puede encontrar el archivo especificado` |
| Comprobación tras cambio externo de estado | Aparecieron procesos Docker Desktop/backend; una única consulta explícita al contexto local agotó20s. No se atribuye el cambio al agente |
| Recursos del daemon | No se pudo obtener CPU/RAM/arquitectura; `docker info` no ejecutado después del fallo del gate |
| Builds e inspección de las tres imágenes | No ejecutados. Sin digest nuevo, inventario ni inspección de contenido acreditados |
| Compose/`prod`, secretos no root, Flyway/validate | No ejecutados en Docker en esta revisión |
| `nginx -t`, TLS, login/API, deep links, Host/no-store/multipart | Bloqueados en el conjunto; no sustituir por HTTP nativo histórico |
| S3/SMTP local, recepción/bytes/hash | No proveedores ni proyecto Compose iniciados; no bucket externo usado. No LOCAL/MOCK para aparentar aprobación de `prod` |
| Reinicio, volumen, backup/restore mediante `stack.py` | Bloqueados en Docker. La restauración nativa anterior no cuenta como ejecución nueva de esos scripts sobre Compose |

No reinicio global de Docker/WSL, prune, eliminación de volúmenes, cambio de
permisos/configuración ni despliegue en Azure para sortearlo. No se arrancó ningún
servicio propio ni se detuvieron servicios ajenos. No nuevas suites Angular,
backend o PostgreSQL: no cambios de producto que las justifiquen.

**Acción requerida del dueño del equipo:** revisar Docker Desktop ya abierto,
completar el arranque del motor Linux y obtener el estado Engine running con los
controles actuales. Coordinar primero cualquier intervención con los otros
proyectos. Si queda Starting/Error, registrar el mensaje de la interfaz/diagnóstico
antes de decidir una reparación; no factory reset, eliminación de discos ni prune.
Después, comprobar que los dos comandos siguientes responden correctamente; su
salida confirma salud/contexto, no aprobación del stack:

```powershell
docker --context desktop-linux version
docker --context desktop-linux info --format 'Version={{.ServerVersion}} Arch={{.Architecture}} CPU={{.NCPU}} RAM={{.MemTotal}}'
```

Solo con ese gate aprobado, repetir la construcción/ejecución propia descrita al
final del informe. No iniciar builds mientras el motor no responde.

### Corrección económica y pruebas acotadas

[COSTS.md](COSTS.md) sustituye la conclusión anterior: fijo anual101.40USD y
121.37USD/año a480h/año, antes de exclusiones. Tarifas públicas refrescadas al
2026-10-30, sin consulta de beneficios acreditada. `az.cmd` está ahora presente;
la lectura de sesión agotó25s. No se ejecutó login ni mutación de cuenta.

`pricing.py` publica fijo/total/horas anuales antes del redondeo, conserva los dos
discos y exige opt-in separado de grantsACA y PG; horas facturadas de IP son un
escenario explícito, nunca eliminación automática. Una reproducción RED mostró
el descuento implícito de ACA y la ausencia de los campos anuales. Los nuevos
casos verifican importes, límites y semántica del CLI; son cálculo local sin Azure.
Ejecución final única:
`python -B -m unittest discover -s deploy/azure -p 'test_*.py' -v`:
**19/19**,0 fallos/omitidas,0.696s (7 de cálculo y12 operacionales existentes).
No se suman las ejecuciones RED/GREEN previas. Los comandos Docker del script
operacional están mockeados; integridad/retención usa archivos temporales reales.
No son pruebas de contenedores, seguridad backend, PostgreSQL/S3 o Azure.
Los cuatro ejemplos CLI de COSTS se verificaron contra las tablas; links locales
y `git diff --check` correctos. Sin nueva suite nativa o Angular.

---

## Evidencia histórica de la preparación anterior (no repetida)

Revisión 2026-10-29/30, base `36b974d27995dd70cc3914442252b1c23c6e9ce3`.
No recursos Azure, DNS, buckets ni servicios externos creados/modificados.
No despliegue. Secretos, bases, certificados y logs de prueba permanecen privados.

## Alcance real

| Comprobación | Resultado / límite |
|---|---|
| Compose final | `stack.py --env-file /PRIVATE/test.env config`: exit0, `config --quiet`; no expansión de secretos publicada |
| Operación/backup | `python -B -m unittest discover -s deploy/azure -p test_stack.py -v`: 12/12. Mocks del CLI; integridad/retención sobre archivos temporales reales. No prueba un daemon Docker |
| PowerShell | Parser de `vm-power.ps1` sin errores. Azure CLI ausente; ningún comando cloud ejecutado |
| Backend | `./mvnw.cmd -o -Dtest=ProductionConfigurationValidatorTest,StorageProviderConfigurationTest test`: 7/7, sin omisiones; pruebas de configuración, no integración S3/SMTP |
| PostgreSQL nativo18.4 | Cluster nuevo loopback, rol app sin superusuario, DB propia; init SQL de roles probado con ruta de secreto local equivalente. No equivale a ejecutar el entrypoint Bash de la imagen |
| Flyway/JPA | Spring completo, PostgreSQLDialect explícito, Flyway original con 11 migraciones V1,V3–V12, sin seedV2, `ddl-auto=validate`; arranque correcto tanto origen como restauración |
| Backup/restore real | `pg_dump -Fc --no-owner --no-acl`, SHA256/manifiesto, `createdb` nuevo y `pg_restore --role=APP --single-transaction --exit-on-error --no-owner --no-acl`; fila sintética e historial recuperados, nuevo contexto Spring/validate correcto |
| HTTP backend nativo | Ayuda pública200, solicitud privada sin Bearer401, Swagger404. LOCAL propio y MOCK; **no perfil prod ni S3/SMTP reales** |
| Nginx imagen | Build correcto, ID `sha256:acf1af6687643f1db9dd2ccd19a2ff84a2ffd1a349553535e6a9137d3db1d9a5`; no se ejecutó `nginx -t`, proxyTLS ni stack completo |
| Frontend imagen | pnpm12.3.4 congelado instaló el lock; build SSR comenzó. Sin imagen final verificada |
| Backend imagen | Maven comenzó construcción/descargas. Sin imagen final verificada; eliminación de fallback JWT del artefacto no inspeccionada en JAR final |
| S3/SMTP | No recepción/descarga S3 ni entrega SMTP ejecutadas. No buckets/canales existentes usados. Push deshabilitado |
| Reinicio/conservación | Dump/restore nativo probado; reinicio de contenedores/volumen y recuperación tras corte pendientes |
| Navegador/Android | No ejecutados. HTTP y jsdom no acreditan interfaz, renderizado PDF ni compatibilidad Android |

La prueba nativa utiliza el artefacto backend de la base publicada (Java sin
cambios), perfil de prueba con PostgreSQL/Flyway/validate y LOCAL/MOCK explícitos.
No valida la imagen reducida, `prod`, sus secretos montados ni proveedores externos.
La primera configuración auxiliar heredaba dialectoH2 y falló validación; se
corrigió únicamente el launcher aislado para PostgreSQL, sin cambiar migraciones
ni producto. No se cuenta ese intento como arranque válido.

## SSR y verificaciones Angular

Se conserva `environment.ts` original en un candidato aislado. Browser producción
usa `/api`; interceptor exclusivo SSR transforma solo ese prefijo mediante
`API_INTERNAL_ORIGIN`. No se resuelve backend desde el Host de visitantes.
Pruebas HTTP controladas validan el origen, preservación de método/body/headers
y rechazo de configuraciones indebidas; usan HttpTesting, no red real.

Un HTTP real al build SSR mostró400 por host no autorizado, incluida la dirección
del health check. Se añadió lista explícita desde `PUBLIC_ORIGIN` y loopback,
con pruebas de rechazo de origen inseguro y sin comodín/desactivar SSRF.
Esto prepara el runtime configurable, no altera login, guards ni modos de rutas.
La política corresponde a [AngularNodeAppEngineOptions](https://angular.dev/api/ssr/node/AngularNodeAppEngineOptions),
contrastada también con los tipos instalados22.1.x.

Comandos sobre el candidato, sin reinstalar dependencias:

```sh
node node_modules/@angular/cli/bin/ng.js test --watch=false --runner-config=/PRIVATE/serial.vitest.mjs
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.spec.json
node node_modules/@angular/cli/bin/ng.js build
```

Runner temporal: `export default {test:{maxWorkers:1,fileParallelism:false}}`.
Sin selección de archivos, skips, cambio de timeout, dependencias ni presupuestos.
La ejecución normal previa abortó con `Worker exited unexpectedly`; no representa
una suite completa. Un guard de almacenamiento falló en esa ejecución incompleta
y pasó sin cambios en diagnóstico serial. No se demostró una causa histórica de
versiones, caché o memoria; no se cambió la configuración del repositorio.

Ejecución general final: **1962/1962**,72 archivos,0 fallos/omitidos; duración156.59s.
No se suman diagnósticos ni ejecuciones anteriores. Tipos app/spec: exit0.
Node24.22.1, pnpm disponible11.25.0 frente al12.3.4 declarado, Java25.0.4 y
Python3.14.8. El candidato reutiliza node_modules disponibles; la instalación
congelada pnpm12 solo se comprobó en la etapa de build de imagen indicada arriba.
Build de producción: exit0, SSR/prerender conservados; advertencias existentes de
tamaño/CommonJS sin cambiar presupuestos. HTTP real al servidor Node final:
`/`, `/documentacion`, `/login`, `/acceso-funcionario` y
`/funcionario/solicitud/123` devuelven200/HTML con Host configurado y
`Cache-Control: private, no-store`; health loopback/login200 y Host ajeno400.
Son siete comprobaciones HTTP, no navegación/renderizado ni login autenticado;
el detalle protegido200 es el shell Client, no datos privados sin autorización.
No atraviesan Nginx/TLS ni prueban el proxyAPI bajo el mismo origen.

## Bloqueo Docker demostrado

Cliente29.5.3/Compose5.1.4 presentes; daemon inicialmente accesible tras abrir
Docker Desktop ya instalado. Después respondió HTTP500 en consultas independientes
y `docker version`/`docker info` excedieron20s en comprobaciones acotadas. Los
clientes de build propios terminaron con EOF/Unavailable al detenerlos; ese EOF
por sí solo no demuestra la causa del fallo del motor. No reinicio global, prune,
cambio de permisos/configuración ni eliminación de volúmenes para desbloquearlo.

La imagen Nginx construida no acredita su configuración en ejecución. Las imágenes
backend/frontend, TLS/multipart completo, S3, SMTP y reinicios quedan pendientes.
No se publica una declaración de stack listo para producción por los tests nativos.

## Repetición antes de autorizar despliegue

1. Recuperar un daemon local saludable mediante operación del dueño del entorno;
   construir las tres imágenes finales y registrar digest/amd64.
2. Crear únicamente proyecto/DB/bucket local propios de prueba; no quitar controles
   de `prod` para fingir SMTP. Una captura SMTP aislada en test no acredita entrega
   externa ni autoriza su uso en producción.
3. Validar secretos montados legibles por procesos no root, init Bash, Flyway,
   validate, health y `nginx -t`; HTTPS, enlaces profundos, login/API, límites
   multipart y no-cache reales por proxy.
4. Probar recepción/recuperación/bytes/hash vía adaptador S3 privado de prueba,
   rollback/compensación y reinicio de contenedores sin pérdida; no afirmar
   atomicidad distribuida ni reparación duradera tras un crash.
5. Ejecutar `stack.py` backup/restore sobre ese proyecto detenido, levantar una app
   aislada apuntando a la DB restaurada y verificar además el inventario binario.
6. Revisar beneficios/cuotas/región/capacidad y los insumos de [README](README.md)
   antes de autorizar recursos. Ninguno se crea desde esta documentación.
