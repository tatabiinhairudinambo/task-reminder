#!/usr/bin/env bash
#
# Installs the three systemd services and enables them on boot.
#
# Run once (as root):
#   sudo bash deploy/install-services.sh
#
# Optionally point it at a different app user or directory:
#   sudo APP_USER=ubuntu APP_DIR=/home/ubuntu/task-reminder bash deploy/install-services.sh
#
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: run this script with sudo." >&2
    exit 1
fi

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${DEPLOY_DIR}/.." && pwd)"

APP_USER="${APP_USER:-${SUDO_USER:-ubuntu}}"
APP_DIR="${APP_DIR:-$(getent passwd "$APP_USER" | cut -d: -f6)/task-reminder}"
APP_SERVER_DIR="${APP_SERVER_DIR:-${APP_DIR}/server}"

if [ ! -d "$APP_SERVER_DIR" ]; then
    echo "ERROR: server directory not found: ${APP_SERVER_DIR}" >&2
    echo "       Set APP_SERVER_DIR=/path/to/server and retry." >&2
    exit 1
fi

echo "==> Installing systemd services"
echo "    user:        ${APP_USER}"
echo "    server dir:  ${APP_SERVER_DIR}"

for unit in task-reminder-octane task-reminder-queue task-reminder-scheduler; do
    sed \
        -e "s|__APP_USER__|${APP_USER}|g" \
        -e "s|__APP_SERVER_DIR__|${APP_SERVER_DIR}|g" \
        "${DEPLOY_DIR}/systemd/${unit}.service" \
        > "/etc/systemd/system/${unit}.service"
    echo "    wrote /etc/systemd/system/${unit}.service"
done

systemctl daemon-reload
systemctl enable --now \
    task-reminder-octane.service \
    task-reminder-queue.service \
    task-reminder-scheduler.service

echo "==> Status"
systemctl --no-pager --lines=0 status \
    task-reminder-octane.service \
    task-reminder-queue.service \
    task-reminder-scheduler.service || true

cat <<'EOF'

============================================================
Selesai. Perintah yang berguna:

  Lihat log API:        sudo journalctl -u task-reminder-octane -f
  Lihat log notifikasi: sudo journalctl -u task-reminder-queue -f
  Lihat log scheduler:  sudo journalctl -u task-reminder-scheduler -f

  Tes kirim reminder sekarang:
    cd ~/task-reminder/server && php artisan notifications:reminder

  Restart semua:
    sudo systemctl restart task-reminder-octane task-reminder-queue task-reminder-scheduler
============================================================
EOF
