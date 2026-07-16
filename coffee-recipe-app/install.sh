#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/dialed-in-coffee"
SERVICE_FILE="/etc/systemd/system/dialed-in-coffee.service"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_USER="${SUDO_USER:-root}"
RUN_GROUP="$(id -gn "$RUN_USER")"

if [[ $EUID -ne 0 ]]; then
  echo "Please run this script with sudo: sudo ./install.sh"
  exit 1
fi

apt update
apt install -y python3 python3-venv

mkdir -p "$APP_DIR"
cp -r "$SOURCE_DIR"/. "$APP_DIR"/
rm -rf "$APP_DIR/.venv"
python3 -m venv "$APP_DIR/.venv"
"$APP_DIR/.venv/bin/pip" install --upgrade pip
"$APP_DIR/.venv/bin/pip" install -r "$APP_DIR/requirements.txt"
mkdir -p "$APP_DIR/data"

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Dialed In Coffee Recipe App
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
Environment=DB_PATH=$APP_DIR/data/coffee.db
ExecStart=$APP_DIR/.venv/bin/gunicorn --bind 0.0.0.0:8080 --workers 1 --threads 4 server:app
Restart=always
RestartSec=3
User=$RUN_USER
Group=$RUN_GROUP

[Install]
WantedBy=multi-user.target
EOF

chown -R "$RUN_USER:$RUN_GROUP" "$APP_DIR"
systemctl daemon-reload
systemctl enable --now dialed-in-coffee

echo
echo "Dialed In is now running on port 8080."
echo "Open: http://$(hostname -I | awk '{print $1}'):8080"
