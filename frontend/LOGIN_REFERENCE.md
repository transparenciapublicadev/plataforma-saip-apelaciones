# Accesos Yaiku: referencia visual y separación funcional

Los cuatro accesos conservan sus rutas y restricciones:

| Entrada | Perfil admitido |
|---|---|
| `/login` | CIUDADANO |
| `/acceso-funcionario` | FUNCIONARIO |
| `/acceso-ttaip` | TTAIP |
| `/acceso-admin` | ADMINISTRADOR |

La presentación de login sigue la referencia actual: panel editorial con halo,
marca existente y lema apilado, título y divisor ajustados, distintivos compactos,
formulario de 448 px máximo, tarjetas de perfil en dos columnas y entrada de
12 px durante 0,5 s, con movimiento reducido. La cabecera comparte los 72 px de
navegación de la referencia; ya no existe la excepción visual compacta de acceso.

Las tarjetas son enlaces a entradas diferentes; no seleccionan un rol local para
autenticar ni cambian guards, permisos o el mecanismo Bearer. El identificador,
contraseña, validaciones existentes y respuesta Spring determinan el acceso.

Se retiraron credenciales incorporadas y el activador por query string; no existe
acceso rápido demo. El candidato construido se inspecciona para detectar los
valores demo publicados previamente, sin imprimirlos. Esto no verifica cuentas
existentes ni demuestra qué bundle está desplegado.

Las diferencias funcionales están identificadas: no se declara certificación
WCAG u oficialidad sin evidencia; los distintivos describen capacidades reales.
Recordarme y recuperación de contraseña se muestran deshabilitados con explicación,
pues el formulario no tiene operaciones que respalden esas acciones. Crear cuenta
sigue disponible solo desde el acceso del administrado.

Las pruebas protegen datos manuales, errores anunciados, visibilidad de contraseña,
entradas/roles separados y éxito basado en la respuesta del servicio. HttpTesting,
DOM y mocks no acreditan autenticación Spring, teclado real o paridad renderizada.
La comparación visual en escritorio/pantalla pequeña y ambos temas permanece
pendiente; la implementación contrastada por fuentes no equivale a réplica completa.

## Comprobación del candidato — 2026-11-07

Suite general: 1989/1989, 73 archivos, sin omitidas, en una única corrida final
con environment publicado y configuración serial temporal (maxWorkers=1,
fileParallelism=false). No cambian configuración versionada, pool, dependencias
o timeouts. Un intento normal focalizado previo falló al iniciar el worker y
no ejecutó casos; la serialización no demuestra su causa ni una reparación global.
Tipos app/spec y build correctos; avisos existentes de CommonJS/presupuesto
conservados. Los valores demo publicados previamente no aparecen en los 127
artefactos de texto del build inspeccionados. Sin comprobación renderizada nueva.
