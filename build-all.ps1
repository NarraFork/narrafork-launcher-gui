# NarraFork Launcher - Windows build script (PowerShell)
# Usage:
#   .\build-all.ps1                # Build for current platform (windows-x64)
#   .\build-all.ps1 all            # Build all available targets
#   .\build-all.ps1 windows        # Build Windows x64

param(
    [Parameter(Position=0)]
    [string[]]$Targets
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Info($msg)  { Write-Host "[INFO] $msg" -ForegroundColor Green }
function Warn($msg)  { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Error($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

$TargetMap = @{
    "windows-x64" = "x86_64-pc-windows-msvc"
    "windows-arm64" = "aarch64-pc-windows-msvc"
}

function Build-Target($name) {
    $rustTarget = $TargetMap[$name]
    if (-not $rustTarget) {
        Error "Unknown target: $name"
        return $false
    }

    Info "Building for $name ($rustTarget)..."

    # Check if rust target is installed
    $installed = rustup target list --installed 2>&1
    if ($installed -notcontains $rustTarget) {
        Info "Installing Rust target: $rustTarget"
        rustup target add $rustTarget
    }

    pnpm tauri build --target $rustTarget
    if ($LASTEXITCODE -ne 0) {
        Error "Build failed for $name"
        return $false
    }

    Info "Build complete for $name"
    Info "Output: src-tauri\target\$rustTarget\release\bundle\"
    return $true
}

# Install frontend dependencies
Info "Installing frontend dependencies..."
pnpm install

# Resolve targets
$buildTargets = @()

if (-not $Targets -or $Targets.Count -eq 0) {
    $buildTargets = @("windows-x64")
    Info "No target specified, building for: windows-x64"
}
elseif ($Targets[0] -eq "all") {
    $buildTargets = @("windows-x64")
    Warn "Cross-compiling to macOS/Linux from Windows is not supported by Tauri."
    Warn "Use GitHub Actions (.github/workflows/build.yml) for full cross-platform builds."
}
else {
    foreach ($t in $Targets) {
        switch ($t) {
            "windows" { $buildTargets += "windows-x64" }
            default   { $buildTargets += $t }
        }
    }
}

$success = 0
$fail = 0

foreach ($target in $buildTargets) {
    if (Build-Target $target) {
        $success++
    } else {
        $fail++
    }
}

Write-Host ""
Info "==============================="
Info "Build Summary"
Info "  Success: $success"
if ($fail -gt 0) { Error "  Failed:  $fail" }
Info "==============================="
Info "Build artifacts: src-tauri\target\*\release\bundle\"
