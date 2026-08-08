<#
.SYNOPSIS
  Sets up Colossus on native Windows.

.DESCRIPTION
  Does the whole Windows setup in one pass: finds a new enough Bun, installs the
  dependencies, seeds the config directory, stores the OpenRouter key, registers a
  `colossus` function in your PowerShell profile, and verifies the result.

  Safe to re-run. Every step is idempotent: an existing key is kept, and the profile
  entry is rewritten in place rather than appended a second time.

.PARAMETER ApiKey
  OpenRouter API key. Omit it and the script prompts, with the key hidden as you type.
  Prefer the prompt: a key passed as an argument lands in your PowerShell history.

.PARAMETER SkipProfile
  Do not touch the PowerShell profile. You will have to invoke colossus.ps1 by path.

.PARAMETER SkipInstall
  Do not run `bun install`. Useful when only re-registering the profile function.

.PARAMETER InstallBun
  Install Bun automatically from bun.sh if it is missing or too old, instead of
  stopping with instructions.

.EXAMPLE
  .\install.ps1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\install.ps1 -InstallBun
#>
[CmdletBinding()]
param(
  [string] $ApiKey,
  [switch] $SkipProfile,
  [switch] $SkipInstall,
  [switch] $InstallBun
)

$ErrorActionPreference = 'Stop'

# $PSScriptRoot is the directory holding this file, whatever the caller's working
# directory is. The README used to build the profile entry from $PWD, which silently
# produced a broken launcher for anyone who ran the line from outside the checkout.
$root = $PSScriptRoot
$launcher = Join-Path $root 'colossus.ps1'
$configDir = Join-Path $env:USERPROFILE '.config\colossus'
$keyFile = Join-Path $configDir 'openrouter-api-key'

function Write-Step { param([int] $Number, [string] $Text) Write-Host "`n[$Number/5] $Text" -ForegroundColor Cyan }
function Write-Ok { param([string] $Text) Write-Host "      $Text" -ForegroundColor Green }
function Write-Note { param([string] $Text) Write-Host "      $Text" -ForegroundColor DarkGray }

if (-not (Test-Path -LiteralPath $launcher)) {
  throw "colossus.ps1 is not next to this script. Run install.ps1 from inside the checkout, not a copy."
}

# The version the repository actually pins, so this check never drifts from package.json.
$requiredBun = [version] '1.3.14'
try {
  $pinned = (Get-Content -Raw -LiteralPath (Join-Path $root 'package.json') | ConvertFrom-Json).packageManager
  if ($pinned -match 'bun@([0-9]+\.[0-9]+\.[0-9]+)') { $requiredBun = [version] $Matches[1] }
} catch {
  Write-Note "Could not read packageManager from package.json; requiring Bun $requiredBun."
}

# ---------------------------------------------------------------------------
# 1. Bun
# ---------------------------------------------------------------------------
Write-Step 1 "Looking for Bun $requiredBun or newer"

function Get-BunVersion {
  param([string] $Path)
  try {
    $raw = & $Path --version 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    return [version] ($raw | Select-Object -First 1).Trim()
  } catch { return $null }
}

function Find-Bun {
  # Check every bun on PATH, not just the first. An npm-installed `bun` shim often
  # shadows a newer ~/.bun/bin/bun.exe, which is how a machine ends up running an
  # older Bun than the repository pins without anyone noticing.
  $candidates = @()
  $candidates += (Get-Command bun -All -ErrorAction SilentlyContinue | ForEach-Object { $_.Source })
  $candidates += (Join-Path $env:USERPROFILE '.bun\bin\bun.exe')

  $best = $null
  foreach ($candidate in ($candidates | Where-Object { $_ } | Select-Object -Unique)) {
    if (-not (Test-Path -LiteralPath $candidate)) { continue }
    $found = Get-BunVersion -Path $candidate
    if (-not $found) { continue }
    if (-not $best -or $found -gt $best.Version) {
      $best = [pscustomobject]@{ Path = $candidate; Version = $found }
    }
  }
  return $best
}

$bun = Find-Bun

if (-not $bun -or $bun.Version -lt $requiredBun) {
  $have = if ($bun) { "found $($bun.Version)" } else { 'none found' }
  Write-Note "Bun $requiredBun or newer is required ($have)."

  $doInstall = $InstallBun
  if (-not $doInstall -and [Environment]::UserInteractive) {
    $reply = Read-Host '      Download and install Bun now from bun.sh? [y/N]'
    $doInstall = $reply -match '^(y|yes)$'
  }

  if (-not $doInstall) {
    Write-Host "`nInstall Bun, then re-run this script:" -ForegroundColor Yellow
    Write-Host '  powershell -c "irm bun.sh/install.ps1 | iex"' -ForegroundColor Yellow
    exit 1
  }

  Write-Note 'Installing Bun from bun.sh ...'
  & powershell -NoProfile -Command 'irm bun.sh/install.ps1 | iex'
  $env:PATH = "$(Join-Path $env:USERPROFILE '.bun\bin');$env:PATH"
  $bun = Find-Bun
  if (-not $bun -or $bun.Version -lt $requiredBun) {
    throw "Bun is still missing or older than $requiredBun after the install. Open a new terminal and re-run this script."
  }
}

Write-Ok "Bun $($bun.Version) at $($bun.Path)"

# ---------------------------------------------------------------------------
# 2. Dependencies
# ---------------------------------------------------------------------------
Write-Step 2 'Installing dependencies'

if ($SkipInstall) {
  Write-Note 'Skipped (-SkipInstall).'
} else {
  Write-Note 'This downloads roughly 2 GB on a first run and takes several minutes.'
  Push-Location $root
  try {
    & $bun.Path install
    if ($LASTEXITCODE -ne 0) { throw "bun install failed with exit code $LASTEXITCODE." }
  } finally {
    Pop-Location
  }
  Write-Ok 'Dependencies installed.'
}

# ---------------------------------------------------------------------------
# 3. Config directory and API key
# ---------------------------------------------------------------------------
Write-Step 3 'Setting up the config directory'

foreach ($sub in @('skills', 'command', 'agent')) {
  New-Item -ItemType Directory -Force -Path (Join-Path $configDir $sub) | Out-Null
}
foreach ($seed in @('kilo.jsonc', 'AGENTS.md')) {
  $target = Join-Path $configDir $seed
  if (-not (Test-Path -LiteralPath $target)) {
    Copy-Item -LiteralPath (Join-Path $root "profile\$seed") -Destination $target
  }
}
Write-Ok "Config directory ready at $configDir"

$existingKey = ''
if (Test-Path -LiteralPath $keyFile) {
  $existingKey = ([IO.File]::ReadAllText($keyFile)).Trim()
}

if ($ApiKey) {
  $newKey = $ApiKey.Trim()
} elseif ($existingKey) {
  $newKey = ''
  Write-Ok 'An API key is already stored; leaving it alone.'
} elseif ([Environment]::UserInteractive) {
  Write-Note 'Paste your OpenRouter key from https://openrouter.ai/keys (input is hidden).'
  $secure = Read-Host '      OpenRouter API key' -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $newKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim()
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
} else {
  $newKey = ''
  Write-Note 'No API key given and no prompt available. Re-run with -ApiKey later.'
}

if ($newKey) {
  # WriteAllText with an explicit BOM-less encoder. Set-Content defaults to the ANSI
  # codepage and some hosts prepend a BOM, either of which corrupts the first bytes of
  # the key and produces an OpenRouter 401 that looks like a bad key rather than a bad file.
  [IO.File]::WriteAllText($keyFile, $newKey, (New-Object System.Text.UTF8Encoding $false))

  # The Unix instructions chmod 600 this file. This is the Windows equivalent: drop
  # inherited permissions and grant the current user alone read/write.
  try {
    & icacls $keyFile /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null
  } catch {
    Write-Note 'Could not tighten permissions on the key file; it is readable by your account only by default.'
  }
  Write-Ok "API key saved to $keyFile"
}

# ---------------------------------------------------------------------------
# 4. PowerShell profile
# ---------------------------------------------------------------------------
Write-Step 4 'Registering the colossus command'

if ($SkipProfile) {
  Write-Note "Skipped (-SkipProfile). Launch with: & '$launcher'"
} else {
  $beginMarker = '# >>> colossus >>>'
  $endMarker = '# <<< colossus <<<'
  $block = @($beginMarker, "function colossus { & '$launcher' @args }", $endMarker) -join [Environment]::NewLine

  $profileDir = Split-Path -Parent $PROFILE
  if (-not (Test-Path -LiteralPath $profileDir)) {
    New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
  }

  $content = ''
  if (Test-Path -LiteralPath $PROFILE) { $content = [IO.File]::ReadAllText($PROFILE) }

  if ($content -match [regex]::Escape($beginMarker)) {
    # Replace the managed block, so re-running after moving the checkout repoints it.
    $pattern = [regex]::Escape($beginMarker) + '.*?' + [regex]::Escape($endMarker)
    $content = [regex]::Replace($content, $pattern, $block.Replace('$', '$$$$'), 'Singleline')
  } else {
    # Drop any hand-written definition first, including the broken $PWD-derived one
    # older README instructions produced, so the shell cannot pick the stale one.
    $content = [regex]::Replace($content, '(?m)^\s*function\s+colossus\s*\{.*\}\s*$\r?\n?', '')
    if ($content -and -not $content.EndsWith("`n")) { $content += [Environment]::NewLine }
    $content += $block + [Environment]::NewLine
  }

  [IO.File]::WriteAllText($PROFILE, $content, (New-Object System.Text.UTF8Encoding $false))
  Write-Ok "colossus registered in $PROFILE"

  $policy = Get-ExecutionPolicy -Scope CurrentUser
  if ($policy -in @('Restricted', 'AllSigned')) {
    Write-Host "      Your execution policy is '$policy', which blocks the profile and the launcher." -ForegroundColor Yellow
    Write-Host '      Allow local scripts with:' -ForegroundColor Yellow
    Write-Host '        Set-ExecutionPolicy -Scope CurrentUser RemoteSigned' -ForegroundColor Yellow
  }
}

# ---------------------------------------------------------------------------
# 5. Verify
# ---------------------------------------------------------------------------
Write-Step 5 'Checking the install'

& $launcher doctor
$doctorExit = $LASTEXITCODE

Write-Host ''
if ($doctorExit -eq 0) {
  Write-Host 'Colossus is ready.' -ForegroundColor Green
  Write-Host 'Open a new PowerShell window, cd to the folder you want to work in, and run: colossus'
} else {
  Write-Host 'Setup finished, but the API key check did not pass. See the message above.' -ForegroundColor Yellow
  Write-Host "Re-run with a key at any time:  .\install.ps1 -SkipInstall"
}

exit $doctorExit
