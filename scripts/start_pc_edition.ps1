[CmdletBinding()]
param(
    [int]$Port = 8910, [string]$DataRoot, [string]$MediaRoot,
    [ValidateSet('127.0.0.1', '0.0.0.0')]
    [string]$ListenAddress = '127.0.0.1'
)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$commonDirectory = (& git -C $projectRoot rev-parse --path-format=absolute --git-common-dir).Trim()
$mainRoot = Split-Path -Parent $commonDirectory
$workspaceRoot = Split-Path -Parent $mainRoot
if (-not $DataRoot) { $DataRoot = Join-Path $workspaceRoot 'peach-pc-data' }
if (-not $MediaRoot) { $MediaRoot = Join-Path $workspaceRoot 'peach-pc-media' }
foreach ($pcPath in @($DataRoot, $MediaRoot)) {
    $pcDrive = Get-PSDrive -Name ([IO.Path]::GetPathRoot($pcPath).TrimEnd('\', ':')) -ErrorAction SilentlyContinue
    if ($pcPath.StartsWith('\\') -or ($pcDrive -and $pcDrive.DisplayRoot)) {
        throw 'Use local PC folders for this test instance.'
    }
}
$pythonPath = Join-Path $projectRoot '.venv/Scripts/python.exe'
if (-not (Test-Path $pythonPath)) { $pythonPath = Join-Path $mainRoot '.venv/Scripts/python.exe' }
if (-not (Test-Path $pythonPath)) { throw 'Install the locked Python environment first.' }
if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) {
    throw "Port $Port is already in use."
}
$env:PEACH_DATA_ROOT = $DataRoot
$env:PYTHONPATH = Join-Path $projectRoot 'src'
$env:PYTHONUTF8 = '1'
if (-not (Get-Command openssl.exe -ErrorAction SilentlyContinue)) {
    $gitOpenSsl = 'C:\Program Files\Git\usr\bin'
    if (Test-Path -LiteralPath (Join-Path $gitOpenSsl 'openssl.exe')) {
        $env:PATH = "$gitOpenSsl;$env:PATH"
    }
}
Set-Location -LiteralPath $projectRoot
& $pythonPath -X utf8 (Join-Path $PSScriptRoot 'prepare_pc_edition.py') --data-root $DataRoot --media-root $MediaRoot --port $Port
if ($LASTEXITCODE -ne 0) { throw 'PC initialization failed.' }
& $pythonPath -X utf8 -m peach.server --host $ListenAddress --port $Port
exit $LASTEXITCODE
