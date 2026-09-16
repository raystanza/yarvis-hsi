[CmdletBinding()]
param(
    [string]$OutputPath
)

$ErrorActionPreference = "Stop"

$BuildVersion = (Get-Content -LiteralPath (Join-Path $PSScriptRoot "version") -Raw).Trim()

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $PSScriptRoot "dist/YARVIS-v$BuildVersion.zip"
}

$packageFiles = @(
    "index.html"
    "core.js"
    "render.js"
    "effects.js"
    "modules.js"
    "persona.js"
    "app.js"
    "styles.css"
    "LivelyInfo.json"
    "LivelyProperties.json"
    "thumbnail.jpg"
    "preview.gif"
    "README.md"
    "LICENSE"
)

$packagePaths = foreach ($file in $packageFiles) {
    $path = Join-Path $PSScriptRoot $file
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required package file is missing: $file"
    }

    $path
}

if (-not [System.IO.Path]::IsPathRooted($OutputPath)) {
    $OutputPath = Join-Path $PSScriptRoot $OutputPath
}

$OutputPath = [System.IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path -Parent $OutputPath

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

if (Test-Path -LiteralPath $OutputPath) {
    Remove-Item -LiteralPath $OutputPath -Force
}

Compress-Archive `
    -LiteralPath $packagePaths `
    -DestinationPath $OutputPath `
    -CompressionLevel Optimal

Write-Host "Built $OutputPath"
