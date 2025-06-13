#!/bin/bash

# Email Platform Deployment Script
# This script sets up the production environment

set -e

echo "🚀 Starting Email Platform deployment..."

# Configuration
APP_NAME="email-platform"
APP_USER="email-platform"
APP_DIR="/opt/email-platform"
DB_NAME="email_platform"
DB_USER="email_platform"
DB_PASSWORD="$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root"
   exit 1
fi

# Update system
print_status "Updating system packages..."
apt update && apt upgrade -y

# Install required packages
print_status "Installing required packages..."
DEBIAN_FRONTEND=noninteractive apt install -y \
    nodejs npm mysql-server nginx certbot python3-certbot-nginx \
    curl wget gnupg2 software-properties-common \
    build-essential

# Configure MySQL properly
print_status "Configuring MySQL..."
systemctl enable mysql
systemctl start mysql

# Wait for MySQL to be ready
print_status "Waiting for MySQL to be ready..."
for i in {1..30}; do
    if mysqladmin ping --silent 2>/dev/null; then
        print_status "MySQL is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "MySQL failed to start properly"
        systemctl status mysql
        exit 1
    fi
    echo "Waiting for MySQL... ($i/30)"
    sleep 2
done

# Secure MySQL installation
print_status "Securing MySQL installation..."
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_PASSWORD}';" 2>/dev/null || true
mysql -e "DELETE FROM mysql.user WHERE User='';" 2>/dev/null || true
mysql -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');" 2>/dev/null || true
mysql -e "DROP DATABASE IF EXISTS test;" 2>/dev/null || true
mysql -e "DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';" 2>/dev/null || true
mysql -e "FLUSH PRIVILEGES;" 2>/dev/null || true

# Install PM2 for process management
print_status "Installing PM2..."
npm install -g pm2

# Create application user
print_status "Creating application user..."
if ! id "$APP_USER" &>/dev/null; then
    useradd -r -s /bin/false -d $APP_DIR $APP_USER
fi

# Create application directory
print_status "Setting up application directory..."
mkdir -p $APP_DIR
mkdir -p $APP_DIR/logs
chown -R $APP_USER:$APP_USER $APP_DIR

# Setup MySQL database with proper authentication
print_status "Setting up MySQL database..."
mysql -u root -p${DB_PASSWORD} -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || \
mysql -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

mysql -u root -p${DB_PASSWORD} -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED WITH mysql_native_password BY '$DB_PASSWORD';" 2>/dev/null || \
mysql -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED WITH mysql_native_password BY '$DB_PASSWORD';"

mysql -u root -p${DB_PASSWORD} -e "CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED WITH mysql_native_password BY '$DB_PASSWORD';" 2>/dev/null || \
mysql -e "CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED WITH mysql_native_password BY '$DB_PASSWORD';"

mysql -u root -p${DB_PASSWORD} -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';" 2>/dev/null || \
mysql -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';"

mysql -u root -p${DB_PASSWORD} -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'127.0.0.1';" 2>/dev/null || \
mysql -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'127.0.0.1';"

mysql -u root -p${DB_PASSWORD} -e "FLUSH PRIVILEGES;" 2>/dev/null || \
mysql -e "FLUSH PRIVILEGES;"

# Test database connection
print_status "Testing database connection..."
mysql -u $DB_USER -p$DB_PASSWORD -e "SELECT 1;" $DB_NAME || {
    print_error "Failed to connect to database with application credentials"
    exit 1
}

# Copy application files (assumes you're running from the project directory)
print_status "Copying application files..."
cp -r . $APP_DIR/
chown -R $APP_USER:$APP_USER $APP_DIR

# Install dependencies
print_status "Installing Node.js dependencies..."
cd $APP_DIR
sudo -u $APP_USER npm install --production

# Build frontend
print_status "Building frontend..."
sudo -u $APP_USER npm run build

# Create environment file
print_status "Creating environment configuration..."
cat > $APP_DIR/.env << EOF
NODE_ENV=production
PORT=3001
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME
JWT_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)
FRONTEND_URL=https://localhost
BCRYPT_ROUNDS=12
SESSION_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
MAX_FILE_SIZE=10485760
BACKUP_RETENTION_DAYS=30
BACKUP_SCHEDULE="0 2 * * *"
LOG_LEVEL=info
EOF

chown $APP_USER:$APP_USER $APP_DIR/.env
chmod 600 $APP_DIR/.env

# Run database migrations
print_status "Running database migrations..."
cd $APP_DIR
sudo -u $APP_USER NODE_ENV=production npm run db:migrate
sudo -u $APP_USER NODE_ENV=production npm run db:seed

# Update systemd service with correct environment
print_status "Setting up systemd service..."
cat > /etc/systemd/system/email-platform.service << EOF
[Unit]
Description=Email Management Platform
After=network.target mysql.service
Requires=mysql.service

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=email-platform

# Environment file
EnvironmentFile=$APP_DIR/.env

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR/logs
ReadWritePaths=/tmp

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable email-platform

# Setup Nginx
print_status "Configuring Nginx..."
cp deployment/nginx.conf /etc/nginx/sites-available/email-platform
ln -sf /etc/nginx/sites-available/email-platform /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Start services
print_status "Starting services..."
systemctl start email-platform
systemctl restart nginx

# Setup log rotation
print_status "Setting up log rotation..."
cat > /etc/logrotate.d/email-platform << EOF
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
    su $APP_USER $APP_USER
}
EOF

# Setup firewall (optional)
print_status "Configuring firewall..."
ufw --force enable
ufw allow 22
ufw allow 80
ufw allow 443

# Create backup script
print_status "Setting up backup script..."
cat > /usr/local/bin/backup-email-platform.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
mysqldump email_platform > $BACKUP_DIR/db_backup_$DATE.sql

# Backup application files
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz -C /opt email-platform

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
EOF

chmod +x /usr/local/bin/backup-email-platform.sh

# Setup daily backup cron job
print_status "Setting up daily backups..."
echo "0 2 * * * /usr/local/bin/backup-email-platform.sh" | crontab -

# Final status check
print_status "Checking service status..."
sleep 5
systemctl status email-platform --no-pager
systemctl status nginx --no-pager

print_status "Deployment completed successfully! 🎉"
print_warning "Important configuration details:"
echo "   - Database User: $DB_USER"
echo "   - Database Password: $DB_PASSWORD"
echo "   - Application Directory: $APP_DIR"
echo "   - Environment File: $APP_DIR/.env"
echo ""
print_warning "Next steps:"
print_warning "1. Update the domain name in /etc/nginx/sites-available/email-platform"
print_warning "2. Set up SSL with: certbot --nginx -d your-domain.com"
print_warning "3. Update FRONTEND_URL in $APP_DIR/.env"
print_warning "4. Restart services: systemctl restart email-platform nginx"

echo ""
echo "📋 Application Info:"
echo "   - Application URL: http://your-server-ip"
echo "   - Application Directory: $APP_DIR"
echo "   - Log Files: $APP_DIR/logs/"
echo "   - Service: systemctl status email-platform"
echo "   - Default Login: admin@demo.com / admin123"
echo ""
print_warning "⚠️ SECURITY: Change the default admin password immediately!"