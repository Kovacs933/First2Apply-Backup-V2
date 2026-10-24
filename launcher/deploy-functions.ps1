# Deploys the backend functions to a hosted Supabase project.
#
# The functions import the shared code from ../../libraries/core, outside the functions folder.
# Supabase can't bundle files from outside it, so for the deploy we copy that code into
# supabase/functions/_shared/core and point the import maps at the copy, then put everything back.
param([Parameter(Mandatory = $true)][string]$ProjectRef)
$ErrorActionPreference = 'Stop'
$root      = Split-Path $PSScriptRoot -Parent
$backend   = Join-Path $root 'apps\backend'
$functions = Join-Path $backend 'supabase\functions'
$coreCopy  = Join-Path $functions '_shared\core'
$env:npm_config_loglevel = 'error'

$importMaps = @(Get-Item (Join-Path $functions 'deno.json')) + @(Get-ChildItem $functions -Directory | ForEach-Object { Get-Item (Join-Path $_.FullName 'deno.json') -ErrorAction SilentlyContinue })
$originals = @{}
try {
  New-Item -ItemType Directory -Force $coreCopy | Out-Null
  Copy-Item (Join-Path $root 'libraries\core\src\*.ts') $coreCopy

  foreach ($map in $importMaps) {
    $text = [IO.File]::ReadAllText($map.FullName)
    $originals[$map.FullName] = $text
    # the root deno.json sits next to _shared, the per-function ones one folder deeper
    $target = if ($map.DirectoryName -eq $functions) { './_shared/core/index.deno.ts' } else { '../_shared/core/index.deno.ts' }
    $text = $text -replace '"@first2apply/core":\s*"[^"]*"', "`"@first2apply/core`": `"$target`""
    [IO.File]::WriteAllText($map.FullName, $text)
  }

  Set-Location $backend
  npx supabase functions deploy --project-ref $ProjectRef --use-api --yes
  if ($LASTEXITCODE -ne 0) { throw 'Deploying functions failed (see the messages above)' }
} finally {
  foreach ($path in $originals.Keys) { [IO.File]::WriteAllText($path, $originals[$path]) }
  Remove-Item $coreCopy -Recurse -Force -ErrorAction SilentlyContinue
}
