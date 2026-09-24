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
#   3. Sync the Siakang Python environment from uv.lock.
#   4. Run database migrations.
#   5. Rebuild Laravel's caches.
#   6. Restart the Octane server, queue worker and scheduler (skipped on the
#      first run, before install-services.sh has created them).
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

# A fresh .env has an empty APP_KEY. Everything below (caches, migrations,
# the queue) needs one, so refuse early with an actionable message instead
# of failing halfway through the deploy. Accepts both `base64:...` and
# `"base64:..."`.
if ! grep -qE '^APP_KEY=["'"'"']?base64:.+' .env; then
    echo "ERROR: APP_KEY is empty in .env." >&2
    echo "       Run: php artisan key:generate" >&2
    echo "       (or copy APP_KEY from your local .env so existing Siakang" >&2
    echo "        credentials stay decryptable)." >&2
    exit 1
fi

if [ ! -f "${CLIENT_DIR}/package.json" ]; then
    echo "ERROR: client/ not found at ${CLIENT_DIR}." >&2
    echo "       Expected layout: <root>/server and <root>/client." >&2
    exit 1
fi

echo "==> Building the SPA"
cd "$CLIENT_DIR"
# The repo pins pnpm via package.json "packageManager" and pnpm-lock.yaml, so
# prefer a real pnpm and fall back to Corepack, which downloads that exact
# version. Never fall back to npm: it would ignore the lockfile and can
# silently produce a different bundle.
run_pnpm() {
    if command -v pnpm >/dev/null 2>&1; then
        pnpm "$@"
    else
        corepack enable >/dev/null 2>&1 || true
        corepack pnpm "$@"
    fi
}

run_pnpm install --frozen-lockfile
if [ ! -d node_modules ]; then
    echo "ERROR: pnpm install did not create client/node_modules." >&2
    echo "       Check the Node version (>= 22.13 required by pnpm 11)." >&2
    exit 1
fi
run_pnpm build

if [ ! -f "${CLIENT_DIR}/dist/index.html" ]; then
    echo "ERROR: the SPA build produced no dist/index.html." >&2
    exit 1
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

# FrankenPHP may be at /usr/local/bin (setup-oracle.sh) or downloaded into the
# project root by Octane. Warn now instead of failing at the restart step.
if ! command -v frankenphp >/dev/null 2>&1 && [ ! -x "${SERVER_DIR}/frankenphp" ]; then
    echo "    WARNING: frankenphp binary not found on PATH or in ${SERVER_DIR}." >&2
    echo "             The Octane service will not start. Run: sudo bash deploy/setup-oracle.sh" >&2
fi

if [ ! -d vendor ]; then
    echo "ERROR: composer install did not create vendor/." >&2
    exit 1
fi

echo "==> Ensuring the Siakang Python environment"
# `uv` installs into ~/.local/bin, which is not always on a non-interactive
# shell's PATH. Resolve it the same way the app does (SIAKANG_UV in .env,
# then the usual locations) rather than assuming `uv` is callable.
if [ -f siakang-sync/pyproject.toml ]; then
    # SIAKANG_UV from .env wins, then the usual install locations. Strip
    # surrounding quotes, which are legal in .env but not in a shell path.
    UV_BIN="${SIAKANG_UV:-}"
    if [ -z "$UV_BIN" ]; then
        UV_BIN="$(grep -E '^SIAKANG_UV=' .env 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
    fi
    UV_BIN="${UV_BIN%\"}"
    UV_BIN="${UV_BIN#\"}"

    for candidate in "$UV_BIN" "${HOME}/.local/bin/uv" /root/.local/bin/uv /usr/local/bin/uv; do
        if [ -n "$candidate" ] && [ -x "$candidate" ]; then
            UV_BIN="$candidate"
            break
        fi
        UV_BIN=""
    done

    if [ -z "$UV_BIN" ]; then
        echo "    WARNING: uv not found; skipping the Siakang bridge setup." >&2
        echo "             Siakang sync will not work until 'cd siakang-sync && uv sync --locked' succeeds." >&2
    else
        echo "    using ${UV_BIN}"
        (cd siakang-sync && "$UV_BIN" sync --locked)
    fi
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
# On the very first deploy the units do not exist yet
# (install-services.sh has not run). Restarting what is missing would abort
# this script under `set -e`, so only touch units that are installed.
services_restarted=()
for unit in task-reminder-octane task-reminder-queue task-reminder-scheduler; do
    if systemctl cat "${unit}.service" >/dev/null 2>&1; then
        sudo systemctl restart "${unit}.service"
        services_restarted+=("${unit}.service")
    fi
done

if [ ${#services_restarted[@]} -eq 0 ]; then
    echo "    No systemd units installed yet (first deploy)."
    echo "    Next step: sudo bash deploy/install-services.sh"
else
    echo "    Restarted: ${services_restarted[*]}"
    # No sudo here: `systemctl status` works unprivileged, and the sudoers
    # drop-in only whitelists `restart`. Its exit code is 3 for an inactive
    # unit, so never let it decide whether the deploy succeeded.
    systemctl --no-pager --lines=0 status "${services_restarted[@]}" || true
fi

echo "==> Deploy selesai."
