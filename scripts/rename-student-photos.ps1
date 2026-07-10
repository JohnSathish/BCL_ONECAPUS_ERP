<#
.SYNOPSIS
  Bulk-rename student photos to roll numbers using an Excel/CSV mapping.

.DESCRIPTION
  Expects either:
    - No header row: column A = roll number, column B = full photo path
    - Header row: columns named like "ROLL NO." and "Photo Path" (path may be column B or C)

  Example:
    IMG_6181.JPG  ->  BC24-002.JPG   (same folder as original)

.PARAMETER NoHeader
  Excel/CSV has no header row. Column A = roll, column B = photo path.
  Auto-detected when row 1 already looks like data.

.PARAMETER MappingFile
  Path to .xlsx or .csv mapping file.

.PARAMETER Execute
  Actually rename files. Without this flag, only shows a preview.

.PARAMETER OutputFolder
  Optional folder to move/copy renamed files into.
  Default: rename in place (same folder as each photo).

.EXAMPLE
  .\rename-student-photos.ps1 -MappingFile "C:\Users\johnm\Desktop\photo-map.xlsx"

.EXAMPLE
  .\rename-student-photos.ps1 -MappingFile "C:\Users\johnm\Desktop\photo-map.csv" -Execute

.EXAMPLE
  .\rename-student-photos.ps1 -MappingFile ".\map.xlsx" -Execute -OutputFolder "E:\IdCard\2024\Photos-Renamed"
#>
param(
  [Parameter(Mandatory = $true)]
  [string] $MappingFile,

  [switch] $Execute,

  [switch] $NoHeader,

  [string] $OutputFolder = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Normalize-Roll([string] $Value) {
  ($Value -replace '[\\/:*?"<>|]', '-').Trim()
}

function Test-LooksLikePhotoPath([string] $Value) {
  $text = $Value.Trim()
  return $text -match '\\' -and $text -match '\.(jpg|jpeg|png|webp)$'
}

function Test-LooksLikeRoll([string] $Value) {
  $text = $Value.Trim()
  return $text -match '^[A-Za-z]{2,}\d*-\d+'
}

function Read-MappingFromCsv([string] $Path, [bool] $NoHeader) {
  if ($NoHeader) {
    $result = @()
    Get-Content -LiteralPath $Path | ForEach-Object {
      $line = $_.Trim()
      if (-not $line) { return }
      $parts = $line -split ',', 2
      if ($parts.Count -lt 2) { return }
      $roll = $parts[0].Trim().Trim('"')
      $photo = $parts[1].Trim().Trim('"')
      if ($roll -and $photo) {
        $result += [pscustomobject]@{ Roll = $roll; PhotoPath = $photo }
      }
    }
    return $result
  }

  $rows = Import-Csv -Path $Path
  $result = @()
  foreach ($row in $rows) {
    $roll = $null
    $photo = $null
    foreach ($prop in $row.PSObject.Properties) {
      $name = $prop.Name.Trim().ToLower()
      if ($name -match 'roll') { $roll = [string]$prop.Value }
      if ($name -match 'photo') { $photo = [string]$prop.Value }
    }
    if ($roll -and $photo) {
      $result += [pscustomobject]@{ Roll = $roll; PhotoPath = $photo }
    }
  }
  return $result
}

function Read-MappingFromExcel([string] $Path, [bool] $ForceNoHeader) {
  $excel = $null
  $workbook = $null
  try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $workbook = $excel.Workbooks.Open((Resolve-Path $Path).Path)
    $sheet = $workbook.Worksheets.Item(1)
    $used = $sheet.UsedRange
    $rowCount = $used.Rows.Count

    $firstRoll = [string]$sheet.Cells.Item(1, 1).Text
    $firstCol2 = [string]$sheet.Cells.Item(1, 2).Text
    $firstCol3 = [string]$sheet.Cells.Item(1, 3).Text

    $hasHeader = -not $ForceNoHeader -and (
      $firstRoll.Trim().ToLower() -match 'roll' -or
      $firstCol2.Trim().ToLower() -match 'name' -or
      $firstCol2.Trim().ToLower() -match 'photo'
    )

    $rollCol = 1
    $photoCol = 2
    $startRow = 1

    if ($hasHeader) {
      $startRow = 2
      $rollCol = 1
      $photoCol = 3
      for ($col = 1; $col -le $used.Columns.Count; $col++) {
        $header = [string]$sheet.Cells.Item(1, $col).Text
        $h = $header.Trim().ToLower()
        if ($h -match 'roll') { $rollCol = $col }
        if ($h -match 'photo') { $photoCol = $col }
      }
    }
    elseif (Test-LooksLikePhotoPath $firstCol3 -and -not (Test-LooksLikePhotoPath $firstCol2)) {
      # Headerless file with path in column C (older template).
      $photoCol = 3
    }

    $result = @()
    for ($row = $startRow; $row -le $rowCount; $row++) {
      $roll = [string]$sheet.Cells.Item($row, $rollCol).Text
      $photo = [string]$sheet.Cells.Item($row, $photoCol).Text
      if ($roll.Trim() -and $photo.Trim()) {
        $result += [pscustomobject]@{
          Roll      = $roll.Trim()
          PhotoPath = $photo.Trim()
        }
      }
    }
    return $result
  }
  finally {
    if ($workbook) { $workbook.Close($false) | Out-Null }
    if ($excel) { $excel.Quit() | Out-Null; [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null }
  }
}

if (-not (Test-Path $MappingFile)) {
  throw "Mapping file not found: $MappingFile"
}

$ext = [System.IO.Path]::GetExtension($MappingFile).ToLower()
$mapping = if ($ext -eq '.csv') {
  Read-MappingFromCsv $MappingFile $NoHeader.IsPresent
}
else {
  Read-MappingFromExcel $MappingFile $NoHeader.IsPresent
}

if ($mapping.Count -eq 0) {
  throw 'No rows found. Check that Roll and Photo Path columns are filled.'
}

if ($OutputFolder -and -not (Test-Path $OutputFolder)) {
  New-Item -ItemType Directory -Path $OutputFolder -Force | Out-Null
}

$planned = @()
$skipped = @()

foreach ($entry in $mapping) {
  $roll = Normalize-Roll $entry.Roll
  $source = $entry.PhotoPath.Trim()

  if (-not $roll) {
    $skipped += "Empty roll number for: $source"
    continue
  }
  if (-not (Test-Path -LiteralPath $source)) {
    $skipped += "Missing file: $source  (roll $roll)"
    continue
  }

  $extension = [System.IO.Path]::GetExtension($source)
  if (-not $extension) { $extension = '.jpg' }

  $targetDir = if ($OutputFolder) { $OutputFolder } else { [System.IO.Path]::GetDirectoryName($source) }
  $target = Join-Path $targetDir ($roll + $extension)

  $sourcePath = (Resolve-Path -LiteralPath $source).Path
  $targetResolved = Resolve-Path -LiteralPath $target -ErrorAction SilentlyContinue
  if ($targetResolved -and $sourcePath -eq $targetResolved.Path) {
    $skipped += "Already named correctly: $roll"
    continue
  }
  if ((Test-Path -LiteralPath $target) -and ((Get-Item -LiteralPath $source).FullName -ne (Get-Item -LiteralPath $target).FullName)) {
    $skipped += "Target already exists: $target  (from $source)"
    continue
  }

  $planned += [pscustomobject]@{
    Roll   = $roll
    Source = $source
    Target = $target
  }
}

Write-Host ""
Write-Host "=== Photo rename preview ===" -ForegroundColor Cyan
Write-Host "Mapping rows : $($mapping.Count)"
Write-Host "Will rename  : $($planned.Count)"
Write-Host "Skipped      : $($skipped.Count)"
Write-Host ""

foreach ($item in $planned | Select-Object -First 20) {
  Write-Host ("  {0}`n    -> {1}" -f $item.Source, $item.Target)
}
if ($planned.Count -gt 20) {
  Write-Host "  ... and $($planned.Count - 20) more"
}

if ($skipped.Count -gt 0) {
  Write-Host ""
  Write-Host "Skipped:" -ForegroundColor Yellow
  foreach ($line in $skipped | Select-Object -First 10) {
    Write-Host "  - $line"
  }
  if ($skipped.Count -gt 10) {
    Write-Host "  ... and $($skipped.Count - 10) more"
  }
}

if (-not $Execute) {
  Write-Host ""
  Write-Host "Preview only. Re-run with -Execute to apply renames." -ForegroundColor Green
  exit 0
}

$renamed = 0
foreach ($item in $planned) {
  if ($OutputFolder) {
    Copy-Item -LiteralPath $item.Source -Destination $item.Target -Force
  }
  else {
    Rename-Item -LiteralPath $item.Source -NewName ([System.IO.Path]::GetFileName($item.Target))
  }
  $renamed++
}

Write-Host ""
Write-Host "Done. Renamed $renamed file(s)." -ForegroundColor Green
