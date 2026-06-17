<#
.SYNOPSIS
    Create the Claim_Studio "OWCP Claim" table and all columns in Dataverse
    from OWCP_Claim.schema.json, using the Dataverse Web API.

    This performs the same metadata operations the dataverse-mcp server exposes
    (create_table / create_column), but as a repeatable, reviewable script.

.DESCRIPTION
    - Reads the table + column definitions from OWCP_Claim.schema.json.
    - Acquires an access token for the target environment (Az CLI, then
      MSAL.PS device-code fallback).
    - Creates the table with its primary name column, then adds every other
      column with the correct Dataverse attribute type (String, Memo, Choice,
      DateOnly, Money, Decimal, Boolean).
    - Idempotent-ish: skips creation when the table or a column already exists.

.PARAMETER EnvironmentUrl
    Dataverse org URL. Default: https://darbotlabs.crm.dynamics.com

.PARAMETER SchemaPath
    Path to OWCP_Claim.schema.json. Defaults to the script folder.

.PARAMETER SolutionUniqueName
    Optional unsolution name; when set, new components are added to it via the
    MSCRM.SolutionUniqueName header.

.PARAMETER WhatIf
    Print the payloads without calling the API.

.EXAMPLE
    .\New-OwcpClaimTable.ps1
    .\New-OwcpClaimTable.ps1 -SolutionUniqueName owcpstudio -Verbose
    .\New-OwcpClaimTable.ps1 -WhatIf
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$EnvironmentUrl = "https://darbotlabs.crm.dynamics.com",
    [string]$SchemaPath = (Join-Path $PSScriptRoot "OWCP_Claim.schema.json"),
    [string]$SolutionUniqueName
)

$ErrorActionPreference = "Stop"
$EnvironmentUrl = $EnvironmentUrl.TrimEnd("/")
$apiBase = "$EnvironmentUrl/api/data/v9.2"
$LCID = 1033

# ─────────────────────────────── Auth ───────────────────────────────
function Get-DataverseToken {
    param([string]$Resource)

    # 1) Azure CLI
    $az = Get-Command az -ErrorAction SilentlyContinue
    if ($az) {
        try {
            Write-Verbose "Requesting token via Azure CLI…"
            $json = az account get-access-token --resource $Resource --output json 2>$null
            if ($LASTEXITCODE -eq 0 -and $json) {
                return ($json | ConvertFrom-Json).accessToken
            }
        } catch { Write-Verbose "Az CLI token failed: $_" }
    }

    # 2) MSAL.PS device code (well-known PowerShell client id)
    if (-not (Get-Module -ListAvailable -Name MSAL.PS)) {
        Write-Host "Installing MSAL.PS (CurrentUser)…" -ForegroundColor Yellow
        Install-Module MSAL.PS -Scope CurrentUser -Force -AcceptLicense -ErrorAction Stop
    }
    Import-Module MSAL.PS -ErrorAction Stop
    $clientId = "51f81489-12ee-4a9e-aaae-a2591f45987d"  # Microsoft public PowerShell client
    Write-Verbose "Requesting token via MSAL device code…"
    $tok = Get-MsalToken -ClientId $clientId -Scopes "$Resource/.default" -DeviceCode
    return $tok.AccessToken
}

# ───────────────────────────── REST helper ──────────────────────────
function Invoke-Dv {
    param(
        [Parameter(Mandatory)][string]$Method,
        [Parameter(Mandatory)][string]$Path,
        [object]$Body
    )
    $headers = @{
        "Authorization"    = "Bearer $script:Token"
        "OData-MaxVersion" = "4.0"
        "OData-Version"    = "4.0"
        "Accept"           = "application/json"
        "Content-Type"     = "application/json; charset=utf-8"
    }
    if ($SolutionUniqueName) { $headers["MSCRM.SolutionUniqueName"] = $SolutionUniqueName }

    $uri = if ($Path -match '^https?://') { $Path } else { "$apiBase/$Path" }
    $json = if ($null -ne $Body) { $Body | ConvertTo-Json -Depth 25 } else { $null }

    if ($PSCmdlet -and -not $PSCmdlet.ShouldProcess($uri, $Method)) {
        Write-Host "── WhatIf $Method $uri" -ForegroundColor DarkGray
        if ($json) { Write-Host $json -ForegroundColor DarkGray }
        return $null
    }
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body $json
}

# ────────────────────────── Label builders ──────────────────────────
function New-Label([string]$text) {
    @{
        "@odata.type"     = "Microsoft.Dynamics.CRM.Label"
        "LocalizedLabels" = @(@{
                "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"
                "Label"       = $text
                "LanguageCode" = $LCID
            })
    }
}
function New-RequiredLevel([string]$level) {
    @{ "Value" = ($level ? $level : "None"); "CanBeChanged" = $true }
}

# ──────────────────── Attribute payload factory ─────────────────────
function New-AttributePayload([pscustomobject]$col) {
    $base = @{
        "SchemaName"    = $col.schemaName
        "DisplayName"   = (New-Label $col.displayName)
        "RequiredLevel" = (New-RequiredLevel $col.requiredLevel)
    }
    if ($col.description) { $base["Description"] = (New-Label $col.description) }

    switch ($col.type) {
        "String" {
            $base["@odata.type"]      = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
            $base["AttributeType"]    = "String"
            $base["AttributeTypeName"] = @{ "Value" = "StringType" }
            $base["MaxLength"]        = [int]($col.maxLength ?? 200)
            $base["FormatName"]       = @{ "Value" = "Text" }
        }
        "Memo" {
            $base["@odata.type"]      = "Microsoft.Dynamics.CRM.MemoAttributeMetadata"
            $base["AttributeType"]    = "Memo"
            $base["AttributeTypeName"] = @{ "Value" = "MemoType" }
            $base["MaxLength"]        = [int]($col.maxLength ?? 2000)
            $base["Format"]           = "TextArea"
        }
        "DateOnly" {
            $base["@odata.type"]      = "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata"
            $base["AttributeType"]    = "DateTime"
            $base["AttributeTypeName"] = @{ "Value" = "DateTimeType" }
            $base["Format"]           = "DateOnly"
            $base["DateTimeBehavior"] = @{ "Value" = "DateOnly" }
        }
        "Money" {
            $base["@odata.type"]      = "Microsoft.Dynamics.CRM.MoneyAttributeMetadata"
            $base["AttributeType"]    = "Money"
            $base["AttributeTypeName"] = @{ "Value" = "MoneyType" }
            $base["MinValue"]         = [double]($col.minValue ?? 0)
            $base["MaxValue"]         = [double]($col.maxValue ?? 1000000000)
            $base["Precision"]        = [int]($col.precision ?? 2)
            $base["PrecisionSource"]  = 2
        }
        "Decimal" {
            $base["@odata.type"]      = "Microsoft.Dynamics.CRM.DecimalAttributeMetadata"
            $base["AttributeType"]    = "Decimal"
            $base["AttributeTypeName"] = @{ "Value" = "DecimalType" }
            $base["MinValue"]         = [double]($col.minValue ?? 0)
            $base["MaxValue"]         = [double]($col.maxValue ?? 1000000000)
            $base["Precision"]        = [int]($col.precision ?? 2)
        }
        "Boolean" {
            $base["@odata.type"]      = "Microsoft.Dynamics.CRM.BooleanAttributeMetadata"
            $base["AttributeType"]    = "Boolean"
            $base["AttributeTypeName"] = @{ "Value" = "BooleanType" }
            $base["DefaultValue"]     = [bool]($col.defaultValue ?? $false)
            $base["OptionSet"]        = @{
                "@odata.type" = "Microsoft.Dynamics.CRM.BooleanOptionSetMetadata"
                "TrueOption"  = @{ "Value" = 1; "Label" = (New-Label ($col.trueLabel  ?? "Yes")) }
                "FalseOption" = @{ "Value" = 0; "Label" = (New-Label ($col.falseLabel ?? "No")) }
            }
        }
        "Choice" {
            $opts = @()
            $v = 100000000
            foreach ($o in $col.options) {
                $opts += @{ "Value" = $v; "Label" = (New-Label $o) }
                $v++
            }
            $base["@odata.type"]      = "Microsoft.Dynamics.CRM.PicklistAttributeMetadata"
            $base["AttributeType"]    = "Picklist"
            $base["AttributeTypeName"] = @{ "Value" = "PicklistType" }
            $base["OptionSet"]        = @{
                "@odata.type"   = "Microsoft.Dynamics.CRM.OptionSetMetadata"
                "IsGlobal"      = $false
                "OptionSetType" = "Picklist"
                "Options"       = $opts
            }
        }
        default { throw "Unknown column type '$($col.type)' for $($col.schemaName)" }
    }
    return $base
}

# ─────────────────────────── Existence checks ───────────────────────
function Test-TableExists([string]$logicalName) {
    try {
        $r = Invoke-Dv GET "EntityDefinitions(LogicalName='$logicalName')?`$select=LogicalName"
        return $null -ne $r
    } catch { return $false }
}
function Test-ColumnExists([string]$entityLogical, [string]$attrLogical) {
    try {
        $r = Invoke-Dv GET "EntityDefinitions(LogicalName='$entityLogical')/Attributes(LogicalName='$attrLogical')?`$select=LogicalName"
        return $null -ne $r
    } catch { return $false }
}

# ════════════════════════════════ MAIN ══════════════════════════════
if (-not (Test-Path $SchemaPath)) { throw "Schema file not found: $SchemaPath" }
$schema = Get-Content $SchemaPath -Raw | ConvertFrom-Json

Write-Host "Claim_Studio — Dataverse table provisioning" -ForegroundColor Cyan
Write-Host "  Environment : $EnvironmentUrl"
Write-Host "  Table       : $($schema.table.schemaName)"
Write-Host "  Columns     : $($schema.columns.Count + 1) (incl. primary)"
if ($SolutionUniqueName) { Write-Host "  Solution    : $SolutionUniqueName" }

$script:Token = Get-DataverseToken -Resource $EnvironmentUrl
Write-Host "  Auth        : token acquired" -ForegroundColor Green

$tbl = $schema.table
$entityLogical = $tbl.logicalName

# 1) Table (+ primary name column) ─────────────────────────────
if (Test-TableExists $entityLogical) {
    Write-Host "» Table '$entityLogical' already exists — skipping create." -ForegroundColor Yellow
} else {
    $pk = $tbl.primaryColumn
    $primary = @{
        "@odata.type"      = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
        "AttributeType"    = "String"
        "AttributeTypeName" = @{ "Value" = "StringType" }
        "SchemaName"       = $pk.schemaName
        "MaxLength"        = [int]($pk.maxLength ?? 100)
        "FormatName"       = @{ "Value" = "Text" }
        "IsPrimaryName"    = $true
        "RequiredLevel"    = (New-RequiredLevel $pk.requiredLevel)
        "DisplayName"      = (New-Label $pk.displayName)
    }
    if ($pk.description) { $primary["Description"] = (New-Label $pk.description) }

    $entity = @{
        "@odata.type"           = "Microsoft.Dynamics.CRM.EntityMetadata"
        "SchemaName"            = $tbl.schemaName
        "DisplayName"           = (New-Label $tbl.displayName)
        "DisplayCollectionName" = (New-Label $tbl.displayCollectionName)
        "Description"           = (New-Label $tbl.description)
        "OwnershipType"         = ($tbl.ownershipType ?? "UserOwned")
        "IsActivity"            = $false
        "HasActivities"         = $false
        "HasNotes"              = $false
        "Attributes"            = @($primary)
    }
    Write-Host "» Creating table '$($tbl.schemaName)'…" -ForegroundColor Cyan
    Invoke-Dv POST "EntityDefinitions" $entity | Out-Null
    Write-Host "  ✓ Table created with primary column '$($pk.schemaName)'" -ForegroundColor Green
}

# 2) Remaining columns ─────────────────────────────────────────
$created = 0; $skipped = 0
foreach ($col in $schema.columns) {
    $attrLogical = $col.schemaName.ToLower()
    if (Test-ColumnExists $entityLogical $attrLogical) {
        Write-Host "  • $($col.schemaName) exists — skip" -ForegroundColor DarkYellow
        $skipped++; continue
    }
    $payload = New-AttributePayload $col
    Write-Host "  + $($col.schemaName) [$($col.type)]" -ForegroundColor Gray
    Invoke-Dv POST "EntityDefinitions(LogicalName='$entityLogical')/Attributes" $payload | Out-Null
    $created++
}

# 3) Publish ────────────────────────────────────────────────────
Write-Host "» Publishing customizations…" -ForegroundColor Cyan
try {
    Invoke-Dv POST "PublishAllXml" @{} | Out-Null
    Write-Host "  ✓ Published" -ForegroundColor Green
} catch { Write-Warning "Publish call failed (non-fatal): $_" }

Write-Host "`nDone. Columns created: $created  skipped: $skipped" -ForegroundColor Green
Write-Host "Table: $($tbl.schemaName)  ($entityLogical)" -ForegroundColor Green
