# Azure: decisión económica revisable

Consulta oficial: **2026-10-29**, región de comparación **East US**, USD retail,
sin impuestos ni descuentos atribuidos a una cuenta. [Snapshot](prices-eastus.json)
incluye consultas y fechas efectivas obtenidas de la
[API oficial de precios](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices).
La API es pública: presencia de tarifa no acredita disponibilidad, cuota ni beneficio.
Azure CLI no estaba instalado; no se consultó ni modificó la cuenta del usuario.

## Decisión

Preparar **A: VM Linux x86-64 con Compose**, B2s como candidato inicial2vCPU/4GiB,
PostgreSQL persistente en disco de datos y Supabase Storage privado externo.
No construir imágenes en esa VM. Memoria es un presupuesto inicial para revisión,
no un benchmark: límites del conjunto≈2.6GiB y resto para OS/cache/Docker; falta
medir carga concurrente, créditos CPU burst y margen real antes de elegir SKU.

Esta base permite paradas deliberadas y evita depender de un beneficio PostgreSQL
no acreditado o de red privada/registro/logs administrados aún sin cotizar. A exige
administrar parches, PostgreSQL y recuperación; no es alta disponibilidad. Si se
confirma el beneficio de PostgreSQL y se valora operación administrada, reconsiderar
B antes de autorizar recursos. Los contenedores frontend/backend y la DB son portables.

## Comparación

| Aspecto | A: VM/Compose | B: Container Apps Consumption + PostgreSQL Flexible |
|---|---|---|
| Cómputo | B2s Linux2vCPU/4GiB:0.0416USD/h; amd64 | Backend1vCPU/2GiB; grupo frontend SSR/proxy0.75vCPU/1.5GiB. Imágenes linux/amd64 soportadas. Ajustes por medir |
| Encendido | DB saludable → backend/Flyway/validate → SSR → proxyTLS | DB lista → backend → frontend/ingress. Arranque en frío y posible mantenimiento DB; no tiempo garantizado |
| Parada | Contenedores o guest apagado no desasignan VM; desasignar detiene tarifa de cómputo | Escala0 no es suspensión: tráfico/scalers pueden reactivar. Suspensión explícita de apps es distinta; DB se gestiona aparte |
| Residual | Discos/IP/backups persistentes; no registry Azure si se transfiere archivo de imágenes | Storage/backup PostgreSQL y recursos auxiliares permanecen; DB detenida arranca automáticamente tras7días |
| PostgreSQL | Volumen nombrado sobre disco persistente; pg_dump y restauración propios, sin PITR/HA implícitos | Backups administrados y PITR según plan/retención; B1MS/32GB como candidato, acceso privado y backup excedente por cotizar |
| Red | SoloHTTPS público; SSH origen operador; DB y apps sin puertos publicados | Backend interno y PostgreSQL privado requieren diseño VNet. Costos auxiliares no asumidos gratis |
| TLS/dominio | Certificado externo/renovación operada; puede haber coste del dominio | TLS ingress administrado; customdomain/DNS y Nginx mismo origen requieren perfil específico aún no preparado |
| Imágenes/logs | docker save/load evita ACR; logs locales rotados en disco | Registro de imágenes y destino/retención de logs por decidir. No se atribuye un registry gratis sin comprobar la cuenta |
| Tareas | No hay ejecuciones mientras la VM/backend está detenido | Escala0 también detiene scheduler dentro del backend; minReplicas1 cambia costo; no scheduler externo implementado |

[VM parada/desasignada](https://learn.microsoft.com/en-us/azure/virtual-machines/states-billing),
[facturación Consumption](https://learn.microsoft.com/en-us/azure/container-apps/billing),
[parada PostgreSQL](https://learn.microsoft.com/en-us/azure/postgresql/configure-maintain/how-to-stop-server),
[arquitectura de contenedores](https://learn.microsoft.com/en-us/azure/container-apps/containers).
No se ejecutaron operaciones cloud para esta comparación.

## Escenarios mensuales

Supuestos:730h/mes, IP retenida todo el mes, dos discos E4LRS32GiB a2.40USD/mes
cada uno; no discos compartidos ni snapshots adicionales. B: todo el cómputo
asignado activo durante las horas indicadas, resto escalado a0, grants completamente
disponibles, menos de2millones de peticiones. Son **subtotales inferiores**, no
cotización integral ni previsión de vida del crédito.

| Uso | A VM + discos + IP | B ACA + PG pagado | B suponiendo beneficio PG válido |
|---|---:|---:|---:|
|40h/mes, uso intermitente|10.11USD|6.52USD|2.16USD|
|160h/mes|15.11USD|31.24USD|24.84USD|
|730h/mes, continuo|38.82USD|148.66USD|132.57USD|

Reproducir: `python deploy/azure/pricing.py` y `--assume-postgres-free` para el
escenario condicional. A detenida/desasignada todo el mes todavía≈8.45USD de
discos/IP. B sin beneficio conserva≈3.68USD/mes de storage32GB, backups excedentes
y auxiliares, y no permanece detenido indefinidamente por el autoarranque DB.

Tarifas de B verificadas: B1MS0.017USD/h, storage0.115USD/GB-mes,
vCPU activo0.000024USD/s, memoria0.000003USD/GiB-s, requests0.40USD/millón tras
grant. Se excluyen IO/mount cuando corresponda, egress, logs/monitorización,
registry, backup adicional, red privada/NAT/endpoints, dominio, Supabase e impuestos.
No se añade automáticamente el meter de gestión de entorno0.10USD/h: su aplicación
depende del tipo de entorno/funciones; debe cotizarse con el diseño B concreto.
El uso de réplicas idle o menores horas efectivas puede reducir ACA frente al supuesto.

US$100 no garantiza un año: incluso el subtotal A continuo consumiría ese importe
en menos de3meses sin otros costos; saldo/vigencia/otros servicios desconocidos.
Antes de crear, revisar Budget/alertas y saldo; las alertas no son un corte duro.
No se creó un presupuesto ni se cambiaron límites de la suscripción.

## Beneficios y verificaciones pendientes

La [oferta pública Students](https://azure.microsoft.com/en-us/free/students/)
publica100USD/12meses y PostgreSQL B1MS750h,32GBstorage/32GBbackup durante12meses;
también lista grants de ACA. Eso no prueba elegibilidad/fecha restante de esta
suscripción. Confirmar en portal Free services y Cost Management, sin compartir
IDs/tokens. Verificar región permitida, cuotas/restricciones B2s y PG, y si los
grants ya se consumen en otros recursos. No se sustituye un SKU indisponible por
otro más caro automáticamente ni se usa Spot con riesgo de pérdida/interrupción.
Confirmar también soporte/estadoGA de PostgreSQL18 en la región/SKU administrado;
la prueba nativa18.4 no acredita compatibilidad con otra versión ofrecida por Azure.

B1s/B2atsv2/B2ptsv2 gratuitos no se presuponen equivalentes al B2s4GiB requerido:
memoria y CPU/arquitectura deben comprobarse por SKU. ARM no se mezcla con imágenes
amd64. Esta preparación usa amd64 para ambas alternativas.

Supabase es un costo/servicio externo independiente del crédito Azure. Su
[plan Free](https://supabase.com/pricing) publica1GBStorage/5GBegress y pausa tras
una semana inactiva; el Pro parte de25USD/mes. Confirmar plan real, bucket privado,
límites y política de continuidad antes de considerarlo disponible sin costo.
Pausas de Supabase no equivalen a documento inexistente: la app debe conservar sus
errores/recepciones sin reintentos de escrituras ciegos. No se creó ni tocó un proyecto.
