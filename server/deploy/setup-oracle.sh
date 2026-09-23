#!/usr/bin/env bash
#
# One-time setup for the Task Reminder backend on an Oracle Cloud
# "Always Free" ARM (Ampere A1) instance running Ubuntu 22.04 / 24.04.
#
# What it installs:
#   - PHP 8.3 CLI + extensions (Composer, artisan, tests, queue, scheduler)
#   - Node.js 20 (to build the React SPA)
#   - uv + Python 3.12 (for the Siakang bridge)
#   - FrankenPHP binary, which also ships its own embedded PHP runtime
#   - cloudflared (Cloudflare Tunnel client)
#
# The API itself is served by FrankenPHP/Octane, which has every extension
# this app needs (pdo_pgsql for Supabase, intl, gd, zip for Excel imports)
# already compiled in. The system PHP is used for CLI work only.
#
# Run as a user with sudo:
#   sudo bash deploy/setup-oracle.sh
#
set -euo pipefail

APP_USER="${SUDO_USER:-ubuntu}"
APP_HOME="$(getent passwd "$APP_USER" | cut -d: -f6)"
APP_DIR="${APP_HOME}/task-reminder"
PHP_VERSION="8.3"
FRANKENPHP_VERSION="v1.12.7"
NODE_MAJOR="20"

echo "==> Task Reminder setup for Oracle Cloud (user: ${APP_USER})"
echo "==> App directory will be: ${APP_DIR}"

export DEBIAN_FRONTEND=noninteractive

echo "==> Installing base packages"
apt-get update -y
apt-get install -y --no-install-recommends \
    ca-certificates curl unzip git gnupg lsb-release software-properties-common \
    build-essential

echo "==> Installing PHP ${PHP_VERSION}"
add-apt-repository -y ppa:ondrej/php
apt-get update -y

# Extensions needed by the codebase: pdo_pgsql (Supabase), intl + gd + zip +
# xml + mbstring (Excel import, dates), bcmath, curl for outbound HTTP.
apt-get install -y --no-install-recommends \
    "php${PHP_VERSION}-cli" \
    "php${PHP_VERSION}-common" \
    "php${PHP_VERSION}-curl" \
    "php${PHP_VERSION}-mbstring" \
    "php${PHP_VERSION}-xml" \
    "php${PHP_VERSION}-zip" \
    "php${PHP_VERSION}-gd" \
    "php${PHP_VERSION}-intl" \
    "php${PHP_VERSION}-bcmath" \
    "php${PHP_VERSION}-pgsql" \
    "php${PHP_VERSION}-mysql" \
    "php${PHP_VERSION}-sqlite3"

echo "==> Installing Composer"
if ! command -v composer >/dev/null 2>&1; then
    curl -sS https://getcomposer.org/installer -o /tmp/composer-setup.php
    php /tmp/composer-setup.php --install-dir=/usr/local/bin --filename=composer
    rm -f /tmp/composer-setup.php
fi

echo "==> Installing Node.js ${NODE_MAJOR}"
if ! command -v node >/dev/null 2>&1; then
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt-get install -y nodejs
fi
corepack enable || true

echo "==> Installing uv (for the Siakang Python bridge)"
if [ ! -x "${APP_HOME}/.local/bin/uv" ]; then
    su - "$APP_USER" -c 'curl -LsSf https://astral.sh/uv/install.sh | sh'
fi

echo "==> Installing FrankenPHP ${FRANKENPHP_VERSION}"
if ! command -v frankenphp >/dev/null 2>&1; then
    ARCH="$(uname -m)"
    case "$ARCH" in
        aarch64|arm64) FP_ASSET="frankenphp-linux-aarch64" ;;
        x86_64)        FP_ASSET="frankenphp-linux-x86_64" ;;
        *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
    esac
    curl -sSL -o /usr/local/bin/frankenphp \
        "https://github.com/php/frankenphp/releases/download/${FRANKENPHP_VERSION}/${FP_ASSET}"
    chmod +x /usr/local/bin/frankenphp
fi
frankenphp version || true

echo "==> Installing cloudflared"
if ! command -v cloudflared >/dev/null 2>&1; then
    ARCH="$(uname -m)"
    case "$ARCH" in
        aarch64|arm64) CF_ASSET="cloudflared-linux-arm64" ;;
        x86_64)        CF_ASSET="cloudflared-linux-amd64" ;;
        *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
    esac
    curl -sSL -o /usr/local/bin/cloudflared \
        "https://github.com/cloudflare/cloudflared/releases/latest/download/${CF_ASSET}"
    chmod +x /usr/local/bin/cloudflared
fi
cloudflared --version || true

echo "==> Creating app directory ${APP_DIR}"
mkdir -p "$APP_DIR"
chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"

cat <<EOF

============================================================
Setup selesai.

Langkah berikutnya (jalankan sebagai user ${APP_USER}):

  1. Clone / upload project ke:
       ${APP_DIR}

     Struktur yang diharapkan:
       ${APP_DIR}/server        (Laravel)
       ${APP_DIR}/client        (React SPA)

  2. Masuk ke folder server dan siapkan environment:
       cd ${APP_DIR}/server
       cp deploy/.env.production.example .env
       php artisan key:generate

  3. Install dependensi PHP + Python:
       composer install --no-dev --optimize-autoloader
       cd siakang-sync && uv sync && cd ..

  4. Deploy aplikasi (build SPA, migrate, cache, restart service):
       bash deploy/deploy.sh

  5. Install systemd service (sekali saja):
       sudo bash deploy/install-services.sh

  6. Setup Cloudflare Tunnel:
       cloudflared tunnel login
       cloudflared tunnel create task-reminder
       (lihat deploy/cloudflared.yml.example)
============================================================
EOF
