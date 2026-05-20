#!/usr/bin/env bash
set -euo pipefail

DOMAIN="sallerfix.ru"
WWW_DOMAIN="www.sallerfix.ru"
WEB_ROOT="/var/www/sallerfix"
ARCHIVE="/tmp/sallerfix.ru-static.zip"
NGINX_SITE="/etc/nginx/sites-available/sallerfix"

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash install-server.sh"
  exit 1
fi

apt-get update
apt-get install -y nginx unzip certbot python3-certbot-nginx

mkdir -p "$WEB_ROOT"
rm -rf "$WEB_ROOT"/*
unzip -o "$ARCHIVE" -d "$WEB_ROOT"
chown -R www-data:www-data "$WEB_ROOT"
find "$WEB_ROOT" -type d -exec chmod 755 {} \;
find "$WEB_ROOT" -type f -exec chmod 644 {} \;

cat > "$NGINX_SITE" <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name sallerfix.ru www.sallerfix.ru;

    root /var/www/sallerfix;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(?:css|js|png|jpg|jpeg|gif|svg|ico|webp)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
        try_files $uri =404;
    }
}
NGINX

ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/sallerfix
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "HTTP deploy done: http://$DOMAIN"
echo "After DNS points to this server, run:"
echo "certbot --nginx -d $DOMAIN -d $WWW_DOMAIN"
