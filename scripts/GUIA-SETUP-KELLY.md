# 🌲 Guía de Setup — Kelly

Hola Kelly! Esta guía te llevará paso a paso para configurar tu entorno de desarrollo del proyecto **Plataforma SAIP Apelaciones**.

## Requisitos Previos

1. **Git** instalado ([descargar](https://git-scm.com/downloads))
2. **VS Code** instalado ([descargar](https://code.visualstudio.com/))
3. **PowerShell** (ya viene con Windows)
4. **SSH Key** configurada en tu cuenta de GitHub
   - Si no tienes una, sigue esta guía: https://docs.github.com/en/authentication/connecting-to-github-with-ssh
5. **Developer Mode** habilitado en Windows (para symlinks):
   - Ir a **Settings → Privacy & Security → For developers → Developer Mode → ON**
   - ⚠️ Si no puedes habilitarlo, el script copiará carpetas en vez de crear symlinks

## Paso 1: Clonar el repositorio

Abre **PowerShell** y ejecuta:

```powershell
# Elige la carpeta donde quieras tener el proyecto
# Ejemplo: C:\Proyectos o D:\PROYECTOS-CIBERTEC
cd C:\Proyectos

# Clonar
git clone git@github.com:transparenciapublicadev/plataforma-saip-apelaciones.git
cd plataforma-saip-apelaciones
```

## Paso 2: Recibir archivos de configuración de agentes

> ⚠️ **IMPORTANTE**: Los archivos de agentes y skills (`.agents/` y partes de `.github/`) NO están en el repositorio (están en `.gitignore`). Daniel te los enviará por Google Drive, OneDrive o USB.

Cuando recibas los archivos, colócalos así:

```
plataforma-saip-apelaciones/
├── .agents/           ← COPIAR AQUÍ (carpeta completa)
│   ├── skills/
│   └── workflows/
└── .github/           ← Ya existe, agregar DENTRO las subcarpetas:
    ├── agents/        ← COPIAR AQUÍ
    ├── skills/        ← COPIAR AQUÍ
    ├── copilot-instructions.md  ← COPIAR AQUÍ
    ├── copilot-repo-notes.md    ← COPIAR AQUÍ
    └── workflows/     ← YA EXISTE, no tocar
```

## Paso 3: Ejecutar el script de setup

```powershell
# Desde la raíz del proyecto
cd C:\Proyectos\plataforma-saip-apelaciones

# Ejecutar el script (como Administrador si es posible)
.\scripts\setup-worktree.ps1 -DevName kelly
```

Esto creará:
- La rama `kelly/dev` a partir de `main`
- Un worktree en `C:\Proyectos\plataforma-saip-apelaciones-kelly`
- Symlinks de `.agents/`, `.github/agents`, `.github/skills`, etc.

## Paso 4: Abrir tu worktree en VS Code

```powershell
code C:\Proyectos\plataforma-saip-apelaciones-kelly
```

## Paso 5: Verificar que todo funciona

En la terminal de VS Code:

```powershell
# Verificar rama
git branch --show-current
# Debería mostrar: kelly/dev

# Verificar que los agentes están accesibles
Test-Path .agents\skills
Test-Path .github\agents
# Ambos deben mostrar: True
```

## Paso 6: Instalar dependencias (según lo que vayas a trabajar)

### Si trabajas en Frontend (Angular):
```powershell
cd frontend
npm install
```

### Si trabajas en Backend (Spring Boot):
```powershell
cd backend
.\mvnw.cmd clean compile
```

## 🔄 Flujo de Trabajo Diario

```powershell
# 1. Al empezar el día, actualizar desde main
git fetch origin
git rebase origin/main

# 2. Trabajar normalmente...
#    Si usas el agente AI (Copilot/Antigravity), él creará commits automáticamente.
#    Si haces commits manuales, usar staging selectivo:
git add <archivos-específicos>
git commit -m "✨ feat(frontend): nueva funcionalidad"

# 3. Al terminar, push tu trabajo
git push -u origin kelly/dev

# 4. Cuando tu feature esté lista:
#    → Crear Pull Request en GitHub (kelly/dev → main)
#    → Pedir review a Daniel
#    → Merge a main
#    → Luego ambos hacemos: git fetch origin && git rebase origin/main
```

## 📋 Convenciones de Commits

Usamos **Conventional Commits + Gitmoji**:

| Emoji | Tipo | Ejemplo |
|-------|------|---------|
| ✨ | feat | `✨ feat(frontend): agregar dashboard` |
| 🐛 | fix | `🐛 fix(backend): corregir validación` |
| 📝 | docs | `📝 docs: actualizar README` |
| 🎨 | style | `🎨 style(frontend): mejorar layout` |
| ♻️ | refactor | `♻️ refactor(backend): simplificar service` |

## ❓ Problemas Comunes

### "Permission denied (publickey)"
→ Tu SSH key no está configurada. Sigue: https://docs.github.com/en/authentication/connecting-to-github-with-ssh

### "Symlink fallido"
→ Ejecuta PowerShell como **Administrador**, o habilita **Developer Mode** en Windows Settings.

### "Cannot create worktree — branch already in use"
→ La rama `kelly/dev` ya tiene un worktree. Ejecuta `git worktree prune` y vuelve a intentar.

### Los agentes/skills no aparecen en el worktree
→ Verifica que las carpetas `.agents/` y `.github/agents` existen en el repo principal (`plataforma-saip-apelaciones/`). Si no, pídele a Daniel que te las envíe.

---

*Cualquier duda, contacta a Daniel* 🙌
