$ErrorActionPreference = 'Stop'

function Run-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][scriptblock]$Command
  )
  Write-Host "==> $Name"
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE"
  }
}

Run-Step "Root typecheck" { npm run typecheck }
Run-Step "Root lint" { npm run lint }
Run-Step "Root unit tests" { npm test }
Run-Step "Root build" { npm run build }
Run-Step "Root e2e smoke" { npm run test:e2e }
Run-Step "Server typecheck" { Push-Location server; try { npm run typecheck } finally { Pop-Location } }

$required = @(
  "electron-builder.yml",
  "RELEASING.md",
  "server\wrangler.toml",
  "docs\DISTRIBUTION_POLISH.md"
)

foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Missing release readiness file: $path"
  }
}

Write-Host "Release readiness passed."
