<#
.SYNOPSIS
  Upload the Task Reminder project to the Oracle VM over SSH.

.DESCRIPTION
  The GitHub repo is private, so `git clone` on the VM would need a token.
  This sends the project from this computer instead, skipping node_modules,
  vendor, .git, storage logs and .env.

.EXAMPLE
  .\server\deploy\upload-to-server.ps1 -Target ubuntu@203.0.113.10

.EXAMPLE
  .\server\deploy\upload-to-server.ps1 -Target ubuntu@203.0.113.10 -RemoteDir task-reminder

.EXAMPLE
  # non-default SSH port
  .\server\deploy\upload-to-server.ps1 -Target ubuntu@203.0.113.10 -Port 2222
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Target,

    [string]$RemoteDir = 'task-reminder',

    [int]$Port = 22
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

if (-not (Test-Path 'server/artisan')) {
    throw "Run this from the repository root (server/artisan not found). Looked in: $root"
}

Write-Host "==> Checking the VM is reachable" -ForegroundColor Cyan
$probe = ssh -p $Port -o BatchMode=yes -o ConnectTimeout=10 $Target 'echo ok' 2>&1
if ($LASTEXITCODE -ne 0) {
    throw @"
Cannot SSH into $Target without a password prompt.
Make sure your public key is in the VM's ~/.ssh/authorized_keys - in Oracle,
paste it as an SSH key when creating the instance.
Underlying error: $probe
"@
}

Write-Host "==> Creating ~/$RemoteDir on the VM" -ForegroundColor Cyan
ssh -p $Port $Target "mkdir -p ~/$RemoteDir"
if ($LASTEXITCODE -ne 0) { throw 'Failed to create the remote directory.' }

Write-Host "==> Sending the project (this can take a minute)" -ForegroundColor Cyan

# Build the archive here, then stream it over the existing ssh connection:
# tar is available on Windows 10+ and produces the same bytes either way.
$tempTar = Join-Path $env:TEMP ("task-reminder-" + [guid]::NewGuid().ToString('N') + ".tar.gz")

try {
    & tar `
        --exclude=.git `
        --exclude=node_modules `
        --exclude=vendor `
        --exclude=.env `
        --exclude=.env.backup `
        --exclude='storage/logs/*' `
        --exclude='storage/framework/cache/data/*' `
        --exclude='storage/framework/sessions/*' `
        --exclude='storage/framework/views/*' `
        --exclude=graphify-out `
        --exclude=.venv `
        --exclude='siakang-sync/.venv' `
        --exclude='siakang-sync/.siakang_session_*.json' `
        --exclude='*.tar' `
        --exclude='*.zip' `
        -czf $tempTar .
    if ($LASTEXITCODE -ne 0) { throw 'tar failed while packing the project.' }

    $sizeMb = [math]::Round((Get-Item $tempTar).Length / 1MB, 1)
    Write-Host "    archive: $sizeMb MB"

    # scp the archive, then extract it on the VM. Piping the bytes straight
    # into ssh is not reliable from Windows PowerShell 5.1.
    $remoteArchive = "~/task-reminder-upload.tar.gz"
    scp -P $Port $tempTar "${Target}:$remoteArchive"
    if ($LASTEXITCODE -ne 0) { throw 'scp failed while uploading the archive.' }

    ssh -p $Port $Target "mkdir -p ~/$RemoteDir && tar -xzf $remoteArchive -C ~/$RemoteDir && rm -f $remoteArchive"
    if ($LASTEXITCODE -ne 0) { throw 'Extracting the archive on the VM failed.' }
}
finally {
    Remove-Item $tempTar -Force -ErrorAction SilentlyContinue
}

Write-Host "==> Verifying what landed" -ForegroundColor Cyan
# Single-quoted so PowerShell does not try to expand the remote shell command.
$verify = 'cd ~/' + $RemoteDir + ' && echo "    files: $(find . -type f | wc -l)"' +
    ' && test -f server/artisan && echo "    server/artisan: ok"' +
    ' && test -f server/deploy/setup-oracle.sh && echo "    setup-oracle.sh: ok"' +
    ' && test -f client/dist/index.html && echo "    client/dist: ok"'
ssh -p $Port $Target $verify

Write-Host @"

============================================================
Upload selesai ke ${Target}:~/$RemoteDir

Langkah berikutnya - masuk ke VM dan jalankan:

  ssh -p $Port $Target
  cd ~/$RemoteDir
  sudo bash server/deploy/setup-oracle.sh

Setelah itu lanjut ke bagian "2. Konfigurasi environment" di
server/deploy/README.md.
============================================================
"@ -ForegroundColor Green
