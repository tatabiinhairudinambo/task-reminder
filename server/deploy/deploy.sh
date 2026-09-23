#!/usr/bin/env bash
#
# Deploy / update the Task Reminder app on the server.
#
# Run from the server directory (as the app user, NOT root):
#   cd ~/task-reminder/server
#   bash deploy/deploy.sh
#
# It will:
#   1. Build the React SPA and copy it into Laravel's public/ folder so a
#      single domain serves both the SPA and the /api routes.
#   2. Install PHP dependencies (production mode).
#   3. Run database migrations.
#   4. Rebuild Laravel's caches.
#   5. Restart the Octane server, queue worker and scheduler.
#
set -euo pipefail

SERVER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT_DIR="${SERVER_DIR}/../client"

cd "$SERVER_DIR"

echo "==> Working in ${SERVER_DIR}"

if [ ! -f .env ]; then
    echo "ERROR: .env not found. Copy deploy/.env.production.example to .env first." >&2
    exit 1
fi

if [ ! -f "${CLIENT_DIR}/package.json" ]; then
    echo "ERROR: client/ not found at ${CLIENT_DIR}." >&2
    echo "       Expected layout: <root>/server and <root>/client." >&2
    exit 1
fi

echo "==> Building the SPA"
cd "$CLIENT_DIR"
# The repo pins pnpm via pnpm-lock.yaml, so use it when available and fall
# back to npm otherwise.
if command -v pnpm >/dev/null 2>&1; then
    pnpm install --frozen-lockfile
    pnpm build
else
    corepack enable >/dev/null 2>&1 || true
    corepack pnpm install --frozen-lockfile
    corepack pnpm build
fi

echo "==> Copying SPA build into server/public"
cd "$SERVER_DIR"
# Keep Laravel's own files (index.php, .htaccess, templates/, ...) and only
# overlay the built assets: the generated index.html is the SPA shell.
# The SPA ships its own .htaccess for Apache hosts; it must NOT overwrite
# Laravel's, which is the one that routes requests to index.php.
rm -rf public/assets public/icons
(cd "${CLIENT_DIR}/dist" && find . -mindepth 1 -maxdepth 1 ! -name '.htaccess' -exec cp -r {} "${SERVER_DIR}/public/" \;)

echo "==> Installing PHP dependencies"
composer install --no-dev --optimize-autoloader --no-interaction

echo "==> Ensuring the Siakang Python environment"
if [ -f siakang-sync/pyproject.toml ]; then
    (cd siakang-sync && uv sync)
fi

echo "==> Running migrations"
php artisan migrate --force

echo "==> Rebuilding caches"
php artisan config:clear
php artisan route:clear
php artisan view:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "==> Linking storage"
php artisan storage:link || true

echo "==> Restarting services"
sudo systemctl restart task-reminder-octane.service
sudo systemctl restart task-reminder-queue.service
sudo systemctl restart task-reminder-scheduler.service

echo "==> Status"
sudo systemctl --no-pager --lines=0 status task-reminder-octane.service \
    task-reminder-queue.service \
    task-reminder-scheduler.service || true

echo "==> Deploy selesai."
