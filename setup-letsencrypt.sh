#!/bin/bash

echo "🔧 Setting up Let's Encrypt SSL certificate..."

# Install certbot
apt update
apt install -y certbot python3-certbot-nginx

# Stop nginx temporarily
systemctl stop nginx

# Get certificate (replace with your domain or use IP)
# For IP address, we'll use a different approach
echo "⚠️  For production, you should use a domain name instead of IP address"
echo "📝 Let's Encrypt doesn't issue certificates for IP addresses"

# Alternative: Use a free domain service like nip.io
DOMAIN="159-223-52-145.nip.io"
echo "🌐 Using domain: $DOMAIN"

# Update nginx config for the domain
sed -i "s/159.223.52.145/$DOMAIN/g" /etc/nginx/sites-available/crypto-bot

# Get certificate for the domain
certbot certonly --standalone -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

# Update nginx config to use Let's Encrypt certificates
cat > /etc/nginx/sites-available/crypto-bot << EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl;
    server_name $DOMAIN;

    # Let's Encrypt SSL configuration
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Proxy to your Docker container
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # CORS headers
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
        add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization";
        
        if (\$request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
            add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization";
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 200;
        }
    }
}
EOF

# Test nginx configuration
nginx -t

# Start nginx
systemctl start nginx
systemctl enable nginx

# Set up auto-renewal
crontab -l | { cat; echo "0 12 * * * /usr/bin/certbot renew --quiet"; } | crontab -

echo "✅ Let's Encrypt SSL setup complete!"
echo "🌐 Your API is now available at: https://$DOMAIN/api/"
echo "📝 Update your frontend to use: https://$DOMAIN/api"