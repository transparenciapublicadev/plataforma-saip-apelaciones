# Azure: presupuesto anual y decisión pendiente

Consulta oficial **2026-10-30**, **East US**, USD retail Consumption, sin impuestos.
[Snapshot](prices-eastus.json) con consultas/fechas efectivas de la
[API oficial](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices).
Se excluyen Windows, Spot y Cloud Services de las tarifas VM Linux.
Un precio público no demuestra beneficio, cuota ni capacidad de una suscripción.

## Conclusión corregida

**La configuración preparada con dos E4 e IPv4 retenida no cabe en US$100/año,
incluso desasignada todo el año. No está económicamente aprobada.**

- Fijo conocido: `(2 × 2.40 + 730 × 0.005) × 12 = US$101.40/año`.
- A40h/mes: US$10.11/mes publicado implica US$121.32/año multiplicando cifras
  redondeadas; con tarifas sin redondear, **US$121.37/año**, más exclusiones.
- No hay alternativa integral confirmada dentro de US$100. Algunas hipótesis
  dejan margen aritmético, pero faltan elegibilidad, capacidad y costos auxiliares.

Se conserva la arquitectura portable VM/Compose preparada; no se cambian recursos,
memoria, discos, IP, red ni respaldos para hacer cuadrar la cifra. La elección final
entre VM y ACA queda pendiente. No se promete duración anual del crédito.

## Tarifas verificadas y unidades

| Concepto | Tarifa USD | Alcance |
|---|---:|---|
| B2s Linux | 0.0416/h | Base histórica de la preparación;2vCPU/4GiB; no selección aprobada |
| B2als_v2 Linux | 0.0376/h | Alternativa actual2vCPU/4GiB, x86-64; disponibilidad/beneficio no comprobados |
| Standard SSD E1/E2/E3/E4 LRS | 0.30/0.60/1.20/2.40 por mes | 4/8/16/32GiB; transacciones/mount cuando apliquen aparte |
| IPv4 Standard estática | 0.005/h | Mientras se conserva el recurso; apagar/desasignar VM no la elimina |
| PostgreSQL Flexible B1MS | 0.017/h | Beneficio Students pendiente; no heredar conclusiones de ciclo de vida de VM |
| Storage PostgreSQL | 0.115/GB-mes | 32GB:3.68/mes antes de beneficios |
| ACA activo CPU / memoria | 0.000024/vCPU-s / 0.000003/GiB-s | Sin grants por defecto en la calculadora corregida |
| ACA peticiones | 0.40/millón | Volumen no medido: excluido de subtotales, no costo cero; grant solo si disponible |

## Escenarios comparables

Base anual:12 meses idénticos de730h (8760h/año). Las horas VM deben incluir
arranque/parada facturables, no solo uso de la interfaz. El resto se supone
desasignado. Anuales calculados **antes** de redondear el mensual.
Fijos de las tablas son componentes conocidos, no un presupuesto completo.

| Escenario VM B2s | Encendida h/año | IP facturada h/año | Fijo conocido/año | Subtotal/año |
|---|---:|---:|---:|---:|
| Dos E4 + IP retenida;0h/mes | 0 | 8760 | 101.40 | 101.40 |
| Misma base;40h/mes | 480 | 8760 | 101.40 | 121.37 |
| Misma base;160h/mes | 1920 | 8760 | 101.40 | 181.27 |
| Misma base;730h/mes | 8760 | 8760 | 101.40 | 465.82 |
| Dos E4;IP eliminada fuera de40h/mes (hipótesis) | 480 | 480 | 57.60 | 79.97 |

Última fila: solo20.03USD/año de margen para todas las exclusiones. Los480h de IP
deben incluir asignación, preparación y redondeo por período; no se deducen de las
horas de interacción. Conservar la IP durante esperas también cuesta. Cambiar solo
CPU por B2als_v2 no elimina el fijo101.40: a40h/mes serían119.45/año con IP retenida,
o78.05 con la misma hipótesis de IP480h. No se seleccionó automáticamente ese SKU.

Para B se conserva el modelo comparativo (no desplegado): backend1vCPU/2GiB,
grupo SSR/proxy0.75vCPU/1.5GiB, todo activo durante las horas indicadas, resto0
réplicas. PostgreSQL facturado las mismas horas es una **hipótesis inferior**:
autoarranque tras7días y mantenimiento pueden añadir cómputo; no existe un plan
operado de parada que lo garantice. Storage permanece aunque se detenga.
Peticiones y tráfico no están cuantificados: se excluyen en todas las filas, no
se descuentan por presuponer que la cuenta tenga grants disponibles.

| ACA + PostgreSQL,40h/mes (480h/año) | Grants ACA asumidos | PG gratuito asumido | Fijo PG conocido/año | Subtotal/año |
|---|---|---|---:|---:|
| Sin beneficios/grants descontados | No | No | 44.16 | 143.04 |
| Grant ACA entero disponible | Sí | No | 44.16 | 78.24 |
| Solo beneficio PG | No | Sí | 0.00 | 90.72 |
| Ambos disponibles | Sí | Sí | 0.00 | 25.92 |

Las filas condicionales no son una cotización aprobada. Sus ceros no cubren red
privada, registro, logs, backups externos ni los demás conceptos pendientes.
[ACA](https://learn.microsoft.com/en-us/azure/container-apps/billing) publica
180000vCPU-s/360000GiB-s/2millones requests por suscripción/mes; hay que descontar
otros usos.0réplicas elimina consumo de réplicas, no esos recursos auxiliares.
Private endpoints y otras funciones pueden añadir gestión de plan Dedicated;
no asumir gratuito un diseño VNet/privado sin cotizar sus componentes.
[PostgreSQL detenido](https://learn.microsoft.com/en-us/azure/postgresql/configure-maintain/how-to-stop-server)
puede reiniciarse por mantenimiento y arranca automáticamente tras7días.

Reproducción sin Azure ni secretos:

```sh
python deploy/azure/pricing.py --hours 0 40 160 730
python deploy/azure/pricing.py --hours 40 --ip-billed-hours 40
python deploy/azure/pricing.py --hours 40 --assume-aca-grant
python deploy/azure/pricing.py --hours 40 --assume-aca-grant --assume-postgres-free
```

Cambio deliberado respecto a la calculadora anterior: ya no descuenta el grant
ACA implícitamente. El antiguo6.52/mes requiere `--assume-aca-grant`;2.16 requiere
además `--assume-postgres-free`. Los flags no verifican la cuenta. La herramienta
solo estima: no elimina IPs ni cambia infraestructura. Mantiene los dos E4.

## Discos: necesidad y tamaño todavía por medir

La [imagen Linux suele partir de30GB](https://learn.microsoft.com/en-us/azure/virtual-machines/linux/expand-disks):
E4/32GiB es un supuesto para OS, no una medición. Deben caber OS, imágenes finales,
capas de actualización, logs rotados y margen. No construir en esa VM.
El segundo E4 separa PostgreSQL/WAL del OS y facilita mantenimiento; no lo exige
Compose ni constituye backup o HA. Ambos deben ser persistentes; el disco temporal
de una VM no es una alternativa para PostgreSQL.

Compartir OS/DB en un único E4 persistente daría, aritméticamente,72.60/año fijo y
92.57/año a40h/mes con IP retenida. **No es una reducción validada**: falta medir
imágenes, DB/WAL, crecimiento, IOPS, retención local y espacio de recuperación.
Se mantiene fuera de la configuración preparada. E1–E3 tienen las capacidades
[documentadas](https://learn.microsoft.com/en-us/azure/virtual-machines/disks-types),
pero no hay evidencia para achicar el disco de datos. Que S3 guarde los binarios
no vuelve despreciables PostgreSQL/WAL ni autoriza eliminar copias externas.
No se eliminan persistencia, respaldos o margen para cumplir un subtotal.

## IP durante los períodos apagados

La [IPv4 Standard es estática](https://learn.microsoft.com/en-us/azure/virtual-network/ip-services/public-ip-addresses)
y sigue cobrándose aunque se desasigne la VM. Desasociar de la NIC no equivale a
eliminar el recurso. La [facturación termina al eliminarlo](https://azure.microsoft.com/en-us/pricing/details/ip-addresses/).
La alternativa dinámica Basic no es una propuesta válida nueva: Basic fue retirado.

Eliminar/recrear solo la IP en períodos apagados preservaría discos y datos, pero
exige una decisión operativa autorizada: no garantiza recuperar la misma dirección,
requiere reasociar NIC/NSG, actualizar A/AAAA, considerar TTL/cachés y validar acceso.
El certificado TLS para el mismo dominio puede seguir siendo válido; hay que
comprobar nombre, cadena, vigencia y renovación con el nuevo destino. No desactivar
TLS ni comprobación de claves SSH para resolver el cambio de IP.
La ventana de disponibilidad empieza después de esas comprobaciones, no al pulsar
Start. Ningún script de esta entrega crea/elimina IPs ni modifica DNS.

Una VM sin IP pública requiere un acceso privado/túnel realmente disponible y
egress explícito para S3/SMTP; VPN, Bastion, NAT o Load Balancer pueden añadir costo.
No se presupone un túnel, IP dinámica gratis o conectividad pública universal.

## SKUs gratuitos y capacidad

La [oferta Students](https://azure.microsoft.com/en-us/free/students/) anuncia
US$100/12meses, horas VM, PostgreSQL B1MS32GB/backup y ACR Standard condicionales.
No prueba elegibilidad, período restante, saldo, región, cuotas o consumo previo.
Hoy `az.cmd` está presente; la lectura acotada de sesión agotó25s. No se obtuvo
evidencia de la suscripción ni se ejecutó login o mutación de cuenta.

| VM anunciada en la oferta pública | CPU/memoria documentadas | Consecuencia para este candidato |
|---|---|---|
| B1s | 1vCPU/1GiB, x86-64 | Insuficiente para límites configurados≈2.6GiB más OS; sin autorización para reducirlos |
| B2ats_v2 | 2vCPU/1GiB, AMD x86-64 | No equivale a B2als_v2 de4GiB |
| B2pts_v2 | 2vCPU/1GiB, Arm64 | Memoria insuficiente y arquitectura distinta de imágenes amd64 |

Fuentes de [Bv1](https://learn.microsoft.com/en-us/azure/virtual-machines/sizes/general-purpose/bv1-series),
[Basv2](https://learn.microsoft.com/en-us/azure/virtual-machines/sizes/general-purpose/basv2-series) y
[Bpsv2](https://learn.microsoft.com/en-us/azure/virtual-machines/sizes/general-purpose/bpsv2-series).
Bv1 figura en [End of Life](https://learn.microsoft.com/en-us/azure/virtual-machines/sizes/lifecycle/end-of-life-sizes-list),
con restricciones para nuevas suscripciones. B2s queda como referencia histórica,
no recomendación de crear una VM nueva. B2als_v2 tiene4GiB/x86-64, pero ni ese
beneficio ni su disponibilidad en la cuenta están confirmados. También hay que
medir memoria, CPU burst y arranque antes de seleccionar cualquier SKU.

## Exclusiones: pendientes, no costo cero

| Concepto | Qué falta para presupuestarlo |
|---|---|
| Disco IO/mount, imágenes y logs | IOPS/capacidad/capas medidas. Logs locales rotados usan disco; no Azure Monitor nuevo configurado |
| Backups externos | Proveedor privado, tamaño DB/binarios, frecuencia, retención, cifrado, restauración y tráfico.7 dumps en la misma VM no cubren pérdida del disco |
| Tráfico | Azure↔Supabase, descargas, egress de ambos proveedores, volúmenes y posibles cargos de red privada |
| Registro | VM puede usar save/load privado; archivo de imágenes también ocupa espacio. ACA necesita origen de imágenes y verificar cualquier grant ACR antes de descontarlo |
| Dominio/DNS/TLS | Dominio o subdominio disponible, proveedor DNS/TTL y renovación. Un certificado sin tarifa no prueba operación gratuita |
| SMTP | Canal/remitente real y costo. `prod` lo exige; no fingir activación con configuración de prueba |
| Supabase | Plan/uso real del proyecto. Es externo al crédito Azure; backupDB no incluye sus objetos |
| Red y operación | Conectividad privada, gestión ACA cuando aplique, alertas, monitorización, paradas/reanudación y mantenimiento |

[Supabase](https://supabase.com/pricing) publica Free con1GB de archivos/5GB egress,
pausa tras una semana inactiva; no garantiza disponibilidad para este uso. Pro
parte de25USD/mes (300USD/año), externo a Azure, sin plan confirmado. No se creó
ni accedió a un bucket. Precios/impuestos/cargos del proveedor deben validarse.

Antes de aprobar recursos faltan: evidencia de saldo/vigencia y Free services
(VM/discos/PG/ACR/grantsACA), restricciones de región/SKU, dimensionamiento real,
decisión de IP/DNS y cotización de exclusiones. Una alerta de presupuesto no es
un corte duro. **Mantener bloqueada la autorización de despliegue** hasta contar
con candidato ejecutado y presupuesto integral aceptado.
