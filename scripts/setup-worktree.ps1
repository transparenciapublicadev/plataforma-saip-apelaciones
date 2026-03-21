<#
.SYNOPSIS
    Configura un git worktree para desarrollo con symlinks a archivos de agentes/skills.
.DESCRIPTION
    Este script automatiza la creación de un worktree de desarrollo para el proyecto
    plataforma-saip-apelaciones. Crea la rama de desarrollo, el worktree, y los
    symlinks necesarios para que .agents/ y .github/ estén disponibles.
.PARAMETER DevName
    Nombre del desarrollador (daniel, kelly)
.PARAMETER BasePath
    Ruta base donde está el repo principal (por defecto: directorio padre del repo)
.EXAMPLE
    .\setup-worktree.ps1 -DevName daniel
    .\setup-worktree.ps1 -DevName kelly -BasePath "C:\Proyectos"
#>
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("daniel", "kelly")]
    [string]$DevName,

    [string]$BasePath
)

$ErrorActionPreference = "Stop"

# Detectar ruta del repo (el script está en scripts/ dentro del repo)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoPath = Split-Path -Parent $scriptDir

if (-not $BasePath) {
    $BasePath = Split-Path -Parent $repoPath
}

$repoName = Split-Path -Leaf $repoPath
$worktreePath = Join-Path $BasePath "$repoName-$DevName"
$branchName = "$DevName/dev"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  🌲 Setup Worktree — Plataforma SAIP            ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Desarrollador : $DevName" -ForegroundColor White
Write-Host "  Repo principal: $repoPath" -ForegroundColor White
Write-Host "  Worktree      : $worktreePath" -ForegroundColor White
Write-Host "  Rama          : $branchName" -ForegroundColor White
Write-Host ""

# ─── 1. Limpiar worktrees huérfanos ──────────────────────────
Write-Host "🧹 [1/5] Limpiando worktrees huérfanos..." -ForegroundColor Yellow
Push-Location $repoPath
try {
    git worktree prune 2>$null
    Write-Host "  ✅ Worktrees limpiados" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  No se pudieron limpiar worktrees: $_" -ForegroundColor Yellow
}

# ─── 2. Crear rama si no existe ──────────────────────────────
Write-Host "🌿 [2/5] Verificando rama $branchName..." -ForegroundColor Yellow
$branchExists = git branch --list $branchName 2>$null
if (-not $branchExists) {
    git branch $branchName main
    Write-Host "  ✅ Rama $branchName creada desde main" -ForegroundColor Green
} else {
    Write-Host "  ✅ Rama $branchName ya existe" -ForegroundColor Green
}

# ─── 3. Crear worktree ──────────────────────────────────────
Write-Host "📁 [3/5] Creando worktree..." -ForegroundColor Yellow
if (Test-Path $worktreePath) {
    # Verificar si ya es un worktree válido
    $gitFile = Join-Path $worktreePath ".git"
    if (Test-Path $gitFile) {
        Write-Host "  ✅ Worktree ya existe en $worktreePath" -ForegroundColor Green
    } else {
        Write-Host "  ❌ La carpeta existe pero NO es un worktree válido." -ForegroundColor Red
        Write-Host "     Elimina la carpeta manualmente y vuelve a ejecutar." -ForegroundColor Red
        Pop-Location
        exit 1
    }
} else {
    git worktree add $worktreePath $branchName
    Write-Host "  ✅ Worktree creado en $worktreePath" -ForegroundColor Green
}
Pop-Location

# ─── 4. Symlinks para archivos ignorados ─────────────────────
Write-Host "🔗 [4/5] Creando symlinks para agents/skills/config..." -ForegroundColor Yellow
Push-Location $worktreePath

# Función auxiliar para crear symlink con fallback a copia
function New-SymlinkOrCopy {
    param([string]$LinkPath, [string]$TargetPath)

    if (-not (Test-Path $TargetPath)) {
        Write-Host "  ⏭️  $LinkPath → fuente no existe, omitiendo" -ForegroundColor Gray
        return
    }
    if (Test-Path $LinkPath) {
        Write-Host "  ✅ $LinkPath ya existe" -ForegroundColor Gray
        return
    }
    try {
        New-Item -ItemType SymbolicLink -Path $LinkPath -Target $TargetPath -ErrorAction Stop | Out-Null
        Write-Host "  🔗 $LinkPath → $TargetPath" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠️  Symlink fallido para $LinkPath (¿falta permisos de Admin?)" -ForegroundColor Yellow
        Write-Host "     → Copiando como alternativa..." -ForegroundColor Yellow
        try {
            Copy-Item -Recurse $TargetPath $LinkPath -ErrorAction Stop
            Write-Host "  📋 $LinkPath copiado (sin symlink)" -ForegroundColor Yellow
        } catch {
            Write-Host "  ❌ No se pudo copiar ${LinkPath}: $_" -ForegroundColor Red
        }
    }
}

# Carpetas completas que están 100% en .gitignore
$fullSymlinks = @(
    @{ Path = ".agents";   Target = Join-Path $repoPath ".agents" },
    @{ Path = ".windsurf"; Target = Join-Path $repoPath ".windsurf" },
    @{ Path = "memories";  Target = Join-Path $repoPath "memories" }
)

foreach ($link in $fullSymlinks) {
    New-SymlinkOrCopy -LinkPath $link.Path -TargetPath $link.Target
}

# .github/ es especial: workflows/ está trackeado, pero agents/, skills/,
# copilot-instructions.md y copilot-repo-notes.md están en .gitignore.
# Creamos symlinks solo para los items ignorados DENTRO de .github/
Write-Host "  📂 .github/ (parcialmente trackeado, creando symlinks internos)" -ForegroundColor Cyan
$githubIgnored = @(
    @{ Path = ".github\agents";                 Target = Join-Path $repoPath ".github\agents" },
    @{ Path = ".github\skills";                 Target = Join-Path $repoPath ".github\skills" },
    @{ Path = ".github\copilot-instructions.md"; Target = Join-Path $repoPath ".github\copilot-instructions.md" },
    @{ Path = ".github\copilot-repo-notes.md";  Target = Join-Path $repoPath ".github\copilot-repo-notes.md" }
)

foreach ($link in $githubIgnored) {
    New-SymlinkOrCopy -LinkPath $link.Path -TargetPath $link.Target
}

Pop-Location

# ─── 5. Verificación final ───────────────────────────────────
Write-Host "🔍 [5/5] Verificación:" -ForegroundColor Yellow
Write-Host ""
Push-Location $repoPath
git worktree list
Pop-Location

Write-Host ""

# Verificar que los archivos están accesibles en el worktree
$checks = @(
    @{ Path = (Join-Path $worktreePath ".agents\skills");    Label = ".agents/skills" },
    @{ Path = (Join-Path $worktreePath ".agents\workflows"); Label = ".agents/workflows" },
    @{ Path = (Join-Path $worktreePath ".github\agents");    Label = ".github/agents" },
    @{ Path = (Join-Path $worktreePath ".github\skills");    Label = ".github/skills" }
)

$allOk = $true
foreach ($check in $checks) {
    if (Test-Path $check.Path) {
        Write-Host "  ✅ $($check.Label)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $($check.Label) NO accesible" -ForegroundColor Red
        $allOk = $false
    }
}

Write-Host ""
if ($allOk) {
    Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║  ✅ ¡Setup completado exitosamente!              ║" -ForegroundColor Green
    Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Green
} else {
    Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Yellow
    Write-Host "║  ⚠️  Setup completado con advertencias           ║" -ForegroundColor Yellow
    Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📌 Próximos pasos:" -ForegroundColor Cyan
Write-Host "   1. Abre VS Code:  code $worktreePath" -ForegroundColor White
Write-Host "   2. Tu rama:       $branchName" -ForegroundColor White
Write-Host "   3. Push:          git push -u origin $branchName" -ForegroundColor White
Write-Host ""
