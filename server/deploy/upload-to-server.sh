#!/usr/bin/env bash
#
# Upload the project to the Oracle VM over SSH.
#
# Run this from your own computer, from the repository root:
#
#   bash server/deploy/upload-to-server.sh ubuntu@<vm-ip>
#   bash server/deploy/upload-to-server.sh ubuntu@<vm-ip> ~/task-reminder
#
# It sends only what the server needs and skips node_modules, vendor, .git,
# storage logs and .env (the repo is private, so this avoids needing a
# GitHub token on the VM). The server then runs:
#
#   cd ~/task-reminder && sudo bash server/deploy/setup-oracle.sh
#
# Requires: ssh + tar on the machine you run it from (both ship with Windows
# 10+, macOS and Linux). On Windows, run it from Git Bash, or use
# upload-to-server.ps1 in this same folder.
#
set -euo pipefail

TARGET="${1:-}"
REMOTE_DIR="${2:-~/task-reminder}"
SSH_PORT="${SSH_PORT:-22}"

if [ -z "$TARGET" ]; then
    echo "Usage: bash server/deploy/upload-to-server.sh <user@host> [remote-dir]" >&2
    echo "   eg: bash server/deploy/upload-to-server.sh ubuntu@203.0.113.10" >&2
    exit 1
fi

# repository root = two levels up from this script
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [ ! -f server/artisan ]; then
    echo "ERROR: run this from the repository root (server/artisan not found)." >&2
    exit 1
fi

echo "==> Checking the VM is reachable"
if ! ssh -p "$SSH_PORT" -o BatchMode=yes -o ConnectTimeout=10 "$TARGET" 'echo ok' >/dev/null 2>&1; then
    echo "ERROR: cannot SSH into ${TARGET} without a password prompt." >&2
    echo "       Make sure your key is in the VM's ~/.ssh/authorized_keys" >&2
    echo "       (add it as an SSH key when creating the instance in Oracle)." >&2
    exit 1
fi

echo "==> Creating ${REMOTE_DIR} on the VM"
ssh -p "$SSH_PORT" "$TARGET" "mkdir -p ${REMOTE_DIR}"

echo "==> Sending the project (this can take a minute)"
# --exclude rules keep dependencies, build output of the server copy and
# secrets off the wire. client/dist IS sent: it is committed, and it lets the
# server serve the SPA even if the Node build there fails.
tar \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='vendor' \
    --exclude='.env' \
    --exclude='.env.backup' \
    --exclude='storage/logs/*' \
    --exclude='storage/framework/cache/data/*' \
    --exclude='storage/framework/sessions/*' \
    --exclude='storage/framework/views/*' \
    --exclude='graphify-out' \
    --exclude='.venv' \
    --exclude='siakang-sync/.venv' \
    --exclude='siakang-sync/.siakang_session_*.json' \
    --exclude='*.tar' \
    --exclude='*.zip' \
    -czf - . | ssh -p $SSH_PORT "$TARGET" "tar -xzf - -C ${REMOTE_DIR}"

echo "==> Verifying what landed"
ssh -p "$SSH_PORT" "$TARGET" "cd ${REMOTE_DIR} && echo \"  files: \$(find . -type f | wc -l)\" && test -f server/artisan && echo '  server/artisan: ok' && test -f server/deploy/setup-oracle.sh && echo '  setup-oracle.sh: ok' && test -f client/dist/index.html && echo '  client/dist: ok'"

cat <<EOF

============================================================
Upload selesai ke ${TARGET}:${REMOTE_DIR}

Langkah berikutnya - masuk ke VM dan jalankan:

  ssh ${TARGET}
  cd ${REMOTE_DIR}
  sudo bash server/deploy/setup-oracle.sh

Setelah itu lanjut ke bagian "2. Konfigurasi environment" di
server/deploy/README.md.
============================================================
EOF
