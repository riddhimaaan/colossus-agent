# Colossus launcher for Windows PowerShell.
#
# This mirrors the `colossus` bash script used on macOS and Linux. Keep the two
# in step: every environment variable set here has a counterpart there, and the
# runtime reads them all.
#
# Windows note: PowerShell has no `exec`, so bun runs as a child process and this
# script forwards its exit code rather than replacing itself.

$ErrorActionPreference = 'Stop'

# Resolve the real file first, so a shim or shortcut still finds the checkout.
$scriptPath = $MyInvocation.MyCommand.Path
$item = Get-Item -LiteralPath $scriptPath
if ($item.LinkType -eq 'SymbolicLink' -and $item.Target) {
  $scriptPath = $item.Target | Select-Object -First 1
}
$root = Split-Path -Parent (Resolve-Path -LiteralPath $scriptPath)
$runtime = Join-Path $root '.runtime'
$launchDirectory = (Get-Location).Path

# Capture the real profile directory before HOME is remapped into .runtime below.
$hostHome = if ($env:USERPROFILE) { $env:USERPROFILE } else { $env:HOME }

# Settings live in the user's home config, the way Kilo uses ~/.config/kilo.
$configDir = if ($env:COLOSSUS_CONFIG_DIR) { $env:COLOSSUS_CONFIG_DIR } else { Join-Path $hostHome '.config\colossus' }
$keyFile = Join-Path $configDir 'openrouter-api-key'

# Create the settings home on first run so a fresh install has somewhere to put
# skills without the user having to make the folders by hand.
foreach ($sub in @('skills', 'command', 'agent')) {
  New-Item -ItemType Directory -Force -Path (Join-Path $configDir $sub) | Out-Null
}

# Seed the starter profile so a fresh clone launches with a model and a
# permission baseline already set. Only ever fills in a missing file, so an
# edited profile survives every later launch and every `git pull`.
foreach ($seed in @('kilo.jsonc', 'AGENTS.md')) {
  $target = Join-Path $configDir $seed
  if (-not (Test-Path -LiteralPath $target)) {
    Copy-Item -LiteralPath (Join-Path $root "profile\$seed") -Destination $target
  }
}

# A user-created key file is the source of truth. Prefer it over inherited
# terminal variables: an old shell can otherwise retain a revoked key and cause
# intermittent-looking OpenRouter 401 errors.
if (Test-Path -LiteralPath $keyFile) {
  $env:OPENROUTER_API_KEY = (Get-Content -Raw -LiteralPath $keyFile).Trim()
}

$env:HOME = Join-Path $runtime 'home'
$env:USERPROFILE = $env:HOME
$env:XDG_CONFIG_HOME = Join-Path $runtime 'config'
$env:XDG_DATA_HOME = Join-Path $runtime 'data'
$env:XDG_CACHE_HOME = Join-Path $runtime 'cache'
$env:XDG_STATE_HOME = Join-Path $runtime 'state'
$env:KILO_CONFIG_DIR = $configDir
$env:KILO_DISABLE_EXTERNAL_SKILLS = '1'

# Permit skills and MCP/config files in the user's active workspace. The source
# checkout itself carries Kilo's bundled coding material, so keep project config
# disabled only when Colossus is launched from inside that checkout.
if ($launchDirectory -eq $root -or $launchDirectory.StartsWith($root + [IO.Path]::DirectorySeparatorChar)) {
  $env:KILO_DISABLE_PROJECT_CONFIG = '1'
} else {
  Remove-Item Env:\KILO_DISABLE_PROJECT_CONFIG -ErrorAction SilentlyContinue
}

# The source runtime needs its own working directory, while this tells the TUI
# which folder the user actually launched Colossus from.
$env:KILO_DEV_CWD = $launchDirectory

if ($args.Count -ge 2 -and $args[0] -eq 'prompt' -and $args[1] -eq 'show') {
  # Print the whole file: a line cap would silently break the transparency
  # promise as soon as the prompt grows past it.
  Get-Content -Raw -LiteralPath (Join-Path $root 'packages\opencode\src\session\prompt\creative-core.txt')
  exit 0
}

if ($args.Count -ge 1 -and $args[0] -eq 'doctor') {
  if (-not $env:OPENROUTER_API_KEY) {
    Write-Output 'OpenRouter: no OPENROUTER_API_KEY is available to Colossus.'
    Write-Output "Put the key in $keyFile, or set `$env:OPENROUTER_API_KEY before launching."
    exit 1
  }

  $headers = @{ Authorization = "Bearer $env:OPENROUTER_API_KEY" }
  try {
    Invoke-RestMethod -Uri 'https://openrouter.ai/api/v1/auth/key' -Headers $headers -TimeoutSec 15 | Out-Null
  } catch {
    # Never echo the response body: it can contain the key.
    Write-Output "OpenRouter: rejected the configured API key. $($_.Exception.Message)"
    exit 1
  }
  Write-Output 'OpenRouter: connected. The API key is valid.'

  if ($args.Count -ge 2 -and $args[1] -eq 'model') {
    # Default to the model kilo.jsonc actually pins, so the check reports on the
    # model a real session would use.
    $modelId = if ($args.Count -ge 3) { $args[2] } else { 'deepseek/deepseek-v4-flash' }
    try {
      Invoke-RestMethod -Uri "https://openrouter.ai/api/v1/models/$modelId" -Headers $headers -TimeoutSec 15 | Out-Null
      Write-Output "Model: $modelId is available to this key."
    } catch {
      Write-Output "Model: $modelId is not available. $($_.Exception.Message)"
      exit 1
    }
  }
  exit 0
}

$bun = Get-Command bun -ErrorAction SilentlyContinue
if ($bun) {
  $bunBin = $bun.Source
} elseif (Test-Path -LiteralPath (Join-Path $hostHome '.bun\bin\bun.exe')) {
  # Use the caller's real profile: HOME now points into .runtime for isolation.
  $bunBin = Join-Path $hostHome '.bun\bin\bun.exe'
} else {
  Write-Error 'Colossus needs Bun, but it was not found. See https://bun.sh/docs/installation'
  exit 1
}

# The runtime source lives in this fork, but an ordinary launch should operate on
# the caller's folder. Passing it as the TUI project makes its local skills and
# configuration discoverable.
$forward = if ($args.Count -eq 0) { @($launchDirectory) } else { $args }

& $bunBin run --cwd (Join-Path $root 'packages\opencode') --conditions=node 'src/index.ts' @forward
exit $LASTEXITCODE
