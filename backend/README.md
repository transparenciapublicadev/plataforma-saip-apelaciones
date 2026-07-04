# SAIP Backend — Módulo de Servidor Spring Boot

Este directorio contiene el backend de la plataforma SAIP y apelaciones TTAIP.

## Configuración de variables de entorno (staging con Supabase)

Para el correcto funcionamiento del almacenamiento de documentos en staging utilizando la API compatible con S3 de Supabase, es necesario configurar variables de entorno locales. Este proyecto implementa un mecanismo seguro mediante el uso de archivos `.env`.

### Pasos para configurar el entorno:

1. **Crear archivo `.env`:**
   Copia el archivo de plantilla `.env.example` en este mismo directorio y renómbralo como `.env`:
   ```powershell
   copy .env.example .env
   ```

2. **Llenar las credenciales reales:**
   Abre el archivo `.env` recién creado en tu editor y completa los valores correspondientes para cada variable.
   
   > [!WARNING]
   > El archivo `.env` contiene secretos locales y credenciales sensibles. Este archivo está explícitamente excluido en el `.gitignore` de la raíz del monorepo y **NUNCA** debe ser comiteado o subido al repositorio.

3. **Ejecutar el backend:**
   En lugar de exportar manualmente las variables en la terminal usando `$env:VARIABLE="valor"` para cada nueva sesión de PowerShell, ejecuta el script de automatización provisto en la carpeta `scripts/` (desde el directorio `backend/`):
   ```powershell
   .\scripts\run-staging.ps1
   ```
   
   Este script se encargará de:
   - Validar la existencia de tu archivo `.env`.
   - Cargar todas las variables especificadas en el scope de proceso de PowerShell de forma segura (sin mostrar sus valores en pantalla).
   - Iniciar la aplicación Spring Boot automáticamente a través de Maven Wrapper (`.\mvnw.cmd spring-boot:run`).
