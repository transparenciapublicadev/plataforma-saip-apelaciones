# Preparación Azure: evidencia y límites

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
