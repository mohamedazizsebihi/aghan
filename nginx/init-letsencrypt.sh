#!/usr/bin/env bash
set -euo pipefail

# One-time bootstrap for the Let's Encrypt certificate. Run this from the
# project root once your domain's DNS points at this server and ports 80/443
# are reachable from the internet. Nginx can't start with a "ssl_certificate"
# directive pointing at a file that doesn't exist yet, so this script:
#   1. drops in a throwaway self-signed cert so nginx can start at all,
#   2. starts nginx (which can now also serve the ACME HTTP-01 challenge),
#   3. swaps the throwaway cert for a real one issued by Let's Encrypt,
#   4. reloads nginx.
# Renewal afterwards is handled automatically by the `certbot` service in
# docker-compose.yml.
#
# Usage: DOMAIN=example.com EMAIL=you@example.com ./nginx/init-letsencrypt.sh

domain="${DOMAIN:?Set DOMAIN=yourdomain.com}"
email="${EMAIL:-}"
staging="${STAGING:-0}"
rsa_key_size=4096
data_path="./nginx/certbot"

if [ -d "$data_path/conf/live/$domain" ]; then
  read -r -p "Existing certificate data found for $domain. Replace it? (y/N) " decision
  if [ "$decision" != "y" ] && [ "$decision" != "Y" ]; then
    exit 0
  fi
fi

echo "### Downloading recommended TLS parameters..."
mkdir -p "$data_path/conf"
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
  > "$data_path/conf/options-ssl-nginx.conf"
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem \
  > "$data_path/conf/ssl-dhparams.pem"

echo "### Creating a temporary self-signed certificate for $domain..."
mkdir -p "$data_path/conf/live/$domain"
docker compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1 \
    -keyout '/etc/letsencrypt/live/$domain/privkey.pem' \
    -out '/etc/letsencrypt/live/$domain/fullchain.pem' \
    -subj '/CN=localhost'" certbot

echo "### Starting nginx..."
docker compose up -d nginx

echo "### Deleting temporary certificate for $domain..."
docker compose run --rm --entrypoint "\
  rm -rf /etc/letsencrypt/live/$domain \
         /etc/letsencrypt/archive/$domain \
         /etc/letsencrypt/renewal/$domain.conf" certbot

echo "### Requesting the real Let's Encrypt certificate for $domain..."
email_arg="--register-unsafely-without-email"
if [ -n "$email" ]; then email_arg="--email $email"; fi
staging_arg=""
if [ "$staging" != "0" ]; then staging_arg="--staging"; fi

docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg $email_arg \
    -d $domain \
    --rsa-key-size $rsa_key_size \
    --agree-tos \
    --non-interactive \
    --force-renewal" certbot

echo "### Reloading nginx..."
docker compose exec nginx nginx -s reload

echo "Done. The 'certbot' service in docker-compose.yml will keep this certificate renewed."
