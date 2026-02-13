#!/bin/bash
set -e

echo "Preparing Home Assistant App bundle..."

ADDON_DIR="ha-addon"
# Clean and recreate directory to ensure no stale files
rm -rf "$ADDON_DIR"
mkdir -p "$ADDON_DIR"

echo "Generating configuration files..."

# 1. config.yaml
VERSION="1.0.$(date +%Y%m%d%H%M)"
echo "Setting version to: $VERSION"

cat > "$ADDON_DIR/config.yaml" <<EOF
name: "DeltaWatch"
version: "$VERSION"
slug: "deltawatch"
description: "Advanced web monitoring solution with AI detection and visual diffing."
url: "https://github.com/rvbcrs/DeltaWatch"
arch:
  - aarch64
  - amd64
startup: application
boot: auto
ports:
  3000/tcp: 3000
map:
  - config:rw
  - share:rw
options:
  log_level: info
  google_client_id: ""
  access_token_secret: ""
  app_url: ""
  data_dir: "/app/apps/web/server/data"
schema:
  log_level: list(debug, info, warning, error)
  google_client_id: str?
  access_token_secret: str?
  app_url: str?
  data_dir: str
init: false
EOF

# 2. run.sh
cat > "$ADDON_DIR/run.sh" <<EOF
#!/usr/bin/with-contenv bashio

echo "Starting DeltaWatch..."

export LOG_LEVEL=\$(bashio::config 'log_level')
export GOOGLE_CLIENT_ID=\$(bashio::config 'google_client_id')
export ACCESS_TOKEN_SECRET=\$(bashio::config 'access_token_secret')
export APP_URL=\$(bashio::config 'app_url')
export DATA_DIR=\$(bashio::config 'data_dir')
export NODE_ENV=production
export PORT=3000

# Ensure data directory exists
mkdir -p "\$DATA_DIR"

echo "=== DEBUG INFO ==="
echo "Data directory: \$DATA_DIR"
echo "Log level: \$LOG_LEVEL"
if [ -z "\$GOOGLE_CLIENT_ID" ]; then echo "GOOGLE_CLIENT_ID is unset"; else echo "GOOGLE_CLIENT_ID is set (length: \${#GOOGLE_CLIENT_ID})"; fi
if [ -z "\$ACCESS_TOKEN_SECRET" ]; then echo "ACCESS_TOKEN_SECRET is unset"; else echo "ACCESS_TOKEN_SECRET is set (length: \${#ACCESS_TOKEN_SECRET})"; fi
if [ -z "\$APP_URL" ]; then echo "APP_URL is unset"; else echo "APP_URL is set to \$APP_URL"; fi
echo "=================="

cd /app
exec node apps/web/server/dist/index.js
EOF

# 3. Dockerfile
cat > "$ADDON_DIR/Dockerfile" <<EOF
ARG BUILD_FROM
FROM \$BUILD_FROM

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ curl git \
    && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME="/pnpm"
ENV PATH="\$PNPM_HOME:\$PATH"
RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install

RUN pnpm --filter @deltawatch/shared build
RUN pnpm --filter @deltawatch/web-client build
RUN pnpm --filter @deltawatch/web-server build

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN cd apps/web/server && pnpm exec playwright install chromium

COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
EOF

echo "Copying source files..."

rsync -av \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.gemini' \
  --exclude='ha-addon' \
  --exclude='dist' \
  --exclude='.next' \
  --exclude='.turbo' \
  --exclude='*.tar' \
  --exclude='deltawatch-log.html' \
  --exclude='chrome_user_data' \
  --exclude='apps/web/server/data' \
  --exclude='apps/web/server/public/screenshots/*' \
  --exclude='.vscode' \
  --exclude='.idea' \
  --exclude='.DS_Store' \
  --exclude='docs' \
  --exclude='test-results' \
  --exclude='coverage' \
  --exclude='*.log' \
  --exclude='extension' \
  --exclude='apps/mobile' \
  ./ package.json pnpm-lock.yaml pnpm-workspace.yaml apps packages "$ADDON_DIR/"

chmod +x "$ADDON_DIR/run.sh"

# Copy logo/icon
echo "Copying branding..."
if [ -f "apps/web/client/public/favicon.png" ]; then
    cp "apps/web/client/public/favicon.png" "$ADDON_DIR/icon.png"
    echo "Copied favicon.png to icon.png"
elif [ -f "apps/web/client/public/logo_new.png" ]; then
    cp "apps/web/client/public/logo_new.png" "$ADDON_DIR/icon.png"
    echo "Copied logo_new.png to icon.png (fallback)"
fi

if [ -f "apps/web/client/public/logo_new.png" ]; then
    cp "apps/web/client/public/logo_new.png" "$ADDON_DIR/logo.png"
    echo "Copied logo_new.png to logo.png"
fi

echo "Bundle created in $ADDON_DIR/"
echo "Instructions:"
echo "1. Copy the '$ADDON_DIR' folder to your Home Assistant '/addons/local/deltawatch' directory."
echo "2. Refresh the App Store in Home Assistant."
echo "3. Install the DeltaWatch App."
