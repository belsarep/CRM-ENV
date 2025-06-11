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
apt install -y nodejs npm mysql-server nginx certbot python3-certbot-nginx

# Configure MySQL to start automatically and bind to localhost
print_status "Configuring MySQL..."
systemctl enable mysql

# Start MySQL service
print_status "Starting MySQL service..."
systemctl start mysql

# Wait for MySQL to be ready and verify it's listening on port 3306
print_status "Waiting for MySQL to be ready..."
for i in {1..30}; do
    if mysqladmin ping --silent; then
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

# Verify MySQL is running and listening on port 3306
if ! systemctl is-active --quiet mysql; then
    print_error "MySQL service failed to start"
    systemctl status mysql
    exit 1
fi

if ! netstat -ln | grep -q ":3306 "; then
    print_error "MySQL is not listening on port 3306"
    netstat -ln | grep mysql || true
    exit 1
fi

print_status "MySQL is running and listening on port 3306"

# Install PM2 for process management
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

# Setup MySQL database
print_status "Setting up MySQL database..."
mysql -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;"
mysql -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY 'secure_password_here';"
mysql -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

# Test database connection
print_status "Testing database connection..."
mysql -u $DB_USER -psecure_password_here -e "SELECT 1;" $DB_NAME || {
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

# Run database migrations
print_status "Running database migrations..."
sudo -u $APP_USER npm run db:migrate
sudo -u $APP_USER npm run db:seed

# Setup systemd service
print_status "Setting up systemd service..."
cp systemd/email-platform.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable email-platform
systemctl start email-platform

# Setup Nginx
print_status "Configuring Nginx..."
cp deployment/nginx.conf /etc/nginx/sites-available/email-platform
ln -sf /etc/nginx/sites-available/email-platform /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Setup SSL (you'll need to replace your-domain.com with your actual domain)
print_warning "SSL setup requires manual configuration. Run:"
print_warning "certbot --nginx -d your-domain.com -d www.your-domain.com"

# Start services
print_status "Starting services..."
systemctl restart nginx
systemctl restart email-platform

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
systemctl status email-platform --no-pager
systemctl status nginx --no-pager

print_status "Deployment completed successfully! 🎉"
print_warning "Don't forget to:"
print_warning "1. Update the domain name in /etc/nginx/sites-available/email-platform"
print_warning "2. Set up SSL with: certbot --nginx -d your-domain.com"
print_warning "3. Update environment variables in /etc/systemd/system/email-platform.service"
print_warning "4. Change default database password"

echo ""
echo "📋 Application Info:"
echo "   - Application URL: http://your-server-ip"
echo "   - Application Directory: $APP_DIR"
echo "   - Log Files: $APP_DIR/logs/"
echo "   - Service: systemctl status email-platform"
echo "   - Default Login: admin@demo.com / admin123"