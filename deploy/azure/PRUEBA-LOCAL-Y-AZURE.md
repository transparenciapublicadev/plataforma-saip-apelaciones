# Probar Yaiku en local y, solo después, publicar las imágenes en Azure

Hay tres arranques distintos. El de todos los días no construye imágenes.
Las tres imágenes solo entran cuando vas a dejar el mismo código en la VM.

| Camino | Cuándo usarlo | Qué corre | Base de datos | Archivos | Perfil Spring |
| --- | --- | --- | --- | --- | --- |
| Desarrollo local | Recorrer pantallas, accesos, plazos y decisiones | `.\mvnw.cmd spring-boot:run` y `pnpm start` | PostgreSQL local `saip_db`, con seed | Disco, en `%USERPROFILE%\.saip-storage` | Ninguno. No pongas `staging` |
| Staging con Supabase | Probar la subida real de adjuntos contra el bucket | `.\scripts\run-staging.ps1` y el mismo frontend | La misma PostgreSQL local, salvo que `backend/.env` defina `DB_URL` | Bucket S3 de Supabase | `staging` |
| Tres imágenes en Azure | El local ya se comportó bien y quieres verlo en la VM | `docker build` de backend, frontend y proxy | Postgres del Compose en la VM | Bucket S3 del `runtime.env` de la VM | `prod`, dentro del contenedor |

Supabase, en este repositorio, es el almacén de archivos del perfil `staging`.
No sustituye a PostgreSQL ni arranca las imágenes de Azure.

El frontend de desarrollo, en los dos primeros caminos, llama a
`http://localhost:8080/api`. Hacen falta Java 25, PostgreSQL en el puerto 5432,
pnpm 12.3.4 y Node compatible con Angular 22.

## 1. Desarrollo local

Úsalo para la lista de comprobación de más abajo. No ejecutes
`run-staging.ps1` en esta pasada: ese script activa `staging` y exige secretos
que este camino no necesita.

Si la terminal ya tiene `SPRING_PROFILES_ACTIVE=staging`, ciérrala y abre otra.
Si no, Spring seguiría en staging aunque lances Maven a mano.

Desde la raíz:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

El log debe decir que no hay un perfil activo de staging. Flyway aplica el
esquema y, si la base está vacía, el seed
`backend/src/main/resources/db/seed/V2__seed_local.sql`. Ese archivo trae
cuentas de administrado, funcionario, TTAIP y administrador. Usa un correo de
cada tipo y la contraseña escrita ahí. No la copies a otro archivo.

En otra terminal:

```powershell
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend start --host 127.0.0.1 --port 4200
```

Abre `http://127.0.0.1:4200`. El correo queda en modo `MOCK` y los adjuntos se
guardan en el disco local.

## 2. Staging local con Supabase

Úsalo cuando el flujo de la sección 1 ya entra y quieres comprobar que un
adjunto llega al bucket. Sigue siendo un proceso Maven en tu máquina. No
construyas las tres imágenes para esto.

El script lee `backend/.env` y arranca con el perfil que ese archivo declare.
Ese archivo no necesita `JWT_SECRET`. Si la línea falta o está vacía, staging
usa la clave de desarrollo de `application.properties`. Las tres imágenes no
leen este `.env`: el Dockerfile borra esa línea y la VM entrega el archivo
`jwt.secret`.

```powershell
cd backend
.\scripts\run-staging.ps1
```

El log de Spring debe mostrar `The following 1 profile is active: "staging"`.

Ese perfil usa la misma historia Flyway que el camino 1, incluida
`db/seed/V2__seed_local.sql`. La base local ya tiene esa versión aplicada; si
staging no la ve, el arranque se detiene con «applied migration not resolved
locally: 2». La imagen de producción no copia esa carpeta.

El frontend se arranca igual que en la sección 1.

## 3. Qué revisar en el navegador

Sirve para los caminos 1 y 2. Marca cada fila solo si el servidor respondió y
la pantalla coincide con lo visto. Un texto pintado sin recargar el expediente
no cuenta como actuación.

| Comprobación | Resultado esperado |
| --- | --- |
| `/login` | Solo el perfil Administrado y el enlace de registro. No aparecen los otros tres accesos. |
| `/acceso-funcionario` | Solo Funcionario. Sin registro de administrado. |
| `/acceso-ttaip` | Solo Personal TTAIP. |
| `/acceso-admin` | Solo Administrador. |
| Sesión de un rol | La cabecera muestra el panel de ese rol, no los cuatro módulos. |
| Bandeja del funcionario | Carga la entidad y la lista. Si falla, el mensaje ya no debe ser el 500 del `GROUP BY`. |
| Último día hábil de una SAIP | La lista dice «Vence hoy», no «0 días háb.». |
| Plazo de SAIP ya vencido | La lista dice «En silencio administrativo» y muestra los días hábiles de retraso. Eso ocurre cuando el servidor deja el estado vencido o `diasRestantes` negativo. |
| Bandeja del Tribunal | Cada fila muestra el plazo. En pantallas angostas no desaparece. |
| Subsanación con cero días informados por el servidor | Dice «Vence hoy» y, si viene, la fecha límite. |
| Subsanación vencida según el servidor | Dice «Vencido». |
| Otras etapas del Tribunal sin reloj propio | Muestran la fecha de ingreso. No inventan un conteo de días. |
| Primera calificación | Admisible sigue hacia resolución. Inadmisible abre subsanación. Improcedente archiva. |
| Segunda calificación | Admitido sigue hacia resolución. Improcedente archiva. Tener por no presentado solo si el reloj de subsanación está vencido y no hay recepción. |
| Resolución final | Cada opción (fundado, fundado en parte, infundado, infundado en parte, improcedente, sustracción, desistimiento, estese a lo resuelto, nulidad) queda registrada al consultar de nuevo el expediente. |
| Adjunto, solo en el camino 2 | El archivo queda en el bucket de Supabase, no solo en `%USERPROFILE%\.saip-storage`. |

Si una escritura responde con duda, consulta el expediente antes de repetirla.

## 4. Construir las tres imágenes

Este paso no prueba el código en tu máquina. Úsalo cuando las secciones 1 y 3
ya cuadran y quieres la misma revisión en
`https://yaiku-saip.brazilsouth.cloudapp.azure.com/`.

Los cambios de accesos, «Vence hoy» y el `GROUP BY` del panel están en el
árbol local. La imagen `2026.11.09` cargada en la VM no los incluye. Hace
falta una etiqueta nueva.

Desde la raíz. `RELEASE` es la etiqueta de esta construcción, por ejemplo
`2026.11.10`. No reutilices `prepared`.

```powershell
docker build --platform linux/amd64 -t yaiku-backend:RELEASE backend
docker build --platform linux/amd64 -t yaiku-frontend:RELEASE frontend
docker build --platform linux/amd64 -t yaiku-proxy:RELEASE deploy/azure/nginx
```

En este equipo, `docker save -o` dejó un archivo de 0 bytes. La salida que sí
se escribió fue la redirección:

```powershell
New-Item -ItemType Directory -Force -Path D:\yaiku-transfer | Out-Null
cmd /c "docker save yaiku-backend:RELEASE yaiku-frontend:RELEASE yaiku-proxy:RELEASE > D:\yaiku-transfer\images-RELEASE.tar"
```

Comprueba que el tamaño del tar crece y que el comando termina con código 0.
No lo dejes dentro del repositorio. El `.env` de Supabase no entra en estas
imágenes: la VM usa `/opt/yaiku-private/runtime.env`.

## 5. Publicar en la VM

Suscripción `9a8bce42-b211-4b00-a325-b78d694f83c9`, grupo
`rg-yaiku-brazilsouth`, máquina `vm-yaiku`, IP `20.226.28.108`. El usuario SSH
es `azureuser` y la clave local que coincide con la VM es
`%USERPROFILE%\.ssh\id_ed25519_daniel_main`.

Encender. Esto factura cómputo mientras siga en `running`.

```powershell
pwsh -NoProfile -File .\deploy\azure\vm-power.ps1 -Action Start -Subscription "9a8bce42-b211-4b00-a325-b78d694f83c9" -ResourceGroup "rg-yaiku-brazilsouth" -Name "vm-yaiku" -AllowPowerChange
pwsh -NoProfile -File .\deploy\azure\vm-power.ps1 -Action Status -Subscription "9a8bce42-b211-4b00-a325-b78d694f83c9" -ResourceGroup "rg-yaiku-brazilsouth" -Name "vm-yaiku"
```

Espera `PowerState/running` y el puerto 22. Encender la VM no arranca los
contenedores.

Copiar y cargar:

```powershell
scp -i "$env:USERPROFILE\.ssh\id_ed25519_daniel_main" -o IdentitiesOnly=yes D:\yaiku-transfer\images-RELEASE.tar azureuser@20.226.28.108:/home/azureuser/images-RELEASE.tar
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_daniel_main" -o IdentitiesOnly=yes azureuser@20.226.28.108 "docker load -i /home/azureuser/images-RELEASE.tar && docker images"
```

En `/opt/yaiku-private/runtime.env`, que ya existe fuera del checkout, apunta
solo estas tres líneas a la etiqueta nueva. Hay una copia previa en
`runtime.env.bak-before-2026.11.09`.

```text
BACKEND_IMAGE=yaiku-backend:RELEASE
FRONTEND_IMAGE=yaiku-frontend:RELEASE
PROXY_IMAGE=yaiku-proxy:RELEASE
```

Secretos, TLS y el resto del envfile no se regeneran para esta prueba. El
perfil `prod` rechaza correo `MOCK` y exige el bucket S3 ya configurado en la
VM. Ese bucket no es el de `backend/.env`.

Arranque, dentro de la VM:

```sh
cd /home/azureuser/app
python3 deploy/azure/stack.py --env-file /opt/yaiku-private/runtime.env start
docker ps --format '{{.Names}} {{.Image}} {{.Status}}'
```

Repite la tabla de la sección 3 en el sitio público. Las cuentas de la VM no
son las del seed local: usa las que ya existen en esa base.

## 6. Apagar al terminar

Primero el stack y después la desasignación. `az vm stop` no detiene el cobro
de cómputo.

```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_daniel_main" -o IdentitiesOnly=yes azureuser@20.226.28.108 "cd /home/azureuser/app && python3 deploy/azure/stack.py --env-file /opt/yaiku-private/runtime.env stop"
pwsh -NoProfile -File .\deploy\azure\vm-power.ps1 -Action Deallocate -Subscription "9a8bce42-b211-4b00-a325-b78d694f83c9" -ResourceGroup "rg-yaiku-brazilsouth" -Name "vm-yaiku" -AllowPowerChange -ServicesStopped
```

Confirma `PowerState/deallocated`. El disco del sistema y la IP estática siguen
generando cargo. Al escribir esta guía la máquina sigue desasignada.
