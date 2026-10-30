# Yaiku: preparación de despliegue Azure

**No crea recursos ni despliega.** Opción preparada: VM Linux amd64/Compose,
NginxTLS → Angular SSRNode24 → Spring Boot4/Java25 → PostgreSQL18 y S3 privado
externo desde backend. [Comparación económica](COSTS.md). La opción Container Apps
es una alternativa evaluada, no un segundo despliegue ya implementado.

**Decisión económica pendiente:** los dos discos e IPv4 retenida suman101.40USD/año
incluso desasignada. Esta configuración no cumple un año con100USD; las alternativas
de [COSTS.md](COSTS.md) requieren validación y no cambian el stack automáticamente.

**Stack local ejecutado; despliegue bloqueado:** imágenes, transporte y persistencia
ya se comprobaron en Docker. El detalle privado SAIP devuelve 500 con el perfil
`prod`; proveedores externos, dimensionamiento Azure y presupuesto siguen pendientes.
Ver [resultados y bloqueos](VALIDATION.md) antes de autorizar recursos.

Se conservan Angular22/TypeScript6, SSR/Express, API, autenticación pública/interna,
transiciones y recepciones. Browser usa `/api`; solo SSR resuelve ese prefijo a
`API_INTERNAL_ORIGIN=http://backend:8080`. Nunca usa el Host entrante para decidir
el backend ni obtiene JWT desde almacenamiento del servidor. Páginas protegidas
siguen RenderMode.Client; home/documentación/acerca conservan el modo existente.

## Antes de autorizar recursos

Faltan saldo/vigencia/grants Students, región permitida/cuotas/SKU, dominio y
certificado, CIDR del operador, SMTP real/remitente, proyecto/bucket/credenciales
S3, retención/RPO/RTO y responsable operativo. No se conectó una cuenta Azure ni
se cambió DNS/Supabase/SMTP. Las pruebas locales no justifican activar proveedores
externos ni cargar datos personales reales.

Además, producción nueva no trae cuentas/entidades demo. Definir primer
administrador y catálogo institucional mediante inicialización operada y revisada,
con BCrypt único, transacción y credenciales privadas. No hay contraseña compartida
ni bootstrap público nuevo. No reutilizar el seedV2 de desarrollo para resolverlo.
Este paso de datos iniciales debe aprobarse antes de abrir el servicio al público.

## Construcción fuera de la VM

Contextos: `backend/`, `frontend/`, `deploy/azure/nginx/`, cada uno con allowlist
`.dockerignore`. No usar el monorepo como contexto. No incluir `.git`, agentes,
Serena, design-reference, node_modules del host, logs, DB, secretos o backups.
El entrypoint PostgreSQL conserva LF mediante atributos locales del directorio;
el builder normaliza CRLF del wrapper Maven sin modificar su fuente ni versión.

```sh
docker build --platform linux/amd64 -t yaiku-backend:RELEASE backend
docker build --platform linux/amd64 -t yaiku-frontend:RELEASE frontend
docker build --platform linux/amd64 -t yaiku-proxy:RELEASE deploy/azure/nginx
docker save -o /PRIVATE/images-RELEASE.tar yaiku-backend:RELEASE yaiku-frontend:RELEASE yaiku-proxy:RELEASE
# Transferencia posterior autorizada a la VM; no se ha ejecutado aquí:
docker load -i /PRIVATE/images-RELEASE.tar
```

Backend multietapa usa JDK/JRE25; builder Maven wrapper3.9.12. El artefacto
contenedor excluye `db/seed`, perfilesCI/staging y fallback JWT de desarrollo.
Migraciones originales no cambian; `prod` usa solo `classpath:db/migration`,
Flyway y validate. Una DB nueva aplica V1,V3–V12; no se fabrica V2 para rellenar
la secuencia. Una DB con historial previo de seed necesita plan específico, no
se reutiliza automáticamente. Tests no se incluyen/ejecutan en la imagen.

PostgreSQL separa `POSTGRES_USER` operador de `DB_APP_USER` aplicación: el último
posee su DB/esquema para Flyway, sin SUPERUSER/CREATEROLE/CREATEDB/REPLICATION.
El init script se ejecuta solo sobre volumen vacío, en transacción y sin imprimir
la contraseña. Un volumen ya inicializado no se modifica para cambiar roles o
passwords mediante variables: necesita una operación revisada aparte.

El volumen nombrado reside en el data-root de Docker: Compose no monta ni elige
un disco Azure por sí mismo. Antes de desplegar, el operador debe comprobar que
ese data-root/volumen está sobre el disco persistente previsto, no sobre disco
temporal de la VM, y registrar su montaje. Esta tarea no cambia la configuración
global de Docker ni mueve datos. Los dos discos del presupuesto son un supuesto
del diseño, no dos discos ya creados o montados por estos archivos.

Frontend instala pnpm12.3.4 conforme al manifiesto/lock/workspace y ejecuta build
SSR real; runtime Node24.22.1 con dependencias de producción y usuario no root.
No `ng serve`, `outputMode=static`, cambio de stack o presupuesto. Builds locales
nativos con pnpm11 disponible no prueban por sí solos el install Linuxpnpm12.
No se publican imágenes en un registry en esta tarea; save/load evita ACR pagado.
Registrar digest/arquitectura de la release; revisar actualizaciones de bases antes
de cada despliegue. No usar el tag `prepared` como versión aprobada a futuro.

## Configuración privada

Copiar [runtime.env.example](runtime.env.example) **fuera del checkout**, por
ejemplo `/opt/yaiku-private/runtime.env`. El archivo contiene opciones/paths,
no contraseñas. Directorios de secretos/backup/TLS fuera de contextos, permisos
solo del operador/servicio. En Linux, directorios0700; los archivos que Compose
monta en procesos no root deben ser legibles por ellos (0444 dentro del directorio
privado no atravesable por otros usuarios). TLS/backup0600. Compose no reasigna
uid/gid para secrets basados en archivos; no dejar0600 del operador y asumir que
Java10001 los puede leer. No abrir el directorio padre a otros usuarios. Docker local
tiene privilegios para montarlos: acceso al socket equivale a administrar el host.

Archivos requeridos dentro de `YAIKU_SECRETS_DIR`:

| Archivo | Fuente / significado |
|---|---|
| DB_ADMIN_PASSWORD | Aleatorio de inicialización/operación PostgreSQL; solo contenedorDB, nunca backend |
| DB_PASSWORD | Aleatorio del rol de aplicación DB_APP_USER, distinto del administrador |
| JWT_SECRET | Nuevo aleatorio≥64bytes, sin clave de desarrollo; conservar entre reinicios, rotar solo mediante plan de sesión |
| APP_STORAGE_S3_ACCESS_KEY | Credencial S3 de servidor; no anon key de frontend |
| APP_STORAGE_S3_SECRET_KEY | Secreto S3 de servidor |
| SPRING_MAIL_PASSWORD | Credencial de un SMTP real revisado |

Spring importa `configtree:/run/secrets/` y resuelve los placeholders actuales
desde esos archivos. No hay ARG/ENV con valores secretos en Dockerfiles ni
credenciales dentro de imágenes. Compose secrets local son archivos montados,
no un vault cifrado; respaldarlos separadamente de forma privada. No ejecutar
`docker compose config` sin `--quiet`, imprimir `.env`, `docker inspect` completo
o activar logs de cuerpos/tokens. Scripts nunca hacen `source`/`shell=True`.

`PUBLIC_ORIGIN` debe ser HTTPS de origen único, y se usa como allowlist CORS
sin comodines y como hostname explícito del motor SSR. Solo se añaden localhost
y 127.0.0.1 para health checks internos; el motor SSR conserva su rechazo 400
para hosts ajenos cuando se consulta directamente dentro de su red.
No desactivar la validación SSRF ni usar `NG_ALLOWED_HOSTS=*`.
El proxy también exige ese origen al arrancar y permite únicamente su hostname en
el listener TLS: un Host ajeno recibe 421 tanto en HTML como en `/api`. El health
check 8081 sigue interno. La plantilla se genera en `/tmp` con raíz de solo lectura;
`nginx -t` utiliza ese mismo archivo. No se confía en un Host del visitante para
generar configuración ni elegir upstream. Se probó entrada por IPv4 loopback;
la validación sintáctica de IPv6 no acredita conectividad IPv6 real.
`API_INTERNAL_ORIGIN` es solo del contenedor SSR; no aparece en
configuración pública y no sustituye el control de autorización Spring.

### Supabase Storage

Bucket **privado**. Copiar endpoint/region/bucket reales y usar
`APP_STORAGE_PROVIDER=s3-compatible`, path-styletrue. Variables exactas y límites
están en Compose; no usar `service_role`/anon como sustituto de un par S3.
[Credenciales S3 Supabase](https://supabase.com/docs/guides/storage/s3/authentication)
son exclusivamente servidor y, según esa documentación, omiten RLS y acceden a
los buckets del proyecto. No afirmar aislamiento por bucket de la clave: evaluar
proyecto dedicado, custodiar/rotar credenciales y mantener autorización en backend.
La app descarga por sus endpoints autorizados, sin hacer público el objeto.

No se cambia a LOCAL efímero si falla S3. Metadatos/huellas/asociaciones se
conservan en PostgreSQL; fallos/inciertos mantienen su semántica de recepción.
Un S3 compatible local prueba el adaptador, no el servicio Supabase real. Probar
Supabase requiere bucket de pruebas expresamente autorizado, no uno existente.

### SMTP y push

`ProductionConfigurationValidator` **exige SMTP** y rechaza MOCK en `prod`.
No existe modo de notificaciones deshabilitadas compatible con ese perfil.
Se mantiene ese control: faltando host/usuario/password/remitente real/TLS, no
arrancar ni desplegar fingiendo que los mensajes llegan. El ejemplo queda vacío
a propósito. Habilitar SMTP requiere servicio/canal/remitente reales y validación
de entrega separada. Si se quiere desplegar con email apagado, hace falta una
decisión/entrega específica del modo deshabilitado; no se implementó aquí.

FCM está explícitamente deshabilitado y no se incluyen sus credenciales. Casilla
externa sigue pendiente del contrato oficial. No se afirma disponibilidad de esos
canales por existir un registro de actuación ni una respuestaHTTP200.

## TLS, proxy y exposición

Solo Nginx se publica; por defecto en **loopback9443**. No puertos host para DB,
Spring o Node. En un despliegue aprobado, seleccionar bind/IP/443 y NSG:
443 para visitantes; SSH22 solo CIDR del operador y claves, sin contraseñas;
denegar5432/8080/4000/8081 desde Internet. No asumir que firewall del guest basta
si Docker publica un puerto. No se aplicaron reglas ni creó IP pública.

Montar `fullchain.pem` y `privkey.pem` desde `YAIKU_TLS_DIR`. Nginx aceptaTLS1.2/1.3;
no HTTP público sin cifrar. Elegir dominio/certificado/renovación antes del alta;
ACME DNS/renovaciones quedan operadas, no cuentas/DNS creados por estos archivos.
El certificado autogenerado de un test local no es un certificado de producción.

No hay caché compartida de HTML/API privados: `private,no-store` en proxy y páginas
dinámicasNode. Cabeceras forwarding se reconstruyen en el proxy, no se confía en
X-Forwarded-For aportado por el visitante. Swagger/H2 se deshabilitan en prod y
se bloquean también en el proxy. Admin conserva autenticación/rol backend; rutas
de acceso público/interno distintas. La navegación a `/admin` no otorga permisos.
Antes de abrir, revisar si se requiere además VPN/allowlist administrativa.

Multipart: máximo actual10MiB por archivo/11MiB por petición se conserva; Nginx11m.
Varios archivos deben caber en el total; no se amplía a10MiB por cada uno.
Timeouts proxy120s, conexión10s; no retry automático de POST. Un timeout no prueba
rollback: consultar la misma operación. DNS Docker se reevalúa tras recrear apps.
Health del proxy solo acredita su listener, ayuda públicaSpring acreditaHTTP y
Node/login acredita servidor SSR/CSR; ninguno acredita S3/SMTP/DB por sí solo.

## Operación local / VM existente autorizada

Python3.11+ y DockerCompose disponibles. Usar una identidad de proyecto `yaiku-`
única y envfile fuera del repositorio. Solo socket Docker local; el script rechaza
contextos remotos para no convertir una comprobación en despliegue accidental.

```sh
python deploy/azure/stack.py --env-file /PRIVATE/runtime.env config
python deploy/azure/stack.py --env-file /PRIVATE/runtime.env build
python deploy/azure/stack.py --env-file /PRIVATE/runtime.env start
python deploy/azure/stack.py --env-file /PRIVATE/runtime.env status
python deploy/azure/stack.py --env-file /PRIVATE/runtime.env stop --service proxy
python deploy/azure/stack.py --env-file /PRIVATE/runtime.env stop --service backend
python deploy/azure/stack.py --env-file /PRIVATE/runtime.env start --service backend
python deploy/azure/stack.py --env-file /PRIVATE/runtime.env stop
```

Start completo espera salud en ordenDB→backend→frontend→proxy y nunca construye
por sorpresa. Inicio de un servicio conserva depends_on; un fallo no borra datos.
Stop completo invierte orden. No `down -v`, eliminación de disco, prune global,
autoupdates, cambios de firewall ni Azure create en estos scripts. `restart:
unless-stopped` preserva la parada deliberada. Al encender la VM, iniciar el
conjunto explícitamente; no prometer que `az vm start` ejecute este procedimiento.

Después, y solo con una VM ya autorizada:

```powershell
./deploy/azure/vm-power.ps1 -Action Status -Subscription SUB -ResourceGroup RG -Name VM
# Primero parar el stack y comprobar que terminó; luego:
./deploy/azure/vm-power.ps1 -Action Deallocate -Subscription SUB -ResourceGroup RG -Name VM -AllowPowerChange -ServicesStopped
./deploy/azure/vm-power.ps1 -Action Start -Subscription SUB -ResourceGroup RG -Name VM -AllowPowerChange
```

Ninguno se ejecutó contra Azure. Parar contenedores o apagar Linux **no** equivale
a desasignar; discos/IP siguen facturando. Consultar estado `deallocated`, saldo y
costos. Deallocated puede liberar capacidad: reiniciar B2s podría no ser inmediato.
Sin RTO medido no se ofrecen minutos garantizados.

### Schedulers y operaciones en curso

Cron existente: auditoríaSAIP06:00, subsanaciones01:00, zona del proceso. Contenedores
declaranAmerica/Lima para evitar heredarUTC del host; no cambia duración/calendario.
Detenido backend no ejecuta tareas; no hay catch-up al startup implementado. La
siguiente ejecución consulta fechas persistidas, no pausa plazos ni inventa
notificaciones. Revisar actuaciones vencidas con comandos/autorizaciones existentes.
ACA escalado a0 tiene el mismo límite; mantener réplica cambia costo y tampoco
añade por sí solo una garantía de ejecución.

Antes de parar, impedir nuevas entradas y dejar terminar recepciones. La cancelación
HTTP/SIGTERM no acredita rollback. Los períodos de parada no garantizan atomicidad
DB/S3 ante SIGKILL/corte: preservar claves de operación y recuperar al volver.
Compensación normal existente no equivale a reparación duradera tras crash; esa
deuda sigue separada. No simular reenvío para cerrar una operación incierta.

## Backup y recuperación

`YAIKU_BACKUP_DIR` debe estar fuera de checkout/contextos, en disco persistente
privado. Parar backend/escrituras primero para coordinar DB y objetos. El dump
custom usa una instantánea PostgreSQL, SHA256 y manifiesto; default7copias, máximo
31 configurables. No scheduler de backup automático: asignar frecuencia/responsable
y exportar copias cifradas fuera de VM, con permisos y retención acordados.

```sh
python deploy/azure/stack.py --env-file /PRIVATE/runtime.env stop --service backend
python deploy/azure/stack.py --env-file /PRIVATE/runtime.env backup --keep 7
python deploy/azure/stack.py --env-file /PRIVATE/runtime.env restore --dump /PRIVATE/EXACT.dump --target yaiku_restore_check
```

Restore comprueba hash/proyecto y crea una DB nueva `yaiku_restore_*`; falla si
existe, sin DROP/clean. `pg_restore --single-transaction --exit-on-error` conserva
la DB nueva vacía ante fallo; no repunta aplicaciones automáticamente. Verificar
Flyway, cuentas/sesiones, recepción/documentos y hash desde una app aislada antes
de decidir recuperación. Retención solo borra archivos del propio proyecto con
integridad válida; nunca eliminación recursiva ni restauración sobre DB del usuario.

**DumpDB no respalda binarios.** Con escrituras detenidas, copiar objetos del bucket
por canal S3 autorizado a un destino privado, conservar keys/tamaños/SHA256 y
manifiesto ligado al dump. Verificar inventario faltantes/huérfanos y restaurar
objetos antes de validar descargas. No usar URLs públicas, no borrar/recrear bucket
ni asumir que cambiar endpoint reubica datos. Respaldar secretos/certificados por
proceso separado; un dump no los reconstruye. Pérdida de la VM/disco exige copia
externa y binarios disponibles; no es HA ni PITR por tener un volumen.

## Verificación y autorización final

[VALIDATION.md](VALIDATION.md) registra únicamente resultados ejecutados y límites.
No declarar imágenes verificadas por pasar tests nativos. No usar datos/buckets
existentes para pruebas. Pendientes para autorizar creación/despliegue:

1. Confirmar suscripción/beneficios/region/SKU y saldo; aprobar recursos/costo residual.
2. Revisar capacidad bajo carga y efectos de parada/scheduler/RPO/RTO.
3. Aportar SMTP real o autorizar por separado un modo deshabilitado honesto.
4. Aportar S3 privado de prueba/producción, política de proyecto y respaldo binario.
5. Aprobar dominio/TLS/renovación, CIDRSSH/admin y datos iniciales sin seed compartido.
6. Revisar las imágenes/candidato validado, pendientes demostrados y plan de recuperación.
7. Corregir y verificar el DTO del detalle SAIP con el contexto transaccional
   apropiado: no habilitar OSIV ni ocultar su 500 para aprobar producción.

Gobernanza personal/Serena/design-reference/evidencias no se publican. No se cambian
Kotlin, contratos, migraciones ni reglas funcionales. La fidelidad visual y Android
siguen en sus entregas posteriores; esta preparación no cierra la réplica web.
