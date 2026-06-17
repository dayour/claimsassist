<#
.SYNOPSIS
    Deploy the Claim_Studio solution (Workers' Compensation Case Management) to a
    Power Platform / Dataverse environment - hardened, idempotent, and safe to
    re-run.

.DESCRIPTION
    Imports the exported ClaimStudio solution into a target environment using the
    Power Platform CLI (pac). The solution contains:
      - The WorkersCompensationCase table (logical name owcp_claim): columns,
        choice option sets, the Information form, and views.
      - The "Workers' Comp Cases" model-driven app (unique name dystudio_wccases).
      - The Claim_Studio code app bundle (resolves its Dataverse org at runtime, so
        the same build works in any environment - no rebuild required).
      - The app icon web resource.

    The script performs preflight validation, authenticates to the target org,
    detects whether the solution already exists (fresh import vs. upgrade),
    imports with retry, publishes customizations, and verifies the result.

.PARAMETER EnvironmentUrl
    Target Dataverse org URL, e.g. https://contoso.crm.dynamics.com

.PARAMETER SolutionZip
    Path to the solution zip. Defaults to the managed zip next to this script.
    Use the unmanaged zip for a development/source environment.

.PARAMETER Managed
    Import the managed solution (default $true). $false imports the unmanaged
    solution (development environments only).

.PARAMETER UseDeviceCode
    Use device-code sign-in instead of the interactive browser flow (only used
    when a new auth profile must be created).

.PARAMETER ForceNewAuth
    Skip reusing the active pac auth profile and always create a fresh one.
    By default the script reuses the signed-in profile (via `pac org select`)
    to avoid an interactive sign-in when you are already authenticated to the
    target tenant.

.PARAMETER SolutionName
    Solution unique name (default ClaimStudio). Used for existence/version checks.

.PARAMETER MaxAsyncWaitMinutes
    Max wait for the async import (default 60).

.EXAMPLE
    .\Deploy-ClaimStudio.ps1 -EnvironmentUrl https://contoso.crm.dynamics.com

.EXAMPLE
    .\Deploy-ClaimStudio.ps1 -EnvironmentUrl https://dev.crm.dynamics.com `
        -SolutionZip .\ClaimStudio_unmanaged.zip -Managed:$false

.NOTES
    Requires the Power Platform CLI (pac):
        winget install Microsoft.PowerPlatformCLI
    The deploying user needs the System Customizer or System Administrator role
    in the target environment.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https://.+\.dynamics\.com/?$')]
    [string]$EnvironmentUrl,

    [string]$SolutionZip,
    [bool]$Managed = $true,
    [switch]$UseDeviceCode,
    [switch]$ForceNewAuth,
    [string]$SolutionName = "ClaimStudio",
    [int]$MaxAsyncWaitMinutes = 60
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$profileName = "owcp-deploy"

function Write-Step($m){ Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Write-Ok($m){ Write-Host "  [OK] $m" -ForegroundColor Green }
function Write-Warn($m){ Write-Host "  [!] $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "`n[FAILED] $m" -ForegroundColor Red; exit 1 }

# ---------------------------------------------------------------------------
# 1. Preflight
# ---------------------------------------------------------------------------
Write-Step "Preflight checks"

if (-not (Get-Command pac -ErrorAction SilentlyContinue)) {
    Fail "Power Platform CLI (pac) not found. Install: winget install Microsoft.PowerPlatformCLI"
}
Write-Ok "pac CLI present ($((pac --version) 2>$null | Select-Object -First 1))"

if (-not $SolutionZip) {
    $SolutionZip = Join-Path $scriptDir ($(if ($Managed) {"ClaimStudio_managed.zip"} else {"ClaimStudio_unmanaged.zip"}))
}
if (-not (Test-Path $SolutionZip)) { Fail "Solution zip not found: $SolutionZip" }

# Validate the zip really is a solution (contains solution.xml).
try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $SolutionZip))
    $hasSolutionXml = $zip.Entries.FullName -contains "solution.xml"
    $zip.Dispose()
    if (-not $hasSolutionXml) { Fail "Zip does not contain solution.xml - not a valid solution: $SolutionZip" }
} catch { Fail "Could not read solution zip: $($_.Exception.Message)" }
Write-Ok "Solution zip valid: $SolutionZip"
Write-Host "  Target  : $EnvironmentUrl"
Write-Host "  Managed : $Managed"

# ---------------------------------------------------------------------------
# 2. Authenticate
#    Prefer reusing an existing pac auth profile for the SAME tenant via
#    `pac org select` (no interactive prompt). Only create a new profile when
#    no usable profile exists, or when -ForceNewAuth is set.
# ---------------------------------------------------------------------------
Write-Step "Connecting to target environment"

$connected = $false
if (-not $ForceNewAuth) {
    # Is there already an active auth profile we can point at the target org?
    $hasProfile = (pac auth list 2>&1 | Select-String -SimpleMatch "UNIVERSAL")
    if ($hasProfile) {
        Write-Host "  Trying to reuse the active auth profile (no sign-in prompt)..."
        pac org select --environment $EnvironmentUrl 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $connected = $true
            Write-Ok "Reused existing auth profile for $EnvironmentUrl"
        } else {
            Write-Warn "Could not target $EnvironmentUrl with the active profile - will create a new one."
        }
    }
}

if (-not $connected) {
    pac auth delete --name $profileName 2>$null | Out-Null
    $createArgs = @("auth","create","--name",$profileName,"--environment",$EnvironmentUrl)
    if ($UseDeviceCode) { $createArgs += "--deviceCode" }
    Write-Host "  Creating a new auth profile (a sign-in window may open)..."
    pac @createArgs
    if ($LASTEXITCODE -ne 0) { Fail "Authentication failed." }
    pac auth select --name $profileName | Out-Null
}

Write-Step "Verifying connection"
$who = pac org who 2>&1
$who | Write-Host
if ($LASTEXITCODE -ne 0) { Fail "Could not connect to $EnvironmentUrl" }
Write-Ok "Connected"

# ---------------------------------------------------------------------------
# 3. Detect existing solution (fresh import vs. upgrade)
# ---------------------------------------------------------------------------
Write-Step "Checking for an existing '$SolutionName' solution"
$existing = pac solution list 2>&1 | Select-String -SimpleMatch $SolutionName
if ($existing) {
    Write-Warn "Solution '$SolutionName' already present - importing as an upgrade."
    $upgrade = $true
} else {
    Write-Ok "No existing solution - performing a fresh import."
    $upgrade = $false
}

# ---------------------------------------------------------------------------
# 4. Import (with one retry on transient failure)
# ---------------------------------------------------------------------------
Write-Step "Importing solution (may take several minutes)"
$importArgs = @("solution","import","--path",$SolutionZip,
                "--publish-changes","--activate-plugins",
                "--max-async-wait-time",$MaxAsyncWaitMinutes)
if (-not $Managed) { $importArgs += "--force-overwrite" }
if ($upgrade)      { $importArgs += "--stage-and-upgrade" }

$attempt = 0
do {
    $attempt++
    pac @importArgs
    $code = $LASTEXITCODE
    if ($code -eq 0) { break }
    if ($attempt -lt 2) { Write-Warn "Import attempt $attempt failed (exit $code). Retrying in 20s..."; Start-Sleep 20 }
} while ($attempt -lt 2)
if ($code -ne 0) { Fail "Solution import failed after $attempt attempt(s)." }
Write-Ok "Solution imported"

# ---------------------------------------------------------------------------
# 5. Publish customizations
# ---------------------------------------------------------------------------
Write-Step "Publishing all customizations"
pac solution publish
if ($LASTEXITCODE -ne 0) { Write-Warn "Publish returned a non-zero code; verify in the maker portal." }

# ---------------------------------------------------------------------------
# 6. Verify
# ---------------------------------------------------------------------------
Write-Step "Verifying deployment"
$verify = pac solution list 2>&1
$line = $verify | Select-String -SimpleMatch $SolutionName
if ($line) { Write-Ok "Solution present after import:"; $line | ForEach-Object { Write-Host "    $_" } }
else { Write-Warn "Could not confirm the solution via 'pac solution list' - check the maker portal." }

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
$base = $EnvironmentUrl.TrimEnd('/')
Write-Step "Deployment complete"
Write-Host "Model-driven app (table grid):" -ForegroundColor Green
Write-Host "  $base/main.aspx?appname=dystudio_wccases&pagetype=entitylist&etn=owcp_claim"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. In make.powerapps.com (target env) confirm 'Workers' Comp Cases' and the Claim_Studio code app are listed."
Write-Host "  2. Share both apps and assign security roles to your users."
Write-Host "  3. CODE APP CONNECTION: the first time the Claim_Studio code app is played in this"
Write-Host "     environment, the user is prompted to create/confirm the Microsoft Dataverse"
Write-Host "     connection. The app resolves its Dataverse org at runtime, so no rebuild is needed."
Write-Host "  4. The WorkersCompensationCase table ships empty - begin filing incidents or load seed data."
