#!/bin/bash

# Install nginx
apt update
apt install -y nginx

# Create self-signed SSL certificate
mkdir -p /etc/ssl/private
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/selfsigned.key \
    -out /etc/ssl/certs/selfsigned.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=159.223.52.145"

# Copy nginx configuration
cp nginx.conf /etc/nginx/sites-available/crypto-bot
ln -sf /etc/nginx/sites-available/crypto-bot /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Start nginx
systemctl enable nginx
systemctl restart nginx

# Allow HTTPS through firewall
ufw allow 443
ufw allow 80

echo "✅ HTTPS setup complete!"
echo "Your API will be available at: https://159.223.52.145/api/"